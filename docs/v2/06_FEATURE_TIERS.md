# 06 · Feature × Tier Matrix

> **Source.** Majoo's official tier line-up (Sep 2023 onwards) is **Lite (free)**, **Starter Rp100k/outlet/mo**, **Advance Rp499k/outlet/mo**, **Prime Rp999k/outlet/mo**, **Prime+ (custom)**. This matrix is consolidated from `https://portal.mangkujagat.com/harga/detail` (a Majoo reseller showing the canonical Majoo feature comparison) and `https://majoolite.id/` (the Lite product page). Mark each row `[✓]` for "available", blank for "not available".
>
> **Why an Android dev cares.** Each feature flag becomes either a server-driven `feature_flag` or a client-side gate. The Android app must (a) fetch the active tier on login, (b) gate UI accordingly, (c) handle "tier upgrade" CTAs gracefully.

## Tier identifier convention

The bundle uses tier IDs around the constants `LITE`, `STARTER`, `ADVANCE`, `PRIME`, `PRIME_PLUS` (extracted to `assets/extracted/tier_patterns.txt`). The login response is expected to carry the active tier. Suggest a new `GET /api/me/subscription` endpoint with shape `[inferred]`:
```json
{
  "tier": "ADVANCE",
  "valid_from": "2026-01-01",
  "valid_until": "2027-01-01",
  "auto_renew": true,
  "outlet_count_paid": 3,
  "feature_overrides": {
    "kitchen_display": true,
    "local_server": false
  }
}
```

## Lite (majoolite) — Rp 0 / Rp 50k per month

Limited tier with **transaction count caps** (free up to 10 tx/day; or Rp 50k/day for unlimited; subscription pricing Rp 50k/mo; Rp 99k/3 mo; Rp 259k/6 mo; Rp 480k/yr).

Available: cashier basics, faktur digital, payment digital (QRIS dinamis, Pay Go, e-wallet), Toko Daring (Webstore), pengiriman kurir, laporan (pemasukan/pengeluaran/laba rugi/neraca/penjualan QRIS).

NOT available: payroll, stock opname multi-outlet, marketplace, KDS, multi-cabang, owner app, capital, ads.

## Starter — Rp 100k / outlet / month

Entry tier for unlimited tx volume with full feature breadth at a single outlet.

## Advance — Rp 499k / outlet / month (Rp 399k yearly)

Adds: payroll-lite, marketing campaign, marketplace integration, full reporting, customer loyalty.

## Prime — Rp 999k / outlet / month (Rp 799k yearly)

Adds: KDS, Order Display, Self Order, multi-cabang/warehouse, full inventory (batch/serial), automation, Local Server.

## Prime+ — custom pricing

Adds: warehouse display, custom table layout, customisable customer data, period-comparison reports.

## Full feature × tier matrix

> Cells marked `?` indicate the source matrix had ambiguous indicators (e.g. greyed out vs not-shown). When live access is available, re-validate.

