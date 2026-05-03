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

// Database accessor harus deferred — di test setupTestEnv() membuka DB baru.
function getDb() {
  return require('../models/database').getDb();
}

// -----------------------------------------------------------------------------
// HELP
// -----------------------------------------------------------------------------

const helpRouter = express.Router();
helpRouter.use(authenticateToken);

helpRouter.get('/topics', (req, res) => {
  const q = (req.query.q || '').trim();
  const category = (req.query.category || '').trim();
  const where = ['is_active = 1'];
  const params = [];
  if (q) {
    where.push('(title LIKE ? OR excerpt LIKE ? OR content LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  const rows = getDb()
    .prepare(
      `SELECT id, slug, title, category, excerpt, sort_order
       FROM help_topics WHERE ${where.join(' AND ')}
       ORDER BY sort_order, title`
    )
    .all(...params);
  res.json(rows);
});

helpRouter.get('/topics/:slug', (req, res) => {
  const row = getDb()
    .prepare(`SELECT * FROM help_topics WHERE slug = ? AND is_active = 1`)
    .get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Topic tidak ditemukan' });
  res.json(row);
});

helpRouter.post('/feedback', validate({ body: HelpFeedbackCreateSchema }), (req, res) => {
  const { type, title, description, screenshot_url, app_version, device_info } = req.body;
  const result = getDb()
    .prepare(
      `INSERT INTO help_feedback (type, title, description, screenshot_url, app_version, device_info, status, submitted_by)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
    )
    .run(
      type,
      title,
      description,
      screenshot_url || null,
      app_version || null,
      device_info || null,
      req.user.id
    );
  const row = getDb()
    .prepare('SELECT * FROM help_feedback WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(row);
});

helpRouter.get('/feedback', (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT * FROM help_feedback WHERE submitted_by = ? ORDER BY created_at DESC LIMIT 100`
    )
    .all(req.user.id);
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

servicesRouter.get('/catalog', (req, res) => {
  const userApplications = getDb()
    .prepare(
      `SELECT service_key, status, submitted_at FROM service_applications
       WHERE submitted_by = ? ORDER BY submitted_at DESC`
    )
    .all(req.user.id);
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
  (req, res) => {
    const { service_key, payload } = req.body;
    const existing = getDb()
      .prepare(
        `SELECT id FROM service_applications
         WHERE submitted_by = ? AND service_key = ? AND status IN ('submitted','review')`
      )
      .get(req.user.id, service_key);
    if (existing) {
      return res.status(409).json({
        error: 'Sudah ada aplikasi aktif untuk layanan ini',
        application_id: existing.id,
      });
    }
    const result = getDb()
      .prepare(
        `INSERT INTO service_applications (service_key, status, payload_json, submitted_by)
         VALUES (?, 'submitted', ?, ?)`
      )
      .run(service_key, payload ? JSON.stringify(payload) : null, req.user.id);
    const row = getDb()
      .prepare('SELECT * FROM service_applications WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(row);
  }
);

servicesRouter.get('/applications', (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM service_applications WHERE submitted_by = ? ORDER BY submitted_at DESC`)
    .all(req.user.id);
  res.json(rows);
});

// -----------------------------------------------------------------------------
// INSPIRASI
// -----------------------------------------------------------------------------

const inspirasiRouter = express.Router();
inspirasiRouter.use(authenticateToken);

inspirasiRouter.get('/articles', (req, res) => {
  const category = (req.query.category || '').trim();
  const q = (req.query.q || '').trim();
  const where = ['is_active = 1'];
  const params = [];
  if (category && category !== 'home') {
    where.push('category = ?');
    params.push(category);
  }
  if (q) {
    where.push('(title LIKE ? OR excerpt LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like);
  }
  const rows = getDb()
    .prepare(
      `SELECT id, slug, category, title, excerpt, cover_url, author, reading_minutes, published_at
       FROM inspirasi_articles WHERE ${where.join(' AND ')}
       ORDER BY published_at DESC LIMIT 100`
    )
    .all(...params);
  res.json(rows);
});

inspirasiRouter.get('/articles/:slug', (req, res) => {
  const row = getDb()
    .prepare(`SELECT * FROM inspirasi_articles WHERE slug = ? AND is_active = 1`)
    .get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Article tidak ditemukan' });
  res.json(row);
});

inspirasiRouter.get('/events', (req, res) => {
  const upcoming = String(req.query.upcoming || 'true') === 'true';
  const rows = getDb()
    .prepare(
      upcoming
        ? `SELECT e.*,
             (SELECT COUNT(*) FROM inspirasi_event_rsvps r WHERE r.event_id = e.id AND r.status != 'cancelled') AS rsvp_count,
             (SELECT status FROM inspirasi_event_rsvps r WHERE r.event_id = e.id AND r.user_id = ?) AS user_rsvp_status
           FROM inspirasi_events e
           WHERE event_date >= datetime('now')
           ORDER BY event_date ASC`
        : `SELECT e.*,
             (SELECT COUNT(*) FROM inspirasi_event_rsvps r WHERE r.event_id = e.id AND r.status != 'cancelled') AS rsvp_count,
             (SELECT status FROM inspirasi_event_rsvps r WHERE r.event_id = e.id AND r.user_id = ?) AS user_rsvp_status
           FROM inspirasi_events e
           ORDER BY event_date DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

inspirasiRouter.post('/events/:id/rsvp', validate({ body: RsvpRequestSchema }), (req, res) => {
  const eventId = Number(req.params.id);
  const event = getDb().prepare('SELECT id FROM inspirasi_events WHERE id = ?').get(eventId);
  if (!event) return res.status(404).json({ error: 'Event tidak ditemukan' });
  const { status } = req.body;
  getDb()
    .prepare(
      `INSERT INTO inspirasi_event_rsvps (event_id, user_id, status) VALUES (?, ?, ?)
         ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status`
    )
    .run(eventId, req.user.id, status);
  res.json({ ok: true, status });
});

inspirasiRouter.get('/magazines', (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  const where = year ? 'WHERE year = ?' : '';
  const rows = getDb()
    .prepare(`SELECT * FROM inspirasi_magazines ${where} ORDER BY year DESC, month DESC LIMIT 100`)
    .all(...(year ? [year] : []));
  res.json(rows);
});

inspirasiRouter.get('/changelog', (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM informasi_updates ORDER BY published_at DESC LIMIT 50`)
    .all();
  res.json(rows);
});

// -----------------------------------------------------------------------------
// CAPITAL
// -----------------------------------------------------------------------------

const capitalRouter = express.Router();
capitalRouter.use(authenticateToken);

function calculatePreQualification(database, _userId) {
  // Approximate: average of last 90 days transactions revenue + months active.
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const txSummary = database
    .prepare(
      `SELECT COUNT(*) AS tx_count,
              COALESCE(SUM(total_amount),0) AS total_revenue,
              MIN(DATE(created_at)) AS first_tx
       FROM transactions WHERE status='completed' AND DATE(created_at) >= ?`
    )
    .get(sixMonthsAgo);
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
  // Pre-approved limit = 1.5x avg monthly revenue, max 50jt; 0 if not eligible.
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
        passed: (txSummary?.tx_count || 0) >= 50,
        message: `${txSummary?.tx_count || 0} transaksi`,
      },
    ],
    avg_monthly_revenue: avgMonthly,
    months_active: monthsActive,
  };
}

function formatRupiah(n) {
  return `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
}

capitalRouter.get('/pre-qualification', (req, res) => {
  const result = calculatePreQualification(getDb(), req.user.id);
  res.json(result);
});

capitalRouter.post(
  '/applications',
  validate({ body: CapitalApplicationCreateSchema }),
  (req, res) => {
    const { amount, tenure_months, purpose, collateral, monthly_revenue, payload } = req.body;
    const preq = calculatePreQualification(getDb(), req.user.id);
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
    const result = getDb()
      .prepare(
        `INSERT INTO capital_applications
           (amount, tenure_months, purpose, collateral, monthly_revenue, status, pre_qualification_score, payload_json, submitted_by)
         VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?)`
      )
      .run(
        amount,
        tenure_months,
        purpose,
        collateral || null,
        monthly_revenue || preq.avg_monthly_revenue,
        preq.score,
        payload ? JSON.stringify(payload) : null,
        req.user.id
      );
    const row = getDb()
      .prepare('SELECT * FROM capital_applications WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(row);
  }
);

capitalRouter.get('/applications', (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM capital_applications WHERE submitted_by = ? ORDER BY submitted_at DESC`)
    .all(req.user.id);
  res.json(rows);
});

capitalRouter.get('/applications/:id', (req, res) => {
  const row = getDb()
    .prepare(`SELECT * FROM capital_applications WHERE id = ? AND submitted_by = ?`)
    .get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: 'Application tidak ditemukan' });
  res.json(row);
});

// -----------------------------------------------------------------------------
// SUPPLIES (B2B Marketplace)
// -----------------------------------------------------------------------------

const suppliesRouter = express.Router();
suppliesRouter.use(authenticateToken);

suppliesRouter.get('/categories', (req, res) => {
  const rows = getDb().prepare(`SELECT * FROM supplies_categories ORDER BY sort_order, name`).all();
  res.json(rows);
});

suppliesRouter.get('/products', (req, res) => {
  const q = (req.query.q || '').trim();
  const categorySlug = (req.query.category || '').trim();
  const where = ['p.is_active = 1'];
  const params = [];
  if (q) {
    where.push('(p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (categorySlug) {
    where.push('c.slug = ?');
    params.push(categorySlug);
  }
  const rows = getDb()
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM supplies_products p
       LEFT JOIN supplies_categories c ON p.category_id = c.id
       WHERE ${where.join(' AND ')}
       ORDER BY p.name ASC LIMIT 200`
    )
    .all(...params);
  res.json(rows);
});

suppliesRouter.get('/products/:id', (req, res) => {
  const row = getDb()
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM supplies_products p
       LEFT JOIN supplies_categories c ON p.category_id = c.id
       WHERE p.id = ?`
    )
    .get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json(row);
});

function ensureCart(database, userId) {
  let cart = database.prepare('SELECT * FROM supplies_carts WHERE user_id = ?').get(userId);
  if (!cart) {
    const result = database.prepare('INSERT INTO supplies_carts (user_id) VALUES (?)').run(userId);
    cart = database
      .prepare('SELECT * FROM supplies_carts WHERE id = ?')
      .get(result.lastInsertRowid);
  }
  return cart;
}

function loadCart(database, userId) {
  const cart = ensureCart(database, userId);
  const items = database
    .prepare(
      `SELECT ci.*,
         json_object('id', p.id, 'sku', p.sku, 'name', p.name, 'price', p.price,
           'image_url', p.image_url, 'moq', p.moq, 'stock_status', p.stock_status,
           'supplier_name', p.supplier_name) AS product_json
       FROM supplies_cart_items ci
       JOIN supplies_products p ON ci.product_id = p.id
       WHERE ci.cart_id = ?
       ORDER BY ci.id ASC`
    )
    .all(cart.id)
    .map((row) => {
      const product = JSON.parse(row.product_json);
      return {
        id: row.id,
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

suppliesRouter.get('/cart', (req, res) => {
  res.json(loadCart(getDb(), req.user.id));
});

suppliesRouter.post('/cart/add', validate({ body: SupplyCartItemCreateSchema }), (req, res) => {
  const database = getDb();
  const cart = ensureCart(database, req.user.id);
  const product = database
    .prepare('SELECT * FROM supplies_products WHERE id = ? AND is_active = 1')
    .get(req.body.product_id);
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  if (req.body.qty < (product.moq || 1)) {
    return res.status(400).json({ error: `Quantity minimum (MOQ) ${product.moq}` });
  }
  database
    .prepare(
      `INSERT INTO supplies_cart_items (cart_id, product_id, qty) VALUES (?, ?, ?)
         ON CONFLICT(cart_id, product_id) DO UPDATE SET qty = excluded.qty`
    )
    .run(cart.id, req.body.product_id, req.body.qty);
  res.json(loadCart(database, req.user.id));
});

suppliesRouter.delete('/cart/items/:id', (req, res) => {
  const database = getDb();
  const cart = ensureCart(database, req.user.id);
  database
    .prepare('DELETE FROM supplies_cart_items WHERE id = ? AND cart_id = ?')
    .run(Number(req.params.id), cart.id);
  res.json(loadCart(database, req.user.id));
});

suppliesRouter.post('/checkout', validate({ body: SupplyCheckoutSchema }), (req, res) => {
  const database = getDb();
  const cart = loadCart(database, req.user.id);
  if (cart.items.length === 0) {
    return res.status(400).json({ error: 'Cart kosong' });
  }
  const { payment_method, delivery_address, delivery_date } = req.body;
  const orderNo = `SUP-${Date.now()}-${req.user.id}`;
  const tx = database.transaction(() => {
    const orderResult = database
      .prepare(
        `INSERT INTO supplies_orders
             (order_no, user_id, total_amount, payment_method, delivery_address, delivery_date, status)
           VALUES (?, ?, ?, ?, ?, ?, 'ordered')`
      )
      .run(
        orderNo,
        req.user.id,
        cart.total_amount,
        payment_method,
        delivery_address,
        delivery_date || null
      );
    const orderId = orderResult.lastInsertRowid;
    const itemInsert = database.prepare(
      `INSERT INTO supplies_order_items (order_id, product_id, qty, price, subtotal)
         VALUES (?, ?, ?, ?, ?)`
    );
    for (const item of cart.items) {
      itemInsert.run(orderId, item.product_id, item.qty, item.product.price, item.subtotal);
    }
    database.prepare('DELETE FROM supplies_cart_items WHERE cart_id = ?').run(cart.id);
    return orderId;
  });
  const orderId = tx();
  const order = database.prepare('SELECT * FROM supplies_orders WHERE id = ?').get(orderId);
  res.status(201).json(order);
});

suppliesRouter.get('/orders', (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT o.*,
         (SELECT COUNT(*) FROM supplies_order_items i WHERE i.order_id = o.id) AS item_count
       FROM supplies_orders o
       WHERE o.user_id = ?
       ORDER BY o.ordered_at DESC LIMIT 100`
    )
    .all(req.user.id);
  res.json(rows);
});

suppliesRouter.get('/orders/:id', (req, res) => {
  const order = getDb()
    .prepare(`SELECT * FROM supplies_orders WHERE id = ? AND user_id = ?`)
    .get(Number(req.params.id), req.user.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  const items = getDb()
    .prepare(
      `SELECT oi.*, p.name AS product_name, p.sku
       FROM supplies_order_items oi
       JOIN supplies_products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`
    )
    .all(order.id);
  res.json({ ...order, items });
});

suppliesRouter.post('/orders/:id/receive', (req, res) => {
  const id = Number(req.params.id);
  const order = getDb()
    .prepare(`SELECT * FROM supplies_orders WHERE id = ? AND user_id = ?`)
    .get(id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  if (!['shipped', 'delivered'].includes(order.status) && order.status !== 'ordered') {
    // Allow receiving from any non-completed/non-cancelled to be lenient.
    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ error: 'Order sudah final, tidak bisa di-receive' });
    }
  }
  getDb()
    .prepare(
      `UPDATE supplies_orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .run(id);
  const updated = getDb().prepare('SELECT * FROM supplies_orders WHERE id = ?').get(id);
  res.json(updated);
});

module.exports = {
  helpRouter,
  servicesRouter,
  inspirasiRouter,
  capitalRouter,
  suppliesRouter,
};
