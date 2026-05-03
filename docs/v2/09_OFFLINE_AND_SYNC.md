# 09 · Offline Mode & Sync

> POS without offline = unusable. This doc defines the offline-first contract for VIPOS Android.

## §1 Offline-first principle

| Workflow | Offline behaviour |
|---|---|
| Login | Requires network. Token cached after success. |
| Open shift (Buka Kasir) | Works offline if user previously logged in within 30 days. |
| Take order (POS) | Fully offline. |
| Receive payment (cash, manual EDC, manual QRIS) | Offline. |
| Receive payment (online QRIS dynamic) | Requires network — show "Maaf, QRIS dinamis butuh internet." |
| Print receipt | Works offline (printer is local). |
| Open cash drawer | Offline. |
| Add customer | Offline (queue + sync). |
| Search customer by phone | Offline (against cached customer list). |
| Apply promo | Offline (against cached promo rules). |
| Apply coupon | Requires network for first validation. After validate, code is cached & valid offline for 1 use. |
| Loyalty redeem | Offline if balance is cached. Sync on reconnect. |
| Stock-in (PO/GR) | Offline. |
| Stock opname | Offline. |
| Mutation | Offline. |
| Reports | Offline (against cached transactions). |
| Marketplace order ingest | Online only. |
| Tutup kasir | Works offline; sync on reconnect. |

## §2 Storage layers

| Layer | Purpose | Tech |
|---|---|---|
| Master data cache | Catalogue, customers, promos, payment methods, taxes, employees, outlets | Room (SQLite) |
| Transaction log | Local POS transactions | Room |
| Outbound queue | Operations waiting to sync to server | Room (`outbox` table) |
| Image cache | Product images, receipt logos | Coil disk cache (≤ 250 MB) |
| Settings | User prefs, hardware config | EncryptedSharedPreferences |

## §3 Master data sync

### Bootstrap on first login

