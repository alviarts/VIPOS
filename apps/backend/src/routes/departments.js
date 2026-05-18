// /api/departments — CRUD departemen (P2-01b cutover).
const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
  DepartmentReorderSchema,
} = require('@vipos/shared');

const router = express.Router();

// List semua departemen, dengan jumlah kategori. Urut by `urutan` lalu name.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT
           d.*,
           (SELECT COUNT(*) FROM categories c WHERE c.department_id = d.id) AS category_count
         FROM departments d
         ORDER BY d.urutan ASC, d.name ASC`
      )
    ).rows;
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
  async (req, res) => {
    try {
      const { ids } = req.body;
      const updated = await tx(async (txQuery) => {
        let count = 0;
        for (let idx = 0; idx < ids.length; idx++) {
          const r = await txQuery('UPDATE departments SET urutan = $1 WHERE id = $2', [
            idx,
            ids[idx],
          ]);
          count += r.rowCount;
        }
        return count;
      });
      res.json({ message: 'Urutan departemen tersimpan', updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const row = (await query('SELECT * FROM departments WHERE id = $1', [req.params.id])).rows[0];
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
  async (req, res) => {
    try {
      const { name, description, urutan, is_active } = req.body;
      const ins = await query(
        `INSERT INTO departments (name, description, urutan, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [name.trim(), description ? description.trim() : null, urutan ?? 0, is_active ?? 1]
      );
      const row = (await query('SELECT * FROM departments WHERE id = $1', [ins.rows[0].id]))
        .rows[0];
      res.status(201).json(row);
    } catch (err) {
      if (err.code === '23505') {
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
  async (req, res) => {
    try {
      const existing = (await query('SELECT * FROM departments WHERE id = $1', [req.params.id]))
        .rows[0];
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

      await query(
        `UPDATE departments
            SET name = $1, description = $2, urutan = $3, is_active = $4
          WHERE id = $5`,
        [
          merged.name.trim(),
          merged.description ? merged.description.trim() : null,
          merged.urutan,
          merged.is_active,
          req.params.id,
        ]
      );
      const row = (await query('SELECT * FROM departments WHERE id = $1', [req.params.id])).rows[0];
      res.json(row);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Departemen sudah ada' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const used = (
      await query('SELECT COUNT(*) as count FROM categories WHERE department_id = $1', [
        req.params.id,
      ])
    ).rows[0];
    if (used.count > 0) {
      return res.status(400).json({
        error: 'Departemen masih dipakai oleh kategori. Pindahkan kategori dulu.',
      });
    }
    await query('DELETE FROM departments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Departemen berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
