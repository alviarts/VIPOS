# Kalender Appointment

URL: `appointment-calendar`

## §1 View modes

- **Day** — single day, timeline 00:00-24:00, columns per staff or resource.
- **Week** — 7-day grid, rows = time slots, cols = days.
- **Month** — calendar grid; tap day to see appointments.

## §2 Interaction

- Drag-and-drop to reschedule.
- Click empty slot → "Tambah Appointment" prefilled with that time.
- Color-coded by service or status.

## §3 Filters

- Staff (multi-select) — only show appointments for these staff
- Resource — only show on resource availability
- Status — only show PENDING/CONFIRMED, etc

## §4 Mobile considerations

- Phone: Day view default, full-screen.
- Tablet: Week view default.
- Touch drag-to-reschedule with snap to nearest slot.
- Pinch-to-zoom for time scale.

## §5 API

- `GET /appointment/api/v1/calendar?from=&to=&staff=&resource=`

Returns slots + appointments + staff availability + resource availability.
