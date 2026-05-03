const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { InventoryMovementCreateSchema } = require('@vipos/shared');

const router = express.Router();

// GET /api/inventory/movements?product_id=&tipe=&from=&to=
router.get('/movements', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { product_id, tipe, from, to, limit = 100 } = req.query;
    const conditions = [];
    const params = [];
    if (product_id) {
      conditions.push('m.product_id = ?');
      params.push(product_id);
    }
    if (tipe) {
      conditions.push('m.tipe = ?');
      params.push(tipe);
    }
    if (from) {
      conditions.push('m.tanggal >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('m.tanggal <= ?');
      params.push(to);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `
      SELECT
        m.*,
        p.name AS product_name,
        p.sku AS product_sku,
        p.satuan AS product_satuan,
        u.name AS user_name
      FROM inventory_movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN users u ON u.id = m.user_id
      ${where}
      ORDER BY m.tanggal DESC, m.id DESC
      LIMIT ?
    `
      )
      .all(...params, parseInt(limit, 10) || 100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/movements - record movement and update stock
router.post(
  '/movements',
  authenticateToken,
  requireAdmin,
  validate({ body: InventoryMovementCreateSchema }),
  (req, res) => {
    try {
      const { product_id, tipe, qty, tanggal, keterangan, unit_cost, reason } = req.body;
      const qtyNum = qty;
      // stok_in/stok_out perlu qty > 0; opname boleh 0 (zero out stock).
      if ((tipe === 'stok_in' || tipe === 'stok_out') && qtyNum <= 0) {
        return res.status(400).json({ error: 'Qty harus lebih dari 0 untuk stok_in/stok_out' });
      }

      const db = getDb();
      const product = db
        .prepare('SELECT id, stock, harga_modal FROM products WHERE id = ?')
        .get(product_id);
      if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });

      const stokSebelum = product.stock || 0;
      let stokSesudah;
      if (tipe === 'stok_in') {
        stokSesudah = stokSebelum + qtyNum;
      } else if (tipe === 'stok_out') {
        stokSesudah = Math.max(0, stokSebelum - qtyNum);
      } else {
        // opname: qty is the new total stock
        stokSesudah = qtyNum;
      }

      // Cost averaging on stok_in (weighted average).
      let newAvgCost = null;
      if (tipe === 'stok_in' && unit_cost != null && unit_cost >= 0) {
        const oldQty = stokSebelum;
        const oldCost = product.harga_modal || 0;
        const totalQtyAfter = oldQty + qtyNum;
        if (totalQtyAfter > 0) {
          newAvgCost = (oldQty * oldCost + qtyNum * unit_cost) / totalQtyAfter;
        }
      }

      const trx = db.transaction(() => {
        const result = db
          .prepare(
            `
        INSERT INTO inventory_movements
          (tanggal, product_id, tipe, qty, stok_sebelum, stok_sesudah, keterangan, user_id, unit_cost, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
          )
          .run(
            tanggal || new Date().toISOString().slice(0, 10),
            product_id,
            tipe,
            qtyNum,
            stokSebelum,
            stokSesudah,
            keterangan ? keterangan.trim() : null,
            req.user.id,
            unit_cost == null ? null : unit_cost,
            reason || null
          );

        if (newAvgCost != null) {
          db.prepare(
            `UPDATE products SET stock = ?, harga_modal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
          ).run(stokSesudah, newAvgCost, product_id);
        } else {
          db.prepare(
            `UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
          ).run(stokSesudah, product_id);
        }

        return result.lastInsertRowid;
      });

      const id = trx();
      const row = db
        .prepare(
          `
      SELECT
        m.*,
        p.name AS product_name,
        p.sku AS product_sku,
        p.satuan AS product_satuan,
        u.name AS user_name
      FROM inventory_movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `
        )
        .get(id);
      res.status(201).json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/inventory/movements/:product_id - movement history per product
router.get('/movements/:product_id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const productId = parseInt(req.params.product_id, 10);
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    const product = db
      .prepare('SELECT id, name, sku, stock FROM products WHERE id = ?')
      .get(productId);
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });

    const rows = db
      .prepare(
        `
      SELECT
        m.*,
        p.name AS product_name,
        p.sku AS product_sku,
        p.satuan AS product_satuan,
        u.name AS user_name
      FROM inventory_movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.product_id = ?
      ORDER BY m.tanggal DESC, m.id DESC
      LIMIT ?
    `
      )
      .all(productId, limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/low-stock - products at/below stok_minimum (only when monitor_stok=1)
router.get('/low-stock', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `
      SELECT
        p.*,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1 AND p.monitor_stok = 1 AND p.stock <= p.stok_minimum
      ORDER BY p.stock ASC
    `
      )
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/summary - aggregate stats
router.get('/summary', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const totals = db
      .prepare(
        `
      SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(stock), 0) AS total_stock,
        COALESCE(SUM(stock * harga_modal), 0) AS total_value_modal,
        COALESCE(SUM(stock * price), 0) AS total_value_jual,
        SUM(CASE WHEN monitor_stok = 1 AND stock <= stok_minimum THEN 1 ELSE 0 END) AS low_stock_count
      FROM products
      WHERE is_active = 1
    `
      )
      .get();
    res.json(totals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
