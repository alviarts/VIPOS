# Pengeluaran (Expenses)

## §1 Daftar Pengeluaran

URL: `pengeluaran/daftar-pengeluaran`

All outflows (operational expenses).

Add form:
- Date
- Vendor (FK to mitra) — see §4
- Category (FK to "Daftar Biaya" — see §2)
- Amount
- Tax (PPh23 / PPN if applicable)
- Account debited (which cash/bank)
- Description
- Attachment (receipt photo)
- Recurring? (checkbox)

Posts journal:
- Dr Expense (per category), Cr Cash/Bank
- Dr/Cr tax accounts as applicable

## §2 Daftar Biaya

URL: `pengeluaran/daftar-biaya`

Expense categories (sub-set of CoA 5xxx).

Examples:
- Beban Sewa
- Beban Listrik & Air
- Beban Internet
- Beban Marketing
- Beban Perlengkapan
- Beban Transport
- Beban Komunikasi

Custom categories can be added.

## §3 Daftar Tagihan Rutin

URL: `pengeluaran/daftar-tagihan-rutin`

Recurring bills (set up auto-create monthly):
- Rent
- Utilities
- Subscriptions

Fields:
- Vendor
- Amount (fixed or variable)
- Frequency (monthly/quarterly/annually)
- Due day (e.g. 5th of month)
- Auto-create? (creates draft expense each cycle)

## §4 Daftar Mitra (Vendors)

URL: `pengeluaran/mitra`

Vendor master.

Fields:
- Name
- NPWP (for tax reporting)
- Address
- Phone, email
- Bank account (for payment)
- Default expense category
- Default payment terms (NET 0/30/60)

## §5 Rekonsiliasi Refund Penjualan

URL: `pengeluaran/sales-refund-reconcile`

Reconcile refunds against bank refund-to-customer transfers.

Similar UI to income reconciliation but inverse.

## §6 Mobile considerations

- Add expense on-the-go (e.g. cashier buys cleaning supplies):
  - Quick form: Date (today), category, amount, vendor (or "Cash purchase"), photo of receipt.
  - Submit → posts as expense.
  - Approver gets push notification.
- Photo OCR (extract amount + vendor from receipt) — `[Prime+]` feature; future enhancement.

## §7 API

- `GET/POST /api/v1/expense`
- `GET/POST /api/v1/expense-category`
- `GET/POST /api/v1/recurring-bill`
- `GET/POST /api/v1/vendor`
- `POST /api/v1/recurring-bill/run` (manual trigger)

## §8 Open questions

- PPh21 final-tax payments to government: separate workflow? `[unknown]`
- e-Faktur PPN input upload? `[unknown]`
