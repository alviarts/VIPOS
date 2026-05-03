# APPOINTMENT — Menu Group

> 5 menu items. Reservation/booking system. Used by service businesses (salon, spa, clinic, restaurant).

`[Advance+]`

## Inventory

| Menu | URL | File |
|---|---|---|
| Daftar Appointment | `appointment` | [`daftar.md`](daftar.md) |
| Kalender Appointment | `appointment-calendar` | [`kalender.md`](kalender.md) |

## Concepts

- **Appointment** — booking for a specific time slot, optionally tied to staff and resource.
- **Resource** — table, chair, treatment room, etc.
- **Slot** — discrete time bucket (e.g. 30 min).
- **Staff** — employee assigned to the appointment.

## Mobile considerations

- Calendar view: drag to reschedule, tap to edit.
- Push notification 1 hour before appointment.
- Customer self-booking via consumer app or storefront link.
- Walk-in: cashier creates ad-hoc appointment for now.

## Status flow

```
PENDING (customer self-booked, awaiting confirm)
  → CONFIRMED (staff confirmed)
  → IN_PROGRESS (customer arrived)
  → COMPLETED (post-service, can be billed)
  → CANCELLED / NO_SHOW (failure states)
```
