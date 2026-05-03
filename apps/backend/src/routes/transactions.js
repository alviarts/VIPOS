const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

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
router.post('/', authenticateToken, (req, res) => {
  try {
    const { items, payment_amount, payment_method, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Minimal satu produk harus dipilih' });
    }

    const db = getDb();
    const total_amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (payment_amount < total_amount) {
      return res.status(400).json({ error: 'Pembayaran kurang dari total belanja' });
    }

    const change_amount = payment_amount - total_amount;
    const invoice_number = generateInvoiceNumber();

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (invoice_number, user_id, total_amount, payment_amount, change_amount, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO transaction_items (transaction_id, product_id, product_name, price, quantity, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    const transact = db.transaction(() => {
      const result = insertTransaction.run(
        invoice_number,
        req.user.id,
        total_amount,
        payment_amount,
        change_amount,
        payment_method || 'cash',
        notes || null
      );

      const transactionId = result.lastInsertRowid;

      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (!product) {
          throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Stok ${product.name} tidak mencukupi (tersedia: ${product.stock})`);
        }

        insertItem.run(
          transactionId,
          item.product_id,
          product.name,
          item.price,
          item.quantity,
          item.price * item.quantity
        );
        updateStock.run(item.quantity, item.product_id);
      }

      return transactionId;
    });

    const transactionId = transact();

    const transaction = db
      .prepare(
        `
      SELECT t.*, u.name as cashier_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `
      )
      .get(transactionId);

    const transactionItems = db
      .prepare('SELECT * FROM transaction_items WHERE transaction_id = ?')
      .all(transactionId);

    res.status(201).json({ ...transaction, items: transactionItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get transactions list
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { date, start_date, end_date, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT t.*, u.name as cashier_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM transactions t';
    const conditions = [];
    const params = [];

    if (date) {
      conditions.push('DATE(t.created_at) = ?');
      params.push(date);
    }

    if (start_date && end_date) {
      conditions.push('DATE(t.created_at) BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      const where = ' WHERE ' + conditions.join(' AND ');
      query += where;
      countQuery += where;
    }

    const totalResult = db.prepare(countQuery).get(...params);
    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';

    const transactions = db.prepare(query).all(...params, parseInt(limit), parseInt(offset));

    res.json({
      data: transactions,
      pagination: {
        total: totalResult.total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(totalResult.total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single transaction with items
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const transaction = db
      .prepare(
        `
      SELECT t.*, u.name as cashier_name
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `
      )
      .get(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    const items = db
      .prepare('SELECT * FROM transaction_items WHERE transaction_id = ?')
      .all(req.params.id);
    res.json({ ...transaction, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Void transaction
router.post('/:id/void', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    }

    if (transaction.status === 'voided') {
      return res.status(400).json({ error: 'Transaksi sudah dibatalkan' });
    }

    const items = db
      .prepare('SELECT * FROM transaction_items WHERE transaction_id = ?')
      .all(req.params.id);

    const voidTransaction = db.transaction(() => {
      db.prepare("UPDATE transactions SET status = 'voided' WHERE id = ?").run(req.params.id);
      for (const item of items) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(
          item.quantity,
          item.product_id
        );
      }
    });

    voidTransaction();
    res.json({ message: 'Transaksi berhasil dibatalkan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
