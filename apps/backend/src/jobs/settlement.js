/**
 * P2-04 PR-C settlement processor.
 *
 * Job payload shape (SETTLEMENT queue):
 *   {
 *     tenant_id:  number,             // required — RLS scope
 *     user_id?:   number | null,      // actor on the audit row
 *     from?:      string,             // ISO date YYYY-MM-DD inclusive
 *     to?:        string,             // ISO date YYYY-MM-DD inclusive
 *     providers?: string[] | null,    // null/empty → all providers
 *   }
 *
 * Side effect (PR-C mock): one `audit_logs` row per (tenant, range,
 * providers) triple, summarising gross / mdr / net per provider plus the
 * grand totals. The "external" reconcile diff is stubbed to 0; a future
 * PR can wire up actual provider-side fetch + diff and write the diff
 * into the same audit row.
 *
 * Idempotency:
 *   Producers SHOULD set BullMQ `jobId` to
 *     `${tenant_id}:${from}:${to}:${providers_sorted}`
 *   so a duplicate trigger of the same range/providers combo is a no-op
 *   at the broker level. The processor itself is *not* defensive against
 *   duplicate audit rows — replays will simply produce another audit
 *   entry, which is the correct semantic for a reconcile that may run
 *   manually multiple times during the same window.
 */
const { logAuditWithTenant } = require('../lib/audit');
const { runAsSystem, query } = require('../db');

const SUPPORTED_PROVIDERS = Object.freeze([
  'gofood',
  'grabfood',
  'shopeefood',
  'tokopedia',
  'shopee',
]);

function normaliseProviders(input) {
  if (input == null) return null;
  if (!Array.isArray(input)) {
    throw new Error('processSettlement: providers must be an array of strings');
  }
  const out = [];
  for (const p of input) {
    if (typeof p !== 'string' || !p) {
      throw new Error('processSettlement: providers entries must be non-empty strings');
    }
    if (!SUPPORTED_PROVIDERS.includes(p)) {
      throw new Error(
        `processSettlement: unsupported provider "${p}" (allowed: ${SUPPORTED_PROVIDERS.join(', ')})`
      );
    }
    if (!out.includes(p)) out.push(p);
  }
  out.sort();
  return out;
}

async function reconcile({ tenant_id, from, to, providers }) {
  // Run the same query family as `GET /api/marketplace/settlement` so
  // the worker sees the same numbers the read-only endpoint would.
  // RLS bypass — settlement rolls up data across the tenant; the
  // tenant scope is enforced via the WHERE clause on online_orders.
  const where = ["status = 'COMPLETED'", `tenant_id = $1`];
  const params = [tenant_id];
  let p = 2;
  if (from) {
    where.push(`completed_at >= $${p++}`);
    params.push(from);
  }
  if (to) {
    where.push(`completed_at <= $${p++}`);
    params.push(to);
  }
  if (providers && providers.length) {
    where.push(`channel = ANY($${p++})`);
    params.push(providers);
  }
  const rowsResult = await runAsSystem(() =>
    query(
      `SELECT channel AS provider,
              COUNT(*)::int  AS completed_orders,
              COALESCE(SUM(total), 0)::float8 AS gross_revenue
         FROM online_orders
         WHERE ${where.join(' AND ')}
         GROUP BY channel
         ORDER BY channel`,
      params
    )
  );
  const connsResult = await runAsSystem(() =>
    query(`SELECT provider, mdr_percent FROM marketplace_connections WHERE tenant_id = $1`, [
      tenant_id,
    ])
  );
  const mdrByProvider = new Map(
    connsResult.rows.map((c) => [c.provider, Number(c.mdr_percent || 0)])
  );

  const enriched = rowsResult.rows.map((r) => {
    const gross = Number(r.gross_revenue || 0);
    const mdrPct = mdrByProvider.get(r.provider) || 0;
    const mdr = Number(((gross * mdrPct) / 100).toFixed(2));
    return {
      provider: r.provider,
      completed_orders: Number(r.completed_orders),
      gross_revenue: gross,
      mdr,
      net_revenue: Number((gross - mdr).toFixed(2)),
    };
  });
  const totals = enriched.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross_revenue,
      mdr: acc.mdr + r.mdr,
      net: acc.net + r.net_revenue,
      orders: acc.orders + r.completed_orders,
    }),
    { gross: 0, mdr: 0, net: 0, orders: 0 }
  );
  return { rows: enriched, totals, external_diff: 0 };
}

async function processSettlement(job) {
  const { tenant_id, user_id, from, to, providers } = (job && job.data) || {};
  if (tenant_id == null) {
    throw new Error('processSettlement: tenant_id is required');
  }
  const providersNorm = normaliseProviders(providers);
  const result = await reconcile({
    tenant_id: Number(tenant_id),
    from: from || null,
    to: to || null,
    providers: providersNorm,
  });
  const auditId = await logAuditWithTenant({
    tenant_id: Number(tenant_id),
    user_id: user_id != null ? Number(user_id) : null,
    entity: 'settlement',
    entity_id: job?.id != null ? String(job.id) : null,
    action: 'reconcile',
    after: {
      from: from || null,
      to: to || null,
      providers: providersNorm,
      ...result,
    },
  });
  return { ok: true, audit_id: auditId, ...result };
}

module.exports = {
  processSettlement,
  normaliseProviders,
  SUPPORTED_PROVIDERS,
};
