# 03 · API Contract

> Refer to `assets/extracted/api_paths_v2.txt` (595 paths) for the full endpoint corpus. This doc covers conventions and the most-used paths.

## §1 Base URL & gateway

Production hostname: `https://api.majoo.id` (Kong API gateway). Behind it: 25+ microservices.

Each service is reachable through one of two URL schemes:

```
Modern services:   https://api.majoo.id/<service-prefix>/<path>
                    e.g. https://api.majoo.id/ms-master-data/api/v1/product

Legacy mayang:     https://api.majoo.id/api/<path>
                    e.g. https://api.majoo.id/api/jurnal/umum/status
```

Service prefixes seen in the bundle (top occurrences from `assets/extracted/service_domains.txt`):

| Prefix | Domain | Examples |
|---|---|---|
| `user-management` | Auth + users + privileges | `/user-management/login`, `/user-management/users` |
| `ms-master-data` | Catalogue master data | `/ms-master-data/api/v1/product`, `/api/v1/category` |
| `ms-product` | Product detail | `/ms-product/api/v1/product/:id` |
| `ms-promo-v2` | Promo engine | `/ms-promo-v2/api/promo` |
| `ms-transaction` | POS transactions | `/ms-transaction/api/v1/transaction` |
| `ms-finance` | Finance / accounting | `/ms-finance/api/v1/cash-account` |
| `ms-pelanggan` (or `ms-customer`) | Customer | `/api/v1/customer` |
| `ms-employee` | Employee | `/api/v1/employee` |
| `ms-marketing` | SMS/WA/Email blast | `/api/v1/campaign` |
| `ms-reservation` | Reservation + table | `/api/v1/reservation` |
| `ms-online-order` | Webstore + e-menu | `/api/v1/online-order` |
| `inventory` | Stock movements | `/api/v1/stock` |
| `payroll` | Salary + slip | `/api/v1/payroll` |
| `messaging` | Push + chat dashboard | `/api/v1/notification` |
| `mayang` (legacy) | Old Mayang stack | `/api/jurnal/...`, `/api/laporan/...`, `/api/v0/...` |

## §2 Authentication header conventions

| Service style | Header |
|---|---|
| Modern (`ms-*`, `svc-*`, `inventory`, `payroll`) | `Authorization: Bearer <jwt>` |
| Legacy mayang | `Authorization: Token <jwt>` *(older convention)* |

Detection: if the path begins with `/api/jurnal/`, `/api/laporan/`, `/api/biaya/`, `/api/v0/`, `/api/2_0_0/`, `/api/0_0_X/`, use `Token`. Otherwise use `Bearer`.

The Android app's OkHttp `AuthInterceptor`:
```kotlin
class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
  override fun intercept(chain: Chain): Response {
    val req = chain.request()
    val path = req.url.encodedPath
    val style = if (path.matches(Regex("/api/(jurnal|laporan|biaya|v0/|2_0_0/|0_0_\\d+/).*"))) "Token" else "Bearer"
    val newReq = req.newBuilder()
      .header("Authorization", "$style ${tokenStore.token()}")
      .header("X-Terminal-Id", tokenStore.terminalId())
      .header("X-App-Version", BuildConfig.VERSION_CODE.toString())
      .build()
    return chain.proceed(newReq)
  }
}
```

## §3 Standard request headers

| Header | Required | Purpose |
|---|:-:|---|
| `Authorization` | yes | Auth token. |
| `Content-Type: application/json; charset=utf-8` | yes (POST/PUT) | |
| `Accept: application/json` | yes | |
| `X-Terminal-Id` | recommended | Device fingerprint for multi-device safety. |
| `X-Outlet-Id` | optional | Override JWT's `id_outlet`. |
| `X-App-Version` | optional | For force-update logic. |
| `X-Idempotency-Key` | for POST writes | UUID; replay-safe key for offline-queue replay. |
| `Accept-Language: id-ID` | optional | Forces Indonesian error messages. |

## §4 Response shape conventions (TWO STYLES)

