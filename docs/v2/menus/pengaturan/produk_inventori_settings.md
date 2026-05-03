# Produk dan Inventori Settings

URL: `stock-notif-setting`

Stock notification configuration.

## §1 Fields

- Enable low-stock alerts (boolean)
- Default low-stock threshold per UOM (or per category)
- Recipients (which roles/employees get notified)
- Channel: push / WA / email
- Frequency: real-time / daily digest

## §2 Per-product override

Each product can override default threshold (set in Produk master).

## §3 Auto-actions

- Auto-create PO when stock hits threshold (if vendor configured)
- Mark product "out of stock" on storefront when qty = 0

## §4 Mobile considerations

- Quick check of which items are below threshold (bottom-sheet).

## §5 API

- `GET/PUT /api/v1/setting/stock-notification`
