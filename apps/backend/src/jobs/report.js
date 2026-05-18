/**
 * P2-04 PR-C report processor.
 *
 * Implements the *first* chained-job pattern in the codebase:
 *
 *   POST /api/reports/schedule/:id/run → enqueue REPORT job
 *                                        ↓
 *                  jobs/report.js processor
 *                  (this file) — generates report, then
 *                                        ↓
 *                                        enqueues EMAIL job for each recipient
 *                                        ↓
 *                  jobs/email.js processor — delivers (mock).
 *
 * Job payload shape (REPORT queue):
 *   {
 *     tenant_id:    number,           // required
 *     user_id?:     number | null,
 *     schedule_id:  number,           // FK → report_schedules.id
 *     report_key:   string,           // matches catalog key
 *     name:         string,           // human-readable
 *     params_json?: string | null,
 *     recipients?:  string | null,    // comma/semicolon separated emails
 *     format?:      'pdf' | 'csv' | 'xlsx',
 *   }
 *
 * PR-C is intentionally a *mock* report generator — the actual data
 * fetch is stubbed (we just count rows from a low-cost source so the
 * audit row carries something realistic). Real report generation is
 * scope of P3 reporting work.
 *
 * Side effects:
 *   1. `audit_logs` row, entity='report', action='generate'.
 *   2. One enqueued `email` job per validated recipient. Subject and
 *      body templates are hard-coded for now.
 */
const { logAuditWithTenant } = require('../lib/audit');
const { runAsSystem, query } = require('../db');
const { QUEUE_NAMES, getOrCreateQueue, safeEnqueue, isQueueEnabled } = require('../lib/queue');
const { isPlausibleEmail } = require('./email');

const SUPPORTED_FORMATS = Object.freeze(['pdf', 'csv', 'xlsx']);

/**
 * Split a free-form `recipients` string (as stored on `report_schedules.recipients`)
 * into a deduped, validated list of email addresses.
 *
 * Accepts both `,` and `;` as delimiters — schedules entered through the
 * UI may use either. Whitespace is trimmed; entries that do not look like
 * an email are dropped (and surfaced via `dropped` for the caller).
 *
 * @param {string | null | undefined} raw
 * @returns {{ valid: string[], dropped: string[] }}
 */
function parseRecipients(raw) {
  if (!raw || typeof raw !== 'string') return { valid: [], dropped: [] };
  const seen = new Set();
  const valid = [];
  const dropped = [];
  for (const part of raw.split(/[,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (!isPlausibleEmail(trimmed)) {
      dropped.push(trimmed);
      continue;
    }
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    valid.push(trimmed);
  }
  return { valid, dropped };
}

/**
 * Mock report generation. We don't actually compute the report here —
 * that's deferred to P3 — but we do touch the database with a
 * cheap-but-non-trivial query so the audit row records something
 * realistic (a row count from a system-tenant table).
 */
async function generateReportSummary({ schedule_id, report_key }) {
  // Touch a cheap source table so the side-effect path is exercised.
  // We pick `audit_logs` as a stand-in; any tenant scope works because
  // we run as system. Real reports will scope per tenant.
  const { rows } = await runAsSystem(() =>
    query(`SELECT COUNT(*)::int AS c FROM audit_logs WHERE entity = $1`, ['report'])
  );
  return {
    schedule_id,
    report_key,
    generated_at: new Date().toISOString(),
    row_count: rows[0]?.c ?? 0,
  };
}

async function processReport(job) {
  const data = (job && job.data) || {};
  const { tenant_id, user_id, schedule_id, report_key, name, params_json, recipients, format } =
    data;
  if (tenant_id == null) {
    throw new Error('processReport: tenant_id is required');
  }
  if (schedule_id == null) {
    throw new Error('processReport: schedule_id is required');
  }
  if (!report_key) {
    throw new Error('processReport: report_key is required');
  }
  if (format && !SUPPORTED_FORMATS.includes(format)) {
    throw new Error(
      `processReport: format must be one of ${SUPPORTED_FORMATS.join(', ')} (got ${format})`
    );
  }

  const summary = await generateReportSummary({ schedule_id, report_key });

  const auditId = await logAuditWithTenant({
    tenant_id: Number(tenant_id),
    user_id: user_id != null ? Number(user_id) : null,
    entity: 'report',
    entity_id: String(schedule_id),
    action: 'generate',
    after: {
      schedule_id,
      report_key,
      name: name ?? null,
      params_json: params_json ?? null,
      format: format ?? 'pdf',
      summary,
    },
  });

  // Chain: enqueue one email job per recipient. We tolerate Redis being
  // off — `safeEnqueue` returns null and we record the no-op in the
  // returned shape so callers can tell.
  const { valid: validRecipients, dropped: droppedRecipients } = parseRecipients(recipients);
  const emailJobIds = [];
  if (validRecipients.length && isQueueEnabled()) {
    const emailQueue = getOrCreateQueue(QUEUE_NAMES.EMAIL);
    if (emailQueue) {
      for (const to of validRecipients) {
        const emailJob = await safeEnqueue(emailQueue, 'send', {
          tenant_id: Number(tenant_id),
          user_id: user_id != null ? Number(user_id) : null,
          to,
          subject: `Report: ${name || report_key} (${summary.generated_at.slice(0, 10)})`,
          body: [
            `Hi,`,
            ``,
            `Report "${name || report_key}" has been generated.`,
            ``,
            `Generated at: ${summary.generated_at}`,
            `Format: ${format ?? 'pdf'}`,
            `Reference: report-${schedule_id}-${auditId}`,
            ``,
            `(P2-04 PR-C mock body — no attachment yet.)`,
          ].join('\n'),
          metadata: {
            source: 'report-orchestration',
            schedule_id,
            report_key,
            audit_id: auditId,
          },
        });
        if (emailJob) emailJobIds.push(emailJob.id);
      }
    }
  }

  return {
    ok: true,
    schedule_id,
    report_key,
    audit_id: auditId,
    summary,
    email_job_ids: emailJobIds,
    recipient_count: validRecipients.length,
    dropped_recipients: droppedRecipients,
  };
}

module.exports = {
  processReport,
  parseRecipients,
  SUPPORTED_FORMATS,
};
