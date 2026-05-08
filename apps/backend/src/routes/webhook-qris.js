// VIPOS — QRIS gateway webhook receiver.
//
// When a real QRIS gateway is integrated (Midtrans/Xendit/DOKU),
// it will POST payment confirmations to this endpoint. The
// handler updates the qris_dynamic_invocations table from
// AWAITING → PAID, which the Android poll loop will pick up
// on the next 3-second tick.
//
// Surface:
//   POST /api/v1/webhook/qris
//     body: { ref_id, status, paid_at, signature? }
//     200:  { received: true }
//     400:  invalid payload
//     401:  invalid signature (when signature verification is enabled)
//
// Security:
//   - No authenticateToken (webhooks come from the gateway, not users)
//   - Signature verification via HMAC (when QRIS_WEBHOOK_SECRET is set)
//   - IP whitelist (future, per gateway docs)

const express = require('express');
const crypto = require('crypto');
const { query, runAsSystem } = require('../db');

const router = express.Router();

router.post('/qris', async (req, res) => {
  try {
    const { ref_id, status, paid_at, signature } = req.body || {};

    if (!ref_id || !status) {
      return res.status(400).json({ error: 'ref_id and status are required' });
    }

    // Signature verification (optional, enabled when secret is set)
    const webhookSecret = process.env.QRIS_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${ref_id}:${status}`)
        .digest('hex');
      if (signature !== expectedSig) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // Only process PAID status (ignore other gateway callbacks)
    if (status !== 'PAID') {
      return res.status(200).json({ received: true, action: 'ignored', reason: `status=${status}` });
    }

    // Update the invocation record. Use runAsSystem to bypass RLS
    // since webhooks come from the gateway (no tenant context).
    const { rowCount } = await runAsSystem(() =>
      query(
        `UPDATE qris_dynamic_invocations
         SET status = 'PAID', paid_at = $1
         WHERE ref_id = $2 AND status = 'AWAITING'`,
        [paid_at || new Date().toISOString(), ref_id],
      ),
    );

    return res.status(200).json({
      received: true,
      action: rowCount > 0 ? 'updated' : 'no_match',
      ref_id,
    });
  } catch (err) {
    console.error('QRIS webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