### Kasir Online (PoS)

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Aplikasi Kasir (Desktop, Tablet, Smartphone, Dual Screen) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Aplikasi Waitress / Table Order | | | ✓ | ✓ | ✓ |
| 6 Jenis Navigasi Kasir (QS, Dine in Table, Retail, Jasa, Reservasi, Marketplace Omnichannel) | (basic) | ✓ | ✓ | ✓ | ✓ |
| Catat Order (Bungkus, Delivery, Table, Ojek Online) | (basic) | ✓ | ✓ | ✓ | ✓ |
| Penjualan Produk dengan Ekstra (multi qty) | | ✓ | ✓ | ✓ | ✓ |
| Reservasi Sederhana | | | ✓ | ✓ | ✓ |
| Simpan Order (hold/recall) | | ✓ | ✓ | ✓ | ✓ |
| Order Offline + Online | (offline only) | ✓ | ✓ | ✓ | ✓ |
| Pembayaran Tunai + Non-tunai | ✓ | ✓ | ✓ | ✓ | ✓ |
| Order dengan Denah Meja | | | ✓ | ✓ | ✓ |
| Split Bill (pisah produk + pisah nominal) | | | ✓ | ✓ | ✓ |
| Void + Refund | | ✓ | ✓ | ✓ | ✓ |
| Harga Nego | | ✓ | ✓ | ✓ | ✓ |
| Custom Amount (penjualan tanpa produk) | | ✓ | ✓ | ✓ | ✓ |
| Penjualan Ojek Online (komisi terhitung) | | | ✓ | ✓ | ✓ |
| Promo (basic + per produk + per penjualan) | (basic) | ✓ | ✓ | ✓ | ✓ |
| Loyalty (poin + penukaran) | | | ✓ | ✓ | ✓ |
| Komisi Penjualan | | | ✓ | ✓ | ✓ |
| Kas Kecil (pengeluaran outlet) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Service Charge / Pajak / Pembulatan | | ✓ | ✓ | ✓ | ✓ |
| Cetak Struk (kasir / checker / dapur / label / delivery) | (kasir only) | ✓ | ✓ | ✓ | ✓ |
| Integrasi Modul (produk/inventory/pelanggan/laporan) | (basic) | ✓ | ✓ | ✓ | ✓ |
| Cetak Label Sticker Alamat Pengiriman | | | ✓ | ✓ | ✓ |
| Operasional Kasir (buka/tutup, rekon) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pembayaran Komplimen | | | ✓ | ✓ | ✓ |
| Setting struk + biaya | | ✓ | ✓ | ✓ | ✓ |
| Refund rules (stok kembali, ongkir) | | ✓ | ✓ | ✓ | ✓ |
| Pajak per transaksi / per produk | | ✓ | ✓ | ✓ | ✓ |
| Manajemen Meja (gabung/pisah/pindah) | | | ✓ | ✓ | ✓ |
| Batas Waktu Duduk Meja | | | | ✓ | ✓ |
| Deposit Pelanggan | | | ✓ | ✓ | ✓ |
| Struk Digital (WA / SMS / Email) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Struk + Weblink | | | ✓ | ✓ | ✓ |
| Order Online (E-menu QR + Toko online) | (toko online basic) | ✓ | ✓ | ✓ | ✓ |
| Penjualan Harga Grosir | | | ✓ | ✓ | ✓ |
| Penjualan Produk Serial Number | | | | ✓ | ✓ |
| Penjualan Produk Batch + Expired | | | | ✓ | ✓ |
| Catat Jasa | | ✓ | ✓ | ✓ | ✓ |
| Tampilan Meja & Ruangan (Peta) `[COMING SOON]` | | | | (coming) | ✓ |
| Cetak / Download PDF Invoice A4 `[COMING SOON]` | | | | (coming) | ✓ |
| Pembayaran Invoice `[COMING SOON]` | | | | (coming) | ✓ |

### Toko Online

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Browser Responsif Mobile + Desktop | ✓ | ✓ | ✓ | ✓ | ✓ |
| Order Online Terintegrasi Multi-channel | | ✓ | ✓ | ✓ | ✓ |
| Pembayaran Online (banyak metode) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bayar Di Tempat (in-store) | | ✓ | ✓ | ✓ | ✓ |
| Multi Kurir | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pickup / Kurir Sendiri | | ✓ | ✓ | ✓ | ✓ |
| Promo terintegrasi CRM | | | ✓ | ✓ | ✓ |
| Cetak Label Sticker Alamat | | | ✓ | ✓ | ✓ |
| Sinkronisasi Stok Otomatis | | | ✓ | ✓ | ✓ |
| QR Static + Dynamic | | ✓ | ✓ | ✓ | ✓ |
| Pengaturan Tampilan Website | | ✓ | ✓ | ✓ | ✓ |
| Webtree (link bio) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Integrasi Akuntansi | | | ✓ | ✓ | ✓ |
| Toko Online + Domain Sendiri | | | | ✓ | ✓ |

