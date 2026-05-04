# VIPOS — Disaster Recovery Runbook

**Owner:** Backend on-call
**Last reviewed:** 2026-05-04 (P2-08)
**Recovery targets**

| Target                         | Goal                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| RPO (Recovery Point Objective) | ≤ 24 hours of data loss for catastrophic events; uploads-backup runs every 24h, db-backup runs every 24h |
| RTO (Recovery Time Objective)  | ≤ 2 hours from incident decision to restored production                                                  |

---

## 1. Backups overview

VIPOS runs two recurring BullMQ jobs in the worker process (registered in `apps/backend/src/jobs/index.js`):

| Queue            | Cron (UTC)           | Source                                         | Target                                                                                                                    |
| ---------------- | -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `db-backup`      | `0 2 * * *` (02:00)  | `pg_dump --format=custom` against `DIRECT_URL` | local `BACKUP_DIR` (default `var/backups/`) and (when configured) S3 prefix `<S3_BUCKET>/vipos-backups/daily/YYYY/MM/...` |
| `uploads-backup` | `30 2 * * *` (02:30) | `apps/backend/uploads/` directory              | S3 prefix `<S3_BUCKET>/vipos-backups/uploads/...`                                                                         |

Sundays additionally produce a `weekly/<YYYY>-W<NN>.dump` copy; the 1st of the month additionally produces a `monthly/<YYYY>-MM.dump` copy. Retention beyond 14 days local is delegated to S3 lifecycle rules (recommended: daily 30, weekly 12, monthly 12).

Failures are reported via:

- Sentry `captureException` with tags `component=backup`, `queue=<queue>`
- Email to every address in `BACKUP_NOTIFY_EMAILS` (comma-separated env var)

The Prometheus metrics `vipos_bullmq_jobs_total{queue="db-backup",status="failed"}` and the equivalent for `uploads-backup` should both alert at `> 0` during the daily window.

---

## 2. Environment contract

| Var                                         | Required for            | Notes                                                               |
| ------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| `DIRECT_URL` / `DATABASE_URL`               | both                    | `pg_dump` connects via `DIRECT_URL` (bypasses PgBouncer)            |
| `S3_BUCKET`                                 | upload + remote restore | When unset, backups stay local-only — useful for early staging      |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | upload + remote restore |                                                                     |
| `S3_ENDPOINT`                               | non-AWS providers       | e.g. `https://<account>.r2.cloudflarestorage.com` for Cloudflare R2 |
| `S3_REGION`                                 | optional                | `auto` for R2, AWS region otherwise                                 |
| `BACKUP_DIR`                                | optional                | local dump dir, default `./var/backups`                             |
| `BACKUP_LOCAL_RETENTION_DAYS`               | optional                | default 14                                                          |
| `BACKUP_S3_PREFIX`                          | optional                | default `vipos-backups`                                             |
| `BACKUP_NOTIFY_EMAILS`                      | optional                | comma-separated, plain text                                         |

Cloudflare R2 is the recommended provider (zero-egress pricing). To provision:

```
# Cloudflare dashboard → R2 → Create bucket "vipos-backups"
# R2 → Manage API tokens → Create token (Read & Write on the bucket)
# Copy the access-key id and secret to S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY
# Set S3_ENDPOINT = https://<account-id>.r2.cloudflarestorage.com
# Set S3_REGION = auto
```

---

## 3. Recovery procedures

### 3.1 Single-table data loss (e.g. accidental DELETE)

1. Identify the most recent dump that _predates_ the bad write — usually yesterday's `daily/` snapshot.
2. Restore the dump into a sandbox database (NOT production).
   ```
   ./apps/backend/scripts/restore-postgres.sh --s3-key vipos-backups/daily/YYYY/MM/<file>.dump
   ```
   Override `DATABASE_URL` to point at the sandbox before invoking.
3. Run targeted SELECTs in the sandbox to extract the rows you need.
4. Re-apply them in production via `INSERT ... ON CONFLICT DO NOTHING` from a trusted migration script.

### 3.2 Full database loss (catastrophic — entire cluster gone)

