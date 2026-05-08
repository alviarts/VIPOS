// VIPOS — QRIS Dynamic endpoints (per docs/v2/14_PAYMENT_METHODS.md §6).
//
// Surface:
//   POST /api/v1/payment/qris/dynamic
//     body: { transaction_id?: number|null, amount: number }
//     201:  { ref_id, qr_code_url, expires_at, polling_url, status, amount, transaction_id }
//
//   GET /api/v1/payment/qris/:ref_id/status
//     200:  { ref_id, status, paid_at|null, expires_at, amount, transaction_id }
//     404:  unknown ref_id (also returned for cross-tenant lookups so a
//           tenant can't probe another tenant's ref-id namespace).
//
//   POST /api/v1/payment/qris/:ref_id/_test/mark-paid
//     Test-only backdoor; gated on NODE_ENV !== 'production'. Used by
//     integration tests (and the Android app's stub mode) to flip an
//     AWAITING invocation to PAID without a real gateway webhook.
//     200:  { ref_id, status: 'PAID', paid_at, ... }
//     403:  in production (NODE_ENV === 'production')
//     404:  unknown ref_id
//     409:  already EXPIRED — terminal state, can't be flipped.
//
// State:
//   Backed by the `qris_dynamic_invocations` Postgres table (P3-08
//   slice 5c follow-up). Records are tenant-scoped via RLS and survive
//   process restarts / PM2 cluster worker rotation. The lazy expiry
//   pattern is preserved: on every status read we UPDATE AWAITING →
//   EXPIRED if `now > expires_at`.
//
// Risk: yellow (additive schema change, no real money flow, but
// touching the production HTTP surface + DB). Rollback: revert the
// commit + redeploy; the table can be dropped separately.

const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

// QRIS Dynamic invocations expire after 5 minutes per spec §6.7.
const EXPIRY_MS = 5 * 60 * 1000;

function _toResponseShape(row) {
  return {
    ref_id: row.ref_id,
    status: row.status,
    paid_at: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    expires_at: new Date(row.expires_at).toISOString(),
    amount: Number(row.amount),
    transaction_id: row.transaction_id,
  };
}

// Validate amount: must be a finite positive integer.
function _validateAmount(value) {
  if (typeof value !== 'number') return 'amount harus berupa angka';
  if (!Number.isFinite(value)) return 'amount harus berupa angka berhingga';
  if (!Number.isInteger(value)) return 'amount harus bilangan bulat';
  if (value <= 0) return 'amount harus lebih besar dari 0';
  return null;
}

// transaction_id is optional. When supplied it must be a positive int.
function _validateTransactionId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return 'transaction_id harus bilangan bulat positif jika disertakan';
  }
  return null;
}

// POST /dynamic — mint a fresh QRIS Dynamic invocation.
router.post('/dynamic', authenticateToken, async (req, res) => {
  try {
    const { amount, transaction_id } = req.body || {};

    const amountErr = _validateAmount(amount);
    if (amountErr) {
      return res.status(400).json({ error: amountErr });
    }
    const txErr = _validateTransactionId(transaction_id);
    if (txErr) {
      return res.status(400).json({ error: txErr });
    }

    const refId = `QR-${crypto.randomUUID()}`;
    const now = Date.now();
    const expiresAt = new Date(now + EXPIRY_MS).toISOString();

    // Stub QR payload. The real gateway returns a base64-encoded PNG; we
    // emit a stable placeholder URL keyed off ref_id so the Android UI
    // can render *something* during stub-mode integration testing.
    const qrCodeUrl = `https://stub.qris.local/qr/${encodeURIComponent(refId)}.png`;
    const pollingUrl = `/api/v1/payment/qris/${encodeURIComponent(refId)}/status`;

    const { rows } = await query(
      `INSERT INTO qris_dynamic_invocations
         (ref_id, tenant_id, user_id, amount, transaction_id, status,
          qr_code_url, polling_url, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, 'AWAITING', $6, $7, $8, NOW())
       RETURNING ref_id, status, paid_at, expires_at, amount,
                 transaction_id, qr_code_url, polling_url`,
      [
        refId,
        req.tenantId ?? null,
        req.user?.id ?? null,
        amount,
        transaction_id ?? null,
        qrCodeUrl,
        pollingUrl,
        expiresAt,
      ],
    );

    const record = rows[0];
    return res.status(201).json({
      ref_id: record.ref_id,
      qr_code_url: record.qr_code_url,
      polling_url: record.polling_url,
      status: record.status,
      expires_at: new Date(record.expires_at).toISOString(),
      amount: Number(record.amount),
      transaction_id: record.transaction_id,
    });
  } catch (err) {
    console.error('QRIS mint error:', err);
    return res.status(500).json({ error: 'Gagal membuat QRIS invocation' });
  }
});

