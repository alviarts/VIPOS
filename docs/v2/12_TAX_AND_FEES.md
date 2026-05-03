# 12 · Tax, Service Charge, Rounding, Complimentary

> Easy to mis-implement. This doc nails the math.

## §1 Tax fundamentals

Indonesia uses two common indirect taxes for F&B/retail:

| Tax | Rate | Note |
|---|:-:|---|
| **PPN** (Pajak Pertambahan Nilai) | 11 % (12 % from 2025 for some categories) | National VAT. PKP (Pengusaha Kena Pajak) merchants must charge. |
| **Pajak Daerah / PB1** (Pajak Restoran) | up to 10 % | F&B specific, varies by region. |
| Service charge | 5-10 % typical | Optional. Can be subject to PPN. |

A merchant may charge PPN only, PB1 only, both (rare), or neither (small UMKM).

## §2 Inclusive vs exclusive

### Tax-exclusive (PPN added on top)

Item price `25.000` displayed.
At checkout, +11 % tax = `27.750`.
Common for retail / B2B.

### Tax-inclusive (PPN already included)

Item price `25.000` displayed (already includes PPN).
At checkout, breakdown shows the embedded tax: `Subtotal 22.523 + PPN 11% 2.477 = 25.000`.
Common for F&B retail.

### Settings

Per-outlet flag: `tax_inclusive` (boolean).
Per-product override: optional flag to exclude an item from tax even if outlet is taxed.
Per-tax override: a product can have a custom `tax_id` instead of the outlet default.

## §3 Math (exact)

Use `BigDecimal`, never `Float/Double`.

### Exclusive
```
subtotal       = sum(item.price * item.qty)
discountAmount = computed promo
taxableBase    = subtotal - discountAmount
taxAmount      = round(taxableBase * taxRate, scale=0)
serviceCharge  = round(taxableBase * scRate, scale=0)
total          = taxableBase + taxAmount + serviceCharge
total          = applyRounding(total)
```

### Inclusive
```
subtotal_with_tax = sum(item.price * item.qty)
embeddedTax       = round(subtotal_with_tax * taxRate / (1 + taxRate), scale=0)
subtotal_excl     = subtotal_with_tax - embeddedTax
discountAmount    = computed promo  // applied to inclusive price
discountTaxAdj    = round(discountAmount * taxRate / (1 + taxRate), scale=0)
serviceBase       = subtotal_excl - (discountAmount - discountTaxAdj)
serviceCharge     = round(serviceBase * scRate, scale=0)
serviceTax        = round(serviceCharge * taxRate, scale=0)  // service is taxable
total             = subtotal_with_tax - discountAmount + serviceCharge + serviceTax
total             = applyRounding(total)
```

> Note: when a discount is applied to a tax-inclusive line, both the price and the embedded tax decrease proportionally. Show the embedded-tax breakdown on the receipt.

## §4 Rounding

| Rule | Effect | Example |
|---|---|---|
| `NONE` | No rounding | 71.247 → 71.247 (impractical) |
| `ROUND_NEAREST_100` | Round to 100 | 71.247 → 71.200; 71.250 → 71.300 |
| `FLOOR_100` | Round down to 100 | 71.247 → 71.200 |
| `CEIL_100` | Round up to 100 | 71.247 → 71.300 |
| `ROUND_NEAREST_500` | To 500 | 71.247 → 71.000; 71.500 → 71.500 |
| `FLOOR_500` | Down to 500 | 71.247 → 71.000 |

