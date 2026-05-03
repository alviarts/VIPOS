// VIPOS — Product variant CRUD (P1-04).
//
// Variants represent option groups attached to a product, e.g.
//   group_name="Ukuran" with option_label="Reguler", "Large", "Jumbo".
// Each option carries a price_modifier added to the product base price.
//
// Replace-all semantics: PUT /api/products/:id/variants accepts an array and
// rebuilds the variant list atomically (simpler frontend wiring).
const express = require("express");
const { getDb } = require("../models/database");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

router.get("/products/:id/variants", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const variants = db
      .prepare(
        "SELECT * FROM product_variants WHERE product_id = ? ORDER BY group_name, sort_order, id",
      )
      .all(req.params.id);
    res.json(variants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  "/products/:id/variants",
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

      const { variants } = req.body;
      if (!Array.isArray(variants))
        return res.status(400).json({ error: "variants harus array" });

      const tx = db.transaction((items) => {
        db.prepare("DELETE FROM product_variants WHERE product_id = ?").run(productId);
        const stmt = db.prepare(
          `INSERT INTO product_variants (
            product_id, group_name, option_label, price_modifier,
            sku_suffix, stock, is_default, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        items.forEach((v, i) => {
          if (!v.group_name || !v.option_label) {
            throw new Error("group_name + option_label wajib diisi tiap varian");
          }
          stmt.run(
            productId,
            String(v.group_name).trim(),
            String(v.option_label).trim(),
            Number.isFinite(parseFloat(v.price_modifier))
              ? parseFloat(v.price_modifier)
              : 0,
            v.sku_suffix ? String(v.sku_suffix).trim() : null,
            Number.isFinite(parseInt(v.stock, 10)) ? parseInt(v.stock, 10) : 0,
            v.is_default ? 1 : 0,
            Number.isFinite(parseInt(v.sort_order, 10))
              ? parseInt(v.sort_order, 10)
              : i,
          );
        });
        db.prepare(
          "UPDATE products SET has_variants = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(items.length ? 1 : 0, productId);
      });

      tx(variants);

      const out = db
        .prepare(
          "SELECT * FROM product_variants WHERE product_id = ? ORDER BY group_name, sort_order, id",
        )
        .all(productId);
      res.json(out);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },
);

module.exports = router;
