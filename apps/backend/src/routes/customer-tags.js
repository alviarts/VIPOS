// /api/customer-tags — CRUD untuk tag pelanggan (P2-01b cutover).
const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CustomerTagCreateSchema, CustomerTagUpdateSchema } = require('@vipos/shared');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT t.*, COUNT(m.customer_id) AS customer_count
           FROM customer_tags t
           LEFT JOIN customer_tag_map m ON m.tag_id = t.id
          GROUP BY t.id
          ORDER BY t.name ASC`
      )
    ).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: CustomerTagCreateSchema }),
  async (req, res) => {
    try {
      const { name, color } = req.body;
      const ins = await query(
        'INSERT INTO customer_tags (name, color) VALUES ($1, $2) RETURNING id',
        [name.trim(), color || null]
      );
      const row = (await query('SELECT * FROM customer_tags WHERE id = $1', [ins.rows[0].id]))
        .rows[0];
      res.status(201).json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Nama tag sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: CustomerTagUpdateSchema }),
  async (req, res) => {
    try {
      const existing = (await query('SELECT * FROM customer_tags WHERE id = $1', [req.params.id]))
        .rows[0];
      if (!existing) return res.status(404).json({ error: 'Tag tidak ditemukan' });
      const merged = { ...existing, ...req.body };
      await query('UPDATE customer_tags SET name = $1, color = $2 WHERE id = $3', [
        merged.name,
        merged.color,
        req.params.id,
      ]);
      const row = (await query('SELECT * FROM customer_tags WHERE id = $1', [req.params.id]))
        .rows[0];
      res.json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Nama tag sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM customer_tags WHERE id = $1', [req.params.id]);
    res.json({ message: 'Tag berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
