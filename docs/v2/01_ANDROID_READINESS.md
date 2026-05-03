# 01 · Android Readiness — Mobile-Specific Gap Analysis

> The single most important doc in this set. v1 analysed the *web* dashboard. This doc says *what changes for mobile* and *what was missing from v1*.

## TL;DR — what an Android engineer absolutely must NOT skip

| # | Concern | Status in v1 | Status now (v2) | Where addressed |
|---|---|---|---|---|
| 1 | Offline POS mode (cashier MUST work without internet) | Not analysed | Captured: queue + Local Server option | `09_OFFLINE_AND_SYNC.md` |
| 2 | Bluetooth thermal printer (ESC/POS 58 + 80 mm) | Not analysed | Captured: per-channel template (kasir / checker / dapur / label / delivery) | `08_HARDWARE_INTEGRATION.md`, `11_RECEIPT_TEMPLATES.md` |
| 3 | Barcode scanner (USB OTG + camera) | Not analysed | Captured: scancode handling + camera fallback | `08_HARDWARE_INTEGRATION.md` |
| 4 | Cash drawer kick (RJ-12 over printer) | Not analysed | Captured: ESC p 0 25 250 sequence | `08_HARDWARE_INTEGRATION.md` |
| 5 | FCM push (order alerts, KDS, marketing campaigns) | Not analysed | Channel + payload spec drafted | `10_PUSH_AND_DEEPLINK.md` |
| 6 | JWT lifecycle on mobile (no refresh endpoint found) | Partial | Captured: re-login on 401, biometric unlock for re-auth | `04_AUTH_AND_SESSION.md` |
| 7 | Multi-device same outlet (kasir + KDS + waiter on one outlet) | Not analysed | Captured: terminal_id + idempotency | `04_AUTH_AND_SESSION.md`, `09_OFFLINE_AND_SYNC.md` |
| 8 | Sync conflict resolution (concurrent stock updates) | Not analysed | Captured: server-wins + reconciliation report | `09_OFFLINE_AND_SYNC.md` |
| 9 | Sub-tier feature gating (Lite vs Starter vs Advance vs Prime vs Prime+) | Not analysed | Full matrix from reseller portal | `06_FEATURE_TIERS.md` |
| 10 | Receipt printing template per channel | Not analysed | 5 channels (kasir/checker/dapur/label/delivery) | `11_RECEIPT_TEMPLATES.md` |
| 11 | Camera permissions (KYC owner, transaksi photo, absensi foto wajah, opname) | Not analysed | Captured: 4 distinct camera use-cases | This doc, §3 |
| 12 | Geolocation (absensi geolocation) | Not analysed | Captured: required for clock-in / clock-out | This doc, §3 |
| 13 | Image upload spec (produk, banner, owner KYC) | Partial | Captured: aspect ratio, size, format limits | `02_DATA_MODELS.md` §Images |
| 14 | Kitchen Display, Order Display, Self Order, Warehouse Display | Not analysed | Captured: 4 separate sub-app archetypes | `08_HARDWARE_INTEGRATION.md` §KDS-family |
| 15 | Marketplace ingest (GoFood/GrabFood/ShopeeFood/GrabMart/Tokopedia) | Not analysed | Captured: order ingestion + status mapping | `menus/order_online/` |
| 16 | E-menu QR (static + dynamic) | Not analysed | Captured: customer-facing self-order via QR | `menus/order_online/emenu.md` |
| 17 | Tax/service charge logic (per-item / per-bill / multi-tax stacking) | Not analysed | Captured: 3 modes | `12_TAX_AND_FEES.md` |
| 18 | Promo conditions (BOGO, tier, time-based, member-only, max use) | Not analysed | Captured: 14 condition types | `13_PROMO_AND_LOYALTY.md` |
| 19 | Loyalty / kupon / voucher / deposit | Not analysed | Captured: earn/redeem/expiry rules | `13_PROMO_AND_LOYALTY.md` |
| 20 | Localization (id-ID always, en-US fallback for some screens) | Partial | Captured: 9146 i18n strings | `assets/extracted/i18n_labels.txt` |
| 21 | Currency formatting (Rp + thousands separator + no decimals) | Not analysed | Captured: id-ID locale | This doc, §6 |
| 22 | Deep linking (whatsapp:// for struk digital, fcm://, intent filters) | Not analysed | Captured | `10_PUSH_AND_DEEPLINK.md` |
| 23 | Audit trail / activity log | Not analysed | Captured: who-did-what events | `02_DATA_MODELS.md` §AuditEvent |
| 24 | Error catalog with friendly Indonesian messages | Not analysed | 30+ codes captured | `07_ERROR_CATALOG.md` |
| 25 | Mandatory app-update gate (force version check) | Not analysed | Captured: check on launch | This doc, §5 |
| 26 | Background sync schedule (when, how often, battery-friendly) | Not analysed | Captured: WorkManager schedule | `09_OFFLINE_AND_SYNC.md` |
| 27 | Min device spec (Android 5.1+, 3 GB RAM, 32 GB storage) | Not analysed | Verified from majoolite.id FAQ | This doc, §1 |
| 28 | Permissions (BLUETOOTH, INTERNET, LOCATION, CAMERA, NOTIFICATIONS, READ_EXTERNAL_STORAGE) | Not analysed | Per-feature mapping | This doc, §3 |
| 29 | Multi-outlet switcher | Partial | Captured: cabang_id propagation per request | `04_AUTH_AND_SESSION.md` |
| 30 | Subscription expiry → graceful degradation | Not analysed | Captured: read-only after expiry | `06_FEATURE_TIERS.md` |
| 31 | Biometric / PIN re-auth for sensitive ops (void, refund, settle) | Not analysed | Captured: PIN required | `04_AUTH_AND_SESSION.md` |
| 32 | Background location for delivery tracking | Not analysed | [unknown] — Majoo Owner app may need it for kurir tracking | This doc, §3 |
| 33 | Customer display (second-screen) protocol | Not analysed | Captured: ChromeOS dual-screen + Android external display | `08_HARDWARE_INTEGRATION.md` |
| 34 | Weighing scale integration | Not analysed | [unknown] — bundle has nothing definitive | `08_HARDWARE_INTEGRATION.md` |
| 35 | EDC pinpad integration (BCA, BRI) | Not analysed | Captured: ECR over Bluetooth/serial | `08_HARDWARE_INTEGRATION.md`, `14_PAYMENT_METHODS.md` |
| 36 | Server clock skew | Not analysed | Captured: trust server's response timestamp | `09_OFFLINE_AND_SYNC.md` |
| 37 | Image cache size cap | Not analysed | Captured: Coil/Glide ~250 MB cap | This doc, §6 |
| 38 | App lock idle timeout | Not analysed | Captured: 5 min default, kasir-shift-bound | `04_AUTH_AND_SESSION.md` |

---

## §1 Minimum device specification

From [majoolite.id FAQ](https://majoolite.id/) (verified):
- **Android 5.1+** or **iOS 13+**
- **RAM ≥ 3 GB**
- **Storage ≥ 32 GB**

Recommendations for VIPOS Android target:
- **`compileSdk = 35`** (Android 15) — keep up with Play Store policy.
- **`minSdk = 21`** (Android 5.0 Lollipop) — matches Majoo's published floor and covers > 99 % of installed base.
- **`targetSdk = 35`** — required by Play Store after 2025-08-31.
- **`buildType.release` should ship with `r8` shrinking, ABI splits (`armeabi-v7a`, `arm64-v8a`, `x86_64`)** to keep APK < 30 MB per ABI.

## §2 Architectural decisions for mobile

| Decision | Recommendation | Reason |
|---|---|---|
| Language | Kotlin | First-class on Android; nullable types prevent NPEs in offline merge. |
| UI | Jetpack Compose + Material 3 | Faster dev than XML for the screen volume Majoo has. |
| DI | Hilt | Stable; works with Compose. |
| Network | Retrofit + OkHttp + Moshi | Matches the JSON shape Majoo uses; supports interceptor for `Authorization` and `cabang_id` headers. |
| DB | Room + KSP | Sufficient for offline POS queue and master-data cache. |
| Async | Kotlin coroutines + Flow | Required for offline-first reactive UI. |
| Image | Coil 2 | Compose-friendly. |
| Workers | WorkManager + ListenableWorker | Required for background sync. |
| Date/time | `java.time` (or `kotlinx-datetime` for multiplatform) | Always store ISO-8601 + UTC; render id-ID locally. |
| Money | `BigDecimal` (never `Double`) | Indonesian Rupiah has no fractional digits in retail but accounting reports do. |
| Crash reporting | Firebase Crashlytics (Majoo already uses Firebase) | Single SDK reuse. |
| Analytics | GA4 + Firebase Analytics | Same. |
| Push | FCM | Confirmed by `npm.firebase.bbd26a184db01f16f637.js` chunk in dashboard. |

## §3 Permissions × feature mapping

| Android permission | Used by | When prompted | Graceful degradation |
|---|---|---|---|
| `INTERNET` | All | Manifest-only | n/a |
| `ACCESS_NETWORK_STATE` | Sync queue | Manifest-only | n/a |
| `BLUETOOTH`, `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` (API 31+) | Thermal printer + EDC + customer display + scanner | First time user opens printer settings | Show "Hardware printer disabled" banner; receipt becomes share-only. |
| `CAMERA` | Barcode scan + absensi foto wajah + KYC owner + opname photo + product photo | First scan | Fallback to manual entry; selfie absensi blocked. |
| `ACCESS_FINE_LOCATION` | Absensi geolocation + delivery tracking | First clock-in | Block clock-in if outlet config requires it; warn on owner dashboard. |
| `ACCESS_COARSE_LOCATION` | Outlet auto-suggest at signup | First time user sees outlet list | Manual outlet pick. |
| `POST_NOTIFICATIONS` (API 33+) | Order alerts, KDS, marketing | First launch | Show in-app badge instead. |
| `READ_MEDIA_IMAGES` (API 33+) / `READ_EXTERNAL_STORAGE` (≤ 32) | Product image upload, banner, KYC | First image picker open | Block image upload; show explanation. |
| `WRITE_EXTERNAL_STORAGE` (≤ API 28) | Export laporan to PDF/XLS | First export | Use SAF (Storage Access Framework) on API 29+ — preferred. |
| `USE_BIOMETRIC` (API 28+) | Re-auth for void/refund/settle | First sensitive action | Fallback to PIN. |
| `RECEIVE_BOOT_COMPLETED` | KDS auto-launch | Manifest-only | n/a |
| `WAKE_LOCK` | KDS keep-awake | Manifest-only | n/a |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` (API 34+) | Background sync queue | n/a | Required for sustained sync. |
| `VIBRATE` | KDS new-order ping | Manifest-only | n/a |
| `BLUETOOTH_ADVERTISE` (API 31+) | [unknown] customer-display BLE pairing | n/a | n/a |

## §4 Camera use-cases

| Use-case | Quality | Filter | Output |
|---|---|---|---|
| Barcode scan (POS) | 720p preview, ML Kit Barcode | EAN-13, UPC-A, Code-128, QR | scanner result string |
| KYC owner ID | 1080p still | Full ID card frame guide | JPEG, ≤ 2 MB, server resize 1024 px |
| Product photo upload | 1080p still or gallery | Square crop | JPEG, ≤ 2 MB, server resize 1024×1024 |
| Banner upload (e-menu) | 1080p still or gallery | 16:9 crop | JPEG, ≤ 2 MB |
| Absensi foto wajah | 720p still, front-facing | Liveness check `[unknown]` | JPEG ≤ 1 MB + GPS lat/long + server timestamp |
| Stock opname evidence | 720p still | Free crop | JPEG ≤ 1 MB |
| Cash deposit slip | 1080p still or gallery | Free crop | JPEG ≤ 2 MB |

## §5 App-update gate

Implement a `getApiVersion()` ping on launch (suggest endpoint: `GET /api/version`). Response shape `[inferred]`:
```json
{
  "android": {
    "min_supported": 130,   // versionCode below this -> hard block
    "current_stable": 142,
    "force_update": false   // if true at any version <= current_stable, block
  }
}
```
Show:
- Soft update prompt (dismissable) if `versionCode < current_stable`.
- Hard update gate (modal, no skip) if `versionCode < min_supported` or `force_update`.

## §6 Locale, currency, time

- **Locale always `id-ID`** for Majoo product. English fallback only for legal copy.
- **Currency `Rp`** with thousand separator `.` and no decimal (retail). Accounting reports use 2 decimal `,`.
  - Example: `Rp1.234.567`. Avoid `IDR` ISO code in UI; backend may accept either.
- **Date format `dd MMM yyyy` (id) → `25 Mei 2026`** for display; ISO-8601 in API.
- **Time format `HH:mm` (24h)** — never AM/PM in Indonesia.
- **Number locale `id-ID`** — `.` for thousands, `,` for decimal in input.

## §7 Battery + perf budget

| Constraint | Target |
|---|---|
| Cold start (POS home) | ≤ 2.5 s on Android 9 / 3 GB phone |
| Sync queue idle CPU | < 1 % |
| Sync queue active CPU | < 15 % for ≤ 30 s burst |
| Image cache size | ≤ 250 MB on disk |
| DB size after 6 mo of mid-traffic outlet | ≤ 200 MB |
| FCM payload size | ≤ 4 KB (FCM cap) |
| Receipt print latency from "Bayar" tap → first byte to printer | ≤ 1.5 s on internet, ≤ 0.8 s offline |

## §8 What this doc does NOT cover

- **Live API verification** — every `[inferred]` flag in this set means we have not actually called the endpoint. When live access becomes available, validate.
- **Tablet vs phone vs ChromeOS sub-layouts** — Majoo officially supports tablet + smartphone + dual-screen + ChromeOS. Layout adaptation is an Android-app design exercise we have not done; only feature parity is captured here.
- **Per-screen analytics events** — Majoo likely fires GA4 events per screen view; we did not extract those.
- **Apple iOS readiness** — out of scope; Android-only.

## §9 Recommended next actions for VIPOS Android

1. Build a **POS sandbox app** that exercises the offline queue + thermal printer + barcode scanner end-to-end, with a *mock backend* that mimics Majoo's response shapes. (~1 week)
2. Promote `[inferred]` API rows to `[verified]` by running an authenticated probe pass against the Majoo dashboard. (~1 day with credentials)
3. Decide tier strategy for VIPOS — Majoo has 5 tiers (Lite, Starter, Advance, Prime, Prime+); VIPOS likely targets Starter/Advance equivalent first. (~stakeholder decision)
4. Pick the *narrowest viable hardware set* for v1 (recommended: 80 mm thermal printer over BT + USB-OTG barcode scanner) and stub the rest behind feature flags. (~stakeholder decision)
5. Adopt the screen list in `menus/` as the SCRUM backlog skeleton.
