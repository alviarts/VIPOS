const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { InvoiceCreateSchema, InvoiceUpdateSchema } = require('@vipos/shared');
const { generateNumber, recomputeTotals } = require('../utils/b2b-helpers');

const router = express.Router();
router.use(authenticateToken);

function loadFull(db, id) {
  const row = db.prepare('SELECT * FROM b2b_invoices WHERE id = ?').get(id);
  if (!row) return null;
  row.items = db
    .prepare('SELECT * FROM b2b_invoice_items WHERE invoice_id = ? ORDER BY id ASC')
    .all(id);
  return row;
}

function recalcInvoiceStatus(db, id) {
  const inv = db.prepare('SELECT * FROM b2b_invoices WHERE id = ?').get(id);
  if (!inv) return null;
  const paidAgg = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM b2b_receipts WHERE invoice_id = ?')
    .get(id);
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
  db.prepare(
    'UPDATE b2b_invoices SET paid_amount = ?, outstanding = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(paid, outstanding, status, id);
  return loadFull(db, id);
}

router.get('/', (req, res) => {
  const db = getDb();
  const { status, customer_id, q } = req.query;
  // Recompute OVERDUE on read for any non-paid invoice with due_date elapsed.
  db.prepare(
    `UPDATE b2b_invoices SET status = 'OVERDUE'
       WHERE status IN ('ISSUED', 'PARTIAL')
         AND due_date IS NOT NULL
         AND date(due_date) < date('now')
         AND outstanding > 0`
  ).run();
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (customer_id) {
    where.push('customer_id = ?');
    params.push(Number(customer_id));
  }
  if (q) {
    where.push('(number LIKE ? OR customer_name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const sql = `SELECT * FROM b2b_invoices${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = loadFull(getDb(), Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: InvoiceCreateSchema }), (req, res) => {
  const db = getDb();
  const body = req.body;
  const computed = recomputeTotals({
    items: body.items,
    tax_percent: body.tax_percent,
    discount_amount: body.discount_amount,
  });
  const number = generateNumber(db, 'b2b_invoices', body.invoice_date);
  const downPayment = Number(body.down_payment) || 0;
  const outstanding = Math.max(computed.total - downPayment, 0);

  const tx = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO b2b_invoices
          (number, sales_order_id, customer_id, customer_name, invoice_date, due_date,
           status, subtotal, tax_percent, tax_amount, discount_amount, total,
           down_payment, paid_amount, outstanding, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        req.user?.id ?? null
      );
    const invid = r.lastInsertRowid;
    const insItem = db.prepare(
      `INSERT INTO b2b_invoice_items
        (invoice_id, sales_order_item_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const it of computed.items) {
      insItem.run(
        invid,
        it.sales_order_item_id ?? null,
        it.product_id ?? null,
        it.product_name,
        it.qty,
        it.unit_price,
        it.discount_percent ?? 0,
        it.subtotal
      );
    }
    return invid;
  });
  const id = tx();
  res.status(201).json(recalcInvoiceStatus(db, id));
});

router.put('/:id', validate({ body: InvoiceUpdateSchema }), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = loadFull(db, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const items = body.items || existing.items;
  const tax_percent = body.tax_percent ?? existing.tax_percent;
  const discount_amount = body.discount_amount ?? existing.discount_amount;
  const computed = recomputeTotals({ items, tax_percent, discount_amount });
  const downPayment = body.down_payment ?? existing.down_payment;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE b2b_invoices SET
         invoice_date = ?, due_date = ?, status = ?,
         subtotal = ?, tax_percent = ?, tax_amount = ?,
         discount_amount = ?, total = ?, down_payment = ?,
         notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
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
      id
    );
    if (body.items) {
      db.prepare('DELETE FROM b2b_invoice_items WHERE invoice_id = ?').run(id);
      const insItem = db.prepare(
        `INSERT INTO b2b_invoice_items
          (invoice_id, sales_order_item_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const it of computed.items) {
        insItem.run(
          id,
          it.sales_order_item_id ?? null,
          it.product_id ?? null,
          it.product_name,
          it.qty,
          it.unit_price,
          it.discount_percent ?? 0,
          it.subtotal
        );
      }
    }
  });
  tx();
  res.json(recalcInvoiceStatus(db, id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  // Soft-void: mark as VOID; preserve history. Hard delete only if no receipts.
  const r = db.prepare('SELECT id FROM b2b_invoices WHERE id = ?').get(id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const hasReceipts = db
    .prepare('SELECT COUNT(*) AS n FROM b2b_receipts WHERE invoice_id = ?')
    .get(id);
  if (hasReceipts.n > 0) {
    db.prepare(
      "UPDATE b2b_invoices SET status = 'VOID', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(id);
    return res.json({ success: true, voided: true });
  }
  db.prepare('DELETE FROM b2b_invoices WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
module.exports.recalcInvoiceStatus = recalcInvoiceStatus;
