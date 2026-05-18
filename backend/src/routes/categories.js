const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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

    const rows = db.prepare(`
      SELECT
        c.*,
        d.name AS department_name,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
      FROM categories c
      LEFT JOIN departments d ON d.id = c.department_id
      ${where}
      ORDER BY c.urutan ASC, c.name ASC
    `).all(...params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single category
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT c.*, d.name AS department_name
      FROM categories c
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE c.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create category
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const {
      name,
      description,
      urutan,
      department_id,
      is_tampil_di_menu,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi' });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO categories (name, description, urutan, department_id, is_tampil_di_menu)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      description ? description.trim() : null,
      Number.isFinite(parseInt(urutan, 10)) ? parseInt(urutan, 10) : 0,
      department_id ? parseInt(department_id, 10) : null,
      is_tampil_di_menu === false || is_tampil_di_menu === 0 ? 0 : 1
    );

    const row = db.prepare(`
      SELECT c.*, d.name AS department_name
      FROM categories c
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Kategori sudah ada' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update category
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const {
      name,
      description,
      urutan,
      department_id,
      is_tampil_di_menu,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi' });
    }

    const db = getDb();
    db.prepare(`
      UPDATE categories
         SET name = ?,
             description = ?,
             urutan = ?,
             department_id = ?,
             is_tampil_di_menu = ?
       WHERE id = ?
    `).run(
      name.trim(),
      description ? description.trim() : null,
      Number.isFinite(parseInt(urutan, 10)) ? parseInt(urutan, 10) : 0,
      department_id ? parseInt(department_id, 10) : null,
      is_tampil_di_menu === false || is_tampil_di_menu === 0 ? 0 : 1,
      req.params.id
    );

    const row = db.prepare(`
      SELECT c.*, d.name AS department_name
      FROM categories c
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE c.id = ?
    `).get(req.params.id);
    res.json(row);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Kategori sudah ada' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete category
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const products = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(req.params.id);
    if (products.count > 0) {
      return res.status(400).json({ error: 'Kategori masih memiliki produk. Hapus atau pindahkan produk terlebih dahulu.' });
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
