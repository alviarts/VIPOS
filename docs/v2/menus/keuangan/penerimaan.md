# Penerimaan (Income)

> Manual income entries + reconciliation against POS sales.

## §1 Daftar Penerimaan

URL: `income/daftar-penerimaan`

Manual income outside of POS sales (e.g. consulting fee, rental, interest).

Add form:
- Date
- Source (FK to customer or "Other")
- Category (e.g. Sales / Service / Rental / Interest)
- Amount
- Account credited (which cash/bank)
- Tax (if applicable)
- Description
- Attachment (receipt scan)

Posts journal:
- Dr Cash/Bank, Cr Income (per category)

## §2 Rekonsiliasi Penerimaan Penjualan

URL: `income/reconciliation`

Reconcile POS sales against bank deposits.

UI:
- Period picker
- Left: POS sales totals (cash, EDC, QRIS, e-wallet) per day
- Right: bank statement entries
- Match by amount + date

Auto-match where amount + date align.
Manual override for unmatched.

Variance report.

## §3 Mobile considerations

- Manual income entry: rare on mobile, mostly office work.
- Rekonsiliasi: tablet, large screen needed.

## §4 API

- `GET/POST /api/v1/income`
- `GET /api/v1/income/reconciliation?from=&to=`
- `POST /api/v1/income/reconciliation/match`
