# Marketplace Integrations

> GrabMart / Shopee / GrabFood / GoFood. Each has its own connection flow + product mapping + order ingestion.

`[Advance+]` for full integration; basic browsing of marketplace listings may be available on lower tiers.

## §1 GrabMart

URL: `grabmart`

Grocery/retail marketplace.

### Connection

1. Owner taps "Hubungkan ke GrabMart".
2. App opens OAuth flow with Grab.
3. Grant permissions: read product, write orders, read settlements.
4. Save tokens.

### Product mapping

- App syncs merchant's product catalogue to GrabMart.
- Per product: enable/disable for GrabMart.
- Override price (e.g. +20% margin to cover MDR + delivery).
- Override image (Grab requires square 1:1).
- Override name (e.g. shorter for Grab UI).

### Stock sync

- Two-way: Grab queries app's stock API; app pushes stock changes via webhook.
- Out-of-stock reflected within 5 min.

### Order ingestion

- Grab → webhook → app's `/api/v1/grab-order/webhook`
- Order appears in "Pesanan" queue with channel = `grabmart`
- See `pesanan.md`

### Settlement

- Grab settles weekly to merchant bank.
- App reconciles via Settlement Report (`16_REPORTS_CATALOG.md`).

## §2 Shopee

URL: `shopee`

ShopeeFood / ShopeeMart for food + grocery.

Similar connection + product mapping + order flow.

Special: ShopeeFood promo subsidy — Shopee may absorb part of discount; settlement reflects net to merchant.

## §3 GrabFood

URL: `grabfood`

F&B-only marketplace under Grab.

Similar to GrabMart but with F&B-specific category structure (e.g. "Nasi & Mi", "Dessert").

Menu image specs: square 1:1, ≥800×800 px, white background preferred.

## §4 GoFood

URL: `gofood`

Gojek's F&B marketplace.

Connection: GoFood Merchant API.

Cycle:
- Merchant ID + outlet_id provisioned by Gojek
- Product sync to GoFood catalog
- Order webhooks
- Status updates back to GoFood

## §5 Common considerations

### Product sync conflicts

When a product is updated in main catalogue:
- Auto-sync to all connected marketplaces (configurable: auto vs manual).
- If marketplace rejects (e.g. price below minimum), surface error.

### Pricing strategy

Merchant typically uses higher prices on marketplaces to cover:
- MDR (~20%)
- Delivery fee absorption
- Marketing exposure

App allows per-marketplace price multiplier or fixed price.

### Out-of-stock cascade

If a recipe ingredient runs out, all dependent menu items go out-of-stock. App must propagate to all marketplaces.

### Promo cascade

Marketplace promos (e.g. GoFood "Buy 1 Get 1") are merchant-funded or Gojek-funded. Configure per promo.

## §6 Mobile considerations

- Connection status indicator (green/red dot per marketplace).
- Quick toggle "Buka / Tutup di Marketplace" without disconnecting (e.g. lunch rush, unable to take more orders).
- Order accept/reject from notification (without opening app).

## §7 API

- `POST /api/v1/marketplace/grabmart/connect` (OAuth callback)
- `POST /api/v1/marketplace/grabmart/sync-products`
- `POST /api/v1/marketplace/grabmart/disconnect`
- (similar for shopee, grabfood, gofood)

Webhook endpoints (server receives from marketplaces):
- `/webhook/grab/order`
- `/webhook/shopee/order`
- `/webhook/gofood/order`

## §8 Open questions

- Token refresh policy per marketplace? `[unknown]`
- Failed order ingestion retry policy? `[unknown]`
- Error handling for disconnect during merchant-marketplace API outage? `[unknown]`
