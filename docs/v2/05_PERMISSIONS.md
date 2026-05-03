# 05 · Permissions Matrix

> Role × menu × action — derived from `docs/majoo_menu_flat.tsv` (293 menus, 205 with URL) cross-referenced with the role enum in the bundle. Where the matrix is empty, infer from convention (KASIR usually `view+create`, MANAGER usually `view+create+update`, OWNER `all`, WAREHOUSE limited to inventory ops).

## §1 Built-in roles

| Role | id | Mobile-relevant default access |
|---|:-:|---|
| OWNER / ADMIN | 1 | All menus, all actions. |
| MANAGER | 2 | All POS/inventory/reports/CRM. No delete on master data. No outlet/subscription settings. |
| KASIR / CASHIER | 3 | POS only (open shift, take orders, pay, void with manager PIN). View daily sales. |
| STAFF | 4 | View-only POS + view-only reports. Limited writes (e.g. notes on a transaction). |
| WAREHOUSE | 5 | Inventory ops (PO, GR, opname, mutation, waste). Read products. No POS. |
| WAITERS | 6 | Table order app — take orders, send to kitchen. No payment. |
| KITCHEN | 7 | Kitchen Display app — accept ticket, mark ready. No POS. |
| ORDER_DISPLAY | 8 | Order Display screen (for customers waiting). View-only ready orders. |
| SELF_ORDER | 9 | Self Order kiosk. Catalogue + cart + payment. No back-office. |
| CUSTOM | n | Per-menu privilege flags (`view`, `create`, `update`, `delete`). |

## §2 Per-menu permissions (default suggestion)

> Format: `OWNER / MANAGER / KASIR / STAFF / WAREHOUSE / WAITERS / KITCHEN`. `V` = view, `C` = create, `U` = update, `D` = delete, `-` = no access.

### PENJUALAN top-tab

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard | V | V | V | V | V | - | - |
| Order Online > List | VCUD | VCU | VCU | V | - | V | - |
| Order Online > Settings | VCUD | VCU | - | - | - | - | - |
| Penjualan > POS / Kasir | VCUD | VCUD | VCU | - | - | VC | - |
| Penjualan > Riwayat | VCUD | VCU | V | V | - | - | - |
| Penjualan > Void | VCUD | VCU | C* | - | - | - | - |
| Penjualan > Refund | VCUD | VCU | C* | - | - | - | - |
| Penjualan > Laporan Ringkasan | V | V | V** | V | - | - | - |
| Penjualan > Laporan Detail | V | V | - | V | - | - | - |
| Penjualan > Laporan Per Kasir | V | V | V** | - | - | - | - |
| Penjualan > Laporan Per Outlet | V | V | - | V | - | - | - |
| Penjualan > Laporan Penjualan Produk | V | V | V** | V | - | - | - |
| Penjualan > Laporan Pajak | V | V | - | V | - | - | - |
| Penjualan > Laporan Tutup Kasir | V | V | V** | V | - | - | - |
| Penjualan > Tutup Kasir | C | C | C | - | - | - | - |
| Penjualan > Buka Kasir | C | C | C | - | - | - | - |

\* requires manager PIN. \*\* only own data.

### ORDER ONLINE top-tab

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Marketplace List | VCUD | VCU | V | V | - | - | - |
| Marketplace Detail | VCUD | VCU | VC | - | - | - | - |
| E-menu Setting | VCUD | VCU | - | - | - | - | - |
| Webstore Setting | VCUD | VCU | - | - | - | - | - |
| Sync Catalogue | C | C | - | - | C | - | - |

### APPOINTMENT top-tab

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Reservasi List | VCUD | VCUD | VCU | V | - | VC | - |
| Reservasi Settings | VCUD | VCU | - | - | - | - | - |

### KARYAWAN top-tab

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Karyawan > List | VCUD | VCU | - | - | - | - | - |
| Karyawan > Detail / Edit | VCUD | VCU | - | - | - | - | - |
| Karyawan > Akses (privilege) | VCUD | - | - | - | - | - | - |
| Karyawan > Absensi | V | V | V** | V** | V** | V** | V** |
| Karyawan > Shift Kasir | VCUD | VCU | V** | - | - | - | - |
| Karyawan > Komisi | V | V | V** | - | - | - | - |
| Karyawan > Jadwal | VCUD | VCU | V** | V** | V** | V** | V** |
| Payroll > Struktur Gaji | VCUD | - | - | - | - | - | - |
| Payroll > Pembayaran Gaji | VCUD | V | - | - | - | - | - |
| Payroll > Slip Gaji | V | V | V** | V** | V** | V** | V** |

### KEUANGAN top-tab

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Akuntansi > Daftar Akun | VCUD | V | - | - | - | - | - |
| Akuntansi > Buku Besar | V | V | - | V | - | - | - |
| Akuntansi > Jurnal | VCUD | V | - | - | - | - | - |
| Akuntansi > Faktur Penjualan | VCUD | VCU | V | V | - | - | - |
| Akuntansi > Pembayaran Faktur | VCUD | VCU | V | - | - | - | - |
| Kas/Bank > Akun | VCUD | VCU | - | - | - | - | - |
| Kas/Bank > Transaksi | VCUD | VCU | C | V | - | - | - |
| Kas/Bank > Setor / Tarik | VCUD | VCU | - | - | - | - | - |
| Biaya > List | VCUD | VCUD | V | V | - | - | - |
| Biaya > Tambah | VCUD | VCU | C | - | - | - | - |
| Asset > List | VCUD | VC | - | V | - | - | - |
| Asset > Depresiasi | VCUD | V | - | - | - | - | - |
| Laporan Keuangan > Neraca | V | V | - | V | - | - | - |
| Laporan Keuangan > Rugi Laba | V | V | - | V | - | - | - |
| Laporan Keuangan > Arus Kas | V | V | - | V | - | - | - |
| Laporan Keuangan > Hutang/Piutang | V | V | - | V | - | - | - |

