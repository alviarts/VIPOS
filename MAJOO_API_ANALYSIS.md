# Majoo API Analysis — Reverse Engineering untuk Referensi VIPOS

**Tanggal analisa:** 3 Mei 2026
**Metode:** Pasif — download bundle JS publik dari `https://dashboard.majoo.id/`, decode struktur webpack, probe endpoint dengan JWT akun TRIAL pribadi (read-only, tidak ada modifikasi data).
**Tujuan:** Dipakai sebagai blueprint untuk implementasi back-end VIPOS dan untuk referensi struktur fitur (URL routing, permissions, naming conventions).
**PENTING:** JWT user (`token` di `localStorage["majoo::user"].token`) tidak boleh di-commit ke repo. Disimpan secara lokal saja di `~/.majoo_token` (chmod 600) selama session analisis.

---

## 1. Ringkasan Arsitektur

```
┌─────────────────────┐
│  dashboard.majoo.id │   (React SPA — 1180 webpack chunks, ~25 MB total)
└──────────┬──────────┘
           │
           │ HTTPS (CORS)
           │
┌──────────▼──────────────────────────┐
│  Cloudflare (DDoS / TLS / Edge)     │
└──────────┬──────────────────────────┘
           │
┌──────────▼──────────────────────────┐
│  Kong API Gateway 3.3.1             │
│  (services.majoo.id)                │
│  Headers exposed:                   │
│   X-Auth-Token                      │
│   X-Total-Page, X-Total-Record      │
│   x-security-key                    │
│   x-client-longitude                │
│   x-client-latitude                 │
└──────────┬──────────────────────────┘
           │
   ┌───────┴────────────────────────────────┐
   ▼                                        ▼
[ms-* monoliths]                  [svc-* microservices]
ms-master-data, ms-transaction,   svc-transaction, svc-data-reporting,
ms-accounting, ms-notification,   svc-accounting-report, svc-reporting,
ms-shipping, ms-promo-v2,         svc-audit-log, svc-multi-language,
ms-mp-aggregator, ms-biller,      svc-activity-http
ms-report, ms-gobiz-utilities,
ms-e-menu-utilities, ms-e-menu-tentakel
+ inventory, payroll, user-management, messaging, mayang, portal
```

**Bahasa server:** Tidak diketahui pasti. Pesan error spesifik ("Not Found", "{message: 'no Route matched...'}", "{status:{code,message}}") menunjukkan kombinasi Kong + beberapa framework backend (kemungkinan Go, Node, atau campuran).

**External CDN/Service hosts:**
- `https://services.majoo.id` — base API gateway (Kong)
- `https://mayang.majoo.id/` — file/asset CDN (image upload, dll.)
- `https://biller.majoo.id/` — billing/subscription service
- `https://chat.majoo.id` — chat widget
- `https://apm.majoo.id` — application performance monitoring (Elastic APM)
- `https://majoo.id/` — main marketing portal

---

## 2. Authentication

### 2.1 JWT Format

Tipe: **JWT HS256**
Storage: `localStorage["majoo::user"].token`
Lifetime: ~24 jam (1 hari)

**Payload claims (struktur JWT — value di-redact):**
```json
{
  "id": "<user_id>",
  "cabang_id": "<outlet_id>",
  "username": "<username>",
  "iat": <issued_at_unix>,
  "exp": <expires_at_unix>,
  "is_cms": 1
}
```

| Field | Tipe | Deskripsi |
|---|---|---|
| `id` | string | User ID owner |
| `cabang_id` | string | Outlet ID aktif |
| `username` | string | Username/handle |
| `iat` | int | Issued at (unix timestamp) |
| `exp` | int | Expires at (~24h after iat) |
| `is_cms` | int | 1 = CMS dashboard token, 0/absent = mobile/POS token |

**Catatan refresh:** Tidak ditemukan endpoint refresh-token eksplisit. JWT diperoleh ulang via login (re-auth dengan password) atau `/0_0_11/user/login` (lihat §4.1).

### 2.2 Header pengiriman token

Berdasarkan reverse-engineer fungsi request di bundle (`u=async(e,t={},a="get",u={})=>...`):

