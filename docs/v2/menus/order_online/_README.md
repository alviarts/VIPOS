# ORDER ONLINE — Menu Group

> 14 menu items. Online ordering: own e-menu (majoo Order) + marketplace integrations (GoFood/GrabFood/Shopee/GrabMart) + Consumer App.

`[Advance+]` for marketplace; `[Prime+]` for Consumer App.

## Inventory

| Menu | URL | File |
|---|---|---|
| Pesanan (incoming orders queue) | `marketplace-order` | [`pesanan.md`](pesanan.md) |
| majoo Order / Pengaturan Penjualan | `toko-online/pengaturan-penjualan` | [`majoo_order.md`](majoo_order.md) §1 |
| majoo Order / Pengaturan Tampilan | `toko-online/kustomisasi-toko` | §2 |
| majoo Order / Pengaturan Lainnya | `toko-online/pengaturan-lain` | §3 |
| Marketplace / GrabMart | `grabmart` | [`marketplace.md`](marketplace.md) §1 |
| Marketplace / Shopee | `shopee` | §2 |
| Food Order / GrabFood | `grabfood` | §3 |
| Food Order / GoFood | `gofood` | §4 |
| Consumer Apps | `consumer-app` | [`consumer_app.md`](consumer_app.md) |

## Concepts

### majoo Order (own e-menu)

Merchant's own online storefront. Customer scans QR at table or visits public URL.
Orders flow into "Pesanan" queue.

### Marketplace
Third-party platform that lists merchant's products. Orders ingested via webhook + reconciled in "Pesanan".

### Consumer Apps
Customer-facing iOS/Android app (white-labeled to merchant brand). Customers can browse + order + pay + earn loyalty.

## Mobile considerations

- Cashier app must show new "Pesanan" notification (push + sound).
- Auto-print to kitchen on accept.
- Status updates synced to marketplace via webhook.
- See `10_PUSH_AND_DEEPLINK.md` §3 for `ORDER_NEW`, `ORDER_CANCEL` push categories.
