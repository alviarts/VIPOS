# 13 · Promo, Loyalty, Coupon, Voucher, Deposit

> Promo engine and loyalty system. The most-bug-prone area of any POS.

## §1 Promo types

| Type | Description | Indonesian label |
|---|---|---|
| `PERCENT` | n % off | "Diskon 10%" |
| `NOMINAL` | flat IDR off | "Diskon Rp 5.000" |
| `FREE_PRODUCT` | give away | "Gratis 1 Es Teh" |
| `BUY_X_GET_Y` | BOGO | "Beli 2 Gratis 1" |
| `BUNDLE_PRICE` | bundle price | "Paket A Rp 50.000" |
| `MIN_PURCHASE` | conditional | "Min belanja Rp 100k" |
| `STEP_DISCOUNT` | tiered | "Beli 5 dapat 10%" |
| `MEMBER_PRICE` | special price for member | "Harga member Rp 20.000" |

## §2 Conditions

Each promo can have:
- **Date range** — `validFrom`, `validUntil`
- **Day of week** — Mon-Sun mask
- **Time of day** — start/end (e.g. 10:00-14:00 for lunch)
- **Outlet scope** — specific outlets or all
- **Order type scope** — Dine In, Takeaway, Delivery, Online, etc
- **Customer group scope** — VIP only, Reseller only, public
- **Channel scope** — POS only, Online only, both
- **Min purchase** — IDR threshold
- **Max discount** — cap on saved amount
- **Max use per customer** — e.g. "1 use per customer per day"
- **Max total uses** — e.g. "First 100 customers"

## §3 Promo rule combinations (CONDITIONS × ACTIONS)

The promo engine evaluates: do the conditions match? → compute the action's discount.

### Example: "Buy 2 Get 1 free"
- Condition: cart contains qty≥3 of product X
- Action: lowest-priced of the 3 becomes free

### Example: "Spend 100k get 10k off"
- Condition: cart subtotal ≥ 100.000
- Action: -10.000 from total

### Example: "Member VIP 20%"
- Condition: customer in VIP group
- Action: 20% off on all items

### Example: "Happy Hour 10%"
- Condition: 14:00-17:00, dine-in only
- Action: 10% off subtotal

## §4 Stacking rules

Two promos applied to the same cart:
- **OR (mutually exclusive)** — pick the one with greatest discount.
- **AND (additive)** — sum both discounts.
- **CASCADE** — apply first promo's discount, then second on the reduced base.

VIPOS recommendation: default `OR (best discount wins)`. Allow per-promo flag `is_stackable` for explicit AND.

## §5 Ordering of promos

When multiple are applicable:
1. Member-group promo (always applies if member matches)
2. Coupon-coded promo (only if user enters code)
3. Auto-promo (e.g. happy hour) — best one wins
4. BOGO promo (applies per qualifying line)

Display all applicable promos in the cart so cashier can verify.

## §6 Coupon

Coupon = pre-generated code redeemed by customer.
- One-time-use or N-time-use codes
- Can be value-based (Rp 25.000 off) or percent-based (10%)
- Has expiry
- May be tied to a specific customer or generic

Server endpoint:
```
GET /api/v1/coupon/:code
→ { "valid": true, "type": "NOMINAL", "value": 25000, "expired_at": "...", "min_purchase": 100000 }
```

UX:
1. Cashier taps "Kupon".
2. Enters code (or scans QR).
3. App validates with server (offline: cache last 100 valid codes for 1-time use).
4. On valid: discount applied.
5. On invalid: "Kupon tidak valid".
6. On expired: "Kupon sudah kedaluwarsa".
7. On already-used: "Kupon sudah digunakan".

## §7 Loyalty points

Earn rules:
- `1 point per Rp 1.000 spent` (configurable)
- Multiplier per customer group
- Excluded items (e.g. cigarettes, alcohol)
- Excluded payment methods (e.g. no points on deposit-paid)

Redeem rules:
- `100 points = Rp 5.000 discount` (configurable)
- Min point balance to redeem
- Max points redeemable per transaction
- Cannot combine with certain promos (configurable)

Expiry:
- Points expire after N months (configurable, default 12).
- Earned-this-month points expire end of next year (configurable).
- Show expiring-soon notification 30 days before.

UX:
1. Cashier selects customer.
2. Customer's point balance shown in cart.
3. "Tukar Poin" button appears if balance ≥ min.
4. Cashier enters points to redeem (rounded to redemption block).
5. Discount amount calculated, applied as a `LOYALTY_REDEEM` line.

After paid:
- Earn entry: `+ X points` to customer's balance.
- Redeem entry: `- Y points` from balance.

## §8 Voucher / Deposit / Saldo

Distinct from promo & coupon: voucher is **money the merchant owes the customer** (e.g. customer pre-paid, or got a refund as voucher).

- Voucher / Deposit are stored as `Customer.depositBalance`.
- At payment, customer can pay using deposit:
  ```
  Total: 71.000
  Deposit: -50.000  (uses 50k from balance)
  Cash:   -21.000
  ```
- Tax base does NOT change when using deposit (tax already paid on the original deposit).

Server endpoint:
```
POST /api/v1/customer/:id/deposit/use
{ "amount": 50000, "transaction_id": 123 }
```

## §9 Auto-applied vs manual promos

- **Auto** — server-side or client-side rules engine evaluates on every cart change. No cashier action.
- **Manual** — cashier picks from a list of available promos.

UX:
- Auto promos show inline in cart.
- Manual promos require tap "Tambah Promo" → picker.

## §10 Stacking with discount line

The cashier may also enter:
- Per-line discount (free-form % or nominal)
- Per-cart discount (free-form)

These stack with auto-promos. Manager PIN if discount % > X (configurable).

## §11 Promo report

`GET /api/laporan/promo?from=&to=`
- Promo name
- Times used
- Total discount given
- Avg discount per use
- Top customers using it

## §12 Loyalty report

`GET /api/laporan/poin?from=&to=`
- Total earned
- Total redeemed
- Total expired
- Customer-level breakdown (top earners / redeemers)

## §13 Anti-abuse

- Velocity check: same customer redeeming same promo many times suspicious — flag for manager review.
- IP/device fingerprint for online promos.
- Coupon code rate limit: 5 attempts per minute per terminal.

## §14 Test plan

- Auto promo "Happy Hour 10%" — outside time window: not applied.
- Auto promo + coupon code stacking: respect `is_stackable`.
- Buy 2 Get 1: cart with 3 items of qualifying product — cheapest is free.
- Member price: cart with non-member customer — not applied.
- Loyalty redeem: balance < min → button disabled.
- Loyalty redeem: redeem 100 pt → 5k off → after payment, balance decreases.
- Coupon valid → apply → submit transaction → server confirms.
- Coupon offline: pre-cached → apply → on sync, server may reject (race condition where another device already used it) → show "Kupon sudah digunakan".
- Discount > subtotal: clamp to subtotal.
- Multi-promo: 2 stackable promos on same cart → both applied → math correct.
- Voucher pay: 50k voucher + cash 21k → total 71k → balance reduced 50k.
- Loyalty multiplier: VIP customer gets 2x points.
