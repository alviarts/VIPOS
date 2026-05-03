// VIPOS — Product recipe (Bill of Materials) CRUD (P1-04).
//
// Each recipe entry says "to make 1 unit of this product, consume X units of
// ingredient_id". Used by inventory deduction at sale time (later phase).
// Replace-all semantics like product-variants for simpler frontend wiring.
const express = require("express");
const { getDb } = require("../models/database");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

router.get("/products/:id/recipe", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const items = db
      .prepare(
        `SELECT r.*, p.name AS ingredient_name, p.satuan AS ingredient_unit
         FROM product_recipe_items r
         JOIN products p ON r.ingredient_id = p.id
         WHERE r.product_id = ?
         ORDER BY r.id`,
      )
      .all(req.params.id);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  "/products/:id/recipe",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    try {
      const db = getDb();
      const productId = parseInt(req.params.id, 10);
      const product = db
        .prepare("SELECT id FROM products WHERE id = ?")
        .get(productId);
      if (!product)
        return res.status(404).json({ error: "Produk tidak ditemukan" });

      const { items } = req.body;
      if (!Array.isArray(items))
        return res.status(400).json({ error: "items harus array" });

      const tx = db.transaction((rows) => {
        db.prepare("DELETE FROM product_recipe_items WHERE product_id = ?").run(
          productId,
        );
        const stmt = db.prepare(
          `INSERT INTO product_recipe_items (
            product_id, ingredient_id, qty, unit, notes
          ) VALUES (?, ?, ?, ?, ?)`,
        );
        rows.forEach((r) => {
          const ing = parseInt(r.ingredient_id, 10);
          const qty = parseFloat(r.qty);
          if (!Number.isFinite(ing) || ing === productId) {
            throw new Error("ingredient_id tidak valid");
          }
          if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error("qty harus angka > 0");
          }
          stmt.run(
            productId,
            ing,
            qty,
            r.unit ? String(r.unit).trim() : null,
            r.notes ? String(r.notes).trim() : null,
          );
        });
        db.prepare(
          "UPDATE products SET has_recipe = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(rows.length ? 1 : 0, productId);
      });

      tx(items);

      const out = db
        .prepare(
          `SELECT r.*, p.name AS ingredient_name, p.satuan AS ingredient_unit
           FROM product_recipe_items r
           JOIN products p ON r.ingredient_id = p.id
           WHERE r.product_id = ?
           ORDER BY r.id`,
        )
        .all(productId);
      res.json(out);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

module.exports = router;
