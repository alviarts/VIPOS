// VIPOS — Dashboard summary endpoint for mobile owner KPI (P4-07).
//
// Surface:
//   GET /api/v1/dashboard/summary
//     200:  { today_revenue, today_transactions, today_avg_basket,
//             mtd_revenue, mtd_transactions, low_stock_count,
//             pending_approvals }

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const cache = require('../lib/cache');

const router = express.Router();

router.get('/summary', authenticateToken, async (req, res) => {
  try {
    // Cache key per tenant, expires every 60 seconds
    const cacheKey = `dashboard:summary:${req.tenantId}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.status(200).json(cached);
    }

    // Today's stats
    const { rows: todayRows } = await query(
      `SELECT
         COUNT(*)::int as transactions,
         COALESCE(SUM(total_amount), 0)::bigint as revenue,
         COALESCE(AVG(total_amount), 0)::bigint as avg_basket
       FROM transactions
       WHERE tenant_id = $1
         AND DATE(created_at) = CURRENT_DATE
         AND status != 'voided'`,
      [req.tenantId],
    );

    // Month-to-date stats
    const { rows: mtdRows } = await query(
      `SELECT
         COUNT(*)::int as transactions,
         COALESCE(SUM(total_amount), 0)::bigint as revenue
       FROM transactions
       WHERE tenant_id = $1
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
         AND status != 'voided'`,
      [req.tenantId],
    );

    // Low stock count (threshold: 5)
    const { rows: stockRows } = await query(
      `SELECT COUNT(*)::int as cnt
       FROM products
       WHERE tenant_id = $1 AND is_active = 1 AND stock <= 5`,
      [req.tenantId],
    );

    // Pending approvals (placeholder — count open shifts as proxy)
    const { rows: approvalRows } = await query(
      `SELECT COUNT(*)::int as cnt
       FROM cashier_shifts
       WHERE tenant_id = $1 AND status = 'open'`,
      [req.tenantId],
    );

    const today = todayRows[0];
    const mtd = mtdRows[0];

    const result = {
      today_revenue: Number(today.revenue),
      today_transactions: today.transactions,
      today_avg_basket: Number(today.avg_basket),
      mtd_revenue: Number(mtd.revenue),
      mtd_transactions: mtd.transactions,
      low_stock_count: stockRows[0].cnt,
      pending_approvals: approvalRows[0].cnt,
    };

    // Cache for 60 seconds
    cache.set(cacheKey, result, 60);

    return res.status(200).json(result);
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ error: 'Gagal memuat dashboard' });
  }
});

module.exports = router;
