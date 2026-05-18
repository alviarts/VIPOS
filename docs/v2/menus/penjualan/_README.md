# PENJUALAN — Menu Group

> 133 menu items. The single largest functional group. Covers POS, reports, product master, inventory, customers, promos, commissions, invoices, marketing.

## Inventory (all leaf menus)

### Top-level
- `PENJUALAN / Menu Favorit` — favourite tiles (user-customizable shortcut to inner menus). Mobile: dashboard tiles.
- `PENJUALAN / Dashboard` (`sales-dashboard`) — top-level KPIs. See `pos_dashboard.md`.

### Reports → see `16_REPORTS_CATALOG.md` for column/filter/export specs

| Menu | URL | File |
|---|---|---|
| Laporan / Laporan Penjualan / Ringkasan Penjualan | `laporan/penjualan/sales-summary` | §2 |
| Laporan / Laporan Penjualan / Detail Penjualan | `laporan/penjualan/transaksi-v2` | §3 |
| Laporan / Laporan Penjualan / Penjualan Per Periode | `laporan/penjualan/sales-harian` | §5 |
| Laporan / Laporan Penjualan / Penjualan Outlet | `laporan/penjualan/sales-outlet` | §4 |
| Laporan / Laporan Penjualan / Laporan Jenis Bayar | `laporan/penjualan/sales-jenis-pembayaran` | §13 |
| Laporan / Laporan Penjualan / Laporan Jenis Order | `laporan/penjualan/sales-jenis-order` | §14 |
| Laporan / Laporan Penjualan / Laporan Void | `laporan/penjualan/void` | §17 |
| Laporan / Laporan Penjualan / Laporan Refund | `laporan/penjualan/sales-refund` | §18 |
| Laporan / Laporan Dapur / Proses Order | `laporan/dapur/proses-order` | new — see `kitchen_reports.md` |
| Laporan / Laporan Dapur / Proses Produk | `laporan/dapur/proses-produk` | new |
| Laporan / Laporan Produk / Penjualan Produk | `laporan/penjualan/sales-item` | §8 |
| Laporan / Laporan Produk / Penjualan Departemen | `laporan/penjualan/sales-department` | §7 |
| Laporan / Laporan Produk / Penjualan Kategori | `laporan/penjualan/sales-kategori` | §6 |
| Laporan / Laporan Produk / Penjualan Ekstra | `laporan/penjualan/sales-varian` | §9 |
| Laporan / Laporan Produk / Penjualan Sub Ekstra | `laporan/penjualan/sales-sub-varian` | §9 |
| Laporan / Laporan Jasa / Laporan Jasa | `laporan/penjualan/jasa` | §15 |
| Laporan / Laporan Jasa / Laporan Reservasi | `laporan/penjualan/reservasi` | §16 |
| Laporan / Laporan Jasa / Reservasi & Utilisasi | `laporan/penjualan/reservasi-new` | §16 |
| Laporan / Laporan Promo & Loyalti / Laporan Promo | `laporan/penjualan/sales-promo` | §19 |
| Laporan / Laporan Promo & Loyalti / Laporan Poin | `laporan/penjualan/sales-poin` | §20 |
| Laporan / Laporan Promo & Loyalti / Laporan Kupon | `laporan/penjualan/sales-voucher` | §21 |
| Laporan / Laporan Promo & Loyalti / Laporan Komplimen | `laporan/penjualan/sales-compliment` | §22 |
| Laporan / Laporan Pajak / Laporan Pajak | `laporan/penjualan/sales-pajak` | §23 |
| Laporan / Laporan Pajak / Laporan Service Charge | `laporan/penjualan/service-charge` | §23 |
| Laporan / Laporan Kasir / Laporan Kas Kasir | `laporan/penjualan/kas-kecil` | §12 |
| Laporan / Laporan Kasir / Penjualan Per Kasir | `laporan/penjualan/sales-per-kasir` | §10 |
| Laporan / Laporan Kasir / Penjualan Per Terminal | `laporan/penjualan/per-terminal` | §11 |
| Laporan / Laporan Kasir / Laporan Tutup Kasir | `laporan/penjualan/tutup-kasir` | §26 |
| Laporan / Laporan Kasir / Laporan Tutup Toko | `laporan/penjualan/tutup-toko` | new — see `tutup_toko.md` |
| Laporan / Laporan Deposit / Penjualan Deposit | `laporan/penjualan/deposit` | new |
| Laporan / Laporan Deposit / Deposit Kadaluarsa | `laporan/penjualan/deposit-kedaluwarsa` | new |
| Laporan / Laporan Deposit / Sisa Deposit | `laporan/penjualan/sisa-deposit` | new |
| Laporan / Laporan Pelanggan | `laporan/penjualan/sales-customer` | §24 |
| Laporan / Laporan Karyawan / Komisi Bertingkat | `laporan/penjualan/sales-komisi-bertingkat` | new |
| Laporan / Laporan Karyawan / Absensi | `laporan/penjualan/absensi` | §29 |
| Laporan / Laporan Karyawan / Komisi Tetap | `laporan/penjualan/sales-komisi-tetap` | new |
| Laporan / Laporan Persediaan / Ringkasan Persediaan | `laporan/persediaan/ringkasan` | §27 (new) |
| Laporan / Laporan Persediaan / Detail Persediaan | `laporan/persediaan/detail` | §27 |
| Laporan / Laporan Persediaan / Stok Kedaluwarsa | `laporan/persediaan/kedaluwarsa` | §27 |
| Laporan / Laporan Persediaan / Serial Number | `laporan/persediaan/serial-number` | §27 |
| Laporan / Laporan Persediaan / Batch Number | `laporan/persediaan/batch-number` | §27 |
| Laporan / Laporan Settlement / QRIS | `laporan/settlement/qris` | new — see `settlement.md` |
| Laporan / Laporan Settlement / Order Online | `laporan/settlement/order-online` | new |

