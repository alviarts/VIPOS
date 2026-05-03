# Pengaturan Master (HR Master Data)

## §1 Tingkat Jabatan

URL: `master-setting/position-level`

Position levels (e.g. Staff → Senior Staff → Supervisor → Manager → Director).

Fields:
- Level name
- Hierarchy order
- Default base salary range
- Permissions inheritance

## §2 Organisasi

URL: `master-setting/organization`

Org chart.

UI: tree editor (drag/drop nodes).

Fields per node:
- Department / sub-team name
- Parent
- Manager (employee FK)

E.g.:
```
Toko Sederhana
├── Operasional
│   ├── Outlet Pusat
│   │   ├── Kasir
│   │   └── Dapur
│   └── Outlet Cabang
└── Backoffice
    ├── HR
    └── Keuangan
```

## §3 Tipe Karyawan

URL: `master-setting/employee-type`

Employment types.

Fields:
- Type name (e.g. "Permanent", "Contract", "Internship", "Part-time")
- Has BPJS (boolean — employer-funded)
- PPh21 calculation method
- Default contract length (months)
- Probation period (months)

Used for:
- Auto-fill new employee form
- Payroll component eligibility
- Compliance reports

## §4 Mobile considerations

- Master data rarely changes; cache aggressively.
- Owner App primary surface; Cashier App rarely needs.

## §5 API

- `GET/POST /master/api/v1/position-level`
- `GET/POST /master/api/v1/organization`
- `GET/POST /master/api/v1/employee-type`
