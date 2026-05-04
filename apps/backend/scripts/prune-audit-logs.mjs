#!/usr/bin/env node
/**
 * P2-03 audit retention prune.
 *
 * Deletes rows from `audit_logs` older than `RETENTION_DAYS` (default 365).
 * Designed to be run by cron / GitHub Actions schedule until P2-04 BullMQ
 * is in place and we can move it to a recurring job.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node apps/backend/scripts/prune-audit-logs.mjs
 *   RETENTION_DAYS=180 node apps/backend/scripts/prune-audit-logs.mjs
 *
 * Notes:
 *   - Connects directly via `pg` (no app singleton) to avoid pulling in
 *     Express + middlewares.
 *   - Runs as the schema owner so RLS does not filter the DELETE — point
 *     `DATABASE_URL` at the privileged role (the same one used for
 *     `prisma migrate deploy`).
 *   - Idempotent: safe to re-run.
 */
import process from 'node:process';
import pkg from 'pg';

const { Client } = pkg;

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 365);
if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS <= 0) {
  console.error(`Invalid RETENTION_DAYS=${process.env.RETENTION_DAYS}`);
  process.exit(2);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

const client = new Client({ connectionString: databaseUrl });
const startedAt = Date.now();

try {
  await client.connect();
  // Wrap in a transaction so SET LOCAL takes effect. Bypass RLS so the
  // DELETE covers every tenant in one pass. The script is supposed to be
  // invoked with a privileged connection string anyway.
  await client.query('BEGIN');
  await client.query("SET LOCAL app.current_tenant = '0'");
  const r = await client.query(
    `DELETE FROM audit_logs
       WHERE created_at < (now() - $1::interval)`,
    [`${RETENTION_DAYS} days`]
  );
  await client.query('COMMIT');
  const durationMs = Date.now() - startedAt;
  console.log(
    JSON.stringify({
      ok: true,
      deleted: r.rowCount,
      retention_days: RETENTION_DAYS,
      duration_ms: durationMs,
    })
  );
} catch (err) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* ignore */
  }
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