```js
// Pseudo-code di main.js (sudah de-minified):
if (token) {
  if (options.authType === "bearer") {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["Token"] = token;       // default (legacy)
  }
}
```

**Praktik:**
- **Endpoint baru / `svc-*` / `user-management`** → pakai `Authorization: Bearer <jwt>`
- **Endpoint lama / `0_0_X/`** → pakai `Token: <jwt>` (tanpa "Bearer")
- Beberapa endpoint sensitif (login, reset) butuh tambahan header `x-security-key: <captcha-token>` (Google reCAPTCHA token)

**Hasil probe yang relevan:**
| Header | Endpoint | Hasil |
|---|---|---|
| `Authorization: Bearer <jwt>` | `GET /user-management/api/v1/owner-apps/account` | **200 OK** ✓ |
| `Token: <jwt>` | `GET /user-management/api/v1/owner-apps/account` | 400 "missing or malformed jwt" |
| `Authorization: Bearer <jwt>` | `GET /ms-promo-v2/v1/promo?outlet_id=<outlet_id>` | **200 OK** ✓ |

### 2.3 Header tambahan yang umum dikirim browser

```
Origin: https://dashboard.majoo.id
Referer: https://dashboard.majoo.id/
Accept: application/json
Accept-Language: id  (atau "en")
Content-Type: application/json
User-Agent: <browser default>
x-client-longitude: <opsional, untuk geo-tracking>
x-client-latitude:  <opsional>
```

---

## 3. Service Domain Registry

Bundle utama (`main.js`) men-define mapping `serviceDomainType` → URL prefix. Setiap call API memilih satu service domain dan path-nya di-rewrite oleh Kong ke microservice yang sesuai.

| `serviceDomainType` | Prefix URL | Service | Frekuensi pemakaian (count) |
|---|---|---|---|
| (default, tanpa type) | `/mayang/` | File/asset (mayang) | — |
| `item` | `/ms-master-data/` | Master data (kategori, produk, departemen) | tidak aktif |
| `acc` | `/ms-accounting/` | Akuntansi | 211 |
| `trx` | `/ms-transaction/api/` | Transaksi (legacy v1) | 11 |
| `ms-transaction` | `/ms-transaction/` | Transaksi (newer) | 121 |
| `svc-transaction` | `/svc-transaction/` | Transaksi v2 (microservice) | 137 |
| `notification` | `/ms-notification/` | Notifikasi | 15 |
| `report` | `/ms-report/` | Laporan | — |
| `datamart` | `/svc-data-reporting/` | Datamart laporan | 176 |
| `non-datamart` | `/svc-reporting/` | Reporting non-datamart | 89 |
| `datamart-accounting` | `/svc-accounting-report/` | Datamart akuntansi | — |
| `marketplace` | `/ms-mp-aggregator/` | Marketplace aggregator (Shopee, Grab) | 78 |
| `biller` | `https://biller.majoo.id/` | Billing/subscription (host terpisah) | 47 |
| `gobiz` | `/ms-gobiz-utilities/` | GoBiz integration | — |
| `emenu_utilities` | `/ms-e-menu-utilities/` | E-menu utilities | 59 |
| `emenu_tentakel` | `/ms-e-menu-tentakel/` | E-menu tentakel | — |
| `shipping` | `/ms-shipping/` | Shipping | 2 |
| `promo` / `promoV2` | `/ms-promo-v2/` | Promo & loyalti | 35+23 |
| `user-management` | `/user-management/` | User auth & profile | 925 |
| `payroll` | `/payroll/` | Payroll | 349 |
| `no-service` | `/inventory/` | Default inventory (most-used legacy) | **1610** |
| `multi-language` | `/svc-multi-language/` | i18n | 1 |
| `messaging` | `/messaging/` | Chat/messaging | 120 |
| `svc-activity` | `/svc-activity-http/` | Activity tracking | 6 |
| `log-activity` | `/svc-audit-log/` | Audit logs | 3 |
| `svc-inventory` | (belum ditemukan) | Inventory v2? | 13 |
| `portal` | `https://majoo.id/` | Marketing portal (host terpisah) | 65 |

