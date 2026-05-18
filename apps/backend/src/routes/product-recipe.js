// VIPOS — Product recipe (Bill of Materials) CRUD (P1-04, P2-01b cutover).
//
// Each recipe entry says "to make 1 unit of this product, consume X units of
// ingredient_id". Used by inventory deduction at sale time (later phase).
// Replace-all semantics like product-variants for simpler frontend wiring.
const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.get('/products/:id/recipe', authenticateToken, async (req, res) => {
  try {
    const items = (
      await query(
        `SELECT r.*, p.name AS ingredient_name, p.satuan AS ingredient_unit
           FROM product_recipe_items r
           JOIN products p ON r.ingredient_id = p.id
          WHERE r.product_id = $1
          ORDER BY r.id`,
        [req.params.id]
      )
    ).rows;
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:id/recipe', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const product = (await query('SELECT id FROM products WHERE id = $1', [productId])).rows[0];
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });

    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items harus array' });

    await tx(async (txQuery) => {
      await txQuery('DELETE FROM product_recipe_items WHERE product_id = $1', [productId]);
      for (const r of items) {
        const ing = parseInt(r.ingredient_id, 10);
        const qty = parseFloat(r.qty);
        if (!Number.isFinite(ing) || ing === productId) {
          throw new Error('ingredient_id tidak valid');
        }
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error('qty harus angka > 0');
        }
        await txQuery(
          `INSERT INTO product_recipe_items (
              product_id, ingredient_id, qty, unit, notes
            ) VALUES ($1, $2, $3, $4, $5)`,
          [
            productId,
            ing,
            qty,
            r.unit ? String(r.unit).trim() : null,
            r.notes ? String(r.notes).trim() : null,
          ]
        );
      }
      await txQuery(
        `UPDATE products SET has_recipe = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2`,
        [items.length ? 1 : 0, productId]
      );
    });

    const out = (
      await query(
        `SELECT r.*, p.name AS ingredient_name, p.satuan AS ingredient_unit
             FROM product_recipe_items r
             JOIN products p ON r.ingredient_id = p.id
            WHERE r.product_id = $1
            ORDER BY r.id`,
        [productId]
      )
    ).rows;
    res.json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
