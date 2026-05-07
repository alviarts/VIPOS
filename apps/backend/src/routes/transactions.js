const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { safeLogAudit, ACTIONS } = require('../lib/audit');
const { isKnownPaymentMethodCode, listKnownPaymentMethodCodes } = require('../lib/payment-methods');

const router = express.Router();

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `INV${y}${m}${d}${h}${min}${s}${rand}`;
}

// Create transaction
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { items, payment_amount, payment_method, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Minimal satu produk harus dipilih' });
    }

    if (payment_method !== undefined && !isKnownPaymentMethodCode(payment_method)) {
      return res.status(400).json({
        error: 'Metode pembayaran tidak dikenali',
        allowed: listKnownPaymentMethodCodes(),
      });
    }

    const total_amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (payment_amount < total_amount) {
      return res.status(400).json({ error: 'Pembayaran kurang dari total belanja' });
    }

    const change_amount = payment_amount - total_amount;
    const invoice_number = generateInvoiceNumber();

    const transactionId = await tx(async (txQuery) => {
      const ins = await txQuery(
        `INSERT INTO transactions (invoice_number, user_id, total_amount, payment_amount, change_amount, payment_method, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          invoice_number,
          req.user.id,
          total_amount,
          payment_amount,
          change_amount,
          payment_method || 'cash',
          notes || null,
        ]
      );
      const newId = ins.rows[0].id;

      for (const item of items) {
        const product = (await txQuery('SELECT * FROM products WHERE id = $1', [item.product_id]))
          .rows[0];
        if (!product) {
          throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Stok ${product.name} tidak mencukupi (tersedia: ${product.stock})`);
        }

        await txQuery(
          `INSERT INTO transaction_items (transaction_id, product_id, product_name, price, quantity, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newId,
            item.product_id,
            product.name,
            item.price,
            item.quantity,
            item.price * item.quantity,
          ]
        );
        await txQuery('UPDATE products SET stock = stock - $1 WHERE id = $2', [
          item.quantity,
          item.product_id,
        ]);
      }

      return newId;
    });

    const transaction = (
      await query(
        `SELECT t.*, u.name as cashier_name
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         WHERE t.id = $1`,
        [transactionId]
      )
    ).rows[0];

    const transactionItems = (
      await query('SELECT * FROM transaction_items WHERE transaction_id = $1', [transactionId])
    ).rows;

    res.status(201).json({ ...transaction, items: transactionItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get transactions list
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { date, start_date, end_date, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let baseSelect = `
      SELECT t.*, u.name as cashier_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM transactions t';
    const conditions = [];
    const params = [];
    let p = 1;

    if (date) {
      conditions.push(`DATE(t.created_at) = $${p++}`);
      params.push(date);
    }

    if (start_date && end_date) {
      conditions.push(`DATE(t.created_at) BETWEEN $${p++} AND $${p++}`);
      params.push(start_date, end_date);
    }

    if (status) {
      conditions.push(`t.status = $${p++}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      const where = ' WHERE ' + conditions.join(' AND ');
      baseSelect += where;
      countQuery += where;
    }

    const totalRow = (await query(countQuery, params)).rows[0];
    const totalCount = Number(totalRow.total);

    baseSelect += ` ORDER BY t.created_at DESC LIMIT $${p} OFFSET $${p + 1}`;
    const transactions = (await query(baseSelect, [...params, parseInt(limit), parseInt(offset)]))
      .rows;

    res.json({
      data: transactions,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single transaction with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = (
      await query(
        `SELECT t.*, u.name as cashier_name
         FROM transactions t
         JOIN users u ON t.user_id = u.id
         WHERE t.id = $1`,
        [req.params.id]
      )
    ).rows[0];

    if (!transaction) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const items = (
      await query('SELECT * FROM transaction_items WHERE transaction_id = $1', [req.params.id])
    ).rows;
    res.json({ ...transaction, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Void transaction
router.post('/:id/void', authenticateToken, async (req, res) => {
  try {
    const transaction = (await query('SELECT * FROM transactions WHERE id = $1', [req.params.id]))
      .rows[0];

    if (!transaction) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    if (transaction.status === 'voided') {
      return res.status(400).json({ error: 'Transaksi sudah dibatalkan' });
    }

    const items = (
      await query('SELECT * FROM transaction_items WHERE transaction_id = $1', [req.params.id])
    ).rows;

    await tx(async (txQuery) => {
      await txQuery("UPDATE transactions SET status = 'voided' WHERE id = $1", [req.params.id]);
      for (const item of items) {
        await txQuery('UPDATE products SET stock = stock + $1 WHERE id = $2', [
          item.quantity,
          item.product_id,
        ]);
      }
    });

    const after = (await query('SELECT * FROM transactions WHERE id = $1', [req.params.id]))
      .rows[0];
    await safeLogAudit(req, {
      entity: 'transaction',
      entity_id: req.params.id,
      action: ACTIONS.VOID,
      before: { ...transaction, items },
      after,
    });

    res.json({ message: 'Transaksi berhasil dibatalkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
