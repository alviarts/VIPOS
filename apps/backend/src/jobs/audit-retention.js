/**
 * P2-04 audit-retention job.
 *
 * Replaces the standalone `scripts/prune-audit-logs.mjs` cron once
 * BullMQ + Redis are in place. The script remains as a fallback for
 * environments without Redis.
 *
 * Job payload:
 *   { retentionDays?: number }   // default 365
 *
 * The processor runs the same DELETE the script does, but as a recurring
 * BullMQ job. Schedule it via `Queue.upsertJobScheduler` or a cron
 * pattern in `src/jobs/index.js`.
 */
const { runAsSystem, query } = require('../db');

const DEFAULT_RETENTION_DAYS = 365;

/**
 * @param {{ data?: { retentionDays?: number } }} job
 * @returns {Promise<{ deleted: number, retentionDays: number }>}
 */
async function processAuditRetention(job) {
  const retentionDaysRaw = job?.data?.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const retentionDays = Number(retentionDaysRaw);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error(`Invalid retentionDays=${retentionDaysRaw}`);
  }
  // Run with system tenant so the DELETE bypasses RLS and prunes every
  // tenant in one pass — matches the behaviour of the standalone script.
  const r = await runAsSystem(() =>
    query(
      `DELETE FROM audit_logs
         WHERE created_at < (now() - $1::interval)`,
      [`${retentionDays} days`]
    )
  );
  return { deleted: r.rowCount, retentionDays };
}

module.exports = {
  processAuditRetention,
  DEFAULT_RETENTION_DAYS,
};