**Konstruksi URL:**
```js
const url = `${BASE_SERVICE}${PREFIX}${PATH}${SLASH_ID}${QUERY_STRING}`;
// contoh:
// BASE_SERVICE = "https://services.majoo.id"
// PREFIX = "/user-management/"
// PATH = "api/v1/owner-apps/account"
// → https://services.majoo.id/user-management/api/v1/owner-apps/account
```

---

## 4. Endpoint yang Sudah Diverifikasi (Live Probe)

### 4.1 Login (POST)

**Path JS constant:** `0_0_11/user/login`
**Service domain:** default (mayang) — perlu diuji dengan kredensial valid + `x-security-key`

**Estimated full URL** (perlu konfirmasi):
```http
POST /mayang/0_0_11/user/login HTTP/1.1
Host: services.majoo.id
Content-Type: application/json
x-security-key: <Google reCAPTCHA token>
Origin: https://dashboard.majoo.id

{
  "username": "<email atau phone>",
  "password": "<plaintext>"
}
```

> Probe ke `https://services.majoo.id/mayang/0_0_11/user/login` mengembalikan Kong "no Route" — kemungkinan bisa lewat host lain (`dashboard.majoo.id` proxy) atau prefix yang salah. Browser-side flow login adalah yang paling reliable untuk probe lebih lanjut.

**Response (estimasi berdasarkan pattern Majoo):**
```json
{
  "status": { "code": 200, "message": "success" },
  "data": {
    "token": "<JWT>",
    "user": { "id": "...", "username": "...", "email": "..." }
  }
}
```

### 4.2 Get Owner Account (GET) ✓ **VERIFIED 200**

```http
GET /user-management/api/v1/owner-apps/account HTTP/1.1
Host: services.majoo.id
Authorization: Bearer <JWT>
```

**Response (live):**
```json
{
  "status": {
    "code": 200,
    "message": "success"
  },
  "data": {
    "user_id": 0,
    "phone_number": "",
    "status": false
  }
}
```

> Note: nilai `user_id=0`, `phone_number=""`, `status=false` karena akun TRIAL belum lengkap profile-nya. Pada akun production seharusnya `user_id` = real ID, `phone_number` = nomor terverifikasi, `status` = true.

### 4.3 Get Promo List (GET) ✓ **VERIFIED 200**

```http
GET /ms-promo-v2/v1/promo?outlet_id=<outlet_id> HTTP/1.1
Host: services.majoo.id
Authorization: Bearer <JWT>
```

**Response (live):**
```json
{
  "message": "get success",
  "data": [],
  "meta": {
    "current_page": 0,
    "per_page": 0,
    "total": 0,
    "last_page": 0
  }
}
```

**Pagination params (umum di seluruh API):**
- `page` (1-indexed)
- `per_page`
- `outlet_id` (wajib di banyak endpoint outlet-scoped)

### 4.4 Promo Types (GET)

```http
GET /ms-promo-v2/v1/promo/types?outlet_id=<outlet_id>
Authorization: Bearer <JWT>

# Response: 422 "promo not found" (akun trial belum punya promo)
```

### 4.5 svc-activity-http root (GET)

```http
GET /svc-activity-http/
→ 200 OK "Hello from the other side!"   (health check)
```

---

## 5. Endpoint Catalog (Discovered)

**Total: 533 path constants** (dikumpulkan dari 1180 webpack chunks + main.js).
Lihat file `docs/majoo_api_paths.txt` untuk daftar lengkap. Ringkasan per grup:

### 5.1 `api/v1/...` (paling umum)

