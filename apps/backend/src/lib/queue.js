/**
 * P2-04 Background jobs (BullMQ + Redis) — foundation layer.
 *
 * Centralises queue + worker construction so every queue uses the same
 * Redis connection, retry policy, and cleanup behaviour. Every other
 * module in the codebase should import `createQueue`/`createWorker` from
 * here rather than instantiating BullMQ directly.
 *
 * Connection model:
 *   - One shared ioredis connection is built lazily on first
 *     `getConnection()` call. BullMQ requires `maxRetriesPerRequest: null`
 *     for the connection used by Workers / blocking commands.
 *   - `closeConnection()` quits the shared connection (used by tests +
 *     graceful shutdown).
 *
 * Retry / DLQ defaults (matched to acceptance criteria):
 *   - 3 attempts (initial + 2 retries) with exponential backoff (2s base).
 *   - Failed jobs persisted indefinitely (no `removeOnFail` cap) so they
 *     act as the dead-letter queue. Bull Board (PR-B) will surface them.
 *   - Completed jobs auto-pruned after 1000 entries.
 *
 * Set `REDIS_URL` (e.g. `redis://localhost:6379`) to point at the broker.
 * If unset, callers should treat queueing as a no-op or fall back to the
 * synchronous code path — see `isQueueEnabled()`.
 */
const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const { child } = require('./logger');

const log = child({ component: 'queue' });

/**
 * Canonical queue names. Keep this enum 1:1 with the spec in
 * docs/v3/workflow/phase_2_backend.md so workers + producers can never
 * disagree on the channel.
 */
const QUEUE_NAMES = Object.freeze({
  NOTIFICATION: 'notification',
  EMAIL: 'email',
  REPORT: 'report',
  SETTLEMENT: 'settlement',
  MARKETPLACE_WEBHOOK: 'marketplace-webhook',
  IMPORT_EXPORT: 'import-export',
  AUDIT_RETENTION: 'audit-retention',
  DB_BACKUP: 'db-backup',
  UPLOADS_BACKUP: 'uploads-backup',
});

const DEFAULT_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: false,
});

let sharedConnection = null;
const _queueRegistry = new Map();

/**
 * Returns true if `REDIS_URL` is set. Callers can use this to short-circuit
 * enqueue calls when running without a broker (local dev / tests without
 * Redis).
 */
function isQueueEnabled() {
  return Boolean(process.env.REDIS_URL);
}

/**
 * Build / reuse the shared ioredis connection. Uses `maxRetriesPerRequest:
 * null` because BullMQ requires it for blocking BRPOP/BLPOP commands.
 *
 * @returns {IORedis.Redis}
 */
function getConnection() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL is not set');
  }
  if (!sharedConnection) {
    sharedConnection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    // Surface connection errors loudly — callers should still keep working
    // because `safeEnqueue` wraps producers, but operators need to know.
    sharedConnection.on('error', (err) => {
      log.error({ err: err.message }, 'redis connection error');
    });
  }
  return sharedConnection;
}

/**
 * Close every cached queue handle from the shared registry (see
 * `getOrCreateQueue`). Idempotent. Used by `closeConnection()` and by
 * tests that want to drop the cache without tearing down Redis itself.
 */
async function closeAllQueues() {
  const queues = Array.from(_queueRegistry.values());
  _queueRegistry.clear();
  for (const q of queues) {
    try {
      await q.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Close the shared Redis connection. Idempotent. Used by tests + graceful
 * shutdown handlers. Also drops any queues cached via `getOrCreateQueue`
 * so subsequent calls re-instantiate against the new connection.
 */
async function closeConnection() {
  await closeAllQueues();
  if (!sharedConnection) return;
  const c = sharedConnection;
  sharedConnection = null;
  try {
    await c.quit();
  } catch {
    /* ignore */
  }
}

/**
 * Create (or recreate) a BullMQ Queue handle. Caller owns the lifecycle —
 * call `.close()` when done.
 *
 * @param {string} name canonical queue name (use `QUEUE_NAMES.*`).
 * @param {object} [opts]
 * @param {object} [opts.defaultJobOptions] override default retry policy.
 * @returns {Queue}
 */
function createQueue(name, opts = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('createQueue: name is required');
  }
  return new Queue(name, {
    connection: getConnection(),
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      ...(opts.defaultJobOptions || {}),
    },
  });
}

/**
 * Return a process-wide cached Queue handle for `name`, creating it on
 * first call. Producers (request handlers, cron-style schedulers) and
 * the Bull Board mount share this cache so the same `Queue` instance is
 * reused across the codebase — avoids N redundant ioredis subscriptions
 * per queue and lets `closeAllQueues()` deterministically tear them down.
 *
 * Returns `null` if `REDIS_URL` is unset so callers can fall back to a
 * synchronous code path without throwing.
 *
 * @param {string} name canonical queue name (use `QUEUE_NAMES.*`).
 * @returns {Queue | null}
 */
function getOrCreateQueue(name) {
  if (!isQueueEnabled()) return null;
  const cached = _queueRegistry.get(name);
  if (cached) return cached;
  const q = createQueue(name);
  _queueRegistry.set(name, q);
  return q;
}

/**
 * Create a BullMQ Worker. The processor receives the raw `Job` and should
 * return the job result (or throw to trigger retry).
 *
 * @param {string} name canonical queue name.
 * @param {(job: import('bullmq').Job) => Promise<unknown>} processor
 * @param {object} [opts]
 * @param {number} [opts.concurrency=1]
 * @returns {Worker}
 */
function createWorker(name, processor, opts = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error('createWorker: name is required');
  }
  if (typeof processor !== 'function') {
    throw new Error('createWorker: processor must be a function');
  }
  return new Worker(name, processor, {
    connection: getConnection(),
    concurrency: opts.concurrency ?? 1,
  });
}

/**
 * Create a `QueueEvents` listener. Useful for tests + monitoring (waits
 * for `completed`/`failed` events).
 *
 * @param {string} name
 * @returns {QueueEvents}
 */
function createQueueEvents(name) {
  return new QueueEvents(name, { connection: getConnection() });
}

/**
 * Producer-safe enqueue helper. Mirrors `safeLogAudit()` in lib/audit:
 * if `REDIS_URL` is unset or the enqueue throws, log + return null
 * instead of bubbling — the user-facing flow keeps working synchronously.
 *
 * Callers who *require* the job to land (e.g. critical webhooks) should
 * call `queue.add()` directly and handle the failure themselves.
 *
 * @param {Queue} queue
 * @param {string} jobName
 * @param {unknown} payload
 * @param {object} [opts] passed through to `Queue.add`.
 * @returns {Promise<import('bullmq').Job | null>}
 */
async function safeEnqueue(queue, jobName, payload, opts) {
  if (!isQueueEnabled()) return null;
  try {
    return await queue.add(jobName, payload, opts);
  } catch (err) {
    log.error({ queue: queue?.name, job: jobName, err: err.message }, 'enqueue failed');
    return null;
  }
}

module.exports = {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  isQueueEnabled,
  getConnection,
  closeConnection,
  closeAllQueues,
  createQueue,
  getOrCreateQueue,
  createWorker,
  createQueueEvents,
  safeEnqueue,
};
