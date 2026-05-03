// Online order queue endpoints.
//
//   GET    /api/online-order                   List (filter status, channel, date).
//   GET    /api/online-order/:id               Detail + items.
//   POST   /api/online-order                   Create order (auth + e-menu form).
//   POST   /api/online-order/webhook/:provider Webhook ingestion (mock — public).
//   POST   /api/online-order/:id/accept        NEW → PREPARING (auto-accept honored).
//   POST   /api/online-order/:id/reject        NEW/PREPARING → REJECTED.
//   POST   /api/online-order/:id/ready         PREPARING → READY.
//   POST   /api/online-order/:id/complete      READY → COMPLETED.
//   POST   /api/online-order/:id/cancel        any pre-COMPLETED → CANCELLED.
//
// State machine sederhana — transition divalidasi sebelum update. Settlement
// ledger (per-provider) dihitung via /api/marketplace/settlement.
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  OnlineOrderCreateSchema,
  OnlineOrderRejectSchema,
  OnlineOrderCancelSchema,
} = require('@vipos/shared');

const router = express.Router();

const VALID_STATUS_TRANSITIONS = {
  NEW: ['PREPARING', 'REJECTED', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

function nowIso() {
  return new Date().toISOString();
}

function generateRefNo(channel) {
  const prefix = (channel || 'ORD').toUpperCase().slice(0, 3);
  const ts = Date.now().toString().slice(-9);
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${prefix}-${ts}-${rand}`;
}

function rowToOrder(row, items) {
  if (!row) return null;
  return { ...row, items: items || [] };
}

function loadOrder(db, id) {
  const order = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
  if (!order) return null;
  const items = db
    .prepare('SELECT * FROM online_order_items WHERE order_id = ? ORDER BY id ASC')
    .all(id);
  return rowToOrder(order, items);
}

function applyTotals(payload) {
  const subtotal = (payload.items || []).reduce(
    (s, it) => s + Number(it.price) * Number(it.qty),
    0
  );
  const total =
    subtotal -
    Number(payload.discount || 0) +
    Number(payload.service_charge || 0) +
    Number(payload.tax || 0) +
    Number(payload.delivery_fee || 0);
  return { subtotal, total };
}

function createOrderInDb(db, payload) {
  const refNo = generateRefNo(payload.channel);
  const { subtotal, total } = applyTotals(payload);

  const orderInsert = db.prepare(`
    INSERT INTO online_orders (
      ref_no, channel, external_ref, order_type, table_no,
      customer_name, customer_phone, customer_address,
      delivery_zone, delivery_fee, subtotal, discount,
      service_charge, tax, total, payment_method, payment_status,
      status, sla_minutes, notes
    ) VALUES (
      @ref_no, @channel, @external_ref, @order_type, @table_no,
      @customer_name, @customer_phone, @customer_address,
      @delivery_zone, @delivery_fee, @subtotal, @discount,
      @service_charge, @tax, @total, @payment_method, @payment_status,
      'NEW', @sla_minutes, @notes
    )
  `);

  const itemInsert = db.prepare(`
    INSERT INTO online_order_items (
      order_id, product_id, product_name, qty, price, modifiers, notes, subtotal
    ) VALUES (
      @order_id, @product_id, @product_name, @qty, @price, @modifiers, @notes, @subtotal
    )
  `);

  const tx = db.transaction(() => {
    const result = orderInsert.run({
      ref_no: refNo,
      channel: payload.channel,
      external_ref: payload.external_ref || null,
      order_type: payload.order_type || 'delivery',
      table_no: payload.table_no || null,
      customer_name: payload.customer_name || null,
      customer_phone: payload.customer_phone || null,
      customer_address: payload.customer_address || null,
      delivery_zone: payload.delivery_zone || null,
      delivery_fee: Number(payload.delivery_fee || 0),
      subtotal,
      discount: Number(payload.discount || 0),
      service_charge: Number(payload.service_charge || 0),
      tax: Number(payload.tax || 0),
      total,
      payment_method: payload.payment_method || null,
      payment_status: payload.payment_status || 'unpaid',
      sla_minutes: payload.sla_minutes || 30,
      notes: payload.notes || null,
    });
    const orderId = result.lastInsertRowid;
    for (const it of payload.items) {
      itemInsert.run({
        order_id: orderId,
        product_id: it.product_id || null,
        product_name: it.product_name,
        qty: Number(it.qty),
        price: Number(it.price),
        modifiers: it.modifiers || null,
        notes: it.notes || null,
        subtotal: Number(it.price) * Number(it.qty),
      });
    }
    return orderId;
  });

  const orderId = tx();
  return loadOrder(db, orderId);
}

function transitionOrder(db, id, nextStatus, extra = {}) {
  const order = loadOrder(db, id);
  if (!order) {
    const err = new Error('Order tidak ditemukan');
    err.status = 404;
    throw err;
  }
  const allowed = VALID_STATUS_TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    const err = new Error(`Transisi ${order.status} → ${nextStatus} tidak diperbolehkan`);
    err.status = 400;
    throw err;
  }
  const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [nextStatus];

  if (nextStatus === 'PREPARING' && !order.accepted_at) {
    updates.push('accepted_at = ?');
    params.push(nowIso());
  }
  if (nextStatus === 'READY') {
    updates.push('ready_at = ?');
    params.push(nowIso());
  }
  if (nextStatus === 'COMPLETED') {
    updates.push('completed_at = ?');
    params.push(nowIso());
  }
  if (nextStatus === 'CANCELLED') {
    updates.push('cancelled_at = ?');
    params.push(nowIso());
    if (extra.cancel_reason) {
      updates.push('cancel_reason = ?');
      params.push(extra.cancel_reason);
    }
  }
  if (nextStatus === 'REJECTED') {
    if (extra.reject_reason) {
      updates.push('reject_reason = ?');
      params.push(extra.reject_reason);
    }
  }

  params.push(id);
  db.prepare(`UPDATE online_orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  return loadOrder(db, id);
}

router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const { status, channel, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
  const offset = parseInt(req.query.offset || '0', 10) || 0;

  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (channel) {
    where.push('channel = ?');
    params.push(channel);
  }
  if (from) {
    where.push('created_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('created_at <= ?');
    params.push(to);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM online_orders ${whereClause}`)
    .get(...params).c;
  const rows = db
    .prepare(`SELECT * FROM online_orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  // Items lazily — embed compact item count for list view.
  const orderIds = rows.map((r) => r.id);
  const itemCountByOrder = new Map();
  if (orderIds.length) {
    const placeholders = orderIds.map(() => '?').join(',');
    const counts = db
      .prepare(
        `SELECT order_id, SUM(qty) AS c FROM online_order_items WHERE order_id IN (${placeholders}) GROUP BY order_id`
      )
      .all(...orderIds);
    for (const c of counts) itemCountByOrder.set(c.order_id, c.c);
  }
  res.json({
    items: rows.map((r) => ({
      ...r,
      item_count: itemCountByOrder.get(r.id) || 0,
    })),
    total,
  });
});

router.get('/:id(\\d+)', authenticateToken, (req, res) => {
  const order = loadOrder(getDb(), Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  res.json(order);
});

router.post('/', authenticateToken, validate({ body: OnlineOrderCreateSchema }), (req, res) => {
  const order = createOrderInDb(getDb(), req.body);
  res.status(201).json(order);
});

// Public webhook endpoint (no auth) — mock simulator. In real deployment kita
// validate signature header per provider; di sini cukup buat order baru.
router.post('/webhook/:provider', validate({ body: OnlineOrderCreateSchema }), (req, res) => {
  const { provider } = req.params;
  const validProviders = ['gofood', 'grabfood', 'shopeefood', 'grabmart', 'tokopedia'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({ error: 'Provider tidak dikenal' });
  }
  const order = createOrderInDb(getDb(), { ...req.body, channel: provider });

  // Auto-accept kalau marketplace_connections.auto_accept = 1.
  const conn = getDb()
    .prepare('SELECT * FROM marketplace_connections WHERE provider = ?')
    .get(provider);
  if (conn && conn.auto_accept === 1) {
    try {
      const accepted = transitionOrder(getDb(), order.id, 'PREPARING');
      return res.status(201).json(accepted);
    } catch {
      // ignore — biarkan tetap NEW
    }
  }
  res.status(201).json(order);
});

router.post('/:id(\\d+)/accept', authenticateToken, (req, res) => {
  try {
    res.json(transitionOrder(getDb(), Number(req.params.id), 'PREPARING'));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post(
  '/:id(\\d+)/reject',
  authenticateToken,
  validate({ body: OnlineOrderRejectSchema }),
  (req, res) => {
    try {
      res.json(
        transitionOrder(getDb(), Number(req.params.id), 'REJECTED', {
          reject_reason: req.body.reason,
        })
      );
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.post('/:id(\\d+)/ready', authenticateToken, (req, res) => {
  try {
    res.json(transitionOrder(getDb(), Number(req.params.id), 'READY'));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id(\\d+)/complete', authenticateToken, (req, res) => {
  try {
    res.json(transitionOrder(getDb(), Number(req.params.id), 'COMPLETED'));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post(
  '/:id(\\d+)/cancel',
  authenticateToken,
  validate({ body: OnlineOrderCancelSchema }),
  (req, res) => {
    try {
      res.json(
        transitionOrder(getDb(), Number(req.params.id), 'CANCELLED', {
          cancel_reason: req.body.reason,
        })
      );
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

module.exports = router;
module.exports.createOrderInDb = createOrderInDb;