| Group | Count | Contoh |
|---|---|---|
| `api/v1/dashboard_sales/...` | 9 | `api/v1/dashboard_sales/best_selling`, `api/v1/dashboard_sales/summary/list`, `api/v1/dashboard_sales/payment_method` |
| `api/v1/dashboard_accounting/...` | 8 | `api/v1/dashboard_accounting/balance_sheet`, `api/v1/dashboard_accounting/cash_flow`, `api/v1/dashboard_accounting/profit_loss` |
| `api/v1/employee/...` | 5 | `api/v1/employee`, `api/v1/employee/list`, `api/v1/employee/access` |
| `api/v1/sales/...` | 7 | `api/v1/sales/daily`, `api/v1/sales/per_cashier` |
| `api/v1/promo_sales/...` | 5 | `api/v1/promo_sales`, `api/v1/promo_sales/detail` |
| `api/v1/loan/...` | 6 | `api/v1/loan/access`, `api/v1/loan/transaction` (Majoo Capital) |
| `api/v1/whatsapp/...` | 6 | `api/v1/whatsapp/client`, `api/v1/whatsapp/template` |
| `api/v1/salary/...` | 5 | `api/v1/salary/account`, `api/v1/salary/component` |
| `api/v1/settlement/...` | 5 | `api/v1/settlement/qris`, `api/v1/settlement/biller` |
| `api/v1/tiered-employee-reward/...` | 5 | reward bertingkat untuk karyawan |
| `api/v1/payment/...` | 4 | `api/v1/payment/transaction` |
| `api/v1/product_sales/...` | 4 | laporan penjualan produk |
| `api/v1/supplies/...` | 4 | `api/v1/supplies/setting/payment` |
| `api/v1/owner-apps/account` | 1 | (verified 200) |
| `api/v1/articles/...` | 3 | konten artikel/help |
| `api/v1/busiest_time_product/...` | 3 | analisa waktu teramai |
| `api/v1/coupon_sales/...` | 3 | laporan kupon |
| `api/v1/detail_sales/...` | 3 | detail penjualan |

### 5.2 `api/v0/blog/...` (40 paths)

Endpoint blog/CMS publik (artikel inspirasi, info Majoo).

### 5.3 `api/2_0_0/campaign/...` & `api/3_0_0/campaign/...`

Campaign marketing (kirim kampanye, template push notif, integrasi IG feed).

### 5.4 `api/jurnal/`, `api/akunting/`, `api/biaya/`, `api/laporan/`, `api/kasbank/`

Endpoint akuntansi gaya legacy (path Indonesia, tidak versioned).

### 5.5 `v1/...` (33 paths) & `v2/...` (32 paths)

Path tanpa prefix `api/`. Contoh sudah dilihat (`v1/categories`, `v1/employee`, `v2/employee`, `v2/setup`, `v2/stock-in`, dll.). Diakses via prefix Kong yang sesuai (kemungkinan `/inventory/` atau `/ms-transaction/api/`).

### 5.6 `0_0_X/...` (legacy versioning)

Versi internal Majoo: `0_0_1`, `0_0_3`, `0_0_5`, `0_0_9`, `0_0_10`, `0_0_11`, `0_0_12`, `0_0_14`. Setiap versi punya endpoint tersendiri:

| Path | Fungsi |
|---|---|
| `0_0_11/user/login` | Login |
| `0_0_9/user/register` | Register user baru |
| `0_0_9/user/register_sso` | Register via SSO (Google) |
| `0_0_2/user/sendCode` | Kirim verification code |
| `0_0_10/user/userJourney` | User onboarding journey |
| `0_0_10/user/change_number` | Ganti nomor HP |
| `0_0_10/user/send_verify_number` | Kirim OTP verifikasi nomor |
| `0_0_10/user/verify_number` | Verifikasi OTP |
| `0_0_12/user_profile` | CRUD profile user |
| `0_0_12/user_profile/send_otp` | Kirim OTP profile |
| `0_0_12/user_profile/validate_otp` | Validasi OTP profile |
| `0_0_12/user_profile/rekening` | Rekening bank user |
| `0_0_12/user_profile/changedpassword` | Ganti password |
| `0_0_12/wilayah/kota` | List kota Indonesia |
| `0_0_12/integration/orderonline` | Integrasi order online |
| `0_0_14/user/send_verification` | Kirim verifikasi (v14) |
| `0_0_14/user/verify_phone_number` | Verifikasi phone (v14) |
| `0_0_1/user/language` | Ganti bahasa preferensi |
| `0_0_3/cabang/by_integration` | List cabang by integration |
| `0_0_11/cabang/cabang_detail` | Detail cabang |
| `0_0_11/cabang/config_pdf_template` | Konfigurasi template PDF struk |
| `0_0_10/setting/notification` | Pengaturan notifikasi |
| `0_0_11/setting/metode_pembayaran` | Metode pembayaran |
| `0_0_10/cabang/cek_karyawan` | Cek karyawan di cabang |
| `0_0_12/cabang/stock-request` | Request stok antar cabang |
| `0_0_11/meja/list` | List meja |
| `0_0_11/meja/detail` | Detail meja |
| `0_0_11/meja/qrcode` | QR code meja |

