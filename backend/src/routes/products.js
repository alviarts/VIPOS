const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all products
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { category_id, search, active_only } = req.query;

    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    const conditions = [];
    const params = [];

    if (active_only !== 'false') {
      conditions.push('p.is_active = 1');
    }

    if (category_id) {
      conditions.push('p.category_id = ?');
      params.push(category_id);
    }

    if (search) {
      conditions.push('(p.name LIKE ? OR p.sku LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.name';

    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, sku, price, stock, category_id, image_url } = req.body;

    if (!name || !sku || price === undefined) {
      return res.status(400).json({ error: 'Nama, SKU, dan harga wajib diisi' });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO products (name, sku, price, stock, category_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, sku, price, stock || 0, category_id || null, image_url || null);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'SKU sudah digunakan' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, sku, price, stock, category_id, image_url, is_active } = req.body;
    const db = getDb();

    db.prepare(`
      UPDATE products
      SET name = ?, sku = ?, price = ?, stock = ?, category_id = ?, image_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, sku, price, stock, category_id || null, image_url || null, is_active !== undefined ? is_active : 1, req.params.id);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const hasTransactions = db.prepare(
      'SELECT COUNT(*) as count FROM transaction_items WHERE product_id = ?'
    ).get(req.params.id);

    if (hasTransactions.count > 0) {
      db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
      return res.json({ message: 'Produk dinonaktifkan karena sudah memiliki riwayat transaksi' });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Produk berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
