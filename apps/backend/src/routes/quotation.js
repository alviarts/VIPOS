const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { QuotationCreateSchema, QuotationUpdateSchema } = require('@vipos/shared');
const { generateNumber, recomputeTotals } = require('../utils/b2b-helpers');

const router = express.Router();
router.use(authenticateToken);

async function loadFull(q, id) {
  const row = (await q('SELECT * FROM b2b_quotations WHERE id = $1', [id])).rows[0];
  if (!row) return null;
  row.items = (
    await q('SELECT * FROM b2b_quotation_items WHERE quotation_id = $1 ORDER BY id ASC', [id])
  ).rows;
  return row;
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
  const sql = `SELECT * FROM b2b_quotations${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json((await query(sql, params)).rows);
});

router.get('/:id', async (req, res) => {
  const row = await loadFull(query, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: QuotationCreateSchema }), async (req, res) => {
  const body = req.body;
  const computed = recomputeTotals({
    items: body.items,
    tax_percent: body.tax_percent,
    discount_amount: body.discount_amount,
  });
  const id = await tx(async (txQuery) => {
    const number = await generateNumber(txQuery, 'b2b_quotations', body.quote_date);
    const ins = await txQuery(
      `INSERT INTO b2b_quotations
        (number, customer_id, customer_name, quote_date, valid_until, status,
         subtotal, tax_percent, tax_amount, discount_amount, total, notes, terms, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [
        number,
        body.customer_id ?? null,
        body.customer_name,
        body.quote_date,
        body.valid_until ?? null,
        body.status ?? 'DRAFT',
        computed.subtotal,
        body.tax_percent ?? 0,
        computed.tax_amount,
        body.discount_amount ?? 0,
        computed.total,
        body.notes ?? null,
        body.terms ?? null,
        req.user?.id ?? null,
      ]
    );
    const qid = ins.rows[0].id;
    for (const it of computed.items) {
      await txQuery(
        `INSERT INTO b2b_quotation_items
          (quotation_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          qid,
          it.product_id ?? null,
          it.product_name,
          it.qty,
          it.unit_price,
          it.discount_percent ?? 0,
          it.subtotal,
        ]
      );
    }
    return qid;
  });
  res.status(201).json(await loadFull(query, id));
});

router.put('/:id', validate({ body: QuotationUpdateSchema }), async (req, res) => {
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
      `UPDATE b2b_quotations SET
         customer_id = $1, customer_name = $2, quote_date = $3, valid_until = $4,
         status = $5, subtotal = $6, tax_percent = $7, tax_amount = $8,
         discount_amount = $9, total = $10, notes = $11, terms = $12,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $13`,
      [
        body.customer_id ?? existing.customer_id,
        body.customer_name ?? existing.customer_name,
        body.quote_date ?? existing.quote_date,
        body.valid_until ?? existing.valid_until,
        body.status ?? existing.status,
        computed.subtotal,
        tax_percent,
        computed.tax_amount,
        discount_amount,
        computed.total,
        body.notes ?? existing.notes,
        body.terms ?? existing.terms,
        id,
      ]
    );
    if (body.items) {
      await txQuery('DELETE FROM b2b_quotation_items WHERE quotation_id = $1', [id]);
      for (const it of computed.items) {
        await txQuery(
          `INSERT INTO b2b_quotation_items
            (quotation_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
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
  const r = await query('DELETE FROM b2b_quotations WHERE id = $1', [id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

router.post('/:id/convert-to-so', async (req, res) => {
  const id = Number(req.params.id);
  const q = await loadFull(query, id);
  if (!q) return res.status(404).json({ error: 'Quotation not found' });
  if (q.converted_so_id) {
    return res.status(400).json({ error: 'Quotation sudah pernah di-convert' });
  }
  const soid = await tx(async (txQuery) => {
    const number = await generateNumber(
      txQuery,
      'b2b_sales_orders',
      new Date().toISOString().slice(0, 10)
    );
    const ins = await txQuery(
      `INSERT INTO b2b_sales_orders
          (number, quotation_id, customer_id, customer_name, order_date, expected_delivery,
           status, subtotal, tax_percent, tax_amount, discount_amount, total, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'NEW', $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        number,
        q.id,
        q.customer_id,
        q.customer_name,
        new Date().toISOString().slice(0, 10),
        q.valid_until,
        q.subtotal,
        q.tax_percent,
        q.tax_amount,
        q.discount_amount,
        q.total,
        q.notes,
        req.user?.id ?? null,
      ]
    );
    const newSoid = ins.rows[0].id;
    for (const it of q.items) {
      await txQuery(
        `INSERT INTO b2b_sales_order_items
          (sales_order_id, product_id, product_name, qty, unit_price, discount_percent, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newSoid,
          it.product_id,
          it.product_name,
          it.qty,
          it.unit_price,
          it.discount_percent ?? 0,
          it.subtotal,
        ]
      );
    }
    await txQuery(
      `UPDATE b2b_quotations SET converted_so_id = $1, status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newSoid, id]
    );
    return newSoid;
  });
  const so = (await query('SELECT * FROM b2b_sales_orders WHERE id = $1', [soid])).rows[0];
  so.items = (
    await query('SELECT * FROM b2b_sales_order_items WHERE sales_order_id = $1 ORDER BY id ASC', [
      soid,
    ])
  ).rows;
  res.status(201).json(so);
});

module.exports = router;
