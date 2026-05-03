# Inventori — 19 Sub-Screens

> Stock management. Builds on `15_INVENTORY_FLOWS.md` foundation doc with screen-level details.

## §A Daftar Bahan Baku

URL: `inventori/bahan-baku`

Raw materials (used in recipes). Distinct from sellable products.

Fields:
- Name, SKU, unit
- Current stock per outlet
- Avg cost per unit
- Min stock threshold

UI: similar to product list but limited columns.

## §B Permintaan Barang

URL: `inventori/permintaan-barang`

Internal request from outlet to head office for restock.

Fields:
- Outlet (auto)
- Items + qty requested
- Notes
- Status: PENDING / APPROVED / REJECTED / FULFILLED

Workflow:
1. Outlet creates request.
2. Head office approves/rejects.
3. Approved → triggers PO to supplier or mutation from another outlet.

## §C Pemesanan Stok (PO)

URL: `inventori/po`

Standard Purchase Order. See foundation doc §3.

UI fields:
- PO number (auto)
- Supplier picker
- Order date, expected date
- Items list with qty + estimated cost
- Subtotal, tax, total
- Notes
- Attachment (supplier quote PDF)

Status flow: DRAFT → OPEN → PARTIAL → RECEIVED → CLOSED.

## §D Pengiriman Pembelian (GR)

URL: `inventori/gr`

Goods Received against an open PO. See foundation doc §4.

UI:
- Pick PO → load expected items.
- For each item: enter received qty + actual cost.
- Optional: batch number, expiry, serial numbers (Prime+).
- Save → posts stock movements.

Mobile: barcode scanning during receiving (faster than manual entry).

## §E Faktur Pembelian

URL: `inventori/faktur-pembelian`

Supplier invoice (separate from GR).

Fields:
- Supplier
- Invoice number, date, due date
- Items + amounts (may differ from GR for partial deliveries)
- Tax
- Total
- Status: OPEN / PAID

Auto-link to GR.

## §F Pembayaran Faktur

URL: `inventori/bayar-faktur`

Pay supplier invoice.

Fields:
- Invoice
- Payment date, amount
- Cash account (source)
- Ref number
- Notes

Reduces accounts payable.

## §G Retur Pembelian

URL: `inventori/retur`

Return defective goods to supplier.

Fields:
- Supplier
- Items + qty + reason (DEFECTIVE / WRONG_ITEM / EXPIRED / OTHER)
- Restock cost recovery (to be credit-note from supplier)

Posts negative stock movement.

## §H Rekonsiliasi Retur

URL: `inventori/rekon-retur`

Reconcile return against credit note from supplier.

UI: list returns with status (PENDING_CREDIT / RECONCILED).

## §I Daftar Stok

URL: `inventori/stok`

Per-outlet current stock view.

Columns:
- SKU, name, unit
- Current qty
- Avg cost
- Total value (qty × avg_cost)
- Low-stock flag
- Last movement date

Filters:
- Outlet
- Category
- Department
- Below threshold

Export: CSV.

## §J Stok Opname

URL: `inventori/opname`

Physical recount. See foundation doc §5.

UI:
- Create new opname.
- For each product: enter counted qty.
- Optional: photo evidence per line.
- Variance auto-computed.
- Save as DRAFT (resumable) or FINAL (locks; manager PIN).

Mobile-specific: barcode scanning for fast counting.

## §K Stok Terbuang (Waste)

URL: `inventori/waste`

Record discarded stock.

Fields:
- Outlet
- Items + qty + reason (EXPIRED / DAMAGED / SHRINKAGE / OTHER)
- Photo evidence
- Notes

Manager PIN required. See foundation doc §8.

## §L Daftar Produksi Stok

URL: `inventori/produksi`

Recipe-based production.

UI:
- "+ Produksi Baru" → pick parent product (must have recipe) → enter qty → preview ingredient consumption → save.

See foundation doc §7.

## §M Acuan Produksi Stok

URL: `inventori/produksi-acuan`

Master list of production recipes (separate from product master). Allows defining production-only items.

## §N Mutasi / Permintaan Stok

URL: `mutasi/permintaan`

Outlet A requests stock from Outlet B (or warehouse).

Fields:
- From (auto), To (warehouse / another outlet), Items, Notes.

## §O Mutasi / Stok Harus Dikirim

URL: `mutasi/dikirim`

Outgoing mutation queue (after request approved).

UI: list of approved mutations awaiting send. Tap → "Kirim".

## §P Mutasi / Kirim Stok

URL: `mutasi/kirim`

Active sending screen.

UI:
- Pick destination outlet
- Add items + qty
- Print delivery note
- Submit → posts MUTATION_OUT stock movement; B not yet incremented (in-transit).

## §Q Mutasi / Terima Mutasi Stok

URL: `mutasi/terima`

Receive incoming mutation.

UI:
- List of in-transit mutations.
- Tap → for each item, confirm received qty (may differ from sent → discrepancy).
- Submit → posts MUTATION_IN.

## §R Mutasi / Stok Transit

URL: `mutasi/transit`

View of all in-transit mutations.

## §S Daftar Pemasok

URL: `inventori/pemasok`

Supplier master.

Fields:
- Name, contact person, phone, email, address
- NPWP / tax number
- Payment term (days)
- Notes

API: `GET/POST /api/v1/supplier`.

## Mobile considerations

- Inventory writes are critical for offline support (warehouse area may have weak signal).
- All ops queue to outbox.
- Barcode scanning for fast PO/GR/Opname/Waste entry.
- Photo upload for evidence (queue for upload when online).
- Bulk operations (e.g. opname all products in a category) → use multi-select UX.

## API summary

All endpoints under `/api/v1/`:
- `permintaan-barang`, `purchase-order`, `goods-received`, `invoice-pembelian`, `payment-faktur`, `retur`, `stock`, `stock-movement`, `opname`, `waste`, `production`, `mutation`, `supplier`.