1. Provision a replacement Postgres cluster.
2. Set `DATABASE_URL` / `DIRECT_URL` on a maintenance host pointed at the new cluster.
3. Identify the freshest acceptable dump:
   - Latest `daily/` if RPO ≤ 24h is acceptable
   - Otherwise the latest `weekly/` (RPO ≤ 7 days) — check Sentry / email for any failed `db-backup` runs that might mean the latest daily is older than expected.
4. Run the restore:
   ```
   ./apps/backend/scripts/restore-postgres.sh \
     --s3-key vipos-backups/daily/YYYY/MM/<file>.dump \
     --force
   ```
5. Re-apply Prisma migrations _only_ if the dump predates a schema change since the dump was taken:
   ```
   cd apps/backend && npx prisma migrate deploy
   ```
6. Restore uploads:
   ```
   ./apps/backend/scripts/restore-uploads.sh --target ./apps/backend/uploads
   ```
7. Point the backend deployment at the new cluster, verify `/api/v1/health` returns 200 and key dashboards (Prometheus + Sentry) are quiet.
8. Schedule a post-mortem.

### 3.3 Server / region compromise (data integrity not trusted)

1. Treat as **full database loss** (3.2) but pick a dump from _before_ the suspected compromise window, not just yesterday's.
2. Rotate every secret that was reachable from the compromised host:
   - `JWT_SECRET`
   - `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (Cloudflare R2 tokens)
   - `SENTRY_DSN`
   - DB credentials
3. Audit the `audit_logs` table from the restored dump for any post-snapshot writes and reconcile manually.

### 3.4 Backup pipeline failure (no successful dump in N hours)

1. Page on `vipos_bullmq_jobs_total{queue="db-backup",status="failed"} > 0` or absence-of-`completed` for > 26h.
2. SSH into a worker host and tail the worker logs:
   ```
   journalctl -u vipos-worker -n 500 --no-pager
   ```
3. Trigger a manual run via BullMQ producer (no need to wait for cron):
   ```
   const { getOrCreateQueue, QUEUE_NAMES } = require('./apps/backend/src/lib/queue');
   await getOrCreateQueue(QUEUE_NAMES.DB_BACKUP).add('manual', {});
   ```
4. If the manual run also fails, fall back to the standalone shell script which has a different failure surface:
   ```
   ./apps/backend/scripts/backup-postgres.sh
   ```
5. File a post-mortem ticket — backups silently broken is the worst-class failure on this system.

---

## 4. Verifying the pipeline

End-to-end smoke (no real S3 needed):

```
./apps/backend/scripts/test-backup-restore.sh
```

This spins up two ephemeral Postgres containers, dumps from one and restores into the other, and verifies a canary table count survives the round trip. Run it monthly as a sanity check.

---

## 5. Auto-test recovery in staging

A recurring BullMQ job verifies that the daily dumps are actually _restorable_, not just _uploaded_. Wired in `apps/backend/src/jobs/restore-test.js` and registered by `apps/backend/src/jobs/index.js`.

### 5.1 Schedule + scope

| Property   | Value                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Queue      | `restore-test`                                                                                                                     |
| Scheduler  | `restore-test-weekly`                                                                                                              |
| Cron (UTC) | `0 4 * * 0` (Sundays 04:00 — runs after the 02:00 daily dump and 02:30 uploads sync, with the alias roll-over already settled)     |
| Source     | latest object under `${BACKUP_S3_PREFIX}/daily/` (newest by `LastModified`) — we test the freshest backup, not the weekly snapshot |
| Target     | a throwaway database on the staging Postgres reachable via `RESTORE_TEST_DATABASE_URL` (admin role)                                |

Per run, the worker:

1. lists `${BACKUP_S3_PREFIX}/daily/` and picks the freshest dump,
2. streams it to a tmp file,
3. opens the admin URL and `CREATE DATABASE "vipos_restore_test_<ts>_<rand>"`,
4. `pg_restore --clean --if-exists --no-owner --no-acl` into the sandbox,
5. runs read-only sanity queries (`count(*)` on `users`, `tenants`, `audit_logs`, `_prisma_migrations` plus `MAX(audit_logs.created_at)`),
6. `DROP DATABASE IF EXISTS` the sandbox + removes the tmp file in `finally`, regardless of outcome.

The job is **off by default** so production workers never run it. Staging opts in with `BACKUP_RESTORE_TEST_ENABLED=1`. When the env is unset (or `S3_BUCKET` / `RESTORE_TEST_DATABASE_URL` is missing) the processor returns `{ skipped: ... }` without touching S3 or Postgres — those runs count as `skipped` in metrics, never as `failed`.

### 5.2 Environment contract (staging worker)

| Var                           | Required | Notes                                                                                                                                                       |
| ----------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKUP_RESTORE_TEST_ENABLED` | yes      | Set to `1` on the staging worker host. Leave unset everywhere else.                                                                                         |
| `RESTORE_TEST_DATABASE_URL`   | yes      | Admin connection string with `CREATEDB` privilege. The path component (database name) is replaced per-run, so point this at e.g. `postgres` or `template1`. |
| `S3_BUCKET` + `S3_*` creds    | yes      | Same contract as the rest of P2-08; reused as-is.                                                                                                           |
| `BACKUP_S3_PREFIX`            | optional | Defaults to `vipos-backups`. Must match the value on the producer host.                                                                                     |
| `BACKUP_NOTIFY_EMAILS`        | optional | Same comma-separated list used by `db-backup` / `uploads-backup`.                                                                                           |

