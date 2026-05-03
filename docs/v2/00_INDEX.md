# Majoo Analysis v2 — Android-App-Ready Reference for VIPOS

> **Purpose.** This v2 set is the *Android-development blueprint* derived from a passive analysis of the Majoo product (web dashboard + public marketing + Play Store + reseller feature matrices). v1 was UI/UX-overview oriented; v2 is feature-spec oriented and explicitly captures the things an Android engineer needs to make zero misses when building the mobile app.
>
> **No live API calls were made for v2.** All endpoint shapes that were not previously verified in v1 are marked `[inferred]`. Verified ones from v1 keep the `[verified]` marker. When live-login becomes available, re-validate every `[inferred]` row.

---

## How to read this set

The docs split into three layers:

```
┌───────────────────────────────────────────────────────────┐
│ Layer 1 — Foundation (00–16)                              │
│   Read these first. They tell you what Android-app-wide   │
│   primitives exist and how they are shaped.               │
└─────────────────────┬─────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────┐
│ Layer 2 — Per-menu deep-dives (menus/<group>/<menu>.md)   │
│   For every screen in the dashboard, what fields, what    │
│   endpoint, what mobile-specific quirks.                  │
└─────────────────────┬─────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────┐
│ Layer 3 — Raw extracts (assets/extracted/*)               │
│   595 API paths, 9146 i18n labels, role enums, tier       │
│   patterns — searchable corpora to confirm details.       │
└───────────────────────────────────────────────────────────┘
```

When designing an Android screen, the recommended flow is:
1. Find the matching menu under `menus/<group>/<menu>.md` to see fields & API.
2. Cross-check with `02_DATA_MODELS.md` for entity types.
3. Check `01_ANDROID_READINESS.md` for any mobile-specific concerns (offline, hardware, push).
4. Confirm role-gating in `05_PERMISSIONS.md` and tier-gating in `06_FEATURE_TIERS.md`.
5. Use `03_API_CONTRACT.md` for header conventions and pagination.

---

## Foundation docs (Layer 1)

| File | Topic | Why an Android dev needs it |
|---|---|---|
| `00_INDEX.md` | This file. | Map of the v2 doc set. |
| `01_ANDROID_READINESS.md` | Mobile-specific gap analysis. | The single highest-value doc — lists every place where "web works but mobile differs" with a concrete decision. |
| `02_DATA_MODELS.md` | Entity schemas (Product, Category, Customer, Transaction, Stock, Outlet, Employee, Promo, etc). | Maps to Room/Realm/Kotlin data classes. |
| `03_API_CONTRACT.md` | Per-endpoint catalog (URL, method, headers, request, response, errors, pagination). | Maps to Retrofit/OkHttp interfaces. |
| `04_AUTH_AND_SESSION.md` | Login flows, JWT lifecycle, refresh, logout, multi-device, employee PIN/passcode, biometric. | Determines `AuthInterceptor`, `TokenStore`, lock-screen behavior. |
| `05_PERMISSIONS.md` | Role × menu × action matrix. | Drives the menu visibility logic per role on mobile. |
| `06_FEATURE_TIERS.md` | Lite / Starter / Advance / Prime / Prime+ feature flag matrix. | Drives feature-gate UI, paywall surfacing, server-flag toggling. |
| `07_ERROR_CATALOG.md` | Error codes + Indonesian messages + UX guidance. | Drives `ErrorBody → UiState.Error` mapping with friendly strings. |
| `08_HARDWARE_INTEGRATION.md` | Bluetooth thermal printer (ESC/POS), barcode scanner, cash drawer, scale, customer display, KDS, Order Display, Self Order, Warehouse Display. | The biggest gap from v1 — covers every peripheral protocol. |
| `09_OFFLINE_AND_SYNC.md` | Offline POS mode, sync queue, conflict resolution, "Local Server" feature (LAN sync), background sync. | The second-biggest gap — Majoo POS works offline and that mechanic must be replicated. |
| `10_PUSH_AND_DEEPLINK.md` | FCM channels & topics, payload shape, deep link routes, foreground/background handling. | Required for order alerts, KDS pushes, marketing campaigns. |
| `11_RECEIPT_TEMPLATES.md` | Thermal 58mm / 80mm / A4 receipt formats per channel (kasir, checker, dapur, label, delivery). | Drives the receipt rendering pipeline. |
| `12_TAX_AND_FEES.md` | Tax (per-item / per-bill / multi-tax), service charge, MDR, rounding, kompliment. | Drives the bill calculator. |
| `13_PROMO_AND_LOYALTY.md` | Promo rules, loyalty earn/redeem, kupon, deposit, voucher. | Drives the cart's discount engine. |
| `14_PAYMENT_METHODS.md` | Cash, QRIS (static + dynamic), EDC (BCA/BRI/Mandiri/etc), e-wallet, deposit, voucher, split bill, settlement timing. | Drives the checkout flow + reconciliation screen. |
| `15_INVENTORY_FLOWS.md` | PO / GRN, opname, mutation, production (resep), COGS, batch, serial. | Drives stock screens + inventory state machine. |
| `16_REPORTS_CATALOG.md` | Every report (filters, columns, aggregation, export format). | Drives the report screens (dashboard + drilldown). |

## Per-menu deep-dives (Layer 2)