After successful login, fetch and cache:
- Outlets (the user's accessible list)
- Active outlet's full catalogue (`/product?id_outlet=X&include=variants,extras,recipe`)
- Active outlet's customer list (paged, max 5000 per outlet)
- Active outlet's promos
- Active outlet's payment methods
- Active outlet's taxes / service charges
- Active outlet's employees
- Master wilayah (provinces / cities — used for new customer)

Show a progress UI: "Mengunduh data toko…"

### Incremental sync

After bootstrap, every X seconds (configurable, default 60 s):
```
GET /api/v1/sync?last_sync=2026-05-03T10:00:00Z
→ {
  "products": [{...},{...}],     // changed since last_sync
  "products_deleted": [123, 456],
  "customers": [...],
  "customers_deleted": [...],
  "promos": [...],
  "promos_deleted": [...],
  ...
  "now": "2026-05-03T10:01:00Z"
}
```

Save the new `now` as the next `last_sync`. The endpoint must exist or be added on the server.

### Manual refresh

User can pull-to-refresh on any list screen → forces a sync of that entity type.

### Sync conflict on master data

If user A edits product locally offline, and user B edits the same product online:
- Server timestamp wins (last-write-wins).
- On sync, local edit is overwritten.
- Show a non-blocking toast: "Perubahan {field} di-overwrite oleh user lain."

For VIPOS v1, simple LWW is acceptable. Don't over-engineer.

## §4 Outbound queue (offline writes)

Every offline write goes into an `outbox` table:

```kotlin
@Entity(tableName = "outbox")
data class OutboxEntry(
  @PrimaryKey val id: String,        // UUID
  val createdAt: Instant,
  val method: String,                // POST/PUT/DELETE
  val path: String,
  val body: String,                  // JSON
  val idempotencyKey: String,
  val retryCount: Int = 0,
  val nextRetryAt: Instant?,
  val lastError: String?,
)
```

### Writer flow

1. UI dispatches action (e.g. "submit transaction").
2. Writer:
   - Validates locally
   - Persists optimistically to local DB (status `PENDING_SYNC`)
   - Adds entry to `outbox`
   - Returns success to UI immediately
3. Background WorkManager job processes outbox.

### WorkManager processor

```kotlin
class OutboxWorker(...) : CoroutineWorker(...) {
  override suspend fun doWork(): Result {
    val entries = outboxDao.allReady()
    for (e in entries) {
      try {
        val resp = api.send(e.method, e.path, e.body, headers = mapOf(
          "X-Idempotency-Key" to e.idempotencyKey
        ))
        if (resp.isSuccessful) {
          outboxDao.delete(e.id)
          // mark local entity as SYNCED, optionally apply server response
        } else {
          handleError(e, resp)
        }
      } catch (t: Throwable) {
        e.retryCount++
        e.nextRetryAt = nextBackoff(e.retryCount)
        outboxDao.update(e)
      }
    }
    return Result.success()
  }
}
```

Constraints:
- `setRequiredNetworkType(NetworkType.CONNECTED)`
- `setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)`
- Periodic every 15 minutes minimum (Android limits)
- Also expedited via `OneTimeWorkRequest` whenever connectivity returns

### Conflict resolution per entity type

| Entity | Strategy |
|---|---|
| Transaction | Server is source of truth; client transaction has UUID `clientId`; server returns its `id`; client maps. Idempotent. |
| Customer (new) | Same — UUID maps to server id. |
| Customer (update) | LWW. |
| Stock opname | Append-only — no conflict. |
| Stock movement | Append-only. |
| Mutation | Receiver outlet acks separately; conflict if mutation deleted before recv (rare). |
| Shift open/close | One per terminal at a time; server rejects if already-open conflict (edge case during clock skew). |
| Promo redemption | Server enforces max-redemption; client may queue redemption that's later rejected. Handle as `409` → show "Promo habis" + remove from cart in retroactive UI fix. |

### Permanent-failure handling

If an outbox entry fails 5 times with `400/403/404/409/422` (non-retryable) → mark as `FAILED`, surface in a "Sinkronisasi Gagal" view. User can:
- Inspect the payload
- Edit and re-queue
- Discard

Critical: never silently drop a payment. If a payment fails to sync 5 times, escalate to a full-screen modal so cashier knows.

## §5 Network state machine

```
ONLINE (connected, server reachable)
    ↓ network drops
OFFLINE (no connectivity)
    ↓ network returns
SYNCING (connectivity restored, draining outbox)
    ↓ outbox empty
ONLINE
```

UI indicator:
- Green dot: `ONLINE`
- Yellow dot + counter: `SYNCING` (e.g. "3 belum sync")
- Red dot: `OFFLINE` (e.g. "Mode offline")
- Red dot + warning: `FAILED` (e.g. "1 sync gagal — tap untuk inspect")

Use `ConnectivityManager.NetworkCallback` (or DataStore-backed flow) to detect transitions.

## §6 Local-server feature (Prime)

Majoo Prime offers "Local Server" — a tablet/PC on the LAN runs a sync server; all POS terminals talk to it; the local server batches and forwards to the cloud when WAN returns.

For VIPOS v1, this is **out of scope**. Document for v2:
- Local server runs on tablet with public IP `192.168.X.Y:3001`
- POS app discovers via mDNS (`_vipos-local._tcp`)
- POS auto-prefers local URL when reachable; falls back to cloud
- Local server handles outbox + master sync internally

## §7 Long offline window

If the device is offline for >7 days:
- Show banner "Anda offline lama. Beberapa data mungkin tidak akurat."
- On reconnect, do a **full** master refresh, not incremental.
- Token may have expired (24h server-side); show re-auth prompt.

## §8 Clock skew

Android clock can drift. Use `SystemClock.elapsedRealtimeNanos()` for elapsed-time measurements (printer timeout, idle timeout). Use `Instant.now()` for absolute timestamps but accept that the server will overwrite on sync.

For order numbers / sequence numbers offline, use a **per-terminal monotonic counter** stored in Room. The server reconciles to its canonical numbering after sync.

## §9 Storage limits

- DB target ≤ 200 MB
- After 90 days, archive transactions older than 90 days into a separate table (or delete if already synced + acknowledged).
- Image cache LRU at 250 MB.
- If storage runs low (< 500 MB free), warn user; disable image cache.

## §10 Backup / restore

- Use Android Auto Backup with encryption.
- Exclude `outbox` (sensitive payloads) and `EncryptedSharedPreferences` (already encrypted but user-bound).
- Include settings + hardware config.
- Allow manual export of transactions to CSV via Settings > Export.

## §11 Test plan

- Toggle airplane mode mid-transaction → confirm queued.
- Stay offline for 1 hour, do 50 transactions → reconnect → verify all 50 sync correctly.
- Force kill app mid-sync → reopen → verify no double-submit (idempotency key works).
- Tamper with system clock by ±1 day → verify sync still works (server clock authoritative).
- Run two devices offline → both make tx → reconnect both → verify both reach server with no collision.
- Hit "Sinkronisasi Gagal" inspector → edit + re-queue → verify resolves.