The admin role only needs:

```sql
GRANT CREATEDB ON DATABASE postgres TO restore_test_admin;
-- pg_restore inside the sandbox runs as the same role, so it also
-- needs to be able to create / own arbitrary objects in any database
-- it owns. CREATEDB is sufficient on most managed Postgres deploys.
```

### 5.3 Expected signals

| Signal                                                                     | Means                                                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `vipos_backup_restore_test_total{status="passed"}` increments every Sunday | Auto-test ran end-to-end.                                                                                                                   |
| `vipos_backup_restore_test_total{status="skipped"}` increments instead     | Job is gated off (env unset / no storage / no admin URL). Expected on production workers.                                                   |
| `vipos_backup_restore_test_total{status="failed"}` increments              | Restore broke. Check Sentry (tags `component=backup`, `queue=restore-test`) and the `backup-failed` email. The original dump is unaffected. |
| `vipos_backup_restore_test_duration_seconds` p95                           | Tracks how long a clean restore takes. Spikes hint at growing dump size or a slow sandbox host.                                             |

The existing `attachBackupFailureNotifier(worker, 'restore-test')` hook re-uses the same Sentry + email pipeline as `db-backup` / `uploads-backup`, so on-call already gets paged on failure — no new alerting wiring is needed.

### 5.4 Manual invocation (for triage)

Re-running the auto-test on demand is useful when investigating a Sunday failure or after rotating R2 credentials. From the worker host:

```
node -e '
  process.env.BACKUP_RESTORE_TEST_ENABLED = "1";
  require("./apps/backend/src/jobs/restore-test")
    .processRestoreTest({ data: {} })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => { console.error(e); process.exit(1); });
'
```

Or queue a one-shot job from a Node REPL with `restoreTestQueue.add('verify', {})` — the worker will pick it up the same way as the cron-driven run.

### 5.5 Sandbox cleanup safety net

The job drops its own sandbox in `finally`. If a worker crash or network blip ever leaves an orphan database behind, this cleanup query removes any `vipos_restore_test_*` databases older than 1 day:

```sql
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT datname FROM pg_database
    WHERE datname LIKE 'vipos_restore_test_%'
      AND (pg_stat_file('base/' || oid::text)).modification < now() - interval '1 day'
  LOOP
    EXECUTE format('DROP DATABASE IF EXISTS %I', r.datname);
  END LOOP;
END $$;
```

Run this monthly on the staging Postgres if you ever see lingering sandbox databases in `\l`.

### 5.6 Manual smoke test (still useful)

For a fully offline round-trip (no R2, no staging DB, no BullMQ) the original Docker-based smoke is still available:

```
./apps/backend/scripts/test-backup-restore.sh
```

Run that whenever you change the dump format flags or upgrade the Postgres major version, _in addition_ to the weekly auto-test.
