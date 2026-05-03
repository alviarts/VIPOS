# Daftar Appointment

URL: `appointment`

## §1 List view

Columns:
- Time (date + start time)
- Customer
- Service(s)
- Staff
- Resource (e.g. Room A)
- Duration
- Status
- Total Rp

Filters: status, date range, staff, customer.

Default sort: by date (today first).

## §2 Add / Edit form

Fields:
- `customer_id` (search existing or quick-add)
- `staff_id` (multi-select if team service)
- `services` (multi-select from service products)
- `start_at` (date + time picker)
- `duration` (auto from sum of services, editable)
- `resource_id` (optional)
- `notes`
- `deposit_amount` (optional pre-payment)

Validation:
- No double-booking for staff or resource
- Start time in operating hours
- Customer has valid phone (for reminders)

## §3 Reminders

- Customer SMS/WA 24 hr before
- Customer SMS/WA 1 hr before
- Staff push notification 1 hr before
- Each configurable

## §4 Reschedule

Tap appointment → "Reschedule" → new time picker.
Validates new slot.
Sends customer notification of change.

## §5 Cancel / No-Show

- Cancel: with reason; refund deposit if any (configurable).
- No-show: deposit forfeited (configurable); customer gets penalty flag.

## §6 Convert to transaction

When customer completes service:
- Tap "Selesai & Bayar" → opens POS prefilled with services.
- Cashier processes payment.
- Appointment marked COMPLETED, transaction linked.

## §7 API

- `GET /appointment/api/v1/appointment?from=&to=`
- `POST /appointment/api/v1/appointment`
- `PUT /appointment/api/v1/appointment/:id`
- `DELETE /appointment/api/v1/appointment/:id`
- `POST /appointment/api/v1/appointment/:id/checkin`
- `POST /appointment/api/v1/appointment/:id/complete`
