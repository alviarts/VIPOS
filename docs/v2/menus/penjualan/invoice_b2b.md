# Invoice — B2B Sales 5-Stage Flow

> Distinct from POS quick-sale. Used for project / wholesale / B2B sales with longer cycle.

`[Advance+]`

## §1 Daftar Penawaran Penjualan (Quote)

URL: `invoice/penawaran`

Quotation / proposal to customer.

Fields:
- Quote number (auto)
- Customer
- Quote date, valid until
- Items + qty + unit price + discount
- Subtotal, tax, total
- Notes
- Terms & conditions
- Status: DRAFT / SENT / ACCEPTED / REJECTED / EXPIRED

UI:
- Standard form with item table.
- Print/email/download as PDF.
- "Convert to Sales Order" button when accepted.

## §2 Daftar Pesanan Penjualan (Sales Order)

URL: `invoice/pesanan`

Confirmed sales order.

Fields:
- SO number
- From quote (optional FK)
- Customer
- Order date, expected delivery
- Items + qty + price
- Status: NEW / PARTIAL / FULFILLED / CANCELLED

Workflow: Quote → SO → DO → Invoice → Payment Receipt.

## §3 Daftar Pengiriman Penjualan (Delivery Order, DO)

URL: `invoice/pengiriman`

Goods being shipped to customer.

Fields:
- DO number
- From SO
- Items + qty shipped (may be partial of SO)
- Carrier / driver
- Date, expected arrival
- Status: PREPARING / IN_TRANSIT / DELIVERED / RETURNED

Posts stock movements (OUT for the items).

Customer's signature on delivery (capture as photo or e-signature on tablet).

## §4 Daftar Invoice

URL: `invoice/daftar`

Sales invoice (faktur).

Fields:
- Invoice number (auto, with prefix per outlet)
- From SO/DO
- Customer
- Invoice date, due date (NET 30 / NET 60 / etc)
- Items + amounts
- Subtotal, tax (PPN), total
- Down payment received (if any)
- Outstanding balance
- Status: ISSUED / PARTIAL / PAID / OVERDUE / VOID

Print as faktur PDF (formal, A4, with NPWP).

## §5 Daftar Penerimaan Penjualan (Payment Receipt)

URL: `invoice/penerimaan`

Customer payment against an invoice.

Fields:
- Receipt number (auto)
- From invoice (FK)
- Payment date
- Method (cash / transfer / cheque)
- Amount
- Bank account credited
- Ref number
- Notes

Reduces customer's accounts receivable (piutang).

## Aging

Reports show overdue invoices grouped by aging bucket:
- 0-30 days
- 31-60 days
- 61-90 days
- > 90 days

## Mobile considerations

- B2B invoice flow is typically used by office staff, not POS cashiers — Owner App / Web is the primary surface.
- The Android app may need to:
  - View invoice list (for sales rep on the road)
  - Capture payment receipt (after customer pays via transfer)
  - Send invoice via WA/Email
  - Customer signs DO on tablet (capture e-signature)

## API

- `GET/POST /api/v1/quote` (penawaran)
- `GET/POST /api/v1/sales-order` (pesanan)
- `GET/POST /api/v1/delivery-order` (pengiriman)
- `GET/POST /api/v1/sales-invoice` (invoice)
- `GET/POST /api/v1/sales-receipt` (penerimaan)

## Open questions

- Are invoices linked to e-Faktur (Indonesian government VAT system) for direct submission? `[unknown]`
- Are recurring invoices supported (e.g. monthly subscription billing)? `[unknown]`