### Analisa Laporan (Business Intelligence) `[Advance+]`

| Menu | URL | Note |
|---|---|---|
| Waktu Teramai Produk | `analisa/waktu-teramai-produk` | Heatmap per hour-of-day |
| Waktu Teramai Penjualan | `analisa/waktu-teramai-penjualan` | Heatmap aggregate |
| Perputaran Stok | `analisa/perputaran-stok` | Inventory turnover |
| Kepuasan Pelanggan | `analisa/kepuasan-pelanggan` | NPS / feedback |

### Produk

| Menu | URL | File |
|---|---|---|
| Produk / Daftar Departemen | `produk/department` | see `produk_master.md` §1 |
| Produk / Daftar Kategori | `produk/kategori` | §2 |
| Produk / Daftar Produk | `produk/produk` | §3 (most complex) |
| Produk / Produk Layanan | `produk/produk-layanan` | §4 |
| Produk / Produk Ekstra | `produk/ekstra` | §5 |
| Produk / Produk Paket | `produk/paket` | §6 |
| Produk / Deposit | `produk/deposit` | §7 (deposit-as-product) |
| Produk / Penjadwalan Perubahan Resep | `produk/jadwal-resep` | §8 |
| Produk / Daftar Harga Ojek Online | `produk/harga-ojol` | §9 |
| Produk / Penjadwalan Harga | `produk/jadwal-harga` | §10 |
| Produk / Harga Berdasarkan Waktu | `produk/harga-waktu` | §11 |
| Produk / Cetak Barcode | `produk/cetak-barcode` | §12 |
| Produk / Daftar Kategori Catatan | `produk/kategori-catatan` | §13 |
| Produk / Master Resep | `produk/master-resep` | §14 |

### Inventori

| Menu | URL | File |
|---|---|---|
| Inventori / Daftar Bahan Baku | `inventori/bahan-baku` | see `inventori_flows.md` §A |
| Inventori / Pembelian Stok / Permintaan Barang | `inventori/permintaan-barang` | §B |
| Inventori / Pembelian Stok / Pemesanan Stok (PO) | `inventori/po` | §C |
| Inventori / Pembelian Stok / Pengiriman Pembelian (GR) | `inventori/gr` | §D |
| Inventori / Pembelian Stok / Faktur Pembelian | `inventori/faktur-pembelian` | §E |
| Inventori / Pembelian Stok / Pembayaran Faktur | `inventori/bayar-faktur` | §F |
| Inventori / Pembelian Stok / Retur Pembelian | `inventori/retur` | §G |
| Inventori / Pembelian Stok / Rekonsiliasi Retur | `inventori/rekon-retur` | §H |
| Inventori / Kelola Stok / Daftar Stok | `inventori/stok` | §I |
| Inventori / Kelola Stok / Stok Opname | `inventori/opname` | §J |
| Inventori / Kelola Stok / Stok Terbuang | `inventori/waste` | §K |
| Inventori / Produksi Stok / Daftar Produksi Stok | `inventori/produksi` | §L |
| Inventori / Produksi Stok / Acuan Produksi Stok | `inventori/produksi-acuan` | §M |
| Inventori / Mutasi / Permintaan Stok | `mutasi/permintaan` | §N |
| Inventori / Mutasi / Stok Harus Dikirim | `mutasi/dikirim` | §O |
| Inventori / Mutasi / Kirim Stok | `mutasi/kirim` | §P |
| Inventori / Mutasi / Terima Mutasi | `mutasi/terima` | §Q |
| Inventori / Mutasi / Stok Transit | `mutasi/transit` | §R |
| Inventori / Daftar Pemasok | `inventori/pemasok` | §S |

