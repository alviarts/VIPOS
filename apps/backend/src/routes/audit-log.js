// P2-03 Audit log read + export API.
//
// Mounted as `/api/v1/audit-log` behind `requireTier('advance')` (audit
// trail is an Advance+ compliance feature, consistent with other reporting
// endpoints in this app). Admin-only because mutation history can leak
// PII and operational secrets to non-admin staff.
//
// Filters supported (all optional, ANDed together):
//   user_id     — number, exact match.
//   entity      — string, exact match (e.g. 'product').
//   entity_id   — string, exact match (stored as TEXT for flexibility).
//   action      — string, exact match (e.g. 'update').
//   from        — ISO-8601 timestamp; rows with created_at >= from.
//   to          — ISO-8601 timestamp; rows with created_at <= to.
// Pagination:
//   limit       — default 50, max 500.
//   offset      — default 0.
// Sort: created_at DESC, id DESC (most recent first; deterministic).

const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

function parseIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildFilters(req) {
  const where = [];
  const params = [];
  let i = 1;

  const userId = parseIntOrNull(req.query.user_id);
  if (userId != null) {
    where.push(`user_id = $${i++}`);
    params.push(userId);
  }
  if (req.query.entity) {
    where.push(`entity = $${i++}`);
    params.push(String(req.query.entity));
  }
  if (req.query.entity_id) {
    where.push(`entity_id = $${i++}`);
    params.push(String(req.query.entity_id));
  }
  if (req.query.action) {
    where.push(`action = $${i++}`);
    params.push(String(req.query.action));
  }
  const from = parseDateOrNull(req.query.from);
  if (from) {
    where.push(`created_at >= $${i++}`);
    params.push(from);
  }
  const to = parseDateOrNull(req.query.to);
  if (to) {
    where.push(`created_at <= $${i++}`);
    params.push(to);
  }
  return {
    whereSql: where.length ? 'WHERE ' + where.join(' AND ') : '',
    params,
    nextIdx: i,
  };
}

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = Math.max(
      1,
      Math.min(parseIntOrNull(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT)
    );
    const offset = Math.max(0, parseIntOrNull(req.query.offset) || 0);
    const { whereSql, params, nextIdx } = buildFilters(req);

    const rowsParams = params.concat([limit, offset]);
    const rowsR = await query(
      `SELECT id, user_id, entity, entity_id, action,
              before_json, after_json, host(ip) AS ip, user_agent, created_at
         FROM audit_logs
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      rowsParams
    );
    const totalR = await query(`SELECT count(*)::int AS count FROM audit_logs ${whereSql}`, params);

    res.json({
      rows: rowsR.rows,
      total: totalR.rows[0]?.count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function csvCell(v) {
  if (v == null) return '';
  let s;
  if (typeof v === 'string') {
    s = v;
  } else if (typeof v === 'object') {
    s = JSON.stringify(v);
  } else {
    s = String(v);
  }
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

router.get('/export.csv', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { whereSql, params } = buildFilters(req);
    const r = await query(
      `SELECT id, user_id, entity, entity_id, action,
              before_json, after_json, host(ip) AS ip, user_agent, created_at
         FROM audit_logs
         ${whereSql}
         ORDER BY created_at DESC, id DESC`,
      params
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    const lines = [
      'id,user_id,entity,entity_id,action,before_json,after_json,ip,user_agent,created_at',
    ];
    for (const row of r.rows) {
      lines.push(
        [
          row.id,
          row.user_id ?? '',
          csvCell(row.entity),
          csvCell(row.entity_id),
          csvCell(row.action),
          csvCell(row.before_json),
          csvCell(row.after_json),
          csvCell(row.ip),
          csvCell(row.user_agent),
          new Date(row.created_at).toISOString(),
        ].join(',')
      );
    }
    res.send(lines.join('\n') + '\n');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