### Style A — Modern `ms-*` services
```json
{
  "status": {
    "code": "200",
    "message_id": "Berhasil",
    "message_en": "Success"
  },
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```
- HTTP status mirrors `status.code`.
- `data` may be array (list endpoints) or object (detail endpoints).
- `meta` only present on list endpoints.

### Style B — Legacy mayang
```json
{
  "message": "Success",
  "data": [...],
  "total": 100,
  "page": 1
}
```
- HTTP status is meaningful (200/201/400/404/500).
- No `status` envelope.
- Meta is flat at root.

## §5 Pagination

- **Modern services** — `?page=1&per_page=20` (1-indexed). `meta.total` for total count, `meta.page` for current.
- **Legacy mayang** — `?page=1&limit=20` or `?offset=0&limit=20` depending on endpoint.

The Android app should expose a `Pageable<T>` interface that adapts both styles via the service-prefix detection.

## §6 Filters & sorting

Common query params:
- `?search=` — full-text fuzzy
- `?from=YYYY-MM-DD&to=YYYY-MM-DD` — date range (transactions, reports)
- `?id_outlet=N` — outlet scope
- `?status=ACTIVE` — entity status
- `?sort=created_at:desc` — sort key + direction
- `?include=variants,extras` — related entities expansion

## §7 Most-used endpoints (priority for Android v1)

> Marker conventions per `00_INDEX.md` §Marker conventions.

### Auth

| Method | Path | Notes |
|---|---|---|
| `POST` | `/user-management/login` | `[verified]` Returns JWT + user. |
| `POST` | `/user-management/logout` | `[inferred]` Revokes token. |
| `POST` | `/user-management/forgot-password` | `[inferred]` Email OTP. |
| `POST` | `/user-management/reset-password` | `[inferred]` |

### Catalogue

| Method | Path | Notes |
|---|---|---|
| `GET` | `/ms-master-data/api/v1/department` | List departments |
| `POST` | `/ms-master-data/api/v1/department` | Create |
| `PUT` | `/ms-master-data/api/v1/department/:id` | Update |
| `DELETE` | `/ms-master-data/api/v1/department/:id` | Delete |
| `GET` | `/ms-master-data/api/v1/category` | List categories |
| `POST` | `/ms-master-data/api/v1/category` | Create |
| `GET` | `/ms-master-data/api/v1/product` | List products `?include=variants,extras` |
| `POST` | `/ms-master-data/api/v1/product` | Create — multi-tab payload |
| `PUT` | `/ms-master-data/api/v1/product/:id` | Update |
| `GET` | `/ms-master-data/api/v1/product/:id/variants` | Get variants |
| `GET` | `/ms-master-data/api/v1/product/:id/extras` | Get extras |
| `GET` | `/ms-master-data/api/v1/product/:id/recipe` | Get recipe |

### Customer

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/customer` | List `?search=...` |
| `POST` | `/api/v1/customer` | Create — auto code PLG-#### |
| `PUT` | `/api/v1/customer/:id` | Update |
| `DELETE` | `/api/v1/customer/:id` | Delete |
| `GET` | `/api/v1/customer/:id/loyalty` | Point + history |
| `GET` | `/api/v1/customer/:id/deposit` | Deposit ledger |
| `POST` | `/api/v1/customer/:id/deposit` | Top up |

### Transaction (POS)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/ms-transaction/api/v1/transaction` | Create — body has items, payments, promos |
| `GET` | `/ms-transaction/api/v1/transaction/:id` | Detail |
| `GET` | `/ms-transaction/api/v1/transaction` | List `?from=&to=&status=` |
| `POST` | `/ms-transaction/api/v1/transaction/:id/void` | Void with reason |
| `POST` | `/ms-transaction/api/v1/transaction/:id/refund` | Refund items |
| `POST` | `/ms-transaction/api/v1/transaction/:id/send-receipt` | Email/WA/SMS |
| `GET` | `/api/v1/shift/active` | Current shift |
| `POST` | `/api/v1/shift/open` | Buka kasir |
| `POST` | `/api/v1/shift/:id/close` | Tutup kasir |
| `POST` | `/api/v1/shift/:id/cash-drop` | Kas keluar |
| `POST` | `/api/v1/shift/:id/cash-pickup` | Kas masuk |

