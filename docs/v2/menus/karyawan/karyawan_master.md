# Daftar Karyawan

URL: `employee/employee-list`

## §1 List view

Columns:
- Photo, Name, Position, Outlet, Phone, Status (Active / Resigned), Date Joined.

Search: name, phone, position.

Filters: outlet, position, status.

## §2 Add / Edit form

### Personal info
- `name` (required)
- `nik_ktp` (KTP number, optional)
- `npwp` (optional)
- `birth_date`
- `birth_place`
- `gender` (M/F)
- `marital_status`
- `religion`
- `blood_type`
- `nationality`
- `photo` (face shot, used for login + attendance recognition)

### Contact
- `phone` (required for app login)
- `email` (optional)
- `address` (current)
- `address_ktp` (per KTP)
- `emergency_contact` { name, relation, phone }

### Employment
- `id_outlet` (primary outlet)
- `id_position_level` (FK to position level)
- `id_organization` (FK to org chart node)
- `id_employee_type` (FK to type — Permanent / Contract / Internship / etc)
- `date_joined`
- `date_resigned` (nullable)
- `id_role` (FK to system role — OWNER/MANAGER/CASHIER/etc)
- `id_payroll_structure` (FK)
- `bank_account_no`, `bank_name` (for payroll transfer)

### Documents
- KTP scan
- KK scan
- NPWP scan
- Diploma scan
- Contract scan

Each: PDF or image, max 5 MB.

### App access
- Username (for login, default = phone)
- PIN (4-6 digit, for POS)
- Send invite (sends WA/SMS with credentials)

## §3 Validation

- Phone unique per merchant.
- KTP unique per merchant (if provided).
- Username unique per merchant.

## §4 Mobile considerations

- Photo capture via camera (compressed to 800×800 px).
- Document upload: camera or file picker.
- Offline create allowed; sync on reconnect.

## §5 API

- `GET /user-management/api/v1/employee?merchant_id=`
- `POST /user-management/api/v1/employee`
- `PUT /user-management/api/v1/employee/:id`
- `POST /user-management/api/v1/employee/:id/invite`
- `DELETE /user-management/api/v1/employee/:id` (soft delete)

## §6 Open questions

- Soft-delete vs anonymize on resign? `[inferred]` soft-delete with status RESIGNED, retain for payroll history.
- Re-hire flow if same KTP returns? `[unknown]`
