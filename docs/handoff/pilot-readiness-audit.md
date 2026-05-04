# VIPOS — Pilot-Readiness Audit (post-Phase 2 backend)

> **Generated:** 2026-05-04 by Devin pra-beta planning session
> **Scope:** What blocks VIPOS from accepting first 1-2 pilot merchants (alpha) per `launch_readiness_roadmap.md` §6.3
> **Output:** Prioritized gap list + recommended PR sequence (5 PRs, ~7-10 working days)

---

## TL;DR — top 5 gaps that block alpha pilot

1. **No public signup page** — backend `POST /api/v1/tenant/register` works, frontend has no `/signup` route. **Pilot merchants literally cannot create an account.** [BLOCKER, ~1.5 days]
2. **No onboarding wizard** — after signup, merchant lands on empty dashboard. No guided "outlet → first product → first sale". [HIGH, ~2 days]
3. **No frontend error monitoring (Sentry)** — when pilot merchants hit bugs, you get zero signal. Backend has Sentry; frontend doesn't. [HIGH, ~0.5 day]
4. **No sample data preset (F&B / Retail / Salon templates)** — empty account = top churn driver per roadmap §6.1. [MEDIUM, ~1.5 days]
5. **No PWA / offline mode** — explicit roadmap Top Priority #1; Indonesian outlets have flaky internet. **CRITICAL for kasir UX but largest scope.** [BIG, ~3-5 days for MVP, weeks for full sync]

**Recommendation:** ship 1+3+2+4 sequentially (~5-6 days total), defer #5 to a dedicated PWA phase after first 1-2 alpha merchants are signed up. PWA work needs real merchant data + transaction patterns to scope correctly.

---

## Gap matrix — 6 pillars

Legend: 🟢 ready · 🟡 partial · 🔴 missing · ⚪ out-of-scope

### Pillar A — Signup → onboarding flow

| Item                                            | State | Evidence                                                                    | Pilot blocker?    |
| ----------------------------------------------- | ----- | --------------------------------------------------------------------------- | ----------------- |
| Backend tenant register                         | 🟢    | `POST /api/v1/tenant/register` (P2-02) — creates tenant + first admin in tx | —                 |
| Frontend `/signup` page                         | 🔴    | `App.jsx` only has `/login`, `/forgot-password`, `/reset-password`          | **YES**           |
| Email verification step                         | 🔴    | No `/verify-email` route, no email send on signup                           | YES               |
| Onboarding wizard (5-step)                      | 🔴    | "onboarding" only appears in `Breadcrumb.jsx` as a label, no actual flow    | **YES**           |
| Sample data preset (industry template)          | 🔴    | No `seed-sample-data.js` or `template-fnb` artifact                         | YES               |
| In-app guided tour (`react-joyride`/`intro.js`) | 🔴    | Not in `package.json`, no `Tour.jsx` component                              | NO (nice-to-have) |
| Time-to-first-transaction tracking              | 🔴    | No `signup_at` / `first_transaction_at` instrumentation                     | NO (analytics)    |

### Pillar B — First-merchant data setup

| Item                                          | State | Evidence                                              | Pilot blocker?                    |
| --------------------------------------------- | ----- | ----------------------------------------------------- | --------------------------------- |
| Outlet creation page                          | 🟢    | `pages/pengaturan/OutletsPage.jsx`                    | —                                 |
| Product CRUD wizard                           | 🟢    | `ProductWizardForm.jsx` (multi-tab, modeled on Majoo) | —                                 |
| Categories / Departments                      | 🟢    | `CategoriesPage`, `DepartmentsPage`                   | —                                 |
| Customer setup                                | 🟢    | `CustomersPage`, customer groups, tags                | —                                 |
| Initial settings (logo, tax, currency, print) | 🟢    | `SettingsPage`, `pengaturan/PrintSettingsPage` (etc.) | —                                 |
| Excel import (products)                       | 🔴    | `exportTable` has CSV/xlsx export, no `importXlsx`    | NO (manual entry works for alpha) |
| Bulk customer import                          | 🔴    | None                                                  | NO                                |

