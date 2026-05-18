// VIPOS — Stock alert endpoints for low-stock monitoring.
//
// Surface:
//   GET /api/v1/stock-alerts
//     query: { threshold?: number }
//     200:  { alerts: [...], count: number }
//
// Returns products whose current stock is at or below the
// threshold (default: 5 units). Used by the owner dashboard
// and push notification system.

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_THRESHOLD = 5;

router.get('/', authenticateToken, async (req, res) => {
  try {
    const rawThreshold = parseInt(req.query.threshold, 10);
    const threshold = Number.isFinite(rawThreshold) ? rawThreshold : DEFAULT_THRESHOLD;

    const { rows } = await query(
      `SELECT id, name, sku, stock, category_id
       FROM products
       WHERE tenant_id = $1
         AND is_active = 1
         AND stock <= $2
       ORDER BY stock ASC, name ASC`,
      [req.tenantId, threshold],
    );

    return res.status(200).json({
      alerts: rows.map((p) => ({
        product_id: p.id,
        name: p.name,
        sku: p.sku,
        current_stock: p.stock,
        threshold,
        is_out_of_stock: p.stock <= 0,
      })),
      count: rows.length,
      threshold,
    });
  } catch (err) {
    console.error('Stock alerts error:', err);
    return res.status(500).json({ error: 'Gagal mengambil data stok rendah' });
  }
});

module.exports = router;