### PENGATURAN top-tab

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Pengaturan > Profil Bisnis | VCUD | V | - | - | - | - | - |
| Pengaturan > Outlet | VCUD | V | - | - | - | - | - |
| Pengaturan > Departemen | VCUD | VCU | - | - | - | - | - |
| Pengaturan > Kategori | VCUD | VCU | - | - | V | - | - |
| Pengaturan > Produk | VCUD | VCU | - | V | V | - | - |
| Pengaturan > Resep | VCUD | VCU | - | - | VCU | - | - |
| Pengaturan > Bahan Baku | VCUD | VCU | - | - | VCU | - | - |
| Pengaturan > Pajak | VCUD | V | - | - | - | - | - |
| Pengaturan > Service Charge | VCUD | V | - | - | - | - | - |
| Pengaturan > Pembayaran (Methods) | VCUD | V | - | - | - | - | - |
| Pengaturan > Cetak Struk Template | VCUD | VCU | - | - | - | - | - |
| Pengaturan > Kasir (UI flags) | VCUD | VCU | V | - | - | - | - |
| Pengaturan > Terminal | VCUD | VCU | V | - | - | - | - |
| Pengaturan > Pelanggan (Member groups) | VCUD | VCU | V | - | - | - | - |
| Pengaturan > Promo | VCUD | VCU | V | - | - | - | - |
| Pengaturan > Loyalti | VCUD | VCU | V | - | - | - | - |
| Pengaturan > Voucher / Kupon | VCUD | VCU | V | - | - | - | - |
| Pengaturan > Notifikasi | VCUD | V | - | - | - | - | - |
| Pengaturan > Akun (Users + Roles) | VCUD | - | - | - | - | - | - |
| Pengaturan > Langganan | VCUD | - | - | - | - | - | - |
| Pengaturan > Akses Support | VCUD | - | - | - | - | - | - |
| Pengaturan > Wilayah / Master Data | V | V | V | V | V | V | V |

### Inventori (under Penjualan)

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Stok | V | V | V | V | VCU | V | - |
| Stok Masuk (PO + GR) | VCUD | VCU | - | - | VCU | - | - |
| Stok Opname | VCUD | VCU | - | - | VCU | - | - |
| Mutasi Stok | VCUD | VCU | - | - | VCU | - | - |
| Produksi Stok | VCUD | VCU | - | - | VCU | - | - |
| Stok Terbuang | VCUD | VCU | - | - | VCU | - | - |
| Supplier | VCUD | VCU | - | - | VCU | - | - |

### Pelanggan (under Penjualan)

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Daftar Pelanggan | VCUD | VCU | VC | V | - | V | - |
| Detail Pelanggan | VCUD | VCU | V | V | - | V | - |
| Loyalty Point Adjust | C | C | - | - | - | - | - |
| Deposit Top-up | C | C | C | - | - | - | - |

### Promosi & Komisi (under Penjualan)

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Promo List | V | V | V | V | - | V | - |
| Promo Tambah / Edit | VCUD | VCU | - | - | - | - | - |
| Komisi Setting | VCUD | VCU | - | - | - | - | - |
| Komisi Detail | V | V | V** | - | - | - | - |

### Marketing (under Penjualan)

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Kampanye List | V | V | - | V | - | - | - |
| Kampanye Tambah | VCUD | VCU | - | - | - | - | - |
| Template | VCUD | VCU | - | - | - | - | - |

### Bantuan / LAYANAN / INSPIRASI / Capital / SUPPLIES

| Menu | OWNER | MANAGER | KASIR | STAFF | WAREHOUSE | WAITERS | KITCHEN |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Bantuan / Help center | V | V | V | V | V | V | V |
| LAYANAN / Customer service | V | V | V | V | V | V | V |
| INSPIRASI / Articles | V | V | V | V | V | V | V |
| Capital (loan) | V | - | - | - | - | - | - |
| SUPPLIES (B2B procurement) | VCUD | V | - | - | V | - | - |

## §3 Custom roles

For OWNER who wants to define a custom role:
- Create role `CUSTOM_ABC`.
- For each menu in the inventory, set 4 booleans (view/create/update/delete).
- Save.

Suggested API `[inferred]`:
```
POST /api/v1/role
{
  "name": "Asisten Manager",
  "permissions": [
    {"menu_key": "produk", "view": true, "create": true, "update": true, "delete": false},
    {"menu_key": "kategori", "view": true, "create": true, "update": false, "delete": false},
    ...
  ]
}
```

## §4 Sensitive operations requiring re-auth

Even if the user has the privilege, force a manager-PIN re-confirm on:
- Void transaction
- Refund transaction
- Manual discount > 10 % (configurable)
- Price override during POS
- Open cash drawer outside of a sale
- Cash drop / pickup > 1 M (configurable)
- Settle (tutup kasir) — re-confirm own password
- Deposit withdrawal
- Mutation outbound (sender outlet)
- Final opname (changes COGS)
- Marking attendance for someone else

## §5 Mobile app considerations

- After login, the app should prefetch the user's privilege list and cache it.
- Render the bottom nav / drawer dynamically — hide menus where `canView == false`.
- Use Compose `LocalRolePermissions provides currentPermissions` to gate buttons in detail screens.
- On `403` from API, show "Anda tidak memiliki akses ke fitur ini" — prevents UI desync.
- Re-fetch permissions after subscription change (tier may unlock/lock menus).
