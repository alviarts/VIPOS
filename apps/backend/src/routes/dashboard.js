const express = require("express");
const { getDb } = require("../models/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Get dashboard stats
router.get("/stats", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];

    const todaySales = db
      .prepare(
        `
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
      FROM transactions
      WHERE DATE(created_at) = ? AND status = 'completed'
    `,
      )
      .get(today);

    const totalProducts = db
      .prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1")
      .get();

    const lowStock = db
      .prepare(
        "SELECT COUNT(*) as count FROM products WHERE stock <= 5 AND is_active = 1",
      )
      .get();

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    const monthlySales = db
      .prepare(
        `
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count
      FROM transactions
      WHERE DATE(created_at) >= ? AND status = 'completed'
    `,
      )
      .get(monthStartStr);

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
router.get("/chart", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { days = 7 } = req.query;

    const data = db
      .prepare(
        `
      SELECT DATE(created_at) as date,
             COALESCE(SUM(total_amount), 0) as total,
             COUNT(*) as transactions
      FROM transactions
      WHERE DATE(created_at) >= DATE('now', '-' || ? || ' days')
        AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
      )
      .all(parseInt(days));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top products
router.get("/top-products", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { limit = 10 } = req.query;

    const products = db
      .prepare(
        `
      SELECT ti.product_name, SUM(ti.quantity) as total_sold, SUM(ti.subtotal) as total_revenue
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      WHERE t.status = 'completed'
      GROUP BY ti.product_id
      ORDER BY total_sold DESC
      LIMIT ?
    `,
      )
      .all(parseInt(limit));

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent transactions
router.get("/recent", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const transactions = db
      .prepare(
        `
      SELECT t.*, u.name as cashier_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `,
      )
      .all();

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payment method breakdown
router.get("/payment-methods", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];

    const methods = db
      .prepare(
        `
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
      FROM transactions
      WHERE DATE(created_at) = ? AND status = 'completed'
      GROUP BY payment_method
    `,
      )
      .all(today);

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
router.get("/summary", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];
    const end = req.query.end || today;
    const start =
      req.query.start ||
      (() => {
        const d = new Date(end);
        d.setDate(1);
        return d.toISOString().split("T")[0];
      })();

    const range = db
      .prepare(
        `
      SELECT COALESCE(SUM(total_amount), 0) AS total,
             COUNT(*) AS transactions,
             COALESCE(SUM((SELECT SUM(quantity) FROM transaction_items WHERE transaction_id = t.id)), 0) AS items
      FROM transactions t
      WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
    `,
      )
      .get(start, end);

    const todayRow = db
      .prepare(
        `
      SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS transactions
      FROM transactions
      WHERE DATE(created_at) = ? AND status = 'completed'
    `,
      )
      .get(today);

    const lowStock = db
      .prepare(
        "SELECT COUNT(*) AS count FROM products WHERE stock <= 5 AND is_active = 1",
      )
      .get();

    const products = db
      .prepare("SELECT COUNT(*) AS count FROM products WHERE is_active = 1")
      .get();

    res.json({
      range: { start, end },
      revenue: range.total,
      transactions: range.transactions,
      avg_ticket: range.transactions
        ? Math.round(range.total / range.transactions)
        : 0,
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
router.get("/sales-trend", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];
    const end = req.query.end || today;
    const start =
      req.query.start ||
      (() => {
        const d = new Date(end);
        d.setDate(d.getDate() - 29);
        return d.toISOString().split("T")[0];
      })();

    const rows = db
      .prepare(
        `
      SELECT DATE(created_at) AS date,
             COALESCE(SUM(total_amount), 0) AS total,
             COUNT(*) AS transactions
      FROM transactions
      WHERE DATE(created_at) BETWEEN ? AND ? AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
      )
      .all(start, end);

    // Fill gaps so charts don't render with missing dates.
    const out = [];
    for (
      let d = new Date(start);
      d <= new Date(end);
      d.setDate(d.getDate() + 1)
    ) {
      const key = d.toISOString().split("T")[0];
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
