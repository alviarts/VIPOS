# INSPIRASI (Content)

> Content marketing: blog, news updates, monthly magazine, events.

## §1 Informasi Update

URL: `informasi-update`

App + system update news.

Format: changelog list (newest first).

## §2 majoo blog (8 categories)

URL prefix: `blog`

Blog categories:
- Home (all posts)
- majoo berbagi
- Tren Bisnis
- Trivia
- Kisah Sukses
- Tips
- Inspirasi
- Edukasi

UI: card grid with post thumbnail + title + date.
Tap → article reader (WebView).

## §3 Event / Majoo Event

URL: `majoo-preneur/event`

Upcoming events: workshops, webinars, meetups.

Each event: title, date, location, description, RSVP button.

## §4 Majoo Preneur / Majalah Bulanan

URL: `majoo-preneur/magazine`

Monthly magazine PDF.

Tap issue → PDF reader.

## §5 Mobile considerations

- All content fetched online; cache last 30 articles for offline reading.
- WebView with custom CSS for in-app reading (consistent UX).
- Share button (WA, copy link, etc).
- Push notification on new article (optional, opt-in).
- Reading time estimate.

## §6 API

- `GET /api/v1/blog?category=&page=` (or external CMS API)
- `GET /api/v1/blog/:slug`
- `GET /api/v1/event?upcoming=true`
- `POST /api/v1/event/:id/rsvp`
- `GET /api/v1/magazine?year=` (list of issues)
- `GET /api/v1/magazine/:id/pdf`
- `GET /api/v1/changelog`

## §7 Open questions

- Blog content sourced from Majoo CMS or pulled from public website? `[inferred]` likely public WordPress / similar.
- Per-region content variation? `[unknown]`
