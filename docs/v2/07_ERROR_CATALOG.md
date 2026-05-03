# 07 · Error Catalog

> Inventory of error codes + Indonesian messages + UX guidance. Live API observation is needed to confirm exact codes; the entries below are cross-referenced from i18n strings (`assets/extracted/i18n_labels.txt`) and HTTP convention.

## §1 HTTP status mapping

| HTTP | Meaning | UX action |
|---|---|---|
| 200 / 201 | Success | Continue. |
| 204 | No content | Treat as success for delete ops. |
| 400 | Validation / bad request | Show field-level error; do NOT retry. |
| 401 | Unauthenticated | Trigger re-auth (see `04_AUTH_AND_SESSION.md` §3). |
| 403 | Forbidden / no permission / version blocked | Show "Tidak memiliki akses" or force-update modal. |
| 404 | Not found | Show "Data tidak ditemukan". For list endpoints, treat as empty. |
| 409 | Conflict (e.g. SKU duplicate, opname already finalized) | Show specific guidance per code. |
| 422 | Business-rule violation | Show body's `message_id`. |
| 429 | Rate limited | Backoff with jitter. Show "Silakan coba lagi sebentar." |
| 500 / 502 / 503 / 504 | Server / gateway | Toast "Server sedang sibuk" + retry button. Queue the write op offline if applicable. |

## §2 Error response body shape

### Modern services
```json
{
  "status": {
    "code": "400",
    "message_id": "Stok tidak cukup",
    "message_en": "Insufficient stock"
  },
  "errors": {
    "qty": "Stok tidak cukup. Tersedia: 5"
  }
}
```

### Legacy mayang
```json
{
  "message": "Token tidak valid",
  "code": "INVALID_TOKEN"
}
```

## §3 Application error codes (suggested + observed)

> Some codes are observed in i18n strings; others are reasonable inferences. Mark `[verified]`, `[inferred]`, `[unknown]` per row.

