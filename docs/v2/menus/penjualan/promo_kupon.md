# Promosi — 8 Sub-Screens (Promo, Kupon, Poin Reward)

> See `13_PROMO_AND_LOYALTY.md` for the engine model. This doc covers the per-screen UI.

## §1 Promo / Basic Promo

URL: `promo/basic`

The simplest promo type — flat % or nominal off whole cart, with conditions.

Form fields:
- `name` (required, max 100)
- `code` (optional — if set, only redeems via coupon code)
- `discount_type` (PERCENT / NOMINAL)
- `discount_value`
- `max_discount` (cap; only for PERCENT)
- `valid_from`, `valid_until` (date+time)
- `day_of_week_mask` (multi-select Mon-Sun)
- `time_of_day_start`, `time_of_day_end`
- `outlet_ids` (multi-select; default all)
- `order_type_ids` (multi-select; default all)
- `customer_group_ids` (multi-select; default all = public)
- `min_purchase`
- `max_use_per_customer` (default unlimited)
- `max_total_use` (cap)
- `is_stackable` (boolean)
- `is_active`

UI: 5-tab wizard (Info, Schedule, Outlets, Customer Group, Limits).

API: `GET/POST/PUT/DELETE /api/v1/promo`.

## §2 Promo / Per Total Pembelian

URL: `promo/per-total`

Conditional on minimum total purchase.

Same as Basic Promo but `min_purchase` is required and is the trigger.

Common pattern: "Belanja Rp 100k diskon 10%, max Rp 20k".

## §3 Promo / Per Produk

URL: `promo/per-produk`

Conditional on specific product purchase.

Additional fields:
- `target_product_ids` (multi-select)
- `qty_required` (min qty of the products)
- `discount_target` — `WHOLE_CART` / `TARGET_PRODUCTS` / `CHEAPEST_OF_TARGET` / `MOST_EXPENSIVE_OF_TARGET`

Patterns:
- "Beli ayam goreng diskon 5k" → discount_target = TARGET_PRODUCTS
- "Beli 3 ayam goreng, gratis 1 (cheapest)" → buy_x_get_y semantics, discount_target = CHEAPEST_OF_TARGET, qty_required = 3, give_qty = 1

## §4 Kupon / Tambah Kupon

URL: `kupon/tambah`

Generate coupon codes.

UI:
- Pick base promo (from §1/§2/§3)
- Generation method: SINGLE_CODE (one fixed code) / BULK_GENERATE (N random codes)
- For bulk: count, prefix, length
- One-time use vs N-time use per code
- Validity dates (overrides base promo if shorter)
- Generate → server creates Coupon rows

After generate:
- Download CSV of codes (for distribution by email/print)
- Print as label

## §5 Kupon / Daftar Kupon

URL: `kupon/daftar`

List of generated coupon batches.

Columns: Code (or batch name), Promo, Generated count, Used count, Remaining, Status (Active/Expired).

Tap row → see individual codes + usage logs.

Bulk action:
- Deactivate batch
- Extend validity
- Export remaining codes

## §6 Poin Reward / Per Total Pembelian

URL: `poin/per-total`

Earn points based on total spend.

Fields:
- `name`
- `earn_rate` — points per Rp X (e.g. "1 point per 1.000 spent")
- `multiplier_per_group` — different rate per customer group
- `excluded_payment_methods` (e.g. no points for deposit-paid)
- `excluded_categories`
- `valid_from / until`
- `is_active`

## §7 Poin Reward / Per Produk

URL: `poin/per-produk`

Bonus points for specific products.

Fields:
- Target products
- Bonus points (flat or multiplier)
- Schedule

## §8 Poin Reward / Pengaturan Penukaran

URL: `poin/penukaran`

Redemption rate.

Fields:
- `redemption_rate` — N points = Rp X
- `min_redeem_per_transaction`
- `max_redeem_per_transaction`
- `max_redeem_per_day_per_customer`
- `points_expire_after_months`
- `redemption_block` — must redeem in multiples of N points
- `is_active`

E.g. "100 poin = Rp 5.000 diskon, min 100 poin, max 1.000 poin per transaksi, expire 12 bulan".

## Mobile considerations

- Promo master is offline-cached (POS evaluates locally).
- Coupon validation:
  - Online: server checks usage count (most accurate).
  - Offline: cached batch with remaining count; client decrements optimistically; server reconciles on sync.
- Bulk generate is online-only (server creates).
- Active promos shown in cart automatically; cashier doesn't need to "apply" each.
- Manual coupon code entry: large keypad (numeric or alphanumeric).
- QR scan for coupon codes (camera or external scanner).

## Common patterns

| Pattern | Type | Config |
|---|---|---|
| Member Discount 10% | Per-total | customer_group VIP, discount 10% |
| Welcome Voucher Rp 25k | Coupon | nominal 25k, max use 1 per customer |
| Buy 1 Get 1 (same product) | Per-produk | target [X], qty 2, discount CHEAPEST_OF_TARGET 100% |
| Buy 2 Get 1 free | Per-produk | target [X], qty 3, discount CHEAPEST_OF_TARGET 100% |
| Happy Hour 20% | Per-total | time 14:00-17:00, discount 20% |
| Lunch Combo Rp 50k off | Per-produk | target [Combo*], qty 1, discount nominal 50k |
| First Order 50% off | Per-total | customer.is_first_order, discount 50% (server-side condition) |
| Birthday Discount | Per-total | customer.birth_month == current_month, discount 30% |

## Open questions

- Does Majoo support `customer.is_first_order` and `customer.birth_month` as promo conditions natively, or are they merchant-custom? `[unknown]`
- Bulk coupon generation max count per call? `[unknown]`
- Coupon code character set restrictions? `[unknown]` (assume alphanumeric, uppercase, no `0/O/1/I/L`)
