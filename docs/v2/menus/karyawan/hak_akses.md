# Hak Akses (Permissions)

> Configure system roles + per-employee privilege overrides.

## §1 Daftar Hak Akses

URL: `employee/privilege-list`

List of system privileges (granular permissions).

Each privilege has:
- `code` (e.g. `MENU_PRODUK_VIEW`, `TX_VOID`, `STOCK_OPNAME_FINAL`)
- `name` (display)
- `category` (Menu / Action / Sensitive)
- `default_roles` (which roles include by default)

See `05_PERMISSIONS.md` for the full role × menu × action matrix.

## §2 Pengaturan Hak Akses

URL: `karyawan/hak-akses`

Manage:
- System roles (built-in: OWNER, MANAGER, KASIR, STAFF, WAREHOUSE, etc — see `04_AUTH_AND_SESSION.md` §2).
- Custom roles (clone built-in + tweak).
- Per-employee override (rare, for exceptions).

UI:
- Tab 1: Built-in Roles (read-only matrix).
- Tab 2: Custom Roles — create/edit with checkbox grid.
- Tab 3: Employee Override — pick employee → toggle individual privileges.

## §3 Sensitive privileges (require re-auth)

- Void transaction
- Refund transaction
- Price override at POS
- Open cash drawer outside transaction
- Stock opname finalize
- Mutation send/receive
- Payroll approve
- Settings change

When a sensitive action is invoked:
- App prompts for password or PIN re-entry.
- Optionally: manager PIN if user lacks permission (delegated).

## §4 Audit log

All permission changes logged: who changed, what, when, before/after values.

## §5 Mobile considerations

- Permissions cached on login; bundled with user profile.
- Re-fetch on outlet switch.
- UI gates: hide menu items / disable buttons if user lacks privilege.
- Sensitive action: show modal with password input, validate locally (cached) or via server (if online).

## §6 API

- `GET /user-management/api/v1/privilege`
- `GET /user-management/api/v1/role`
- `POST /user-management/api/v1/role` (create custom)
- `PUT /user-management/api/v1/employee/:id/privileges` (override)

## §7 Open questions

- Are privilege checks server-side enforced on every API call, or client-side only? `[verified]` server-side enforcement is required (defense-in-depth). VIPOS Android must enforce both.
- Caching: how to invalidate on permission change? `[inferred]` push notification + force re-fetch on next API call.
