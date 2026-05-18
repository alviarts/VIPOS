const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ReceiptCreateSchema } = require('@vipos/shared');
const { generateNumber } = require('../utils/b2b-helpers');
const { recalcInvoiceStatus } = require('./invoice');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  const { invoice_id, customer_id } = req.query;
  const where = [];
  const params = [];
  let p = 1;
  if (invoice_id) {
    where.push(`invoice_id = $${p++}`);
    params.push(Number(invoice_id));
  }
  if (customer_id) {
    where.push(`customer_id = $${p++}`);
    params.push(Number(customer_id));
  }
  const sql = `SELECT * FROM b2b_receipts${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json((await query(sql, params)).rows);
});

router.get('/:id', async (req, res) => {
  const row = (await query('SELECT * FROM b2b_receipts WHERE id = $1', [Number(req.params.id)]))
    .rows[0];
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: ReceiptCreateSchema }), async (req, res) => {
  const body = req.body;
  const inv = (await query('SELECT * FROM b2b_invoices WHERE id = $1', [body.invoice_id])).rows[0];
  if (!inv) return res.status(400).json({ error: 'Invoice tidak ditemukan' });
  if (inv.status === 'VOID') {
    return res.status(400).json({ error: 'Invoice VOID tidak dapat menerima pembayaran' });
  }

  const id = await tx(async (txQuery) => {
    const number = await generateNumber(txQuery, 'b2b_receipts', body.payment_date);
    const ins = await txQuery(
      `INSERT INTO b2b_receipts
          (number, invoice_id, customer_id, payment_date, method, amount,
           bank_account_id, ref_number, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        number,
        body.invoice_id,
        inv.customer_id,
        body.payment_date,
        body.method ?? 'cash',
        body.amount,
        body.bank_account_id ?? null,
        body.ref_number ?? null,
        body.notes ?? null,
        req.user?.id ?? null,
      ]
    );
    return ins.rows[0].id;
  });
  await recalcInvoiceStatus(query, body.invoice_id);
  const row = (await query('SELECT * FROM b2b_receipts WHERE id = $1', [id])).rows[0];
  res.status(201).json(row);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = (await query('SELECT * FROM b2b_receipts WHERE id = $1', [id])).rows[0];
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await query('DELETE FROM b2b_receipts WHERE id = $1', [id]);
  await recalcInvoiceStatus(query, existing.invoice_id);
  res.json({ success: true });
});

module.exports = router;
