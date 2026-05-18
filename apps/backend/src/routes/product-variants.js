// VIPOS — Product variant CRUD (P1-04, P2-01b cutover).
//
// Variants represent option groups attached to a product, e.g.
//   group_name="Ukuran" with option_label="Reguler", "Large", "Jumbo".
// Each option carries a price_modifier added to the product base price.
//
// Replace-all semantics: PUT /api/products/:id/variants accepts an array and
// rebuilds the variant list atomically (simpler frontend wiring).
const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.get('/products/:id/variants', authenticateToken, async (req, res) => {
  try {
    const variants = (
      await query(
        `SELECT * FROM product_variants
          WHERE product_id = $1
          ORDER BY group_name, sort_order, id`,
        [req.params.id]
      )
    ).rows;
    res.json(variants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id/variants', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const product = (await query('SELECT id FROM products WHERE id = $1', [productId])).rows[0];
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });

    const { variants } = req.body;
    if (!Array.isArray(variants)) return res.status(400).json({ error: 'variants harus array' });

    await tx(async (txQuery) => {
      await txQuery('DELETE FROM product_variants WHERE product_id = $1', [productId]);
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.group_name || !v.option_label) {
          throw new Error('group_name + option_label wajib diisi tiap varian');
        }
        await txQuery(
          `INSERT INTO product_variants (
              product_id, group_name, option_label, price_modifier,
              sku_suffix, stock, is_default, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            productId,
            String(v.group_name).trim(),
            String(v.option_label).trim(),
            Number.isFinite(parseFloat(v.price_modifier)) ? parseFloat(v.price_modifier) : 0,
            v.sku_suffix ? String(v.sku_suffix).trim() : null,
            Number.isFinite(parseInt(v.stock, 10)) ? parseInt(v.stock, 10) : 0,
            v.is_default ? 1 : 0,
            Number.isFinite(parseInt(v.sort_order, 10)) ? parseInt(v.sort_order, 10) : i,
          ]
        );
      }
      await txQuery(
        `UPDATE products SET has_variants = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2`,
        [variants.length ? 1 : 0, productId]
      );
    });

    const out = (
      await query(
        `SELECT * FROM product_variants
            WHERE product_id = $1
            ORDER BY group_name, sort_order, id`,
        [productId]
      )
    ).rows;
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