Most Indonesian merchants use `FLOOR_100` (kasir-friendly because they don't have small denominations under Rp 100). Configurable per outlet.

The rounding amount (positive or negative) appears as a separate line on the receipt:
```
Subtotal       66.000
Discount       -5.000
PPN 11%         6.710
Service 5%      3.050
Pembulatan      0.240         ← rounding adjustment
TOTAL          71.000
```

## §5 Service charge

- Applied to `subtotal - discount` (or `subtotal_excl - discount` for inclusive).
- Optional flag per outlet, per order type, per product.
- Service charge IS subject to PPN if the merchant is PKP.
- Often shown to encourage tipping ("tip is included via service").

## §6 Multi-tax stacking

Some outlets charge **PPN + PB1**. The order matters:

Method A: tax-on-tax
```
taxableBase = subtotal - discount
PB1         = taxableBase * 10%
PPN         = (taxableBase + PB1) * 11%
total       = taxableBase + PB1 + PPN
```

Method B: separate stack
```
taxableBase = subtotal - discount
PB1         = taxableBase * 10%
PPN         = taxableBase * 11%
total       = taxableBase + PB1 + PPN
```

Indonesia legally uses Method B (taxes are independent on the same base). But some POS systems do Method A. Configure per outlet `tax_method` = `STACK` (B, default) or `CASCADE` (A).

## §7 Per-product tax overrides

A product can have:
- Default outlet tax (no override)
- Explicit tax id (e.g. an alcoholic drink with luxury tax)
- Tax-exempt flag (e.g. a freebie)

When mixed in one cart:
```
items:
  - apple ($1, taxed at 11%)
  - book ($2, tax-exempt)
  - wine ($5, taxed at 25%)

taxableSlices:
  11%: apple ($1)         → tax 0.11
  25%: wine ($5)          → tax 1.25
  exempt: book            → 0
total tax = 0.11 + 1.25 = 1.36
```

Receipt should show breakdown by tax rate.

## §8 Complimentary (komplimen)

Free items (e.g. free dessert for a complaining customer).

Approach A: 0-priced item
- Item with `unitPrice = 0` and flag `isComplimentary = true`.
- Excluded from tax base (configurable).
- Shown as "Komplimen" on receipt.

Approach B: 100% discount on the line
- Same effect, but discount logic shows the value.

VIPOS recommendation: Approach A for clarity.

Auditability:
- Compulsory note (reason).
- Manager PIN required to add complimentary item.
- Line shows in audit log.
- Daily Komplimen Report shows total complimentary value.

## §9 Open price products / nego

Some items have no fixed price (e.g. "Catering paket" priced ad-hoc). On POS:
- Cashier enters price manually.
- Manager PIN required if price < HPP.
- Tax rate still applies based on the entered price.

## §10 Discount types interplay

| Discount | Application | Tax base |
|---|---|---|
| Per-line discount | Reduce line subtotal | Reduces taxable base |
| Per-cart discount (nominal) | Allocate proportionally to lines | Reduces taxable base |
| Promo (auto-applied) | Apply per promo rules | Reduces taxable base |
| Coupon | Apply once | Reduces taxable base |
| Voucher (deposit) | Treated as payment, not discount | No effect on tax base |
| Loyalty point redeem | Treated as payment | No effect on tax base |

> Distinction: **discount reduces total before tax**; **payment reduces total after tax**. Different math.

## §11 Worked example — full receipt

Cart:
- Nasi Goreng Spesial × 2 @ 25.000 (tax-inclusive 11%)
- Es Teh Manis × 2 @ 8.000 (tax-inclusive 11%)
- Promo "HappyHour" 10% off subtotal

Outlet: tax-inclusive 11%, service charge 5%, rounding FLOOR_100.

```
Line subtotal:
  Nasi Goreng: 50.000
  Es Teh:      16.000
  Total:       66.000  (gross with tax)

Embedded tax (66.000 / 1.11 = 59.459 → tax 6.541):
  subtotal_excl = 59.459
  embeddedTax   = 6.541

Discount 10% on inclusive: 6.600
  discountTaxAdj    = 6.600 * 0.11 / 1.11 = 654
  discount_excl     = 5.946

Adjusted subtotal_excl: 59.459 - 5.946 = 53.513
Adjusted embeddedTax:   6.541 - 654 = 5.887

Service charge 5% on adjusted_excl: 53.513 * 0.05 = 2.676
Service tax 11%: 2.676 * 0.11 = 294
Service-inclusive: 2.970

total_pretax   = 53.513 + 2.676 = 56.189
total_with_tax = 53.513 + 5.887 + 2.676 + 294 = 62.370

Rounding FLOOR_100: 62.370 → 62.300 (rounding -70)

FINAL TOTAL: 62.300
```

Receipt shows:
```
Subtotal              66.000
Diskon HappyHour      -6.600
PPN 11%                5.887  *embedded
Service 5%             2.676
Pajak Service 11%        294
Pembulatan               -70
TOTAL                 62.300
```

## §12 Settlement & payment matching

Total `62.300` must match the sum of payments:
```
Cash       70.000
Change     -7.700
Net paid   62.300
```

Or partial payments:
```
QRIS       50.000
Cash       12.300
Total      62.300
```

App enforces `sum(payments) - change == total`.

## §13 Tax reports

The app should expose a Pajak Report:
- Period: from / to
- Group by tax rate (e.g. PPN 11%, PB1 10%)
- Per row: tax base, tax amount, transaction count
- Export to PDF / CSV for monthly e-Faktur filing

## §14 PKP / Non-PKP

If merchant is non-PKP (small UMKM under 4.8 B IDR/yr revenue):
- Disable PPN tax entirely
- Receipt shouldn't show PPN line
- May still charge PB1 (regional)

Toggle: `merchant.is_pkp` boolean.

## §15 Edge cases to test

- Tax-inclusive item + per-line nominal discount
- Tax-exclusive item + per-cart percentage discount
- Mixed tax rates in one cart
- Complimentary item (excluded from tax)
- 100% discount → 0 total
- Discount > subtotal (clamp to subtotal)
- Service charge but no tax
- Tax but no service charge
- Rounding nudges total down so payment cash overshoots → change is correct
- Payment in foreign currency (multi-currency, very rare in Indonesia POS — skip for v1)
