# VIPOS — Pre-Deploy & Post-Deploy Checklist

> Owner: Backend on-call
> Last reviewed: 2026-05-04 (PR-5 polish)
> Scope: production deploy (VPS + Postgres) and any environment that runs
> against a real Postgres instance with multi-tenant data.

This checklist supplements [`DEPLOYMENT.md`](../../DEPLOYMENT.md) (which covers
the actual deploy steps) by enforcing security invariants the server must
satisfy before serving real merchant traffic. None of the items here are
optional in production; treat any failure as a launch blocker.

---

## 1. Why this checklist exists

VIPOS Phase 2 enforces tenant isolation via **Postgres Row-Level Security
(RLS)**. Migration `20260505300000_force_row_level_security` applies
`FORCE ROW LEVEL SECURITY` to every tenant-scoped table. This protection only
holds when the application connects with a database role that does **not**
have the `BYPASSRLS` attribute and is **not** a `SUPERUSER` — Postgres skips
RLS entirely for those roles, even when `FORCE` is set.

Real cloud providers usually expose a non-superuser role by default
(Supabase `service_role`, RDS `app_user` patterns, etc.), so production is
typically safe out of the box. Local Docker installs that connect as the
default `postgres` superuser are **not** safe and will silently leak data
across tenants in development.

---

## 2. Pre-deploy checklist

Run each step before flipping traffic to a new release. All checks must pass.

### 2.1 DB role guard (RLS)

Connect to the production database with the same credentials the backend
process will use, then run:

```sql
SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = current_user;
```

Expected output:

| rolname | rolsuper | rolbypassrls |
| ------- | -------- | ------------ |
| `<app>` | `f`      | `f`          |

If either column is `t`, **stop the deploy**. RLS will not be enforced and
cross-tenant data will be visible. Either:

1. Switch `DATABASE_URL` / `DIRECT_URL` to a non-superuser role that has the
   minimum privileges the app needs (CONNECT on the DB, USAGE on the schema,
   CRUD on tables it manages, USAGE on sequences). Supabase `service_role`
   already satisfies this; for self-hosted Postgres see §2.2.
2. Re-run the check with the new role.

### 2.2 Self-hosted Postgres / staging: provision `vipos_app`

The repo ships an idempotent SQL script at
[`apps/backend/scripts/setup-app-role.sql`](../../apps/backend/scripts/setup-app-role.sql)
that creates the `vipos_app` role with `NOSUPERUSER NOBYPASSRLS`, grants the
necessary privileges, and transfers ownership of `public` tables so RLS
enforcement applies cleanly.

```bash
# After `prisma migrate deploy` has applied the schema:
psql "$DIRECT_URL" -f apps/backend/scripts/setup-app-role.sql

# Then point runtime to the new role:
# DATABASE_URL=postgresql://vipos_app:apppass@<host>:<port>/<db>
```

The default password (`apppass`) is for local dev only — change it via
`ALTER ROLE vipos_app PASSWORD '<strong-secret>'` before exposing the role in
shared staging or production.

### 2.3 Schema migrations applied

```bash
cd apps/backend
DATABASE_URL=$DIRECT_URL npx prisma migrate deploy
```

Then verify the head migration is `20260506100000_add_audit_logs` (or newer):

```sql
SELECT migration_name FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;
```

### 2.4 Default admin tenant_id sanity check

The seed user (`admin` / `admin123`) must belong to the default tenant. The
login response now exposes `user.tenant_id`; quickly verify with:

```bash
curl -s -X POST https://<host>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  | jq '.user.tenant_id'
# Expected: 1 (default tenant)
```

If `tenant_id` is `null` or missing, the seed did not run cleanly — re-run
`npm run seed --workspace=apps/backend` and confirm the migration table has
`add_multi_tenant_foundation` applied.

### 2.5 Backups configured

See [`disaster_recovery.md`](./disaster_recovery.md) §1–2. At minimum:

- `BACKUP_DIR` writeable by the app user
- `S3_BUCKET` + credentials populated (offload), or a documented decision to
  run local-only for early staging
- BullMQ worker process running (`pm2 status` lists `vipos-worker`)
- `db-backup` cron entry at 02:00 UTC fires (check Sentry tags
  `component=backup`, `queue=db-backup` for the last successful run)

### 2.6 Sentry DSNs set

- Backend: `SENTRY_DSN=https://...@sentry.io/...`
- Frontend (Vite, baked at build time): `VITE_SENTRY_DSN_FRONTEND=...` and
  `VITE_SENTRY_RELEASE=vipos-web@<version>`

If left unset the SDKs no-op; that is fine for staging sandbox traffic but
unacceptable for merchant pilot.

### 2.7 Rate limit + secrets

- `JWT_SECRET` is a 32+ byte random string (not the placeholder)
- `RATE_LIMIT_LOGIN_DISABLED=1` is **NOT** set in production env
- `apps/backend/.env` is `chmod 600` and owned by the app user

---

## 3. Post-deploy smoke test

Run within 5 minutes of cut-over. Block rollout to merchants until all pass.

| #   | Check                                                                                                                  | How                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Health endpoint                                                                                                        | `curl -fsS https://<host>/api/health` → `{"status":"ok"}`                                                                        |
| 2   | Login default admin returns `user.tenant_id`                                                                           | `curl -s -X POST .../api/auth/login -d '{"username":"admin","password":"admin123"}'` → `.user.tenant_id` is a number, not `null` |
| 3   | `GET /api/auth/me` returns `user.tenant_id`                                                                            | With Bearer token from #2 → same `tenant_id`                                                                                     |
| 4   | Public signup works (`POST /api/v1/tenant/register`) and onboarding wizard at `/vipos/onboarding` loads 3 preset cards | Manual browser flow (see `docs/handoff/2026-05-04-pra-beta-v0.0.1-smoke-test.md`)                                                |
| 5   | Cross-tenant isolation                                                                                                 | Two tenant accounts cannot read each other's products via `/api/v1/products` (signed-in JWT scoped to one tenant)                |
| 6   | Sentry receives a test event                                                                                           | `curl -fsS https://<host>/api/__sentry-test` (if endpoint exists) or trigger a known 500; confirm in Sentry UI                   |

If #5 fails, **rollback immediately** — RLS is not active. Re-run §2.1.

---

## 4. Decision log

Record any deviation from this checklist in
`docs/handoff/<date>-deploy-decisions.md` so the next on-call can see what
shortcuts were taken and why.

---

## 5. Related runbooks

- [`disaster_recovery.md`](./disaster_recovery.md) — backup, restore, RPO/RTO targets
- [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) — VPS deploy steps
- [`../../apps/backend/scripts/setup-app-role.sql`](../../apps/backend/scripts/setup-app-role.sql) — non-superuser role provisioning
