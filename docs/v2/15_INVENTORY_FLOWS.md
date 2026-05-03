# 15 · Inventory Flows

> Stock-in (PO+GR), stock-out (sales/waste/mutation), opname, production, COGS calc, batch/serial.

## §1 Stock concept

Each `(product_id, outlet_id)` pair has:
- `qty`: current quantity (BigDecimal — supports kg, liter)
- `unit`: base unit (pcs, kg, liter)
- `avg_cost`: running COGS average
- `low_stock_threshold`: reorder alert
- `updated_at`

Updates happen via `StockMovement` rows (append-only ledger).

## §2 Movement types

| Type | Direction | Effect |
|---|:-:|---|
| `IN` | + | New stock arrival |
| `OUT` | - | Generic out (legacy) |
| `OPNAME_ADJUST` | ± | Reconcile against physical count |
| `MUTATION_OUT` | - | Send to another outlet |
| `MUTATION_IN` | + | Receive from another outlet |
| `WASTE` | - | Damaged / expired |
| `PRODUCE_IN` | + | Produced from recipe (parent product up) |
| `PRODUCE_OUT` | - | Ingredient consumed for production |
| `SALE` | - | Triggered by transaction |
| `SALE_REVERSE` | + | Triggered by void / refund |

Each movement has:
- `ref_type` + `ref_id` linking to source document (PO, GR, Opname, Mutation, Waste, Production, Transaction)

## §3 Purchase Order (PO)

PO documents intent to buy from supplier.

UX flow:
1. Stock manager taps "Buat PO".
2. Selects supplier.
3. Adds items with qty + estimated cost.
4. Saves as DRAFT or sends as OPEN.
5. Optionally prints / emails PO to supplier.

Status flow: `DRAFT → OPEN → PARTIAL → RECEIVED → CLOSED` (or `CANCELLED`).

## §4 Goods Received (GR)

When supplier delivers, create GR against the PO.

UX flow:
1. From PO detail, tap "Penerimaan".
2. For each line, enter qty actually received (default = qty ordered).
3. Enter actual unit cost (may differ from PO).
4. For tier ≥ Prime+: enter batch number, expiry date, serial numbers.
5. Save → posts `IN` stock movement; updates PO status.
6. Optionally upload supplier invoice photo.

Cost averaging:
```
new_avg_cost = ((old_qty * old_avg_cost) + (received_qty * new_unit_cost)) / (old_qty + received_qty)
```

## §5 Stock Opname

Physical recount.

UX flow:
1. Tap "Opname".
2. App shows all products with current qty.
3. For each, enter counted qty (or scan barcode + qty).
4. App computes variance (count - expected).
5. Optionally upload evidence photo.
6. Save as DRAFT (can edit) or FINAL (locks; posts `OPNAME_ADJUST` movements).
7. Manager PIN required to FINAL.

Best practice: do opname during off-hours when no sales (otherwise variance is racy).

For multi-day opname: app freezes count during the period; new sales decrement against pre-opname qty until opname posts.

## §6 Mutation (inter-outlet)

`[Prime]` Send stock from outlet A to outlet B.

