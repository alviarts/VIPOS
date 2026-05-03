// Loyalty rules + ledger endpoints.
//
// Endpoints:
//   GET    /api/loyalty-rule              List rules.
//   POST   /api/loyalty-rule              Create rule (earn / redemption).
//   PUT    /api/loyalty-rule/:id          Update.
//   DELETE /api/loyalty-rule/:id          Delete.
//   GET    /api/loyalty/transactions      List ledger entries.
//   POST   /api/loyalty/adjust            Manual point adjust (admin).
//
// Earn dan redeem otomatis (saat checkout) belum ter-wire ke transaksi POS;
// task itu di P3-16 (POS cart loyalty). Server menyediakan adjust API untuk
// koreksi manual + pencatatan audit.
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  LoyaltyRuleCreateSchema,
  LoyaltyRuleUpdateSchema,
  LoyaltyAdjustSchema,
} = require('@vipos/shared');

const ruleRouter = express.Router();
const ledgerRouter = express.Router();

const JSON_FIELDS = [
  'target_product_ids',
  'multiplier_per_group',
  'excluded_payment_methods',
  'excluded_categories',
];

function parseJsonField(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToRule(row) {
  if (!row) return null;
  return {
    ...row,
    target_product_ids: parseJsonField(row.target_product_ids, []),
    multiplier_per_group: parseJsonField(row.multiplier_per_group, {}),
    excluded_payment_methods: parseJsonField(row.excluded_payment_methods, []),
    excluded_categories: parseJsonField(row.excluded_categories, []),
  };
}

function normalizeRule(body) {
  const out = { ...body };
  for (const k of JSON_FIELDS) {
    if (k in out && out[k] !== null && out[k] !== undefined) {
      out[k] = JSON.stringify(out[k]);
    }
  }
  if ('is_active' in out) out.is_active = out.is_active ? 1 : 0;
  return out;
}

const RULE_COLUMNS = [
  'name',
  'rule_type',
  'earn_rate',
  'bonus_points',
  'target_product_ids',
  'multiplier_per_group',
  'excluded_payment_methods',
  'excluded_categories',
  'redemption_rate',
  'min_redeem_per_transaction',
  'max_redeem_per_transaction',
  'max_redeem_per_day_per_customer',
  'redemption_block',
  'points_expire_after_months',
  'valid_from',
  'valid_until',
  'is_active',
];

function validateRuleSpecific(body) {
  const errors = [];
  if (body.rule_type === 'earn_per_total' && !(body.earn_rate >= 0)) {
    errors.push('earn_rate harus >= 0 untuk earn_per_total');
  }
  if (body.rule_type === 'earn_per_product') {
    if ((!body.bonus_points || body.bonus_points < 0) && (!body.earn_rate || body.earn_rate < 0)) {
      errors.push(
        'earn_per_product butuh bonus_points (flat) atau earn_rate (multiplier per produk)'
      );
    }
    if (!Array.isArray(body.target_product_ids) || body.target_product_ids.length === 0) {
      errors.push('target_product_ids harus berisi minimal 1 produk');
    }
  }
  if (body.rule_type === 'redemption') {
    if (!(body.redemption_rate > 0)) {
      errors.push('redemption_rate (Rp per poin) harus > 0');
    }
  }
  return errors;
}

ruleRouter.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (req.query.rule_type) {
      conditions.push('rule_type = ?');
      params.push(req.query.rule_type);
    }
    if (req.query.is_active === '0' || req.query.is_active === '1') {
      conditions.push('is_active = ?');
      params.push(parseInt(req.query.is_active, 10));
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM loyalty_rules ${where} ORDER BY created_at DESC, id DESC`)
      .all(...params);
    res.json(rows.map(rowToRule));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

ruleRouter.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM loyalty_rules WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Rule tidak ditemukan' });
    res.json(rowToRule(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

ruleRouter.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: LoyaltyRuleCreateSchema }),
  (req, res) => {
    try {
      const errors = validateRuleSpecific(req.body);
      if (errors.length) return res.status(400).json({ error: errors[0], details: errors });
      const db = getDb();
      const body = normalizeRule({
        target_product_ids: [],
        multiplier_per_group: {},
        excluded_payment_methods: [],
        excluded_categories: [],
        ...req.body,
      });
      const placeholders = RULE_COLUMNS.map(() => '?').join(', ');
      const values = RULE_COLUMNS.map((c) => body[c] ?? null);
      const result = db
        .prepare(`INSERT INTO loyalty_rules (${RULE_COLUMNS.join(', ')}) VALUES (${placeholders})`)
        .run(...values);
      const created = db
        .prepare('SELECT * FROM loyalty_rules WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(rowToRule(created));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

ruleRouter.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: LoyaltyRuleUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM loyalty_rules WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Rule tidak ditemukan' });
      const merged = { ...rowToRule(existing), ...req.body };
      const errors = validateRuleSpecific(merged);
      if (errors.length) return res.status(400).json({ error: errors[0], details: errors });
      const body = normalizeRule(merged);
      const setClauses = RULE_COLUMNS.map((c) => `${c} = ?`).join(', ');
      const values = RULE_COLUMNS.map((c) => body[c] ?? null);
      db.prepare(
        `UPDATE loyalty_rules SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(...values, req.params.id);
      const updated = db.prepare('SELECT * FROM loyalty_rules WHERE id = ?').get(req.params.id);
      res.json(rowToRule(updated));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

ruleRouter.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM loyalty_rules WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Rule tidak ditemukan' });
    db.prepare('DELETE FROM loyalty_rules WHERE id = ?').run(req.params.id);
    res.json({ message: 'Rule dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Ledger / adjust endpoints -------------------------------------------

ledgerRouter.get('/transactions', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (req.query.customer_id) {
      conditions.push('lt.customer_id = ?');
      params.push(parseInt(req.query.customer_id, 10));
    }
    if (req.query.type) {
      conditions.push('lt.type = ?');
      params.push(req.query.type);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(parseInt(req.query.limit ?? '100', 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);
    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM loyalty_transactions lt ${where}`)
      .get(...params).n;
    const items = db
      .prepare(
        `SELECT lt.*, c.name AS customer_name
           FROM loyalty_transactions lt
           LEFT JOIN customers c ON c.id = lt.customer_id
           ${where}
          ORDER BY lt.created_at DESC, lt.id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
    res.json({ items, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

ledgerRouter.post(
  '/adjust',
  authenticateToken,
  requireAdmin,
  validate({ body: LoyaltyAdjustSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const cust = db
        .prepare('SELECT id, points FROM customers WHERE id = ?')
        .get(req.body.customer_id);
      if (!cust) return res.status(404).json({ error: 'Customer tidak ditemukan' });
      const next = (cust.points || 0) + req.body.points;
      if (next < 0) {
        return res.status(400).json({ error: 'Saldo poin tidak boleh negatif' });
      }
      const tx = db.transaction(() => {
        db.prepare('UPDATE customers SET points = ? WHERE id = ?').run(next, cust.id);
        const result = db
          .prepare(
            `INSERT INTO loyalty_transactions
               (customer_id, type, points, balance_after, notes)
             VALUES (?, 'adjust', ?, ?, ?)`
          )
          .run(cust.id, req.body.points, next, req.body.notes || null);
        return result.lastInsertRowid;
      });
      const insertId = tx();
      const transaction = db
        .prepare(
          `SELECT lt.*, c.name AS customer_name
             FROM loyalty_transactions lt
             LEFT JOIN customers c ON c.id = lt.customer_id
            WHERE lt.id = ?`
        )
        .get(insertId);
      res.json({
        customer_id: cust.id,
        balance: next,
        transaction,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = { ruleRouter, ledgerRouter };
