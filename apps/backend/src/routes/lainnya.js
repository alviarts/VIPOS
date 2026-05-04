// VIPOS — P1-18 LAINNYA route group.
//
// Mengexport 5 sub-router untuk dimount di `app.js`:
//   - helpRouter      → /api/help
//   - servicesRouter  → /api/services
//   - inspirasiRouter → /api/inspirasi
//   - capitalRouter   → /api/capital
//   - suppliesRouter  → /api/supplies
//
// Spec ref: docs/v2/menus/lainnya/*.md, docs/v3/workflow/phase_1_web_dashboard.md §P1-18.
const express = require('express');
const { query, tx, iLikePattern } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  HelpFeedbackCreateSchema,
  ServiceApplicationCreateSchema,
  RsvpRequestSchema,
  CapitalApplicationCreateSchema,
  SupplyCartItemCreateSchema,
  SupplyCheckoutSchema,
} = require('@vipos/shared');

// -----------------------------------------------------------------------------
// HELP
// -----------------------------------------------------------------------------

const helpRouter = express.Router();
helpRouter.use(authenticateToken);

helpRouter.get('/topics', async (req, res) => {
  const q = (req.query.q || '').trim();
  const category = (req.query.category || '').trim();
  const where = ['is_active = 1'];
  const params = [];
  let p = 1;
  if (q) {
    const like = `%${iLikePattern(q)}%`;
    where.push(`(title LIKE $${p} OR excerpt LIKE $${p + 1} OR content LIKE $${p + 2})`);
    params.push(like, like, like);
    p += 3;
  }
  if (category) {
    where.push(`category = $${p++}`);
    params.push(category);
  }
  const rows = (
    await query(
      `SELECT id, slug, title, category, excerpt, sort_order
       FROM help_topics WHERE ${where.join(' AND ')}
       ORDER BY sort_order, title`,
      params
    )
  ).rows;
  res.json(rows);
});

helpRouter.get('/topics/:slug', async (req, res) => {
  const row = (
    await query(`SELECT * FROM help_topics WHERE slug = $1 AND is_active = 1`, [req.params.slug])
  ).rows[0];
  if (!row) return res.status(404).json({ error: 'Topic tidak ditemukan' });
  res.json(row);
});

helpRouter.post('/feedback', validate({ body: HelpFeedbackCreateSchema }), async (req, res) => {
  const { type, title, description, screenshot_url, app_version, device_info } = req.body;
  const ins = await query(
    `INSERT INTO help_feedback (type, title, description, screenshot_url, app_version, device_info, status, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7) RETURNING id`,
    [
      type,
      title,
      description,
      screenshot_url || null,
      app_version || null,
      device_info || null,
      req.user.id,
    ]
  );
  const row = (await query('SELECT * FROM help_feedback WHERE id = $1', [ins.rows[0].id])).rows[0];
  res.status(201).json(row);
});

