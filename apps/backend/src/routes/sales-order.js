const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { SalesOrderCreateSchema, SalesOrderUpdateSchema } = require('@vipos/shared');
const { generateNumber, recomputeTotals } = require('../utils/b2b-helpers');

const router = express.Router();
router.use(authenticateToken);

async function loadFull(q, id) {
  const row = (await q('SELECT * FROM b2b_sales_orders WHERE id = $1', [id])).rows[0];
  if (!row) return null;
  row.items = (
    await q('SELECT * FROM b2b_sales_order_items WHERE sales_order_id = $1 ORDER BY id ASC', [id])
  ).rows;
  return row;
}

async function refreshFulfillmentStatus(q, id) {
  const items = (
    await q(
      'SELECT qty, qty_delivered, qty_invoiced FROM b2b_sales_order_items WHERE sales_order_id = $1',
      [id]
    )
  ).rows;
  if (!items.length) return;
  const allDelivered = items.every((i) => Number(i.qty_delivered) >= Number(i.qty));
  const anyDelivered = items.some((i) => Number(i.qty_delivered) > 0);
  let status = 'NEW';
  if (allDelivered) status = 'FULFILLED';
  else if (anyDelivered) status = 'PARTIAL';
  await q('UPDATE b2b_sales_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
    status,
    id,
  ]);
}

router.get('/', async (req, res) => {
  const { status, customer_id, q } = req.query;
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
  const sql = `SELECT * FROM b2b_sales_orders${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json((await query(sql, params)).rows);
});

router.get('/:id', async (req, res) => {
  const row = await loadFull(query, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: SalesOrderCreateSchema }), async (req, res) => {
  const body = req.body;
  const computed = recomputeTotals({
    items: body.items,
    tax_percent: body.tax_percent,
    discount_amount: body.discount_amount,
  });
  const id = await tx(async (txQuery) => {
    const number = await generateNumber(txQuery, 'b2b_sales_orders', body.order_date);
    const ins = await txQuery(
      `INSERT INTO b2b_sales_orders
          (number, quotation_id, customer_id, customer_name, order_date, expected_delivery,
           status, subtotal, tax_percent, tax_amount, discount_amount, total, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [
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
        req.user?.id ?? null,
      ]
    );
    const soid = ins.rows[0].id;
    for (const it of computed.items) {
      await txQuery(
        `INSERT INTO b2b_sales_order_items
          (sales_order_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          soid,
          it.product_id ?? null,
          it.product_name,
          it.qty,
          it.unit_price,
          it.discount_percent ?? 0,
          it.subtotal,
        ]
      );
    }
    return soid;
  });
  res.status(201).json(await loadFull(query, id));
});

router.put('/:id', validate({ body: SalesOrderUpdateSchema }), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await loadFull(query, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const items = body.items || existing.items;
  const tax_percent = body.tax_percent ?? existing.tax_percent;
  const discount_amount = body.discount_amount ?? existing.discount_amount;
  const computed = recomputeTotals({ items, tax_percent, discount_amount });

  await tx(async (txQuery) => {
    await txQuery(
      `UPDATE b2b_sales_orders SET
         customer_id = $1, customer_name = $2, order_date = $3, expected_delivery = $4,
         status = $5, subtotal = $6, tax_percent = $7, tax_amount = $8,
         discount_amount = $9, total = $10, notes = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12`,
      [
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
        id,
      ]
    );
    if (body.items) {
      await txQuery('DELETE FROM b2b_sales_order_items WHERE sales_order_id = $1', [id]);
      for (const it of computed.items) {
        await txQuery(
          `INSERT INTO b2b_sales_order_items
            (sales_order_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
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
  res.json(await loadFull(query, id));
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await query('DELETE FROM b2b_sales_orders WHERE id = $1', [id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

module.exports = router;
module.exports.refreshFulfillmentStatus = refreshFulfillmentStatus;
