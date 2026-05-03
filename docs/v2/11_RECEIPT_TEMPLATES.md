# 11 · Receipt Templates

> Pixel-precise (or rather char-precise) receipt layouts for thermal 58 mm + 80 mm + A4 invoice + digital (HTML for email/WA).

## §1 Variants

| Receipt | Width | Cuts? | Logo? | Channel |
|---|---|:-:|:-:|---|
| Kasir struk | 58 / 80 | yes | yes | Thermal printer |
| Checker (waiter) | 58 / 80 | yes | optional | Thermal printer |
| Dapur (kitchen) | 58 / 80 | yes | optional | Thermal printer |
| Bar | 58 / 80 | yes | optional | Thermal printer |
| Label sticker | varies | no | optional | Label printer |
| Delivery (alamat) | 58 / 80 | yes | yes | Thermal |
| Faktur A4 | 210×297 mm | n/a | yes | A4 printer / PDF |
| Email | full HTML | n/a | yes | Email |
| WhatsApp | text + PDF link | n/a | n/a | WA business |
| SMS | text only (160 chars) | n/a | n/a | SMS |

## §2 Kasir struk (80 mm) — text layout

```
        [LOGO 384x96 px]
       Toko Sederhana
   Jl. Merdeka 12, Jakarta
       (021) 555-0100
        NPWP 12.345.678.9
================================
No. Trx     : 001/05/2026
Kasir       : Kasir 01
Outlet      : Toko Pusat
Meja        : 5
Tanggal     : 03/05/2026 14:30
Jenis       : Dine In
================================
Nasi Goreng Spesial         x2
  @25.000             50.000
  + Telur Ceplok       3.000
  + Saus Sambal        1.000
Es Teh Manis              x2
  @8.000              16.000
================================
Subtotal              66.000
Diskon Promo HappyH    -5.000
PPN 11%                6.710
Service 5%             3.050
Pembulatan             0.240
--------------------------------
TOTAL                 71.000
================================
PEMBAYARAN
  Tunai               80.000
--------------------------------
Kembalian              9.000
================================
[QR CODE for digital receipt]
   Cek struk digital di
   majoo.id/r/abc123

  Terima kasih atas
   kunjungan Anda!

   Powered by majoo
================================
```

Width: 48 chars (Font A) / 64 chars (Font B). Use Font B for line items if name is long.

## §3 Kasir struk (58 mm)

Same content but 32 chars wide. Item names truncated to 18 chars; price right-aligned.

```
   [LOGO 384x96]
  Toko Sederhana
Jl. Merdeka 12, JKT
   (021) 555-0100
================================
No.Trx: 001/05/2026
Kasir : Kasir 01
3 Mei 2026 14:30
Dine In · Meja 5
--------------------------------
Nasi Goreng Spesi  x2
@25.000      50.000
 +Telur       3.000
 +Saus Sambal 1.000
Es Teh Manis     x2
@8.000       16.000
--------------------------------
Subtotal     66.000
Diskon       -5.000
PPN 11%       6.710
Service       3.050
Pembulatan    0.240
--------------------------------
TOTAL        71.000
================================
Tunai        80.000
Kembalian     9.000
--------------------------------
[QR]
majoo.id/r/abc123
Terima kasih!
================================
```

## §4 Dapur ticket (80 mm)

No prices, no totals. Big font for kitchen visibility.

```
  ====[ DAPUR ]====
  No.Trx: 001/05/2026
  Meja: 5  ·  Dine In
  Kasir: Kasir 01
  Waktu: 14:30
================================
2x Nasi Goreng Spesial
  + Telur Ceplok
  + Saus Sambal
  CATATAN: Pedas

2x Es Teh Manis
  Tanpa Es

================================
  Order #001
   14:30:42
```

Use double-height font for product names. Cut after print.

## §5 Checker (waiter) ticket

Same as dapur but with prices visible (no totals). Used for waiter to recheck order before sending to kitchen.

## §6 Label sticker

