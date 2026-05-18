# majoo Order — Own E-menu

> Merchant's branded online storefront. Customer scans QR at table or visits public URL.

`[Advance+]`

## §1 Pengaturan Penjualan

URL: `toko-online/pengaturan-penjualan`

### Storefront URL

Merchant gets a public URL: `https://emenu.majoo.id/<slug>` or custom domain.

### Order types supported

- Dine-in (table QR — auto-fills table)
- Takeaway (customer picks up)
- Delivery (customer enters address; merchant delivers via own driver / 3rd party)

### Operating hours

- Per day-of-week open/close times
- Holiday closures
- "Currently closed" auto-shows on storefront

### Payment methods

Toggle which methods to show online:
- QRIS Dinamis (preferred)
- Cash on delivery
- Bank transfer (manual verify)
- Major e-wallets (via gateway)

### Service charge / tax

Same as in-store, configurable separately.

### Min order

Set minimum order value (esp. for delivery).

### Delivery zones

Set radius / specific zones with delivery fees.

## §2 Pengaturan Tampilan

URL: `toko-online/kustomisasi-toko`

### Branding

- Logo upload
- Cover image
- Brand color (primary, accent)
- Theme (light / dark / auto)
- Custom font (limited choices)

### Layout

- Show/hide categories
- Featured product carousel
- Banner (multiple slides)

### Locale

- Language: Indonesian / English
- Currency: IDR

### Custom domain

Merchant can point own domain (CNAME).

## §3 Pengaturan Lainnya

URL: `toko-online/pengaturan-lain`

- T&C / privacy policy text
- Contact info (WA, phone, email, social)
- About section
- FAQ
- SEO meta (title, description, og:image)
- Google Analytics ID
- Facebook Pixel ID

## §4 Customer experience

1. Customer visits URL or scans QR.
2. Browses catalogue (synced from main product master).
3. Adds to cart (modifiers supported).
4. Enters customer info (name + phone, address if delivery).
5. Picks payment method.
6. Confirms.
7. Order goes to "Pesanan" queue at outlet.
8. Customer receives WA/SMS with order tracking link.

## §5 Mobile management

The Android app's "majoo Order" settings allow merchant to:
- Update operating hours quickly (e.g. "Buka sampai jam 10 malam hari ini")
- Toggle "Storefront aktif / nonaktif"
- Update banner image (camera capture + crop)
- Mark items "Habis hari ini" (auto-out-of-stock display)

## §6 API

- `GET/POST /api/v1/storefront/settings`
- `GET/POST /api/v1/storefront/branding`
- `GET/POST /api/v1/storefront/operating-hours`
- `GET/POST /api/v1/storefront/delivery-zones`

## §7 Open questions

- Custom domain (CNAME) provisioning workflow: self-service or support ticket? `[unknown]`
- Storefront SSR vs SSG for SEO? `[unknown]`
- Customer login on storefront (loyalty integration)? `[inferred]` likely yes for repeat customers.
