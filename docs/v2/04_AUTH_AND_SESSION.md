# 04 · Authentication & Session

> The Android app must (a) get the user logged in, (b) keep them logged in, (c) refresh / re-auth gracefully, and (d) lock down sensitive ops with a second factor. v1 captured the JWT shape only; this doc fills in the rest of the lifecycle.

## §1 Login flow (verified)

`POST /api/auth/login` (or per-app variant)
```json
// Request
{ "username": "kasir01", "password": "secret" }

// Response (200) — verified shape from v1
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1234,
    "name": "Kasir 01",
    "username": "kasir01",
    "id_role": 3,                    // role enum, see §2
    "id_user_application": 999,
    "id_outlet": 5,                  // primary outlet
    "id_merchant": 88,               // = "majoo store" / merchant
    "outlets": [5, 6, 7],            // optional; multi-outlet users have a list
    "expired_at": "2027-05-03T12:00:00Z",
    "subscription_tier": "ADVANCE", // [inferred] — see 06_FEATURE_TIERS.md
    "permissions": [...]            // [inferred] — see 05_PERMISSIONS.md
  }
}
```

JWT payload (HS256, 24-hour lifetime, `[verified]` from v1):
```json
{
  "id_user_application": 999,
  "id_role": 3,
  "id_outlet": 5,
  "id_merchant": 88,
  "username": "kasir01",
  "iat": 1746201600,
  "exp": 1746288000
}
```

Header conventions per service:
- Modern services (`ms-*`, `svc-*`) — `Authorization: Bearer <token>`
- Legacy mayang services — `Authorization: Token <token>` (older convention)
- Some endpoints accept either; client should use `Bearer` and fall back to `Token` on `401`.

### Indonesian validation copy
- Username empty → "Username wajib diisi"
- Password empty → "Password wajib diisi"
- Wrong creds → "Username atau password salah"
- Account locked → "Akun terkunci. Hubungi support."
- Subscription expired → "Langganan Anda telah berakhir."

## §2 Role enum

From bundle (`assets/extracted/roles_privileges.txt`):

| Role | id | Mobile-relevant note |
|---|:-:|---|
| ADMIN | 1 | Owner-level. Full access. |
| OWNER | 1 (alias) | |
| MANAGER | 2 | Outlet manager. Most features, no settings. |
| KASIR / CASHIER | 3 | POS only. |
| STAFF | 4 | Limited POS + view-only reports. |
| WAREHOUSE | 5 | Stock + opname + receiving. |
| WAITERS | 6 | Table order + send to kitchen. |
| KITCHEN | 7 | KDS only. |
| CUSTOM_PRIVILEGE | n | Custom role with explicit permission flags per menu. |

Privileges per menu (4 standard flags):
- `view`, `create`, `update`, `delete`

Menu inventory with permissions in `docs/majoo_menu_flat.tsv` (293 items, 205 with URL).

See `05_PERMISSIONS.md` for the full role × menu × action matrix.

## §3 Token lifecycle (no refresh endpoint)

**Critical finding (v1):** The Majoo dashboard re-authenticates by re-prompting the password. **No `/auth/refresh` or `/auth/silent` endpoint is exposed in the bundle.**

Implications for Android:

1. **Silent refresh is impossible.** When the JWT expires (24h), the next request fails with `401`.
2. **Recommended UX:** When `401` is observed:
   - If the user is still in foreground and the cached password is available in `EncryptedSharedPreferences` (only if user opted in to "Keep me signed in"), retry login silently.
   - Otherwise, redirect to a lock screen (PIN / biometric) that re-collects the password.
3. **Cached password.** Android `EncryptedSharedPreferences` (Tink + Android Keystore). Never log it.
4. **Force logout on app upgrade with breaking auth changes** — keep a `min_supported_token_version` so a server change can purge old sessions.

### Suggested re-auth flow

```
Foreground request → 401
   ↓
Has cached password?
   ├─ Yes → Try login silently
   │     ├─ Success → Replay original request
   │     └─ Fail (e.g. password rotated) → Lock screen
   └─ No  → Lock screen (PIN/biometric)
                ↓
              On unlock → ask for password OR auto-login if cached
                ↓
              Replay original request
```

## §4 Multi-device, same outlet

Multiple Android devices may be authenticated to **the same outlet** (kasir01 phone + tablet, or kasir01 + kasir02 on the same outlet, or KDS + waiter app + main POS).

Recommended request augmentation:
- `X-Terminal-Id: <uuid generated on first launch>` — identifies the device.
- `X-App-Version: <versionCode>`
- `X-Device-Model: <Build.MANUFACTURER + Build.MODEL>` (for support troubleshooting)