// GET /:ref_id/status — poll the current state of a minted invocation.
router.get('/:ref_id/status', authenticateToken, async (req, res) => {
  try {
    // Lazy expiry: atomically flip AWAITING → EXPIRED if past window,
    // then read the current state. Uses JavaScript Date.now() for the
    // comparison timestamp so tests can mock time via Date.now override.
    const nowIso = new Date(Date.now()).toISOString();
    const { rows } = await query(
      `WITH maybe_expire AS (
         UPDATE qris_dynamic_invocations
         SET status = 'EXPIRED'
         WHERE ref_id = $1
           AND tenant_id = $2
           AND status = 'AWAITING'
           AND expires_at < $3::timestamptz
         RETURNING ref_id
       )
       SELECT ref_id, status, paid_at, expires_at, amount, transaction_id
       FROM qris_dynamic_invocations
       WHERE ref_id = $1 AND tenant_id = $2`,
      [req.params.ref_id, req.tenantId ?? null, nowIso],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'QRIS ref_id tidak ditemukan' });
    }

    return res.status(200).json(_toResponseShape(rows[0]));
  } catch (err) {
    console.error('QRIS poll error:', err);
    return res.status(500).json({ error: 'Gagal membaca status QRIS' });
  }
});

// POST /:ref_id/_test/mark-paid — test-only backdoor.
router.post('/:ref_id/_test/mark-paid', authenticateToken, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test backdoor dinonaktifkan di production' });
  }

  try {
    // Lazy expiry first — same pattern as the poll endpoint.
    const nowIso = new Date(Date.now()).toISOString();
    await query(
      `UPDATE qris_dynamic_invocations
       SET status = 'EXPIRED'
       WHERE ref_id = $1
         AND tenant_id = $2
         AND status = 'AWAITING'
         AND expires_at < $3::timestamptz`,
      [req.params.ref_id, req.tenantId ?? null, nowIso],
    );

    // Read current state after potential expiry.
    const { rows: readRows } = await query(
      `SELECT ref_id, status, paid_at, expires_at, amount, transaction_id
       FROM qris_dynamic_invocations
       WHERE ref_id = $1 AND tenant_id = $2`,
      [req.params.ref_id, req.tenantId ?? null],
    );

    if (readRows.length === 0) {
      return res.status(404).json({ error: 'QRIS ref_id tidak ditemukan' });
    }

    const record = readRows[0];

    if (record.status === 'EXPIRED') {
      return res.status(409).json({
        error: 'QRIS sudah kedaluwarsa, tidak bisa ditandai PAID',
        ..._toResponseShape(record),
      });
    }

    if (record.status !== 'PAID') {
      const { rows: updatedRows } = await query(
        `UPDATE qris_dynamic_invocations
         SET status = 'PAID', paid_at = NOW()
         WHERE ref_id = $1 AND tenant_id = $2
         RETURNING ref_id, status, paid_at, expires_at, amount, transaction_id`,
        [req.params.ref_id, req.tenantId ?? null],
      );
      return res.status(200).json(_toResponseShape(updatedRows[0]));
    }

    return res.status(200).json(_toResponseShape(record));
  } catch (err) {
    console.error('QRIS mark-paid error:', err);
    return res.status(500).json({ error: 'Gagal menandai QRIS sebagai PAID' });
  }
});

module.exports = router;

// Test helper — truncates the DB table so suites that exercise the
// endpoints don't leak state across files. Not exposed via HTTP.
module.exports._resetStoreForTests = async function _resetStoreForTests() {
  await query('DELETE FROM qris_dynamic_invocations');
};
