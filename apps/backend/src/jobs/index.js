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
const { processDbBackup } = require('./db-backup');
const { processUploadsBackup } = require('./uploads-backup');
const { processRestoreTest } = require('./restore-test');
const { observeRestoreTest } = require('../lib/metrics');
const { logger } = require('../lib/logger');
const Sentry = require('@sentry/node');

const AUDIT_RETENTION_SCHEDULER = 'audit-retention-nightly';
// 03:15 every day. Pick an off-peak window; tenant clocks are TZ-naive
// because BullMQ uses the worker process timezone.
const AUDIT_RETENTION_CRON = '15 3 * * *';

// P2-08 — daily backup schedules. Run before the audit-retention prune
// (03:15) so the dumped data still includes anything the retention
// pass would otherwise erase.
const DB_BACKUP_SCHEDULER = 'db-backup-daily';
const DB_BACKUP_CRON = '0 2 * * *'; // 02:00 UTC
const UPLOADS_BACKUP_SCHEDULER = 'uploads-backup-daily';
const UPLOADS_BACKUP_CRON = '30 2 * * *'; // 02:30 UTC

// P2-08 PR-B — weekly restore-test schedule. Runs Sundays 04:00 UTC,
// after the Sunday daily dump (02:00) + uploads sync (02:30) + alias
// roll-over have settled. Off-by-default; staging worker enables via
// `BACKUP_RESTORE_TEST_ENABLED=1`.
const RESTORE_TEST_SCHEDULER = 'restore-test-weekly';
const RESTORE_TEST_CRON = '0 4 * * 0'; // Sundays 04:00 UTC

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
 * Ensure the recurring db-backup + uploads-backup jobs exist.
 *
 * @param {{ dbBackup: import('bullmq').Queue, uploadsBackup: import('bullmq').Queue }} queues
 */
async function scheduleBackups(queues) {
  if (queues.dbBackup) {
    await queues.dbBackup.upsertJobScheduler(
      DB_BACKUP_SCHEDULER,
      { pattern: DB_BACKUP_CRON },
      {
        name: 'dump',
        data: {},
        opts: {
          removeOnComplete: { count: 100 },
          removeOnFail: false,
        },
      }
    );
  }
  if (queues.uploadsBackup) {
    await queues.uploadsBackup.upsertJobScheduler(
      UPLOADS_BACKUP_SCHEDULER,
      { pattern: UPLOADS_BACKUP_CRON },
      {
        name: 'sync',
        data: {},
        opts: {
          removeOnComplete: { count: 100 },
          removeOnFail: false,
        },
      }
    );
  }
  // P2-08 PR-B — only register the weekly restore-test scheduler when
  // the host explicitly opts in. Production workers leave the env unset
  // so the job never fires there; staging exports the flag and supplies
  // `RESTORE_TEST_DATABASE_URL` separately.
  if (queues.restoreTest && process.env.BACKUP_RESTORE_TEST_ENABLED) {
    await queues.restoreTest.upsertJobScheduler(
      RESTORE_TEST_SCHEDULER,
      { pattern: RESTORE_TEST_CRON },
      {
        name: 'verify',
        data: {},
        opts: {
          removeOnComplete: { count: 100 },
          removeOnFail: false,
        },
      }
    );
  }
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
  { name: QUEUE_NAMES.DB_BACKUP, processor: processDbBackup },
  { name: QUEUE_NAMES.UPLOADS_BACKUP, processor: processUploadsBackup },
  { name: QUEUE_NAMES.RESTORE_TEST, processor: processRestoreTest },
]);

/**
 * P2-08 — failure notification helper. Wired to the `failed` event of
 * the backup workers. Forwards the error to Sentry and (when an
 * admin notify list is configured) enqueues an email so on-call
 * engineers get paged before the next dump cycle starts.
 *
 * Idempotent: the email queue lookup happens via `getOrCreateQueue`,
 * which is no-op on subsequent calls.
 *
 * @param {import('bullmq').Worker} worker
 * @param {string} queueName
 */
