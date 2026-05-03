const express = require("express");
const { getDb } = require("../models/database");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { ProductCreateSchema, ProductUpdateSchema } = require("@vipos/shared");

const router = express.Router();

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
`;

function toIntOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloatOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toBoolInt(v, defaultValue = 0) {
  if (v === undefined || v === null || v === "") return defaultValue;
  if (v === true || v === 1 || v === "1" || v === "true") return 1;
  if (v === false || v === 0 || v === "0" || v === "false") return 0;
  return defaultValue;
}

// Get all products. Supports filter + pagination via `page`, `per_page`.
// Without page param: returns array (legacy behaviour).
// With page param: returns { data, total, page, per_page, total_pages }.
router.get("/", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { category_id, search, active_only, is_tampil_di_menu, page, per_page } = req.query;

    const conditions = [];
    const params = [];

    if (active_only !== "false") {
      conditions.push("p.is_active = 1");
    }

    if (category_id) {
      conditions.push("p.category_id = ?");
      params.push(category_id);
    }

    if (is_tampil_di_menu === "0" || is_tampil_di_menu === "1") {
      conditions.push("p.is_tampil_di_menu = ?");
      params.push(parseInt(is_tampil_di_menu, 10));
    }

    if (search) {
      conditions.push("(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    let baseQuery = PRODUCT_SELECT;
    let whereClause = "";
    if (conditions.length > 0) whereClause = " WHERE " + conditions.join(" AND ");
    const orderBy = " ORDER BY p.name";

    if (page) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(per_page, 10) || 25));
      const offset = (pageNum - 1) * perPage;
      const total = db
        .prepare(`SELECT COUNT(*) AS count FROM products p${whereClause}`)
        .get(...params).count;
      const data = db
        .prepare(`${baseQuery}${whereClause}${orderBy} LIMIT ? OFFSET ?`)
        .all(...params, perPage, offset);
      return res.json({
        data,
        total,
        page: pageNum,
        per_page: perPage,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      });
    }

    const products = db.prepare(`${baseQuery}${whereClause}${orderBy}`).all(...params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product (with variants + recipe items inline).
router.get("/:id", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const product = db
      .prepare(`${PRODUCT_SELECT} WHERE p.id = ?`)
      .get(req.params.id);
    if (!product)
      return res.status(404).json({ error: "Produk tidak ditemukan" });

    product.variants = db
      .prepare(
        "SELECT * FROM product_variants WHERE product_id = ? ORDER BY group_name, sort_order, id",
      )
      .all(req.params.id);

    product.recipe_items = db
      .prepare(
        `SELECT r.*, p.name AS ingredient_name, p.satuan AS ingredient_unit
         FROM product_recipe_items r
         JOIN products p ON r.ingredient_id = p.id
         WHERE r.product_id = ?
         ORDER BY r.id`,
      )
      .all(req.params.id);

    if (product.image_urls) {
      try {
        product.image_urls = JSON.parse(product.image_urls);
      } catch {
        product.image_urls = [];
      }
    } else {
      product.image_urls = [];
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  validate({ body: ProductCreateSchema }),
  (req, res) => {
    try {
      const {
        name,
        sku,
        barcode,
        description,
        satuan,
        price,
        harga_modal,
        harga_beli,
        stock,
        category_id,
        image_url,
        image_urls,
        price_online,
        is_online_active,
        is_tampil_di_menu,
        is_favorit,
        monitor_stok,
        stok_minimum,
      } = req.body;

      if (
        !name ||
        !sku ||
        price === undefined ||
        price === null ||
        price === ""
      ) {
        return res
          .status(400)
          .json({ error: "Nama, SKU, dan Harga Jual wajib diisi" });
      }

      const priceNum = parseFloat(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "Harga Jual tidak valid" });
      }

      const imagesJson = Array.isArray(image_urls) && image_urls.length
        ? JSON.stringify(image_urls.slice(0, 4))
        : null;

      const db = getDb();
      const result = db
        .prepare(
          `
      INSERT INTO products (
        name, sku, barcode, description, satuan,
        price, harga_modal, harga_beli, stock,
        category_id, image_url, image_urls,
        is_tampil_di_menu, is_favorit, monitor_stok, stok_minimum,
        price_online, is_online_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        )
        .run(
          name.trim(),
          sku.trim(),
          barcode ? barcode.trim() : null,
          description ? description.trim() : null,
          satuan ? satuan.trim() : "pcs",
          priceNum,
          toFloatOrNull(harga_modal) ?? 0,
          toFloatOrNull(harga_beli) ?? 0,
          toIntOrNull(stock) ?? 0,
          toIntOrNull(category_id),
          image_url || null,
          imagesJson,
          toBoolInt(is_tampil_di_menu, 1),
          toBoolInt(is_favorit, 0),
          toBoolInt(monitor_stok, 0),
          toIntOrNull(stok_minimum) ?? 0,
          toFloatOrNull(price_online),
          toBoolInt(is_online_active, 0),
        );

      const product = db
        .prepare(`${PRODUCT_SELECT} WHERE p.id = ?`)
        .get(result.lastInsertRowid);
      res.status(201).json(product);
    } catch (err) {
      if (err.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "SKU sudah digunakan" });
      }
      res.status(500).json({ error: err.message });
    }
  },
);

