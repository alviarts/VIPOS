// Coupon CRUD + bulk generation + validate/redeem.
//
// Bulk generate akan membuat N kupon random suffix dengan prefix optional,
// disimpan dengan `batch_id` UUID-ish supaya bisa di-listing per batch.
// Validate hanya cek elgibility tanpa increment used_count. Redeem melakukan
// validate sekaligus increment + record audit row.
const crypto = require('node:crypto');
const express = require('express');
const { z } = require('zod');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  CouponCreateSchema,
  CouponBulkCreateSchema,
  CouponValidateRequestSchema,
} = require('@vipos/shared');
const { rowToPromo } = require('./promo');

const CouponRedeemSchema = CouponValidateRequestSchema.extend({
  transaction_id: z.coerce.number().int().positive().optional(),
  amount: z.coerce.number().nonnegative().default(0),
});

const router = express.Router();

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude I, O, 0, 1 for legibility.

function randomCode(length) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function withinDateWindow(now, fromIso, untilIso) {
  if (fromIso && new Date(fromIso) > now) return false;
  if (untilIso && new Date(untilIso) < now) return false;
  return true;
}

function timeOfDayMatches(now, startStr, endStr) {
  if (!startStr && !endStr) return true;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const cur = `${hh}:${mm}`;
  if (startStr && cur < startStr) return false;
  if (endStr && cur > endStr) return false;
  return true;
}

function dayOfWeekMatches(now, mask) {
  if (mask === null || mask === undefined) return true;
  // bit 0 = Sunday, bit 1 = Monday, ... bit 6 = Saturday.
  const dow = now.getDay();
  return ((mask >> dow) & 1) === 1;
}

function eligibilityCheck(coupon, promo, now, { customer_id, subtotal }) {
  if (!coupon || !coupon.is_active) {
    return { valid: false, reason: 'Kupon tidak aktif' };
  }
  if (!withinDateWindow(now, coupon.valid_from, coupon.valid_until)) {
    return { valid: false, reason: 'Kupon di luar periode valid' };
  }
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
    return { valid: false, reason: 'Kupon sudah dipakai maksimal' };
  }
  if (coupon.assigned_customer_id && coupon.assigned_customer_id !== customer_id) {
    return { valid: false, reason: 'Kupon hanya untuk customer tertentu' };
  }
  if (!promo || !promo.is_active) {
    return { valid: false, reason: 'Promo terkait tidak aktif' };
  }
  if (!withinDateWindow(now, promo.valid_from, promo.valid_until)) {
    return { valid: false, reason: 'Promo di luar periode valid' };
  }
  if (!dayOfWeekMatches(now, promo.day_of_week_mask)) {
    return { valid: false, reason: 'Promo tidak berlaku di hari ini' };
  }
  if (!timeOfDayMatches(now, promo.time_of_day_start, promo.time_of_day_end)) {
    return { valid: false, reason: 'Promo tidak berlaku di jam ini' };
  }
  if (promo.min_purchase && subtotal < promo.min_purchase) {
    return {
      valid: false,
      reason: `Min belanja Rp ${promo.min_purchase.toLocaleString('id-ID')}`,
    };
  }
  if (promo.max_total_use > 0 && promo.current_use_count >= promo.max_total_use) {
    return { valid: false, reason: 'Promo sudah mencapai batas penggunaan' };
  }
  if (promo.customer_group_ids && promo.customer_group_ids.length > 0) {
    // We can't check customer's group without joining. Surface caller hint.
    if (!customer_id) {
      return {
        valid: false,
        reason: 'Promo hanya untuk grup customer tertentu — pilih customer dulu',
      };
    }
    // Check the customer's group_id.
    // (Caller passes customer_id; we look up their group below in handler.)
  }
  return { valid: true };
}

function estimateDiscount(promo, subtotal) {
  if (!promo) return 0;
  if (promo.promo_type === 'PERCENT') {
    let amt = (subtotal * promo.discount_value) / 100;
    if (promo.max_discount && promo.max_discount > 0) {
      amt = Math.min(amt, promo.max_discount);
    }
    return Math.round(amt);
  }
  if (promo.promo_type === 'NOMINAL' || promo.promo_type === 'MIN_PURCHASE') {
    return Math.min(promo.discount_value, subtotal);
  }
  return 0;
}

