# Pesan Masuk (Inbox)

URL: `message/inbox`

> System-generated messages (different from "Daftar Notifikasi" which is operational).

## §1 Message types

- Promotional offer from Majoo
- Subscription reminder
- Newsletter
- New feature announcement
- Maintenance notice
- Survey invitation

## §2 List view

Columns: Time, Subject, From (system / Majoo team), Status.

Filters: type, date range, read/unread.

## §3 Read view

Markdown content.
Can include CTA button (e.g. "Upgrade to Prime").
Inline images.

## §4 Mobile considerations

- Pull-to-refresh.
- Badge count on app icon (unread messages).
- Mark all as read.

## §5 API

- `GET /api/v1/inbox?from=`
- `POST /api/v1/inbox/:id/mark-read`
- `POST /api/v1/inbox/mark-all-read`
