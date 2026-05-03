const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CustomerTagCreateSchema, CustomerTagUpdateSchema } = require('@vipos/shared');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT t.*, COUNT(m.customer_id) AS customer_count
           FROM customer_tags t
           LEFT JOIN customer_tag_map m ON m.tag_id = t.id
          GROUP BY t.id
          ORDER BY t.name ASC`
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
  validate({ body: CustomerTagCreateSchema }),
  (req, res) => {
    try {
      const { name, color } = req.body;
      const db = getDb();
      const result = db
        .prepare('INSERT INTO customer_tags (name, color) VALUES (?, ?)')
        .run(name.trim(), color || null);
      const row = db
        .prepare('SELECT * FROM customer_tags WHERE id = ?')
        .get(result.lastInsertRowid);
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
  (req, res) => {
    try {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM customer_tags WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Tag tidak ditemukan' });
      const merged = { ...existing, ...req.body };
      db.prepare('UPDATE customer_tags SET name = ?, color = ? WHERE id = ?').run(
        merged.name,
        merged.color,
        req.params.id
      );
      const row = db.prepare('SELECT * FROM customer_tags WHERE id = ?').get(req.params.id);
      res.json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Nama tag sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM customer_tags WHERE id = ?').run(req.params.id);
    res.json({ message: 'Tag berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