### Promo

| Method | Path | Notes |
|---|---|---|
| `GET` | `/ms-promo-v2/api/promo` | List |
| `POST` | `/ms-promo-v2/api/promo` | Create |
| `POST` | `/ms-promo-v2/api/promo/apply` | Test apply against a cart |
| `GET` | `/ms-promo-v2/api/coupon/:code` | Validate coupon |

### Inventory

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/stock` | Stock by outlet |
| `POST` | `/api/v1/stock-movement` | Generic IN/OUT |
| `GET` | `/api/v1/purchase-order` | List PO |
| `POST` | `/api/v1/purchase-order` | Create PO |
| `POST` | `/api/v1/purchase-order/:id/receive` | Create GR |
| `GET` | `/api/v1/opname` | List opname |
| `POST` | `/api/v1/opname` | Create opname |
| `POST` | `/api/v1/opname/:id/finalize` | Finalize |
| `POST` | `/api/v1/mutation` | Inter-outlet transfer |
| `POST` | `/api/v1/production` | Production from recipe |
| `POST` | `/api/v1/waste` | Record waste |
| `GET` | `/api/v1/supplier` | List suppliers |
| `POST` | `/api/v1/supplier` | Create supplier |

### Reports

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/laporan/ringkasan-penjualan` | Sales summary |
| `GET` | `/api/laporan/detail-penjualan` | Sales detail |
| `GET` | `/api/laporan/penjualan-per-kasir` | Per-cashier |
| `GET` | `/api/laporan/penjualan-per-produk` | Per-product |
| `GET` | `/api/laporan/penjualan-per-kategori` | Per-category |
| `GET` | `/api/laporan/penjualan-per-outlet` | Per-outlet |
| `GET` | `/api/laporan/penjualan-harian` | Daily |
| `GET` | `/api/laporan/jenis-bayar` | Payment-method breakdown |
| `GET` | `/api/laporan/void` | Void report |
| `GET` | `/api/laporan/refund` | Refund report |
| `GET` | `/api/laporan/promo` | Promo report |
| `GET` | `/api/laporan/poin` | Loyalty point report |
| `GET` | `/api/laporan/komplimen` | Complimentary report |
| `GET` | `/api/laporan/pajak` | Tax report |
| `GET` | `/api/laporan/pelanggan` | Customer report |
| `GET` | `/api/laporan/tutup-kasir` | Shift close report |
| `GET` | `/api/laporan/kas-kasir` | Cash drawer ledger |

### Finance

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/cash-account` | List |
| `POST` | `/api/v1/cash-account` | Create |
| `GET` | `/api/v1/cash-transaction` | Cash ledger |
| `POST` | `/api/v1/cash-transaction` | Create cash entry |
| `GET` | `/api/laporan/keuangan/neraca` | Balance sheet |
| `GET` | `/api/laporan/keuangan/laba-rugi` | P&L |
| `GET` | `/api/laporan/keuangan/arus-kas` | Cash flow |
| `GET` | `/api/laporan/keuangan/buku-besar/:account_id` | General ledger |
| `GET` | `/api/jurnal` | Journal entries |
| `POST` | `/api/jurnal` | Create journal |
| `GET` | `/api/jurnal/umum/status` | Status of automated journals |
| `GET` | `/api/v1/expense` | List expenses |
| `POST` | `/api/v1/expense` | Create expense |
| `GET` | `/api/v1/asset` | List fixed assets |

### Employee + payroll

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/employee` | List |
| `POST` | `/api/v1/employee` | Create |
| `GET` | `/api/v1/attendance` | Attendance log `?from=&to=` |
| `POST` | `/api/v1/attendance/check-in` | With photo + GPS |
| `POST` | `/api/v1/attendance/check-out` | |
| `GET` | `/api/v1/schedule` | Shift schedule |
| `POST` | `/api/v1/schedule` | Create |
| `GET` | `/api/v1/payroll` | List |
| `POST` | `/api/v1/payroll` | Create |
| `POST` | `/api/v1/payroll/:id/approve` | Approve |
| `POST` | `/api/v1/payroll/:id/pay` | Pay (auto-bank or manual) |