For takeaway / delivery:
```
+---------------------+
|  Toko Sederhana     |
|  No.Trx 001/05      |
|                     |
|  An: Bp. Andi       |
|  Telp: 0812-3456    |
|  Alamat:            |
|  Jl. Mawar 5, RT 03 |
|  Jakarta            |
+---------------------+
```

Small label printer (40×40 mm or 50×80 mm).

## §7 Faktur A4

Generated as PDF via Android `PdfDocument` API:
- Header: business logo, name, address, NPWP
- Customer block: name, address, NPWP customer
- Invoice number, date, due date
- Itemized table: No, Description, Qty, Unit Price, Discount, Subtotal
- Totals: Subtotal, Discount, Tax, Total
- Bank account info for payment
- Signature block
- Footer with page number

Library: built-in or `iText` for richer layouts.

## §8 Email receipt

HTML email template. Variables: `{{outlet_name}}`, `{{trx_number}}`, `{{customer_name}}`, `{{items}}`, `{{total}}`, `{{deeplink_url}}`.

Send via `/api/v1/email-receipt` `[inferred]`:
```json
{ "transaction_id": 123, "email": "user@example.com" }
```

## §9 WhatsApp receipt

Send to merchant's WA business number, which forwards to customer:
```
Halo {{customer_name}},

Terima kasih atas kunjungan ke {{outlet_name}}.
Berikut struk pembelian Anda:

No.Trx: {{trx_number}}
Tanggal: {{trx_date}}
Total: Rp {{total}}

Lihat struk lengkap: {{pdf_url}}

Terima kasih!
{{outlet_name}}
```

## §10 SMS receipt

Limited to 160 chars (1 SMS) or 2-3 SMS for longer:
```
Trx#001/05 04Mei14:30 Total Rp71.000 -Toko Sederhana. Detail: majoo.id/r/abc123
```

## §11 Customisable elements

Settings → Cetak Struk allows OWNER to configure:
- Logo upload
- Header text (lines 1-5)
- Footer text (lines 1-5)
- Show/hide: Customer name, NPWP, Bank info, QR digital receipt, Tax breakdown, Service charge breakdown, Promo savings, Loyalty points earned
- Print copies: 1, 2, 3
- Auto-cut: yes/no
- Auto-open drawer on cash: yes/no
- Drawer-open code: standard pulse (`27 112 0 25 250`) or vendor-specific
- Print kitchen ticket on: every order vs only on send-to-kitchen
- Print checker for: dine-in only / all orders
- Char encoding: CP858 / CP437 / Custom

## §12 Print queue

When the printer is busy or disconnected:
- Queue pending prints in memory
- Show a printer icon with badge count
- On reconnect, drain queue
- If user voids a print before reprint → discard

## §13 QR code on receipt

Encode digital receipt URL: `https://majoo.id/r/<token>`. Server stores receipt under `<token>` for 90 days. Customer can view in browser.

QR module size: 6 (medium) for 58 mm, 8 for 80 mm. Use error correction L for max data density.

## §14 Reprint flow

User → POS history → tap transaction → "Cetak ulang" button.
- Allowed within 7 days of original.
- Audit log entry: `RECEIPT_REPRINT(trx_id, user_id, terminal_id, count)`.

## §15 Indonesian content

- Date: `dd MMM yyyy` (e.g. `03 Mei 2026`) or `dd/MM/yyyy`.
- Time: 24-hour `HH:mm`.
- Currency: `Rp 71.000` with `.` thousand separator, no decimal.
- Negative values: `-Rp 5.000` or `(Rp 5.000)` (configurable).
- Round to nearest 100 in Indonesia (configurable).

## §16 Test plan

For each variant (58, 80, A4, HTML, WA, SMS):
- Long item name (truncation)
- Long modifier list
- 0 IDR total (free / komplimen)
- High discount > subtotal (zero total)
- Multi payment methods
- No customer (walk-in)
- Tax inclusive vs exclusive
- Kitchen ticket without prices
- Reprint mark "** REPRINT **" header
