# Pesanan — Online Order Queue

URL: `marketplace-order`

> Real-time queue of incoming online orders from all channels (marketplace + own e-menu).

## §1 List view

Tabs by status:
- **Baru** (NEW, action required)
- **Diproses** (PREPARING, in kitchen)
- **Siap** (READY, awaiting pickup/delivery)
- **Selesai** (COMPLETED today)
- **Dibatalkan** (CANCELLED)

Each card:
- Channel badge (GoFood / GrabFood / ShopeeFood / Tokopedia / E-menu)
- Order #
- Customer name (or "Walk-in")
- Items summary (e.g. "3 items")
- Total Rp
- Time elapsed (e.g. "5 menit lalu")
- Status indicator

Sort: newest first.

Auto-refresh every 10 s; new orders push notification.

## §2 Order detail

Tap card → detail screen.

Sections:
- Header: channel, ref no, time received, status
- Customer: name, phone, address (for delivery)
- Items: line items with modifiers + special notes
- Payment: method, status (PAID / COD)
- Delivery: courier name + phone (if marketplace), tracking
- Actions:
  - **Terima** (accept; status NEW → PREPARING; sends to kitchen)
  - **Tolak** (reject; reason: stock / closed / other)
  - **Tandai Siap** (PREPARING → READY)
  - **Tandai Selesai** (READY → COMPLETED)
  - **Print Receipt** / **Print Label**
  - **Hubungi Pelanggan** (call/WA)

## §3 Status flow

```
NEW → PREPARING → READY → COMPLETED
  ↓
REJECTED / CANCELLED (at any pre-COMPLETED stage)
```

Each transition:
- Server-side state change
- Webhook to marketplace (so platform updates customer)
- Stock movement on accept (or on complete, configurable)
- Print kitchen ticket on accept

## §4 SLA / time alerts

Each marketplace has SLA (e.g. accept within 5 min, ready within 15 min).
- Yellow card after 50% of SLA elapsed
- Red card after 80% of SLA elapsed
- Auto-cancel after 100% (some marketplaces)

## §5 Filters

- Channel
- Status
- Date range

## §6 Mobile considerations

- Push notification for `ORDER_NEW` with sound + actions ("Terima" / "Tolak" / "Buka").
- Foreground app: in-place update (no notification).
- Background: full notification with action buttons.
- See `10_PUSH_AND_DEEPLINK.md`.
- Auto-print kitchen ticket on accept (config: auto vs manual).
- Cashier device + KDS device should both notify.

## §7 API

- `GET /api/v1/online-order?status=NEW` (poll fallback)
- `POST /api/v1/online-order/:id/accept`
- `POST /api/v1/online-order/:id/reject` `{ reason }`
- `POST /api/v1/online-order/:id/ready`
- `POST /api/v1/online-order/:id/complete`
- `POST /api/v1/online-order/:id/cancel` `{ reason }`

## §8 Open questions

- Are accept/reject buttons enabled offline? `[inferred]` no — marketplace API requires real-time response. Show "Mode Offline — tunggu reconnect" if disconnected.
- Auto-accept rules (e.g. always accept GoFood) configurable? `[unknown]`
