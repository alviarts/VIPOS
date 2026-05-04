# Phase 2: Backend Hardening

> Production-ready backend: multi-tenant, audit, jobs, observability, migrate to Postgres.
> Goal: backend siap support 1000+ merchant tanpa rewrite.

**Estimasi total**: 6 minggu (8 tasks, mostly sequential)

> **Konteks strategis:** lihat [`launch_readiness_roadmap.md`](./launch_readiness_roadmap.md) untuk panduan tambahan di luar 8 task ini (PWA offline mode, RLS multi-tenant, E2E test pyramid, pilot strategy, onboarding wizard, dsb.) — penting agar VIPOS siap untuk pra-beta v0.0.1 setelah Phase 2 selesai.

## Tasks

---

### P2-01: Migrate SQLite → Postgres `[done]`

**Goal**: Migrate dari `better-sqlite3` ke Postgres (Prisma + Supabase). Schema migration tools + zero-data-loss data sync.

**Dependencies**: P0-01

**Outputs**:

- Postgres deployment: Supabase (managed, free tier ap-southeast-1) untuk staging/prod; Docker `postgres:17-alpine` untuk dev lokal (port 5433)
- ORM/query layer: **Prisma** (chosen over Knex; type-safe, Prisma Migrate, shadow DB)
- Migration tool: Prisma Migrate (`prisma migrate dev` dev, `prisma migrate deploy` prod)
- Data sync tool: `apps/backend/scripts/migrate-sqlite-to-postgres.mjs` (SQLite snapshot → bulk insert ke Postgres dengan zero-data-loss row-count parity verifier)
- Backup/restore script: `apps/backend/scripts/backup-postgres.sh` (pg_dump daily + opsional S3 offload)
- ENV var: `DATABASE_URL` (pooler 6543 transaction mode), `DIRECT_URL` (pooler 5432 session mode untuk migrate)

**Sub-task split (executed)**:

