const express = require('express');
const { getDb } = require('../models/database');
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
  (req, res) => {
    try {
      const { ids, department_id } = req.body;
      const db = getDb();

      const moveDept = department_id !== undefined;
      const updateOrder = db.prepare('UPDATE categories SET urutan = ? WHERE id = ?');
      const updateOrderAndDept = db.prepare(
        'UPDATE categories SET urutan = ?, department_id = ? WHERE id = ?'
      );
      const tx = db.transaction((items) => {
        let updated = 0;
        items.forEach((id, idx) => {
          const result = moveDept
            ? updateOrderAndDept.run(idx, department_id ?? null, id)
            : updateOrder.run(idx, id);
          updated += result.changes;
        });
        return updated;
      });
      const updated = tx(ids);

      res.json({ message: 'Urutan kategori tersimpan', updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get all categories (with department + product count)
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { is_tampil_di_menu, search } = req.query;

    const conditions = [];
    const params = [];

    if (is_tampil_di_menu === '0' || is_tampil_di_menu === '1') {
      conditions.push('c.is_tampil_di_menu = ?');
      params.push(parseInt(is_tampil_di_menu, 10));
    }

    if (search) {
      conditions.push('c.name LIKE ?');
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `
      SELECT
        c.*,
        d.name AS department_name,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
      FROM categories c
      LEFT JOIN departments d ON d.id = c.department_id
      ${where}
      ORDER BY c.urutan ASC, c.name ASC
    `
      )
      .all(...params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single category
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db
      .prepare(
        `
      SELECT c.*, d.name AS department_name
      FROM categories c
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE c.id = ?
    `
      )
      .get(req.params.id);
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
  (req, res) => {
    try {
      const { name, description, urutan, department_id, color, icon_url, is_tampil_di_menu } =
        req.body;

      const db = getDb();
      const result = db
        .prepare(
          `
      INSERT INTO categories (name, description, urutan, department_id, color, icon_url, is_tampil_di_menu)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
        )
        .run(
          name.trim(),
          description ? description.trim() : null,
          urutan ?? 0,
          department_id ?? null,
          color ?? null,
          icon_url ?? null,
          is_tampil_di_menu ?? 1
        );

      const row = db
        .prepare(
          `
      SELECT c.*, d.name AS department_name
      FROM categories c
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE c.id = ?
    `
        )
        .get(result.lastInsertRowid);
      res.status(201).json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
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
  (req, res) => {
    try {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
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

      db.prepare(
        `
      UPDATE categories
         SET name = ?,
             description = ?,
             urutan = ?,
             department_id = ?,
             color = ?,
             icon_url = ?,
             is_tampil_di_menu = ?
       WHERE id = ?
    `
      ).run(
        merged.name.trim(),
        merged.description ? merged.description.trim() : null,
        merged.urutan,
        merged.department_id ?? null,
        merged.color ?? null,
        merged.icon_url ?? null,
        merged.is_tampil_di_menu,
        req.params.id
      );

      const row = db
        .prepare(
          `
      SELECT c.*, d.name AS department_name
      FROM categories c
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE c.id = ?
    `
        )
        .get(req.params.id);
      res.json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Kategori sudah ada' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete category
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const products = db
      .prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?')
      .get(req.params.id);
    if (products.count > 0) {
      return res.status(400).json({
        error: 'Kategori masih memiliki produk. Hapus atau pindahkan produk terlebih dahulu.',
      });
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
