const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all categories
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create category
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Nama kategori wajib diisi' });
    }

    const db = getDb();
    const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || null);
    res.status(201).json({ id: result.lastInsertRowid, name, description });
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
    const { name, description } = req.body;
    const db = getDb();
    db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(name, description, req.params.id);
    res.json({ message: 'Kategori berhasil diupdate' });
  } catch (err) {
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
