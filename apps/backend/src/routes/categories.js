// /api/categories — CRUD kategori (P2-01b cutover).
const express = require('express');
const { query, tx, iLikePattern } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  CategoryCreateSchema,
  CategoryUpdateSchema,
  CategoryReorderSchema,
} = require('@vipos/shared');

const router = express.Router();

// Reorder kategori dalam batch (admin). Optional: pindahkan ke departemen lain
// dengan field `department_id`. Server set `urutan = index`.
router.post(
  '/reorder',
  authenticateToken,
  requireAdmin,
  validate({ body: CategoryReorderSchema }),
  async (req, res) => {
    try {
      const { ids, department_id } = req.body;
      const moveDept = department_id !== undefined;

      const updated = await tx(async (txQuery) => {
        let count = 0;
        for (let idx = 0; idx < ids.length; idx++) {
          const id = ids[idx];
          const r = moveDept
            ? await txQuery('UPDATE categories SET urutan = $1, department_id = $2 WHERE id = $3', [
                idx,
                department_id ?? null,
                id,
              ])
            : await txQuery('UPDATE categories SET urutan = $1 WHERE id = $2', [idx, id]);
          count += r.rowCount;
        }
        return count;
      });

      res.json({ message: 'Urutan kategori tersimpan', updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get all categories (with department + product count)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { is_tampil_di_menu, search } = req.query;

    const conditions = [];
    const params = [];
    let p = 1;

    if (is_tampil_di_menu === '0' || is_tampil_di_menu === '1') {
      conditions.push(`c.is_tampil_di_menu = $${p++}`);
      params.push(parseInt(is_tampil_di_menu, 10));
    }

    if (search) {
      conditions.push(`c.name LIKE $${p++}`);
      params.push(`%${iLikePattern(search)}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = (
      await query(
        `SELECT
           c.*,
           d.name AS department_name,
           (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
         FROM categories c
         LEFT JOIN departments d ON d.id = c.department_id
         ${where}
         ORDER BY c.urutan ASC, c.name ASC`,
        params
      )
    ).rows;

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single category
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const row = (
      await query(
        `SELECT c.*, d.name AS department_name
           FROM categories c
           LEFT JOIN departments d ON d.id = c.department_id
          WHERE c.id = $1`,
        [req.params.id]
      )
    ).rows[0];
    if (!row) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create category
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: CategoryCreateSchema }),
  async (req, res) => {
    try {
      const { name, description, urutan, department_id, color, icon_url, is_tampil_di_menu } =
        req.body;
      const ins = await query(
        `INSERT INTO categories (name, description, urutan, department_id, color, icon_url, is_tampil_di_menu)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          name.trim(),
          description ? description.trim() : null,
          urutan ?? 0,
          department_id ?? null,
          color ?? null,
          icon_url ?? null,
          is_tampil_di_menu ?? 1,
        ]
      );

      const row = (
        await query(
          `SELECT c.*, d.name AS department_name
             FROM categories c
             LEFT JOIN departments d ON d.id = c.department_id
            WHERE c.id = $1`,
          [ins.rows[0].id]
        )
      ).rows[0];
      res.status(201).json(row);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Kategori sudah ada' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Update category
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: CategoryUpdateSchema }),
  async (req, res) => {
    try {
      const existing = (await query('SELECT * FROM categories WHERE id = $1', [req.params.id]))
        .rows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Kategori tidak ditemukan' });
      }

      const merged = {
        name: req.body.name ?? existing.name,
        description:
          req.body.description !== undefined ? req.body.description : existing.description,
        urutan: req.body.urutan ?? existing.urutan ?? 0,
        department_id:
          req.body.department_id !== undefined ? req.body.department_id : existing.department_id,
        color: req.body.color !== undefined ? req.body.color : existing.color,
        icon_url: req.body.icon_url !== undefined ? req.body.icon_url : existing.icon_url,
        is_tampil_di_menu:
          req.body.is_tampil_di_menu !== undefined
            ? req.body.is_tampil_di_menu
            : existing.is_tampil_di_menu,
      };

      if (!merged.name) {
        return res.status(400).json({ error: 'Nama kategori wajib diisi' });
      }

      await query(
        `UPDATE categories
            SET name = $1,
                description = $2,
                urutan = $3,
                department_id = $4,
                color = $5,
                icon_url = $6,
                is_tampil_di_menu = $7
          WHERE id = $8`,
        [
          merged.name.trim(),
          merged.description ? merged.description.trim() : null,
          merged.urutan,
          merged.department_id ?? null,
          merged.color ?? null,
          merged.icon_url ?? null,
          merged.is_tampil_di_menu,
          req.params.id,
        ]
      );

      const row = (
        await query(
          `SELECT c.*, d.name AS department_name
             FROM categories c
             LEFT JOIN departments d ON d.id = c.department_id
            WHERE c.id = $1`,
          [req.params.id]
        )
      ).rows[0];
      res.json(row);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Kategori sudah ada' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete category
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const products = (
      await query('SELECT COUNT(*) as count FROM products WHERE category_id = $1', [req.params.id])
    ).rows[0];
    if (products.count > 0) {
      return res.status(400).json({
        error: 'Kategori masih memiliki produk. Hapus atau pindahkan produk terlebih dahulu.',
      });
    }
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
