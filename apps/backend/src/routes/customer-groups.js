// /api/customer-groups — CRUD untuk grup pelanggan (P2-01b cutover).
const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CustomerGroupCreateSchema, CustomerGroupUpdateSchema } = require('@vipos/shared');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT g.*, COUNT(c.id) AS customer_count
           FROM customer_groups g
           LEFT JOIN customers c ON c.customer_group_id = g.id AND c.is_active = 1
          GROUP BY g.id
          ORDER BY g.name ASC`
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
  validate({ body: CustomerGroupCreateSchema }),
  async (req, res) => {
    try {
      const { name, description, discount_percent, points_multiplier, color } = req.body;
      const ins = await query(
        `INSERT INTO customer_groups (name, description, discount_percent, points_multiplier, color)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          name.trim(),
          description ? description.trim() : null,
          discount_percent ?? 0,
          points_multiplier ?? 1,
          color || null,
        ]
      );
      const row = (await query('SELECT * FROM customer_groups WHERE id = $1', [ins.rows[0].id]))
        .rows[0];
      res.status(201).json(row);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Nama grup sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: CustomerGroupUpdateSchema }),
  async (req, res) => {
    try {
      const existing = (await query('SELECT * FROM customer_groups WHERE id = $1', [req.params.id]))
        .rows[0];
      if (!existing) return res.status(404).json({ error: 'Grup tidak ditemukan' });
      const merged = { ...existing, ...req.body };
      await query(
        `UPDATE customer_groups
            SET name = $1, description = $2, discount_percent = $3,
                points_multiplier = $4, color = $5
          WHERE id = $6`,
        [
          merged.name,
          merged.description,
          merged.discount_percent ?? 0,
          merged.points_multiplier ?? 1,
          merged.color,
          req.params.id,
        ]
      );
      const row = (await query('SELECT * FROM customer_groups WHERE id = $1', [req.params.id]))
        .rows[0];
      res.json(row);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Nama grup sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const used = (
      await query('SELECT COUNT(*) AS count FROM customers WHERE customer_group_id = $1', [
        req.params.id,
      ])
    ).rows[0];
    if (used.count > 0) {
      return res.status(400).json({
        error: `Grup masih digunakan oleh ${used.count} pelanggan`,
      });
    }
    await query('DELETE FROM customer_groups WHERE id = $1', [req.params.id]);
    res.json({ message: 'Grup berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