### Online order + marketplace

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/online-order` | List `?source=&status=` |
| `POST` | `/api/v1/online-order/:id/accept` | |
| `POST` | `/api/v1/online-order/:id/reject` | |
| `POST` | `/api/v1/online-order/:id/ready` | |
| `POST` | `/api/v1/online-order/:id/dispatch` | |
| `GET` | `/api/v1/marketplace/:source/menu` | Outgoing menu sync |
| `POST` | `/api/v1/marketplace/:source/sync` | Push catalogue to marketplace |

### Reservation

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/reservation` | List |
| `POST` | `/api/v1/reservation` | Create |
| `POST` | `/api/v1/reservation/:id/seat` | Seated → opens transaction |
| `POST` | `/api/v1/reservation/:id/cancel` | |

### Marketing

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/campaign` | List |
| `POST` | `/api/v1/campaign` | Create |
| `POST` | `/api/v1/campaign/:id/send` | Trigger send |
| `GET` | `/api/v1/template` | Templates |

### Settings + masters

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/outlet` | List outlets |
| `POST` | `/api/v1/outlet` | Create |
| `GET` | `/api/v1/payment-method` | List payment methods |
| `GET` | `/api/v1/tax` | List taxes |
| `GET` | `/api/v1/service-charge` | List service charges |
| `GET` | `/api/v1/printer` | List configured printers |
| `GET` | `/api/v1/wilayah/provinsi` | Master province |
| `GET` | `/api/v1/wilayah/kabupaten?id_provinsi=` | Cascading |
| `GET` | `/api/v1/wilayah/kecamatan?id_kabupaten=` | |
| `GET` | `/api/v1/wilayah/kelurahan?id_kecamatan=` | |

### Notification

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/notification` | List |
| `POST` | `/api/v1/notification/:id/read` | Mark read |
| `POST` | `/api/v1/device-token` | Register FCM token |

## §8 Idempotency for POST writes

When creating transactions, payments, opname, mutations, or any *write* that may be replayed by the offline queue:

- Client sends `X-Idempotency-Key: <uuidv4>` (also embed as `clientId` in the body).
- Server stores `(idempotency_key, response)` for 24 hours.
- Replay returns the same response.

Without this, an offline kasir submitting the same transaction twice (network glitch + replay) will create duplicate orders.

## §9 Rate limits

`[unknown]` — Majoo's rate limits are not documented publicly. Reasonable defaults to assume:
- Login: 5 attempts / 60 s
- Search endpoints: 60 RPS / token
- Write endpoints: 10 RPS / token
- Bulk operations (campaign send, marketplace sync): 1 RPS / token

Implement client-side backoff with jitter. On `429`, wait `Retry-After` seconds (if header present) or default 5 s.

## §10 Webhooks

For inbound (marketplace, payment gateway, FCM):
- `[inferred]` Marketplace webhooks land at `/api/webhook/<source>` (e.g. `/api/webhook/gofood`).
- `[inferred]` Payment gateway webhooks land at `/api/webhook/payment/<gateway>`.

Android app does not need to handle webhooks directly. The server pushes a notification through FCM when a webhook event fires.

## §11 GraphQL?

`[unknown]` — no GraphQL endpoints in the bundle. All REST.

## §12 OpenAPI / Swagger?

`[unknown]` — no public Swagger UI found. When live access is available, check `/swagger`, `/api-docs`, `/openapi.json` per service.

## §13 Recommendations for VIPOS Android

1. Use **Retrofit** with two `Service` interfaces — one for `Bearer` (modern) and one for `Token` (legacy mayang).
2. Centralize auth header logic in `AuthInterceptor`.
3. Add `IdempotencyInterceptor` that auto-generates `X-Idempotency-Key` for POST/PUT/DELETE.
4. Generic `ApiResponse<T>` adapter handles both response styles (Style A vs B) via response converter.
5. Map known error codes (see `07_ERROR_CATALOG.md`) to typed `ApiException` subclasses.
6. For all list endpoints, use a `Pageable<T>` factory that adapts paginated meta.
