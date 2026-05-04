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
 *   const { processNotification } = require('./jobs/notification');
 *   const w = createWorker(QUEUE_NAMES.NOTIFICATION, processNotification);
 *
 * PR-A registered the audit-retention queue. PR-B added the
 * notification / email / marketplace-webhook workers + Bull Board.
 * PR-C wires the remaining queues: report (chained → email),
 * settlement (manual reconcile), and import-export (bulk async insert).
 */
const {
  QUEUE_NAMES,
  createQueue,
  createWorker,
  closeConnection,
  isQueueEnabled,
} = require('../lib/queue');
const { observeBullJob } = require('../lib/metrics');
const { processAuditRetention, DEFAULT_RETENTION_DAYS } = require('./audit-retention');
const { processNotification } = require('./notification');
const { processEmail } = require('./email');
const { processMarketplaceWebhook } = require('./marketplace-webhook');
const { processReport } = require('./report');
const { processSettlement } = require('./settlement');
const { processImportExport } = require('./import-export');

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
 * Worker registry — every queue we run is declared here so the boot
 * order, lifecycle, and naming are obvious in one spot. Extend this
 * list when adding a new queue.
 *
 * Each entry maps the canonical queue name to its processor function.
 */
const WORKER_REGISTRY = Object.freeze([
  { name: QUEUE_NAMES.AUDIT_RETENTION, processor: processAuditRetention },
  { name: QUEUE_NAMES.NOTIFICATION, processor: processNotification },
  { name: QUEUE_NAMES.EMAIL, processor: processEmail },
  { name: QUEUE_NAMES.MARKETPLACE_WEBHOOK, processor: processMarketplaceWebhook },
  { name: QUEUE_NAMES.REPORT, processor: processReport },
  { name: QUEUE_NAMES.SETTLEMENT, processor: processSettlement },
  { name: QUEUE_NAMES.IMPORT_EXPORT, processor: processImportExport },
]);

/**
 * Wire the Prometheus job counters/histograms to a worker. Records a
 * `vipos_bullmq_jobs_total` increment + a duration observation for
 * every `completed` and `failed` event.
 *
 * Duration is taken from the BullMQ job timestamps when available
 * (`processedOn` → `finishedOn`); jobs that fail before processing
 * starts are recorded with duration 0 so the counter still moves.
 *
 * @param {import('bullmq').Worker} worker
 * @param {string} queueName
 */
function attachWorkerMetrics(worker, queueName) {
  worker.on('completed', (job) => {
    const durationSeconds = computeJobDurationSeconds(job);
    observeBullJob(queueName, 'completed', durationSeconds);
  });
  worker.on('failed', (job) => {
    const durationSeconds = computeJobDurationSeconds(job);
    observeBullJob(queueName, 'failed', durationSeconds);
  });
}

function computeJobDurationSeconds(job) {
  const finishedOn = job?.finishedOn ?? Date.now();
  const processedOn = job?.processedOn;
  if (!processedOn || !finishedOn) return 0;
  return Math.max(0, (finishedOn - processedOn) / 1000);
}

/**
 * Start every registered worker. Returns a `stop()` callback that closes
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

  // Construct queues + workers in pairs. We intentionally instantiate
  // fresh handles here (rather than reuse `getOrCreateQueue`) because
  // the worker process owns the lifecycle — when `stop()` runs, we
  // must close exactly these queues without affecting any cached
  // producer queues that might live in the same process during tests.
  const queues = [];
  const workers = [];
  for (const { name, processor } of WORKER_REGISTRY) {
    const queue = createQueue(name);
    const worker = createWorker(name, processor);
    attachWorkerMetrics(worker, name);
    queues.push(queue);
    workers.push(worker);
  }

  if (scheduleRecurring) {
    const auditQueue = queues.find((q) => q.name === QUEUE_NAMES.AUDIT_RETENTION);
    if (auditQueue) await scheduleAuditRetention(auditQueue);
  }

  return async function stop() {
    // Close workers before queues so in-flight jobs drain.
    for (const w of workers) {
      try {
        await w.close();
      } catch {
        /* ignore */
      }
    }
    for (const q of queues) {
      try {
        await q.close();
      } catch {
        /* ignore */
      }
    }
    await closeConnection();
  };
}

module.exports = {
  startWorkers,
  scheduleAuditRetention,
  attachWorkerMetrics,
  AUDIT_RETENTION_SCHEDULER,
  AUDIT_RETENTION_CRON,
  WORKER_REGISTRY,
};