- **P2-01a — Infrastructure** `[done]`: Prisma + schema + initial migration + data sync tool + backup script + .env.example. Routes belum migrate; semua test masih jalan via better-sqlite3.
  PR: [#41](https://github.com/alviarts/VIPOS/pull/41) (merged 2026-05-04, sha `b9d6869`), session: https://app.devin.ai/sessions/b8f03d6f55d34ed1acb3242d3fb8f910
- **P2-01b — Route cutover + Postgres-only finalstep** `[done]`: Async query layer (`db/index.js` + `driver-postgres.js`), 25 route file di-cutover ke `await query(...)` dengan Postgres `$1, $2, ...` placeholder + `RETURNING`. SQLite-isms (`UNIQUE` error string match, `GROUP_CONCAT`, `MAX(a,b)` scalar, `COLLATE NOCASE`, `ROUND(double, n)`, `sqlite_master`) di-rewrite ke Postgres-portable SQL. `models/database.js`, `db/driver-sqlite.js`, `utils/seed.js`, `__tests__/db-query-layer.test.mjs` dihapus. `better-sqlite3` di-drop dari `package.json`. CI workflow tambah Postgres 16 service container + `npx prisma migrate deploy` step. 372/372 backend tests pass terhadap Postgres real.
  PR: [#43](https://github.com/alviarts/VIPOS/pull/43) (merged 2026-05-04, sha `f34c37e`), session: https://app.devin.ai/sessions/b119a589edff4feda4df2cc239454807

**Acceptance criteria**:

- [x] Postgres running (Supabase staging + Docker lokal) `[P2-01a]`
- [x] Schema sama dengan SQLite version (97 model di Prisma) `[P2-01a]`
- [x] Migration tool berfungsi (`prisma migrate dev/deploy`) `[P2-01a]`
- [x] Initial migration applied ke Supabase staging `[P2-01a]`
- [x] Backup script + restore drill `[P2-01a]`
- [x] Connection pooling enabled (PgBouncer 6543 transaction mode) `[P2-01a]`
- [x] Zero-data-loss verifier (row count parity per table) `[P2-01a]`
- [x] Seed script di-port (Postgres-native `db/init.js` — admin user, CoA, outlet, taxes, payment methods, UoM, lainnya defaults) `[P2-01b]`
- [x] Existing endpoints semua working di Postgres (372/372 backend tests pass) `[P2-01b]`
- [x] Drop better-sqlite3 dependency `[P2-01b]`

**Branch**: `devin/P2-01a-postgres-infrastructure` (P2-01a, merged), `devin/P2-01b-prisma-cutover` (P2-01b, merged)
**Estimasi**: 5-7 hari (P2-01a ✅ 1 hari, P2-01b ✅ ~2 hari)

---

### P2-02: Multi-tenant architecture `[done]`

**PR**: [#45](https://github.com/alviarts/VIPOS/pull/45) + [#46](https://github.com/alviarts/VIPOS/pull/46), session: https://app.devin.ai/sessions/240928c44aca4151ae91268e60dccc24

**Goal**: Setiap merchant = tenant terpisah, data isolated. Pakai schema-per-tenant atau row-level (recommend row-level dengan `tenant_id`).

**Dependencies**: P2-01

**Outputs**:

- Tabel `tenants`, `tenant_users`
- Migration: tambah `tenant_id` column ke semua tabel relevant
- Middleware: extract `tenant_id` dari JWT, inject ke setiap query
- ORM-level filter (Prisma extension untuk auto-include `tenant_id` di where)
- Tenant signup flow (admin creates tenant + first user)
- Subscription tier per tenant (Lite/Starter/Advance/Prime/Prime+)

**Acceptance criteria**:

- [x] User di tenant A tidak bisa lihat data tenant B (write tests)
- [x] Tenant signup endpoint `/api/v1/tenant/register`
- [x] Subscription tier stored di tenant record
- [x] Tier-based feature flag enforced di backend (block call ke endpoint Prime kalau tier Lite)
- [x] Admin endpoint untuk tenant management (`/api/admin/tenant/*`)

**Reference**: `docs/v2/06_FEATURE_TIERS.md`

**Branch**: `devin/P2-02-multi-tenant`
**Estimasi**: 4-5 hari

---

### P2-03: Audit logging `[done]`

**Goal**: Setiap CUD action ke entity penting tercatat (siapa, kapan, apa, before/after).

**Dependencies**: P2-02

**Outputs**:

- Tabel `audit_logs` (tenant_id, user_id, entity, entity_id, action, before_json, after_json, ip, user_agent, timestamp)
- Middleware/decorator untuk auto-log mutation endpoint
- API: `/api/v1/audit-log` dengan filter
- UI: di P1-16 Pengaturan / Audit (Settings group)

**Acceptance criteria**:

- [x] Mutation di Products, Customers, Inventory, Finance, Employee, Settings ter-log
- [x] before/after JSON tersimpan dengan diff visible
- [x] Filter: user, entity, date, action
- [x] Retention 1 tahun (auto-prune) — dijalankan oleh BullMQ recurring job (P2-04 PR-A)
- [x] Export CSV

**Reference**: `docs/v2/menus/pengaturan/notifikasi.md` (deleted-transaction audit pattern)

**Delivered in**: PR #48 (foundation: schema, helper, `/audit-log` API, login/logout hooks) + PR #49 (instrumentation: mutation endpoints + diff capture).

**Branch**: `devin/P2-03-audit-logging`
**Estimasi**: 3 hari

---

### P2-04: Background jobs (BullMQ + Redis) `[done]`

**Goal**: Job queue untuk async work (notification, email, settlement reconcile, report generation, marketplace webhook processing).

**Dependencies**: P2-01

**Outputs**:

- Redis di VPS (Docker)
- BullMQ workers
- Queues: `notification`, `email`, `report`, `settlement`, `marketplace-webhook`, `import-export`, `audit-retention`
- Job retry + DLQ
- Admin dashboard (Bull Board) di `/admin/queues`

**Acceptance criteria**:

- [x] Send notification async via queue — `POST /api/v1/notifications` (PR-B)
- [x] Generate report async, notify user lewat email saat done — `POST /api/v1/reports/schedule/:id/run` chains downstream email jobs per recipient (PR-C)
- [x] Marketplace webhook processed via queue (idempotent) — `POST /api/v1/marketplace-webhook/:tenant_slug/:provider` (PR-B)
- [x] Retry logic dengan exponential backoff — `lib/queue.js` default backoff (PR-A)
- [x] DLQ untuk job yang fail > 3 kali — built into `createWorker()` (PR-A)
- [x] Bull Board dashboard accessible (admin only) — `/api/admin/queues` (PR-B)

**Status breakdown**:

- **PR-A** (`#51`, merged): foundation — `lib/queue.js`, recurring `audit-retention` job, standalone worker entry point, CI Redis service.
- **PR-B** (`#52`, merged): producers + workers untuk `notification`, `email`, `marketplace-webhook` + Bull Board UI.
- **PR-C** (`#54`, merged): producers + workers untuk `report` (chained email orchestration), `settlement` (deterministic-jobId idempotency), `import-export` (RLS-scoped bulk insert). `WORKER_REGISTRY` extended ke 7 entry.

**Branch**: `devin/P2-04-background-jobs`
**Estimasi**: 3-4 hari

---

### P2-05: Observability (logging + monitoring + tracing) `[pending]`

**Goal**: Structured logging (Winston/Pino), error tracking (Sentry), metrics (Prometheus), tracing (OpenTelemetry).

**Dependencies**: P2-01

**Outputs**:

- Pino logger dengan JSON format, log level configurable per env
- Sentry SDK integration (free tier OK awal)
- Prometheus exporter di `/metrics`
- Health check `/health` extended (DB, Redis, dependencies)
- Tracing: OpenTelemetry → console di dev, Jaeger optional di production

**Acceptance criteria**:

- [ ] All API request logged dengan request_id, tenant_id, user_id
- [ ] Error throw → captured di Sentry
- [ ] `/metrics` expose RED metrics (request rate, error rate, duration)
- [ ] `/health` cek DB + Redis + version
- [ ] Trace dari API request → DB query visible

**Branch**: `devin/P2-05-observability`
**Estimasi**: 3-4 hari

---

### P2-06: Rate limiting + security hardening `[pending]`

**Goal**: Rate limit per IP + per user; helmet headers; input sanitization; CSRF; CORS strict.

**Dependencies**: P2-01

**Outputs**:

- `express-rate-limit` dengan Redis store
- Per-endpoint rate limit config (login: 5/min, API: 100/min)
- Helmet middleware
- CORS allowlist (vipos.id + custom domain merchants)
- Input sanitization (zod handle ini, plus DOMPurify untuk rich text)
- CSP header
- HTTPS enforcement (deploy via Let's Encrypt)

**Acceptance criteria**:

- [ ] Login endpoint terbatas 5 attempt/min/IP
- [ ] API endpoint default 100 req/min/user
- [ ] OWASP Top 10 checked (XSS, SQL injection (Prisma protect), CSRF, broken auth, dst)
- [ ] HTTPS enforced (HTTP redirect to HTTPS)
- [ ] CSP header strict

**Branch**: `devin/P2-06-security-hardening`
**Estimasi**: 3 hari

---

### P2-07: API versioning + docs `[done]`

> PR: [#39](https://github.com/alviarts/VIPOS/pull/39) (merged 2026-05-04), session: https://app.devin.ai/sessions/b8f03d6f55d34ed1acb3242d3fb8f910

**Goal**: API versioning strategy (v1/v2) + auto-generated docs (Swagger UI).

**Dependencies**: P0-04, P2-01

**Outputs**:

- Versioning: prefix `/api/v1/` (current) → siap migrate ke `/api/v2/` masa depan
- Deprecation header (`Deprecation: <date>`, `Sunset: <date>`)
- Swagger UI di `/api/docs` (auto-generated dari Zod schemas)
- Public API doc website (Stoplight atau hand-written)

**Acceptance criteria**:

- [x] Semua endpoint pakai prefix `/api/v1/`
- [x] Swagger UI mature, client (web + Android nanti) bisa pakai sebagai reference
- [x] CHANGELOG.md di repo per version

**Branch**: `devin/P2-07-api-versioning`
**Estimasi**: 2-3 hari

**Catatan eksekusi**:

- P2-07 dieksekusi sebelum P2-01 karena tidak butuh credential Postgres — cukup di SQLite. Dependency formal P2-01 di-bypass dengan asumsi schema endpoint tidak berubah saat migrate; saat P2-01 migrate, contract `/api/v1/*` sudah stabil dan hanya storage backend yang berubah.
- Legacy alias `/api/*` akan di-remove pada commit terpisah setelah sunset **2026-11-04** dan semua client confirm migrasi (web sudah migrate; Android di P3 akan langsung pin `/api/v1`).
- Stoplight / hosted public doc TIDAK dilakukan di scope ini — Swagger UI di `/api/docs` dianggap cukup untuk Phase 2. Hosted public doc bisa di-revisit di P5 GTM kalau perlu developer portal.

---

### P2-08: Backup + disaster recovery `[pending]`

**Goal**: Daily DB backup ke S3 (Backblaze B2 cheaper alternative), uploads backup, runbook recovery.

**Dependencies**: P2-01, P2-04

**Outputs**:

- Daily Postgres dump → upload ke S3 / B2
- Daily upload (uploaded files) → sync ke S3 / B2
- Retention: daily 30 hari, weekly 12 minggu, monthly 12 bulan
- Test recovery script (auto-test setiap minggu di staging)
- Runbook: `docs/runbook/disaster_recovery.md`

**Acceptance criteria**:

- [ ] Cron jalan harian, backup berhasil tersimpan
- [ ] Restore script tested berhasil di staging
- [ ] Runbook lengkap (langkah-langkah recovery)
- [ ] Notification kalau backup fail

**Branch**: `devin/P2-08-backup-dr`
**Estimasi**: 2-3 hari

---

## Definition of Done — Phase 2

- [ ] Postgres production-ready
- [ ] Multi-tenant data isolation tested
- [ ] Audit log mature
- [ ] Background jobs handle async work
- [ ] Observability mature
- [ ] Security hardening done
- [ ] API versioned + documented
- [ ] Backup + DR runbook ready

Backend siap support beban Phase 3 (Android sync), Phase 4 (full feature), Phase 5 (sub-apps webhook).
