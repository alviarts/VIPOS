/**
 * P2-04 PR-B email ingress.
 *
 *   POST /api/v1/email/send
 *
 * Admin-only producer that drops a job onto the `email` queue. Mirrors
 * the notification ingress (`routes/notifications.js`): admin-gated,
 * fire-and-forget, falls back to `sync: true` when Redis is offline.
 * Real provider (Mailgun / SES / SMTP) integration lives in the worker
 * — see `jobs/email.js`.
 *
 * Body:
 *   {
 *     to:        string,    // RFC-5322-ish recipient
 *     subject:   string,
 *     body:      string,    // plain text or HTML
 *     metadata?: unknown,   // template_id, locale, etc.
 *   }
 */
const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { QUEUE_NAMES, isQueueEnabled, getOrCreateQueue, safeEnqueue } = require('../lib/queue');
const { isPlausibleEmail } = require('../jobs/email');
const { child } = require('../lib/logger');

const log = child({ component: 'email' });

const router = express.Router();

router.post('/send', authenticateToken, requireAdmin, async (req, res) => {
  const { to, subject, body, metadata } = req.body || {};
  if (!isPlausibleEmail(to)) {
    return res.status(400).json({ error: 'to harus email yang valid (mengandung "@" dan domain)' });
  }
  if (!subject || typeof subject !== 'string') {
    return res.status(400).json({ error: 'subject wajib diisi (string)' });
  }
  if (typeof body !== 'string') {
    return res.status(400).json({ error: 'body wajib diisi (string)' });
  }
  const data = {
    tenant_id: req.tenantId ?? null,
    user_id: req.user?.id ?? null,
    to,
    subject,
    body,
    metadata: metadata ?? null,
  };
  if (!isQueueEnabled()) {
    log.info({ to, subject }, 'sync fallback (REDIS_URL unset)');
    return res.status(202).json({ enqueued: false, sync: true });
  }
  const queue = getOrCreateQueue(QUEUE_NAMES.EMAIL);
  const job = await safeEnqueue(queue, 'send', data);
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
