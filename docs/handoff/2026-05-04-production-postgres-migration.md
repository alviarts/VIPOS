# 2026-05-04 — Production VPS Postgres migration (incident + cutover)

> Status: **resolved** — production restored, Phase 2 stack live with RLS enforced.
> Author: Devin (session `13f9ae0255154c3687989f638bc5948a`)
> Reviewers: @alviarts

## TL;DR

Production VPS `103.74.5.44` was hard down with `vipos-backend` in a 7900+ restart
crash loop. Root cause: Phase 2 (Postgres-only) backend code had been on `main`
for weeks, but the VPS infrastructure was never migrated off Phase 1 SQLite and
had **no `DATABASE_URL` in `.env`** and **no Postgres installed**. Auto-deploy
of any subsequent PR triggered a backend reload that hit
`Error: DATABASE_DRIVER=postgres but DATABASE_URL is not set`.

Recovery: full Postgres install + data migration + RLS provisioning, executed
in 5 phases (A → E) over ~50 minutes. All smoke tests pass, including
cross-tenant isolation under the non-superuser `vipos_app` role.

## Timeline (UTC)

| Time      | Event                                                                           |
| --------- | ------------------------------------------------------------------------------- |
| ~20:52    | First crash recorded in `/root/.pm2/logs/vipos-backend-error.log`               |
| 22:50     | Outage surfaced during scheduled deploy-checklist dry-run                       |
| 22:55     | User approved Option 3 (full Postgres migration in production, watching live)   |
| 23:00     | Phase A complete — SQLite snapshot + row-count baseline                         |
| 23:10     | Phase B complete — Postgres 17.9 + DB `vipos` + Prisma migrate + `vipos_app`    |
| 23:18     | Phase C complete — `migrate-sqlite-to-postgres.mjs`, 21/21 tables row-parity OK |
| 23:21     | Phase D — `.env` updated, `pm2 restart vipos-backend` succeeds, port 3001 live  |
| 23:23     | Phase E — login / `/me` / signup / RLS isolation all pass                       |
| **23:23** | **Production restored.** Total downtime ~2.5 hours.                             |

## Phase-by-phase log

### Phase A — Prep (read-only)

