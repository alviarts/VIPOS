/**
 * P2-04 PR-B marketplace-webhook ingress.
 *
 *   POST /api/v1/marketplace-webhook/:tenant_slug/:provider
 *
 * Public (no JWT) endpoint that receives marketplace events from
 * upstream providers (gofood, grabfood, shopee, etc.) and enqueues a
 * `marketplace-webhook` job for async processing.
 *
 * Mounted as a *separate* router from `routes/marketplace.js` because
 * the latter is behind `advanceGate` (`authenticateToken + requireTier`),
 * which is incompatible with public webhook ingress.
 *
 * Tenant resolution:
 *   `:tenant_slug` is looked up in the `tenants` table (RLS-bypassed
 *   because webhooks have no JWT scope yet). Unknown slug → 404.
 *
 * Signature verification (optional):
 *   When `MARKETPLACE_WEBHOOK_SECRET` is set, the request must include
 *   header `X-Marketplace-Signature: sha256=<hmac>` where the hmac is
 *   computed over the raw request body. Mismatch → 401. When the env
 *   var is unset (dev/test default) verification is skipped — useful
 *   for mock providers but not for production.
 *
 * Idempotency:
 *   The body MUST include `event_id`. The producer sets BullMQ jobId
 *   to `${tenant_id}:${provider}:${event_id}` so duplicate POSTs from
 *   the upstream's at-least-once retry semantics resolve to the same
 *   job. The worker also dedupes against `audit_logs` as a backstop.
 *
 * Body:
 *   {
 *     event_id:    string,    // unique upstream identifier — required
 *     event_type?: string,    // e.g. 'order.created'
 *     data?:       unknown,   // raw upstream payload
 *   }
 */
const crypto = require('crypto');
const express = require('express');
const { runAsSystem, query } = require('../db');
const { QUEUE_NAMES, isQueueEnabled, getOrCreateQueue, safeEnqueue } = require('../lib/queue');
const { fingerprint } = require('../jobs/marketplace-webhook');
const { child } = require('../lib/logger');

const log = child({ component: 'marketplace-webhook' });

const router = express.Router();

const SUPPORTED_PROVIDERS = Object.freeze([
  'gofood',
  'grabfood',
  'shopeefood',
  'tokopedia',
  'shopee',
]);

function verifySignature(req) {
  const secret = process.env.MARKETPLACE_WEBHOOK_SECRET;
  if (!secret) return true; // verification disabled in dev/test
  const header = req.headers['x-marketplace-signature'];
  if (!header || typeof header !== 'string') return false;
  // Expect `sha256=<hex>`.
  const m = header.match(/^sha256=([0-9a-f]+)$/i);
  if (!m) return false;
  const provided = Buffer.from(m[1], 'hex');
  // We need the raw request body; Express parses it to JSON for us so
  // we re-stringify deterministically. Producers must use canonical
  // JSON (no whitespace) when computing the HMAC client-side.
  const raw = JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', secret).update(raw).digest();
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

async function resolveTenantId(slug) {
  if (!slug || typeof slug !== 'string') return null;
  const r = await runAsSystem(() => query('SELECT id FROM tenants WHERE slug = $1', [slug]));
  return r.rows[0]?.id ?? null;
}

router.post('/:tenant_slug/:provider', async (req, res) => {
  try {
    const { tenant_slug: tenantSlug, provider } = req.params;
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        error: `provider tidak didukung (boleh: ${SUPPORTED_PROVIDERS.join(', ')})`,
      });
    }
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Signature tidak valid' });
    }
    const tenantId = await resolveTenantId(tenantSlug);
    if (tenantId == null) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    }
    const { event_id, event_type, data } = req.body || {};
    if (!event_id || typeof event_id !== 'string') {
      return res.status(400).json({ error: 'event_id wajib diisi (string)' });
    }
    const payload = {
      tenant_id: tenantId,
      provider,
      event_id,
      event_type: event_type || null,
      data: data ?? null,
      received_at: new Date().toISOString(),
    };
    if (!isQueueEnabled()) {
      // Sync fallback: ack 202 but log the event was received without a
      // broker. Worker side-effect (audit row) is skipped in this mode.
      log.info({ tenantId, provider, event_id }, 'sync fallback');
      return res.status(202).json({ enqueued: false, sync: true });
    }
    const queue = getOrCreateQueue(QUEUE_NAMES.MARKETPLACE_WEBHOOK);
    // jobId = tenant:provider:event_id → BullMQ will treat duplicates as
    // a no-op even if the upstream retries the POST. The worker also
    // dedupes against `audit_logs` as a defensive backstop in case a
    // duplicate makes it past the broker (e.g. BullMQ queue rotated
    // before the dedup window expires).
    const jobId = `${tenantId}:${fingerprint(provider, event_id)}`;
    const job = await safeEnqueue(queue, 'process', payload, { jobId });
    if (!job) {
      return res.status(202).json({ enqueued: false, sync: true });
    }
    return res.status(202).json({
      enqueued: true,
      job_id: job.id,
      queue: queue.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.SUPPORTED_PROVIDERS = SUPPORTED_PROVIDERS;
module.exports = router;
