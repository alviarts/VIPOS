# Reservasi Settings

URL: `reservation-setting`

Reservation/booking system config (used for tables in F&B).

## §1 Fields

- Enable reservations (boolean)
- Reservation lead time min (e.g. 30 min ahead)
- Reservation lead time max (e.g. 30 days ahead)
- Slot duration (default 30 min)
- Capacity strategy: per-table / per-outlet
- Deposit required (boolean)
- Deposit amount (% of estimated bill or fixed)
- Cancellation policy (free up to X hours before)
- Reminder schedule (24 hr + 1 hr default)

## §2 Operating hours

Reservations only allowed during outlet operating hours.

## §3 Holiday calendar

Block reservations on closed days.

## §4 Walk-in handling

- Reserved tables blocked for walk-ins X minutes before reservation start.
- Configurable buffer.

## §5 Mobile considerations

- Owner / Manager configures.
- Cashier sees today's reservations on POS dashboard.
- Push notification 30 min before reservation arrives.

## §6 API

- `GET/PUT /api/v1/setting/reservation`