| Code | HTTP | message_id | UX action | Marker |
|---|:-:|---|---|:-:|
| `INVALID_CREDENTIALS` | 401 | "Username atau password salah" | Re-prompt password | `[verified]` |
| `ACCOUNT_LOCKED` | 401 | "Akun terkunci. Hubungi support." | Show contact info | `[inferred]` |
| `TOKEN_EXPIRED` | 401 | "Sesi habis. Silakan login kembali." | Re-auth flow | `[verified]` |
| `INVALID_TOKEN` | 401 | "Token tidak valid" | Force logout | `[verified]` |
| `FORBIDDEN_VERSION` | 403 | "Versi aplikasi terlalu lama. Mohon update." | Force-update modal | `[inferred]` |
| `NO_PERMISSION` | 403 | "Anda tidak memiliki akses ke fitur ini." | Toast + back | `[inferred]` |
| `OUTLET_NOT_FOUND` | 404 | "Outlet tidak ditemukan" | Re-fetch outlet list | `[inferred]` |
| `PRODUCT_NOT_FOUND` | 404 | "Produk tidak ditemukan" | Refresh catalogue | `[inferred]` |
| `TRANSACTION_NOT_FOUND` | 404 | "Transaksi tidak ditemukan" | Back | `[inferred]` |
| `DUPLICATE_SKU` | 409 | "SKU sudah digunakan oleh produk lain" | Highlight SKU field | `[inferred]` |
| `DUPLICATE_BARCODE` | 409 | "Barcode sudah digunakan" | Highlight barcode | `[inferred]` |
| `DUPLICATE_PHONE` | 409 | "Nomor telepon sudah terdaftar" | Show "Lihat pelanggan ini" | `[inferred]` |
| `OPNAME_FINALIZED` | 409 | "Stok opname sudah final, tidak bisa diubah." | Disable form | `[inferred]` |
| `SHIFT_ALREADY_OPEN` | 409 | "Kasir sudah dibuka. Tutup dulu sebelum buka baru." | Redirect to active shift | `[inferred]` |
| `SHIFT_NOT_OPEN` | 409 | "Belum ada kasir terbuka. Buka kasir dulu." | Open Buka Kasir | `[inferred]` |
| `SHIFT_HAS_OPEN_ORDERS` | 409 | "Masih ada pesanan terbuka. Selesaikan dulu sebelum tutup kasir." | List open orders | `[inferred]` |
| `INSUFFICIENT_STOCK` | 422 | "Stok tidak cukup. Tersedia: {n}" | Show available qty inline | `[inferred]` |
| `PRICE_BELOW_HPP` | 422 | "Harga jual di bawah HPP" | Confirm dialog | `[inferred]` |
| `MAX_DISCOUNT_EXCEEDED` | 422 | "Diskon melebihi batas yang diizinkan ({n} %)." | Manager PIN | `[inferred]` |
| `MIN_PURCHASE_NOT_MET` | 422 | "Pembelian minimum belum tercapai untuk promo ini." | Show min | `[inferred]` |
| `PROMO_INACTIVE` | 422 | "Promo tidak berlaku saat ini." | Hide promo | `[inferred]` |
| `PROMO_USAGE_EXCEEDED` | 422 | "Kuota promo sudah habis." | Hide promo | `[inferred]` |
| `COUPON_INVALID` | 422 | "Kode kupon tidak valid." | Re-input | `[inferred]` |
| `COUPON_EXPIRED` | 422 | "Kupon sudah kedaluwarsa." | | `[inferred]` |
| `COUPON_USED` | 422 | "Kupon sudah digunakan." | | `[inferred]` |
| `LOYALTY_INSUFFICIENT_POINTS` | 422 | "Poin tidak cukup untuk penukaran." | | `[inferred]` |
| `DEPOSIT_INSUFFICIENT` | 422 | "Saldo deposit tidak cukup." | | `[inferred]` |
| `PAYMENT_AMOUNT_MISMATCH` | 422 | "Total pembayaran tidak sesuai." | Verify totals | `[inferred]` |
| `PAYMENT_GATEWAY_ERROR` | 502 | "Pembayaran gagal. Coba lagi." | Retry button | `[inferred]` |
| `PAYMENT_GATEWAY_TIMEOUT` | 504 | "Pembayaran tidak terkonfirmasi. Cek di laporan." | Reconcile manually | `[inferred]` |
| `EDC_DECLINED` | 402 | "Transaksi kartu ditolak." | Try another method | `[inferred]` |
| `QRIS_EXPIRED` | 422 | "QRIS kedaluwarsa. Buat ulang." | Regenerate | `[inferred]` |
| `OUT_OF_RANGE_GEOLOCATION` | 422 | "Anda berada di luar area outlet." | Move closer | `[inferred]` |
| `ATTENDANCE_TOO_EARLY` | 422 | "Belum waktunya absen masuk." | | `[inferred]` |
| `ATTENDANCE_ALREADY_CHECKED_IN` | 409 | "Anda sudah absen masuk hari ini." | | `[inferred]` |
| `SUBSCRIPTION_EXPIRED` | 402 | "Langganan Anda telah berakhir." | Force read-only | `[inferred]` |
| `OUTLET_LIMIT_REACHED` | 402 | "Jumlah outlet melebihi paket Anda." | Upgrade CTA | `[inferred]` |
| `FEATURE_NOT_IN_TIER` | 402 | "Fitur ini tidak tersedia di paket Anda." | Upgrade CTA | `[inferred]` |
| `IDEMPOTENCY_REPLAY` | 200 | (silently return cached response) | None — replay safe | `[inferred]` |
| `RATE_LIMIT` | 429 | "Terlalu banyak permintaan. Coba lagi sebentar." | Backoff | `[inferred]` |
| `MARKETPLACE_SYNC_FAIL` | 502 | "Sinkronisasi {marketplace} gagal." | Retry | `[inferred]` |
| `WHATSAPP_TEMPLATE_REJECTED` | 422 | "Template WhatsApp ditolak." | Use other channel | `[inferred]` |
| `IMAGE_TOO_LARGE` | 413 | "Ukuran gambar terlalu besar (maks 2 MB)." | Compress | `[inferred]` |
| `INVALID_FILE_TYPE` | 415 | "Tipe file tidak didukung." | | `[inferred]` |
| `INVALID_DATE_RANGE` | 400 | "Tanggal tidak valid." | | `[inferred]` |
| `MAX_DATE_RANGE_EXCEEDED` | 400 | "Rentang tanggal maksimum 90 hari." | Truncate range | `[inferred]` |
| `STOCK_NEGATIVE_NOT_ALLOWED` | 422 | "Stok tidak boleh negatif." | Adjust | `[inferred]` |
| `RECIPE_INGREDIENT_MISSING` | 422 | "Bahan baku tidak tersedia." | Open ingredients | `[inferred]` |
| `MUTATION_OUT_OF_STOCK` | 422 | "Stok asal tidak cukup untuk mutasi." | Adjust qty | `[inferred]` |
| `OPNAME_VARIANCE_TOO_HIGH` | 422 | "Selisih opname terlalu besar. Minta approval manager." | Manager PIN | `[inferred]` |
| `KITCHEN_PRINTER_OFFLINE` | n/a (client-side) | "Printer dapur tidak terhubung." | Retry button | `[inferred]` |
| `THERMAL_PRINTER_OUT_OF_PAPER` | n/a | "Kertas struk habis." | Replace paper modal | `[inferred]` |
| `BLUETOOTH_NOT_PAIRED` | n/a | "Printer belum dipasangkan via Bluetooth." | Open BT settings | `[inferred]` |
| `BARCODE_NOT_FOUND` | n/a | "Barcode tidak ditemukan di katalog." | Add new product | `[inferred]` |

