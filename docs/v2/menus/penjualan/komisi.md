# Komisi — Commission Groups

URL: `komisi/grup`

`[Advance+]`

## Overview

Commission management for sales staff (e.g. waiters, beauticians, salesmen who get bonus per sale).

## Group types

- **Komisi Tetap (Fixed)** — flat amount per transaction (e.g. Rp 5.000 per booking).
- **Komisi Bertingkat (Tiered)** — varies by sales achievement.

## Fields per group

- `name`
- `type` (FIXED / TIERED)
- `applies_to` — All staff / Specific roles / Specific employees
- `applies_to_products` — All / Specific categories / Specific products
- `applies_to_outlets`

For FIXED:
- `amount` (per transaction or per item, configurable)

For TIERED:
- Tier table: { from, to, percentage }
  - e.g. 0-1M → 2%, 1M-5M → 3%, >5M → 5%
- Calculation period: per day / per week / per month

## API

- `GET /api/v1/komisi-grup`
- `POST /api/v1/komisi-grup`
- `PUT /api/v1/komisi-grup/:id`
- `DELETE /api/v1/komisi-grup/:id`

## Per-transaction tagging

When a transaction is recorded:
- Cashier may pick "Sales Staff" who served the customer (optional).
- Commission auto-computed at end of period.

## Reporting

See `16_REPORTS_CATALOG.md` §30 (Commission Report).

## Mobile considerations

- Sales staff selector at POS (optional field on cart).
- Employee app shows their accrued commission YTD.
- Commission calculation is server-side; app just displays.

## Open questions

- Does Majoo support team-level commission splits (multiple staff per transaction)? `[unknown]`
- Are commissions deducted before or after promo discount? `[unknown]` — recommend after-discount basis to align with merchant net revenue.
