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
const { query, tx } = require('../db');
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

async function loadOrder(q, id) {
  const order = (await q('SELECT * FROM online_orders WHERE id = $1', [id])).rows[0];
  if (!order) return null;
  const items = (
    await q('SELECT * FROM online_order_items WHERE order_id = $1 ORDER BY id ASC', [id])
  ).rows;
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

async function createOrderInDb(payload) {
  const refNo = generateRefNo(payload.channel);
  const { subtotal, total } = applyTotals(payload);

  const orderId = await tx(async (txQuery) => {
    const ins = await txQuery(
      `INSERT INTO online_orders (
        ref_no, channel, external_ref, order_type, table_no,
        customer_name, customer_phone, customer_address,
        delivery_zone, delivery_fee, subtotal, discount,
        service_charge, tax, total, payment_method, payment_status,
        status, sla_minutes, notes
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        'NEW', $18, $19
      ) RETURNING id`,
      [
        refNo,
        payload.channel,
        payload.external_ref || null,
        payload.order_type || 'delivery',
        payload.table_no || null,
        payload.customer_name || null,
        payload.customer_phone || null,
        payload.customer_address || null,
        payload.delivery_zone || null,
        Number(payload.delivery_fee || 0),
        subtotal,
        Number(payload.discount || 0),
        Number(payload.service_charge || 0),
        Number(payload.tax || 0),
        total,
        payload.payment_method || null,
        payload.payment_status || 'unpaid',
        payload.sla_minutes || 30,
        payload.notes || null,
      ]
    );
    const newId = ins.rows[0].id;
    for (const it of payload.items) {
      await txQuery(
        `INSERT INTO online_order_items (
          order_id, product_id, product_name, qty, price, modifiers, notes, subtotal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newId,
          it.product_id || null,
          it.product_name,
          Number(it.qty),
          Number(it.price),
          it.modifiers || null,
          it.notes || null,
          Number(it.price) * Number(it.qty),
        ]
      );
    }
    return newId;
  });

  return loadOrder(query, orderId);
}

async function transitionOrder(id, nextStatus, extra = {}) {
  const order = await loadOrder(query, id);
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

  const setClauses = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [nextStatus];
  let p = 2;

  if (nextStatus === 'PREPARING' && !order.accepted_at) {
    setClauses.push(`accepted_at = $${p++}`);
    params.push(nowIso());
  }
  if (nextStatus === 'READY') {
    setClauses.push(`ready_at = $${p++}`);
    params.push(nowIso());
  }
  if (nextStatus === 'COMPLETED') {
    setClauses.push(`completed_at = $${p++}`);
    params.push(nowIso());
  }
  if (nextStatus === 'CANCELLED') {
    setClauses.push(`cancelled_at = $${p++}`);
    params.push(nowIso());
    if (extra.cancel_reason) {
      setClauses.push(`cancel_reason = $${p++}`);
      params.push(extra.cancel_reason);
    }
  }
  if (nextStatus === 'REJECTED') {
    if (extra.reject_reason) {
      setClauses.push(`reject_reason = $${p++}`);
      params.push(extra.reject_reason);
    }
  }

  params.push(id);
  await query(`UPDATE online_orders SET ${setClauses.join(', ')} WHERE id = $${p}`, params);

  return loadOrder(query, id);
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, channel, from, to } = req.query;
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
    const offset = parseInt(req.query.offset || '0', 10) || 0;

    const where = [];
    const params = [];
    let p = 1;
    if (status) {
      where.push(`status = $${p++}`);
      params.push(status);
    }
    if (channel) {
      where.push(`channel = $${p++}`);
      params.push(channel);
    }
    if (from) {
      where.push(`created_at >= $${p++}`);
      params.push(from);
    }
    if (to) {
      where.push(`created_at <= $${p++}`);
      params.push(to);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = Number(
      (await query(`SELECT COUNT(*) AS c FROM online_orders ${whereClause}`, params)).rows[0].c
    );
    const rows = (
      await query(
        `SELECT * FROM online_orders ${whereClause} ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset]
      )
    ).rows;

    const orderIds = rows.map((r) => r.id);
    const itemCountByOrder = new Map();
    if (orderIds.length) {
      const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
      const counts = (
        await query(
          `SELECT order_id, SUM(qty) AS c FROM online_order_items WHERE order_id IN (${placeholders}) GROUP BY order_id`,
          orderIds
        )
      ).rows;
      for (const c of counts) itemCountByOrder.set(c.order_id, Number(c.c));
    }
    res.json({
      items: rows.map((r) => ({
        ...r,
        item_count: itemCountByOrder.get(r.id) || 0,
      })),
      total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id(\\d+)', authenticateToken, async (req, res) => {
  try {
    const order = await loadOrder(query, Number(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  validate({ body: OnlineOrderCreateSchema }),
  async (req, res) => {
    try {
      const order = await createOrderInDb(req.body);
      res.status(201).json(order);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Public webhook endpoint (no auth) — mock simulator. In real deployment kita
// validate signature header per provider; di sini cukup buat order baru.
//
// Multi-tenant note (P2-02): production webhook should resolve tenant from a
// signed payload (e.g. marketplace merchant_id → tenant_id lookup) or from a
// tenant slug in the URL. For now we default the legacy single-tenant flow
// to tenant id = 1 so existing webhook-driven tests / GoFood mock simulator
// keeps working unchanged.
const { runWithTenant } = require('../db');
router.post('/webhook/:provider', validate({ body: OnlineOrderCreateSchema }), async (req, res) => {
  return runWithTenant(1, async () => {
    try {
      const { provider } = req.params;
      const validProviders = ['gofood', 'grabfood', 'shopeefood', 'grabmart', 'tokopedia'];
      if (!validProviders.includes(provider)) {
        return res.status(400).json({ error: 'Provider tidak dikenal' });
      }
      const order = await createOrderInDb({ ...req.body, channel: provider });

      // Auto-accept kalau marketplace_connections.auto_accept = 1.
      const conn = (
        await query('SELECT * FROM marketplace_connections WHERE provider = $1', [provider])
      ).rows[0];
      if (conn && conn.auto_accept === 1) {
        try {
          const accepted = await transitionOrder(order.id, 'PREPARING');
          return res.status(201).json(accepted);
        } catch {
          // ignore — biarkan tetap NEW
        }
      }
      res.status(201).json(order);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

router.post('/:id(\\d+)/accept', authenticateToken, async (req, res) => {
  try {
    res.json(await transitionOrder(Number(req.params.id), 'PREPARING'));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post(
  '/:id(\\d+)/reject',
  authenticateToken,
  validate({ body: OnlineOrderRejectSchema }),
  async (req, res) => {
    try {
      res.json(
        await transitionOrder(Number(req.params.id), 'REJECTED', {
          reject_reason: req.body.reason,
        })
      );
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.post('/:id(\\d+)/ready', authenticateToken, async (req, res) => {
  try {
    res.json(await transitionOrder(Number(req.params.id), 'READY'));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id(\\d+)/complete', authenticateToken, async (req, res) => {
  try {
    res.json(await transitionOrder(Number(req.params.id), 'COMPLETED'));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post(
  '/:id(\\d+)/cancel',
  authenticateToken,
  validate({ body: OnlineOrderCancelSchema }),
  async (req, res) => {
    try {
      res.json(
        await transitionOrder(Number(req.params.id), 'CANCELLED', {
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
