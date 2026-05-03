# Terminal Settings

## §1 Daftar Perangkat

URL: `terminal-setting/device`

List of registered devices/terminals.

Columns: Device name, Type (POS Tablet / Android Phone / Self Order / KDS / Order Display), Outlet, Last seen, App version, Status.

Per device:
- Friendly name (e.g. "Tablet Kasir 1", "iPad Self Order Lt 2")
- Hardware ID (auto)
- Type
- Assigned outlet
- Default cashier (optional)
- Notes
- Last login + IP
- Force logout button

## §2 Perangkat Pay Go (Soundbox)

URL: `terminal-setting/soundbox`

Soundbox = audio confirmation device for QRIS payments. When customer pays via QRIS, it announces "Pembayaran sebesar X rupiah berhasil!".

Configuration:
- Pair via QR
- Language selection
- Volume
- Voice gender

## §3 Mobile considerations

- Each app install registers its device on first login.
- Owner can revoke device → forced logout next API call.
- Multi-device limit per outlet (per tier).

## §4 API

- `GET /api/v1/terminal`
- `POST /api/v1/terminal/register`
- `POST /api/v1/terminal/:id/revoke`
- `POST /api/v1/terminal/:id/force-logout`
- `GET/POST /api/v1/soundbox`
