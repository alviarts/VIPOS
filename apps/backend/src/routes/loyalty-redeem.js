// VIPOS — Loyalty point redemption endpoint (P3-16 AC #4).
//
// Surface:
//   POST /api/v1/loyalty/redeem
//     body: { customer_id, points, transaction_id? }
//     200:  { redeemed: true, points_used, discount_amount, new_balance }
//     400:  insufficient points, below threshold, etc.

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/redeem', authenticateToken, async (req, res) => {
  try {
    const { customer_id, points, transaction_id } = req.body || {};

    if (!customer_id || typeof customer_id !== 'number') {
      return res.status(400).json({ error: 'customer_id harus diisi' });
    }
    if (!points || typeof points !== 'number' || points <= 0) {
      return res.status(400).json({ error: 'points harus angka positif' });
    }

    // Get customer current balance
    const { rows: customerRows } = await query(
      `SELECT id, points as current_points FROM customers
       WHERE id = $1 AND tenant_id = $2`,
      [customer_id, req.tenantId],
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    const customer = customerRows[0];
    if (customer.current_points < points) {
      return res.status(400).json({
        error: `Poin tidak cukup. Saldo: ${customer.current_points}, diminta: ${points}`,
      });
    }

    // Get active redemption rule
    const { rows: rules } = await query(
      `SELECT id, redemption_rate, min_redeem_per_transaction,
              max_redeem_per_transaction, redemption_block
       FROM loyalty_rules
       WHERE tenant_id = $1
         AND rule_type = 'redemption'
         AND is_active = 1
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_until IS NULL OR valid_until >= NOW())
       ORDER BY id LIMIT 1`,
      [req.tenantId],
    );

    if (rules.length === 0) {
      return res.status(400).json({ error: 'Tidak ada aturan penukaran poin yang aktif' });
    }

    const rule = rules[0];

    // Validate against rule constraints
    if (rule.min_redeem_per_transaction && points < rule.min_redeem_per_transaction) {
      return res.status(400).json({
        error: `Minimum penukaran: ${rule.min_redeem_per_transaction} poin`,
      });
    }
    if (rule.max_redeem_per_transaction && points > rule.max_redeem_per_transaction) {
      return res.status(400).json({
        error: `Maksimum penukaran per transaksi: ${rule.max_redeem_per_transaction} poin`,
      });
    }
    if (rule.redemption_block && points % rule.redemption_block !== 0) {
      return res.status(400).json({
        error: `Poin harus kelipatan ${rule.redemption_block}`,
      });
    }

    // Calculate discount: points * redemption_rate
    const redemptionRate = rule.redemption_rate || 1;
    const discountAmount = Math.round(points * redemptionRate);

    // Deduct points
    const newBalance = customer.current_points - points;
    await query(
      `UPDATE customers SET points = $1 WHERE id = $2 AND tenant_id = $3`,
      [newBalance, customer_id, req.tenantId],
    );

    // Record ledger entry
    await query(
      `INSERT INTO loyalty_transactions
         (tenant_id, customer_id, type, points, balance_after, transaction_id, rule_id)
       VALUES ($1, $2, 'redeem', $3, $4, $5, $6)`,
      [req.tenantId, customer_id, -points, newBalance, transaction_id || null, rule.id],
    );

    return res.status(200).json({
      redeemed: true,
      points_used: points,
      discount_amount: discountAmount,
      new_balance: newBalance,
    });
  } catch (err) {
    console.error('Loyalty redeem error:', err);
    return res.status(500).json({ error: 'Gagal menukarkan poin' });
  }
});

module.exports = router;
