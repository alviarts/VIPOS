# Analisis UI/UX Majoo Dashboard — Referensi untuk VIPOS

> **Catatan untuk Devin berikutnya:** Dokumen ini berisi analisis lengkap dari dashboard Majoo (https://dashboard.majoo.id). 
> Gunakan sebagai referensi utama untuk melanjutkan development VIPOS agar mirip dengan Majoo.
> File HTML halaman Majoo juga tersedia di folder `docs/majoo_html/` untuk referensi detail.

---

## 1. Warna & Branding

| Elemen | Warna | Hex |
|--------|-------|-----|
| Primary / Sidebar | Hijau Tosca | `#04C99E` |
| Sidebar gradient end | Hijau Tua | `#03A882` |
| Header top nav | Putih | `#FFFFFF` |
| Tab aktif | Hijau tosca | `#04C99E` |
| Background halaman | Abu muda | `#F5F5F5` |
| Card background | Putih | `#FFFFFF` |
| Text utama | Hitam/dark gray | `#333333` |
| Text secondary | Abu-abu | `#888888` |
| Success/Aktif badge | Hijau | `#04C99E` |
| Danger/Error | Merah | `#E74C3C` |
| Warning | Kuning | `#F1C40F` |

## 2. Layout Utama

### Sidebar Kiri (Fixed, ~180px)
- **Background**: Gradient hijau tosca (#04C99E → #03A882)
- **Logo Majoo**: Di atas sidebar
- **Outlet Selector**: Dropdown "Semua Outlet" di bawah logo
- **Menu items** (text putih, icon + label):
  - Menu Favorit (collapsible)
  - Dashboard
  - Laporan (expandable submenu)
  - Analisa Laporan (expandable)
  - Produk (expandable submenu)
  - Inventori (expandable submenu)
  - Pelanggan (expandable)
  - Promosi (expandable)
  - Komisi (expandable)
  - Invoice (expandable)
  - Marketing (expandable)
- **Footer sidebar**: Care button + "Chat 24 Jam" hijau
- **Active state**: Background putih transparan (bg-white/25)
- **Hover state**: Background putih transparan lebih ringan (bg-white/15)

### Top Navigation (Horizontal Tabs)
- **Background**: Putih dengan border bawah
- Tabs: **Penjualan** | Order Online | Appointment | Karyawan | Keuangan | Pengaturan | Lainnya
- Tab aktif: Background hijau tosca, text putih, rounded-full
- Tab inactive: Text abu-abu
- **Kanan**: Notification bell, user avatar + nama

### Content Area
- Background: Abu-abu muda (#F5F5F5)
- Padding: ~24px
- Full width, scrollable

### Footer Banner
- Banner kuning/orange di bagian bawah: "Masa Aktif akun trial tersisa X hari..."
- Tombol "Perpanjang" merah

## 3. Halaman Dashboard Penjualan

### Banner Promo (Carousel)
- Carousel gambar promo di atas halaman
- Dots indicator di bawah
- Auto-rotate

### Onboarding Wizard
- Bar hijau tosca "Langkah Mudah Buka Outlet" dengan progress bar (0/3)
- 3 steps: Siapkan Produk → Informasi Karyawan → Lengkapi Data Outlet

### Dashboard Stats Row
- **Dalam satu card** dengan divider vertikal
- 6 metrics dalam 1 baris:
  1. **Total Penjualan** — Rp XXX
  2. **Penjualan Belum Dibayar** — Rp XXX
  3. **Transaksi** — jumlah
  4. **Penjualan per Transaksi** — Rp XXX
  5. **Produk Terjual** — jumlah
  6. **Produk per Transaksi** — jumlah
- Sub info: "Akumulasi dari Awal Bulan", "Proyeksi Bulan Ini"
- Period selector: **Harian** / Mingguan / Bulan (pill buttons, aktif = hijau tosca)
- Date range: "03 Mei 26 - 03 Mei 26" dengan arrow navigasi

### Grafik Penjualan
- Title: "Penjualan [tanggal]"
- Line/bar chart per jam (00:00 - 23:00)
- Legend: "Periode Sebelumnya" (abu) vs "Total Penjualan" (hijau tosca)

### Analysis Cards (4 kolom × 2 baris)
Baris 1:
1. **Kontrol Fraud** — monitoring kecurangan
2. **Metode Pembayaran** — breakdown per metode bayar
3. **Jenis Order** — dine-in, takeaway, delivery, dll
4. **Penjualan per Kategori** — breakdown per kategori produk

Baris 2:
5. **Produk Terlaris** — ranking produk
6. **Komisi per Kasir** — komisi per karyawan kasir
7. **Penjualan per Kasir** — penjualan per karyawan
8. **Stok Terendah** — produk dengan stok menipis

Setiap card:
- Title bold
- Content area (chart mini / list / "Belum Ada Transaksi")
- Footer: "..." menu + "Lihat Semua >" link hijau

## 4. Halaman Produk

### Daftar Departemen
- URL: /item/department
- Hierarki: Departemen > Kategori > Produk

### Daftar Kategori
- URL: /item/category
- Tombol: **+ Tambah Kategori** (hijau tosca, sudut kanan atas)
- Search bar + filter tabs: Semua | Tampil di Menu | Tidak Tampil di Menu
- Tabel kolom: NAMA KATEGORI | URUTAN | JUMLAH PRODUK | DEPARTEMEN | STATUS
- Status badge: "Tampil di Menu" (hijau) atau "Tidak Tampil di Menu"
- Action: ... menu (edit, delete)
- Pagination: "Tampilkan: 10 ∨ Ditampilkan 1-1 dari 1 data"

### Form Tambah Kategori (Full page, bukan modal)
- URL tetap /item/category
- Header: "Tambah Kategori" + logo Majoo di tengah atas
- Close button (X) di kiri atas
- Fields:
  1. **Atur Outlet*** — Dropdown multi-select, otomatis terisi outlet aktif (tag "adasd ×")
  2. **Nama Kategori*** — Text input, placeholder "Contoh: Snack"
  3. **Urutan*** — Number input, placeholder "Contoh: 1"
  4. **Departemen** — Dropdown (optional)
  5. **Tampil di Menu** — Toggle switch ON/OFF, label "Tampilkan kategori pada aplikasi kasir"
- Footer: **Batal** (text link) + **Simpan** (tombol hijau tosca)
- Konfirmasi dialog: "Simpan Kategori - Kategori **Makanan** akan disimpan dan tampil di daftar kategori sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?"
  - Tombol: Batal | Ya, Lanjutkan (hijau tosca)
- Success toast: "Berhasil! Kategori Makanan berhasil ditambahkan" (pojok kanan atas, warna hitam/dark)

### Daftar Produk
- URL: /item
- Header: "Daftar Produk" + star/favorite + info jumlah "adasd - 0 Produk barang"
- Tombol: refresh, Impor Data, Ekspor Data, **+ Tambah Produk** (hijau)
- Search: input "Cari ..." + dropdown "Semua Kategori"
- Filter tabs: **Semua** | Tampil di Menu | Tidak Tampil di Menu
- Tabel kolom: (checkbox) | NAMA PRODUK | KATEGORI | HARGA MODAL | HARGA BELI | HARGA JUAL | STATUS
- Empty state: Gambar ilustrasi + "Data tidak tersedia" + "Belum ada data yang dapat ditampilkan di halaman ini"

### Submenu Produk Lengkap
- Daftar Departemen
- Daftar Kategori
- Daftar Produk
- Produk Layanan
- Produk Ekstra
- Produk Paket
- Deposit
- Penjadwalan Perubahan Resep
- Daftar Harga Ojek Online
- Penjadwalan Harga
- Harga Berdasarkan Waktu
- Cetak Barcode
- Daftar Kategori Catatan
- Master Resep

## 5. Halaman Inventori

### Submenu:
- Daftar Bahan Baku
- Pembelian Stok (expandable)
- Kelola Stok (expandable)
- Produksi Stok (expandable)
- Mutasi Antar Outlet (expandable)
- Daftar Pemasok

## 6. Halaman Laporan

### Laporan Penjualan (expandable) — 8 sub-laporan:
- Ringkasan Penjualan
- Detail Penjualan
- Penjualan Per Periode
- Penjualan Outlet
- Laporan Jenis Bayar
- Laporan Jenis Order
- Laporan Void
- Laporan Refund

### Laporan lainnya (11 kategori):
- Laporan Dapur (expandable)
- Laporan Produk (expandable)
- Laporan Jasa (expandable)
- Laporan Promo & Loyalti (expandable)
- Laporan Pajak (expandable)
- Laporan Kasir (expandable)
- Laporan Deposit (expandable)
- Laporan Pelanggan (expandable)
- Laporan Karyawan (expandable)
- Laporan Persediaan (expandable)
- Laporan Settlement (expandable)

### Detail Halaman "Ringkasan Penjualan" (dari Analisis Langsung)
- URL: `/laporan/penjualan/sales-summary`
- Header: "Ringkasan Penjualan" + info icon (?) + star/favorite
- Action button: **Ekspor Laporan** (green button with download icon, top right)
- Date range picker: "01 Mei 2026 - 31 Mei 2026" (calendar icon)
- Info: "Terakhir Diperbarui: dalam 7 jam"

#### Summary Cards (5 cards horizontal):
| Card | Keterangan |
|------|------------|
| Total Pendapatan | Rp XXX, info icon (?) |
| Biaya Promosi | Rp XXX, info icon (?) |
| Total Penjualan | Rp XXX, info icon (?) |
| Penjualan Bersih | Rp XXX, info icon (?) |
| Total Laba Kotor | Rp XXX, info icon (?) |

#### Rincian Ringkasan Penjualan (2-column detail table):
**Kolom Kiri — PENDAPATAN:**
| Item | Nilai |
|------|-------|
| Penjualan Kotor | Rp XXX |
| Ongkos Kirim | Rp XXX |
| Biaya Pelayanan | Rp XXX |
| Biaya Pelayanan MDR | Rp XXX |
| Pembulatan | Rp XXX |
| Pajak | Rp XXX |
| Asuransi | Rp XXX |
| Platform | Rp XXX |
| Lainnya | Rp XXX |
| **TOTAL PENDAPATAN** | **Rp XXX** |

**Kolom Kanan — BIAYA PROMOSI:**
| Item | Nilai |
|------|-------|
| Promo Pembelian | (Rp XXX) |
| Promo Produk | (Rp XXX) |
| Komplimen | (Rp XXX) |
| **TOTAL BIAYA PROMOSI** | **(Rp XXX)** |

**Section bawah — BIAYA ADMINISTRASI:**
- Biaya Administrasi (info icon)
- TOTAL BIAYA ADMINISTRASI

**PENJUALAN BERSIH:**
- Total Penjualan (info icon)
- Pengembalian
- TOTAL PENJUALAN BERSIH

**LABA KOTOR:**
- Penjualan Bersih (info icon)
- Biaya MDR
- HPP
- Komisi
- Biaya Ongkos Kirim (info icon)
- Biaya Asuransi (info icon)
- **TOTAL LABA KOTOR**

## 7. Halaman Keuangan

### Sidebar menu (tab "Keuangan" di top nav):
- Dashboard Keuangan
- **Buku Kas** (expandable):
  - Daftar Buku Kas & Bank
  - Daftar Transfer
- **Penerimaan** (expandable)
- **Pengeluaran** (expandable)
- **Manajemen Aset** (expandable)
- **Laporan Keuangan** (expandable)
- **Daftar Akun** (expandable)

### Daftar Buku Kas & Bank
- URL: `/buku-kas/daftar-buku-kas`
- Tombol: "Tambah Transaksi ▼" (outline hijau, dropdown) + "+ Tambah Buku Kas & Bank" (hijau solid)
- Tabs: **Aktif** | Tidak Aktif
- Search bar: "Cari ..."
- Tabel kolom: (checkbox) | KODE AKUN | TIPE | NAMA AKUN | KATEGORI AKUN | SALDO DI MAJOO
- Default data (pre-populated):

| Kode Akun | Tipe | Nama Akun | Kategori | Saldo |
|-----------|------|-----------|----------|-------|
| 1-10000 | Header | KAS | Kas & Bank | - |
| 1-10001 | Detail | Kas Outlet | Kas & Bank | Rp 0 |
| 1-10002 | Detail | Rekening Bank | Kas & Bank | Rp 0 |
| 1-10003 | Detail | Kas Kasir Outlet | Kas & Bank | Rp 0 |
| 1-10004 | Detail | Giro | Kas & Bank | Rp 0 |
| 1-19001 | Detail | Ayat Silang Kas & Bank | Kas & Bank | Rp 0 |
| 1-19002 | Detail | Ayat Silang Buka / Tutup Kasir | Kas & Bank | Rp 0 |

- Action per row: Edit icon (pencil) untuk Header, Eye icon (view) untuk Detail, ... menu untuk Giro

## 7b. Halaman Pelanggan

### Submenu (sidebar tab "Penjualan"):
- **Daftar Pelanggan**
- **Grup Pelanggan**
- **Grup Harga Spesial**
- **Kustom Data Pelanggan**
- **Pengaturan Data Pelanggan**

### Daftar Pelanggan
- URL: `/pelanggan/daftar-pelanggan`
- Header: "Daftar Pelanggan" + info icon (?) + star/favorite
- Action buttons: Ekspor Data (dropdown ▼) | Impor Data | **+ Tambah Pelanggan** (green)
- Search: "Cari ..."
- Tabel kolom (sortable):

| Column | Sortable |
|--------|----------|
| ☐ (Checkbox) | No |
| NAMA | Yes |
| KODE PELANGGAN | Yes |
| ALAMAT | Yes |
| TELEPON | Yes |
| JENIS KELAMIN | Yes |
| POIN | No |
| SALDO DEPOSIT | No |

- Empty state: SVG ilustrasi + "Data tidak tersedia" + "Belum ada data yang dapat ditampilkan di halaman ini"
- Pagination: "Tampilkan: [10 ▼] Ditampilkan 1 - 0 dari 0 data"

## 7c. Halaman Promosi

### Submenu (sidebar tab "Penjualan"):
- **Promo** (expandable — sub-types of promotions)
- **Kupon** (expandable — coupon management)
- **Poin Reward** (expandable — loyalty points)

## 7d. Halaman Komisi

### Submenu:
- **Daftar Grup Komisi**

## 7e. Halaman Invoice

### Submenu (5 sub-halaman):
- **Daftar Penawaran Penjualan** (Sales Quotations)
- **Daftar Pesanan Penjualan** (Sales Orders)
- **Daftar Pengiriman Penjualan** (Sales Deliveries)
- **Daftar Invoice** (Invoices)
- **Daftar Penerimaan Penjualan** (Sales Receipts)

## 7f. Halaman Marketing

### Submenu:
- **Kirim Kampanye Marketing** (Send Marketing Campaigns)
- **Beli Kampanye Marketing** (Buy Marketing Campaigns)

## 8. Halaman Pengaturan

### Sidebar menu (tab "Pengaturan" di top nav):
- **Pesan Masuk** (inbox, badge count "2") → Daftar Pesan
- **Notifikasi** (expandable)
- **Akun Profile** (expandable)
- **Langganan** (expandable)
- **Outlet** (expandable)
- **Produk dan Inventori** (single page)
- **Reservasi** (single page)
- **Pembayaran** (expandable)
- **Cetak** (expandable)
- **Kasir** (expandable)
- **Terminal** (expandable)
- **Akses Support** (expandable)
- **Daftar Ekspor** (single page)

### Daftar Pesan (Inbox)
- URL: `/message/inbox`
- Header: "Daftar Pesan" + info icon (?) + star/favorite
- Search: "Cari ..." + date range: "01 Mei 2026 - 31 Mei 2026"
- Tabel: (checkbox) | SUBJEK | PENGIRIM | TANGGAL | PRIORITAS
- Prioritas badge: "Sedang" (kuning/orange dot)
- Eye icon untuk view detail
- Pagination: "Tampilkan: [10 ▼] Ditampilkan 1 - 2 dari 2 data" + Sebelumnya [1] Selanjutnya

## 9. UI Patterns yang Harus Ditiru di VIPOS

### Pattern Umum:
1. **Sidebar hijau tosca** dengan gradient, text putih, icon + label
2. **Top nav horizontal tabs** (Penjualan, Produk, Pengaturan, dll)
3. **Cards dengan shadow ringan** dan border abu-abu halus
4. **Tombol utama hijau tosca** ("+ Tambah XXX"), rounded
5. **Search bar** di kiri + **filter dropdown** + **tab filter** (Semua | Tampil | Tidak Tampil)
6. **Tabel** dengan header UPPERCASE abu-abu, hover row, checkbox
7. **Badge status** rounded-full (hijau = aktif, merah = nonaktif)
8. **Pagination** "Tampilkan: 10 ∨ Ditampilkan X-Y dari Z data"
9. **Star/favorite** icon di samping judul halaman
10. **"Lihat Semua >"** link hijau tosca di footer cards
11. **Toast notification** pojok kanan atas (background gelap)
12. **Confirmation dialog** sebelum simpan ("Ya, Lanjutkan" / "Batal")
13. **Form full-page** (bukan modal) untuk tambah/edit data
14. **Empty state** dengan ilustrasi + pesan "Data tidak tersedia"
15. **Outlet selector** di sidebar (dropdown)

### Mobile/Responsive:
- Sidebar collapse ke hamburger menu
- Cards stack secara vertikal
- Tabel horizontal scroll
- Tabs scroll horizontal

## 10. Fitur VIPOS yang Sudah Dibuat (Status Saat Ini)

### Backend (Node.js + Express + SQLite) — ✅ Selesai
- Auth (login, register, JWT)
- Products CRUD
- Categories CRUD
- Transactions (create, list, detail, void)
- Dashboard (stats, chart, top products, recent, payment methods)

### Frontend (React + Vite + Tailwind) — ✅ Selesai (perlu penyesuaian)
- ✅ Login page (sudah diupdate ke style Majoo — split screen, teal branding)
- ✅ Layout/Sidebar (sudah diupdate — teal gradient, outlet selector, top nav tabs)
- ✅ Dashboard (sudah diupdate — stats row, period selector, analysis cards)
- ✅ Cashier/POS page
- ✅ Products page
- ✅ Transactions page
- ✅ Reports page
- ✅ Settings page
- ✅ Tailwind config (sudah diupdate ke teal color scheme)
- ✅ CSS utilities (sudah diupdate)

## 11. Detail Form "Tambahkan Produk" (dari Analisis Langsung Majoo)

Form "Tambahkan Produk" di Majoo adalah **multi-tab wizard** dengan 5 tab:

### Tab 1: Informasi Produk
| Field | Tipe | Keterangan |
|-------|------|------------|
| Daftar Outlet* | Multi-select dropdown | Pilih outlet mana yang menjual produk ini |
| Nama Produk* | Textarea (max 255 char) | Placeholder: "Contoh: nasi padang" |
| Deskripsi Produk | Textarea | Placeholder: "Contoh: yang best seller" |
| Foto Produk | File upload (drag & drop) | Rasio 1:1, 10KB-1MB, format .jpg/.jpeg/.png, min 100x100px, max 1000x1000px, max 5 foto |
| Kategori Produk* | Dropdown | + "Buat Kategori Baru" link |
| Opsi Lanjutan | Checkboxes | ☐ Produk Favorit, ☑ Tampil di Menu |
| Monitor Persediaan | Toggle | OFF default, enables "Stok Minimum Produk" input |
| Serial Number | Toggle (Prime only) | Kasir wajib pilih manual serial number saat penjualan |
| Batch Number | Toggle (Prime only) | |
| Grup | Dropdown | + ☐ Tetapkan sebagai Induk |
| Izinkan Ubah Produk | Toggle | Izinkan kasir mengubah produk menjadi tidak tersedia |

**Harga dan Satuan** (dalam tab yang sama, section bawah):
| Field | Tipe | Keterangan |
|-------|------|------------|
| Satuan | Dropdown | Pilih satuan (pcs, kg, dll) |
| SKU | Text input | Placeholder: "Contoh: S001" |
| Konversi | Number (disabled) | Default: 1 |
| Min. Pembelian | Number | Default: 1 |
| Harga Jual | Currency (Rp) | Input manual |
| Harga Beli | Currency (Rp, disabled) | |
| Dimensi Produk | 3x Number + weight | Panjang x Lebar x Tinggi (cm) + Berat (gram) |
| Ubah Harga Jual | Toggle | Izinkan kasir ubah harga, + Maks % input |
| Harga Grosir | (Prime only) | Max 5 harga grosir |
| + Tambah Satuan | Button | Tambah satuan tambahan |

### Tab 2: Varian (Prime only)
- Fitur untuk menambahkan variasi produk (ukuran, warna, rasa, dll)
- Memerlukan upgrade ke paket Prime

### Tab 3: Ekstra
- Toggle "Produk Memiliki Ekstra" (OFF default)
- Untuk item tambahan seperti garpu, gula, saus, dll
- Contoh workflow: Produk Salad → Varian: Size Large, Warna Putih → Ekstra: + Saus Sambal

### Tab 4: Resep
- Toggle "Resep Produk" — aktifkan untuk menambahkan resep pada produk
- Link "Pengaturan Resep" ke /item/recipe
- Master resep tersedia untuk paket Advance, Prime, Prime+
- Resep untuk produk yang diracik, tidak bisa aktif bersamaan dengan monitor persediaan

### Tab 5: majoo Order
- Integrasi dengan marketplace
- Perlu mengajukan integrasi outlet terlebih dahulu

### UI Pattern Form:
- **Footer buttons**: Batal (kiri, teal text) | Kembali (kanan, gray) | Selanjutnya (kanan, teal text) | Simpan (kanan, teal button)
- **Cancel confirmation dialog**: "Membatalkan Tambah Produk akan menghapus seluruh data yang telah diinput dan tidak dapat dibatalkan. Lanjutkan?" → Kembali | Ya, Lanjutkan (red button)
- **Tab progress**: Green checkmark (✓) pada tab yang sudah diisi
- **Onboarding tooltips**: Setiap tab punya tooltip guide (1/8, 2/8, dll) dengan Lewati/Lanjut buttons

## 12. Detail Halaman Daftar Produk

### Header:
- Judul: "Daftar Produk" + Star/Favorite icon
- Info: "[outlet name] - [n] Produk barang"
- Action buttons: Refresh | Impor Data | Ekspor Data | + Tambah Produk (green button)

### Filters:
- Search input: Placeholder "Cari ..."
- Dropdown: "Semua Kategori" (filter by category)
- Tab filters: Semua | Tampil di Menu | Tidak Tampil di Menu

### Table columns:
| Column | Sortable |
|--------|----------|
| ☐ (Checkbox select all) | No |
| NAMA PRODUK | Yes |
| SKU | Yes |
| KATEGORI | Yes |
| HARGA MODAL | Yes |
| HARGA BELI | Yes |
| HARGA JUAL | Yes |
| STATUS | No |

### Empty state:
- Ilustrasi SVG (clipboard with magnifying glass, teal colors)
- "Data tidak tersedia"
- "Belum ada data yang dapat ditampilkan di halaman ini"

## 13. Struktur Menu Sidebar Lengkap (Hasil Analisis Langsung)

### A. Sidebar Menu tab "Penjualan" (11 menu utama):
1. **Menu Favorit** (expandable — user-pinned favorites)
2. **Dashboard** (single page — Dashboard Penjualan)
3. **Laporan** (expandable — 12 kategori laporan, 19+ sub-laporan total):
   - Laporan Penjualan → 8 sub: Ringkasan, Detail, Per Periode, Outlet, Jenis Bayar, Jenis Order, Void, Refund
   - Laporan Dapur, Produk, Jasa, Promo & Loyalti, Pajak, Kasir, Deposit, Pelanggan, Karyawan, Persediaan, Settlement
4. **Analisa Laporan** (expandable)
5. **Produk** (expandable) — 14 submenu:
   - Daftar Departemen, Daftar Kategori, Daftar Produk, Produk Layanan, Produk Ekstra
   - Produk Paket, Deposit, Penjadwalan Perubahan Resep, Daftar Harga Ojek Online
   - Penjadwalan Harga, Harga Berdasarkan Waktu, Cetak Barcode, Daftar Kategori Catatan, Master Resep
6. **Inventori** (expandable) — 6 submenu:
   - Daftar Bahan Baku, Pembelian Stok, Kelola Stok, Produksi Stok, Mutasi Antar Outlet, Daftar Pemasok
7. **Pelanggan** (expandable) — 5 submenu:
   - Daftar Pelanggan, Grup Pelanggan, Grup Harga Spesial, Kustom Data Pelanggan, Pengaturan Data Pelanggan
8. **Promosi** (expandable) — 3 submenu:
   - Promo, Kupon, Poin Reward
9. **Komisi** (expandable) — 1 submenu:
   - Daftar Grup Komisi
10. **Invoice** (expandable) — 5 submenu:
    - Daftar Penawaran Penjualan, Daftar Pesanan Penjualan, Daftar Pengiriman Penjualan, Daftar Invoice, Daftar Penerimaan Penjualan
11. **Marketing** (expandable) — 2 submenu:
    - Kirim Kampanye Marketing, Beli Kampanye Marketing

### B. Sidebar Menu tab "Keuangan" (7 menu):
1. Dashboard Keuangan
2. Buku Kas → Daftar Buku Kas & Bank, Daftar Transfer
3. Penerimaan (expandable)
4. Pengeluaran (expandable)
5. Manajemen Aset (expandable)
6. Laporan Keuangan (expandable)
7. Daftar Akun (expandable)

### C. Sidebar Menu tab "Pengaturan" (13 menu):
1. Pesan Masuk → Daftar Pesan
2. Notifikasi (expandable)
3. Akun Profile (expandable)
4. Langganan (expandable)
5. Outlet (expandable)
6. Produk dan Inventori
7. Reservasi
8. Pembayaran (expandable)
9. Cetak (expandable)
10. Kasir (expandable)
11. Terminal (expandable)
12. Akses Support (expandable)
13. Daftar Ekspor

### Top Nav Horizontal (7 tabs):
**Penjualan** | Order Online | Appointment | Karyawan | **Keuangan** | **Pengaturan** | **Lainnya** (dropdown)

### Dashboard Extra Cards (yang belum ada di VIPOS):
- **Kontrol Fraud** — chart/data fraud detection
- **Jenis Order** — breakdown by order type
- **Komisi per Kasir** — cashier commission data
- **Penjualan per Kasir** — sales per cashier
- **Akumulasi dari Awal Bulan** — MTD accumulation
- **Proyeksi Bulan Ini** — monthly projection
- **Penjualan Belum Dibayar** — unpaid sales

### Onboarding Wizard:
"Langkah Mudah Buka Outlet" (0/3):
1. Siapkan Produk
2. Informasi Karyawan
3. Lengkapi Data Outlet

## 14. TODO untuk Devin Berikutnya

### Prioritas Tinggi:
1. **Test locally** — `cd backend && npm install && npm run seed` → `cd frontend && npm install` → start both
2. **Update form tambah produk** — implementasi multi-tab wizard sesuai Majoo (5 tabs: Info, Varian, Ekstra, Resep, Order)
3. **Update form tambah kategori** — tambah field urutan, departemen, toggle tampil di menu
4. **Tambah confirmation dialog** sebelum cancel/delete (pattern Majoo: "Ya, Lanjutkan" button merah)
5. **Deploy ke VPS 103.74.5.44** — setup Node.js, nginx, pm2
6. **Tambah Harga dan Satuan section** di form produk (SKU, Harga Jual, Harga Beli, Satuan, Konversi, Dimensi)

### Prioritas Sedang:
7. Tambah empty state ilustrasi SVG (clipboard + magnifying glass, teal themed)
8. Tambah pagination component yang mirip Majoo
9. Tambah search + filter dropdown + tab filter di halaman list (Semua / Tampil di Menu / Tidak Tampil di Menu)
10. Tambah star/favorite button di judul halaman
11. Tambah toast notification style Majoo (background gelap)
12. Tambah Impor Data / Ekspor Data buttons di halaman list
13. Tambah foto produk upload (drag & drop, max 5 foto)
14. Tambah "Monitor Persediaan" toggle + Stok Minimum

### Prioritas Rendah:
15. Tambah halaman Inventori (stok masuk, stok keluar, opname)
16. Tambah halaman Pelanggan
17. Tambah fitur multi-outlet (outlet selector)
18. Tambah fitur Promosi/Diskon
19. Tambah halaman Keuangan (buku kas, penerimaan, pengeluaran)
20. Tambah "Kontrol Fraud", "Jenis Order", "Komisi per Kasir", "Penjualan per Kasir" cards di dashboard
21. Tambah Onboarding Wizard ("Langkah Mudah Buka Outlet")
22. Tambah Departemen management (Daftar Departemen)

## 15. Akses & Kredensial

- **GitHub Repo**: https://github.com/alviarts/VIPOS
- **Default login VIPOS**: admin / admin123
- **VPS**: 103.74.5.44 (root, password tersimpan di Devin secrets)
- **Tech stack**: Node.js + Express + SQLite (backend), React + Vite + Tailwind (frontend)
- **Majoo Auth Data**: `docs/majoo_auth/` — localStorage JSON + login script (token expires ~24h)
- **Majoo Login Script**: `python3 docs/majoo_auth/login_majoo.py` (requires Chrome + CDP at localhost:29229)
- **Majoo HTML Snapshots**: `docs/majoo_html/` — 7 HTML files for offline reference
