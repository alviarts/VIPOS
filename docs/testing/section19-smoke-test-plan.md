# VIPOS — Test Plan untuk Section 19 features

**Target:** http://103.74.5.44/vipos/  (production VPS, fresh seed)
**Login:** admin / admin123

## What changed (relative to PR #1 main branch)
- Backend tabel + endpoint baru: `departments`, `customers` (auto kode `PLG####`), `cash_accounts` + `cash_transactions` (saldo computed), `inventory_movements` (stok recompute on POST).
- Backend extend tabel: `categories` (urutan, department_id, is_tampil_di_menu) + `products` (harga_modal, harga_beli, satuan, barcode, is_tampil_di_menu, is_favorit, monitor_stok, stok_minimum).
- Frontend: 5 halaman baru / refactor (`ProductsPage` → wizard 5-tab, `CategoriesPage`, `CustomersPage`, `InventoryPage`, `FinancePage`); 6 reusable UI components (`ConfirmationDialog`, `EmptyState`, `Pagination`, `FilterTabs`, `Toggle`, `PageHeader`).
- Sidebar `Layout.jsx` mengekspos menu Kategori/Inventori/Pelanggan/Keuangan (sebelumnya `disabled`).

## Primary flow (recorded)

### Test 1 — Sidebar exposes new menu items
- **Action:** Login ke `/vipos/`, perhatikan sidebar kiri.
- **Assertion (pass):** Sidebar menampilkan **10 item** dengan label tepat dalam urutan ini: Dashboard, Kasir, Produk, Kategori, Inventori, Pelanggan, Keuangan, Transaksi, Laporan, Pengaturan. Kategori/Inventori/Pelanggan/Keuangan **tidak greyed-out** (klikable).
- **Fail signal jika rusak:** Item Kategori/Inventori/Pelanggan/Keuangan absent atau `disabled: true` (tidak terlihat / tidak klikable).

### Test 2 — Kategori menampilkan field baru (urutan, departemen, product_count)
- **Action:** Klik "Kategori" di sidebar.
- **Assertion (pass):** Tabel menampilkan **5 baris** seed:
  - "Makanan" — urutan **1** — departemen **F&B** — produk **8**
  - "Minuman" — urutan **2** — departemen **F&B** — produk **8**
  - "Dessert" — urutan **3** — departemen **F&B** — produk **3**
  - "Paket" — urutan **4** — departemen **F&B** — produk **2**
  - "Lainnya" — urutan **99** — departemen kosong/`-` — produk **0**
- **Fail signal jika rusak:** Kolom Urutan/Departemen tidak ada, atau product_count salah (tabel lama hanya punya kolom Nama).

### Test 3 — Produk multi-tab wizard
- **Action:** Klik sidebar "Produk" → klik tombol "Tambah Produk".
- **Assertion (pass):**
  - Modal punya **5 tab**: "Informasi Produk", "Varian", "Ekstra", "Resep", "majoo Order" (mirroring Majoo).
  - Tab pertama aktif by default (underline teal `#04C99E`).
  - Tab 2-5 harus terkunci (icon lock atau caption "Prime only" / "Advance only" / serupa) — klik salah satu tab terkunci tidak boleh menampilkan form Varian/Resep dst.
  - Tab "Informasi Produk" memunculkan input minimum: Nama, SKU, Kategori (dropdown), Harga Jual, Harga Modal, Satuan, Stok, "Tampil di Menu" toggle.
- **Fail signal jika rusak:** Modal hanya satu form (no tabs) atau semua tab langsung enabled (Majoo gating tidak diimplementasi).

### Test 4 — Inventori: stok opname menulis ulang stok produk
- **Setup state pre-test:** Produk "Air Mineral" (id=1) saat ini stock=300 (dari seed).
- **Action:**
  1. Klik "Inventori" → klik tombol "Opname".
  2. Pilih produk "Air Mineral", masukkan qty `250`, keterangan "Smoke test opname".
  3. Submit.
  4. Buka tab Movements / refresh halaman, lalu juga buka "Produk" untuk lihat stock.
- **Assertion (pass):**
  - Toast / pesan sukses muncul.
  - Tabel Movements menampilkan row baru paling atas: tipe = **opname**, stok_sebelum=**300**, stok_sesudah=**250**, qty=**250**.
  - Halaman Produk: row "Air Mineral" stock=**250** (bukan 550 — kalau jadi 550 berarti perilaku salah ditreat sebagai stok_in).
  - Summary card "Total Stok" turun **50** unit.
- **Fail signal jika rusak:** Stock jadi 550 (additive), atau tidak berubah (movement direkam tapi stok produk tidak di-update — bug pada transaction `db.transaction()`).

### Test 5 — Pelanggan: kode auto-generate `PLG0006`
- **Pre-state:** 5 customer seed `PLG0001`–`PLG0005`.
- **Action:** Klik "Pelanggan" → "Tambah" → isi Nama "Smoke Test", Phone "08120000000", biarkan field kode kosong → Simpan.
- **Assertion (pass):** Tabel menambah row paling atas dengan kode **`PLG0006`** (bukan blank, bukan `PLG6`, bukan `PLG0001`-collision).
- **Fail signal jika rusak:** Kode kosong (server tidak generate), kode duplikat, atau format `PLG6` (padding hilang).

### Test 6 — Keuangan: pemasukan menambah saldo akun secara real-time
- **Pre-state seed (verified via API earlier):** Akun "Kas Outlet" (id=2, kode `1-10001`) saldo=**Rp600.000**.
- **Action:** Klik "Keuangan" → tab "Transaksi" → tombol "Tambah Pemasukan" / "+ Transaksi" → isi:
  - Tipe: Pemasukan
  - Akun: Kas Outlet
  - Jumlah: 100000
  - Kategori: "Test"
  - Submit.
- **Assertion (pass):**
  - Transaksi baru muncul di tabel paling atas (badge tipe **Pemasukan** hijau, jumlah Rp100.000, akun "Kas Outlet").
  - Klik tab "Buku Kas & Bank": baris "Kas Outlet" saldo = **Rp700.000** (= 600.000 + 100.000).
  - Summary card "Total Pemasukan" naik **Rp100.000** (dari 750.000 → 850.000).
- **Fail signal jika rusak:** Saldo Kas Outlet tetap Rp600.000 atau jadi Rp500.000 (formula salah arah / pengeluaran), atau saldo akun lain (Rekening Bank) ikut berubah (account routing salah).

## Out of scope (tidak ditest)
- Tab 2-5 wizard Produk (sengaja di-gate locked, hanya tab 1 fungsional)
- Edit / Delete CRUD untuk Kategori, Pelanggan, Movements, Cash Account (POST sudah cukup membuktikan alur)
- Halaman Kasir / Dashboard / Transaksi / Laporan (tidak diubah di PR ini)
- Validasi form edge case (empty submit, etc.)

## Cleanup setelah test
- Hapus produk smoke test, customer `PLG0006`, transaksi pemasukan smoke test, movement opname Air Mineral via API DELETE.
- Re-seed VPS database (`node src/utils/seed.js`) untuk kembali ke baseline 5 customer / saldo seed jika perlu.
