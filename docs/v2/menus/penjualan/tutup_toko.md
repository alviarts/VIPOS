# Tutup Kasir & Tutup Toko

> End-of-day reconciliation flows.

## §1 Tutup Kasir (per shift)

URL: triggered from POS toolbar, plus reports at `laporan/penjualan/tutup-kasir`

Closes the active cashier shift.

### Pre-condition
- Active shift must exist (was opened via "Buka Kasir").

### Flow

1. Cashier taps "Tutup Kasir".
2. App displays opening cash + sales cash + cash drops + cash pickups → "Expected closing cash".
3. Cashier physically counts cash; enters counted amount.
4. App computes variance.
5. If variance > Rp 10.000 (configurable), require manager approval.
6. Save → posts shift close.
7. Print/email shift close report.

### Shift close report contents

- Shift open/close times
- Cashier name + terminal
- Opening cash
- Sales: total revenue, breakdown by payment method
- Cash drops (shift owner removed cash to safe)
- Cash pickups (shift owner added cash, e.g. from owner's pocket)
- Expected closing cash
- Counted closing cash
- Variance (positive or negative)
- Variance reason note (if any)
- Other payment totals (EDC, QRIS, deposit, etc) — not affecting cash but reported
- Promo + discount totals
- Tax totals
- Service charge totals
- Void count + value
- Refund count + value
- Top products
- Reservation completed count

### Mobile considerations

- The "expected cash" depends on real-time sales data, must be online (or sync first).
- If offline, cashier can save a "Tutup Kasir Sementara" (provisional) and finalize when online.
- Print report to thermal (compact format) and/or email to owner.

## §2 Tutup Toko (per outlet day)

URL: triggered by outlet manager; reports at `laporan/penjualan/tutup-toko`

End-of-day store close. Aggregates all shifts of the day.

### Flow

1. After last cashier closes shift, manager taps "Tutup Toko".
2. App reconciles all shifts:
   - Total sales
   - Total cash counted across shifts
   - Total non-cash (EDC, QRIS, e-wallet, deposit, etc)
   - Outstanding (unsettled) transactions
3. Manager confirms.
4. Save → posts store-close.
5. Print/email store-close report.

### Store-close report contents

(Superset of shift close report, aggregated)
- Date
- Outlet
- Total revenue
- Total tax collected
- Total service charge
- Total promo discount given
- Method breakdown
- Cash variance (sum across shifts)
- Top products / categories
- Top cashiers (productivity)

### Mobile considerations

- Manager App is the primary surface for Tutup Toko (more than cashier app).
- Daily email digest can substitute for manual close on slow days.

## §3 Open vs close discrepancies

If close was missed (e.g. internet down or human error):
- Next day's "Buka Kasir" warns "Shift sebelumnya belum ditutup".
- Manager can retroactively close yesterday's shift.

## §4 Permission

- Cashier: can close own shift only.
- Manager: can close any shift in their outlet.
- Owner: can close any across outlets.

## §5 API

- `POST /api/v1/shift/close`
- `POST /api/v1/store-close`
- `GET /api/laporan/penjualan/tutup-kasir`
- `GET /api/laporan/penjualan/tutup-toko`

## §6 Open questions

- Are there mandatory reasons for cash variance? `[inferred]` recommend yes.
- Is there a "petty cash reset" at store close (cash drawer opening cash for next day pre-set)? `[unknown]`
