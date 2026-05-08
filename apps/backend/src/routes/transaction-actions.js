// VIPOS — Transaction actions: void, refund, reprint (P4-10).
//
// Surface:
//   POST /api/v1/transactions/:id/void
//     body: { reason: string, manager_pin?: string }
//     200:  { transaction: {...}, voided: true }
//     403:  manager PIN required but invalid
//     404:  transaction not found
//     409:  already voided
//
//   POST /api/v1/transactions/:id/refund
//     body: { items: [{product_id, quantity}], reason: string }
//     201:  { refund: {...} }
//     400:  invalid items or quantities
//     404:  transaction not found
//
//   GET /api/v1/transactions/:id/receipt
//     200:  { receipt: {...} } — full receipt data for reprint

const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /:id/void — void an entire transaction.
router.post('/:id/void', authenticateToken, async (req, res) => {
  try {
    const txId = parseInt(req.params.id, 10);
    if (isNaN(txId)) {
      return res.status(400).json({ error: 'ID transaksi tidak valid' });
    }

    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Alasan void harus diisi' });
    }

    // Get transaction
    const { rows: txRows } = await query(
      `SELECT id, status, invoice_number, total_amount
       FROM transactions
       WHERE id = $1 AND tenant_id = $2`,
      [txId, req.tenantId],
    );

    if (txRows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const transaction = txRows[0];
    if (transaction.status === 'voided') {
      return res.status(409).json({ error: 'Transaksi sudah di-void' });
    }

    // Void: update status + restore stock
    await tx(async (txQuery) => {
      await txQuery(
        `UPDATE transactions SET status = 'voided', notes = COALESCE(notes, '') || $1
         WHERE id = $2 AND tenant_id = $3`,
        [`\n[VOID] ${reason} — by ${req.user?.name || 'unknown'} at ${new Date().toISOString()}`, txId, req.tenantId],
      );

      // Restore stock for all items
      const { rows: items } = await txQuery(
        `SELECT product_id, quantity FROM transaction_items WHERE transaction_id = $1`,
        [txId],
      );
      for (const item of items) {
        await txQuery(
          `UPDATE products SET stock = stock + $1 WHERE id = $2`,
          [item.quantity, item.product_id],
        );
      }
    });

    return res.status(200).json({
      transaction: { id: txId, invoice_number: transaction.invoice_number, status: 'voided' },
      voided: true,
    });
  } catch (err) {
    console.error('Transaction void error:', err);
    return res.status(500).json({ error: 'Gagal melakukan void transaksi' });
  }
});

// POST /:id/refund — partial refund (specific items + quantities).
router.post('/:id/refund', authenticateToken, async (req, res) => {
  try {
    const txId = parseInt(req.params.id, 10);
    if (isNaN(txId)) {
      return res.status(400).json({ error: 'ID transaksi tidak valid' });
    }

    const { items, reason } = req.body || {};
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Minimal satu item harus dipilih untuk refund' });
    }
    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Alasan refund harus diisi' });
    }

    // Verify transaction exists
    const { rows: txRows } = await query(
      `SELECT id, status, invoice_number FROM transactions
       WHERE id = $1 AND tenant_id = $2`,
      [txId, req.tenantId],
    );

    if (txRows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    if (txRows[0].status === 'voided') {
      return res.status(409).json({ error: 'Tidak bisa refund transaksi yang sudah di-void' });
    }

    // Calculate refund amount + restore stock
    let refundTotal = 0;
    await tx(async (txQuery) => {
      for (const refundItem of items) {
        const { rows: origItems } = await txQuery(
          `SELECT product_id, price, quantity FROM transaction_items
           WHERE transaction_id = $1 AND product_id = $2`,
          [txId, refundItem.product_id],
        );

        if (origItems.length === 0) {
          throw new Error(`Produk ID ${refundItem.product_id} tidak ada di transaksi ini`);
        }

        const orig = origItems[0];
        const refundQty = Math.min(refundItem.quantity || 1, orig.quantity);
        refundTotal += orig.price * refundQty;

        // Restore stock
        await txQuery(
          `UPDATE products SET stock = stock + $1 WHERE id = $2`,
          [refundQty, refundItem.product_id],
        );
      }

      // Record refund note on the transaction
      await txQuery(
        `UPDATE transactions SET notes = COALESCE(notes, '') || $1
         WHERE id = $2`,
        [`\n[REFUND Rp ${refundTotal}] ${reason} — by ${req.user?.name || 'unknown'} at ${new Date().toISOString()}`, txId],
      );
    });

    return res.status(201).json({
      refund: {
        transaction_id: txId,
        refund_amount: refundTotal,
        items_refunded: items.length,
        reason,
      },
    });
  } catch (err) {
    console.error('Transaction refund error:', err);
    return res.status(500).json({ error: err.message || 'Gagal melakukan refund' });
  }
});

// GET /:id/receipt — get full receipt data for reprint.
router.get('/:id/receipt', authenticateToken, async (req, res) => {
  try {
    const txId = parseInt(req.params.id, 10);
    if (isNaN(txId)) {
      return res.status(400).json({ error: 'ID transaksi tidak valid' });
    }

    const { rows: txRows } = await query(
      `SELECT t.*, u.name as cashier_name
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [txId, req.tenantId],
    );

    if (txRows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const { rows: items } = await query(
      `SELECT product_id, product_name, price, quantity, subtotal
       FROM transaction_items WHERE transaction_id = $1`,
      [txId],
    );

    const transaction = txRows[0];
    return res.status(200).json({
      receipt: {
        id: transaction.id,
        invoice_number: transaction.invoice_number,
        cashier_name: transaction.cashier_name,
        total_amount: transaction.total_amount,
        payment_amount: transaction.payment_amount,
        change_amount: transaction.change_amount,
        payment_method: transaction.payment_method,
        status: transaction.status,
        created_at: transaction.created_at,
        items: items.map((i) => ({
          product_name: i.product_name,
          price: i.price,
          quantity: i.quantity,
          subtotal: i.subtotal,
        })),
      },
    });
  } catch (err) {
    console.error('Receipt fetch error:', err);
    return res.status(500).json({ error: 'Gagal mengambil data struk' });
  }
});

module.exports = router;
