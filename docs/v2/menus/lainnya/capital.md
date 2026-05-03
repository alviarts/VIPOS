# Capital (Majoo Capital)

URL: `layanan-pengembangan/kredit-usaha`

> Business loan facility for merchants. Underwriting based on POS transaction history.

`[Advance+]` (only available to merchants with 3+ months transaction history).

## §1 Pre-qualification

System checks:
- Merchant tenure (3+ months recommended)
- Avg monthly revenue (proxy for repayment capacity)
- Tax compliance (NPWP, SPT)
- Business legality (NIB)

Shows pre-approved limit (e.g. "Anda berhak mengajukan hingga Rp 50.000.000").

## §2 Application form

- Loan amount
- Purpose (working capital / equipment / expansion / etc)
- Tenure (3 / 6 / 12 / 18 / 24 months)
- Collateral (if any)
- Documents:
  - KTP scan
  - NPWP scan
  - Bank statement (last 3 months)
  - Business legal docs (NIB, SIUP, etc)
  - Tax filings (SPT)

Auto-pull from POS:
- Last 6 months sales summary
- Current outstanding (other loans, AP)

Submit → review.

## §3 Status flow

- SUBMITTED → REVIEW (1-3 days) → DISBURSED / REJECTED
- If approved: contract sent for e-signature; funds disbursed to merchant bank account.

## §4 Repayment

- Auto-debit from merchant bank account on schedule.
- Or auto-deduct from daily QRIS settlements (revenue-based).
- Status visible in app.

## §5 Mobile considerations

- Loan application is paperwork-heavy; tablet preferred.
- Camera scan for documents.
- e-signature on screen.
- Push notification on status updates.
- Repayment schedule view + early payment option.

## §6 API

- `GET /capital/api/v1/pre-qualification`
- `POST /capital/api/v1/application`
- `GET /capital/api/v1/application/:id/status`
- `GET /capital/api/v1/loan/:id/repayment-schedule`

## §7 Open questions

- Lender of record: Majoo's own balance sheet or partner banks/fintechs? `[unknown]`
- Interest rate range: `[unknown]` — typical Indonesian SME loans 1-3%/month flat rate.
- Default handling? `[unknown]`