function attachBackupFailureNotifier(worker, queueName) {
  worker.on('failed', async (job, err) => {
    try {
      Sentry.captureException(err, {
        tags: { component: 'backup', queue: queueName },
        extra: { jobId: job?.id, jobName: job?.name, attempts: job?.attemptsMade },
      });
    } catch {
      /* swallow Sentry transport errors so the backup loop keeps moving */
    }
    const recipients = (process.env.BACKUP_NOTIFY_EMAILS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      logger.warn(
        { queue: queueName, err: err?.message },
        'backup failed and BACKUP_NOTIFY_EMAILS is unset, no email sent'
      );
      return;
    }
    try {
      const { getOrCreateQueue } = require('../lib/queue');
      const emailQueue = getOrCreateQueue(QUEUE_NAMES.EMAIL);
      await emailQueue.add('backup-failed', {
        to: recipients,
        subject: `[VIPOS] Backup failed: ${queueName}`,
        text: [
          `Queue: ${queueName}`,
          `Job:   ${job?.id ?? '(none)'} (${job?.name ?? '(unknown)'})`,
          `Attempts: ${job?.attemptsMade ?? 0}`,
          `Error: ${err?.stack || err?.message || String(err)}`,
        ].join('\n'),
      });
    } catch (notifyErr) {
      logger.error(
        { err: notifyErr?.message, queue: queueName },
        'failed to enqueue backup-failure email'
      );
    }
  });
}

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
 * P2-08 PR-B — observe the restore-test outcome on the dedicated
 * `vipos_backup_restore_test_*` metrics. Wired alongside the generic
 * worker metrics so dashboards / alerts can fan out without filtering
 * on the queue label.
 *
 * The `passed`/`failed` distinction comes from BullMQ's worker events;
 * runs that hit a `{ skipped: ... }` early-return (env disabled, no
 * storage, no admin url) emit `completed` with a non-throw return
 * value — we still count those as `skipped` so the `passed` series
 * doesn't get diluted by no-op runs in production.
 *
 * @param {import('bullmq').Worker} worker
 */
function attachRestoreTestMetrics(worker) {
  worker.on('completed', (job, result) => {
    const durationSeconds = computeJobDurationSeconds(job);
    const status = result && typeof result === 'object' && result.skipped ? 'skipped' : 'passed';
    observeRestoreTest(status, durationSeconds);
  });
  worker.on('failed', (job) => {
    const durationSeconds = computeJobDurationSeconds(job);
    observeRestoreTest('failed', durationSeconds);
  });
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
  const BACKUP_QUEUES = new Set([
    QUEUE_NAMES.DB_BACKUP,
    QUEUE_NAMES.UPLOADS_BACKUP,
    QUEUE_NAMES.RESTORE_TEST,
  ]);
  for (const { name, processor } of WORKER_REGISTRY) {
    const queue = createQueue(name);
    const worker = createWorker(name, processor);
    attachWorkerMetrics(worker, name);
    if (BACKUP_QUEUES.has(name)) {
      attachBackupFailureNotifier(worker, name);
    }
    if (name === QUEUE_NAMES.RESTORE_TEST) {
      attachRestoreTestMetrics(worker);
    }
    queues.push(queue);
    workers.push(worker);
  }

  if (scheduleRecurring) {
    const auditQueue = queues.find((q) => q.name === QUEUE_NAMES.AUDIT_RETENTION);
    if (auditQueue) await scheduleAuditRetention(auditQueue);
    const dbBackup = queues.find((q) => q.name === QUEUE_NAMES.DB_BACKUP);
    const uploadsBackup = queues.find((q) => q.name === QUEUE_NAMES.UPLOADS_BACKUP);
    const restoreTest = queues.find((q) => q.name === QUEUE_NAMES.RESTORE_TEST);
    await scheduleBackups({ dbBackup, uploadsBackup, restoreTest });
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
  scheduleBackups,
  attachWorkerMetrics,
  attachBackupFailureNotifier,
  attachRestoreTestMetrics,
  AUDIT_RETENTION_SCHEDULER,
  AUDIT_RETENTION_CRON,
  DB_BACKUP_SCHEDULER,
  DB_BACKUP_CRON,
  UPLOADS_BACKUP_SCHEDULER,
  UPLOADS_BACKUP_CRON,
  RESTORE_TEST_SCHEDULER,
  RESTORE_TEST_CRON,
  WORKER_REGISTRY,
};
