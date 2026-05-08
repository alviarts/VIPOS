// VIPOS — Cashier shift management endpoints (P3-14).
//
// Surface:
//   GET  /api/v1/cashier-shift/active     — Get the current open shift for the authenticated user
//   POST /api/v1/cashier-shift/open       — Open a new cashier shift
//   POST /api/v1/cashier-shift/:id/close  — Close an open shift with reconciliation
//   POST /api/v1/cashier-shift/:id/cash-drop   — Record a cash withdrawal during shift
//   POST /api/v1/cashier-shift/:id/cash-pickup — Record a cash deposit during shift
//   GET  /api/v1/cashier-shift/:id/summary     — Get shift summary (for close screen)
//
// Business rules:
//   - A user can only have ONE open shift at a time per tenant.
//   - Opening a shift when one is already open returns 409 SHIFT_ALREADY_OPEN.
//   - Closing a shift computes expected cash from transactions + movements.
//   - Variance > Rp 10,000 flags a warning (client-side enforcement for
//     manager PIN; backend records the variance regardless).
//
// Risk: yellow (new endpoints touching production DB, but additive-only
// and no existing data is modified). Rollback: revert + redeploy.

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

// Variance threshold in IDR — above this, the client should
// require manager PIN confirmation before allowing close.
const VARIANCE_WARNING_THRESHOLD = 10_000;