### Pelanggan

| Menu | URL | File |
|---|---|---|
| Pelanggan / Daftar Pelanggan | `pelanggan/daftar` | see `pelanggan.md` §1 |
| Pelanggan / Grup Pelanggan | `pelanggan/grup` | §2 |
| Pelanggan / Grup Harga Spesial | `pelanggan/harga-spesial` | §3 |
| Pelanggan / Kustom Data Pelanggan | `pelanggan/kustom-data` | §4 (Prime+) |
| Pelanggan / Pengaturan Data Pelanggan | `pelanggan/pengaturan` | §5 |

### Promosi

| Menu | URL | File |
|---|---|---|
| Promosi / Promo / Basic Promo | `promo/basic` | see `promo_kupon.md` §1 |
| Promosi / Promo / Per Total Pembelian | `promo/per-total` | §2 |
| Promosi / Promo / Per Produk | `promo/per-produk` | §3 |
| Promosi / Kupon / Tambah Kupon | `kupon/tambah` | §4 |
| Promosi / Kupon / Daftar Kupon | `kupon/daftar` | §5 |
| Promosi / Poin Reward / Per Total Pembelian | `poin/per-total` | §6 |
| Promosi / Poin Reward / Per Produk | `poin/per-produk` | §7 |
| Promosi / Poin Reward / Pengaturan Penukaran | `poin/penukaran` | §8 |

### Komisi

| Menu | URL | File |
|---|---|---|
| Komisi / Daftar Grup Komisi | `komisi/grup` | see `komisi.md` |

### Invoice (Penawaran/Pesanan/Pengiriman/Faktur/Penerimaan)

| Menu | URL | File |
|---|---|---|
| Invoice / Daftar Penawaran Penjualan | `invoice/penawaran` | see `invoice_b2b.md` §1 |
| Invoice / Daftar Pesanan Penjualan | `invoice/pesanan` | §2 |
| Invoice / Daftar Pengiriman Penjualan | `invoice/pengiriman` | §3 |
| Invoice / Daftar Invoice | `invoice/daftar` | §4 |
| Invoice / Daftar Penerimaan Penjualan | `invoice/penerimaan` | §5 |

### Marketing

| Menu | URL | File |
|---|---|---|
| Marketing / Kirim Kampanye Marketing | `marketing/kirim` | see `marketing.md` §1 |
| Marketing / Beli Kampanye Marketing | `marketing/beli-kuota` | §2 |

## Per-screen deep-dive files (in this folder)

- [`pos_kasir.md`](pos_kasir.md) — POS / Kasir Screen (most complex)
- [`pos_dashboard.md`](pos_dashboard.md) — Sales dashboard with KPIs + charts
- [`produk_master.md`](produk_master.md) — Product master 14 sub-screens
- [`inventori_flows.md`](inventori_flows.md) — 19 inventory sub-screens
- [`pelanggan.md`](pelanggan.md) — 5 customer sub-screens
- [`promo_kupon.md`](promo_kupon.md) — Promo + Kupon + Poin Reward
- [`komisi.md`](komisi.md) — Commission groups
- [`invoice_b2b.md`](invoice_b2b.md) — B2B invoice 5-stage flow
- [`marketing.md`](marketing.md) — Marketing campaign UI
- [`kitchen_reports.md`](kitchen_reports.md) — Kitchen process reports
- [`tutup_toko.md`](tutup_toko.md) — End-of-day store close
- [`settlement.md`](settlement.md) — QRIS + online order settlement

## Mobile app considerations

This entire group is the core of the cashier-facing experience. Key Android decisions:
- POS screen is **mandatory** offline-first.
- Reports are **mostly online**; cache last 7 days for offline reading.
- Inventory writes (PO, GR, opname) must support offline + sync.
- Marketing campaign is **online only** (no value offline).
- Pelanggan + Promo master is offline-cached for POS use.
