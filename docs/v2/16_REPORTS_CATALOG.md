# 16 · Reports Catalog

> Every report's filter, columns, aggregation, export. Single most-used feature for owners.

## §1 Filter conventions

All reports share this filter UX:

| Filter | Default | Notes |
|---|---|---|
| Periode (from / to) | Today | Quick chips: Today, Yesterday, This Week, Last Week, This Month, Last Month, Custom |
| Outlet | Active outlet | "Semua Outlet" if user has multi-outlet access |
| Order Type | All | Quick filter for POS-related reports |
| Cashier | All | List of cashiers in scope |
| Channel | All | POS / Online / KDS |
| Product / Category | All (search) | For product reports |
| Customer | All (search) | For customer reports |
| Group by | (per report) | e.g. day/week/month for trend reports |

Max date range: 90 days (configurable). Beyond that: paginate.

## §2 Sales Summary (Ringkasan Penjualan)

`GET /api/laporan/ringkasan-penjualan?from=&to=&outlet=`

Top stats (cards):
- Pendapatan kotor (gross revenue)
- Diskon (total discount)
- Pajak (total tax)
- Service charge
- Pendapatan bersih (net revenue)
- Jumlah transaksi (transaction count)
- Rata-rata per transaksi (avg ticket)
- Item terjual (item count)
- Pelanggan unik (unique customers)

Charts:
- Daily trend line (revenue over time)
- Hour-of-day distribution (heat map)
- Top 5 products bar chart
- Order type pie chart

Action: tap card → drill into detail.

## §3 Sales Detail (Detil Penjualan)

`GET /api/laporan/detail-penjualan?from=&to=&outlet=`

Table per transaction:
- Tanggal
- No. Trx
- Outlet
- Kasir
- Order Type
- Subtotal
- Diskon
- Pajak
- Service
- Total
- Status (PAID/VOIDED/REFUNDED)

Tap row → opens transaction detail (items + payments).

Export: CSV, PDF.

## §4 Sales by Outlet

`GET /api/laporan/penjualan-outlet?from=&to=`

Per outlet:
- Trx count
- Revenue
- Items sold
- Avg ticket
- Margin (if COGS computed)

Bar chart comparing outlets.

## §5 Sales Daily

`GET /api/laporan/penjualan-harian?from=&to=&outlet=`

Per day:
- Date
- Trx count
- Revenue
- Discount given
- Tax collected
- Net

Daily chart. CSV export.

## §6 Sales by Category

`GET /api/laporan/penjualan-kategori?from=&to=&outlet=`

Per category:
- Items sold
- Revenue
- Margin

Pie chart.

## §7 Sales by Department

`[Prime]` `GET /api/laporan/penjualan-departemen?from=&to=&outlet=`

## §8 Sales by Product

`GET /api/laporan/penjualan-produk?from=&to=&outlet=`

Per product:
- Qty sold
- Revenue
- Margin
- Avg price (after discount)

Sortable. Top 100 default.

## §9 Sales by Variant / Sub-variant

`[Advance+]` Each option qty + revenue.

## §10 Sales by Cashier

`GET /api/laporan/penjualan-kasir?from=&to=&outlet=`

Per cashier:
- Shifts opened/closed
- Trx count
- Revenue
- Cash variance (sum of variances per shift)
- Avg ticket
- Productivity (trx per hour)

Useful for incentive / commission compute.

## §11 Sales by Terminal

`[Advance+]` For multi-terminal outlets, per terminal id.

## §12 Cash Drawer (Kas Kasir)

`GET /api/laporan/kas-kasir?from=&to=&outlet=`

Per shift:
- Cashier
- Open time
- Close time
- Opening cash
- Sales cash
- Cash drops
- Cash pickups
- Closing expected
- Closing counted
- Variance

Variance > Rp 10.000 highlighted.

## §13 Payment Methods

`GET /api/laporan/jenis-bayar?from=&to=&outlet=`

Per method:
- Trx count
- Gross amount
- MDR
- Net amount

Pie chart.

## §14 Order Types

`[Advance+]` Per type (QS, Dine-In, Takeaway, Delivery, Online, etc.)

## §15 Service Reports

`[Advance+]` Per service product (jasa).

## §16 Reservation

`[Advance+]` `GET /api/laporan/reservasi?from=&to=&outlet=`

- Trx count
- Confirmation rate
- No-show rate
- Avg party size

## §17 Void

`GET /api/laporan/void?from=&to=&outlet=`

Per voided trx:
- Trx no, original total
- Reason
- Voided by
- Voided at
- Manager who approved

Total void count + value.

## §18 Refund

`GET /api/laporan/refund?from=&to=&outlet=`

Same as void but for partial / full refunds.

## §19 Promo

`[Advance+]` `GET /api/laporan/promo?from=&to=`

Per promo:
- Times used
- Total discount given
- Top customers
- Avg basket size when applied

## §20 Loyalty Points (Poin)

`[Advance+]` `GET /api/laporan/poin?from=&to=`

