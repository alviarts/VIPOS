// VIPOS — Data export endpoints for CSV/Excel download.
//
// Surface:
//   GET /api/v1/export/transactions
//     query: { start_date, end_date, format?: "csv"|"json" }
//     200:  CSV or JSON array of transactions
//
//   GET /api/v1/export/products
//     200:  CSV or JSON array of products
//
//   GET /api/v1/export/customers
//     200:  CSV or JSON array of customers

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function toCsv(rows, columns) {
  if (rows.length === 0) return '';
  const header = columns.join(',');
  const lines = rows.map((row) =>
    columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str}"`
        : str;
    }).join(','),
  );
  return [header, ...lines].join('\n');
}

// GET /transactions
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;

    let sql = `SELECT id, invoice_number, total_amount, payment_amount,
                      change_amount, payment_method, status, created_at
               FROM transactions
               WHERE tenant_id = $1`;
    const params = [req.tenantId];

    if (start_date) {
      params.push(start_date);
      sql += ` AND DATE(created_at) >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      sql += ` AND DATE(created_at) <= $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC LIMIT 10000';

    const { rows } = await query(sql, params);

    if (format === 'csv') {
      const csv = toCsv(rows, [
        'id', 'invoice_number', 'total_amount', 'payment_amount',
        'change_amount', 'payment_method', 'status', 'created_at',
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      return res.send(csv);
    }

    return res.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error('Export transactions error:', err);
    return res.status(500).json({ error: 'Gagal mengekspor transaksi' });
  }
});

// GET /products
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const { rows } = await query(
      `SELECT id, name, sku, stock, price, category_id, is_active
       FROM products
       WHERE tenant_id = $1
       ORDER BY name`,
      [req.tenantId],
    );

    if (format === 'csv') {
      const csv = toCsv(rows, ['id', 'name', 'sku', 'stock', 'price', 'category_id', 'is_active']);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
      return res.send(csv);
    }

    return res.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error('Export products error:', err);
    return res.status(500).json({ error: 'Gagal mengekspor produk' });
  }
});

// GET /customers
router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const { rows } = await query(
      `SELECT id, kode, name, phone, email, points, deposit, is_active
       FROM customers
       WHERE tenant_id = $1
       ORDER BY name`,
      [req.tenantId],
    );

    if (format === 'csv') {
      const csv = toCsv(rows, ['id', 'kode', 'name', 'phone', 'email', 'points', 'deposit', 'is_active']);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
      return res.send(csv);
    }

    return res.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error('Export customers error:', err);
    return res.status(500).json({ error: 'Gagal mengekspor pelanggan' });
  }
});

module.exports = router;
