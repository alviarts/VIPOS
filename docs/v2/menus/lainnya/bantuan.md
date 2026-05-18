# Bantuan (Help)

## §1 Panduan Penggunaan

URL: `guideline/online`

Online help docs.

Structure:
- Topics tree: by feature (POS, Inventory, Reports, etc).
- Each topic has: text, screenshots, video links, FAQs.

Search:
- Full-text across all topics.
- Suggest based on current screen (contextual help).

## §2 Masukan Perbaikan

URL: `support/feedback`

Submit feedback / bug reports / feature requests.

Form:
- Type (bug / feature / general)
- Title
- Description
- Screenshot attachment
- Auto-attach: app version, device, last action

## §3 Mobile considerations

- Help opens in WebView with local cache (offline reading).
- Contextual help icon in app: floating "?" → opens topic for current screen.
- Screen recording for bug reports: opt-in screen capture (Android 11+).

## §4 API

- `GET /api/v1/help-topic?q=`
- `GET /api/v1/help-topic/:slug`
- `POST /api/v1/feedback`
