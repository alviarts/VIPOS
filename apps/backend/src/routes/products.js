const express = require('express');
const { query, iLikePattern } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ProductCreateSchema, ProductUpdateSchema } = require('@vipos/shared');

const router = express.Router();

const PRODUCT_SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
`;

function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloatOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toBoolInt(v, defaultValue = 0) {
  if (v === undefined || v === null || v === '') return defaultValue;
  if (v === true || v === 1 || v === '1' || v === 'true') return 1;
  if (v === false || v === 0 || v === '0' || v === 'false') return 0;
  return defaultValue;
}

// Get all products. Supports filter + pagination via `page`, `per_page`.
// Without page param: returns array (legacy behaviour).
// With page param: returns { data, total, page, per_page, total_pages }.
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category_id, search, active_only, is_tampil_di_menu, page, per_page } = req.query;

    const conditions = [];
    const params = [];
    let p = 1;

    if (active_only !== 'false') {
      conditions.push('p.is_active = 1');
    }

    if (category_id) {
      conditions.push(`p.category_id = $${p++}`);
      params.push(category_id);
    }

    if (is_tampil_di_menu === '0' || is_tampil_di_menu === '1') {
      conditions.push(`p.is_tampil_di_menu = $${p++}`);
      params.push(parseInt(is_tampil_di_menu, 10));
    }

    if (search) {
      const pattern = `%${iLikePattern(search)}%`;
      conditions.push(`(p.name LIKE $${p} OR p.sku LIKE $${p + 1} OR p.barcode LIKE $${p + 2})`);
      params.push(pattern, pattern, pattern);
      p += 3;
    }

    let whereClause = '';
    if (conditions.length > 0) whereClause = ' WHERE ' + conditions.join(' AND ');
    const orderBy = ' ORDER BY p.name';

    if (page) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(per_page, 10) || 25));
      const offset = (pageNum - 1) * perPage;
      const total = Number(
        (await query(`SELECT COUNT(*) AS count FROM products p${whereClause}`, params)).rows[0]
          .count
      );
      const data = (
        await query(`${PRODUCT_SELECT}${whereClause}${orderBy} LIMIT $${p} OFFSET $${p + 1}`, [
          ...params,
          perPage,
          offset,
        ])
      ).rows;
      return res.json({
        data,
        total,
        page: pageNum,
        per_page: perPage,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      });
    }

    const products = (await query(`${PRODUCT_SELECT}${whereClause}${orderBy}`, params)).rows;
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single product (with variants + recipe items inline).
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const product = (await query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id])).rows[0];
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });

    product.variants = (
      await query(
        'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY group_name, sort_order, id',
        [req.params.id]
      )
    ).rows;

    product.recipe_items = (
      await query(
        `SELECT r.*, p.name AS ingredient_name, p.satuan AS ingredient_unit
         FROM product_recipe_items r
         JOIN products p ON r.ingredient_id = p.id
         WHERE r.product_id = $1
         ORDER BY r.id`,
        [req.params.id]
      )
    ).rows;

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
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: ProductCreateSchema }),
  async (req, res) => {
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

      if (!name || !sku || price === undefined || price === null || price === '') {
        return res.status(400).json({ error: 'Nama, SKU, dan Harga Jual wajib diisi' });
      }

      const priceNum = parseFloat(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: 'Harga Jual tidak valid' });
      }

      const imagesJson =
        Array.isArray(image_urls) && image_urls.length
          ? JSON.stringify(image_urls.slice(0, 4))
          : null;

      const result = await query(
        `INSERT INTO products (
           name, sku, barcode, description, satuan,
           price, harga_modal, harga_beli, stock,
           category_id, image_url, image_urls,
           is_tampil_di_menu, is_favorit, monitor_stok, stok_minimum,
           price_online, is_online_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING id`,
        [
          name.trim(),
          sku.trim(),
          barcode ? barcode.trim() : null,
          description ? description.trim() : null,
          satuan ? satuan.trim() : 'pcs',
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
        ]
      );

      const product = (await query(`${PRODUCT_SELECT} WHERE p.id = $1`, [result.rows[0].id]))
        .rows[0];
      res.status(201).json(product);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'SKU sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Update product
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: ProductUpdateSchema }),
  async (req, res) => {
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

      const imagesJson =
        Array.isArray(image_urls) && image_urls.length
          ? JSON.stringify(image_urls.slice(0, 4))
          : null;

      await query(
        `UPDATE products
            SET name = $1,
                sku = $2,
                barcode = $3,
                description = $4,
                satuan = $5,
                price = $6,
                harga_modal = $7,
                harga_beli = $8,
                stock = $9,
                category_id = $10,
                image_url = $11,
                image_urls = $12,
                price_online = $13,
                is_online_active = $14,
                is_active = $15,
                is_tampil_di_menu = $16,
                is_favorit = $17,
                monitor_stok = $18,
                stok_minimum = $19,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $20`,
        [
          (name || '').trim(),
          (sku || '').trim(),
          barcode ? barcode.trim() : null,
          description ? description.trim() : null,
          satuan ? satuan.trim() : 'pcs',
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
        ]
      );

      const product = (await query(`${PRODUCT_SELECT} WHERE p.id = $1`, [req.params.id])).rows[0];
      res.json(product);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'SKU sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete product
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const hasTransactions = (
      await query('SELECT COUNT(*) as count FROM transaction_items WHERE product_id = $1', [
        req.params.id,
      ])
    ).rows[0];
    const hasMovements = (
      await query('SELECT COUNT(*) as count FROM inventory_movements WHERE product_id = $1', [
        req.params.id,
      ])
    ).rows[0];

    if (Number(hasTransactions.count) > 0 || Number(hasMovements.count) > 0) {
      await query('UPDATE products SET is_active = 0 WHERE id = $1', [req.params.id]);
      return res.json({
        message: 'Produk dinonaktifkan karena sudah memiliki riwayat transaksi/stok',
      });
    }

    await query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Produk berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