### 5.7 `customer/`, `categorycustomer/`, `multiprice/`

CRM module:
- `customer/customer` — CRUD pelanggan
- `customer/transaction` — riwayat transaksi pelanggan
- `customer/createbulk` — bulk import pelanggan
- `customer/detail` — detail pelanggan
- `customer/form/export` — export form pelanggan
- `categorycustomer/categorycustomer` — kategori pelanggan
- `multiprice/groupcustomers` — grup harga spesial

### 5.8 `wilayah/...`

Master data lokasi Indonesia:
- `wilayah/negara`, `wilayah/provinsi`, `wilayah/kota`, `wilayah/kecamatan`, `wilayah/list_all_wilayah`

### 5.9 `product/v1/...`, `product/v2/...`

Module produk (bulk + recipe):
- `product/v1/bulk_product/upload_file` — bulk upload produk
- `product/v1/product/recipe/upload` — upload resep
- `product/v1/recipe/upload`
- `product/v2/bulk_product/upload_file`

### 5.10 `cogs/stock/...`, `inventory/...`

Cost of Goods Sold + Inventory:
- `v1/cogs/stock/calculation-status`
- `v1/cogs/stock/detail`, `v1/cogs/stock/latest-multiple`, `v1/cogs/stock/minimum`, `v1/cogs/stock/view`
- `v2/cogs/recalculate-status`
- `v1/inventories/exports/batch-number`, `v1/inventories/exports/serial-number`, `v1/inventories/exports/inventory-rotation`

### 5.11 Lain-lain (sample)

