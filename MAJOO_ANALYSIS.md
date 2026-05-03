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

### Laporan Penjualan (expandable):
- Ringkasan Penjualan
- Detail Penjualan
- Penjualan Per Periode
- Penjualan Outlet
- Laporan Jenis Bayar
- Laporan Jenis Order
- Laporan Void
- Laporan Refund

### Laporan lainnya:
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

## 7. Halaman Keuangan

### Sidebar menu:
- Dashboard Keuangan
- Buku Kas: Daftar Buku Kas & Bank, Daftar Transfer
- Penerimaan (expandable)
- Pengeluaran (expandable)
- Manajemen Aset (expandable)
- Laporan Keuangan (expandable)
- Daftar Akun (expandable)

### Daftar Buku Kas & Bank
- Tombol: "Tambah Transaksi ▼" (outline hijau) + "+ Tambah Buku Kas & Bank" (hijau solid)
- Tabs: **Aktif** | Tidak Aktif
- Search bar
- Tabel kolom: (checkbox) | KODE AKUN | TIPE | NAMA AKUN | KATEGORI AKUN | SALDO DI MAJOO
- Default data: KAS (1-10000, Header), Kas Outlet, Rekening Bank, Kas Kasir Outlet, Giro, dll

## 8. Halaman Pengaturan

### Sidebar menu:
- Pesan Masuk (inbox, badge count)
- Notifikasi (expandable)
- Akun Profile (expandable)
- Langganan (expandable)
- Outlet (expandable)
- Produk dan Inventori
- Reservasi
- Pembayaran (expandable)
- Cetak (expandable)
- Kasir: Daftar Kasir, Kategori Kas Kasir
- Terminal (expandable)
- Akses Support (expandable)
- Daftar Ekspor

### Daftar Pesan (Inbox)
- Search + date range filter
- Tabel: SUBJEK | PENGIRIM | TANGGAL | PRIORITAS
- Prioritas badge: "Sedang" (kuning/orange)
- Eye icon untuk view

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

## 11. TODO untuk Devin Berikutnya

### Prioritas Tinggi:
1. **Test locally** — `npm run install:all` → `npm run seed` → `npm run dev`
2. **Update form tambah produk** — sesuaikan field dengan Majoo (harga modal, harga beli, harga jual, SKU, barcode, status tampil di menu)
3. **Update form tambah kategori** — tambah field urutan, toggle tampil di menu
4. **Tambah confirmation dialog** sebelum save (pattern Majoo)
5. **Deploy ke VPS 103.74.5.44** — setup Node.js, nginx, pm2

### Prioritas Sedang:
6. Tambah empty state ilustrasi (gambar SVG)
7. Tambah pagination component yang mirip Majoo
8. Tambah search + filter dropdown + tab filter di halaman list
9. Tambah star/favorite button di judul halaman
10. Tambah toast notification style Majoo (background gelap)

### Prioritas Rendah:
11. Tambah halaman Inventori (stok masuk, stok keluar, opname)
12. Tambah halaman Pelanggan
13. Tambah fitur multi-outlet
14. Tambah fitur Promosi/Diskon
15. Tambah halaman Keuangan (buku kas, penerimaan, pengeluaran)

## 12. Akses & Kredensial

- **GitHub Repo**: https://github.com/alviarts/VIPOS
- **Default login VIPOS**: admin / admin123
- **VPS**: 103.74.5.44 (root, password tersimpan di Devin secrets)
- **Tech stack**: Node.js + Express + SQLite (backend), React + Vite + Tailwind (frontend)
