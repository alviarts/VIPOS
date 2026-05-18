# Pembayaran Settings (Payment Settings)

## §1 Struk

URL: `payment-setting/receipt`

Receipt template config. See `11_RECEIPT_TEMPLATES.md` for full layout.

Fields:
- Header text (5 lines)
- Footer text (5 lines)
- Show: customer name, NPWP, bank account, QR digital receipt, tax breakdown, service charge, promo, loyalty earned
- Print copies (1/2/3)
- Auto-cut after print
- Auto-open drawer on cash payment
- Print kitchen ticket trigger (auto on order send / manual)
- Print checker ticket: which order types
- Width: 58 mm / 80 mm

Per-outlet override allowed.

## §2 Biaya (Charges)

URL: `payment-setting/receipt-and-charge`

Service charge config.

Fields:
- Enable service charge (boolean)
- Service charge type: PERCENT / NOMINAL
- Service charge value
- Subject to PPN (boolean — if PKP)
- Show as separate line on receipt (boolean)
- Per-outlet override

## §3 Pajak (Tax)

URL: `payment-setting/tax-setting`

Tax config. See `12_TAX_AND_FEES.md` for math.

Multiple taxes supported (e.g. PPN + PB1 in some regions).

Per tax:
- Name (e.g. "PPN", "PB1")
- Rate (%)
- Inclusive / exclusive
- Display label
- Account (CoA mapping)
- Active

PKP toggle: if non-PKP, hide PPN.

## §4 Pembayaran Non-Tunai (Non-cash payment methods)

URL: `payment-setting/non-cash`

Configure each non-cash payment method enabled at this merchant.

Per method:
- Name (e.g. "EDC BCA", "QRIS Statis", "GoPay", "OVO")
- Type (EDC / QRIS_STATIC / QRIS_DYNAMIC / E_WALLET / TRANSFER / DEPOSIT / VOUCHER / CUSTOM)
- Provider (BCA / Mandiri / etc)
- MDR % (informational)
- Settlement account (which bank account this settles to)
- Logo / icon
- Active

Custom methods: free-form (e.g. "Bank Transfer ke pemilik" for ad-hoc).

## §5 Satuan Barang (Units of measure)

URL: `satuan-barang`

Master list of UOM (pcs, kg, gram, liter, dozen, box, etc).

Per unit:
- Name
- Symbol
- Type (count, weight, volume, length)
- Conversion (e.g. dozen = 12 pcs)

Used in product master + inventory.

## §6 Mobile considerations

- Settings rarely changed; cache aggressively.
- Owner/Manager edit; cashier read-only.
- Tax change requires re-cache + invalidate active cart calculations (warn cashier).

## §7 API

- `GET/PUT /api/v1/setting/receipt`
- `GET/PUT /api/v1/setting/service-charge`
- `GET/POST/PUT/DELETE /api/v1/setting/tax`
- `GET/POST/PUT/DELETE /api/v1/setting/payment-method`
- `GET/POST/PUT/DELETE /api/v1/uom`
