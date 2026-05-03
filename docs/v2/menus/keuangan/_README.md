# KEUANGAN — Menu Group

> 32 menu items. Full accounting & finance: cash book, AR/AP, fixed assets, financial reports, chart of accounts.

`[Advance+]` for cash book + simple finance; `[Prime]` for full accounting (jurnal, neraca, laba-rugi, buku besar).

## Inventory

### Top-level
- Dashboard Keuangan (`sales-dashboard-keuangan`) → [`dashboard.md`](dashboard.md)

### Buku Kas
- Daftar Buku Kas & Bank (`buku-kas/daftar-buku-kas`)
- Daftar Transfer (`buku-kas/daftar-transfer`)

→ [`buku_kas.md`](buku_kas.md)

### Penerimaan
- Daftar Penerimaan (`income/daftar-penerimaan`)
- Rekonsiliasi Penerimaan Penjualan (`income/reconciliation`)

→ [`penerimaan.md`](penerimaan.md)

### Pengeluaran
- Daftar Pengeluaran (`pengeluaran/daftar-pengeluaran`)
- Daftar Biaya (`pengeluaran/daftar-biaya`)
- Daftar Tagihan Rutin (`pengeluaran/daftar-tagihan-rutin`)
- Daftar Mitra (`pengeluaran/mitra`) — vendor master
- Rekonsiliasi Refund Penjualan (`pengeluaran/sales-refund-reconcile`)

→ [`pengeluaran.md`](pengeluaran.md)

### Manajemen Aset
- Daftar Aset Tetap (`asset-management/fixed-assets`)
- Penyusutan Aset Tetap (`asset-management/depreciation-fixed-assets`)
- Pelepasan Aset Tetap (`asset-management/disposal-fixed-assets`)
- Laporan Aset Tetap (`asset-management/report-assets`)

→ [`aset_tetap.md`](aset_tetap.md)

### Laporan Keuangan
- Laporan Jurnal (`laporan-keuangan/accounting-jurnal`)
- Laporan Neraca (`laporan-keuangan/accounting-neraca`)
- Laporan Laba Rugi (`laporan-keuangan/accounting-rugi-laba`)
- Laporan Buku Besar (`laporan-keuangan/accounting-buku-besar`)
- Laporan Arus Kas (`laporan-keuangan/accounting-arus-kas`)
- Laporan Hutang (`laporan-keuangan/accounting-hutang`)
- Laporan Piutang (`laporan-keuangan/accounting-piutang`)

→ [`laporan_keuangan.md`](laporan_keuangan.md)

### Daftar Akun
- Daftar Akun (`akunting/account-list`) — chart of accounts
- Jurnal Umum (`jurnal-umum-penyesuaian`) — manual journal entries
- Saldo Awal (`saldo-awal`) — opening balance setup

→ [`chart_of_accounts.md`](chart_of_accounts.md)

## Concepts

### Chart of Accounts (CoA)

Standard Indonesian Pembukuan structure:
- 1xxx Aset (Assets)
- 2xxx Kewajiban (Liabilities)
- 3xxx Modal (Equity)
- 4xxx Pendapatan (Revenue)
- 5xxx Beban (Expenses)

Pre-seeded by Majoo, customizable per merchant.

### Auto-journal

Every business event posts a journal entry:
- Sale → Dr Cash/Bank, Cr Sales Revenue, Cr Tax Payable
- Purchase → Dr Inventory/Expense, Cr Cash/AP
- Payroll → Dr Payroll Expense, Cr Cash/AP

This is hidden from cashier; visible to accountant.

## Mobile considerations

- Owner App: full finance access.
- Cashier App: NO finance access (sensitive).
- Manager App: limited (cash book + own outlet's finance).
- Reports: read-only on phone, drill-down deep on tablet.
- Approvals: see `karyawan/approval_workflow.md`.
