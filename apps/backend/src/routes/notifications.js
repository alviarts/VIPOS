/**
 * P2-04 PR-B notification ingress.
 *
 *   POST /api/v1/notifications
 *
 * Admin-only producer that drops a job onto the `notification` queue.
 * Mirrors the `safeLogAudit()` pattern: when Redis is unavailable we
 * respond with `enqueued: false, sync: true` rather than 5xx, so the
 * caller's user-facing flow keeps working. Real delivery (push, in-app,
 * SMS) lives in the worker — see `jobs/notification.js`.
 *
 * Body:
 *   {
 *     kind:      'push' | 'inapp' | 'sms',
 *     recipient: string,         // free-form (user_id, device token, phone)
 *     payload?:  unknown,        // free-form (title, body, data)
 *   }
 */
const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { QUEUE_NAMES, isQueueEnabled, getOrCreateQueue, safeEnqueue } = require('../lib/queue');
const { SUPPORTED_KINDS } = require('../jobs/notification');
const { child } = require('../lib/logger');

const log = child({ component: 'notifications' });

const router = express.Router();

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { kind, recipient, payload } = req.body || {};
  if (!kind || !SUPPORTED_KINDS.includes(kind)) {
    return res.status(400).json({
      error: `kind harus salah satu: ${SUPPORTED_KINDS.join(', ')}`,
    });
  }
  if (!recipient || typeof recipient !== 'string') {
    return res.status(400).json({ error: 'recipient wajib diisi (string)' });
  }
  const data = {
    tenant_id: req.tenantId ?? null,
    user_id: req.user?.id ?? null,
    kind,
    recipient,
    payload: payload ?? null,
  };
  if (!isQueueEnabled()) {
    // Fallback: log + acknowledge. Keeps API contract stable when Redis
    // is offline. The worker will replay nothing — that is the cost of
    // running without the broker.
    log.info({ kind, recipient }, 'sync fallback (REDIS_URL unset)');
    return res.status(202).json({ enqueued: false, sync: true });
  }
  const queue = getOrCreateQueue(QUEUE_NAMES.NOTIFICATION);
  const job = await safeEnqueue(queue, kind, data);
  if (!job) {
    return res.status(202).json({ enqueued: false, sync: true });
  }
  return res.status(202).json({
    enqueued: true,
    job_id: job.id,
    queue: queue.name,
  });
});

module.exports = router;