// Update product
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  validate({ body: ProductUpdateSchema }),
  (req, res) => {
    try {
      const {
        name,
        sku,
        barcode,
        description,
        satuan,
        price,
        harga_modal,
        harga_beli,
        stock,
        category_id,
        image_url,
        image_urls,
        price_online,
        is_online_active,
        is_active,
        is_tampil_di_menu,
        is_favorit,
        monitor_stok,
        stok_minimum,
      } = req.body;

      const imagesJson = Array.isArray(image_urls) && image_urls.length
        ? JSON.stringify(image_urls.slice(0, 4))
        : null;

      const db = getDb();
      db.prepare(
        `
      UPDATE products
         SET name = ?,
             sku = ?,
             barcode = ?,
             description = ?,
             satuan = ?,
             price = ?,
             harga_modal = ?,
             harga_beli = ?,
             stock = ?,
             category_id = ?,
             image_url = ?,
             image_urls = ?,
             price_online = ?,
             is_online_active = ?,
             is_active = ?,
             is_tampil_di_menu = ?,
             is_favorit = ?,
             monitor_stok = ?,
             stok_minimum = ?,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `,
      ).run(
        (name || "").trim(),
        (sku || "").trim(),
        barcode ? barcode.trim() : null,
        description ? description.trim() : null,
        satuan ? satuan.trim() : "pcs",
        toFloatOrNull(price) ?? 0,
        toFloatOrNull(harga_modal) ?? 0,
        toFloatOrNull(harga_beli) ?? 0,
        toIntOrNull(stock) ?? 0,
        toIntOrNull(category_id),
        image_url || null,
        imagesJson,
        toFloatOrNull(price_online),
        toBoolInt(is_online_active, 0),
        toBoolInt(is_active, 1),
        toBoolInt(is_tampil_di_menu, 1),
        toBoolInt(is_favorit, 0),
        toBoolInt(monitor_stok, 0),
        toIntOrNull(stok_minimum) ?? 0,
        req.params.id,
      );

      const product = db
        .prepare(`${PRODUCT_SELECT} WHERE p.id = ?`)
        .get(req.params.id);
      res.json(product);
    } catch (err) {
      if (err.message.includes("UNIQUE")) {
        return res.status(400).json({ error: "SKU sudah digunakan" });
      }
      res.status(500).json({ error: err.message });
    }
  },
);

// Delete product
router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const hasTransactions = db
      .prepare(
        "SELECT COUNT(*) as count FROM transaction_items WHERE product_id = ?",
      )
      .get(req.params.id);
    const hasMovements = db
      .prepare(
        "SELECT COUNT(*) as count FROM inventory_movements WHERE product_id = ?",
      )
      .get(req.params.id);

    if (hasTransactions.count > 0 || hasMovements.count > 0) {
      db.prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(
        req.params.id,
      );
      return res.json({
        message:
          "Produk dinonaktifkan karena sudah memiliki riwayat transaksi/stok",
      });
    }

    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ message: "Produk berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
