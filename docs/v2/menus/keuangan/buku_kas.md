# Buku Kas — Cash & Bank Book

## §1 Daftar Buku Kas & Bank

URL: `buku-kas/daftar-buku-kas`

List of cash + bank accounts (each is a node in CoA, asset class).

Columns:
- Account name (e.g. "Kas Kasir Outlet A", "BCA 5345-XXXX")
- Type: CASH / BANK / E_WALLET / CREDIT_CARD
- Current balance
- Last activity

Add account form:
- Name
- Type
- Bank name (if BANK)
- Account number (if BANK)
- Account holder
- Currency (default IDR)
- Initial balance + date
- Linked outlet (optional, for cash drawer accounts)
- CoA mapping (auto-suggested)

## §2 Daftar Transfer

URL: `buku-kas/daftar-transfer`

Transfers between own accounts (e.g. cash to bank, bank to bank).

Add transfer form:
- From account
- To account
- Amount
- Date
- Bank fee (optional)
- Reference no
- Notes
- Attachment (transfer slip photo)

Posts journal:
- Dr To-account, Cr From-account
- Dr Bank fee expense (if any)

## §3 Per-account ledger

Tap account → see full transaction history:
- Date, ref, description, debit, credit, balance
- Filters: date range, type (sale, expense, transfer)
- Export CSV

## §4 Reconciliation

For bank accounts:
- Import bank statement (CSV)
- Match to recorded transactions
- Flag mismatches
- Auto-create journal for unmatched (e.g. bank charges, interest)

## §5 Mobile considerations

- View balances + recent activity.
- Add transfer offline (queue, sync).
- Cash drawer auto-posts on shift close.

## §6 API

- `GET/POST /api/v1/cash-account`
- `GET/POST /api/v1/cash-transfer`
- `GET /api/v1/cash-account/:id/ledger?from=&to=`

## §7 Open questions

- Multi-currency (e.g. USD account)? `[unknown]` likely Prime+ if at all.
- Open Banking integration (auto-fetch statements)? `[inferred]` not standard for SMEs in Indonesia.