router.get('/batches', authenticateToken, async (req, res) => {
  try {
    const rows = (
      await query(
        `SELECT c.batch_id,
                MIN(c.promo_id) AS promo_id,
                p.name AS promo_name,
                COUNT(*) AS generated,
                SUM(c.used_count) AS used,
                SUM(GREATEST(c.max_uses, 0) - c.used_count) AS remaining,
                MIN(c.created_at) AS created_at
           FROM coupons c
           LEFT JOIN promos p ON p.id = c.promo_id
          WHERE c.batch_id IS NOT NULL
          GROUP BY c.batch_id, p.name
          ORDER BY MIN(c.created_at) DESC`
      )
    ).rows;
    res.json(
      rows.map((r) => ({
        batch_id: r.batch_id,
        promo_id: r.promo_id,
        promo_name: r.promo_name || '',
        generated: r.generated || 0,
        used: r.used || 0,
        remaining: Math.max(0, r.remaining || 0),
        created_at: r.created_at,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let p = 1;
    if (req.query.promo_id) {
      conditions.push(`c.promo_id = $${p++}`);
      params.push(parseInt(req.query.promo_id, 10));
    }
    if (req.query.batch_id) {
      conditions.push(`c.batch_id = $${p++}`);
      params.push(req.query.batch_id);
    }
    if (req.query.is_active === '0' || req.query.is_active === '1') {
      conditions.push(`c.is_active = $${p++}`);
      params.push(parseInt(req.query.is_active, 10));
    }
    if (req.query.search) {
      conditions.push(`c.code LIKE $${p++}`);
      params.push(`%${req.query.search.toUpperCase()}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(parseInt(req.query.limit ?? '100', 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);
    const total = Number(
      (await query(`SELECT COUNT(*) AS n FROM coupons c ${where}`, params)).rows[0].n
    );
    const items = (
      await query(
        `SELECT c.*, p.name AS promo_name, p.promo_type AS promo_type, cust.name AS customer_name
           FROM coupons c
           LEFT JOIN promos p ON p.id = c.promo_id
           LEFT JOIN customers cust ON cust.id = c.assigned_customer_id
           ${where}
          ORDER BY c.created_at DESC, c.id DESC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset]
      )
    ).rows;
    res.json({ items, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: CouponCreateSchema }),
  async (req, res) => {
    try {
      const promo = (await query('SELECT id FROM promos WHERE id = $1', [req.body.promo_id]))
        .rows[0];
      if (!promo) return res.status(400).json({ error: 'Promo tidak ditemukan' });
      const code = req.body.code.toUpperCase();
      const ins = await query(
        `INSERT INTO coupons (
             promo_id, code, max_uses, assigned_customer_id,
             valid_from, valid_until, is_active
           ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          req.body.promo_id,
          code,
          req.body.max_uses,
          req.body.assigned_customer_id ?? null,
          req.body.valid_from ?? null,
          req.body.valid_until ?? null,
          req.body.is_active ? 1 : 0,
        ]
      );
      const row = (await query('SELECT * FROM coupons WHERE id = $1', [ins.rows[0].id])).rows[0];
      res.status(201).json(row);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Kode kupon sudah digunakan' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  '/bulk',
  authenticateToken,
  requireAdmin,
  validate({ body: CouponBulkCreateSchema }),
  async (req, res) => {
    try {
      const promo = (await query('SELECT id FROM promos WHERE id = $1', [req.body.promo_id]))
        .rows[0];
      if (!promo) return res.status(400).json({ error: 'Promo tidak ditemukan' });

      const batchId = `BATCH-${Date.now()}-${randomCode(6)}`;
      const codes = [];
      await tx(async (txQuery) => {
        let attempts = 0;
        while (codes.length < req.body.count) {
          if (attempts > req.body.count * 5) {
            throw new Error('Tidak bisa generate kode unik — coba code_length lebih besar');
          }
          attempts += 1;
          const suffix = randomCode(req.body.code_length);
          const code = `${req.body.prefix || ''}${suffix}`.toUpperCase();
          try {
            await txQuery(
              `INSERT INTO coupons (promo_id, code, batch_id, max_uses, valid_from, valid_until, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, 1)`,
              [
                req.body.promo_id,
                code,
                batchId,
                req.body.max_uses,
                req.body.valid_from ?? null,
                req.body.valid_until ?? null,
              ]
            );
            codes.push(code);
          } catch (err) {
            if (!err.code === '23505') throw err;
            // collision — try again.
          }
        }
      });
      res.status(201).json({ batch_id: batchId, count: codes.length, codes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

async function loadCouponWithPromo(q, code) {
  const coupon = (await q('SELECT * FROM coupons WHERE code = $1', [code.toUpperCase()])).rows[0];
  if (!coupon) return { coupon: null, promo: null };
  const promoRow = (await q('SELECT * FROM promos WHERE id = $1', [coupon.promo_id])).rows[0];
  return { coupon, promo: promoRow ? rowToPromo(promoRow) : null };
}

router.post(
  '/validate',
  authenticateToken,
  validate({ body: CouponValidateRequestSchema }),
  async (req, res) => {
    try {
      const { coupon, promo } = await loadCouponWithPromo(query, req.body.code);
      if (!coupon) {
        return res.status(200).json({ valid: false, reason: 'Kode kupon tidak ditemukan' });
      }
      const now = new Date();
      const result = eligibilityCheck(coupon, promo, now, req.body);
      if (!result.valid) {
        return res.status(200).json({ valid: false, reason: result.reason });
      }
      // Optional check: customer group membership.
      if (promo.customer_group_ids && promo.customer_group_ids.length > 0 && req.body.customer_id) {
        const cust = (
          await query('SELECT customer_group_id FROM customers WHERE id = $1', [
            req.body.customer_id,
          ])
        ).rows[0];
        if (
          !cust ||
          !cust.customer_group_id ||
          !promo.customer_group_ids.includes(cust.customer_group_id)
        ) {
          return res
            .status(200)
            .json({ valid: false, reason: 'Customer tidak termasuk grup yang berhak' });
        }
      }
      res.json({
        valid: true,
        coupon,
        promo: {
          id: promo.id,
          name: promo.name,
          promo_type: promo.promo_type,
          discount_value: promo.discount_value,
          max_discount: promo.max_discount,
          min_purchase: promo.min_purchase,
        },
        estimated_discount: estimateDiscount(promo, req.body.subtotal || 0),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  '/redeem',
  authenticateToken,
  validate({ body: CouponRedeemSchema }),
  async (req, res) => {
    try {
      const parsed = { data: req.body };
      const { coupon, promo } = await loadCouponWithPromo(query, parsed.data.code);
      if (!coupon) {
        return res.status(400).json({ valid: false, reason: 'Kode kupon tidak ditemukan' });
      }
      const now = new Date();
      const result = eligibilityCheck(coupon, promo, now, parsed.data);
      if (!result.valid) {
        return res.status(400).json({ valid: false, reason: result.reason });
      }
      await tx(async (txQuery) => {
        await txQuery('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [coupon.id]);
        await txQuery('UPDATE promos SET current_use_count = current_use_count + 1 WHERE id = $1', [
          promo.id,
        ]);
        await txQuery(
          `INSERT INTO coupon_redemptions (coupon_id, transaction_id, customer_id, amount)
         VALUES ($1, $2, $3, $4)`,
          [
            coupon.id,
            parsed.data.transaction_id ?? null,
            parsed.data.customer_id ?? null,
            parsed.data.amount ?? 0,
          ]
        );
      });
      const refreshed = (await query('SELECT * FROM coupons WHERE id = $1', [coupon.id])).rows[0];
      res.json({
        valid: true,
        coupon: refreshed,
        promo: {
          id: promo.id,
          name: promo.name,
          promo_type: promo.promo_type,
          discount_value: promo.discount_value,
          max_discount: promo.max_discount,
          min_purchase: promo.min_purchase,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/batch/:batch_id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('UPDATE coupons SET is_active = 0 WHERE batch_id = $1', [
      req.params.batch_id,
    ]);
    res.json({ message: 'Batch dinonaktifkan', updated: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = (await query('SELECT id FROM coupons WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Kupon tidak ditemukan' });
    await query('DELETE FROM coupons WHERE id = $1', [req.params.id]);
    res.json({ message: 'Kupon dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// P3-15: Active promos endpoint (non-coupon promos for auto-apply).
router.get('/active-promos', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, description, promo_type, discount_value,
              max_discount, min_purchase, discount_target,
              target_product_ids, target_category_ids,
              requires_coupon, is_stackable,
              valid_from, valid_until
       FROM promos
       WHERE tenant_id = $1
         AND is_active = 1
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_until IS NULL OR valid_until >= NOW())
         AND requires_coupon = 0
       ORDER BY name`,
      [req.tenantId],
    );
    return res.status(200).json({ promos: rows });
  } catch (err) {
    console.error('Active promos error:', err);
    return res.status(500).json({ error: 'Gagal memuat promo aktif' });
  }
});

module.exports = router;
