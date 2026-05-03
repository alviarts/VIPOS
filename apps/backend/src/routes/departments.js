const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
  DepartmentReorderSchema,
} = require('@vipos/shared');

const router = express.Router();

// List semua departemen, dengan jumlah kategori. Urut by `urutan` lalu name.
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `
      SELECT
        d.*,
        (SELECT COUNT(*) FROM categories c WHERE c.department_id = d.id) AS category_count
      FROM departments d
      ORDER BY d.urutan ASC, d.name ASC
    `
      )
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reorder departemen dalam batch. Body: `{ ids: number[] }`. Server set
// `urutan = index`. ID yang tidak ada di array tidak diubah.
router.post(
  '/reorder',
  authenticateToken,
  requireAdmin,
  validate({ body: DepartmentReorderSchema }),
  (req, res) => {
    try {
      const { ids } = req.body;
      const db = getDb();

      const update = db.prepare('UPDATE departments SET urutan = ? WHERE id = ?');
      const tx = db.transaction((items) => {
        let updated = 0;
        items.forEach((id, idx) => {
          const result = update.run(idx, id);
          updated += result.changes;
        });
        return updated;
      });
      const updated = tx(ids);

      res.json({ message: 'Urutan departemen tersimpan', updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Departemen tidak ditemukan' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: DepartmentCreateSchema }),
  (req, res) => {
    try {
      const { name, description, urutan, is_active } = req.body;
      const db = getDb();
      const result = db
        .prepare(
          `INSERT INTO departments (name, description, urutan, is_active)
           VALUES (?, ?, ?, ?)`
        )
        .run(name.trim(), description ? description.trim() : null, urutan ?? 0, is_active ?? 1);
      const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Departemen sudah ada' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: DepartmentUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Departemen tidak ditemukan' });
      }

      const merged = {
        name: req.body.name ?? existing.name,
        description:
          req.body.description !== undefined ? req.body.description : existing.description,
        urutan: req.body.urutan ?? existing.urutan ?? 0,
        is_active: req.body.is_active !== undefined ? req.body.is_active : existing.is_active,
      };

      db.prepare(
        `UPDATE departments
            SET name = ?, description = ?, urutan = ?, is_active = ?
          WHERE id = ?`
      ).run(
        merged.name.trim(),
        merged.description ? merged.description.trim() : null,
        merged.urutan,
        merged.is_active,
        req.params.id
      );
      const row = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
      res.json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Departemen sudah ada' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const used = db
      .prepare('SELECT COUNT(*) as count FROM categories WHERE department_id = ?')
      .get(req.params.id);
    if (used.count > 0) {
      return res.status(400).json({
        error: 'Departemen masih dipakai oleh kategori. Pindahkan kategori dulu.',
      });
    }
    db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
    res.json({ message: 'Departemen berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
