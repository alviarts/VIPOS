# Akun Profile

## §1 Informasi Akun

URL: `user-profile/account`

Owner's account info.

Fields:
- Photo
- Name (full)
- Username (login)
- Email
- Phone (WhatsApp)
- Default outlet (after login)
- Language (ID/EN)
- Timezone (default Asia/Jakarta)
- Notification preferences (push / WA / email per category)
- Change password
- 2FA setup (TOTP — Prime+ recommended)

## §2 Informasi Bisnis

URL: `user-profile/business`

Merchant business info (used in receipts, invoices).

Fields:
- Business name
- Logo
- Industry (F&B / Retail / Service / Salon / Bengkel / Apotek / etc)
- NPWP (tax ID)
- NIB (Indonesian business registration)
- Business address
- City, province, postal code
- Phone, email, website
- Social media (IG, FB, TikTok)
- PKP status (boolean — affects PPN handling)

Used by:
- Receipt header
- Invoice header
- Email signature
- Marketing campaigns

## §3 Informasi Rekening

URL: `user-profile/bank-account`

Merchant bank accounts (for settlement, payroll).

Per account:
- Bank name
- Branch
- Account number
- Account holder
- Currency
- Default for: settlements / payroll / refunds

Auto-linked to "Buku Kas" entries.

## §4 Mobile considerations

- Owner-editable on phone.
- Photo/logo capture via camera.
- Logo crop to square (used in app + receipts).
- Validation: NPWP format (xx.xxx.xxx.x-xxx.xxx).

## §5 API

- `GET/PUT /user-management/api/v1/user/profile`
- `GET/PUT /user-management/api/v1/business/profile`
- `GET/POST/DELETE /user-management/api/v1/business/bank-account`
- `POST /user-management/api/v1/user/change-password`
- `POST /user-management/api/v1/user/enable-2fa`
