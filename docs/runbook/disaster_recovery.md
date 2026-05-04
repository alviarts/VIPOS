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

## 5. Auto-test in staging (P2-08 PR-B follow-up)

A weekly recovery test in staging is tracked separately under P2-08 PR-B. When that ships, this section will document:

- The `restore-test` recurring queue + its cron
- The expected Prometheus signal that the staging restore succeeded
- Where to find the staging diff against production schema

Until then, run `test-backup-restore.sh` manually once a month.
