/**
 * P2-04 PR-B notification processor.
 *
 * Job payload shape:
 *   {
 *     tenant_id: number,           // required — RLS scope for the audit row
 *     user_id?:  number | null,    // optional — actor on the audit row
 *     kind:      'push' | 'inapp' | 'sms',
 *     recipient: string,           // user_id, device token, phone, etc.
 *     payload?:  unknown,          // free-form body (title/message/etc.)
 *   }
 *
 * PR-B is intentionally a *mock* delivery layer — there is no real push
 * gateway / SMS provider wired up yet. The processor's only durable side
 * effect is an `audit_logs` row with `entity='notification'` so operators
 * (and tests) can verify the round-trip end-to-end.
 *
 * Real provider integrations are scope of follow-up sessions.
 */
const { logAuditWithTenant } = require('../lib/audit');

const SUPPORTED_KINDS = Object.freeze(['push', 'inapp', 'sms']);

async function processNotification(job) {
  const { tenant_id, user_id, kind, recipient, payload } = (job && job.data) || {};
  if (tenant_id == null) {
    throw new Error('processNotification: tenant_id is required');
  }
  if (!kind || !SUPPORTED_KINDS.includes(kind)) {
    throw new Error(
      `processNotification: kind must be one of ${SUPPORTED_KINDS.join(', ')} (got ${kind})`
    );
  }
  if (!recipient) {
    throw new Error('processNotification: recipient is required');
  }
  const auditId = await logAuditWithTenant({
    tenant_id: Number(tenant_id),
    user_id: user_id != null ? Number(user_id) : null,
    entity: 'notification',
    entity_id: job?.id != null ? String(job.id) : null,
    action: 'send',
    after: { kind, recipient, payload: payload ?? null },
  });
  return { ok: true, kind, recipient, audit_id: auditId };
}

module.exports = {
  processNotification,
  SUPPORTED_KINDS,
};
