# Outlet (Cabang)

## §1 Daftar Outlet

URL: `pengaturan-bisnis/cabang`

List of outlets (cabang/branches).

Columns: Name, Address, Type, Manager, Status (Active/Inactive), Created.

Add/edit form:
- Name (e.g. "Cabang Pusat", "Cabang Mall")
- Code (auto)
- Address + lat/lng (geocoded)
- Phone
- Email
- Type: DINE_IN / TAKEAWAY / RETAIL / SERVICE / KIOSK / FOOD_TRUCK / WAREHOUSE
- Operating hours (per day-of-week)
- Manager (FK to employee)
- Time zone (default Asia/Jakarta)
- Currency (default IDR)
- Tax rate override (optional, default global)
- Service charge override (optional)
- Receipt template override (optional)
- NPWP / NIB override (if outlet is separate legal entity)
- Logo override (optional)

Subscription tier determines max outlets:
- Lite: 1
- Starter: 1
- Advance: 5
- Prime: 25
- Prime+: unlimited

## §2 Denah dan Meja (Floorplan & Tables)

URL: `pengaturan-bisnis/floorplan-and-table`

For dine-in outlets: visual table layout.

UI (web):
- Floor selector (multi-floor)
- Drag-and-drop table editor (rectangle, circle, sofa shapes)
- Per table: number, capacity, type (regular/private/bar), QR code

Per outlet, multiple floors supported.

QR codes:
- Static per table (link to e-menu prefilled with table)
- Print as table tents

## §3 Mobile considerations

- View outlet list + switcher.
- Edit operating hours quickly.
- Add new outlet wizard (full form takes time, mostly tablet/web).
- Floorplan editor is web-only; mobile shows read-only floor view.
- POS uses table picker derived from floor plan.

## §4 API

- `GET/POST /api/v1/outlet`
- `PUT/DELETE /api/v1/outlet/:id`
- `GET/POST /api/v1/floorplan`
- `GET/POST /api/v1/table`
- `POST /api/v1/table/:id/qr` (regenerate QR)

## §5 Open questions

- Multi-tenant outlets (different legal entities under same merchant)? `[unknown]`
- Geo-fence per outlet for cashier check-in? `[verified]` see `karyawan/absensi.md`.
