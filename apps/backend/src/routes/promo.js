// Promo CRUD endpoints. Semua promo disimpan di satu tabel `promos`
// dengan kolom denormalized untuk 8 jenis promo (PERCENT, NOMINAL,
// FREE_PRODUCT, BUY_X_GET_Y, BUNDLE_PRICE, MIN_PURCHASE, STEP_DISCOUNT,
// MEMBER_PRICE). Daftar produk/kategori/grup customer disimpan sebagai
// JSON array string supaya tidak butuh tabel join tambahan untuk MVP.
const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { PromoCreateSchema, PromoUpdateSchema } = require('@vipos/shared');

const router = express.Router();

const JSON_FIELDS = [
  'target_product_ids',
  'target_category_ids',
  'customer_group_ids',
  'step_tiers',
];

function parseJsonField(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function serializeJsonField(value, fallback) {
  if (value === null || value === undefined) return JSON.stringify(fallback);
  return JSON.stringify(value);
}

function rowToPromo(row) {
  if (!row) return null;
  return {
    ...row,
    target_product_ids: parseJsonField(row.target_product_ids, []),
    target_category_ids: parseJsonField(row.target_category_ids, []),
    customer_group_ids: parseJsonField(row.customer_group_ids, []),
    step_tiers: parseJsonField(row.step_tiers, []),
  };
}

const COLUMNS = [
  'name',
  'description',
  'promo_type',
  'discount_value',
  'max_discount',
  'bundle_price',
  'qty_required',
  'give_qty',
  'discount_target',
  'target_product_ids',
  'target_category_ids',
  'customer_group_ids',
  'valid_from',
  'valid_until',
  'day_of_week_mask',
  'time_of_day_start',
  'time_of_day_end',
  'min_purchase',
  'max_use_per_customer',
  'max_total_use',
  'step_tiers',
  'is_stackable',
  'requires_coupon',
  'is_active',
];

function normalizeBody(body) {
  const out = { ...body };
  for (const key of JSON_FIELDS) {
    if (key in out) {
      out[key] = serializeJsonField(out[key], []);
    }
  }
  if ('is_stackable' in out) out.is_stackable = out.is_stackable ? 1 : 0;
  if ('requires_coupon' in out) out.requires_coupon = out.requires_coupon ? 1 : 0;
  if ('is_active' in out) out.is_active = out.is_active ? 1 : 0;
  return out;
}

function validateTypeSpecific(body) {
  const t = body.promo_type;
  const errors = [];
  if (t === 'PERCENT') {
    if (!(body.discount_value > 0 && body.discount_value <= 100)) {
      errors.push('discount_value harus 0 < x <= 100 untuk PERCENT');
    }
  }
  if (t === 'NOMINAL' || t === 'MIN_PURCHASE' || t === 'MEMBER_PRICE') {
    if (!(body.discount_value >= 0)) {
      errors.push('discount_value harus >= 0');
    }
  }
  if (t === 'BUY_X_GET_Y') {
    if (!(body.qty_required > 0)) errors.push('qty_required harus > 0 untuk BUY_X_GET_Y');
    if (!(body.give_qty > 0)) errors.push('give_qty harus > 0 untuk BUY_X_GET_Y');
    if (!Array.isArray(body.target_product_ids) || body.target_product_ids.length === 0) {
      errors.push('target_product_ids harus berisi minimal 1 produk untuk BUY_X_GET_Y');
    }
  }
  if (t === 'FREE_PRODUCT') {
    if (!Array.isArray(body.target_product_ids) || body.target_product_ids.length === 0) {
      errors.push('target_product_ids harus berisi produk hadiah untuk FREE_PRODUCT');
    }
  }
  if (t === 'BUNDLE_PRICE') {
    if (!(body.bundle_price >= 0)) errors.push('bundle_price harus >= 0 untuk BUNDLE_PRICE');
    if (!Array.isArray(body.target_product_ids) || body.target_product_ids.length < 2) {
      errors.push('BUNDLE_PRICE butuh minimal 2 produk di target_product_ids');
    }
  }
  if (t === 'STEP_DISCOUNT') {
    if (!Array.isArray(body.step_tiers) || body.step_tiers.length === 0) {
      errors.push('STEP_DISCOUNT butuh minimal 1 tier di step_tiers');
    }
  }
  if (
    body.time_of_day_start &&
    body.time_of_day_end &&
    body.time_of_day_start >= body.time_of_day_end
  ) {
    errors.push('time_of_day_start harus lebih awal dari time_of_day_end');
  }
  if (body.valid_from && body.valid_until && body.valid_from >= body.valid_until) {
    errors.push('valid_from harus lebih awal dari valid_until');
  }
  return errors;
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let p = 1;
    if (req.query.is_active === '0' || req.query.is_active === '1') {
      conditions.push(`p.is_active = $${p++}`);
      params.push(parseInt(req.query.is_active, 10));
    }
    if (req.query.promo_type) {
      conditions.push(`p.promo_type = $${p++}`);
      params.push(req.query.promo_type);
    }
    if (req.query.search) {
      conditions.push(`(p.name LIKE $${p} OR p.description LIKE $${p + 1})`);
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
      p += 2;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT p.*, (SELECT COUNT(*) FROM coupons c WHERE c.promo_id = p.id) AS coupon_count
           FROM promos p
           ${where}
          ORDER BY p.created_at DESC, p.id DESC`,
        params
      )
    ).rows;
    res.json(rows.map(rowToPromo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const row = (
      await query(
        `SELECT p.*, (SELECT COUNT(*) FROM coupons c WHERE c.promo_id = p.id) AS coupon_count
           FROM promos p
          WHERE p.id = $1`,
        [req.params.id]
      )
    ).rows[0];
    if (!row) return res.status(404).json({ error: 'Promo tidak ditemukan' });
    res.json(rowToPromo(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: PromoCreateSchema }),
  async (req, res) => {
    try {
      const errors = validateTypeSpecific(req.body);
      if (errors.length) {
        return res.status(400).json({ error: errors[0], details: errors });
      }
      const body = normalizeBody({
        target_product_ids: [],
        target_category_ids: [],
        customer_group_ids: [],
        step_tiers: [],
        ...req.body,
      });
      const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(', ');
      const values = COLUMNS.map((c) => body[c] ?? null);
      const ins = await query(
        `INSERT INTO promos (${COLUMNS.join(', ')}) VALUES (${placeholders}) RETURNING id`,
        values
      );
      const created = (
        await query(
          `SELECT p.*, (SELECT COUNT(*) FROM coupons c WHERE c.promo_id = p.id) AS coupon_count
             FROM promos p WHERE p.id = $1`,
          [ins.rows[0].id]
        )
      ).rows[0];
      res.status(201).json(rowToPromo(created));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: PromoUpdateSchema }),
  async (req, res) => {
    try {
      const existing = (await query('SELECT * FROM promos WHERE id = $1', [req.params.id])).rows[0];
      if (!existing) return res.status(404).json({ error: 'Promo tidak ditemukan' });

      const merged = {
        ...rowToPromo(existing),
        ...req.body,
      };
      const errors = validateTypeSpecific(merged);
      if (errors.length) {
        return res.status(400).json({ error: errors[0], details: errors });
      }
      const body = normalizeBody(merged);
      const setClauses = COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ');
      const values = COLUMNS.map((c) => body[c] ?? null);
      await query(
        `UPDATE promos SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = $${COLUMNS.length + 1}`,
        [...values, req.params.id]
      );
      const updated = (
        await query(
          `SELECT p.*, (SELECT COUNT(*) FROM coupons c WHERE c.promo_id = p.id) AS coupon_count
             FROM promos p WHERE p.id = $1`,
          [req.params.id]
        )
      ).rows[0];
      res.json(rowToPromo(updated));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = (await query('SELECT id FROM promos WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Promo tidak ditemukan' });
    await query('DELETE FROM promos WHERE id = $1', [req.params.id]);
    res.json({ message: 'Promo berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.rowToPromo = rowToPromo;