Implications:
- Server should accept concurrent requests with the same `id_user_application` from different terminals.
- Order numbers must be either (a) server-side generated atomically, or (b) client-prefix-namespaced (`<terminal>-<seq>`) to avoid collisions during offline queue replay. **Majoo appears to use server-side generation `[inferred]`** — confirm against transaction insert response.

## §5 Employee PIN / passcode (sensitive ops)

Some ops (void, refund, settle, change discount, manual price override) require a **manager PIN** even on a logged-in cashier device. v1 didn't capture this — needs a UI like:
```
[ Konfirmasi Void Transaksi ]
PIN Manager:  ____
[ Batal ]   [ Konfirmasi ]
```

Where to enforce:
- Void → manager PIN
- Refund → manager PIN
- Manual discount > X % → manager PIN
- Price override → manager PIN (or block)
- Open cash drawer without sale → manager PIN
- Cash drop / pickup → manager PIN
- Settle (tutup kasir) → cashier's own password (re-confirm)

PIN reset flow: only OWNER can reset another user's PIN. Suggest endpoint `POST /api/users/:id/reset-pin` with email-based OTP `[inferred]`.

## §6 Biometric unlock

For convenience, allow biometric (fingerprint / face) to bypass the password prompt for **non-sensitive** unlocks (bringing the app back from background). Sensitive ops must still require explicit PIN.

Library: `androidx.biometric:biometric:1.1.0+`.

```kotlin
BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        // unlock app — token still valid OR force re-login
    }
})
```

Disable biometric if:
- `BiometricManager.from(ctx).canAuthenticate(BIOMETRIC_STRONG)` returns `BIOMETRIC_ERROR_NO_HARDWARE` / `_NONE_ENROLLED`.
- User toggles it off in app settings.
- Privacy policy of merchant (some retailers may require typed PIN per shift).

## §7 Multi-outlet switcher

Users with multiple outlets see a top-bar dropdown. Selection persists locally and is propagated as `X-Outlet-Id` header on every request.

Implementation:
```kotlin
class OutletInterceptor(private val outletStore: OutletStore) : Interceptor {
  override fun intercept(chain: Chain): Response {
    val rb = chain.request().newBuilder()
    outletStore.activeId()?.let { rb.header("X-Outlet-Id", it.toString()) }
    return chain.proceed(rb.build())
  }
}
```

The token already carries the *primary* `id_outlet`, but the header lets the user "act on behalf of" a different outlet they have permission for.

Server contract `[inferred]`: header `X-Outlet-Id`, fallback to JWT `id_outlet` when absent.

## §8 App lock (idle timeout)

Auto-lock the app after **5 minutes of idle** in the foreground (app-config'able). On lock:
- Show full-screen lock; user must re-enter PIN or biometric.
- Do not destroy session; just hide the UI.
- Cashier's open shift remains open.

Special cases:
- Active POS cart: warn before lock that cart will be saved to "Hold" state.
- Mid-print: wait until printer ack.
- Mid-payment: do not lock until payment ack returns.

## §9 Logout

`POST /api/auth/logout` `[inferred]` — revokes the token server-side. On logout:
- Clear `EncryptedSharedPreferences` token + cached password.
- **Drain the offline sync queue first** (block until empty or user explicitly confirms data loss).
- Close any open cashier shift (force settle).
- Clear Room cache (master data + local images).
- Reset `X-Terminal-Id` only if user explicitly chose "Logout & forget device".

## §10 Force update (compromised token / app)

If `403 FORBIDDEN_VERSION` (suggest server convention) is returned, hard-block the app and force update.

```json
{ "error": "FORBIDDEN_VERSION", "min_version": 142, "message": "Versi aplikasi terlalu lama. Mohon update." }
```

## §11 Compliance notes

- **Indonesian PSE registration** — Majoo is a registered PSE. Android app must comply with Indonesian data localization expectations (data stored in ID).
- **POJK / Bank Indonesia** — payment-touching screens (QRIS, EDC, settle) must comply with BI/POJK rules. Confirm with majooPay specs.
- **PCI-DSS** — if EDC integration involves card PAN passing through the app, PCI-DSS applies. Use ECR mode (PAN never enters POS app) wherever possible.

## §12 Open questions for live re-validation

| Q | Where to verify |
|---|---|
| Does `POST /api/auth/refresh` actually exist (not in current bundle)? | Network HAR after dashboard idle for >24h |
| What's the exact `permissions` array shape in login response? | Login response body |
| Is `subscription_tier` in login response or in a separate `/api/me/subscription` call? | Network HAR on dashboard load |
| What error code identifies "token expired" vs "token invalid"? | Send expired token, observe 401 body |
| Does mayang token (`Authorization: Token ...`) accept the same JWT or a different one? | Hit `/api/jurnal/...` with both header styles |
| Is there a per-terminal session table on the server? | Concurrent login from 2 devices, see if both stay alive |
