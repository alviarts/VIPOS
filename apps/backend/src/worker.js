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
require('dotenv').config();

const { startWorkers } = require('./jobs');

(async () => {
  if (!process.env.REDIS_URL) {
    console.error('[worker] REDIS_URL is required');
    process.exit(1);
  }

  let stop;
  try {
    stop = await startWorkers();
    console.log('[worker] ready');
  } catch (err) {
    console.error('[worker] failed to start:', err);
    process.exit(1);
  }

  const shutdown = async (signal) => {
    console.log(`[worker] received ${signal}, draining jobs...`);
    try {
      await stop();
    } catch (err) {
      console.error('[worker] shutdown error:', err.message);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
