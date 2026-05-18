# Daftar Ekspor (Import / Export)

URL: `import-export-list`

> Bulk import/export operations.

## §1 Supported entities

Products, Categories, Customers, Vendors, Inventory, Stock Opname, Employees, Outlets.

## §2 Export

- Pick entity
- Pick filters (date range, outlet, etc)
- Pick format (CSV / Excel)
- Submit → server processes async
- Download link emailed when ready

Progress shown in list:
- Job ID, Entity, Filters, Status (PENDING / RUNNING / COMPLETED / FAILED), Started, Finished, Download link, Size.

## §3 Import

- Download template (CSV with required columns)
- Fill template
- Upload
- Server validates
- Preview: first 10 rows + errors highlighted
- Confirm → process async
- Result: success count, error count, error report

## §4 Common imports

- Bulk product creation (e.g. migrating from Excel)
- Bulk customer import (e.g. from existing CRM)
- Bulk inventory update (e.g. from physical opname spreadsheet)

## §5 Mobile considerations

- File picker for CSV upload.
- Status polling + notification.
- Download to device storage / share.

## §6 API

- `GET /api/v1/export?entity=&format=&filters=`
- `POST /api/v1/import`
- `GET /api/v1/import-export-job` (list)
- `GET /api/v1/import-export-job/:id` (status)

## §7 Open questions

- Excel format (.xlsx) supported in addition to CSV? `[inferred]` yes for export; CSV preferred for import (simpler).
- Max rows per import? `[unknown]` typical limits 10k-100k.
