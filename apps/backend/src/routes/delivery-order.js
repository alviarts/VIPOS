const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { DeliveryOrderCreateSchema, DeliveryOrderUpdateSchema } = require('@vipos/shared');
const { generateNumber } = require('../utils/b2b-helpers');
const { refreshFulfillmentStatus } = require('./sales-order');

const router = express.Router();
router.use(authenticateToken);

async function loadFull(q, id) {
  const row = (await q('SELECT * FROM b2b_delivery_orders WHERE id = $1', [id])).rows[0];
  if (!row) return null;
  row.items = (
    await q('SELECT * FROM b2b_delivery_order_items WHERE delivery_order_id = $1 ORDER BY id ASC', [
      id,
    ])
  ).rows;
  return row;
}

async function postStockMovements(q, doid, items, refDate, userId) {
  for (const it of items) {
    if (!it.product_id) continue;
    const before =
      (await q('SELECT stock FROM products WHERE id = $1', [it.product_id])).rows[0]?.stock ?? 0;
    const after = Number(before) - Number(it.qty);
    await q(
      `INSERT INTO inventory_movements
        (tanggal, product_id, tipe, qty, stok_sebelum, stok_sesudah, ref_type, ref_id, reason, keterangan, user_id)
       VALUES ($1, $2, 'stok_out', $3, $4, $5, 'B2B_DELIVERY', $6, 'b2b_delivery', $7, $8)`,
      [refDate, it.product_id, Number(it.qty), before, after, doid, `DO-${doid}`, userId ?? null]
    );
    await q('UPDATE products SET stock = stock - $1 WHERE id = $2', [
      Number(it.qty),
      it.product_id,
    ]);
  }
}

async function applyQtyDelivered(q, soid) {
  const aggregated = (
    await q(
      `SELECT soi.id AS so_item_id, COALESCE(SUM(doi.qty), 0) AS delivered
         FROM b2b_sales_order_items soi
         LEFT JOIN b2b_delivery_order_items doi ON doi.sales_order_item_id = soi.id
         LEFT JOIN b2b_delivery_orders dod ON dod.id = doi.delivery_order_id
        WHERE soi.sales_order_id = $1
          AND (dod.status IS NULL OR dod.status IN ('DELIVERED', 'IN_TRANSIT', 'PREPARING'))
        GROUP BY soi.id`,
      [soid]
    )
  ).rows;
  for (const row of aggregated) {
    await q('UPDATE b2b_sales_order_items SET qty_delivered = $1 WHERE id = $2', [
      Number(row.delivered) || 0,
      row.so_item_id,
    ]);
  }
}

router.get('/', async (req, res) => {
  const { status, sales_order_id, customer_id } = req.query;
  const where = [];
  const params = [];
  let p = 1;
  if (status) {
    where.push(`status = $${p++}`);
    params.push(status);
  }
  if (sales_order_id) {
    where.push(`sales_order_id = $${p++}`);
    params.push(Number(sales_order_id));
  }
  if (customer_id) {
    where.push(`customer_id = $${p++}`);
    params.push(Number(customer_id));
  }
  const sql = `SELECT * FROM b2b_delivery_orders${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json((await query(sql, params)).rows);
});

router.get('/:id', async (req, res) => {
  const row = await loadFull(query, Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: DeliveryOrderCreateSchema }), async (req, res) => {
  const body = req.body;
  const so = (await query('SELECT * FROM b2b_sales_orders WHERE id = $1', [body.sales_order_id]))
    .rows[0];
  if (!so) return res.status(400).json({ error: 'Sales order tidak ditemukan' });
  const status = body.status || 'PREPARING';

  const id = await tx(async (txQuery) => {
    const number = await generateNumber(txQuery, 'b2b_delivery_orders', body.delivery_date);
    const ins = await txQuery(
      `INSERT INTO b2b_delivery_orders
          (number, sales_order_id, customer_id, customer_name, delivery_date, expected_arrival,
           carrier, driver, status, notes, signature_url, stock_posted, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12) RETURNING id`,
      [
        number,
        body.sales_order_id,
        so.customer_id,
        so.customer_name,
        body.delivery_date,
        body.expected_arrival ?? null,
        body.carrier ?? null,
        body.driver ?? null,
        status,
        body.notes ?? null,
        body.signature_url ?? null,
        req.user?.id ?? null,
      ]
    );
    const doid = ins.rows[0].id;
    for (const it of body.items) {
      await txQuery(
        `INSERT INTO b2b_delivery_order_items
          (delivery_order_id, sales_order_item_id, product_id, product_name, qty)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          doid,
          it.sales_order_item_id ?? null,
          it.product_id ?? null,
          it.product_name,
          Number(it.qty),
        ]
      );
    }
    if (status === 'DELIVERED') {
      await postStockMovements(txQuery, doid, body.items, body.delivery_date, req.user?.id);
      await txQuery('UPDATE b2b_delivery_orders SET stock_posted = 1 WHERE id = $1', [doid]);
    }
    await applyQtyDelivered(txQuery, body.sales_order_id);
    await refreshFulfillmentStatus(txQuery, body.sales_order_id);
    return doid;
  });
  res.status(201).json(await loadFull(query, id));
});

router.put('/:id', validate({ body: DeliveryOrderUpdateSchema }), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await loadFull(query, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const newStatus = body.status ?? existing.status;
  const wasDelivered = existing.status === 'DELIVERED';
  const isDelivered = newStatus === 'DELIVERED';

  await tx(async (txQuery) => {
    await txQuery(
      `UPDATE b2b_delivery_orders SET
         delivery_date = $1, expected_arrival = $2, carrier = $3, driver = $4,
         status = $5, notes = $6, signature_url = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [
        body.delivery_date ?? existing.delivery_date,
        body.expected_arrival ?? existing.expected_arrival,
        body.carrier ?? existing.carrier,
        body.driver ?? existing.driver,
        newStatus,
        body.notes ?? existing.notes,
        body.signature_url ?? existing.signature_url,
        id,
      ]
    );
    if (!wasDelivered && isDelivered && !existing.stock_posted) {
      await postStockMovements(txQuery, id, existing.items, existing.delivery_date, req.user?.id);
      await txQuery('UPDATE b2b_delivery_orders SET stock_posted = 1 WHERE id = $1', [id]);
    }
    await applyQtyDelivered(txQuery, existing.sales_order_id);
    await refreshFulfillmentStatus(txQuery, existing.sales_order_id);
  });
  res.json(await loadFull(query, id));
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await loadFull(query, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await tx(async (txQuery) => {
    await txQuery('DELETE FROM b2b_delivery_orders WHERE id = $1', [id]);
    if (existing.sales_order_id) {
      await applyQtyDelivered(txQuery, existing.sales_order_id);
      await refreshFulfillmentStatus(txQuery, existing.sales_order_id);
    }
  });
  res.json({ success: true });
});

module.exports = router;
