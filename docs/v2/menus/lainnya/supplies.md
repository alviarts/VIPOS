# SUPPLIES (B2B Procurement Marketplace)

> Buy supplies/inventory directly from Majoo's marketplace. Curated for F&B + retail SME categories.

## §1 Supplies (Catalog)

URL: `shopping/order`

Browse + order supplies.

UI:
- Category tree: Bahan Baku F&B, Kemasan, Cleaning, Office Supplies, Equipment, etc.
- Product cards: image, name, price, MOQ, stock status, supplier.
- Filters: price range, supplier, location.
- Search.

Add to cart → checkout flow:
- Delivery address (auto-fill from outlet)
- Delivery date
- Payment: bank transfer / Majoo Pay / Capital credit
- Confirm.

Order status:
- ORDERED → CONFIRMED → SHIPPED → DELIVERED → COMPLETED.

Auto-create incoming GR:
- When delivered, app prompts to "Terima Barang" → posts inventory IN movement.

## §2 Daftar Belanja (Order History)

URL: `shopping/transaction`

Past orders list.

Columns: Order #, Date, Supplier, Items count, Total, Status.

Drill-down: full order detail + tracking.

Reorder: one-tap reorder of past order.

## §3 Mobile considerations

- E-commerce-style UX.
- Image-heavy: lazy-load + cached.
- Push notification on order status changes.
- Tap delivered notif → "Terima Barang" → camera-scan QR on package → auto-confirm + inventory IN.

## §4 API

- `GET /shopping/api/v1/product?category=&q=`
- `GET /shopping/api/v1/cart`
- `POST /shopping/api/v1/cart/add`
- `POST /shopping/api/v1/order/checkout`
- `GET /shopping/api/v1/order` (history)
- `GET /shopping/api/v1/order/:id`
- `POST /shopping/api/v1/order/:id/receive` (GR)

## §5 Open questions

- Supplier vetting / Majoo's role (marketplace operator vs reseller)? `[unknown]`
- Returns / refunds workflow? `[unknown]`
- Bulk pricing tiers? `[inferred]` yes for MOQ + tiered pricing.
