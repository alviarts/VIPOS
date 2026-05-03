// /api/commission-group — CRUD untuk grup komisi (FIXED / TIERED).
// Pola JSON storage konsisten dengan promo (P1-08): array di-stringify
// sebelum simpan, di-parse balik saat baca.

const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CommissionGroupCreateSchema, CommissionGroupUpdateSchema } = require('@vipos/shared');

const router = express.Router();

const JSON_FIELDS = [
  'applies_to_role_keys',
  'applies_to_employee_ids',
  'applies_to_category_ids',
  'applies_to_product_ids',
  'tiers',
];

const COLUMNS = [
  'name',
  'description',
  'type',
  'applies_to_scope',
  'applies_to_role_keys',
  'applies_to_employee_ids',
  'applies_to_products_scope',
  'applies_to_category_ids',
  'applies_to_product_ids',
  'amount',
  'amount_basis',
  'tiers',
  'calc_period',
  'is_active',
];

function parseJsonField(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (_e) {
    return fallback;
  }
}

function serializeJsonField(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function rowToGroup(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of JSON_FIELDS) {
    out[field] = parseJsonField(row[field], null);
  }
  out.is_active = !!row.is_active;
  return out;
}

function normalizeBody(body) {
  const out = { ...body };
  for (const field of JSON_FIELDS) {
    if (field in out) {
      out[field] = serializeJsonField(out[field], null);
    }
  }
  if ('is_active' in out) out.is_active = out.is_active ? 1 : 0;
  return out;
}

function validateTypeSpecific(body) {
  if (body.type === 'FIXED') {
    if (body.amount === null || body.amount === undefined || Number(body.amount) <= 0) {
      return 'Amount wajib > 0 untuk FIXED';
    }
  }
  if (body.type === 'TIERED') {
    const tiers = body.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return 'TIERED butuh minimal 1 tier';
    }
    for (const t of tiers) {
      if (typeof t.from !== 'number' || t.from < 0) return 'Tier.from invalid';
      if (typeof t.percentage !== 'number' || t.percentage < 0 || t.percentage > 100)
        return 'Tier.percentage harus 0-100';
    }
  }
  if (body.applies_to_scope === 'roles') {
    if (!Array.isArray(body.applies_to_role_keys) || body.applies_to_role_keys.length === 0) {
      return 'applies_to_role_keys wajib saat scope=roles';
    }
  }
  if (body.applies_to_scope === 'employees') {
    if (!Array.isArray(body.applies_to_employee_ids) || body.applies_to_employee_ids.length === 0) {
      return 'applies_to_employee_ids wajib saat scope=employees';
    }
  }
  if (body.applies_to_products_scope === 'categories') {
    if (!Array.isArray(body.applies_to_category_ids) || body.applies_to_category_ids.length === 0) {
      return 'applies_to_category_ids wajib saat scope=categories';
    }
  }
  if (body.applies_to_products_scope === 'products') {
    if (!Array.isArray(body.applies_to_product_ids) || body.applies_to_product_ids.length === 0) {
      return 'applies_to_product_ids wajib saat scope=products';
    }
  }
  return null;
}

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const where = [];
    const params = [];
    if (req.query.is_active === '0' || req.query.is_active === '1') {
      where.push('is_active = ?');
      params.push(Number(req.query.is_active));
    }
    if (req.query.type === 'FIXED' || req.query.type === 'TIERED') {
      where.push('type = ?');
      params.push(req.query.type);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM commission_groups ${whereClause} ORDER BY name ASC`)
      .all(...params);
    res.json(rows.map(rowToGroup));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM commission_groups WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Grup komisi tidak ditemukan' });
    res.json(rowToGroup(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: CommissionGroupCreateSchema }),
  (req, res) => {
    try {
      const err = validateTypeSpecific(req.body);
      if (err) return res.status(400).json({ error: err });
      const body = normalizeBody({
        applies_to_scope: 'all',
        applies_to_products_scope: 'all',
        amount_basis: 'PER_TRANSACTION',
        calc_period: 'MONTH',
        is_active: true,
        ...req.body,
      });
      const placeholders = COLUMNS.map(() => '?').join(', ');
      const cols = COLUMNS.join(', ');
      const values = COLUMNS.map((c) => (body[c] === undefined ? null : body[c]));
      const db = getDb();
      const result = db
        .prepare(`INSERT INTO commission_groups (${cols}) VALUES (${placeholders})`)
        .run(...values);
      const row = db
        .prepare('SELECT * FROM commission_groups WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(rowToGroup(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: CommissionGroupUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const existing = db
        .prepare('SELECT * FROM commission_groups WHERE id = ?')
        .get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Grup komisi tidak ditemukan' });

      const existingParsed = rowToGroup(existing);
      const merged = { ...existingParsed, ...req.body };
      const err = validateTypeSpecific(merged);
      if (err) return res.status(400).json({ error: err });
      const body = normalizeBody(merged);

      const setClause = COLUMNS.map((c) => `${c} = ?`).join(', ');
      const values = COLUMNS.map((c) => (body[c] === undefined ? null : body[c]));
      values.push(req.params.id);
      db.prepare(
        `UPDATE commission_groups SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(...values);
      const row = db.prepare('SELECT * FROM commission_groups WHERE id = ?').get(req.params.id);
      res.json(rowToGroup(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM commission_groups WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Grup komisi tidak ditemukan' });
    res.json({ id: Number(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.rowToGroup = rowToGroup;
