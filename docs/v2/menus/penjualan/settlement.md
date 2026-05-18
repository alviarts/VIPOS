# Settlement Reports — QRIS + Order Online

> Reconcile electronic payments against bank/marketplace settlements.

## §1 Laporan Settlement / QRIS

URL: `laporan/settlement/qris`

Tracks QRIS transactions and their settlement to merchant bank.

Columns:
- Trx date
- Trx ref (gateway ref)
- Amount
- MDR (gateway fee)
- Net amount (Amount - MDR)
- Settlement date
- Settlement status: PENDING / SETTLED / FAILED / DISPUTED
- Bank account credited

Filter:
- Date range
- Status
- Outlet

Daily reconciliation:
- Total settled today
- Total pending
- Total disputed

## §2 Laporan Settlement / Order Online

URL: `laporan/settlement/order-online`

Tracks marketplace orders and settlement from marketplace platform.

Columns:
- Order date
- Marketplace (GoFood / GrabFood / ShopeeFood / etc)
- Order ref
- Gross amount
- Commission (marketplace fee, e.g. 20%)
- Promo subsidy (if marketplace funds the discount)
- Net amount
- Settlement date
- Status

Each marketplace settles on different schedules (daily/weekly).

## §3 API

- `GET /api/laporan/settlement/qris?from=&to=&outlet=`
- `GET /api/laporan/settlement/order-online?from=&to=&outlet=&marketplace=`

## §4 Mobile considerations

- Read-only reports.
- Owner App is primary surface.
- Cache last 30 days for offline reading.
- Drill-down to single transaction detail.

## §5 Open questions

- Do settlement reports auto-pull from gateway/marketplace, or require manual reconciliation? `[inferred]` likely auto-pull via webhooks/scheduled fetch.
- Disputes: how surfaced and resolved? `[unknown]`
