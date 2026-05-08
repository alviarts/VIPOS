// VIPOS — Product search suggestions endpoint (P3-19 enhancement).
//
// Surface:
//   GET /api/v1/products/suggestions
//     query: { q: string, limit?: number }
//     200:  { suggestions: [{ id, name, sku, price, category_name }] }
//
// Lightweight endpoint optimized for typeahead/autocomplete.
// Returns max 10 results by default, only the fields needed
// for the suggestion dropdown (no stock, no variants, no images).

const express = require('express');
const { query, iLikePattern } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(200).json({ suggestions: [] });
    }

    const pattern = `%${iLikePattern(q.trim())}%`;
    const maxResults = Math.min(Math.max(1, parseInt(limit, 10) || 10), 20);

    const { rows } = await query(
      `SELECT p.id, p.name, p.sku, p.price, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.tenant_id = $1
         AND p.is_active = 1
         AND (p.name ILIKE $2 OR p.sku ILIKE $2 OR p.barcode ILIKE $2)
       ORDER BY
         CASE WHEN p.name ILIKE $3 THEN 0 ELSE 1 END,
         p.name
       LIMIT $4`,
      [req.tenantId, pattern, `${iLikePattern(q.trim())}%`, maxResults],
    );

    return res.status(200).json({
      suggestions: rows.map((r) => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        price: Number(r.price),
        category_name: r.category_name,
      })),
    });
  } catch (err) {
    console.error('Product suggestions error:', err);
    return res.status(500).json({ error: 'Gagal mencari produk' });
  }
});

module.exports = router;