All 7 menu groups now have per-menu deep-dives:

```
docs/v2/menus/
  penjualan/         13 files — POS core, ~133 menus (pos_kasir, pos_dashboard,
                                produk_master, inventori_flows, pelanggan,
                                promo_kupon, komisi, invoice_b2b, marketing,
                                kitchen_reports, tutup_toko, settlement, _README)
  order_online/      5 files  — pesanan, majoo_order, marketplace, consumer_app, _README
  appointment/       3 files  — daftar, kalender, _README
  karyawan/          9 files  — karyawan_master, payroll, hak_akses, absensi,
                                majoo_teams, jadwal_kerja, master_data,
                                approval_workflow, _README
  keuangan/          8 files  — dashboard, buku_kas, penerimaan, pengeluaran,
                                aset_tetap, laporan_keuangan, chart_of_accounts, _README
  pengaturan/        14 files — akun_profile, outlet, notifikasi, pesan_masuk,
                                langganan, pembayaran_settings, cetak,
                                kasir_settings, terminal, akses_support,
                                produk_inventori_settings, reservasi_settings,
                                ekspor_import, _README
  lainnya/           6 files  — bantuan, layanan, inspirasi, capital, supplies, _README
```

Total: **58 per-menu files** covering all 11 nominal menu groups (293 menu items).

Each `<menu>.md` follows this template:

```markdown
# <Menu Name>

URL on web: <path>
Menu group: <group>
Required tier: <tier>
Required role: <roles>

## UI structure
- Header
- Filters
- Table / form / detail view
- Empty state
- Mobile note: <how this should adapt to Android>

## Fields
| Field | Type | Required | Validation | API key | Mobile note |

## API
| Method | URL | Auth | Request | Response | Errors |

## State machine (if any)
- Diagram

## Android-specific concerns
- Offline behavior
- Hardware tie-in
- Push trigger
- Deep-link
```

## Raw extracts (Layer 3)

| File | Lines | Description |
|---|---|---|
| `assets/extracted/api_paths_v2.txt` | 595 | Unique API path constants discovered in main + chunk bundles, with occurrence count. Superset of v1's 533. |
| `assets/extracted/i18n_labels.txt` | 9146 | Indonesian/English UI labels (button text, dialog copy, validation messages). Searchable with grep. |
| `assets/extracted/service_domains.txt` | 31 | Service-prefix mappings (e.g. `ms-master-data`, `svc-transaction`, `user-management`). |
| `assets/extracted/roles_privileges.txt` | 12 | Role and privilege constant values. |
| `assets/extracted/tier_patterns.txt` | 81 | Subscription tier mentions. |
| `assets/extracted/routes.txt` | 7 | Explicit React Router `path:"..."` entries (most routes are dynamic, see `docs/majoo_menu_flat.tsv` for the full menu inventory). |

## Marker conventions

Every API or behavior claim should carry one of:

- `[verified]` — Confirmed by live HTTP probe in v1 (only ~4 endpoints).
- `[inferred-bundle]` — Pattern matched against the de-minified webpack bundle. High confidence.
- `[inferred-marketing]` — Stated on a public Majoo or reseller marketing page. Medium confidence (marketing copy may simplify).
- `[inferred-ux]` — Reasoned from the user-facing UI (HTML snapshots, Play Store screenshots). Medium confidence.
- `[unknown]` — Not yet captured; flagged for re-validation.

When you (Devin or the human dev) re-run analysis with live access, promote each marker as you confirm it.

## Source provenance

| Source | What it gave us |
|---|---|
| `dashboard.majoo.id` main JS + 1063 chunks (~26 MB de-minified) | API paths, i18n labels, service registry, role enums |
| `https://majoo.id/news/...harga-paket-langganan` | Tier pricing (Starter / Advance / Prime, Oct 2023 update) |
| `https://portal.mangkujagat.com/harga/detail` (reseller) | **Full feature × tier matrix** — this is the most complete tier comparison we found |
| `play.google.com/store/apps/details?id=com.klopos` | Majoo POS Android feature description (kasir/inventori/akuntansi/CRM/owner/marketplace/payroll/loyalty) |
| `play.google.com/store/apps/details?id=id.majoo.lite` | Majoo Lite Android feature description (lighter tier; QRIS dinamis, struk digital, geolocation) |
| `https://majoolite.id/` | Majoo Lite product site (FAQ — system requirements: Android 5.1+ / iOS 13+, 3 GB RAM, 32 GB storage) |
| `docs/majoo_html/` (v1) | DOM snapshots of dashboard, produk, kategori, kasir-settings, outlet, pelanggan, ringkasan_penjualan |
| `docs/majoo_menu_flat.tsv` (v1) | 293 menu items (205 with URL) |
| `docs/majoo_api_paths.txt` (v1) | 533 API path constants (now superseded by 595 in v2) |

## Versioning

| Version | Date | Notes |
|---|---|---|
| v1.0 | 2026-05-03 (am) | UI/UX overview + bundle reverse-engineering. |
| v2.0 | 2026-05-03 (pm) | Re-analysis with Android-readiness lens. Added tier matrix, hardware spec, offline/sync/push specs, expanded API path corpus. |
| v2.1 | 2026-05-03 (pm) | Completed all 7 menu groups (58 per-menu files) covering all 293 menu items. |