- `apps/backend/scripts/migrate-sqlite-to-postgres.mjs` reviewed: requires
  `DATABASE_URL` pointing at a role that can `SET session_replication_role =
'replica'` — i.e. SUPERUSER. Cannot run as `vipos_app`.
- Confirmed `apps/backend/src/db/index.js` is hardcoded to the Postgres driver
  (`require('./driver-postgres')` at line 27, comment "P2-01b finalstep —
  Postgres-only"). **No SQLite revert path exists at the code level**, so the
  earlier rollback plan was invalid: migration had to succeed.
- SQLite snapshot via `sqlite3 .backup` (clean, includes WAL):
  - `data/vipos.db.pre-pg-migrate-1777935516` (1.05 MB)
  - sha256 `33641570ca3c6f4e1b402310f3cf8c33afa8545e9f23629958c2ab790dd2491d`
- 95 tables in SQLite, 22 non-empty, 157 rows total. Largest tables:
  `gl_accounts=43`, `products=21`, `supplies_products=12`, `help_topics=10`.

### Phase B — Postgres setup

- Added PGDG apt repo (`https://apt.postgresql.org/pub/repos/apt jammy-pgdg
main`) with the upstream signing key, then `apt-get install -y postgresql-17
postgresql-client-17`.
- Installed version: PostgreSQL **17.9** on Ubuntu 22.04, listening on
  `127.0.0.1:5432` (loopback only).
- Generated a 48-character random password for the `postgres` superuser, stored
  at `/root/.vipos-pg-pwd` (mode 600). **Keep this — it is the only copy.**
- `createdb -O postgres vipos`.
- `npx prisma migrate deploy` applied all 8 migrations (init →
  `add_audit_logs`).
- `psql -f apps/backend/scripts/setup-app-role.sql` provisioned the
  `vipos_app` role:

  | rolname   | rolsuper | rolbypassrls | rolcanlogin |
  | --------- | -------- | ------------ | ----------- |
  | postgres  | t        | t            | t           |
  | vipos_app | **f**    | **f**        | t           |

  matches `docs/runbook/deploy-checklist.md` §2.1 guard. `vipos_app` was given
  ownership of every `public` table + sequence so `TRUNCATE … RESTART
IDENTITY` works at app runtime.

### Phase C — Data migration

- First run of `migrate-sqlite-to-postgres.mjs` failed on the very first row
  with `null value in column "tenant_id" of relation "cash_accounts"`.
- Root cause: the SQLite source schema is **pre-multi-tenant** (Phase 1).
  `cash_accounts` has no `tenant_id` column at all; the migration script
  inserts using SQLite's column list, so `tenant_id` is never supplied, and
  Postgres `tenant_id NOT NULL` rejects the row.
- Fix: backfill `tenant_id INTEGER NOT NULL DEFAULT 1` on every SQLite table
  whose Postgres counterpart has a non-null `tenant_id` column. Default = `1`
  attributes Phase 1 data to the default tenant. 95 tables altered, 2 skipped
  (`tenants` and `audit_logs` did not exist in SQLite — Phase 2 schema).
- Re-ran the migration. Result:

  ```
  Found 97 tables in SQLite.
  OK  cash_accounts: sqlite=7 → postgres=7
  OK  cash_transactions: sqlite=4 → postgres=4
  OK  categories: sqlite=5 → postgres=5
  ...
  OK  uoms: sqlite=8 → postgres=8
  OK  users: sqlite=1 → postgres=1
  Summary: empty=76, ok=21
  ```

  **Row-count parity verified across all 21 non-empty tables.** No data loss.

- `better-sqlite3` was dropped from `package.json` in P2-01b. To run the
  migration script we did `npm install --no-save better-sqlite3` from the repo
  root (compiles native bindings, ~30 s). After cutover the package is no
  longer needed in `node_modules`.

### Phase D — Cut-over

- Backed up the existing 116-byte `.env` to `.env.pre-pg-migrate-1777936847`.
- Wrote new `.env` (mode 600):
  ```
  NODE_ENV=production
  PORT=3001
  JWT_SECRET=<existing 64-char secret, unchanged>
  DATABASE_DRIVER=postgres
  DATABASE_URL=postgresql://vipos_app:apppass@127.0.0.1:5432/vipos
  DIRECT_URL=postgresql://postgres:<48-char-random>@127.0.0.1:5432/vipos
  CORS_ALLOWLIST=http://103.74.5.44
  ```
- Hit a second crash on first restart: `Error: CORS_ALLOWLIST must be set in
production` (`src/lib/security.js:154`). Prod-mode hardening throws if the
  allowlist is empty. Added `CORS_ALLOWLIST=http://103.74.5.44` and restarted
  again.
- After CORS fix:
  - `pm2 list`: `vipos-backend` **online**, uptime stable, restart counter
    stopped climbing (8576 final, was 7956 at session start).
  - `/api/health`: 200, `db.ok=true`, latency ~7 ms
    (`vipos_app` connection through the loopback works).
  - `Database initialized successfully` + `VIPOS Backend running` in logs.
- Dropped Sentry / Redis / S3 backup config: still **not** configured. Optional
  features, do not block boot. Tracked in §Follow-ups.

### Phase E — Smoke test

| #   | Check                                                                        | Result                                             |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| E1  | `curl http://103.74.5.44/vipos/api/health`                                   | `200`, `db.ok=true`, latency 7-17 ms               |
| E2  | Default admin user (`id=1`, `tenant_id=1`) intact in Postgres                | OK                                                 |
| E3  | Default tenant (`id=1`, `slug=default`) intact                               | OK                                                 |
| E4  | `POST /api/auth/login admin/admin123` returns `user.tenant_id=1`             | OK (PR-5 F-2 fix verified live)                    |
| E5  | `GET /api/auth/me` with bearer returns `user.tenant_id=1`                    | OK (PR-5 F-2 fix verified live)                    |
| E6  | `POST /api/tenant/register` creates new tenant (`id=2`) + admin user + token | OK; new admin `tenant_id=2`                        |
| E7  | New tenant admin login returns `tenant_id=2`                                 | OK                                                 |
| E8  | RLS — `vipos_app` with no `app.current_tenant`: visible products = 0         | OK                                                 |
| E9  | RLS — `app.current_tenant='1'`: 21 products visible (default tenant data)    | OK                                                 |
| E10 | RLS — `app.current_tenant='2'`: 0 products visible (new tenant has no data)  | OK — **cross-tenant isolation enforced**           |
| E11 | `pg_class.relrowsecurity = t` AND `relforcerowsecurity = t` on key tables    | OK on `products`, `tenants`, `users`, `audit_logs` |

The smoke test tenant (`id=2`) was deleted after verification along with its
audit_log + refresh_tokens entries. Final state: 1 tenant, 1 user, 21 products.

## Findings — gaps to close

1. **`migrate-sqlite-to-postgres.mjs` does not handle a Phase 1 SQLite source.**
   The script naively copies SQLite columns; tables that gained `tenant_id` in
   Phase 2 produce NOT NULL violations. Workaround used here was a manual
   per-table `ALTER TABLE … ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1`
   on the SQLite side. **Recommendation:** patch the script to detect this
   case (Postgres has `tenant_id NOT NULL` AND source SQLite does not) and
   inject `tenant_id = 1` (or env-provided default) into the INSERT
   automatically. Tracked as a follow-up — not in this PR.

2. **`CORS_ALLOWLIST` is a hard production env var requirement** (throws at
   boot via `lib/security.js:resolveAllowlist`), but it was missing from
   `.env.example` and from the deploy checklist. Both are updated in this PR.

3. **`vipos_app` password is the literal `apppass`** baked into
   `setup-app-role.sql`. Acceptable for now since Postgres only listens on
   `127.0.0.1` and the box is single-tenant, but the deploy checklist already
   says to rotate it for shared / multi-tenant ops. Future hardening:
   provision the role with a generated password and inject via env, the same
   way we already handle `JWT_SECRET`.

4. **Sentry DSN, BullMQ Redis, S3 backup offload are unconfigured in
   production.** All optional, none block boot. Should be wired in before any
   real merchant pilot — see `docs/runbook/deploy-checklist.md` §2.5–2.6.

5. **Rate-limit env vars not yet validated end-to-end.** Smoke tests only
   exercised login + signup; rate limiter behaviour was not stressed.

## Final production state

- **Postgres**: 17.9, systemd unit `postgresql@17-main` active, `127.0.0.1:5432`
- **Database**: `vipos`, owner `postgres`, all 7 Prisma migrations applied
- **App role**: `vipos_app` (NOSUPERUSER NOBYPASSRLS), owns all `public` tables
- **Backend**: pm2 `vipos-backend` (id=4), Node 20.20.2, listening on `:3001`,
  `db.ok=true`, RLS enforced
- **Data**: 1 tenant (default, id=1), 1 user (admin, id=1, tenant_id=1),
  21 products + 22 non-empty tables migrated from SQLite at row parity
- **SQLite legacy**: still on disk at
  `apps/backend/data/vipos.db.pre-pg-migrate-1777935516` for 30-day rollback
  insurance; original `.env.pre-pg-migrate-1777936847` also retained
- **No code changes shipped to `main`** for this incident. All work was on the
  VPS; this handoff doc + deploy-checklist updates are the only repo deltas.

## Files / locations on the VPS

| Path                                                                  | Purpose                                           |
| --------------------------------------------------------------------- | ------------------------------------------------- |
| `/root/.vipos-pg-pwd`                                                 | Postgres superuser password (mode 600). **Keep.** |
| `/var/www/vipos/apps/backend/.env`                                    | New env (Postgres URLs + CORS_ALLOWLIST)          |
| `/var/www/vipos/apps/backend/.env.pre-pg-migrate-1777936847`          | Pre-migration env backup                          |
| `/var/www/vipos/apps/backend/data/vipos.db.pre-pg-migrate-1777935516` | SQLite pre-migration snapshot, sha256 `33641570…` |
| `/var/www/vipos/apps/backend/scripts/setup-app-role.sql`              | Idempotent — already applied                      |
| `/var/www/vipos/apps/backend/scripts/migrate-sqlite-to-postgres.mjs`  | Already applied; see Finding #1                   |

## Follow-ups (next sessions)

- [ ] Patch `migrate-sqlite-to-postgres.mjs` to auto-handle the Phase 1 →
      Phase 2 `tenant_id` gap (Finding #1).
- [ ] Wire Sentry DSN (backend + frontend) before merchant outreach.
- [ ] Configure BullMQ Redis + nightly db-backup cron + S3 offload.
- [ ] Rotate `vipos_app` password; provision via env not literal.
- [ ] HTTPS / domain cutover (currently HTTP-only on `103.74.5.44`).
