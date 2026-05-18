# Consumer Apps

URL: `consumer-app`

`[Prime+]`

> White-label customer-facing iOS/Android app, branded as the merchant's own.

## §1 Concept

Merchant gets a co-branded consumer app:
- Browse catalogue + cart + checkout
- Customer login (phone OTP)
- Loyalty: points, tier, rewards
- Push notifications for promos
- Order tracking
- Saved addresses + payment methods
- Reservation booking
- Feedback / rating

Brand assets:
- App name (e.g. "Toko Sederhana Order")
- Icon
- Splash screen
- Color theme

## §2 Provisioning

1. Owner subscribes to Prime+.
2. Submits brand assets via Owner App.
3. Majoo team builds + publishes to Play Store / App Store under merchant's developer account (or Majoo's umbrella, depending on plan).
4. App available within 2 weeks (Apple review etc).

## §3 Sync

- Catalogue: same source as POS catalogue.
- Customers: same DB.
- Orders: appear in cashier app's "Pesanan" queue.
- Loyalty: shared with in-store loyalty.

## §4 Mobile management (in cashier/owner app)

- Push notification campaign editor (target consumer app users)
- Featured promos for consumer app home screen
- Menu visibility (some items POS-only)
- Operating hours (separate from in-store)

## §5 Reporting

- Consumer app users count
- App-driven order count + revenue
- Conversion (visits → orders)
- Push notification CTR

## §6 Mobile considerations

- The cashier app's Consumer App settings is a config screen — primary use surface is the consumer app itself.
- Monitor consumer app reviews from Play Store; surface in dashboard.

## §7 Open questions

- Single Consumer App or per-outlet? `[inferred]` per-merchant (multi-outlet within single app).
- Code-push for fast updates? `[unknown]`
- Apple developer account: merchant's own or Majoo umbrella? `[unknown]` — affects compliance.
