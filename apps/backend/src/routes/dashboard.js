const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { canonicalPaymentMethodSql } = require('../lib/payment-methods');

const router = express.Router();

// Get dashboard stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todaySales = (
      await query(
        `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
         FROM transactions
         WHERE DATE(created_at) = $1 AND status = 'completed'`,
        [today]
      )
    ).rows[0];

    const totalProducts = (
      await query('SELECT COUNT(*) as count FROM products WHERE is_active = 1')
    ).rows[0];

    const lowStock = (
      await query('SELECT COUNT(*) as count FROM products WHERE stock <= 5 AND is_active = 1')
    ).rows[0];

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const monthlySales = (
      await query(
        `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
         FROM transactions
         WHERE DATE(created_at) >= $1 AND status = 'completed'`,
        [monthStartStr]
      )
    ).rows[0];

    res.json({
      today: { total: todaySales.total, transactions: todaySales.count },
      monthly: { total: monthlySales.total, transactions: monthlySales.count },
      products: totalProducts.count,
      low_stock: lowStock.count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sales chart data (last 7 days)
router.get('/chart', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const data = (
      await query(
        `SELECT DATE(created_at) as date,
                COALESCE(SUM(total_amount), 0) as total,
                COUNT(*) as transactions
         FROM transactions
         WHERE DATE(created_at) >= CURRENT_DATE - $1::int
           AND status = 'completed'
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [parseInt(days)]
      )
    ).rows;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top products
router.get('/top-products', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = (
      await query(
        `SELECT ti.product_name, SUM(ti.quantity) as total_sold, SUM(ti.subtotal) as total_revenue
         FROM transaction_items ti
         JOIN transactions t ON ti.transaction_id = t.id
         WHERE t.status = 'completed'
         GROUP BY ti.product_id, ti.product_name
         ORDER BY total_sold DESC
         LIMIT $1`,
        [parseInt(limit)]
      )
    ).rows;

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent transactions
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const transactions = (
      await query(
        `SELECT t.*, u.name as cashier_name
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         ORDER BY t.created_at DESC
         LIMIT 10`
      )
    ).rows;

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payment method breakdown
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Canonicalise the column so legacy lowercase rows (`cash`/`card`/`qris`,
    // pre-#236) and the matching canonical Android codes (`CASH`/`EDC`/
    // `QRIS_STATIC`) merge into a single bucket — otherwise the dashboard
    // pie chart shows two slices for "Tunai" until a backfill migration
    // runs. See `lib/payment-methods.js` for the canonical map.
    const canonical = canonicalPaymentMethodSql('payment_method');
    const methods = (
      await query(
        `SELECT ${canonical} AS payment_method,
                COUNT(*) AS count,
                COALESCE(SUM(total_amount), 0) AS total
         FROM transactions
         WHERE DATE(created_at) = $1 AND status = 'completed'
         GROUP BY ${canonical}`,
        [today]
      )
    ).rows;

    res.json(methods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// P1-03 — KPI summary with date range support.
// Query params:
//   start (YYYY-MM-DD)  → inclusive lower bound
//   end   (YYYY-MM-DD)  → inclusive upper bound (defaults to today)
// Without `start`, returns today + month-to-date pairs (legacy /stats shape
// stays available for backward compat).
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const end = req.query.end || today;
    const start =
      req.query.start ||
      (() => {
        const d = new Date(end);
        d.setDate(1);
        return d.toISOString().split('T')[0];
      })();

    const range = (
      await query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total,
                COUNT(*) AS transactions,
                COALESCE(SUM((SELECT SUM(quantity) FROM transaction_items WHERE transaction_id = t.id)), 0) AS items
         FROM transactions t
         WHERE DATE(created_at) BETWEEN $1 AND $2 AND status = 'completed'`,
        [start, end]
      )
    ).rows[0];

    const todayRow = (
      await query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS transactions
         FROM transactions
         WHERE DATE(created_at) = $1 AND status = 'completed'`,
        [today]
      )
    ).rows[0];

    const lowStock = (
      await query('SELECT COUNT(*) AS count FROM products WHERE stock <= 5 AND is_active = 1')
    ).rows[0];

    const products = (await query('SELECT COUNT(*) AS count FROM products WHERE is_active = 1'))
      .rows[0];

    res.json({
      range: { start, end },
      revenue: range.total,
      transactions: range.transactions,
      avg_ticket: range.transactions ? Math.round(range.total / range.transactions) : 0,
      items_sold: range.items,
      today: {
        revenue: todayRow.total,
        transactions: todayRow.transactions,
      },
      low_stock: lowStock.count,
      products: products.count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// P1-03 — daily revenue series for charts.
router.get('/sales-trend', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const end = req.query.end || today;
    const start =
      req.query.start ||
      (() => {
        const d = new Date(end);
        d.setDate(d.getDate() - 29);
        return d.toISOString().split('T')[0];
      })();

    const rows = (
      await query(
        `SELECT DATE(created_at) AS date,
                COALESCE(SUM(total_amount), 0) AS total,
                COUNT(*) AS transactions
         FROM transactions
         WHERE DATE(created_at) BETWEEN $1 AND $2 AND status = 'completed'
         GROUP BY DATE(created_at)
         ORDER BY date`,
        [start, end]
      )
    ).rows;

    // Fill gaps so charts don't render with missing dates.
    const out = [];
    for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const found = rows.find((r) => r.date === key);
      out.push({
        date: key,
        total: found?.total ?? 0,
        transactions: found?.transactions ?? 0,
      });
    }

    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
