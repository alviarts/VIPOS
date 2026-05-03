const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CustomerGroupCreateSchema, CustomerGroupUpdateSchema } = require('@vipos/shared');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT g.*, COUNT(c.id) AS customer_count
           FROM customer_groups g
           LEFT JOIN customers c ON c.customer_group_id = g.id AND c.is_active = 1
          GROUP BY g.id
          ORDER BY g.name ASC`
      )
      .all();
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
  (req, res) => {
    try {
      const { name, description, discount_percent, points_multiplier, color } = req.body;
      const db = getDb();
      const result = db
        .prepare(
          `INSERT INTO customer_groups (name, description, discount_percent, points_multiplier, color)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          name.trim(),
          description ? description.trim() : null,
          discount_percent ?? 0,
          points_multiplier ?? 1,
          color || null
        );
      const row = db
        .prepare('SELECT * FROM customer_groups WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
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
  (req, res) => {
    try {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Grup tidak ditemukan' });
      const merged = {
        ...existing,
        ...req.body,
      };
      db.prepare(
        `UPDATE customer_groups
            SET name = ?, description = ?, discount_percent = ?, points_multiplier = ?, color = ?
          WHERE id = ?`
      ).run(
        merged.name,
        merged.description,
        merged.discount_percent ?? 0,
        merged.points_multiplier ?? 1,
        merged.color,
        req.params.id
      );
      const row = db.prepare('SELECT * FROM customer_groups WHERE id = ?').get(req.params.id);
      res.json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Nama grup sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const used = db
      .prepare('SELECT COUNT(*) AS count FROM customers WHERE customer_group_id = ?')
      .get(req.params.id);
    if (used.count > 0) {
      return res.status(400).json({
        error: `Grup masih digunakan oleh ${used.count} pelanggan`,
      });
    }
    db.prepare('DELETE FROM customer_groups WHERE id = ?').run(req.params.id);
    res.json({ message: 'Grup berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
