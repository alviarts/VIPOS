// Approval chain config (P1-14, P2-01b cutover): purchase, finance, leave, etc.
const express = require('express');
const { query } = require('../db');
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

router.get('/', authenticateToken, async (req, res) => {
  try {
    const conds = [];
    const params = [];
    let p = 1;
    if (req.query.domain) {
      conds.push(`domain = $${p++}`);
      params.push(req.query.domain);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT * FROM approval_chains ${where} ORDER BY domain ASC, threshold_amount ASC`,
        params
      )
    ).rows;
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
  async (req, res) => {
    try {
      const data = req.body;
      const ins = await query(
        `INSERT INTO approval_chains (domain, name, threshold_amount, steps, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          data.domain,
          data.name,
          data.threshold_amount || 0,
          JSON.stringify(data.steps || []),
          data.is_active ?? 1,
        ]
      );
      const row = (await query('SELECT * FROM approval_chains WHERE id = $1', [ins.rows[0].id]))
        .rows[0];
      res.status(201).json(rowToChain(row));
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const exists = (await query('SELECT id FROM approval_chains WHERE id = $1', [id])).rows[0];
      if (!exists) return res.status(404).json({ error: 'Not found' });
      const allowed = ['domain', 'name', 'threshold_amount', 'is_active'];
      const fields = [];
      const values = [];
      let p = 1;
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = $${p++}`);
          values.push(req.body[key]);
        }
      }
      if ('steps' in req.body) {
        fields.push(`steps = $${p++}`);
        values.push(JSON.stringify(req.body.steps || []));
      }
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await query(`UPDATE approval_chains SET ${fields.join(', ')} WHERE id = $${p}`, values);
      }
      const row = (await query('SELECT * FROM approval_chains WHERE id = $1', [id])).rows[0];
      res.json(rowToChain(row));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM approval_chains WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

module.exports = router;