- **Stok:** `v2/stock-in`, `v2/stock-in/show`, `v2/stock-in/store`, `v2/stock-in/update`, `v2/stock-in/import/template/async`, `v2/stock-in/get-paid-invoice`, `v2/stock-in/list-paid-invoice`, `v2/stock_opname`, `v2/stock_opname/preview/create`, `v2/stock_wasted`
- **Bulk produk:** `v1/bulk_product`, `v1/bulk_product/upload_file`, `v1/bulk_product/check_running_process`, `v2/bulk_product`, `v2/bulk_product/upload_file`
- **Sales report:** `v1/category_sales`, `v1/category_sales_graph`, `v1/customer_sales`, `v1/department_sales`, `v1/detail_sales`, `v1/detail_sales/report`, `v1/detail_sales/total-page`, `v2/category_sales`, `v2/department_sales`, `v2/order_type/report`, `v2/outlet_sales/report`, `v2/payment_method`, `v2/payment_method/report`, `v2/per_cashier_sales/report`, `v2/promo_sales/detail/report`, `v2/reservation/report`, `v2/sales/daily/report`, `v2/summary_sales/report`, `v2/sub_variant_sales`
- **Purchase Order:** `v2/purchase-order`
- **Transfer stok:** `v2/transfer-stock/show`
- **Coupon:** `v1/coupon_sales`, `v1/coupon_sales/detail`, `v1/coupon_sales/graph`, `v2/coupon_sales/detail/report`, `v2/coupon_sales/report`
- **Compliment (gratisan):** `v1/compliment_sales`, `v2/compliment_sales/report`
- **Conversion rate:** `v1/conversion_rate_analysis`
- **Cash flow:** `v1/cash_flow`, `v1/dashboard_accounting/cash_flow`, `v1/dashboard_accounting/cash_balance`, `v1/dashboard_accounting/list_cash_balance`
- **Balance sheet:** `v1/balance_sheet`, `v1/dashboard_accounting/balance_sheet`
- **P&L:** `v1/dashboard_accounting/profit_loss`, `v1/dashboard_accounting/cost`
- **Coa widget:** `v1/dashboard_accounting/coa_widget/graph`
- **Department:** `v1/department`
- **Employee:** `v1/employee`, `v1/employee/access`, `v1/employee/dashboard`, `v1/employee/list`, `v1/employee/salary_component/import`
- **Notification:** `v1/notification`, `v1/acknowledge`, `v1/articles`, `v1/articles/feedback`, `v1/articles/history`
- **Banner:** `v1/banners`, `v1/banners/`
- **Job level / position:** `v1/joblevel`, `v1/position`
- **Loan:** `v1/loan/access`, `v1/loan/outlet`, `v1/loan/transaction`, `v1/loan/transaction/action`, `v1/loan/transaction/history`, `v1/loan/transaction/paid`
- **Owner apps:** `v1/owner-apps/account`, `api/v1/owner-apps/account`
- **Rate:** `v1/rates`
- **Room (hotel):** `v1/rooms`, `v1/room-types`
- **Tracking:** `v1/tracking`
- **Queue number:** `v1/transactions/queue-number/centralized`
- **Favorite menu:** `v1/user/favorite-menu`
- **Approval setting:** `v1/approval/setting`
- **Audit:** `v1/auditrail`
- **Bahan baku:** `v1/inventories/bahan-baku/...`
- **Batch number / serial:** `v1/batch-number`, `v1/batch_number`, `v1/batch_number/export`, `v1/batch_number_sales/product-detail`, `v1/batch_number_sales/product-list`
- **Busiest time:** `v1/busiest_time_product`, `v1/busiest_time_product/graph`, `v1/busiest_time_product/report/request`, `v1/busiest_time_sales`, `v2/busiest_time_sales/report`
- **Banner click tracking:** `api/v1/banners/{id}/click`
- **Snbn validation:** `v1/check-snbn-validation`
- **Categories (banner CMS):** `api/v1/categories` — note: ini bukan kategori produk POS, tapi kategori banner/article
- **Articles:** `api/v1/articles` (CMS artikel)
- **Video:** `api/v1/video`
- **Feedback (article):** `api/v1/articles/feedback`
- **Customer report:** `api/v1/customer/report`
- **Marketing payment:** `payment/marketing`
- **EDC submission:** `edc_submission/upload_berkas`
- **Consumer apps:** `dashboard/consumer-apps/published`, `dashboard/consumer-apps/banner/upload`, `dashboard/consumer-apps/assets-upload`
- **Deposit:** `deposit/deposit_active`
- **Exporter:** `exporter/printer`
- **Upload:** `upload/upload`, `upload/do_upload`

> Daftar lengkap di `docs/majoo_api_paths.txt` (533 path).

---

## 6. Frontend Routes (Menu Inventory)

Diekstrak dari `localStorage["persist:root"].layouts.menu` (akun TRIAL):
- **293 menu items** total (incl. heading dan separator)
- **205 items punya URL** (clickable route)
- **11 menu groups:** PENJUALAN, ORDER ONLINE, APPOINTMENT, KARYAWAN, KEUANGAN, PENGATURAN, Bantuan, LAYANAN, INSPIRASI, Capital, SUPPLIES

Lihat `docs/majoo_menu_flat.tsv` untuk inventory lengkap (path ▸ URL ▸ permissions).

**Top-level URL groups** untuk routing VIPOS:

