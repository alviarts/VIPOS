// VIPOS — Coupon validation + redemption endpoints (P3-15).
//
// Surface:
//   POST /api/v1/coupon/validate
//     body: { code: string, cart_total?: number }
//     200:  { valid: true, coupon: {...}, promo: {...} }
//     400:  invalid code, expired, max uses reached, etc.
//
//   POST /api/v1/coupon/redeem
//     body: { code: string, transaction_id: number }
//     201:  { redemption: {...} }
//     400:  invalid code or already redeemed for this transaction
//
//   GET /api/v1/promo/active
//     200:  { promos: [...] } — all currently active promos
//           (for auto-apply logic on the Android client)

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /validate — check if a coupon code is valid.
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { code, cart_total } = req.body || {};

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ valid: false, error: 'Kode kupon harus diisi' });
    }

    const { rows } = await query(
      `SELECT c.*, p.name as promo_name, p.promo_type, p.discount_value,
              p.max_discount, p.min_purchase, p.is_active as promo_active,
              p.valid_from as promo_valid_from, p.valid_until as promo_valid_until,
              p.discount_target
       FROM coupons c
       JOIN promos p ON c.promo_id = p.id
       WHERE c.code = $1 AND c.tenant_id = $2`,
      [code.trim().toUpperCase(), req.tenantId],
    );

    if (rows.length === 0) {
      return res.status(400).json({ valid: false, error: 'Kode kupon tidak ditemukan' });
    }

    const coupon = rows[0];

    // Check coupon is active
    if (coupon.is_active !== 1) {
      return res.status(400).json({ valid: false, error: 'Kupon sudah tidak aktif' });
    }

    // Check promo is active
    if (coupon.promo_active !== 1) {
      return res.status(400).json({ valid: false, error: 'Promo terkait sudah tidak aktif' });
    }

    // Check coupon validity period
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return res.status(400).json({ valid: false, error: 'Kupon belum berlaku' });
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return res.status(400).json({ valid: false, error: 'Kupon sudah kedaluwarsa' });
    }

    // Check promo validity period
    if (coupon.promo_valid_from && new Date(coupon.promo_valid_from) > now) {
      return res.status(400).json({ valid: false, error: 'Promo belum berlaku' });
    }
    if (coupon.promo_valid_until && new Date(coupon.promo_valid_until) < now) {
      return res.status(400).json({ valid: false, error: 'Promo sudah kedaluwarsa' });
    }

    // Check max uses
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ valid: false, error: 'Kupon sudah mencapai batas penggunaan' });
    }

    // Check min purchase
    if (coupon.min_purchase && cart_total && cart_total < coupon.min_purchase) {
      return res.status(400).json({
        valid: false,
        error: `Minimum pembelian Rp ${coupon.min_purchase.toLocaleString('id-ID')}`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.promo_type === 'PERCENT') {
      discountAmount = cart_total ? Math.round(cart_total * coupon.discount_value / 100) : 0;
      if (coupon.max_discount && discountAmount > coupon.max_discount) {
        discountAmount = coupon.max_discount;
      }
    } else if (coupon.promo_type === 'NOMINAL') {
      discountAmount = coupon.discount_value;
    }

    return res.status(200).json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        promo_id: coupon.promo_id,
        max_uses: coupon.max_uses,
        used_count: coupon.used_count,
      },
      promo: {
        name: coupon.promo_name,
        type: coupon.promo_type,
        discount_value: coupon.discount_value,
        max_discount: coupon.max_discount,
        discount_target: coupon.discount_target,
      },
      discount_amount: discountAmount,
    });
  } catch (err) {
    console.error('Coupon validate error:', err);
    return res.status(500).json({ valid: false, error: 'Gagal memvalidasi kupon' });
  }
});

// GET /active-promos — list all currently active promos (for auto-apply).
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
