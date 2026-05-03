# Notifikasi

## §1 Pengaturan WhatsApp

URL: `message-setting/setting-whatsapp`

Configure WhatsApp Business integration.

Fields:
- Connection status (connected / not connected)
- Connect via QR scan (links merchant's WA Business account)
- Default sender name
- Templates (pre-approved by WhatsApp):
  - Order confirmation
  - Order ready
  - Payment receipt
  - Promo broadcast
  - Customer reply auto-response

## §2 Daftar Notifikasi

URL: `message-setting/inbox`

Inbox of all notifications received by merchant from system.

Columns: Time, Category, Title, Status (read / unread), Source.

Filters: category, date range, read status.

## §3 Pengaturan Notifikasi

URL: `pengaturan-bisnis/notification/dashboard`

Per-category notification routing.

Categories:
- New online order
- Low stock
- Daily report
- Approval pending
- Subscription expiry
- Payment received
- Customer feedback (negative)
- System update

Per category: enable/disable + channel(s):
- Push (in-app)
- WhatsApp
- SMS
- Email

Recipient: which roles get notified.

## §4 Transaksi Dihapus

URL: `message-setting/deleted-transaction`

Audit log of voided/deleted transactions.

Columns: Date, Trx #, Cashier, Amount, Reason, Approved by.

Filter: outlet, date range, cashier, amount.

Read-only — for forensic review.

## §5 Mobile considerations

- Push notifications use FCM; see `10_PUSH_AND_DEEPLINK.md`.
- WA QR connect: requires phone with WA Business installed.
- Per-category preferences cached on device; sync on change.

## §6 API

- `GET/PUT /api/v1/notification-setting`
- `GET /api/v1/notification?category=&from=`
- `POST /api/v1/notification/:id/mark-read`
- `GET /api/v1/whatsapp/connection-status`
- `POST /api/v1/whatsapp/connect`
- `GET /api/v1/audit/deleted-transactions?from=&to=`
