# Produk Master — 14 Sub-Screens

> Product catalogue management. Critical for offline POS (cached on device).

## §1 Daftar Departemen

URL: `produk/department`

A department is a higher-level grouping above category (e.g. Department: "Beverages" → Categories: "Coffee", "Tea", "Juice").

Fields:
- `name` (text, required, max 100)
- `is_active` (boolean, default true)
- `sort_order` (int)

UI:
- List with name + active toggle
- "+ Tambah Departemen" button
- Tap row → edit

API:
- `GET /ms-master-data/api/v1/department?merchant_id=`
- `POST /ms-master-data/api/v1/department`
- `PUT /ms-master-data/api/v1/department/:id`
- `DELETE /ms-master-data/api/v1/department/:id`

Validation: name unique per merchant.

Mobile: editable offline; sync on reconnect; last-write-wins.

## §2 Daftar Kategori

URL: `produk/kategori`

Fields:
- `name` (text, required, max 100)
- `id_department` (FK, optional)
- `color` (hex, optional, default theme color) — used for POS button background
- `is_active`, `sort_order`

UI:
- List grouped by department.
- Tap row → edit.
- Color picker (16 preset + custom hex).

## §3 Daftar Produk (5-tab wizard) — most complex

URL: `produk/produk`

This is the canonical 5-tab wizard inherited from v1 analysis. Re-validated here with mobile considerations.

### Tab 1 — Informasi Produk

Fields:
- `name` (required, max 100)
- `description` (textarea, optional)
- `id_category` (required)
- `id_department` (optional)
- `unit` (dropdown — pcs, kg, liter, dozen, ...)
- `type` — Goods / Service / Recipe
- `barcode` (text, optional, scan support)
- `sku` (text, optional, auto-generated if empty)
- `image` (file, max 2 MB, 1:1 aspect, JPEG/PNG)
- `is_active`, `sort_order`, `is_favorite`

### Tab 2 — Harga

Fields:
- `price` (required, BigDecimal, IDR)
- `price_offline` (Advance+, optional — separate POS price)
- `price_modal` (HPP / cost) (required)
- `is_wholesale` (Advance+)
- Wholesale tier table (Advance+):
  - Rows: { qty_min, price_per_unit }
  - Validation: qty_min strictly increasing
- `tax_id` (optional, default outlet)
- `service_charge_id` (optional)
- Tax-exempt toggle

### Tab 3 — Varian

Variants are dimensions like Size, Color, Sweetness.
- "Tambah Varian Baru" → name + options (S/M/L)
- Each option: name + price delta + sub-SKU (optional)
- Drag to reorder

### Tab 4 — Resep / Bahan Baku (Advance+)

Only enabled if `type == Recipe`.
- "Tambah Bahan Baku" → pick existing raw material → qty + unit
- Recipe cost auto-computed from ingredient avg_cost

### Tab 5 — majoo Order (Online)

Fields for marketplace listing:
- `online_order_name` (override, optional)
- `online_order_image` (override, optional)
- `online_order_description` (textarea)
- `online_order_price` (override, optional)
- Per-marketplace toggle: GoFood / GrabFood / ShopeeFood / Tokopedia / etc

### Save flow

`POST /ms-master-data/api/v1/product` with full payload (or PUT for edit).

Validation:
- Name + SKU + barcode unique per merchant.
- Price > 0 (unless explicitly free).
- Price ≥ HPP warning (configurable).
- Image size ≤ 2 MB.

Offline:
- Save to local DB with `clientId`.
- Image stored locally; uploaded after sync.
- Server returns canonical `id`; client maps.

## §4 Produk Layanan

URL: `produk/produk-layanan`

Service-type products (no inventory, e.g. "Cuci Mobil 30 menit").
- Same wizard but `type = Service` is locked.
- No stock tab.
- Optional: duration field for reservation.

## §5 Produk Ekstra

URL: `produk/ekstra`

Reusable extra groups (toppings, sides, sauces) that can attach to multiple products.

Fields:
- `name` (required)
- `min_select` (int, ≥ 0)
- `max_select` (int, ≥ 1)
- `is_required` (boolean)
- Options: { name, price, is_active }

UI:
- Library of extra groups.
- On product wizard, attach existing extras (multi-select).

## §6 Produk Paket

URL: `produk/paket`

Bundle products (e.g. "Combo A = Burger + Fries + Drink at Rp 35.000").

Fields:
- Name, image, price (bundle price)
- Components: list of products + qty (no individual modifier)

POS behaviour:
- Add bundle as single line.
- Sale of bundle decrements component stock (or aggregate as bundle SKU).

## §7 Deposit (as product)

URL: `produk/deposit`

Customer deposit can be sold like a product (e.g. "Top up Deposit Rp 500.000").

Fields:
- Denomination (e.g. 100k / 250k / 500k)
- Bonus (free amount on top, e.g. "Topup 500k dapat 50k bonus")
- Validity (months)

POS:
- When a deposit product is sold, the customer's `depositBalance` is increased by the denom + bonus.

## §8 Penjadwalan Perubahan Resep

URL: `produk/jadwal-resep`

Schedule recipe changes (e.g. seasonal menu — recipe v2 effective from date X to Y).

Fields:
- Product
- Recipe v2 (full editor)
- Effective from / until

## §9 Daftar Harga Ojek Online

URL: `produk/harga-ojol`

Per-product per-marketplace price override (already covered in product wizard tab 5, but this is bulk-edit view).

UI:
- Table: product × marketplace columns; cells = price.
- Bulk edit: "Naik 10 % untuk semua GoFood".

## §10 Penjadwalan Harga

URL: `produk/jadwal-harga`

Time-bound price changes.

Fields:
- Product
- New price
- Effective from / until
- Outlets

E.g. "Promo akhir tahun: Diskon harga produk X dari 1-31 Des 2026".

## §11 Harga Berdasarkan Waktu

URL: `produk/harga-waktu`

Day/hour-based pricing.

Fields:
- Product
- Day-of-week mask
- Hour range
- Price for that window

E.g. "Happy Hour: Es Teh Rp 5.000 hari Senin-Jumat 14:00-17:00 (normal Rp 8.000)".

## §12 Cetak Barcode

URL: `produk/cetak-barcode`

Bulk barcode label printing.

UI:
- Select products.
- Choose label size (40×30, 40×40, 50×80).
- Choose info to include (name, price, barcode).
- Preview.
- "Cetak" → sends to label printer.

Mobile: Android app talks to a label printer over Bluetooth or USB.

## §13 Daftar Kategori Catatan

URL: `produk/kategori-catatan`

Pre-defined notes for cashier to add to cart line (e.g. "Tanpa Es", "Pedas", "Tidak ada bawang").

Fields:
- Category name (e.g. "Allergy", "Spice")
- Notes: list of strings

POS uses these for quick-add when adding cart note.

## §14 Master Resep

URL: `produk/master-resep`

Library of base recipes (sauces, dough, etc.) that can be ingredients in other recipes.

## §15 Mobile considerations

- Catalogue is master-cached on device.
- Image lazy-loaded with Coil; thumbnails for list, full-res on detail.
- Bulk operations (cetak barcode) require online (or queue locally for batch print).
- Multi-tab wizard: use Compose `HorizontalPager` with TabRow.
- Save draft state if user navigates away mid-wizard.
- Show progress indicator for long uploads (image upload).
- Form validation: real-time on field change.