### CRM

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Catat Data Pelanggan | ✓ | ✓ | ✓ | ✓ | ✓ |
| Harga Spesial Grup Pelanggan | | | ✓ | ✓ | ✓ |
| Poin Loyalti & Penukaran | | | ✓ | ✓ | ✓ |
| Promo per Penjualan (kombinasi hari/jam/qty/kelipatan) | | | ✓ | ✓ | ✓ |
| Promo per Produk (kombinasi hari/jam/qty/kelipatan) | | | ✓ | ✓ | ✓ |
| Diskon: %, nominal, gratis produk | | ✓ | ✓ | ✓ | ✓ |
| Laporan Aktivitas Pelanggan | | | ✓ | ✓ | ✓ |
| Laporan Promo & Loyalti | | | ✓ | ✓ | ✓ |
| Laporan Kepuasan Pelanggan | | | | ✓ | ✓ |
| Kupon | | | | ✓ | ✓ |
| Deposit Dana Pelanggan | | | ✓ | ✓ | ✓ |

### Marketing Campaign

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| SMS Broadcast (Long Number + Masking) | | | ✓ | ✓ | ✓ |
| WhatsApp Blast (masking majoo) | | | ✓ | ✓ | ✓ |
| SMS LBA Telkomsel | | | | ✓ | ✓ |
| Email Blast (masking majoo) | | | ✓ | ✓ | ✓ |
| Design Instagram Feed | | | | ✓ | ✓ |

### Integrasi (third-party)

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Promo Telkomsel Poin | | | ✓ | ✓ | ✓ |
| Pembayaran QRIS | ✓ | ✓ | ✓ | ✓ | ✓ |
| Modal Kerja s/d Rp 2 M (majoo Capital) | | | ✓ | ✓ | ✓ |
| EDC BCA | | | ✓ | ✓ | ✓ |
| EDC BRI | | | ✓ | ✓ | ✓ |

### Inventory

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Catat Stok + Harga Modal + Harga Jual | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stok Baru (in) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Atur Produk + Inventory | ✓ | ✓ | ✓ | ✓ | ✓ |
| SKU | ✓ | ✓ | ✓ | ✓ | ✓ |
| Resep | | | ✓ | ✓ | ✓ |
| Produk Favorit | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bahan Baku | | | ✓ | ✓ | ✓ |
| Harga Beda Online vs Offline | | | ✓ | ✓ | ✓ |
| Produksi Stok | | | ✓ | ✓ | ✓ |
| Stok Opname | | ✓ | ✓ | ✓ | ✓ |
| Notifikasi Stok Minimum | | ✓ | ✓ | ✓ | ✓ |
| Multi Satuan | | | ✓ | ✓ | ✓ |
| HPP COGS Average | | | ✓ | ✓ | ✓ |
| Stok Terbuang (waste) | | | ✓ | ✓ | ✓ |
| Pembelian (PO + Invoice) | | | ✓ | ✓ | ✓ |
| Data Supplier | | | ✓ | ✓ | ✓ |
| Mutasi Stok Antar Outlet | | | | ✓ | ✓ |
| Produk Jenis Layanan (jasa) | | ✓ | ✓ | ✓ | ✓ |
| Serial Number | | | | ✓ | ✓ |
| Batch Number + Expired | | | | ✓ | ✓ |
| Varian | ✓ | ✓ | ✓ | ✓ | ✓ |
| Harga Grosir | | | ✓ | ✓ | ✓ |

### Manajemen Karyawan

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Absensi Digital | ✓ | ✓ | ✓ | ✓ | ✓ |
| Shift Kasir | | ✓ | ✓ | ✓ | ✓ |
| Komisi Karyawan Otomatis | | | ✓ | ✓ | ✓ |
| Laporan Karyawan (Absensi/Shift/Komisi) | | | ✓ | ✓ | ✓ |
| Laporan Absensi | | ✓ | ✓ | ✓ | ✓ |
| Otorisasi & Akses Karyawan | | ✓ | ✓ | ✓ | ✓ |
| Absensi Geolocation | | | ✓ | ✓ | ✓ |
| Integrasi majooteams (employee app) | | | ✓ | ✓ | ✓ |
| Jadwal Kerja Karyawan | | | | ✓ | ✓ |
| Data Karyawan Lengkap | | | ✓ | ✓ | ✓ |
| Struktur Gaji Karyawan | | | | ✓ | ✓ |
| Pembayaran Gaji (auto by absen + komisi) | | | | ✓ | ✓ |
| Auto Bayar Gaji (bank partner) | | | | | ✓ |
| Manual Bayar Gaji | | | | ✓ | ✓ |
| Gaji terintegrasi Akuntansi | | | | ✓ | ✓ |
| Slip Gaji ke Karyawan | | | | ✓ | ✓ |
| Laporan Pembayaran Gaji | | | | ✓ | ✓ |
| Pengumuman ke Karyawan via majooteams | | | ✓ | ✓ | ✓ |

