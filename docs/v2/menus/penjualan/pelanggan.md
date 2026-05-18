# Pelanggan — 5 Sub-Screens

## §1 Daftar Pelanggan

URL: `pelanggan/daftar`

Customer master list.

Columns: Name, Phone, Email, Group, Last Visit, Total Spend, Points Balance, Deposit Balance.

Search: name, phone, email, NPWP.

Tap row → opens detail with tabs:
- Info Pelanggan
- Riwayat Transaksi
- Saldo Deposit + Riwayat
- Poin + Riwayat
- Catatan

### Add / Edit form

Fields:
- `name` (required, max 100)
- `phone` (E.164 or local format, recommend `08xxxxxxxxxx`)
- `email` (optional, validated)
- `id_group` (optional)
- `birth_date` (optional, dd-mm-yyyy)
- `gender` (M / F / Other)
- `address` (textarea)
- `id_province`, `id_city`, `id_district` (cascading dropdown)
- `npwp` (optional)
- `id_card_no` (KTP, optional)
- `notes`
- Custom fields (Prime+, see §4)

Validation:
- Name unique within merchant (or unique by phone)
- Phone format: `^(0|62|\+62)[0-9]{8,12}$`
- Email format if provided
- Code (PLG####) auto-generated

Mobile considerations:
- Offline create supported; UUID maps to server id.
- Phone-number input: numeric keyboard, mask `0xxxx-xxxx-xxxx`.
- Auto-prepopulate province/city from device GPS (with permission).

API:
- `GET /pelanggan/api/v1/customer?merchant_id=`
- `POST /pelanggan/api/v1/customer`
- `PUT /pelanggan/api/v1/customer/:id`
- `DELETE /pelanggan/api/v1/customer/:id`

## §2 Grup Pelanggan

URL: `pelanggan/grup`

Customer groups (e.g. VIP, Reseller, Regular).

Fields:
- Name
- Description
- Discount % (optional, applied to all transactions of this group)
- Points multiplier (e.g. 2x for VIP)
- Color (badge)

Used by:
- Promo conditions (member-only promos)
- Special pricing (`pelanggan/harga-spesial`)
- Loyalty points calculation

## §3 Grup Harga Spesial

URL: `pelanggan/harga-spesial`

Per-group special prices for specific products.

UI:
- Pick group.
- Pick products + override price.
- Save.

E.g. "Reseller group: Coffee Latte Rp 18.000 (normal Rp 25.000)".

POS auto-applies this price when customer is in the group.

## §4 Kustom Data Pelanggan (Prime+)

URL: `pelanggan/kustom-data`

Define custom fields for customer profile.

Field types:
- Text (single line)
- Textarea
- Number
- Date
- Single-select (dropdown)
- Multi-select (checkboxes)

E.g. "Salon Group adds 'Hair Type' = Lurus / Bergelombang / Keriting".

These appear in customer add/edit form below standard fields.

## §5 Pengaturan Data Pelanggan

URL: `pelanggan/pengaturan`

Configure mandatory vs optional fields.

UI:
- For each standard field, toggle "Wajib" / "Tampilkan" / "Sembunyikan".
- E.g. "Phone wajib, Email tampilkan, NPWP sembunyikan."

Affects POS quick-add customer flow (only show + require relevant fields).

## Customer detail tabs

### Info Pelanggan

Read-only display of all fields. "Edit" button opens form.

### Riwayat Transaksi

List of transactions linked to customer, with date, total, status. Tap → transaction detail.

### Saldo Deposit + Riwayat

Current balance shown at top.

History list: top-up, used, refunded.

"Tambah Deposit" button (manager PIN) → top up flow.

### Poin + Riwayat

Current point balance shown at top.

History list: earned (per transaction), redeemed, expired.

"Sesuaikan Poin" button (manager PIN) for manual adjustment.

### Catatan

Free-form notes about customer (e.g. "Suka pedas", "Alergi seafood", "Pelanggan VIP teman owner").

## Bulk operations

- Import: CSV with name, phone, email, group, etc.
- Export: CSV.
- Bulk SMS/WA campaign (links to Marketing module).

## Search & filter

- Search: name, phone, email, NPWP
- Filter: group, gender, has-deposit, has-points, last-visit-range, registration-date-range
- Sort: name, last-visit-desc, spend-desc, points-desc

## Mobile-specific

### Quick-add customer (from POS)

When cashier taps "Tambah Pelanggan Baru" mid-transaction:
- Minimal form: Name + Phone (required if mandatory in settings)
- Save → returns to POS with customer assigned

### Customer detail accessed during POS

Tapping the customer chip in cart shows mini-card with:
- Phone, Group, Points, Deposit
- "Lihat profil lengkap" link

### Loyalty / deposit redemption from POS

(See `13_PROMO_AND_LOYALTY.md` and `14_PAYMENT_METHODS.md`.)

## Privacy / compliance

- Customer data is PII. Don't log to crash reporter.
- On export/share, require manager PIN.
- Customer self-registration via QR (optional Prime feature) for GDPR-style consent.
