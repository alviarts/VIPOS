// Coupon CRUD + bulk generation + validate/redeem.
//
// Bulk generate akan membuat N kupon random suffix dengan prefix optional,
// disimpan dengan `batch_id` UUID-ish supaya bisa di-listing per batch.
// Validate hanya cek elgibility tanpa increment used_count. Redeem melakukan
// validate sekaligus increment + record audit row.
const crypto = require('node:crypto');
const express = require('express');
const { z } = require('zod');
const { getDb } = require('../models/database');
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

router.get('/batches', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT c.batch_id,
                MIN(c.promo_id) AS promo_id,
                p.name AS promo_name,
                COUNT(*) AS generated,
                SUM(c.used_count) AS used,
                SUM(MAX(c.max_uses, 0) - c.used_count) AS remaining,
                MIN(c.created_at) AS created_at
           FROM coupons c
           LEFT JOIN promos p ON p.id = c.promo_id
          WHERE c.batch_id IS NOT NULL
          GROUP BY c.batch_id, p.name
          ORDER BY MIN(c.created_at) DESC`
      )
      .all();
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

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (req.query.promo_id) {
      conditions.push('c.promo_id = ?');
      params.push(parseInt(req.query.promo_id, 10));
    }
    if (req.query.batch_id) {
      conditions.push('c.batch_id = ?');
      params.push(req.query.batch_id);
    }
    if (req.query.is_active === '0' || req.query.is_active === '1') {
      conditions.push('c.is_active = ?');
      params.push(parseInt(req.query.is_active, 10));
    }
    if (req.query.search) {
      conditions.push('c.code LIKE ?');
      params.push(`%${req.query.search.toUpperCase()}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(parseInt(req.query.limit ?? '100', 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM coupons c ${where}`).get(...params).n;
    const items = db
      .prepare(
        `SELECT c.*, p.name AS promo_name, p.promo_type AS promo_type, cust.name AS customer_name
           FROM coupons c
           LEFT JOIN promos p ON p.id = c.promo_id
           LEFT JOIN customers cust ON cust.id = c.assigned_customer_id
           ${where}
          ORDER BY c.created_at DESC, c.id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
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
  (req, res) => {
    try {
      const db = getDb();
      const promo = db.prepare('SELECT id FROM promos WHERE id = ?').get(req.body.promo_id);
      if (!promo) return res.status(400).json({ error: 'Promo tidak ditemukan' });
      const code = req.body.code.toUpperCase();
      const result = db
        .prepare(
          `INSERT INTO coupons (
             promo_id, code, max_uses, assigned_customer_id,
             valid_from, valid_until, is_active
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.body.promo_id,
          code,
          req.body.max_uses,
          req.body.assigned_customer_id ?? null,
          req.body.valid_from ?? null,
          req.body.valid_until ?? null,
          req.body.is_active ? 1 : 0
        );
      const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
      res.status(201).json(row);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
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
  (req, res) => {
    try {
      const db = getDb();
      const promo = db.prepare('SELECT id FROM promos WHERE id = ?').get(req.body.promo_id);
      if (!promo) return res.status(400).json({ error: 'Promo tidak ditemukan' });

      const batchId = `BATCH-${Date.now()}-${randomCode(6)}`;
      const insert = db.prepare(
        `INSERT INTO coupons (promo_id, code, batch_id, max_uses, valid_from, valid_until, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`
      );
      const codes = [];
      const tx = db.transaction(() => {
        let attempts = 0;
        while (codes.length < req.body.count) {
          if (attempts > req.body.count * 5) {
            throw new Error('Tidak bisa generate kode unik — coba code_length lebih besar');
          }
          attempts += 1;
          const suffix = randomCode(req.body.code_length);
          const code = `${req.body.prefix || ''}${suffix}`.toUpperCase();
          try {
            insert.run(
              req.body.promo_id,
              code,
              batchId,
              req.body.max_uses,
              req.body.valid_from ?? null,
              req.body.valid_until ?? null
            );
            codes.push(code);
          } catch (err) {
            if (!err.message.includes('UNIQUE')) throw err;
            // collision — try again.
          }
        }
      });
      tx();
      res.status(201).json({ batch_id: batchId, count: codes.length, codes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

function loadCouponWithPromo(db, code) {
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ?').get(code.toUpperCase());
  if (!coupon) return { coupon: null, promo: null };
  const promoRow = db.prepare('SELECT * FROM promos WHERE id = ?').get(coupon.promo_id);
  return { coupon, promo: promoRow ? rowToPromo(promoRow) : null };
}

router.post(
  '/validate',
  authenticateToken,
  validate({ body: CouponValidateRequestSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const { coupon, promo } = loadCouponWithPromo(db, req.body.code);
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
        const cust = db
          .prepare('SELECT customer_group_id FROM customers WHERE id = ?')
          .get(req.body.customer_id);
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

router.post('/redeem', authenticateToken, validate({ body: CouponRedeemSchema }), (req, res) => {
  try {
    const parsed = { data: req.body };
    const db = getDb();
    const { coupon, promo } = loadCouponWithPromo(db, parsed.data.code);
    if (!coupon) {
      return res.status(400).json({ valid: false, reason: 'Kode kupon tidak ditemukan' });
    }
    const now = new Date();
    const result = eligibilityCheck(coupon, promo, now, parsed.data);
    if (!result.valid) {
      return res.status(400).json({ valid: false, reason: result.reason });
    }
    const tx = db.transaction(() => {
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
      db.prepare('UPDATE promos SET current_use_count = current_use_count + 1 WHERE id = ?').run(
        promo.id
      );
      db.prepare(
        `INSERT INTO coupon_redemptions (coupon_id, transaction_id, customer_id, amount)
         VALUES (?, ?, ?, ?)`
      ).run(
        coupon.id,
        parsed.data.transaction_id ?? null,
        parsed.data.customer_id ?? null,
        parsed.data.amount ?? 0
      );
    });
    tx();
    const refreshed = db.prepare('SELECT * FROM coupons WHERE id = ?').get(coupon.id);
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
});

router.delete('/batch/:batch_id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const result = db
      .prepare('UPDATE coupons SET is_active = 0 WHERE batch_id = ?')
      .run(req.params.batch_id);
    res.json({ message: 'Batch dinonaktifkan', updated: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM coupons WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Kupon tidak ditemukan' });
    db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
    res.json({ message: 'Kupon dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
