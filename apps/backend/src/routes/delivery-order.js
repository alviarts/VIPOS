const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { DeliveryOrderCreateSchema, DeliveryOrderUpdateSchema } = require('@vipos/shared');
const { generateNumber } = require('../utils/b2b-helpers');
const { refreshFulfillmentStatus } = require('./sales-order');

const router = express.Router();
router.use(authenticateToken);

function loadFull(db, id) {
  const row = db.prepare('SELECT * FROM b2b_delivery_orders WHERE id = ?').get(id);
  if (!row) return null;
  row.items = db
    .prepare('SELECT * FROM b2b_delivery_order_items WHERE delivery_order_id = ? ORDER BY id ASC')
    .all(id);
  return row;
}

function postStockMovements(db, doid, items, refDate, userId) {
  const insMov = db.prepare(
    `INSERT INTO inventory_movements
      (tanggal, product_id, tipe, qty, stok_sebelum, stok_sesudah, ref_type, ref_id, reason, keterangan, user_id)
     VALUES (?, ?, 'stok_out', ?, ?, ?, 'B2B_DELIVERY', ?, 'b2b_delivery', ?, ?)`
  );
  const getStock = db.prepare('SELECT stock FROM products WHERE id = ?');
  const updProd = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
  for (const it of items) {
    if (!it.product_id) continue;
    const before = getStock.get(it.product_id)?.stock ?? 0;
    const after = before - Number(it.qty);
    insMov.run(
      refDate,
      it.product_id,
      Number(it.qty),
      before,
      after,
      doid,
      `DO-${doid}`,
      userId ?? null
    );
    updProd.run(Number(it.qty), it.product_id);
  }
}

function applyQtyDelivered(db, soid) {
  const aggregated = db
    .prepare(
      `SELECT soi.id AS so_item_id, COALESCE(SUM(doi.qty), 0) AS delivered
         FROM b2b_sales_order_items soi
         LEFT JOIN b2b_delivery_order_items doi ON doi.sales_order_item_id = soi.id
         LEFT JOIN b2b_delivery_orders dod ON dod.id = doi.delivery_order_id
        WHERE soi.sales_order_id = ?
          AND (dod.status IS NULL OR dod.status IN ('DELIVERED', 'IN_TRANSIT', 'PREPARING'))
        GROUP BY soi.id`
    )
    .all(soid);
  const upd = db.prepare('UPDATE b2b_sales_order_items SET qty_delivered = ? WHERE id = ?');
  for (const row of aggregated) {
    upd.run(Number(row.delivered) || 0, row.so_item_id);
  }
}

router.get('/', (req, res) => {
  const db = getDb();
  const { status, sales_order_id, customer_id } = req.query;
  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (sales_order_id) {
    where.push('sales_order_id = ?');
    params.push(Number(sales_order_id));
  }
  if (customer_id) {
    where.push('customer_id = ?');
    params.push(Number(customer_id));
  }
  const sql = `SELECT * FROM b2b_delivery_orders${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 200`;
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const row = loadFull(getDb(), Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', validate({ body: DeliveryOrderCreateSchema }), (req, res) => {
  const db = getDb();
  const body = req.body;
  const so = db.prepare('SELECT * FROM b2b_sales_orders WHERE id = ?').get(body.sales_order_id);
  if (!so) return res.status(400).json({ error: 'Sales order tidak ditemukan' });
  const number = generateNumber(db, 'b2b_delivery_orders', body.delivery_date);
  const status = body.status || 'PREPARING';

  const tx = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO b2b_delivery_orders
          (number, sales_order_id, customer_id, customer_name, delivery_date, expected_arrival,
           carrier, driver, status, notes, signature_url, stock_posted, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
      )
      .run(
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
        req.user?.id ?? null
      );
    const doid = r.lastInsertRowid;
    const insItem = db.prepare(
      `INSERT INTO b2b_delivery_order_items
        (delivery_order_id, sales_order_item_id, product_id, product_name, qty)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const it of body.items) {
      insItem.run(
        doid,
        it.sales_order_item_id ?? null,
        it.product_id ?? null,
        it.product_name,
        Number(it.qty)
      );
    }
    if (status === 'DELIVERED') {
      postStockMovements(db, doid, body.items, body.delivery_date, req.user?.id);
      db.prepare('UPDATE b2b_delivery_orders SET stock_posted = 1 WHERE id = ?').run(doid);
    }
    applyQtyDelivered(db, body.sales_order_id);
    refreshFulfillmentStatus(db, body.sales_order_id);
    return doid;
  });
  const id = tx();
  res.status(201).json(loadFull(db, id));
});

router.put('/:id', validate({ body: DeliveryOrderUpdateSchema }), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = loadFull(db, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const body = req.body;
  const newStatus = body.status ?? existing.status;
  const wasDelivered = existing.status === 'DELIVERED';
  const isDelivered = newStatus === 'DELIVERED';

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE b2b_delivery_orders SET
         delivery_date = ?, expected_arrival = ?, carrier = ?, driver = ?,
         status = ?, notes = ?, signature_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      body.delivery_date ?? existing.delivery_date,
      body.expected_arrival ?? existing.expected_arrival,
      body.carrier ?? existing.carrier,
      body.driver ?? existing.driver,
      newStatus,
      body.notes ?? existing.notes,
      body.signature_url ?? existing.signature_url,
      id
    );
    if (!wasDelivered && isDelivered && !existing.stock_posted) {
      postStockMovements(db, id, existing.items, existing.delivery_date, req.user?.id);
      db.prepare('UPDATE b2b_delivery_orders SET stock_posted = 1 WHERE id = ?').run(id);
    }
    applyQtyDelivered(db, existing.sales_order_id);
    refreshFulfillmentStatus(db, existing.sales_order_id);
  });
  tx();
  res.json(loadFull(db, id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const existing = loadFull(db, id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM b2b_delivery_orders WHERE id = ?').run(id);
    if (existing.sales_order_id) {
      applyQtyDelivered(db, existing.sales_order_id);
      refreshFulfillmentStatus(db, existing.sales_order_id);
    }
  });
  tx();
  res.json({ success: true });
});

module.exports = router;
