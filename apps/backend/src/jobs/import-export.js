/**
 * P2-04 PR-C import-export processor.
 *
 * Job payload shape (IMPORT_EXPORT queue):
 *   {
 *     tenant_id:  number,             // required — RLS scope
 *     user_id?:   number | null,
 *     entity:     string,             // one of SUPPORTED_ENTITIES
 *     rows:       Array<Record<string, unknown>>,
 *   }
 *
 * The async producer at `POST /api/v1/import-export/import/:entity/async`
 * enqueues this job; the worker performs the same bulk insert that the
 * synchronous endpoint at `POST /api/import-export/import/:entity` does
 * — wrapped in a single transaction, scoped to the tenant via
 * `runWithTenant`. Side effect on success: an `audit_logs` row with
 * entity='import-export', action='import', `after_json` summarising
 * counts.
 *
 * SUPPORTED_ENTITIES is intentionally identical to the sync endpoint's
 * whitelist — keep in sync if either side changes.
 */
const { logAuditWithTenant } = require('../lib/audit');
const { tx, runWithTenant } = require('../db');

const SUPPORTED_ENTITIES = Object.freeze([
  'products',
  'customers',
  'employees',
  'gl_accounts',
  'gl_vendors',
]);

async function processImportExport(job) {
  const { tenant_id, user_id, entity, rows } = (job && job.data) || {};
  if (tenant_id == null) {
    throw new Error('processImportExport: tenant_id is required');
  }
  if (!entity || !SUPPORTED_ENTITIES.includes(entity)) {
    throw new Error(
      `processImportExport: entity must be one of ${SUPPORTED_ENTITIES.join(', ')} (got ${entity})`
    );
  }
  if (!Array.isArray(rows)) {
    throw new Error('processImportExport: rows must be an array');
  }
  if (rows.length === 0) {
    const auditId = await logAuditWithTenant({
      tenant_id: Number(tenant_id),
      user_id: user_id != null ? Number(user_id) : null,
      entity: 'import-export',
      entity_id: entity,
      action: 'import',
      after: { entity, total: 0, inserted: 0, errors: [] },
    });
    return { ok: true, entity, total: 0, inserted: 0, errors: [], audit_id: auditId };
  }
  const sampleCols = Object.keys(rows[0]);
  if (sampleCols.length === 0) {
    throw new Error('processImportExport: rows[0] must have at least one column');
  }

  let inserted = 0;
  const errors = [];

  // Tenant scope: queries inside `tx` see RLS for the target entity.
  await runWithTenant(Number(tenant_id), () =>
    tx(async (txQuery) => {
      for (const r of rows) {
        try {
          const cols = sampleCols.filter((c) => c in r && c !== 'id');
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
          const values = cols.map((c) => r[c]);
          await txQuery(
            `INSERT INTO ${entity} (${cols.join(',')}) VALUES (${placeholders})`,
            values
          );
          inserted++;
        } catch (err) {
          errors.push({ row: r, error: err.message });
        }
      }
    })
  );

  const auditId = await logAuditWithTenant({
    tenant_id: Number(tenant_id),
    user_id: user_id != null ? Number(user_id) : null,
    entity: 'import-export',
    entity_id: entity,
    action: 'import',
    after: {
      entity,
      total: rows.length,
      inserted,
      error_count: errors.length,
      // Don't dump full error rows into the audit row — size could
      // explode on large imports. Surface counts only; producers can
      // capture a per-row report from the job result.
    },
  });

  return {
    ok: true,
    entity,
    total: rows.length,
    inserted,
    errors,
    audit_id: auditId,
  };
}

module.exports = {
  processImportExport,
  SUPPORTED_ENTITIES,
};
