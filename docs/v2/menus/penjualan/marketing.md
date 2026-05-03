# Marketing — Campaign

> Channels: WhatsApp Blast, SMS Broadcast, Email Blast, IG Feed Generator, SMS LBA Telkomsel.

`[Advance+]`

## §1 Kirim Kampanye Marketing

URL: `marketing/kirim`

### Channel selection
- WhatsApp Blast (`[Advance+]`)
- SMS Broadcast
- Email Blast
- SMS LBA Telkomsel (`[Prime]`) — location-based ad to Telkomsel users near outlet

### Audience selection
- All customers
- Customer groups (multi-select)
- Filter: last visit / spend / birth month / etc
- Custom upload (CSV with phone/email)

### Template editor

WhatsApp:
- Header (image / text)
- Body with variables: `{{name}}`, `{{outlet}}`, `{{points_balance}}`, `{{deposit_balance}}`, `{{trx_count}}`, `{{last_visit}}`
- Footer
- Buttons (URL / phone)

SMS:
- 160 chars (1 SMS) or longer (multi-part, 2-3 SMS)
- Variables substituted

Email:
- HTML editor with merge fields

IG Feed:
- Pre-designed Canva-style templates with merchant logo + promo text
- Generates image + caption ready to post

### Schedule

- Send now
- Schedule for date+time
- Recurring (e.g. every Friday at 17:00)

### Cost

- Per-message cost shown (deducted from credit balance).
- Need to top up credit before sending.

### Test send

Send to single test number/email before bulk.

### Send

- Bulk send → progress shown
- After complete: report (sent / delivered / failed counts)

### API endpoints

- `POST /api/v1/campaign`
- `GET /api/v1/campaign/:id/status`
- `POST /api/v1/campaign/:id/send`

## §2 Beli Kampanye Marketing (Top up credit)

URL: `marketing/beli-kuota`

Buy credit for campaigns.

Plans:
- WA: 1.000 messages = Rp X
- SMS: 1.000 messages = Rp Y
- Email: 10.000 messages = Rp Z
- IG Feed: 50 designs = Rp W

Payment via Majoo Pay or transfer.

## Mobile considerations

- Marketing is **online only** (no value offline).
- Owner App typically the primary surface for marketing; Cashier app may not have access.
- Template editor on phone → simplified (no rich HTML); use predefined templates.

## Open questions

- WA Blast: uses WhatsApp Business API or unofficial bulk gateway? `[unknown]` — official API has stricter compliance requirements.
- Are templates pre-approved by WhatsApp (template message vs free-form session message)? `[unknown]`
- IG Feed integration: direct posting to merchant's IG, or download-and-post-manually? `[inferred]` likely manual.
