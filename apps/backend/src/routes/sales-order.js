const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { SalesOrderCreateSchema, SalesOrderUpdateSchema } = require('@vipos/shared');
const { generateNumber, recomputeTotals } = require('../utils/b2b-helpers');

const router = express.Router();
router.use(authenticateToken);

function loadFull(db, id) {
  const row = db.prepare('SELECT * FROM b2b_sales_orders WHERE id = ?').get(id);
  if (!row) return null;
  row.items = db
    .prepare('SELECT * FROM b2b_sales_order_items WHERE sales_order_id = ? ORDER BY id ASC')
    .all(id);
  return row;
}

function refreshFulfillmentStatus(db, id) {
  const items = db
    .prepare(
      'SELECT qty, qty_delivered, qty_invoiced FROM b2b_sales_order_items WHERE sales_order_id = ?'
    )
    .all(id);
  if (!items.length) return;
  const allDelivered = items.every((i) => Number(i.qty_delivered) >= Number(i.qty));
  const anyDelivered = items.some((i) => Number(i.qty_delivered) > 0);
  let status = 'NEW';
  if (allDelivered) status = 'FULFILLED';
  else if (anyDelivered) status = 'PARTIAL';
  db.prepare(
    'UPDATE b2b_sales_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status, id);
}

router.get('/', (req, res) => {
  const db = getDb();
  const { status, customer_id, q } = req.query;
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
  const sql = `SELECT * FROM b2b_sales_orders${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = loadFull(getDb(), Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: SalesOrderCreateSchema }), (req, res) => {
  const db = getDb();
  const body = req.body;
  const computed = recomputeTotals({
    items: body.items,
    tax_percent: body.tax_percent,
    discount_amount: body.discount_amount,
  });
  const number = generateNumber(db, 'b2b_sales_orders', body.order_date);
  const tx = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO b2b_sales_orders
          (number, quotation_id, customer_id, customer_name, order_date, expected_delivery,
           status, subtotal, tax_percent, tax_amount, discount_amount, total, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        number,
        body.quotation_id ?? null,
        body.customer_id ?? null,
        body.customer_name,
        body.order_date,
        body.expected_delivery ?? null,
        body.status ?? 'NEW',
        computed.subtotal,
        body.tax_percent ?? 0,
        computed.tax_amount,
        body.discount_amount ?? 0,
        computed.total,
        body.notes ?? null,
        req.user?.id ?? null
      );
    const soid = r.lastInsertRowid;
    const insItem = db.prepare(
      `INSERT INTO b2b_sales_order_items
        (sales_order_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const it of computed.items) {
      insItem.run(
        soid,
        it.product_id ?? null,
        it.product_name,
        it.qty,
        it.unit_price,
        it.discount_percent ?? 0,
        it.subtotal
      );
    }
    return soid;
  });
  const id = tx();
  res.status(201).json(loadFull(db, id));
});

router.put('/:id', validate({ body: SalesOrderUpdateSchema }), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = loadFull(db, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const items = body.items || existing.items;
  const tax_percent = body.tax_percent ?? existing.tax_percent;
  const discount_amount = body.discount_amount ?? existing.discount_amount;
  const computed = recomputeTotals({ items, tax_percent, discount_amount });

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE b2b_sales_orders SET
         customer_id = ?, customer_name = ?, order_date = ?, expected_delivery = ?,
         status = ?, subtotal = ?, tax_percent = ?, tax_amount = ?,
         discount_amount = ?, total = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      body.customer_id ?? existing.customer_id,
      body.customer_name ?? existing.customer_name,
      body.order_date ?? existing.order_date,
      body.expected_delivery ?? existing.expected_delivery,
      body.status ?? existing.status,
      computed.subtotal,
      tax_percent,
      computed.tax_amount,
      discount_amount,
      computed.total,
      body.notes ?? existing.notes,
      id
    );
    if (body.items) {
      db.prepare('DELETE FROM b2b_sales_order_items WHERE sales_order_id = ?').run(id);
      const insItem = db.prepare(
        `INSERT INTO b2b_sales_order_items
          (sales_order_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const it of computed.items) {
        insItem.run(
          id,
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
  res.json(loadFull(db, id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const r = db.prepare('DELETE FROM b2b_sales_orders WHERE id = ?').run(id);
  if (!r.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

module.exports = router;
module.exports.refreshFulfillmentStatus = refreshFulfillmentStatus;