UX flow:
1. From outlet A, tap "Mutasi Stok".
2. Select destination outlet.
3. Add items + qty.
4. Save as DRAFT or send as IN_TRANSIT (posts `MUTATION_OUT` from A; doesn't yet add to B).
5. Optionally print delivery note.
6. When B receives, B confirms (with optional discrepancy note) → posts `MUTATION_IN` to B.

Discrepancy: B receives less than sent → flag for manager review.

## §7 Production (recipe)

`[Advance+]` For products with recipes (e.g. "Es Teh" recipe = 1 sachet teh + 1 cup ice + sugar).

UX flow:
1. Tap "Produksi Stok".
2. Select parent product (recipe).
3. Enter qty to produce.
4. App shows ingredient consumption preview.
5. If any ingredient has insufficient stock → block.
6. Save → posts `PRODUCE_IN` for parent + `PRODUCE_OUT` for each ingredient.

Cost: `parent.cost = sum(ingredient.qty * ingredient.avg_cost)`.

## §8 Waste

`[Advance+]` Damaged / expired stock.

UX flow:
1. Tap "Stok Terbuang".
2. Add items + qty + reason (`EXPIRED`, `DAMAGED`, `SHRINKAGE`, `OTHER`).
3. Optionally upload photo.
4. Manager PIN required.
5. Save → posts `WASTE` movements.

Daily / weekly waste report tracks shrinkage trends.

## §9 Sale-driven movements

Transactions automatically trigger `SALE` stock-out at settlement.

For products with recipes:
- `[Advance+]` Optionally cascade to ingredients (deduct ingredient stock based on recipe).
- Configurable per merchant.

For variants:
- Each variant option may have its own SKU + stock (Prime+).
- If not, all variant sales decrement the parent SKU.

## §10 Void / Refund reverses

Voiding or refunding a transaction reverses stock:
- Voided line items create `SALE_REVERSE` movements.
- For recipes (if cascading was on), also reverse ingredient consumption.

Be careful: if too much time has passed, consumption may have been "real" (e.g. a juice was actually made and is no longer in the bottle). Allow manager to confirm reversal vs treat-as-waste.

## §11 Batch + Serial

`[Prime+]` Some products require batch tracking (food, pharmacy) or serial tracking (electronics).

### Batch
- Each `IN` carries a batch number + expiry.
- FIFO sale: earliest expiry sold first.
- Expiry alerts: notify when batch expires in <7 days.
- Reports: stock by batch, expiry calendar.

### Serial number
- Each unit has a unique SN.
- On sale: scan/enter the SN of the unit sold.
- On waste: scan SN of damaged unit.
- On mutation: list SNs being mutated.
- Inventory shows `qty + list of SNs`.

## §12 Multi-unit (UoM)

Some products are bought in cases but sold in pieces.
- `dozen = 12 pcs`
- `box = 24 pcs`
- `kg = 1000 g`

Configure conversion ratio per product. PO/GR may be in `dozen`; sale is in `pcs`. App auto-converts.

For VIPOS v1, recommend single-unit per product (skip multi-unit). Add v2.

## §13 Wholesale price ladder

`[Advance+]` Some products have tiered pricing:
```
1-5 pcs:   Rp 25.000 each
6-11 pcs:  Rp 22.000 each
12+ pcs:   Rp 20.000 each
```

POS auto-picks the right tier based on cart qty.

## §14 Online vs offline price

`[Advance+]` Different price for marketplace vs in-store:
```
Offline price: Rp 25.000
Online price:  Rp 28.000  (covers MDR + delivery)
```

POS uses offline; marketplace sync uses online.

## §15 Stock alerts

- Low stock: qty ≤ threshold → alert (push notification, banner in product list).
- Out of stock: qty = 0 → product hidden from POS quick-add (configurable).
- Expiring: batch expires in 7 days → alert.

## §16 COGS reporting

`[Advance+]`
```
COGS = sum(SALE.qty * SALE.unit_cost)
where SALE.unit_cost = product's avg_cost at sale time
```

Margin = sales revenue - COGS.

Per-product / per-category / per-outlet reports.

## §17 Negative stock

By default: block sales when qty = 0 or would go negative.

Configurable: allow negative (for service products that don't track stock).

## §18 Stock by outlet

Critical: stock is per-outlet, not per-merchant. Same product across outlets has separate qty rows.

When a user switches outlet, stock view updates. Mutations are explicit moves.

## §19 Test plan

- PO + GR + auto-stock-in
- GR with discrepancy (received less than ordered)
- GR creates correct avg_cost
- Opname draft → save → reopen → finalize → adjusts stock
- Opname with photo evidence
- Opname variance > X% requires manager approval
- Mutation A→B: A shows -, B shows + after both confirm
- Mutation in transit: B hasn't received → A's stock decremented but B not yet incremented
- Production: parent up, ingredients down
- Production: insufficient ingredient → blocked
- Waste: requires manager PIN
- Sale → SALE movement → stock down
- Void → SALE_REVERSE → stock back up
- Refund partial: only refunded items reversed
- Recipe cascade: sale of recipe parent decrements ingredients
- Variant SKU: sale of variant decrements variant SKU
- Batch FIFO: oldest expiry sold first
- Serial: sale requires SN entry
- Low stock alert fires on threshold cross
- Negative stock blocked by default
- Multi-outlet: stock isolated per outlet