### Laporan Lengkap

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Laporan Penjualan | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ringkasan Penjualan | ✓ | ✓ | ✓ | ✓ | ✓ |
| Detil Penjualan | | ✓ | ✓ | ✓ | ✓ |
| Penjualan Outlet | | | ✓ | ✓ | ✓ |
| Penjualan Harian | ✓ | ✓ | ✓ | ✓ | ✓ |
| Penjualan Kategori | | ✓ | ✓ | ✓ | ✓ |
| Penjualan Departemen | | | ✓ | ✓ | ✓ |
| Penjualan Produk | | ✓ | ✓ | ✓ | ✓ |
| Penjualan Varian | | | ✓ | ✓ | ✓ |
| Penjualan Sub Varian | | | | ✓ | ✓ |
| Penjualan Per Kasir | | ✓ | ✓ | ✓ | ✓ |
| Penjualan Per Terminal | | | ✓ | ✓ | ✓ |
| Laporan Kas Kasir | ✓ | ✓ | ✓ | ✓ | ✓ |
| Laporan Jenis Bayar | | ✓ | ✓ | ✓ | ✓ |
| Laporan Jenis Order | | | ✓ | ✓ | ✓ |
| Laporan Jasa | | | ✓ | ✓ | ✓ |
| Laporan Reservasi | | | ✓ | ✓ | ✓ |
| Laporan Void | | ✓ | ✓ | ✓ | ✓ |
| Laporan Refund | | ✓ | ✓ | ✓ | ✓ |
| Laporan Promo | | | ✓ | ✓ | ✓ |
| Laporan Poin | | | ✓ | ✓ | ✓ |
| Laporan Kupon | | | | ✓ | ✓ |
| Laporan Komplimen | | | ✓ | ✓ | ✓ |
| Laporan Pajak | | ✓ | ✓ | ✓ | ✓ |
| Laporan Pelanggan | | | ✓ | ✓ | ✓ |
| Laporan Tutup Kasir | ✓ | ✓ | ✓ | ✓ | ✓ |
| Download Laporan | | ✓ | ✓ | ✓ | ✓ |
| Analisa Bisnis | | | ✓ | ✓ | ✓ |
| Waktu Teramai Penjualan | | | ✓ | ✓ | ✓ |
| Waktu Teramai Produk | | | ✓ | ✓ | ✓ |
| Perputaran Stok | | | ✓ | ✓ | ✓ |
| Kepuasan Pelanggan | | | | ✓ | ✓ |
| Laporan Harian via Email | | | ✓ | ✓ | ✓ |
| Reservasi & Utilisasi | | | | ✓ | ✓ |

### Akuntansi

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Faktur Penjualan (PO/PSO/Faktur/Penerimaan) | | | ✓ | ✓ | ✓ |
| Biaya & Pengeluaran | ✓ | ✓ | ✓ | ✓ | ✓ |
| Saldo & Kas Bank | ✓ | ✓ | ✓ | ✓ | ✓ |
| Daftar Akun + Buku Besar | | | ✓ | ✓ | ✓ |
| Jurnal Otomatis | | | ✓ | ✓ | ✓ |
| Laporan Keuangan (Neraca, Rugi Laba, Arus Kas, Buku Besar, Jurnal, Hutang, Piutang) | (basic) | ✓ | ✓ | ✓ | ✓ |

