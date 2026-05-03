# Kasir Settings

## §1 Daftar Kasir

URL: `kasir`

List of cashiers (subset of employees with KASIR role).

Add/edit:
- Pick employee
- PIN (4-6 digit, used at POS)
- Default outlet
- Default terminal
- Permissions:
  - Can void
  - Can refund
  - Can modify price
  - Can apply manager-only discounts
  - Etc

## §2 Kategori Kas Kasir

URL: `kategori-kasir`

Categories for cash drawer transactions:
- Cash drop reasons (e.g. "Setoran ke kantor", "Belanja perlengkapan")
- Cash pickup reasons (e.g. "Modal awal", "Tambahan modal")

Used in cashier shift workflow.

## §3 Mobile considerations

- Cashier list synced; local cache.
- PIN stored hashed locally (offline auth).
- Categories synced; used in dropdown.

## §4 API

- `GET/POST /api/v1/cashier`
- `GET/POST /api/v1/cashier-category`