helpRouter.get('/feedback', async (req, res) => {
  const rows = (
    await query(
      `SELECT * FROM help_feedback WHERE submitted_by = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]
    )
  ).rows;
  res.json(rows);
});

// -----------------------------------------------------------------------------
// LAYANAN
// -----------------------------------------------------------------------------

const servicesRouter = express.Router();
servicesRouter.use(authenticateToken);

const SERVICE_CATALOG = [
  {
    key: 'majoopay',
    name: 'Majoopay / QRIS',
    description: 'Aktifkan QRIS merchant dari Majoopay untuk terima pembayaran digital.',
    tier: 'all',
    benefits: ['QRIS Code Printable', 'Settlement T+1', 'MDR kompetitif 0.7%'],
    eta_days: '3-5 hari kerja',
  },
  {
    key: 'edc',
    name: 'Pengajuan EDC',
    description: 'Mesin EDC untuk terima pembayaran kartu debit/kredit.',
    tier: 'all',
    benefits: ['EDC Bank-issued', 'Multi-bank acquirer', 'Service & support'],
    eta_days: '5-7 hari kerja',
  },
  {
    key: 'satu_sehat',
    name: 'Integrasi Satu Sehat',
    description: 'Sinkronisasi data transaksi farmasi/klinik ke Kemenkes Satu Sehat.',
    tier: 'pro',
    benefits: ['Compliance otomatis', 'ICD-10 mapping', 'Audit-ready'],
    eta_days: 'Setup 1-2 hari',
  },
  {
    key: 'aura',
    name: 'Aura — AI Asisten via WhatsApp',
    description: 'AI assistant berbasis WhatsApp untuk owner: tanya KPI, top produk, stok rendah.',
    tier: 'prime',
    benefits: ['Chat KPI via WA', 'Read-only akses data', 'Akses 24/7'],
    eta_days: 'Provisioning 1 hari',
  },
];

servicesRouter.get('/catalog', async (req, res) => {
  const userApplications = (
    await query(
      `SELECT service_key, status, submitted_at FROM service_applications
       WHERE submitted_by = $1 ORDER BY submitted_at DESC`,
      [req.user.id]
    )
  ).rows;
  const byKey = {};
  for (const app of userApplications) {
    if (!byKey[app.service_key]) byKey[app.service_key] = app;
  }
  const items = SERVICE_CATALOG.map((s) => ({
    ...s,
    application: byKey[s.key] || null,
  }));
  res.json(items);
});

servicesRouter.post(
  '/applications',
  validate({ body: ServiceApplicationCreateSchema }),
  async (req, res) => {
    const { service_key, payload } = req.body;
    const existing = (
      await query(
        `SELECT id FROM service_applications
         WHERE submitted_by = $1 AND service_key = $2 AND status IN ('submitted','review')`,
        [req.user.id, service_key]
      )
    ).rows[0];
    if (existing) {
      return res.status(409).json({
        error: 'Sudah ada aplikasi aktif untuk layanan ini',
        application_id: existing.id,
      });
    }
    const ins = await query(
      `INSERT INTO service_applications (service_key, status, payload_json, submitted_by)
         VALUES ($1, 'submitted', $2, $3) RETURNING id`,
      [service_key, payload ? JSON.stringify(payload) : null, req.user.id]
    );
    const row = (await query('SELECT * FROM service_applications WHERE id = $1', [ins.rows[0].id]))
      .rows[0];
    res.status(201).json(row);
  }
);

servicesRouter.get('/applications', async (req, res) => {
  const rows = (
    await query(
      `SELECT * FROM service_applications WHERE submitted_by = $1 ORDER BY submitted_at DESC`,
      [req.user.id]
    )
  ).rows;
  res.json(rows);
});

// -----------------------------------------------------------------------------
// INSPIRASI
// -----------------------------------------------------------------------------

const inspirasiRouter = express.Router();
inspirasiRouter.use(authenticateToken);

inspirasiRouter.get('/articles', async (req, res) => {
  const category = (req.query.category || '').trim();
  const q = (req.query.q || '').trim();
  const where = ['is_active = 1'];
  const params = [];
  let p = 1;
  if (category && category !== 'home') {
    where.push(`category = $${p++}`);
    params.push(category);
  }
  if (q) {
    const like = `%${iLikePattern(q)}%`;
    where.push(`(title LIKE $${p} OR excerpt LIKE $${p + 1})`);
    params.push(like, like);
    p += 2;
  }
  const rows = (
    await query(
      `SELECT id, slug, category, title, excerpt, cover_url, author, reading_minutes, published_at
       FROM inspirasi_articles WHERE ${where.join(' AND ')}
       ORDER BY published_at DESC LIMIT 100`,
      params
    )
  ).rows;
  res.json(rows);
});

inspirasiRouter.get('/articles/:slug', async (req, res) => {
  const row = (
    await query(`SELECT * FROM inspirasi_articles WHERE slug = $1 AND is_active = 1`, [
      req.params.slug,
    ])
  ).rows[0];
  if (!row) return res.status(404).json({ error: 'Article tidak ditemukan' });
  res.json(row);
});

inspirasiRouter.get('/events', async (req, res) => {
  const upcoming = String(req.query.upcoming || 'true') === 'true';
  const sql = upcoming
    ? `SELECT e.*,
         (SELECT COUNT(*) FROM inspirasi_event_rsvps r WHERE r.event_id = e.id AND r.status != 'cancelled') AS rsvp_count,
         (SELECT status FROM inspirasi_event_rsvps r WHERE r.event_id = e.id AND r.user_id = $1) AS user_rsvp_status
       FROM inspirasi_events e
       WHERE event_date >= NOW()
       ORDER BY event_date ASC`
    : `SELECT e.*,
         (SELECT COUNT(*) FROM inspirasi_event_rsvps r WHERE r.event_id = e.id AND r.status != 'cancelled') AS rsvp_count,
         (SELECT status FROM inspirasi_event_rsvps r WHERE r.event_id = e.id AND r.user_id = $1) AS user_rsvp_status
       FROM inspirasi_events e
       ORDER BY event_date DESC`;
  const rows = (await query(sql, [req.user.id])).rows;
  res.json(rows);
});

inspirasiRouter.post(
  '/events/:id/rsvp',
  validate({ body: RsvpRequestSchema }),
  async (req, res) => {
    const eventId = Number(req.params.id);
    const event = (await query('SELECT id FROM inspirasi_events WHERE id = $1', [eventId])).rows[0];
    if (!event) return res.status(404).json({ error: 'Event tidak ditemukan' });
    const { status } = req.body;
    await query(
      `INSERT INTO inspirasi_event_rsvps (event_id, user_id, status) VALUES ($1, $2, $3)
         ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status`,
      [eventId, req.user.id, status]
    );
    res.json({ ok: true, status });
  }
);

inspirasiRouter.get('/magazines', async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  const where = year ? 'WHERE year = $1' : '';
  const rows = (
    await query(
      `SELECT * FROM inspirasi_magazines ${where} ORDER BY year DESC, month DESC LIMIT 100`,
      year ? [year] : []
    )
  ).rows;
  res.json(rows);
});

inspirasiRouter.get('/changelog', async (req, res) => {
  const rows = (await query(`SELECT * FROM informasi_updates ORDER BY published_at DESC LIMIT 50`))
    .rows;
  res.json(rows);
});

// -----------------------------------------------------------------------------
// CAPITAL
// -----------------------------------------------------------------------------

const capitalRouter = express.Router();
capitalRouter.use(authenticateToken);

async function calculatePreQualification(_userId) {
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const txSummary = (
    await query(
      `SELECT COUNT(*) AS tx_count,
              COALESCE(SUM(total_amount),0) AS total_revenue,
              MIN(DATE(created_at)) AS first_tx
       FROM transactions WHERE status='completed' AND DATE(created_at) >= $1`,
      [sixMonthsAgo]
    )
  ).rows[0];
  const monthsActive = txSummary?.first_tx
    ? Math.max(
        1,
        Math.round(
          (Date.now() - new Date(txSummary.first_tx).getTime()) / (30 * 24 * 60 * 60 * 1000)
        )
      )
    : 0;
  const avgMonthly =
    monthsActive > 0
      ? Math.round((Number(txSummary.total_revenue) || 0) / Math.min(monthsActive, 6))
      : 0;
  const isEligible = monthsActive >= 3 && avgMonthly >= 5_000_000;
  const preApprovedLimit = isEligible ? Math.min(Math.round(avgMonthly * 1.5), 50_000_000) : 0;
  const score = Math.min(
    100,
    Math.round(
      (Math.min(monthsActive, 12) / 12) * 50 + (Math.min(avgMonthly, 30_000_000) / 30_000_000) * 50
    )
  );

  return {
    is_eligible: isEligible,
    pre_approved_limit: preApprovedLimit,
    score,
    factors: [
      {
        key: 'months_active',
        label: 'Aktif minimal 3 bulan',
        passed: monthsActive >= 3,
        message: `Aktif ${monthsActive} bulan`,
      },
      {
        key: 'avg_revenue',
        label: 'Rata-rata revenue ≥ Rp 5.000.000/bulan',
        passed: avgMonthly >= 5_000_000,
        message: `Rata-rata ${formatRupiah(avgMonthly)}/bulan`,
      },
      {
        key: 'tx_volume',
        label: 'Volume transaksi 90 hari ≥ 50',
        passed: (Number(txSummary?.tx_count) || 0) >= 50,
        message: `${Number(txSummary?.tx_count) || 0} transaksi`,
      },
    ],
    avg_monthly_revenue: avgMonthly,
    months_active: monthsActive,
  };
}

function formatRupiah(n) {
  return `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
}

capitalRouter.get('/pre-qualification', async (req, res) => {
  const result = await calculatePreQualification(req.user.id);
  res.json(result);
});

capitalRouter.post(
  '/applications',
  validate({ body: CapitalApplicationCreateSchema }),
  async (req, res) => {
    const { amount, tenure_months, purpose, collateral, monthly_revenue, payload } = req.body;
    const preq = await calculatePreQualification(req.user.id);
    if (!preq.is_eligible) {
      return res.status(403).json({
        error: 'Belum eligible untuk pengajuan Capital',
        factors: preq.factors,
      });
    }
    if (amount > preq.pre_approved_limit) {
      return res.status(400).json({
        error: `Jumlah pinjaman melebihi limit (${formatRupiah(preq.pre_approved_limit)})`,
      });
    }
    const ins = await query(
      `INSERT INTO capital_applications
           (amount, tenure_months, purpose, collateral, monthly_revenue, status, pre_qualification_score, payload_json, submitted_by)
         VALUES ($1, $2, $3, $4, $5, 'submitted', $6, $7, $8) RETURNING id`,
      [
        amount,
        tenure_months,
        purpose,
        collateral || null,
        monthly_revenue || preq.avg_monthly_revenue,
        preq.score,
        payload ? JSON.stringify(payload) : null,
        req.user.id,
      ]
    );
    const row = (await query('SELECT * FROM capital_applications WHERE id = $1', [ins.rows[0].id]))
      .rows[0];
    res.status(201).json(row);
  }
);

capitalRouter.get('/applications', async (req, res) => {
  const rows = (
    await query(
      `SELECT * FROM capital_applications WHERE submitted_by = $1 ORDER BY submitted_at DESC`,
      [req.user.id]
    )
  ).rows;
  res.json(rows);
});

capitalRouter.get('/applications/:id', async (req, res) => {
  const row = (
    await query(`SELECT * FROM capital_applications WHERE id = $1 AND submitted_by = $2`, [
      Number(req.params.id),
      req.user.id,
    ])
  ).rows[0];
  if (!row) return res.status(404).json({ error: 'Application tidak ditemukan' });
  res.json(row);
});

// -----------------------------------------------------------------------------
// SUPPLIES (B2B Marketplace)
// -----------------------------------------------------------------------------

const suppliesRouter = express.Router();
suppliesRouter.use(authenticateToken);

suppliesRouter.get('/categories', async (req, res) => {
  const rows = (await query(`SELECT * FROM supplies_categories ORDER BY sort_order, name`)).rows;
  res.json(rows);
});

suppliesRouter.get('/products', async (req, res) => {
  const q = (req.query.q || '').trim();
  const categorySlug = (req.query.category || '').trim();
  const where = ['p.is_active = 1'];
  const params = [];
  let p = 1;
  if (q) {
    const like = `%${iLikePattern(q)}%`;
    where.push(`(p.name LIKE $${p} OR p.description LIKE $${p + 1} OR p.sku LIKE $${p + 2})`);
    params.push(like, like, like);
    p += 3;
  }
  if (categorySlug) {
    where.push(`c.slug = $${p++}`);
    params.push(categorySlug);
  }
  const rows = (
    await query(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM supplies_products p
       LEFT JOIN supplies_categories c ON p.category_id = c.id
       WHERE ${where.join(' AND ')}
       ORDER BY p.name ASC LIMIT 200`,
      params
    )
  ).rows;
  res.json(rows);
});

suppliesRouter.get('/products/:id', async (req, res) => {
  const row = (
    await query(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM supplies_products p
       LEFT JOIN supplies_categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [Number(req.params.id)]
    )
  ).rows[0];
  if (!row) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json(row);
});

async function ensureCart(q, userId) {
  let cart = (await q('SELECT * FROM supplies_carts WHERE user_id = $1', [userId])).rows[0];
  if (!cart) {
    const ins = await q('INSERT INTO supplies_carts (user_id) VALUES ($1) RETURNING id', [userId]);
    cart = (await q('SELECT * FROM supplies_carts WHERE id = $1', [ins.rows[0].id])).rows[0];
  }
  return cart;
}

async function loadCart(q, userId) {
  const cart = await ensureCart(q, userId);
  const rows = (
    await q(
      `SELECT ci.id AS ci_id, ci.product_id, ci.qty,
              p.id AS p_id, p.sku, p.name, p.price, p.image_url, p.moq, p.stock_status, p.supplier_name
         FROM supplies_cart_items ci
         JOIN supplies_products p ON ci.product_id = p.id
         WHERE ci.cart_id = $1
         ORDER BY ci.id ASC`,
      [cart.id]
    )
  ).rows;
  const items = rows.map((row) => {
    const product = {
      id: row.p_id,
      sku: row.sku,
      name: row.name,
      price: row.price,
      image_url: row.image_url,
      moq: row.moq,
      stock_status: row.stock_status,
      supplier_name: row.supplier_name,
    };
    return {
      id: row.ci_id,
      product_id: row.product_id,
      qty: row.qty,
      product,
      subtotal: product.price * row.qty,
    };
  });
  const totalAmount = items.reduce((acc, it) => acc + it.subtotal, 0);
  return {
    id: cart.id,
    items,
    total_amount: totalAmount,
    item_count: items.reduce((acc, it) => acc + it.qty, 0),
  };
}

suppliesRouter.get('/cart', async (req, res) => {
  res.json(await loadCart(query, req.user.id));
});

suppliesRouter.post(
  '/cart/add',
  validate({ body: SupplyCartItemCreateSchema }),
  async (req, res) => {
    const cart = await ensureCart(query, req.user.id);
    const product = (
      await query('SELECT * FROM supplies_products WHERE id = $1 AND is_active = 1', [
        req.body.product_id,
      ])
    ).rows[0];
    if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });
    if (req.body.qty < (product.moq || 1)) {
      return res.status(400).json({ error: `Quantity minimum (MOQ) ${product.moq}` });
    }
    await query(
      `INSERT INTO supplies_cart_items (cart_id, product_id, qty) VALUES ($1, $2, $3)
         ON CONFLICT(cart_id, product_id) DO UPDATE SET qty = excluded.qty`,
      [cart.id, req.body.product_id, req.body.qty]
    );
    res.json(await loadCart(query, req.user.id));
  }
);

suppliesRouter.delete('/cart/items/:id', async (req, res) => {
  const cart = await ensureCart(query, req.user.id);
  await query('DELETE FROM supplies_cart_items WHERE id = $1 AND cart_id = $2', [
    Number(req.params.id),
    cart.id,
  ]);
  res.json(await loadCart(query, req.user.id));
});

suppliesRouter.post('/checkout', validate({ body: SupplyCheckoutSchema }), async (req, res) => {
  const cart = await loadCart(query, req.user.id);
  if (cart.items.length === 0) {
    return res.status(400).json({ error: 'Cart kosong' });
  }
  const { payment_method, delivery_address, delivery_date } = req.body;
  const orderNo = `SUP-${Date.now()}-${req.user.id}`;
  const orderId = await tx(async (txQuery) => {
    const ord = await txQuery(
      `INSERT INTO supplies_orders
           (order_no, user_id, total_amount, payment_method, delivery_address, delivery_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'ordered') RETURNING id`,
      [
        orderNo,
        req.user.id,
        cart.total_amount,
        payment_method,
        delivery_address,
        delivery_date || null,
      ]
    );
    const newOrderId = ord.rows[0].id;
    for (const item of cart.items) {
      await txQuery(
        `INSERT INTO supplies_order_items (order_id, product_id, qty, price, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
        [newOrderId, item.product_id, item.qty, item.product.price, item.subtotal]
      );
    }
    await txQuery('DELETE FROM supplies_cart_items WHERE cart_id = $1', [cart.id]);
    return newOrderId;
  });
  const order = (await query('SELECT * FROM supplies_orders WHERE id = $1', [orderId])).rows[0];
  res.status(201).json(order);
});

suppliesRouter.get('/orders', async (req, res) => {
  const rows = (
    await query(
      `SELECT o.*,
         (SELECT COUNT(*) FROM supplies_order_items i WHERE i.order_id = o.id) AS item_count
       FROM supplies_orders o
       WHERE o.user_id = $1
       ORDER BY o.ordered_at DESC LIMIT 100`,
      [req.user.id]
    )
  ).rows;
  res.json(rows);
});

suppliesRouter.get('/orders/:id', async (req, res) => {
  const order = (
    await query(`SELECT * FROM supplies_orders WHERE id = $1 AND user_id = $2`, [
      Number(req.params.id),
      req.user.id,
    ])
  ).rows[0];
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  const items = (
    await query(
      `SELECT oi.*, p.name AS product_name, p.sku
       FROM supplies_order_items oi
       JOIN supplies_products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [order.id]
    )
  ).rows;
  res.json({ ...order, items });
});

suppliesRouter.post('/orders/:id/receive', async (req, res) => {
  const id = Number(req.params.id);
  const order = (
    await query(`SELECT * FROM supplies_orders WHERE id = $1 AND user_id = $2`, [id, req.user.id])
  ).rows[0];
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  if (!['shipped', 'delivered'].includes(order.status) && order.status !== 'ordered') {
    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: 'Order sudah final, tidak bisa di-receive' });
    }
  }
  await query(
    `UPDATE supplies_orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id]
  );
  const updated = (await query('SELECT * FROM supplies_orders WHERE id = $1', [id])).rows[0];
  res.json(updated);
});

module.exports = {
  helpRouter,
  servicesRouter,
  inspirasiRouter,
  capitalRouter,
  suppliesRouter,
};
