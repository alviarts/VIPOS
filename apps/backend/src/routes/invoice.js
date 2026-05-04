const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { InvoiceCreateSchema, InvoiceUpdateSchema } = require('@vipos/shared');
const { generateNumber, recomputeTotals } = require('../utils/b2b-helpers');

const router = express.Router();
router.use(authenticateToken);

async function loadFull(q, id) {
  const row = (await q('SELECT * FROM b2b_invoices WHERE id = $1', [id])).rows[0];
  if (!row) return null;
  row.items = (
    await q('SELECT * FROM b2b_invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [id])
  ).rows;
  return row;
}

async function recalcInvoiceStatus(q, id) {
  const inv = (await q('SELECT * FROM b2b_invoices WHERE id = $1', [id])).rows[0];
  if (!inv) return null;
  const paidAgg = (
    await q('SELECT COALESCE(SUM(amount), 0) AS total FROM b2b_receipts WHERE invoice_id = $1', [
      id,
    ])
  ).rows[0];
  const paid = (Number(paidAgg.total) || 0) + (Number(inv.down_payment) || 0);
  const outstanding = Math.max((Number(inv.total) || 0) - paid, 0);
  let status = inv.status;
  if (status === 'VOID') {
    // never overwrite VOID
  } else if (paid <= 0) status = 'ISSUED';
  else if (outstanding <= 0.0001) status = 'PAID';
  else status = 'PARTIAL';
  if (status !== 'PAID' && status !== 'VOID' && inv.due_date) {
    const due = new Date(inv.due_date);
    const today = new Date(new Date().toISOString().slice(0, 10));
    if (due < today && outstanding > 0) status = 'OVERDUE';
  }
  await q(
    'UPDATE b2b_invoices SET paid_amount = $1, outstanding = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
    [paid, outstanding, status, id]
  );
  return loadFull(q, id);
}

router.get('/', async (req, res) => {
  const { status, customer_id, q } = req.query;
  // Recompute OVERDUE on read for any non-paid invoice with due_date elapsed.
  await query(
    `UPDATE b2b_invoices SET status = 'OVERDUE'
       WHERE status IN ('ISSUED', 'PARTIAL')
         AND due_date IS NOT NULL
         AND date(due_date) < date('now')
         AND outstanding > 0`
  );
  const where = [];
  const params = [];
  let p = 1;
  if (status) {
    where.push(`status = $${p++}`);
    params.push(status);
  }
  if (customer_id) {
    where.push(`customer_id = $${p++}`);
    params.push(Number(customer_id));
  }
  if (q) {
    where.push(`(number LIKE $${p} OR customer_name LIKE $${p + 1})`);
    params.push(`%${q}%`, `%${q}%`);
    p += 2;
  }
  const sql = `SELECT * FROM b2b_invoices${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json((await query(sql, params)).rows);
});

router.get('/:id', async (req, res) => {
  const row = await loadFull(query, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: InvoiceCreateSchema }), async (req, res) => {
  const body = req.body;
  const computed = recomputeTotals({
    items: body.items,
    tax_percent: body.tax_percent,
    discount_amount: body.discount_amount,
  });
  const downPayment = Number(body.down_payment) || 0;
  const outstanding = Math.max(computed.total - downPayment, 0);

  const id = await tx(async (txQuery) => {
    const number = await generateNumber(txQuery, 'b2b_invoices', body.invoice_date);
    const ins = await txQuery(
      `INSERT INTO b2b_invoices
          (number, sales_order_id, customer_id, customer_name, invoice_date, due_date,
           status, subtotal, tax_percent, tax_amount, discount_amount, total,
           down_payment, paid_amount, outstanding, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
      [
        number,
        body.sales_order_id ?? null,
        body.customer_id ?? null,
        body.customer_name,
        body.invoice_date,
        body.due_date ?? null,
        body.status ?? (outstanding <= 0.0001 ? 'PAID' : 'ISSUED'),
        computed.subtotal,
        body.tax_percent ?? 0,
        computed.tax_amount,
        body.discount_amount ?? 0,
        computed.total,
        downPayment,
        downPayment,
        outstanding,
        body.notes ?? null,
        req.user?.id ?? null,
      ]
    );
    const invid = ins.rows[0].id;
    for (const it of computed.items) {
      await txQuery(
        `INSERT INTO b2b_invoice_items
          (invoice_id, sales_order_item_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          invid,
          it.sales_order_item_id ?? null,
          it.product_id ?? null,
          it.product_name,
          it.qty,
          it.unit_price,
          it.discount_percent ?? 0,
          it.subtotal,
        ]
      );
    }
    return invid;
  });
  res.status(201).json(await recalcInvoiceStatus(query, id));
});

router.put('/:id', validate({ body: InvoiceUpdateSchema }), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await loadFull(query, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const items = body.items || existing.items;
  const tax_percent = body.tax_percent ?? existing.tax_percent;
  const discount_amount = body.discount_amount ?? existing.discount_amount;
  const computed = recomputeTotals({ items, tax_percent, discount_amount });
  const downPayment = body.down_payment ?? existing.down_payment;

  await tx(async (txQuery) => {
    await txQuery(
      `UPDATE b2b_invoices SET
         invoice_date = $1, due_date = $2, status = $3,
         subtotal = $4, tax_percent = $5, tax_amount = $6,
         discount_amount = $7, total = $8, down_payment = $9,
         notes = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11`,
      [
        body.invoice_date ?? existing.invoice_date,
        body.due_date ?? existing.due_date,
        body.status ?? existing.status,
        computed.subtotal,
        tax_percent,
        computed.tax_amount,
        discount_amount,
        computed.total,
        downPayment,
        body.notes ?? existing.notes,
        id,
      ]
    );
    if (body.items) {
      await txQuery('DELETE FROM b2b_invoice_items WHERE invoice_id = $1', [id]);
      for (const it of computed.items) {
        await txQuery(
          `INSERT INTO b2b_invoice_items
            (invoice_id, sales_order_item_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            id,
            it.sales_order_item_id ?? null,
            it.product_id ?? null,
            it.product_name,
            it.qty,
            it.unit_price,
            it.discount_percent ?? 0,
            it.subtotal,
          ]
        );
      }
    }
  });
  res.json(await recalcInvoiceStatus(query, id));
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  // Soft-void: mark as VOID; preserve history. Hard delete only if no receipts.
  const r = (await query('SELECT id FROM b2b_invoices WHERE id = $1', [id])).rows[0];
  if (!r) return res.status(404).json({ error: 'Not found' });
  const hasReceipts = (
    await query('SELECT COUNT(*) AS n FROM b2b_receipts WHERE invoice_id = $1', [id])
  ).rows[0];
  if (Number(hasReceipts.n) > 0) {
    await query(
      "UPDATE b2b_invoices SET status = 'VOID', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );
    return res.json({ success: true, voided: true });
  }
  await query('DELETE FROM b2b_invoices WHERE id = $1', [id]);
  res.json({ success: true });
});

module.exports = router;
module.exports.recalcInvoiceStatus = recalcInvoiceStatus;
