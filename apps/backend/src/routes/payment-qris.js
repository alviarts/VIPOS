// VIPOS — QRIS Dynamic stub endpoints (per docs/v2/14_PAYMENT_METHODS.md §6).
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
//   Pure in-memory `Map<ref_id, record>` keyed by `ref_id`. The records
//   carry `tenant_id` so cross-tenant lookups always 404. This is a
//   deliberate stub — real implementation will land an `qris_dynamic_invocations`
//   table once the upstream gateway integration spec firms up. The
//   in-memory store is perfectly adequate for unblocking Android slice 5
//   (`docs/handoff/2026-05-07-p3-08-fourth-slice-checkout-ui.md` §next-up)
//   because the Android client polls every 2-3s within a single browser
//   session — no cross-process / cross-restart durability required for
//   the stub.
//
// Auto-expiration:
//   On every status read we lazily transition AWAITING → EXPIRED if
//   `now > expires_at`. This avoids a background sweeper at the cost
//   of mutating state inside a GET, which is a documented trade-off
//   for stubs and is invisible to callers.
//
// Risk: yellow (new endpoints, stub-only, no real money flow, but
// touching the production HTTP surface so a buggy mount could 500
// the v1 API). Rollback: revert the commit + redeploy.

const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// QRIS Dynamic invocations expire after 5 minutes per spec §6.7.
const EXPIRY_MS = 5 * 60 * 1000;

// In-memory store. Module-level so it survives across requests within
// a single process; tests reset it via the helper below.
const _store = new Map();

function _now() {
  return Date.now();
}

function _isExpired(record, now = _now()) {
  return now > new Date(record.expires_at).getTime();
}

function _maybeExpire(record) {
  if (record.status === 'AWAITING' && _isExpired(record)) {
    record.status = 'EXPIRED';
  }
  return record;
}

function _toResponseShape(record) {
  return {
    ref_id: record.ref_id,
    status: record.status,
    paid_at: record.paid_at,
    expires_at: record.expires_at,
    amount: record.amount,
    transaction_id: record.transaction_id,
  };
}

// Validate amount: must be a finite positive integer. Rupiah amounts
// don't carry decimals in any of the existing transaction routes
// (transactions.payment_amount is INTEGER), so we mirror that contract.
function _validateAmount(value) {
  if (typeof value !== 'number') return 'amount harus berupa angka';
  if (!Number.isFinite(value)) return 'amount harus berupa angka berhingga';
  if (!Number.isInteger(value)) return 'amount harus bilangan bulat';
  if (value <= 0) return 'amount harus lebih besar dari 0';
  return null;
}

// transaction_id is optional. When supplied it must be a positive int,
// because callers can mint a QR before the transaction is committed
// (Android flow) and link the two later via the `transaction_id`
// stamped on the polling response.
function _validateTransactionId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return 'transaction_id harus bilangan bulat positif jika disertakan';
  }
  return null;
}

// POST /dynamic — mint a fresh QRIS Dynamic invocation.
router.post('/dynamic', authenticateToken, (req, res) => {
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
  const now = _now();
  const expiresAt = new Date(now + EXPIRY_MS).toISOString();

  // Stub QR payload. The real gateway returns a base64-encoded PNG; we
  // emit a stable placeholder URL keyed off ref_id so the Android UI
  // can render *something* during stub-mode integration testing.
  const qrCodeUrl = `https://stub.qris.local/qr/${encodeURIComponent(refId)}.png`;
  const pollingUrl = `/api/v1/payment/qris/${encodeURIComponent(refId)}/status`;

  const record = {
    ref_id: refId,
    tenant_id: req.tenantId ?? null,
    user_id: req.user?.id ?? null,
    amount,
    transaction_id: transaction_id ?? null,
    status: 'AWAITING',
    paid_at: null,
    expires_at: expiresAt,
    qr_code_url: qrCodeUrl,
    polling_url: pollingUrl,
    created_at: new Date(now).toISOString(),
  };

  _store.set(refId, record);

  return res.status(201).json({
    ref_id: record.ref_id,
    qr_code_url: record.qr_code_url,
    polling_url: record.polling_url,
    status: record.status,
    expires_at: record.expires_at,
    amount: record.amount,
    transaction_id: record.transaction_id,
  });
});

// GET /:ref_id/status — poll the current state of a minted invocation.
router.get('/:ref_id/status', authenticateToken, (req, res) => {
  const record = _store.get(req.params.ref_id);

  // 404 for unknown ref_id AND cross-tenant lookups. We deliberately
  // do not 403 cross-tenant — that would leak ref_id existence to a
  // probing tenant.
  if (!record || record.tenant_id !== (req.tenantId ?? null)) {
    return res.status(404).json({ error: 'QRIS ref_id tidak ditemukan' });
  }

  _maybeExpire(record);
  return res.status(200).json(_toResponseShape(record));
});

// POST /:ref_id/_test/mark-paid — test-only backdoor.
router.post('/:ref_id/_test/mark-paid', authenticateToken, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test backdoor dinonaktifkan di production' });
  }

  const record = _store.get(req.params.ref_id);
  if (!record || record.tenant_id !== (req.tenantId ?? null)) {
    return res.status(404).json({ error: 'QRIS ref_id tidak ditemukan' });
  }

  // Lazy expiry runs first so a record that's already past its window
  // can't be flipped to PAID — that would mask real-world races.
  _maybeExpire(record);
  if (record.status === 'EXPIRED') {
    return res.status(409).json({
      error: 'QRIS sudah kedaluwarsa, tidak bisa ditandai PAID',
      ..._toResponseShape(record),
    });
  }
  if (record.status !== 'PAID') {
    record.status = 'PAID';
    record.paid_at = new Date(_now()).toISOString();
  }
  return res.status(200).json(_toResponseShape(record));
});

module.exports = router;
// Test helper — wipes the in-memory store so suites that exercise the
// stub don't leak state across files. Not exposed via HTTP.
module.exports._resetStoreForTests = function _resetStoreForTests() {
  _store.clear();
};