// GET /active — get the current open shift for the authenticated user.
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, user_id, opening_cash, status, opened_at, notes, created_at
       FROM cashier_shifts
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'open'
       ORDER BY opened_at DESC
       LIMIT 1`,
      [req.tenantId, req.user.id],
    );

    if (rows.length === 0) {
      return res.status(200).json({ shift: null });
    }

    const shift = rows[0];
    return res.status(200).json({
      shift: {
        id: shift.id,
        user_id: shift.user_id,
        opening_cash: Number(shift.opening_cash),
        status: shift.status,
        opened_at: new Date(shift.opened_at).toISOString(),
        notes: shift.notes,
      },
    });
  } catch (err) {
    console.error('Cashier shift active error:', err);
    return res.status(500).json({ error: 'Gagal mengambil data shift aktif' });
  }
});

// POST /open — open a new cashier shift.
router.post('/open', authenticateToken, async (req, res) => {
  try {
    const { opening_cash = 0, notes } = req.body || {};

    if (typeof opening_cash !== 'number' || !Number.isFinite(opening_cash) || opening_cash < 0) {
      return res.status(400).json({ error: 'opening_cash harus angka >= 0' });
    }

    // Check for existing open shift.
    const { rows: existing } = await query(
      `SELECT id FROM cashier_shifts
       WHERE tenant_id = $1 AND user_id = $2 AND status = 'open'
       LIMIT 1`,
      [req.tenantId, req.user.id],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Kasir sudah dibuka. Tutup dulu sebelum buka baru.',
        code: 'SHIFT_ALREADY_OPEN',
        existing_shift_id: existing[0].id,
      });
    }

    const { rows } = await query(
      `INSERT INTO cashier_shifts (tenant_id, user_id, opening_cash, status, notes)
       VALUES ($1, $2, $3, 'open', $4)
       RETURNING id, user_id, opening_cash, status, opened_at, notes`,
      [req.tenantId, req.user.id, Math.round(opening_cash), notes || null],
    );

    const shift = rows[0];
    return res.status(201).json({
      shift: {
        id: shift.id,
        user_id: shift.user_id,
        opening_cash: Number(shift.opening_cash),
        status: shift.status,
        opened_at: new Date(shift.opened_at).toISOString(),
        notes: shift.notes,
      },
    });
  } catch (err) {
    console.error('Cashier shift open error:', err);
    return res.status(500).json({ error: 'Gagal membuka shift kasir' });
  }
});

// GET /:id/summary — get shift summary for the close screen.
router.get('/:id/summary', authenticateToken, async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id, 10);
    if (isNaN(shiftId)) {
      return res.status(400).json({ error: 'ID shift tidak valid' });
    }

    // Get shift details.
    const { rows: shiftRows } = await query(
      `SELECT id, user_id, opening_cash, status, opened_at
       FROM cashier_shifts
       WHERE id = $1 AND tenant_id = $2`,
      [shiftId, req.tenantId],
    );

    if (shiftRows.length === 0) {
      return res.status(404).json({ error: 'Shift tidak ditemukan' });
    }

    const shift = shiftRows[0];

    // Transaction summary grouped by payment method.
    const { rows: txSummary } = await query(
      `SELECT
         COALESCE(payment_method, 'UNKNOWN') as payment_method,
         COUNT(*)::int as count,
         COALESCE(SUM(total_amount), 0)::bigint as total
       FROM transactions
       WHERE cashier_shift_id = $1 AND tenant_id = $2
       GROUP BY payment_method
       ORDER BY payment_method`,
      [shiftId, req.tenantId],
    );

    // Cash movements (drops + pickups).
    const { rows: movements } = await query(
      `SELECT type, COALESCE(SUM(amount), 0)::bigint as total
       FROM cashier_shift_cash_movements
       WHERE cashier_shift_id = $1 AND tenant_id = $2
       GROUP BY type`,
      [shiftId, req.tenantId],
    );

    const cashDrops = Number(movements.find((m) => m.type === 'drop')?.total || 0);
    const cashPickups = Number(movements.find((m) => m.type === 'pickup')?.total || 0);

    // Cash sales = sum of total_amount where payment_method is CASH.
    const cashSales = Number(
      txSummary.find((t) => t.payment_method === 'CASH')?.total || 0,
    );

    const openingCash = Number(shift.opening_cash);
    const expectedCash = openingCash + cashSales - cashDrops + cashPickups;

    const totalRevenue = txSummary.reduce((sum, t) => sum + Number(t.total), 0);
    const totalTransactions = txSummary.reduce((sum, t) => sum + t.count, 0);

    return res.status(200).json({
      shift_id: shift.id,
      user_id: shift.user_id,
      status: shift.status,
      opened_at: new Date(shift.opened_at).toISOString(),
      opening_cash: openingCash,
      cash_sales: cashSales,
      cash_drops: cashDrops,
      cash_pickups: cashPickups,
      expected_cash: expectedCash,
      total_revenue: totalRevenue,
      total_transactions: totalTransactions,
      payment_breakdown: txSummary.map((t) => ({
        method: t.payment_method,
        count: t.count,
        total: Number(t.total),
      })),
      variance_warning_threshold: VARIANCE_WARNING_THRESHOLD,
    });
  } catch (err) {
    console.error('Cashier shift summary error:', err);
    return res.status(500).json({ error: 'Gagal mengambil ringkasan shift' });
  }
});

// POST /:id/close — close an open shift with reconciliation.
router.post('/:id/close', authenticateToken, async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id, 10);
    if (isNaN(shiftId)) {
      return res.status(400).json({ error: 'ID shift tidak valid' });
    }

    const { closing_cash_counted, variance_reason, notes } = req.body || {};

    if (typeof closing_cash_counted !== 'number' || !Number.isFinite(closing_cash_counted) || closing_cash_counted < 0) {
      return res.status(400).json({ error: 'closing_cash_counted harus angka >= 0' });
    }

    // Verify shift exists and is open.
    const { rows: shiftRows } = await query(
      `SELECT id, user_id, opening_cash, status
       FROM cashier_shifts
       WHERE id = $1 AND tenant_id = $2`,
      [shiftId, req.tenantId],
    );

    if (shiftRows.length === 0) {
      return res.status(404).json({ error: 'Shift tidak ditemukan' });
    }

    const shift = shiftRows[0];
    if (shift.status !== 'open') {
      return res.status(409).json({
        error: 'Shift sudah ditutup.',
        code: 'SHIFT_ALREADY_CLOSED',
      });
    }

    // Compute expected cash.
    const { rows: cashTxRows } = await query(
      `SELECT COALESCE(SUM(total_amount), 0)::bigint as cash_sales
       FROM transactions
       WHERE cashier_shift_id = $1 AND tenant_id = $2
         AND payment_method = 'CASH'`,
      [shiftId, req.tenantId],
    );

    const { rows: movementRows } = await query(
      `SELECT type, COALESCE(SUM(amount), 0)::bigint as total
       FROM cashier_shift_cash_movements
       WHERE cashier_shift_id = $1 AND tenant_id = $2
       GROUP BY type`,
      [shiftId, req.tenantId],
    );

    const cashSales = Number(cashTxRows[0].cash_sales);
    const cashDrops = Number(movementRows.find((m) => m.type === 'drop')?.total || 0);
    const cashPickups = Number(movementRows.find((m) => m.type === 'pickup')?.total || 0);
    const openingCash = Number(shift.opening_cash);
    const expectedCash = openingCash + cashSales - cashDrops + cashPickups;
    const counted = Math.round(closing_cash_counted);
    const variance = counted - expectedCash;

    // Close the shift.
    const { rows: closedRows } = await query(
      `UPDATE cashier_shifts
       SET status = 'closed',
           closing_cash_counted = $1,
           closing_cash_expected = $2,
           variance = $3,
           variance_reason = $4,
           notes = $5,
           closed_at = NOW()
       WHERE id = $6 AND tenant_id = $7
       RETURNING id, user_id, opening_cash, closing_cash_counted,
                 closing_cash_expected, variance, variance_reason,
                 status, opened_at, closed_at, notes`,
      [counted, expectedCash, variance, variance_reason || null, notes || null, shiftId, req.tenantId],
    );

    const closed = closedRows[0];
    return res.status(200).json({
      shift: {
        id: closed.id,
        user_id: closed.user_id,
        opening_cash: Number(closed.opening_cash),
        closing_cash_counted: Number(closed.closing_cash_counted),
        closing_cash_expected: Number(closed.closing_cash_expected),
        variance: Number(closed.variance),
        variance_reason: closed.variance_reason,
        status: closed.status,
        opened_at: new Date(closed.opened_at).toISOString(),
        closed_at: new Date(closed.closed_at).toISOString(),
        notes: closed.notes,
      },
      variance_exceeds_threshold: Math.abs(variance) > VARIANCE_WARNING_THRESHOLD,
    });
  } catch (err) {
    console.error('Cashier shift close error:', err);
    return res.status(500).json({ error: 'Gagal menutup shift kasir' });
  }
});

// POST /:id/cash-drop — record a cash withdrawal during shift.
router.post('/:id/cash-drop', authenticateToken, async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id, 10);
    if (isNaN(shiftId)) {
      return res.status(400).json({ error: 'ID shift tidak valid' });
    }

    const { amount, reason } = req.body || {};
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount harus angka > 0' });
    }

    // Verify shift is open.
    const { rows: shiftRows } = await query(
      `SELECT id, status FROM cashier_shifts
       WHERE id = $1 AND tenant_id = $2`,
      [shiftId, req.tenantId],
    );

    if (shiftRows.length === 0) {
      return res.status(404).json({ error: 'Shift tidak ditemukan' });
    }
    if (shiftRows[0].status !== 'open') {
      return res.status(409).json({
        error: 'Shift sudah ditutup, tidak bisa menambah kas keluar.',
        code: 'SHIFT_NOT_OPEN',
      });
    }

    const { rows } = await query(
      `INSERT INTO cashier_shift_cash_movements
         (tenant_id, cashier_shift_id, user_id, type, amount, reason)
       VALUES ($1, $2, $3, 'drop', $4, $5)
       RETURNING id, cashier_shift_id, type, amount, reason, created_at`,
      [req.tenantId, shiftId, req.user.id, Math.round(amount), reason || null],
    );

    return res.status(201).json({ movement: rows[0] });
  } catch (err) {
    console.error('Cash drop error:', err);
    return res.status(500).json({ error: 'Gagal mencatat kas keluar' });
  }
});

// POST /:id/cash-pickup — record a cash deposit during shift.
router.post('/:id/cash-pickup', authenticateToken, async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id, 10);
    if (isNaN(shiftId)) {
      return res.status(400).json({ error: 'ID shift tidak valid' });
    }

    const { amount, reason } = req.body || {};
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount harus angka > 0' });
    }

    // Verify shift is open.
    const { rows: shiftRows } = await query(
      `SELECT id, status FROM cashier_shifts
       WHERE id = $1 AND tenant_id = $2`,
      [shiftId, req.tenantId],
    );

    if (shiftRows.length === 0) {
      return res.status(404).json({ error: 'Shift tidak ditemukan' });
    }
    if (shiftRows[0].status !== 'open') {
      return res.status(409).json({
        error: 'Shift sudah ditutup, tidak bisa menambah kas masuk.',
        code: 'SHIFT_NOT_OPEN',
      });
    }

    const { rows } = await query(
      `INSERT INTO cashier_shift_cash_movements
         (tenant_id, cashier_shift_id, user_id, type, amount, reason)
       VALUES ($1, $2, $3, 'pickup', $4, $5)
       RETURNING id, cashier_shift_id, type, amount, reason, created_at`,
      [req.tenantId, shiftId, req.user.id, Math.round(amount), reason || null],
    );

    return res.status(201).json({ movement: rows[0] });
  } catch (err) {
    console.error('Cash pickup error:', err);
    return res.status(500).json({ error: 'Gagal mencatat kas masuk' });
  }
});

module.exports = router;