- Total earned
- Total redeemed
- Total expired
- Net balance change
- Top earners

## §21 Coupon (Kupon)

`[Prime]`

Per coupon:
- Generated count
- Redeemed count
- Expired count
- Total value redeemed

## §22 Complimentary (Komplimen)

`[Advance+]`

Per cashier / per category:
- Items given
- Total value
- Reasons distribution

## §23 Tax (Pajak)

`GET /api/laporan/pajak?from=&to=&outlet=`

Per tax rate:
- Tax base
- Tax amount
- Trx count

For e-Faktur monthly filing.

## §24 Customer (Pelanggan)

`[Advance+]` `GET /api/laporan/pelanggan?from=&to=`

- Total customers (active in period)
- New customers (first trx in period)
- Returning customers
- Avg spend per customer
- Top spenders
- Frequency distribution (1x, 2-5x, 6-10x, 10+)

## §25 Customer Satisfaction

`[Prime]` Tracking from feedback collection (post-transaction NPS).

## §26 Shift Close (Tutup Kasir)

`GET /api/laporan/tutup-kasir?from=&to=&outlet=`

Per closed shift: same as Kas Kasir but with all financial breakdowns.

## §27 Inventory Reports

### Stock current

`GET /api/v1/stock?outlet=`

- SKU, name, qty, unit, avg cost, value, low-stock flag

### Stock movement log

`GET /api/v1/stock-movement?from=&to=&outlet=`

All movements within range.

### Stock turnover

`[Advance+]` Per product:
- Avg stock
- Sales count
- Turnover ratio (sales / avg stock)

Identifies slow movers / fast movers.

### Stock value

Per outlet: total stock value (sum qty × avg_cost).

## §28 Financial Reports

### Neraca (Balance Sheet)

`[Advance+]` `GET /api/laporan/keuangan/neraca?as_of=`

- Assets (Aktiva)
- Liabilities (Kewajiban)
- Equity (Modal)

### Laba Rugi (P&L)

`[Advance+]` `GET /api/laporan/keuangan/laba-rugi?from=&to=`

- Revenue
- COGS
- Gross profit
- Expenses (operating)
- Net profit

### Arus Kas (Cash Flow)

`[Advance+]` `GET /api/laporan/keuangan/arus-kas?from=&to=`

- Operating cash flows
- Investing cash flows
- Financing cash flows

### Buku Besar (General Ledger)

`[Advance+]` `GET /api/laporan/keuangan/buku-besar/:account_id?from=&to=`

All journal entries to a specific account.

### Hutang / Piutang (Payable / Receivable)

`[Advance+]`

- Outstanding receivables (per customer with invoices)
- Outstanding payables (per supplier with PO)
- Aging buckets (0-30 / 31-60 / 61-90 / >90 days)

## §29 Employee Reports

### Attendance (Absensi)

`[Advance+]` `GET /api/laporan/karyawan/absensi?from=&to=`

Per employee per day:
- Check-in / out times
- Hours worked
- Late count
- Absent count

### Shift

`[Advance+]` Cashier-shift counts.

### Commission

`[Advance+]` Per employee:
- Commission earned
- Commission paid
- Outstanding

## §30 Marketing Reports

### Campaign

`[Advance+]` Per campaign:
- Sent / delivered / read counts
- Conversion (recipients who purchased after)
- Cost (per-message / per-channel)

## §31 Owner App reports

The Owner Android app is a slimmed-down version focused on top-level reports + read-only access. Same endpoints, different UI.

## §32 Daily Email Digest

`[Advance+]` Each day at 23:55, server emails owner the daily Sales Summary as PDF.

Customizable: which reports, which outlets, which recipients.

## §33 Export formats

| Format | Use |
|---|---|
| PDF | Print-friendly, archival |
| CSV | Excel import, accounting |
| Excel (xlsx) | Same as CSV but with formatting |
| JSON | Developer / integration |

Export endpoint per report: `?format=pdf|csv|xlsx|json`.

Large exports run async:
1. POST request → returns job_id
2. GET status → completed → download URL
3. Email notification when done (optional)

## §34 Drill-down

Most reports support drill-down: tap a row → opens the detail view (e.g. tap a product in "Sales by Product" → opens Product Detail with sales history).

## §35 Charts

Use a Compose-friendly chart library:
- `Vico` (com.patrykandpatrick.vico)
- `MPAndroidChart` (older but mature)

Recommended: Vico (Compose-native, lightweight).

## §36 Test plan

- Each report renders with default filter (today).
- Each filter combination produces correct aggregate.
- Multi-outlet user: "All outlets" works.
- Date range > 90 days → blocked or paginated.
- Empty period: "Belum ada data."
- Export PDF: opens in viewer.
- Export CSV: opens in Excel.
- Drill-down: tap → detail.
- Async export: poll until complete; download.
- Permission gating: STAFF can't see Buku Besar.
- Daily email digest: arrives at 23:55 to owner email.