| Group | URL prefix | Contoh sub-menu |
|---|---|---|
| Dashboard | `sales-dashboard` | (root dashboard) |
| Laporan | `laporan/...` | `laporan/penjualan/sales-summary`, `laporan/dapur/proses-order`, `laporan/akuntansi/jurnal-umum`, `laporan/analisa-laporan/sales-waktu-produk` |
| Produk | `item/...` | `item`, `item/category`, `item/department`, `item/service`, `item/addon`, `item/extra` |
| Inventori | `inventory/...` | `inventory/bahan-baku`, `inventory/pembelian-stok`, `inventory/kelola-stok`, `inventory/produksi-stok`, `inventory/mutasi-antar-outlet` |
| Pelanggan | `pelanggan/...` | `pelanggan/daftar-pelanggan`, `pelanggan/grup-pelanggan`, `pelanggan/special-price-group`, `pelanggan/kustom-data` |
| Promosi | `promo/...`, `kupon/...`, `loyalty/...` | (akan diperlengkap di-admin) |
| Komisi | `commission/group` | |
| Invoice | `penjualan/...` | `penjualan/sq-list`, `penjualan/so-list-v2`, `penjualan/do-list-v2`, `penjualan/invoice-v2`, `penjualan/sales-receipt-list-v2` |
| Marketing | `marketing/...` | `marketing/kampanye`, `marketing/transaction` |
| Order Online | `marketplace-order`, `toko-online/...`, `grabmart`, `shopee`, `grabfood`, `gofood`, `consumer-app` | |
| Appointment | `appointment`, `appointment-calendar` | |
| Karyawan | `karyawan/...`, `attendance/...`, `payroll/...`, `commission/...`, `joblevel/...`, `department/...` | |
| Keuangan | `keuangan/...`, `akuntansi/...`, `kas-bank`, `biaya/...`, `jurnal/...` | |
| Pengaturan | `pengaturan/...`, `setting/...`, `users-settings`, `outlet-settings`, `cabang/...` | |
| Capital | `capital/...` | (Majoo Capital - pinjaman) |
| Supplies | `supplies/...` | |

---

## 7. Permission Model

Setiap menu item punya 4 boolean flags:
```json
{
  "is_can_view": "1",
  "is_can_create": "1",
  "is_can_update": "1",
  "is_can_delete": "1"
}
```

Akun TRIAL test punya full permission (`view,create,update,delete`) di semua menu. Untuk role yang lebih restrictive (KASIR, WAITERS, dll.), permission ini di-flip ke `"0"`.

**Role enum** (dari `48561.js`):
```
ADMIN: "1"
MANAGER: "2"
KASIR: "3" (CASHIER)
STAFF: "4"
WAREHOUSE: "5"
WAITERS: "6"
KITCHEN: "7"
ORDER_DISPLAY: "8"
SELF_ORDER: "9"
GRAB: "10"
CUSTOM_PRIVILAGE: "4"
```

**Privilege actions** (dari `51963.js`):
```
DELETE: "delete"
EDIT: "edit"
CREATE: "create"
DETAIL: "detail"
PER_OUTLET_SETTING: "per_outlet_setting"
```

**Privilege scopes:**
```
FORM: "form"
PER_OUTLET_SETTING: "per_outlet_setting"
```

---

## 8. Response Format Conventions

Tiga style response yang ditemukan (tergantung service):

### 8.1 `status` envelope (user-management, ms-promo-v2)

```json
{
  "status": { "code": 200, "message": "success" },
  "data": { ... }
}
```

Error:
```json
{ "status": { "code": 401, "message": "invalid token" } }
```

### 8.2 `message` + `data` + `meta` (ms-promo-v2 list)

```json
{
  "message": "get success",
  "data": [...],
  "meta": { "current_page": 1, "per_page": 10, "total": 100, "last_page": 10 }
}
```

### 8.3 Raw error (Kong / Echo framework)

```json
{ "message": "Not Found" }                      // generic upstream
{ "message": "no Route matched with those values" }  // Kong-level (route not configured)
{ "code": 401, "message": "Unauthorized", "error": {} }  // some services
{ "error": "code=404, message=Not Found", "message": "Not Found" }  // Echo (Go)
{ "status":{"code":"404001","message":"Not Found","errors":null}, "message":"Not Found" }  // svc-* services
```

### 8.4 Custom headers (response)

```
X-Auth-Token: <token>           # Token refresh hint
X-Total-Page: <int>             # Pagination total pages
X-Total-Record: <int>           # Pagination total records
Content-Disposition: ...        # File download endpoints
x-security-key: ...             # Security/captcha
x-client-longitude: ...
x-client-latitude: ...
```

---

## 9. Rekomendasi Implementasi VIPOS

### 9.1 Backend Architecture

**Asli Majoo:** microservices Kong gateway dengan 25+ services. Untuk VIPOS yang lebih sederhana:

**Saran:** Modular monolith Express + SQLite (VIPOS sudah ini). Pisahkan jadi modules dengan namespace mirip Majoo:

