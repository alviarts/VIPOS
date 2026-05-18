# majoo Teams (Employee App)

> Separate Android app for non-cashier employees (servers, kitchen, warehouse, salon staff).

`[Advance+]`

## §1 Akses majoo Teams

URL: `majoo-teams/access`

Configure who has access:
- Per employee: enable/disable
- Auto-create login on hire (if access enabled)

## §2 Kirim Notifikasi

URL: `majoo-teams/send-notification`

Owner/manager sends broadcast to employees.

Fields:
- Recipients: all / by outlet / by position / specific employees
- Title
- Message
- Attachment (optional, image or PDF)
- Send: now / scheduled

Use cases:
- Announcements
- Training reminders
- Shift swap requests
- Holiday schedules

## §3 What employees see in majoo Teams app

- Profile + photo
- Today's shift
- Check-in / out
- Payslip (current + history)
- Leave request
- Notification inbox
- Team directory
- HR documents
- Training videos (Prime+)

## §4 Mobile considerations

- This is a **separate APK** (different package name from cashier app).
- Different permission set (employee-only).
- Smaller app, focused on personal HR functions.
- For VIPOS v1, may skip building Teams app and use cashier app with reduced scope.

## §5 API

- `POST /api/v1/teams/notification` (send)
- `GET /api/v1/teams/notification?employee=` (list inbox)
- `GET /api/v1/teams/leave-request?employee=`
- `POST /api/v1/teams/leave-request`

## §6 Open questions

- Single app with role-based UI vs two separate apps? `[inferred]` Majoo has separate apps; VIPOS could go either way.
- Push notification segmentation per outlet? `[inferred]` yes via FCM topics.
