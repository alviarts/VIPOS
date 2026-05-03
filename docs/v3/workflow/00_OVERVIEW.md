# VIPOS Development Workflow — Master Overview

> Blueprint untuk membangun VIPOS sebagai produk POS lengkap (web + Android), dipecah menjadi tasks step-by-step yang bisa dikerjakan oleh Devin session berurutan / paralel.

## Status saat ini (per 2026-05-03)

- **Web app** `/vipos/` already deployed at http://103.74.5.44/vipos/ (PR #1 merged).
  - React + Vite + Tailwind frontend
  - Express + better-sqlite3 backend
  - Auth, Products, Categories, Customers, Inventory, Finance routes
  - Default admin/admin123
- **Analysis docs** `docs/v2/` merged (PR #2): 17 foundation docs + 58 per-menu deep-dives covering all 11 menu groups Majoo, jadi blueprint produk.

## Visi produk

VIPOS = **standalone POS** untuk SME Indonesia (F&B, retail, salon, klinik, jasa). Bukan proxy ke Majoo, hanya pinjam pola UI/struktur API. Multi-tenant, multi-outlet, offline-first di kasir, hardware-integrated (BT printer, scanner, drawer), tier-based subscription.

## Arsitektur target (Hybrid + Multi-form-factor)

```
                        ┌───────────────────────────┐
                        │   VIPOS Backend (Node)    │
                        │   /api/v1/*               │
                        │   Postgres / SQLite       │
                        │   JWT auth, RBAC          │
                        └───────────┬───────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
   ┌────────▼────────┐    ┌─────────▼─────────┐    ┌───────▼─────────┐
   │  Web Dashboard   │    │  VIPOS Mobile     │    │  Sub-apps       │
   │  vipos.id        │    │  (Android, 1 APK) │    │  (Android,      │
   │                  │    │                   │    │   APK terpisah) │
   │  React + Vite    │    │  Kotlin + Compose │    │                 │
   │                  │    │                   │    │  • KDS          │
   │  • Owner dash    │    │  Phone mode:      │    │  • Self Order   │
   │  • Master data   │    │   monitoring,     │    │  • Customer     │
   │  • Reports       │    │   approvals,      │    │    Display      │
   │  • Marketing     │    │   karyawan        │    │                 │
   │  • Finance       │    │  Tablet mode:     │    │                 │
   │  • E-menu QR     │    │   POS Kasir,      │    │                 │
   │  • Pre-sales     │    │   hardware,       │    │                 │
   │  • Help          │    │   offline-first   │    │                 │
   └──────────────────┘    └───────────────────┘    └─────────────────┘
```

**Tech stack:**
| Layer | Tech | Why |
|---|---|---|
| Web | React + Vite + Tailwind + React Router | Sudah ada di /vipos/; mature; team productive |
| Backend | Node.js + Express; better-sqlite3 → Postgres | Already running; Postgres saat scale > 100 merchant |
| Mobile | **Kotlin + Jetpack Compose** | Native performance, hardware integration, adaptive layout via WindowSizeClass |
| Storage local mobile | Room + DataStore | Offline-first POS; outbox queue |
| Sync | WorkManager + Retrofit + custom outbox | Reliable background sync, exponential backoff |
| Hardware | Bluetooth Classic (ESC/POS), USB Host (scanner), Camera2 + ML Kit | Native APIs, mature libraries |
| Auth | JWT + refresh token + biometric | Industry standard; merchant trust |
| Push | FCM | Free, reliable, deep-link friendly |
| CI/CD | GitHub Actions | Already authenticated; no extra cost |
| Hosting | VPS 103.74.5.44 (current) → upgrade to managed/cloud at scale | Cost-effective for early stage |

## Phases

| Phase | Goal | Tasks | Estimasi (sequential) | Bisa paralel? |
|---|---|---|---|---|
| **Phase 0** Foundation | Setup monorepo, CI/CD, code style, type-safe API contract | 5 | 2 minggu | Limited (sequential) |
| **Phase 1** Web Dashboard | Polish /vipos/ jadi Owner Dashboard penuh untuk semua 11 menu group | 18 | 8-10 minggu | Yes (across menu groups) |
| **Phase 2** Backend hardening | Multi-tenant, audit, jobs, observability, migrate to Postgres | 8 | 6 minggu | Limited (some sequential) |
| **Phase 3** Android Kasir MVP | POS core + offline + hardware + push, ship beta | 22 | 12-14 minggu | Yes (UI vs hardware vs sync) |
| **Phase 4** Android Kasir Full | Order online, reservation, inventory mutation, reports, karyawan | 16 | 10-12 minggu | Yes |
| **Phase 5** Specialized apps | KDS, Self Order, Customer Display | 11 | 6-8 minggu | Yes (per app) |
| **Phase 6** GTM | Landing, marketing, beta merchant, sales material | 6 | 4 minggu | Yes |
| **Total** | | **86 tasks** | **48-56 minggu (~12-14 bulan)** | Real time bisa **8-10 bulan** dengan team paralel |

## Critical path (kalau cuma 1 Devin per waktu)

```
P0-01 → P0-02 → P0-03 → P0-04 → P0-05 (Foundation, 2 minggu)
       │
       ↓
P1-01 → P1-02 (Layout shell + Auth, 1 minggu, dependency keras)
       │
       ↓
P1-03..P1-18 paralel (banyak menu groups, bisa banyak Devin sekaligus)
       │
       ↓
P2-01 → P2-02 (Multi-tenant + Postgres migration, dependency keras untuk Phase 3)
       │
       ↓
P3-01 → P3-02 → P3-03 → P3-04 → P3-05 (Android bootstrap + auth + sync, 4 minggu)
       │
       ↓
P3-06..P3-22 paralel (UI, hardware, payment, dst, banyak Devin)
       │
       ↓
P4..P6 paralel
```

## Dependency graph (high-level)

```
[Phase 0 Foundation]
        │
        ▼
[Phase 1 Web Dashboard]      [Phase 2 Backend hardening]
        │                            │
        └──────────┬─────────────────┘
                   │
                   ▼
        [Phase 3 Android Kasir MVP]
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
[Phase 4 Android Full]   [Phase 5 Specialized apps]
        │                     │
        └──────────┬──────────┘
                   ▼
            [Phase 6 GTM]
```

Phase 1 dan Phase 2 bisa paralel karena beda surface (web vs backend), tapi banyak tasks Phase 1 butuh API yang dibangun di Phase 2.

## Prinsip kerja

### 1. Reference docs

Semua tasks merujuk ke `docs/v2/` analysis Majoo sebagai blueprint:
- `docs/v2/menus/<group>/<menu>.md` untuk per-menu spec
- `docs/v2/02_DATA_MODELS.md` untuk entity schemas
- `docs/v2/03_API_CONTRACT.md` untuk API conventions
- `docs/v2/05_PERMISSIONS.md` untuk role-based access
- `docs/v2/06_FEATURE_TIERS.md` untuk subscription tier gating
- `docs/v2/08_HARDWARE_INTEGRATION.md` untuk hardware (Phase 3+)
- `docs/v2/09_OFFLINE_AND_SYNC.md` untuk offline-first (Phase 3+)

### 2. Branch convention

Setiap task = 1 branch + 1 PR.

```
devin/P{phase}-{nn}-{slug}
```

Contoh: `devin/P3-07-pos-cart-ui`, `devin/P1-04-products-page`.

### 3. PR & merge convention

- Setiap task selesai → buat PR ke `main`.
- PR description pakai template `templates/pr_template.md`.
- Merge strategy: **squash merge**.
- Setelah merge, branch delete.
- Task spec di phase doc di-mark `[done]` di update berikutnya.

### 4. CI gates

Setelah Phase 0 selesai, tiap PR harus pass:
- Lint (web + backend + Android)
- Type check (TypeScript + Kotlin)
- Unit test
- Build (web bundle + Android debug APK)

Hanya Phase 6 marketing tasks yang bisa skip (docs only).

### 5. Definition of Done (DoD)

Task dianggap done kalau:
- [ ] Semua acceptance criteria terpenuhi
- [ ] PR di-create dengan template lengkap
- [ ] CI pass
- [ ] Code reviewed (atau self-reviewed kalau solo)
- [ ] Merged to main
- [ ] Updated `docs/v3/workflow/<phase_file>.md` mark task `[done]`

### 6. Markers

Setiap task akan punya marker status:
- `[pending]` — belum mulai
- `[in_progress]` — sedang dikerjakan oleh Devin session X (link ke session)
- `[done]` — merged to main
- `[blocked]` — terblokir, lihat note untuk reason

### 7. Update flow

Kalau task selesai dan Anda perlu update workflow doc itu sendiri:
1. Mark task `[done]` di phase doc
2. Update progress percentage di 00_OVERVIEW.md
3. Commit + push ke main (langsung, tanpa PR untuk update marker — biar gampang)

## Cara assign task ke Devin

Lihat `01_HOW_TO_USE.md` untuk template prompt dan workflow.

## Ringkasan Phase isi

| Phase | File | Highlight |
|---|---|---|
| 0 | `phase_0_foundation.md` | Monorepo struktur, CI/CD, OpenAPI/Zod, lint, husky |
| 1 | `phase_1_web_dashboard.md` | Layout shell, Auth, semua 11 menu group web pages |
| 2 | `phase_2_backend.md` | Multi-tenant, audit, jobs, observability, Postgres |
| 3 | `phase_3_android_kasir_mvp.md` | Android bootstrap, sync, POS core, hardware, payment, beta |
| 4 | `phase_4_android_kasir_full.md` | Order online, reservation, inventory, reports, karyawan |
| 5 | `phase_5_specialized_apps.md` | KDS, Self Order, Customer Display |
| 6 | `phase_6_gtm.md` | Landing, marketing site, beta program, sales kit |

## Versioning

| Version | Date | Notes |
|---|---|---|
| v3.0 | 2026-05-03 | Initial workflow blueprint berdasarkan v2 analysis. |