## §4 UX patterns

### Inline field error
- Used for `400` validation errors with `errors: { field_name: "..." }`.
- Show below the field, red text, no toast.

### Toast (snackbar)
- Used for transient errors (`429`, `500`, network).
- Lasts 4 s, action button "Coba lagi" if retryable.

### Full-screen modal
- Used for `403 FORBIDDEN_VERSION`, `402 SUBSCRIPTION_EXPIRED`.
- Blocks navigation; only "Update sekarang" / "Perpanjang langganan" CTAs.

### Confirm dialog
- Used for soft business rules (`PRICE_BELOW_HPP`, `MAX_DISCOUNT_EXCEEDED`).
- "Lanjutkan" requires manager PIN.

### Hard-block view
- Used for `NO_PERMISSION` when navigating to a disallowed menu via deep link.
- Show empty state + "Anda tidak memiliki akses" + "Kembali".

## §5 Logging & telemetry

Send a Sentry / Crashlytics breadcrumb on every non-2xx response with:
- HTTP status
- Application code
- Endpoint path (no query string)
- Latency
- `X-Terminal-Id`
- `X-App-Version`

NEVER log:
- Auth token
- Password
- Card PAN
- Customer phone (PII; or hash it first)
- Full payload of request body

## §6 Network errors (no HTTP response)

| Failure | UX |
|---|---|
| DNS resolution fail | "Tidak bisa terhubung. Cek koneksi internet." |
| Connection timeout | "Server tidak merespons. Coba lagi." |
| SSL handshake fail | "Koneksi tidak aman. Hubungi support." |
| Read timeout (after request sent) | If write op → enqueue offline; if read op → "Server tidak merespons." |
| Host unreachable | If LAN local-server feature: switch to local server URL automatically. |

## §7 Offline mode error semantics

When the app is in offline mode (`09_OFFLINE_AND_SYNC.md`):
- Read errors → fall back to Room cache; if cache is also empty, show "Data belum tersedia offline."
- Write ops → queue and show optimistic UI ("Disimpan, akan disinkronisasi…").
- On reconnect, if a queued op fails permanently (validation), surface a "Sinkronisasi gagal" badge; let user inspect and re-edit.
