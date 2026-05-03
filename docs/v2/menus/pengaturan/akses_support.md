# Akses Support

URL: `pengaturan-bisnis/support-access`

> Time-bounded access grant to Majoo support staff to investigate issues.

## §1 Use case

Merchant has a problem; Majoo support needs to log in as the merchant to debug.
Instead of sharing credentials, merchant grants temporary support access.

## §2 Flow

1. Owner taps "Berikan Akses Support".
2. Pick duration (1 hr / 4 hr / 24 hr / 72 hr).
3. Pick scope: read-only or full access.
4. Pick areas: all / specific (POS / Settings / Reports / Inventory).
5. Approve → support staff (specific Majoo user) granted access.
6. Audit log records every action support takes.
7. Auto-expires; merchant can revoke earlier.

## §3 List view

Active grants + history.

Columns: Grant ID, Granted to, Scope, Granted at, Expires at, Status (Active / Expired / Revoked).

## §4 Audit log

Every support action logged:
- Who (which support staff)
- What (which screen, action)
- When
- Result

## §5 Mobile considerations

- Owner-only.
- Push notification when grant approved + when support staff actively using.
- One-tap revoke.

## §6 API

- `GET/POST /api/v1/support-access`
- `POST /api/v1/support-access/:id/revoke`
- `GET /api/v1/support-access/:id/audit-log`
