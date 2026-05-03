const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ReceiptCreateSchema } = require('@vipos/shared');
const { generateNumber } = require('../utils/b2b-helpers');
const { recalcInvoiceStatus } = require('./invoice');

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  const db = getDb();
  const { invoice_id, customer_id } = req.query;
  const where = [];
  const params = [];
  if (invoice_id) {
    where.push('invoice_id = ?');
    params.push(Number(invoice_id));
  }
  if (customer_id) {
    where.push('customer_id = ?');
    params.push(Number(customer_id));
  }
  const sql = `SELECT * FROM b2b_receipts${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM b2b_receipts WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: ReceiptCreateSchema }), (req, res) => {
  const db = getDb();
  const body = req.body;
  const inv = db.prepare('SELECT * FROM b2b_invoices WHERE id = ?').get(body.invoice_id);
  if (!inv) return res.status(400).json({ error: 'Invoice tidak ditemukan' });
  if (inv.status === 'VOID') {
    return res.status(400).json({ error: 'Invoice VOID tidak dapat menerima pembayaran' });
  }
  const number = generateNumber(db, 'b2b_receipts', body.payment_date);

  const tx = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO b2b_receipts
          (number, invoice_id, customer_id, payment_date, method, amount,
           bank_account_id, ref_number, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        number,
        body.invoice_id,
        inv.customer_id,
        body.payment_date,
        body.method ?? 'cash',
        body.amount,
        body.bank_account_id ?? null,
        body.ref_number ?? null,
        body.notes ?? null,
        req.user?.id ?? null
      );
    return r.lastInsertRowid;
  });
  const id = tx();
  recalcInvoiceStatus(db, body.invoice_id);
  res.status(201).json(db.prepare('SELECT * FROM b2b_receipts WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM b2b_receipts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM b2b_receipts WHERE id = ?').run(id);
  recalcInvoiceStatus(db, existing.invoice_id);
  res.json({ success: true });
});

module.exports = router;
