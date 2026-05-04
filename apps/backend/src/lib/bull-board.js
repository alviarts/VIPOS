/**
 * P2-04 PR-B Bull Board mount.
 *
 * Surfaces the BullMQ queues at `/api/admin/queues` for operator visibility.
 *
 * Gating:
 *   - `authenticateToken` so anonymous requests get 401.
 *   - `requireAdmin` so non-admin staff get 403.
 *   - Mount path is intentionally *outside* the legacy `/api/*` alias
 *     and the `/api/v1/*` versioned surface — Bull Board is an admin
 *     UI, not a tenant-facing API resource. Mirrors how
 *     `/api/admin/tenant` is mounted in `app.js`.
 *
 * Behaviour without Redis:
 *   - When `REDIS_URL` is unset we still mount the path, but every
 *     request returns 503. This keeps the route table predictable for
 *     tests (the auth/role checks still run) and avoids 404s in
 *     environments that haven't provisioned a broker yet.
 */
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { isQueueEnabled, getOrCreateQueue, QUEUE_NAMES } = require('./queue');

const BULL_BOARD_PATH = '/api/admin/queues';

/**
 * Mount Bull Board on the supplied Express `app`. Idempotent per-app —
 * the caller is `buildApp()` which is invoked at most once per Express
 * instance, so we don't bother caching the adapter across calls.
 *
 * @param {import('express').Express} app
 */
function mountBullBoard(app) {
  if (!isQueueEnabled()) {
    app.use(BULL_BOARD_PATH, authenticateToken, requireAdmin, (_req, res) => {
      res.status(503).json({ error: 'Bull Board disabled (REDIS_URL is not set)' });
    });
    return;
  }
  // Lazy-load the Bull Board deps so environments without Redis don't
  // pay the require cost (and so tests that turn Redis off mid-run can
  // skip the heavy init path entirely).
  const { createBullBoard } = require('@bull-board/api');
  const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
  const { ExpressAdapter } = require('@bull-board/express');

  const queues = Object.values(QUEUE_NAMES).map((name) => getOrCreateQueue(name));
  const adapter = new ExpressAdapter();
  adapter.setBasePath(BULL_BOARD_PATH);
  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter: adapter,
  });

  app.use(BULL_BOARD_PATH, authenticateToken, requireAdmin, adapter.getRouter());
}

module.exports = {
  mountBullBoard,
  BULL_BOARD_PATH,
};
