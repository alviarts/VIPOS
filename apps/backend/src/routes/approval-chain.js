// Approval chain config (P1-14): purchase, finance, leave, etc.
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ApprovalChainCreateSchema, ApprovalChainUpdateSchema } = require('@vipos/shared');

const router = express.Router();

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToChain(row) {
  if (!row) return null;
  return { ...row, steps: parseJson(row.steps, []) };
}

router.get('/', authenticateToken, (req, res) => {
  try {
    const conds = [];
    const params = [];
    if (req.query.domain) {
      conds.push('domain = ?');
      params.push(req.query.domain);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = getDb()
      .prepare(`SELECT * FROM approval_chains ${where} ORDER BY domain ASC, threshold_amount ASC`)
      .all(...params);
    res.json(rows.map(rowToChain));
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: ApprovalChainCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const data = req.body;
      const result = db
        .prepare(
          `INSERT INTO approval_chains (domain, name, threshold_amount, steps, is_active) VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          data.domain,
          data.name,
          data.threshold_amount || 0,
          JSON.stringify(data.steps || []),
          data.is_active ?? 1
        );
      res
        .status(201)
        .json(
          rowToChain(
            db.prepare(`SELECT * FROM approval_chains WHERE id = ?`).get(result.lastInsertRowid)
          )
        );
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: ApprovalChainUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const exists = db.prepare(`SELECT id FROM approval_chains WHERE id = ?`).get(id);
      if (!exists) return res.status(404).json({ error: 'Not found' });
      const allowed = ['domain', 'name', 'threshold_amount', 'is_active'];
      const fields = [];
      const values = [];
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = ?`);
          values.push(req.body[key]);
        }
      }
      if ('steps' in req.body) {
        fields.push('steps = ?');
        values.push(JSON.stringify(req.body.steps || []));
      }
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        db.prepare(`UPDATE approval_chains SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      res.json(rowToChain(db.prepare(`SELECT * FROM approval_chains WHERE id = ?`).get(id)));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    db.prepare(`DELETE FROM approval_chains WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

module.exports = router;
