# Langganan (Subscription)

## §1 Langganan & Support

URL: `support/buy`

Subscription management.

Sections:
- Current plan: tier name, expiry date, included features
- Plan comparison (Lite / Starter / Advance / Prime / Prime+)
- Upgrade button per tier
- Add-ons:
  - Extra outlet (per outlet)
  - Extra terminal (per terminal)
  - Marketing credits (WA / SMS / Email)
  - Premium support
  - Custom domain (Prime+)

Payment:
- Bank transfer (manual confirm)
- Credit card (gateway)
- Majoo Pay
- Reseller voucher

Invoice:
- Auto-generated, downloadable PDF.
- Email + WA delivery.

Auto-renew: optional toggle.

## §2 Tiket Support

URL: `support/ticket`

Customer support ticket system.

List:
- Ticket #, Subject, Created, Status (Open / In Progress / Resolved / Closed), Priority, Assignee.

New ticket form:
- Category (technical / billing / feature request / other)
- Subject
- Description
- Attachments (screenshots, logs)
- Priority (Low / Medium / High / Urgent — Prime+ can use Urgent)

Reply thread:
- Customer adds reply
- Support adds reply
- Internal notes (hidden from customer)
- Solution + close

SLA:
- Lite: best-effort (no SLA)
- Starter: 48 hr response
- Advance: 24 hr response
- Prime: 4 hr response
- Prime+: 1 hr response (24/7)

## §3 Klaim Voucher

URL: `support/claim-voucher`

Redeem promotional vouchers (e.g. given by Majoo team for compensation, retention, etc).

Form:
- Voucher code
- Submit → applies to account (e.g. extends subscription, adds credit)

## §4 Mobile considerations

- Owner-only access.
- Subscription upgrade flow: in-app purchase via Majoo Pay or external gateway browser.
- Support tickets: push notification on reply.
- Photo attachment from camera or gallery.

## §5 API

- `GET /api/v1/subscription/current`
- `POST /api/v1/subscription/upgrade`
- `GET /api/v1/subscription/plans`
- `GET/POST /api/v1/support-ticket`
- `POST /api/v1/support-ticket/:id/reply`
- `POST /api/v1/voucher/claim`

## §6 Open questions

- Trial period for new tier upgrade? `[inferred]` likely 14 days for some.
- Pro-rated refund on downgrade? `[unknown]` — likely no refund, prorated credit only.
