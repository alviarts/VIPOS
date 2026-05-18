// VIPOS — Daily sales summary endpoint.
//
// Surface:
//   GET /api/v1/reports/daily-summary
//     query: { date?: YYYY-MM-DD }
//     200:  { date, revenue, transactions, avg_basket,
//             top_products, payment_breakdown, hourly_breakdown }
//
// Defaults to today if no date is provided. Used by the owner
// dashboard and scheduled email reports.

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/daily-summary', authenticateToken, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Total revenue + transaction count
    const { rows: summaryRows } = await query(
      `SELECT
         COUNT(*)::int as transaction_count,
         COALESCE(SUM(total_amount), 0)::bigint as total_revenue,
         COALESCE(AVG(total_amount), 0)::bigint as avg_basket
       FROM transactions
       WHERE tenant_id = $1
         AND DATE(created_at) = $2
         AND status != 'voided'`,
      [req.tenantId, date],
    );

    // Payment method breakdown
    const { rows: paymentRows } = await query(
      `SELECT
         COALESCE(payment_method, 'UNKNOWN') as method,
         COUNT(*)::int as count,
         COALESCE(SUM(total_amount), 0)::bigint as total
       FROM transactions
       WHERE tenant_id = $1
         AND DATE(created_at) = $2
         AND status != 'voided'
       GROUP BY payment_method
       ORDER BY total DESC`,
      [req.tenantId, date],
    );

    // Top 5 products
    const { rows: topProducts } = await query(
      `SELECT ti.product_name, SUM(ti.quantity)::int as qty,
              SUM(ti.subtotal)::bigint as revenue
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       WHERE t.tenant_id = $1
         AND DATE(t.created_at) = $2
         AND t.status != 'voided'
       GROUP BY ti.product_name
       ORDER BY qty DESC
       LIMIT 5`,
      [req.tenantId, date],
    );

    // Hourly breakdown (0-23)
    const { rows: hourlyRows } = await query(
      `SELECT
         EXTRACT(HOUR FROM created_at)::int as hour,
         COUNT(*)::int as count,
         COALESCE(SUM(total_amount), 0)::bigint as revenue
       FROM transactions
       WHERE tenant_id = $1
         AND DATE(created_at) = $2
         AND status != 'voided'
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY hour`,
      [req.tenantId, date],
    );

    const summary = summaryRows[0];

    return res.status(200).json({
      date,
      revenue: Number(summary.total_revenue),
      transactions: summary.transaction_count,
      avg_basket: Number(summary.avg_basket),
      payment_breakdown: paymentRows.map((r) => ({
        method: r.method,
        count: r.count,
        total: Number(r.total),
      })),
      top_products: topProducts.map((p) => ({
        name: p.product_name,
        qty: p.qty,
        revenue: Number(p.revenue),
      })),
      hourly_breakdown: hourlyRows.map((h) => ({
        hour: h.hour,
        count: h.count,
        revenue: Number(h.revenue),
      })),
    });
  } catch (err) {
    console.error('Daily summary error:', err);
    return res.status(500).json({ error: 'Gagal mengambil ringkasan harian' });
  }
});

module.exports = router;