### Pillar C — POS daily UX (kasir golden path)

| Item                                                  | State | Evidence                                                             | Pilot blocker?                                |
| ----------------------------------------------------- | ----- | -------------------------------------------------------------------- | --------------------------------------------- |
| Cashier page (ring-up, payment, receipt)              | 🟢    | `CashierPage.jsx`                                                    | —                                             |
| 2FA setup + login                                     | 🟢    | `Setup2FAPage`, AuthContext step-2 flow                              | —                                             |
| Receipt printing                                      | 🟢    | `pengaturan/PrintSettingsPage`                                       | —                                             |
| Service worker / offline mode (PWA)                   | 🔴    | `vite.config.js` has no `vite-plugin-pwa`, no `manifest.webmanifest` | **YES** (explicit roadmap Top #1)             |
| Optimistic UI for cart add/update                     | ❓    | Need to read `CashierPage` impl to confirm                           | NO (UX nice-to-have)                          |
| Loading skeletons                                     | 🟡    | `DashboardSkeleton.jsx` only — other pages spinner-only              | NO                                            |
| Error boundary (catch React render crashes)           | 🔴    | No `ErrorBoundary.jsx`, no `componentDidCatch`                       | YES (one render bug = white screen for pilot) |
| Browser-target verification (Chrome 95+, Safari iPad) | ❓    | No browserslist config in package.json                               | NO (verify during alpha)                      |

### Pillar D — Backup / recovery from user POV

| Item                                                | State | Evidence                                                         | Pilot blocker?     |
| --------------------------------------------------- | ----- | ---------------------------------------------------------------- | ------------------ |
| Daily DB backup → S3/R2                             | 🟢    | P2-08 PR-A `jobs/db-backup.js`                                   | —                  |
| Daily uploads backup                                | 🟢    | P2-08 PR-A `jobs/uploads-backup.js`                              | —                  |
| Weekly auto-restore-test                            | 🟢    | P2-08 PR-B `jobs/restore-test.js` (just merged)                  | —                  |
| Restore runbook                                     | 🟢    | `docs/runbook/disaster_recovery.md` (4 scenarios + §5 auto-test) | —                  |
| Failure notification (Sentry + email)               | 🟢    | `attachBackupFailureNotifier`                                    | —                  |
| Merchant-facing "last backup OK at HH:MM" indicator | 🔴    | No `/api/backup/status` endpoint or settings panel               | NO (admin concern) |
| Public status page (Statuspage / Upptime)           | 🔴    | None                                                             | NO (post-alpha)    |

### Pillar E — Pilot feedback channel

| Item                                            | State | Evidence                                                              | Pilot blocker?                          |
| ----------------------------------------------- | ----- | --------------------------------------------------------------------- | --------------------------------------- |
| In-app feedback (auth users)                    | 🟢    | `lainnya/HelpPage.jsx` → `POST /help/feedback`                        | —                                       |
| Help topics knowledge base                      | 🟢    | `GET /help/topics`, `GET /help/topics/:slug`                          | —                                       |
| Frontend Sentry (auto error capture)            | 🔴    | `package.json` has no `@sentry/react`; no `Sentry.init` in `main.jsx` | **YES** (you're flying blind otherwise) |
| WhatsApp / public support link                  | 🔴    | "whatsapp" only in marketing campaign builder, not support            | YES (Indonesian merchants prefer WA)    |
| User analytics (PostHog / Mixpanel / Plausible) | 🔴    | No `analytics.js` / no script tag                                     | NO (post-alpha)                         |
| Anonymous landing-page feedback (pre-signup)    | 🔴    | `/help/feedback` requires auth                                        | NO (post-alpha)                         |

### Pillar F — Operational baselines (cross-cutting; mostly Phase 2)

| Item                                             | State | Evidence                                                                                          |
| ------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------- |
| Postgres + RLS multi-tenant                      | 🟢    | P2-01 + P2-02 — RLS migrations `20260505200000_enable_rls_policies` + `_force_row_level_security` |
| Connection pooling                               | 🟢    | `db/driver-postgres.js` — `Pool({ max: PG_POOL_MAX })`                                            |
| Audit logging (immutable)                        | 🟢    | P2-03                                                                                             |
| Background jobs + Redis (BullMQ)                 | 🟢    | P2-04                                                                                             |
| Observability (Pino, Prometheus, Sentry backend) | 🟢    | P2-05                                                                                             |
| Rate limiting + security hardening               | 🟢    | P2-06                                                                                             |
| API versioning + Swagger                         | 🟢    | P2-07                                                                                             |
| Backup + DR                                      | 🟢    | P2-08 (PR-A + PR-B)                                                                               |

---

## Prioritized PR plan — 5 PRs to alpha-ready

### PR-1: Frontend Sentry + error boundary `[~0.5 day]`

**Why first:** Cheapest win. Future PRs ship faster when crashes are visible. Risk: green.

- Add `@sentry/react` + `Sentry.init` in `main.jsx`, wrap `<App>` in `ErrorBoundary` with friendly fallback ("Maaf, terjadi error — tim kami sudah mendapat notifikasi").
- Wire `VITE_SENTRY_DSN_FRONTEND` env (re-use Sentry org from backend).
- Add `<ErrorBoundary>` per top-level route inside `AppShell` so one page crash doesn't nuke the sidebar.
- Filter PII (no `username`, no token in breadcrumbs) per roadmap §4.3.

**Acceptance:**

- Throwing inside any page renders fallback UI, not white screen.
- Sentry DSN missing = no-op (dev / local stays clean).
- Tests: 1 spec — render an exploding child, assert fallback rendered.

### PR-2: Public signup page + email verify `[~1.5 days]`

**Why second:** This is the literal blocker — without it, no merchant can become a tenant.

- New route `/signup` in `App.jsx` (public, like `/login`).
- New `pages/SignupPage.jsx` — form: tenant_name, tenant_slug (auto-derived + editable), admin_name, admin_email, admin_username, admin_password (with strength meter), tier (default `lite`).
- POST → `/api/v1/tenant/register`, on success → store tokens → redirect to `/onboarding/welcome` (next PR).
- Email verification: send verification mail via existing email queue on signup (require backend route `POST /api/v1/auth/verify-email/{token}`); soft-block billing/tier upgrade until verified, but DON'T block kasir use (so alpha can still test immediately).
- "Sudah punya akun? Login" link to `/login`. Mirror back: "Belum punya akun? Daftar" on `/login`.

**Acceptance:**

- 4xx from `/tenant/register` shows inline field errors (slug taken, password too short).
- Successful signup logs the user in directly (no double-login).
- Tests: 3 specs — happy path, slug already exists, password validation.

### PR-3: Onboarding wizard (5 steps) `[~2 days]`

**Why third:** Bridges the empty-dashboard gap. Without this, churn at signup → "what do I do now?".

- Route `/onboarding/*`, gated on `tenant.onboarding_completed_at IS NULL` (new column, default `null`).
- Steps:
  1. **Welcome + business info** — business type (F&B / Retail / Salon / Lainnya), business name confirm, address.
  2. **First outlet** — outlet name, address, time zone (default WIB).
  3. **First product** — quick-add 3-5 products with template defaults per business type.
  4. **First customer (optional, skippable)** — name + phone for MVP.
  5. **Tour: "Coba transaksi pertama"** — deep-link to Cashier with the products preloaded.
- "Lewati" button on every step → marks `onboarding_completed_at = NOW()`, lands on Dashboard.
- Backend: `PATCH /api/v1/tenant/onboarding` to update step + completion timestamp.

**Acceptance:**

- Returning user with `onboarding_completed_at = null` always lands on `/onboarding`, not `/dashboard`.
- Skipping any step still completes onboarding; no required fields beyond signup.
- Tests: 4 specs — start, skip, complete, redirect-on-incomplete.

### PR-4: Sample data preset (F&B + Retail + Salon templates) `[~1.5 days]`

**Why fourth:** Onboarding step 3 needs real templates to feel useful. Standalone shippable; can land before or after PR-3 actually.

- New `apps/backend/src/data/onboarding-templates/` directory:
  - `fnb.json` — categories (Makanan / Minuman / Snack), 8 sample products with realistic IDR pricing.
  - `retail.json` — categories (Sembako / Snack / Minuman / Toiletries), 8 products.
  - `salon.json` — categories (Treatment Wajah / Rambut / Body / Produk), 8 services + 4 products.
- Endpoint `POST /api/v1/tenant/onboarding/seed-template` body `{ template: 'fnb' | 'retail' | 'salon' }` — idempotent (skips if categories already exist).
- Onboarding step 3 calls this and previews products before committing.

**Acceptance:**

- Calling the endpoint twice = no-op (idempotent on category names).
- All 3 templates render in Step 3 preview.
- Tests: 3 specs — seed each template, verify counts.

### PR-5: PWA + offline mode (deferred — separate phase) `[~3-5 days MVP, more for full]`

**Why deferred:** This is the largest scope and benefits most from real pilot transaction patterns. Roadmap §3.2 calls it Top Priority #1, but practically: get 1-2 alpha merchants on, observe their actual offline pain points, then design sync correctly. Building full offline-first sync without real workload data = guaranteed rebuild later.

**Pre-work to land in this phase (cheap subset):**

- `vite-plugin-pwa` + `workbox` registered in `vite.config.js`.
- Static manifest (`/vipos/manifest.webmanifest`) so Android/iOS users can "Add to Home Screen".
- App-shell caching (cache CSS/JS/HTML, network-first for `/api/*` with 5s timeout fallback to "offline" UI banner).
- **Don't implement** offline transaction queue yet — that's a multi-week project (sync conflict resolution, idempotency keys per row, IndexedDB schema versioning).

**Acceptance for the MVP subset:**

- App installs as PWA on Android Chrome.
- Going offline mid-session shows clear "Tidak ada koneksi — beberapa fitur tidak tersedia" banner.
- Online assets load from cache on next visit (Lighthouse PWA score >80).

---

## Out-of-scope for this audit (defer to later)

- **Mobile app (P3)** — premature until web validates with alpha.
- **Status page (Statuspage / Upptime)** — post-alpha, when there's actual uptime to report.
- **External pentest** — roadmap §5.1 lists Rp 30-50jt budget; do before GA, not before alpha.
- **Billing / subscription checkout** — `SubscriptionPage` shows tier info but real payment flow requires Midtrans/Xendit integration; alpha runs on `lite` (free) tier.
- **Localization (English)** — defer until non-Indonesian merchant requests it.
- **Visual regression testing (Percy / Chromatic)** — post-launch.
- **Load testing (k6 / Artillery)** — post-alpha, after we know real traffic shape.

---

## Suggested execution order

1. **PR-1 (Sentry + error boundary)** — ship Day 1 morning, low risk, high leverage.
2. **PR-2 (signup page)** — Days 1-2, requires backend already done.
3. **PR-4 (sample data preset)** — Days 3, can be parallel with PR-3 if you want; otherwise sequential.
4. **PR-3 (onboarding wizard)** — Days 4-5, integrates with PR-4 templates.
5. **Pause for alpha recruit** — sign 1-2 merchants, observe.
6. **PR-5 (PWA MVP subset)** — after alpha feedback, scope offline correctly.

**Total to alpha-ready: ~5-6 working days of code + alpha recruitment time.**

Ready to gas any of these? I'd suggest start with **PR-1 (Sentry + error boundary)** — fastest, lowest risk, makes every subsequent PR safer to debug.
