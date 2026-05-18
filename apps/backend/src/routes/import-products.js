// VIPOS — Product bulk import from CSV/JSON.
//
// Surface:
//   POST /api/v1/products/import
//     body: { products: [{ name, price, sku?, category_name?, stock? }] }
//     201:  { imported, skipped, errors, total_rows }

const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { products } = req.body || {};

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'products array harus diisi' });
    }

    if (products.length > 1000) {
      return res.status(400).json({ error: 'Maksimal 1000 produk per import' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const rowNum = i + 1;

      if (!row.name || row.name.trim().length === 0) {
        errors.push({ row: rowNum, error: 'Nama produk harus diisi' });
        continue;
      }
      if (!row.price || row.price <= 0) {
        errors.push({ row: rowNum, error: 'Harga harus > 0' });
        continue;
      }

      // Check duplicate by SKU
      if (row.sku) {
        const { rows: existing } = await query(
          `SELECT id FROM products WHERE sku = $1 AND tenant_id = $2`,
          [row.sku, req.tenantId],
        );
        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      // Resolve category by name (create if not exists)
      let categoryId = null;
      if (row.category_name) {
        const { rows: catRows } = await query(
          `SELECT id FROM categories WHERE name = $1 AND tenant_id = $2`,
          [row.category_name.trim(), req.tenantId],
        );
        if (catRows.length > 0) {
          categoryId = catRows[0].id;
        } else {
          const { rows: newCat } = await query(
            `INSERT INTO categories (name, tenant_id) VALUES ($1, $2) RETURNING id`,
            [row.category_name.trim(), req.tenantId],
          );
          categoryId = newCat[0].id;
        }
      }

      try {
        await query(
          `INSERT INTO products (tenant_id, name, price, sku, stock, category_id, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, 1)`,
          [
            req.tenantId,
            row.name.trim(),
            row.price,
            row.sku || null,
            row.stock || 0,
            categoryId,
          ],
        );
        imported++;
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
      }
    }

    return res.status(201).json({
      imported,
      skipped,
      errors: errors.slice(0, 50),
      total_rows: products.length,
    });
  } catch (err) {
    console.error('Product import error:', err);
    return res.status(500).json({ error: 'Gagal mengimpor produk' });
  }
});

module.exports = router;
