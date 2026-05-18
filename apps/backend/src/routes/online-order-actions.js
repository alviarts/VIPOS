// VIPOS — Online order kasir actions (P4-01).
//
// Extends the existing online-orders CRUD with kasir-facing
// action endpoints for the in-app order queue.
//
// Surface:
//   POST /api/v1/online-orders/:id/action
//     body: { action: "accept"|"reject"|"ready", reason?: string }
//     200:  { order: {...} }

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const VALID_ACTIONS = ['accept', 'reject', 'ready'];
const STATUS_MAP = {
  accept: 'accepted',
  reject: 'rejected',
  ready: 'ready',
};

router.post('/:id/action', authenticateToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'ID pesanan tidak valid' });
    }

    const { action, reason } = req.body || {};
    if (!action || !VALID_ACTIONS.includes(action)) {
      return res.status(400).json({
        error: `Action harus salah satu dari: ${VALID_ACTIONS.join(', ')}`,
      });
    }

    const { rows } = await query(
      `SELECT id, status FROM online_orders
       WHERE id = $1 AND tenant_id = $2`,
      [orderId, req.tenantId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    const newStatus = STATUS_MAP[action];
    const notes = reason ? `[${action.toUpperCase()}] ${reason}` : null;

    const { rows: updated } = await query(
      `UPDATE online_orders
       SET status = $1, notes = COALESCE(notes, '') || COALESCE($2, '')
       WHERE id = $3 AND tenant_id = $4
       RETURNING id, order_number, customer_name, status, total_amount, created_at`,
      [newStatus, notes ? `\n${notes}` : '', orderId, req.tenantId],
    );

    return res.status(200).json({ order: updated[0] });
  } catch (err) {
    console.error('Online order action error:', err);
    return res.status(500).json({ error: 'Gagal memproses pesanan' });
  }
});

module.exports = router;
