/**
 * P2-04 PR-B email processor.
 *
 * Job payload shape:
 *   {
 *     tenant_id: number,           // required — RLS scope for the audit row
 *     user_id?:  number | null,    // optional — actor (e.g. admin who sent)
 *     to:        string,           // RFC-5322-ish recipient
 *     subject:   string,
 *     body:      string,           // plain text or HTML — no rendering yet
 *     metadata?: unknown,          // free-form (template_id, locale, etc.)
 *   }
 *
 * PR-B is a mock provider — no SMTP / Mailgun / SES integration. Side
 * effect: an `audit_logs` row with `entity='email'` so observers can
 * verify the round-trip. Tests assert on this row.
 */
const { logAuditWithTenant } = require('../lib/audit');

function isPlausibleEmail(s) {
  return typeof s === 'string' && /.+@.+\..+/.test(s);
}

async function processEmail(job) {
  const { tenant_id, user_id, to, subject, body, metadata } = (job && job.data) || {};
  if (tenant_id == null) {
    throw new Error('processEmail: tenant_id is required');
  }
  if (!isPlausibleEmail(to)) {
    throw new Error('processEmail: to must look like an email address');
  }
  if (!subject || typeof subject !== 'string') {
    throw new Error('processEmail: subject is required');
  }
  if (typeof body !== 'string') {
    throw new Error('processEmail: body must be a string');
  }
  const auditId = await logAuditWithTenant({
    tenant_id: Number(tenant_id),
    user_id: user_id != null ? Number(user_id) : null,
    entity: 'email',
    entity_id: job?.id != null ? String(job.id) : null,
    action: 'send',
    after: { to, subject, body, metadata: metadata ?? null },
  });
  return { ok: true, to, subject, audit_id: auditId };
}

module.exports = {
  processEmail,
  isPlausibleEmail,
};
