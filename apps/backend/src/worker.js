/**
 * Standalone worker process entry point (P2-04).
 *
 * Boots every BullMQ worker registered in `src/jobs/index.js` and keeps
 * the process alive until SIGTERM/SIGINT. Designed to run alongside the
 * API server in a separate container / systemd unit:
 *
 *   npm run worker --workspace=apps/backend
 *
 * Required env:
 *   - REDIS_URL   redis://host:6379
 *   - DATABASE_URL  (jobs that touch the DB use the same Postgres pool)
 *
 * Operational notes:
 *   - Process exits non-zero on startup error so the supervisor can
 *     restart it.
 *   - On SIGTERM/SIGINT we call `stop()` to drain in-flight jobs cleanly,
 *     then exit 0.
 *   - This file is intentionally tiny — the real logic lives in
 *     `src/jobs/`. Keep it that way so unit tests can import jobs without
 *     starting workers.
 */
// Load `.env` with `override: true` so that the file's values win over any
// stale env that pm2 may have cached when the supervisor was first
// started (P2-08 RCA, 2026-05-06). Without this flag, dotenv's default
// "first wins" semantics let pre-existing process.env entries silently
// shadow rotated credentials, e.g. a stale DIRECT_URL that survived a
// `pm2 restart vipos-worker --update-env` because pm2's stored env had
// captured the old value at first boot. The worker then runs with the
// stale URL and pg_dump fails with `password authentication failed for
// user "postgres"` even though the on-disk .env is correct. Override
// makes .env the unambiguous source of truth for every env var the
// worker reads, which is exactly the contract this file is intended to
// honor.
require('dotenv').config({ override: true });

const { startWorkers } = require('./jobs');
const { child } = require('./lib/logger');

const log = child({ component: 'worker' });

(async () => {
  if (!process.env.REDIS_URL) {
    log.fatal('REDIS_URL is required');
    process.exit(1);
  }

  let stop;
  try {
    stop = await startWorkers();
    log.info('ready');
  } catch (err) {
    log.fatal({ err: { message: err.message, stack: err.stack } }, 'failed to start');
    process.exit(1);
  }

  const shutdown = async (signal) => {
    log.info({ signal }, 'received signal, draining jobs');
    try {
      await stop();
    } catch (err) {
      log.error({ err: err.message }, 'shutdown error');
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
