/**
 * P2-04 worker registry.
 *
 * Wires every queue defined in `lib/queue.js` to its processor + creates
 * the recurring schedules required for cron-style jobs (e.g. nightly
 * audit retention prune).
 *
 * Usage from a dedicated worker process (`src/worker.js`):
 *   const { startWorkers } = require('./jobs');
 *   const stop = await startWorkers();
 *   process.on('SIGTERM', () => stop());
 *
 * Usage from tests:
 *   const { processAuditRetention } = require('./jobs/audit-retention');
 *   const w = createWorker(QUEUE_NAMES.AUDIT_RETENTION, processAuditRetention);
 *
 * PR-A only registers the audit-retention queue. PR-B will add the
 * notification / email / report / settlement / marketplace-webhook /
 * import-export workers + Bull Board.
 */
const {
  QUEUE_NAMES,
  createQueue,
  createWorker,
  closeConnection,
  isQueueEnabled,
} = require('../lib/queue');
const { processAuditRetention, DEFAULT_RETENTION_DAYS } = require('./audit-retention');

const AUDIT_RETENTION_SCHEDULER = 'audit-retention-nightly';
// 03:15 every day. Pick an off-peak window; tenant clocks are TZ-naive
// because BullMQ uses the worker process timezone.
const AUDIT_RETENTION_CRON = '15 3 * * *';

/**
 * Ensure the recurring audit-retention job exists. Safe to call repeatedly
 * — `upsertJobScheduler` is idempotent.
 *
 * @param {import('bullmq').Queue} queue
 */
async function scheduleAuditRetention(queue) {
  await queue.upsertJobScheduler(
    AUDIT_RETENTION_SCHEDULER,
    { pattern: AUDIT_RETENTION_CRON },
    {
      name: 'prune',
      data: { retentionDays: DEFAULT_RETENTION_DAYS },
      opts: {
        // Recurring job: keep at most one queued copy at a time.
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      },
    }
  );
}

/**
 * Start every PR-A worker. Returns a `stop()` callback that closes
 * everything cleanly, including the shared Redis connection.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.scheduleRecurring=true] — set false in tests
 *   when you want to enqueue jobs manually instead of waiting on cron.
 * @returns {Promise<() => Promise<void>>}
 */
async function startWorkers(opts = {}) {
  if (!isQueueEnabled()) {
    throw new Error('startWorkers: REDIS_URL is not set');
  }
  const { scheduleRecurring = true } = opts;
  const auditQueue = createQueue(QUEUE_NAMES.AUDIT_RETENTION);
  const auditWorker = createWorker(QUEUE_NAMES.AUDIT_RETENTION, processAuditRetention);

  if (scheduleRecurring) {
    await scheduleAuditRetention(auditQueue);
  }

  return async function stop() {
    await auditWorker.close();
    await auditQueue.close();
    await closeConnection();
  };
}

module.exports = {
  startWorkers,
  scheduleAuditRetention,
  AUDIT_RETENTION_SCHEDULER,
  AUDIT_RETENTION_CRON,
};
