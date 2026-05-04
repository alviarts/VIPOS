// P2-03 Audit logging helper.
//
// Insert a row into `audit_logs` for mutation / auth / permission events.
// `logAudit(req, entry)` is the common case — it expects an authenticated
// request (so `req.user` and the AsyncLocalStorage tenant scope are set).
// `logAuditWithTenant({...})` is for flows that don't go through
// `authenticateToken` (login, public webhooks) and need to assert the
// tenant scope explicitly so RLS + the column DEFAULT pick the right id.

const { query, runWithTenant } = require('../db');

const ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LOGIN: 'login',
  LOGOUT: 'logout',
  VOID: 'void',
  REFUND: 'refund',
  PERMISSION_CHANGE: 'permission_change',
});

function reqUserId(req) {
  if (!req || !req.user) return null;
  // JWT payload uses `id` after signAccessToken in this codebase; older
  // call sites may set `user_id`.
  if (req.user.id != null) return Number(req.user.id);
  if (req.user.user_id != null) return Number(req.user.user_id);
  return null;
}

function reqIp(req) {
  // Prefer Express's resolved req.ip (which honors trust proxy). Fall back
  // to the socket address. Returns null on lookup failures so the INSERT
  // simply leaves the column NULL rather than blowing up.
  if (!req) return null;
  const ip = req.ip || req.socket?.remoteAddress || null;
  if (!ip) return null;
  // Strip the IPv4-mapped IPv6 prefix Express sometimes adds — Postgres'
  // INET column rejects "::ffff:127.0.0.1" formatted strings.
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function reqUserAgent(req) {
  return req?.headers?.['user-agent'] || null;
}

function jsonOrNull(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}

const INSERT_SQL = `
  INSERT INTO audit_logs
    (user_id, entity, entity_id, action,
     before_json, after_json, ip, user_agent)
  VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::inet, $8)
  RETURNING id
`;

async function logAudit(req, entry) {
  if (!entry || !entry.entity || !entry.action) {
    throw new Error('logAudit: entity and action are required');
  }
  const params = [
    reqUserId(req),
    entry.entity,
    entry.entity_id != null ? String(entry.entity_id) : null,
    entry.action,
    jsonOrNull(entry.before),
    jsonOrNull(entry.after),
    reqIp(req),
    reqUserAgent(req),
  ];
  const r = await query(INSERT_SQL, params);
  return r.rows[0]?.id ?? null;
}

async function logAuditWithTenant(entry) {
  if (!entry || !entry.tenant_id || !entry.entity || !entry.action) {
    throw new Error('logAuditWithTenant: tenant_id, entity and action are required');
  }
  return runWithTenant(entry.tenant_id, async () => {
    const params = [
      entry.user_id != null ? Number(entry.user_id) : null,
      entry.entity,
      entry.entity_id != null ? String(entry.entity_id) : null,
      entry.action,
      jsonOrNull(entry.before),
      jsonOrNull(entry.after),
      entry.ip || null,
      entry.user_agent || null,
    ];
    const r = await query(INSERT_SQL, params);
    return r.rows[0]?.id ?? null;
  });
}

// Fire-and-await wrapper that swallows any audit-write failure so the
// surrounding mutation handler does not 500 just because the audit
// pipeline is down. The call still awaits in order to keep the error
// visible in tests (which assert on the inserted row), so failures land
// in the request log, not in the user-facing response.
async function safeLogAudit(req, entry) {
  try {
    return await logAudit(req, entry);
  } catch (err) {
    console.error(
      '[audit] failed to log',
      entry?.entity,
      entry?.action,
      entry?.entity_id,
      err?.message
    );
    return null;
  }
}

module.exports = { logAudit, logAuditWithTenant, safeLogAudit, ACTIONS };