```
backend/
  src/
    modules/
      auth/        // /api/auth/login, /api/auth/me
      products/    // /api/products (= Majoo "item" service)
      categories/  // /api/categories
      transactions/ // /api/transactions
      customers/   // /api/customers
      promo/       // /api/promo
      reports/     // /api/reports
      settings/    // /api/settings
```

### 9.2 Auth flow

- Pakai JWT HS256 (sama seperti Majoo) — VIPOS sudah implement `/api/auth/login` dan `/api/auth/me`.
- Header standar: `Authorization: Bearer <jwt>` (jangan custom header `Token:` — itu legacy Majoo).
- Token claims minimal: `{ id, username, role, outlet_id?, iat, exp }` (kalau VIPOS multi-outlet).

### 9.3 Response format

Pilih **satu** format dan konsisten. Saran (paling clean):

```json
{
  "data": [...],
  "meta": { "page": 1, "per_page": 20, "total": 100 },
  "error": null
}
```

Untuk error:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "VALIDATION_ERROR", "message": "outlet_id is required", "details": {...} }
}
```

### 9.4 Pagination

Semua list endpoint: `?page=N&per_page=N` + sertakan `meta.total` di response.

### 9.5 Outlet-scoping

Majoo selalu kirim `outlet_id` (atau `cabang_id`) di query param atau JWT claim. Untuk VIPOS:
- Single-tenant (1 toko) → cukup pakai userId di JWT, tidak perlu `outlet_id` param.
- Multi-tenant → tambahkan `outlet_id` di JWT claim, validate di middleware.

### 9.6 Form Field Naming (untuk match Majoo UX)

Berdasarkan `docs/majoo_html/` dan menu struktur, field yang umum di Majoo:

**Produk:**
- `nama_produk` (name)
- `kategori_id` (category FK)
- `departemen_id` (department FK)
- `harga_modal` (cost price)
- `harga_beli` (purchase price)
- `harga_jual` (sale price)
- `sku`, `barcode`
- `unit` (Buah, Pcs, Kg, dll.)
- `is_tampil_di_menu` (show in menu boolean)
- `is_pakai_pajak` (taxable boolean)
- `is_pakai_servis` (service charge boolean)
- `image_url`

**Kategori:**
- `nama_kategori` (name)
- `urutan` (sort order)
- `is_tampil_di_menu` (show in menu boolean)
- `parent_id` (untuk subcategory)

### 9.7 Standar tambahan dari Majoo yang patut diadopsi

- Confirmation dialog (modal) sebelum delete/save (sudah ada di `MAJOO_ANALYSIS.md` §11 task #4).
- Bulk import via Excel/CSV upload (Majoo: `bulk_product/upload_file`).
- Export ke Excel/PDF (`exporter/printer`).
- Audit trail (`auditrail`) — log perubahan data.
- I18n: support Indonesian + English (Majoo pakai `i18nextLng`).

---

## 10. Catatan Keamanan & Etika

- **Tidak ada penetration testing** dilakukan. Hanya pasif: download bundle JS publik dan request endpoint dengan JWT akun owner sendiri (akun TRIAL pribadi). Semua permintaan read-only (GET); tidak ada modifikasi data Majoo.
- **JWT akun uji** TIDAK ditaruh di repo. Disimpan lokal di `~/.majoo_token` (chmod 600) dan akan kadaluarsa otomatis dalam 24 jam.
- Kalau Majoo punya kebijakan API/scrape yang melarang reverse-engineering, dokumen ini hanya boleh dipakai sebagai referensi internal pribadi (untuk belajar arsitektur SaaS) — bukan dipakai untuk membuat produk yang berkompetisi langsung dengan layanan Majoo.

---

## 11. Resource & File Pendukung

- **`docs/majoo_html/`** — snapshot HTML beberapa halaman dashboard Majoo (sudah ada di repo)
- **`docs/majoo_api_paths.txt`** — daftar lengkap 533 path endpoint
- **`docs/majoo_menu_flat.tsv`** — inventory 293 menu items dengan URL & permission

---

## 12. Changelog

- **2026-05-03 v1.0** — Initial reverse-analysis: arsitektur, service registry, 533 endpoint paths, auth, frontend menu.