### Aplikasi Owner (separate Android app)

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Owner App | | ✓ | ✓ | ✓ | ✓ |
| Lihat Penjualan Semua Outlet | | ✓ | ✓ | ✓ | ✓ |
| Lihat Kas Kasir | | ✓ | ✓ | ✓ | ✓ |
| Ringkasan Penjualan | | ✓ | ✓ | ✓ | ✓ |
| Top 10 | | ✓ | ✓ | ✓ | ✓ |
| Laporan Karyawan | | | ✓ | ✓ | ✓ |
| Terhubung majoocare (CS) | | ✓ | ✓ | ✓ | ✓ |
| Notifikasi | | ✓ | ✓ | ✓ | ✓ |
| Tarik Saldo Toko Online | | | ✓ | ✓ | ✓ |
| Lihat Promo Aktif | | | ✓ | ✓ | ✓ |

### Aplikasi Karyawan (majooteams — separate Android app)

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Absensi Foto Wajah + Geolokasi | | | ✓ | ✓ | ✓ |
| Lihat Data Karyawan | | | ✓ | ✓ | ✓ |
| Ajukan Cuti `[COMING SOON]` | | | (coming) | (coming) | (coming) |
| Lihat Komisi `[COMING SOON]` | | | (coming) | (coming) | (coming) |
| Ajukan Kasbon `[COMING SOON]` | | | (coming) | (coming) | (coming) |
| Terhubung Rekening Bank | | | | ✓ | ✓ |
| Saldo + Mutasi Bank | | | | ✓ | ✓ |
| Slip Gaji | | | | ✓ | ✓ |
| Jadwal Karyawan | | | | ✓ | ✓ |
| Pengumuman dari Outlet | | | ✓ | ✓ | ✓ |

### Inspirasi Bisnis (content)

All tiers including Lite get articles, video, webinar, magazine.

### Layanan (support)

All tiers get Call/WhatsApp/Chat 24 jam. Higher tiers may get faster SLA `[unknown]`.

### Automasi (peripheral apps — separate Android binaries)

| Feature | Lite | Starter | Advance | Prime | Prime+ |
|---|:-:|:-:|:-:|:-:|:-:|
| Kitchen Display | | | | ✓ | ✓ |
| Order Display | | | | ✓ | ✓ |
| Self Order | | | | ✓ | ✓ |
| **Local Server** (offline LAN sync, multi-device) | | | | ✓ | ✓ |

### Automasi Premium (Prime+ only)

- Kustomisasi Table Sesuai Layout Bisnis
- Membership dengan Skema Pembelian dan Privilege Tertentu `[COMING SOON]`
- Membandingkan Laporan Antar Periode dan Outlet
- Warehouse Display
- Cetak Barcode
- Kustomisasi Data Pelanggan Sesuai Kebutuhan Bisnis

## How VIPOS should map this

VIPOS does not need to mimic Majoo's tiers verbatim. However, when designing the Android-app feature flags, group them by the same axis:

- **Always-on (Lite floor)** — POS basics, struk, QRIS, pemasukan/pengeluaran, laba-rugi simplified.
- **Single-outlet pro (Starter)** — full POS, void/refund, struk channels, opname, jasa.
- **Multi-feature business (Advance)** — promo, loyalty, marketing campaign, EDC, marketplace, payroll-lite, geolocation absen.
- **Multi-outlet (Prime)** — KDS, Order Display, Self Order, Local Server, mutasi, batch/serial, full payroll, kupon, table mgmt.
- **Enterprise (Prime+)** — custom layouts, warehouse display, cross-period reports, custom customer fields.

For VIPOS standalone, **the recommended Android v1 scope ≈ Starter** (single-outlet, no marketplace, no loyalty, basic POS + opname + jasa + reports).

## Subscription expiry handling on Android

When `valid_until < today`:
1. App enters **read-only mode** — block writes (no new orders, no settings changes).
2. Show a sticky banner "Langganan kedaluwarsa" with CTA "Perpanjang Sekarang".
3. Allow viewing existing orders + reports (read-only).
4. Block hardware printing (avoid expensive paper consumption).
5. Sync queue still drains (so server is consistent).
6. After 30-day grace period, force user to re-subscribe to access app.

## Trial handling

Majoo offers 14-day free trial (verified at majoo.id). On Android:
1. Show trial countdown banner from day 7 onwards.
2. At day 0, automatically transition to read-only mode (per above).
3. Send a single FCM nudge on day 13 ("Trial Anda akan berakhir besok…").
