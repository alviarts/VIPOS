# Cetak (Print)

## §1 PDF Template

URL: `print-setting/pdf`

PDF template configuration for non-thermal documents:
- Faktur Pajak (formal A4 invoice)
- Sales Order
- Delivery Order
- Quotation
- Refund slip

Per template:
- Page size (A4 / Letter)
- Margins
- Header (logo + business info)
- Footer (T&C, signature)
- Show: NPWP, bank account, item details, tax, etc

Override per outlet allowed.

## §2 Mobile considerations

- PDF preview in WebView.
- Download / share PDF.
- Print to AirPrint / Google Cloud Print / native Android print framework.
- Email / WA share.

## §3 API

- `GET/PUT /api/v1/setting/pdf-template/:type`
- `GET /api/v1/document/:id/pdf` (render)
