# Phase 2: Backend Hardening

> Production-ready backend: multi-tenant, audit, jobs, observability, migrate to Postgres.
> Goal: backend siap support 1000+ merchant tanpa rewrite.

**Estimasi total**: 6 minggu (8 tasks, mostly sequential)

> **Konteks strategis:** lihat [`launch_readiness_roadmap.md`](./launch_readiness_roadmap.md) untuk panduan tambahan di luar 8 task ini (PWA offline mode, RLS multi-tenant, E2E test pyramid, pilot strategy, onboarding wizard, dsb.) — penting agar VIPOS siap untuk pra-beta v0.0.1 setelah Phase 2 selesai.

## Tasks

---

### P2-01: Migrate SQLite → Postgres `[pending]`

**Goal**: Migrate dari `better-sqlite3` ke Postgres (pakai `pg` atau Prisma). Schema migration tools.

**Dependencies**: P0-01

**Outputs**:

- Postgres deployment di VPS (Docker compose) atau managed (Supabase/Neon di production)
- ORM/query layer: Prisma atau Knex (tim pilih) — recommendation Prisma
- Migration tool: Prisma Migrate
- Seed script porting dari better-sqlite3
- Backup/restore script
- ENV var: `DATABASE_URL`

**Acceptance criteria**:

- [ ] Postgres running di VPS (Docker)
- [ ] Schema sama dengan SQLite version (zero data loss)
- [ ] Migration tool berfungsi (`prisma migrate dev`)
- [ ] Seed script di-port
- [ ] Existing endpoints semua working
- [ ] Backup script jalan di cron (daily)
- [ ] Connection pooling enabled (max 20 connection per worker)

**Branch**: `devin/P2-01-postgres-migration`
**Estimasi**: 5-7 hari

---

### P2-02: Multi-tenant architecture `[pending]`

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

- [ ] User di tenant A tidak bisa lihat data tenant B (write tests)
- [ ] Tenant signup endpoint `/api/v1/tenant/register`
- [ ] Subscription tier stored di tenant record
- [ ] Tier-based feature flag enforced di backend (block call ke endpoint Prime kalau tier Lite)
- [ ] Admin endpoint untuk tenant management (`/api/admin/tenant/*`)

**Reference**: `docs/v2/06_FEATURE_TIERS.md`

**Branch**: `devin/P2-02-multi-tenant`
**Estimasi**: 4-5 hari

---

### P2-03: Audit logging `[pending]`

**Goal**: Setiap CUD action ke entity penting tercatat (siapa, kapan, apa, before/after).

**Dependencies**: P2-02

**Outputs**:

- Tabel `audit_logs` (tenant_id, user_id, entity, entity_id, action, before_json, after_json, ip, user_agent, timestamp)
- Middleware/decorator untuk auto-log mutation endpoint
- API: `/api/v1/audit-log` dengan filter
- UI: di P1-16 Pengaturan / Audit (Settings group)

**Acceptance criteria**:

- [ ] Mutation di Products, Customers, Inventory, Finance, Employee, Settings ter-log
- [ ] before/after JSON tersimpan dengan diff visible
- [ ] Filter: user, entity, date, action
- [ ] Retention 1 tahun (auto-prune)
- [ ] Export CSV

**Reference**: `docs/v2/menus/pengaturan/notifikasi.md` (deleted-transaction audit pattern)

**Branch**: `devin/P2-03-audit-logging`
**Estimasi**: 3 hari

---

### P2-04: Background jobs (BullMQ + Redis) `[pending]`

**Goal**: Job queue untuk async work (notification, email, settlement reconcile, report generation, marketplace webhook processing).

**Dependencies**: P2-01

**Outputs**:

- Redis di VPS (Docker)
- BullMQ workers
- Queues: `notification`, `email`, `report`, `settlement`, `marketplace-webhook`, `import-export`
- Job retry + DLQ
- Admin dashboard (Bull Board) di `/admin/queues`

**Acceptance criteria**:

- [ ] Send notification async via queue
- [ ] Generate report async, notify user lewat email saat done
- [ ] Marketplace webhook processed via queue (idempotent)
- [ ] Retry logic dengan exponential backoff
- [ ] DLQ untuk job yang fail > 3 kali
- [ ] Bull Board dashboard accessible (admin only)

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

### P2-07: API versioning + docs `[pending]`

**Goal**: API versioning strategy (v1/v2) + auto-generated docs (Swagger UI).

**Dependencies**: P0-04, P2-01

**Outputs**:

- Versioning: prefix `/api/v1/` (current) → siap migrate ke `/api/v2/` masa depan
- Deprecation header (`Deprecation: <date>`, `Sunset: <date>`)
- Swagger UI di `/api/docs` (auto-generated dari Zod schemas)
- Public API doc website (Stoplight atau hand-written)

**Acceptance criteria**:

- [ ] Semua endpoint pakai prefix `/api/v1/`
- [ ] Swagger UI mature, client (web + Android nanti) bisa pakai sebagai reference
- [ ] CHANGELOG.md di repo per version

**Branch**: `devin/P2-07-api-docs`
**Estimasi**: 2-3 hari

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
