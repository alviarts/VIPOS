# Manajemen Aset (Fixed Assets)

> Track fixed assets (equipment, furniture, vehicles, real estate). Auto-depreciation.

`[Prime]`

## §1 Daftar Aset Tetap

URL: `asset-management/fixed-assets`

List of fixed assets.

Columns: Asset code, Name, Category, Acquisition date, Cost, Accumulated depreciation, Net Book Value, Status.

Add form:
- Asset code (auto)
- Name
- Category (FK)
- Acquisition date
- Cost (purchase price + setup costs capitalized)
- Useful life (years) — e.g. computer 4 yr, furniture 8 yr, vehicle 8 yr, building 20 yr
- Salvage value (estimated value at end of life)
- Depreciation method: STRAIGHT_LINE / DOUBLE_DECLINING / UNITS_OF_PRODUCTION
- Location / outlet
- Vendor (where purchased)
- Photo
- Documents (invoice, warranty)
- CoA mapping (e.g. 1501 Equipment account)

## §2 Penyusutan Aset Tetap

URL: `asset-management/depreciation-fixed-assets`

Periodic depreciation runs.

UI:
- Pick period (default current month).
- Preview: per asset, depreciation amount this period.
- Total depreciation expense.
- Approve → posts journal:
  - Dr Beban Penyusutan, Cr Akumulasi Penyusutan

Auto-run option: monthly auto-post on month-end.

Straight-line formula:
```
monthly_depreciation = (cost - salvage_value) / (useful_life_years * 12)
```

## §3 Pelepasan Aset Tetap (Disposal)

URL: `asset-management/disposal-fixed-assets`

When asset is sold, scrapped, or stolen.

Form:
- Asset to dispose
- Disposal date
- Disposal type: SOLD / SCRAPPED / DONATED / LOST
- Disposal proceeds (if sold)
- Buyer / vendor (if sold)

Posts journal:
- Dr Cash (proceeds)
- Dr Akumulasi Penyusutan (full)
- Cr Asset (cost)
- Cr/Dr Gain/Loss on Disposal (balancer)

## §4 Laporan Aset Tetap

URL: `asset-management/report-assets`

Reports:
- Asset register (all assets, current NBV)
- Depreciation schedule (per asset, per year, full life)
- Disposal log
- Asset turnover ratio (revenue / asset NBV)

Export: PDF, Excel.

## §5 Mobile considerations

- View asset list with photos.
- Tag asset with QR code; scan to verify location during audit.
- Photo capture for new asset registration.
- Disposal sign-off via PIN.

## §6 API

- `GET/POST /api/v1/fixed-asset`
- `POST /api/v1/depreciation/run`
- `POST /api/v1/fixed-asset/:id/dispose`
- `GET /api/v1/fixed-asset/report?type=`

## §7 Open questions

- Pajak final atas penjualan aset (final tax on asset sale)? `[unknown]`
- Tax-vs-book depreciation difference (deferred tax asset/liability)? `[inferred]` `[Prime+]` advanced accounting feature.
