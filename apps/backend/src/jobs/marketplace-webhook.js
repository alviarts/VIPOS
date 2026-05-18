/**
 * P2-04 PR-B marketplace-webhook processor.
 *
 * Idempotency contract:
 *   Producers MUST set BullMQ `jobId` to `${provider}:${event_id}` (or
 *   `${tenant_id}:${provider}:${event_id}` if the event is tenant-scoped)
 *   on `queue.add(...)`. BullMQ's deduplicates: a second `add` with the
 *   same jobId is a no-op and returns the existing job. The processor
 *   itself is also defensive — it will *not* throw if the same audit row
 *   already exists for `(provider, event_id)`, but it WILL skip the
 *   duplicate insert so retries / replays stay safe.
 *
 * Job payload shape:
 *   {
 *     tenant_id?: number | null,   // optional — null for unscoped events
 *     provider:   string,          // e.g. 'gofood', 'grabfood', 'shopee'
 *     event_id:   string,          // upstream's unique event identifier
 *     event_type: string,          // e.g. 'order.created'
 *     data:       unknown,         // raw upstream payload (forwarded as-is)
 *     received_at?: string,        // ISO-8601 ingress timestamp
 *   }
 *
 * Side effect (PR-B mock): one `audit_logs` row per unique
 * `(provider, event_id)` pair. Real handlers (insert into `online_orders`,
 * recompute settlement totals, etc.) come in PR-C.
 */
const { logAuditWithTenant } = require('../lib/audit');
const { runAsSystem, query } = require('../db');

function fingerprint(provider, eventId) {
  return `${provider}:${eventId}`;
}

async function alreadyProcessed(provider, eventId) {
  // RLS bypass — webhooks may have no tenant scope, and we want a global
  // dedupe key per (provider, event_id) regardless of which tenant owns
  // the eventual record.
  const r = await runAsSystem(() =>
    query(
      `SELECT id FROM audit_logs
         WHERE entity = 'marketplace-webhook'
           AND entity_id = $1
         LIMIT 1`,
      [fingerprint(provider, eventId)]
    )
  );
  return r.rows[0] ? r.rows[0].id : null;
}

async function processMarketplaceWebhook(job) {
  const { tenant_id, provider, event_id, event_type, data, received_at } = (job && job.data) || {};
  if (!provider || typeof provider !== 'string') {
    throw new Error('processMarketplaceWebhook: provider is required');
  }
  if (!event_id) {
    throw new Error('processMarketplaceWebhook: event_id is required');
  }
  // Idempotency: short-circuit if an audit row already exists for this
  // fingerprint. This protects against retries that bypass the BullMQ
  // jobId dedupe (e.g. a job that completed but whose audit insert
  // committed *before* the worker recorded the result).
  const existing = await alreadyProcessed(provider, event_id);
  if (existing) {
    return {
      ok: true,
      provider,
      event_id,
      duplicate: true,
      audit_id: existing,
    };
  }
  // Tenant scope: if the webhook ingress resolved a tenant, use it; else
  // fall back to the system tenant (1) so RLS still has a valid scope.
  const tenantId = tenant_id != null ? Number(tenant_id) : 1;
  const auditId = await logAuditWithTenant({
    tenant_id: tenantId,
    user_id: null,
    entity: 'marketplace-webhook',
    entity_id: fingerprint(provider, event_id),
    action: 'process',
    after: {
      provider,
      event_id,
      event_type: event_type || null,
      data: data ?? null,
      received_at: received_at || null,
    },
  });
  return { ok: true, provider, event_id, duplicate: false, audit_id: auditId };
}

module.exports = {
  processMarketplaceWebhook,
  fingerprint,
};
