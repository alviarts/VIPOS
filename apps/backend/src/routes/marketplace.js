// Marketplace integration endpoints (mock OAuth + product sync + settlement).
//
//   GET    /api/marketplace                       List koneksi semua provider.
//   POST   /api/marketplace/:provider/connect     Mock OAuth — generate fake token.
//   POST   /api/marketplace/:provider/disconnect  Disconnect.
//   PUT    /api/marketplace/:provider             Update setting.
//   POST   /api/marketplace/:provider/sync-products  Sync produk (mock).
//   GET    /api/marketplace/:provider/products    List override produk.
//   POST   /api/marketplace/:provider/products    Upsert override.
//   GET    /api/marketplace/settlement            Settlement report per provider.
//
// "Mock" artinya kita simpan oauth_token sintetis (random UUID) dan tandai
// status='connected'. Saat ada API real (Gojek / Grab / Shopee), tinggal
// swap kode di /connect + scheduler untuk token refresh.
const crypto = require('crypto');
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  MarketplaceConnectSchema,
  MarketplaceUpdateSchema,
  MarketplaceOverrideUpsertSchema,
} = require('@vipos/shared');

const router = express.Router();

const VALID_PROVIDERS = ['gofood', 'grabfood', 'shopeefood', 'grabmart', 'tokopedia'];

function ensureProvider(provider, res) {
  if (!VALID_PROVIDERS.includes(provider)) {
    res.status(400).json({ error: 'Provider tidak dikenal' });
    return false;
  }
  return true;
}

function loadConnection(db, provider) {
  return db.prepare('SELECT * FROM marketplace_connections WHERE provider = ?').get(provider);
}

function ensureConnectionRow(db, provider) {
  let conn = loadConnection(db, provider);
  if (!conn) {
    db.prepare(
      `INSERT INTO marketplace_connections (provider, status) VALUES (?, 'disconnected')`
    ).run(provider);
    conn = loadConnection(db, provider);
  }
  return conn;
}

router.get('/', authenticateToken, (_req, res) => {
  const db = getDb();
  for (const p of VALID_PROVIDERS) ensureConnectionRow(db, p);
  const rows = db.prepare('SELECT * FROM marketplace_connections ORDER BY provider').all();
  res.json(rows);
});

router.post(
  '/:provider/connect',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketplaceConnectSchema }),
  (req, res) => {
    const { provider } = req.params;
    if (!ensureProvider(provider, res)) return;
    const db = getDb();
    ensureConnectionRow(db, provider);
    const oauthToken = `mock_${crypto.randomBytes(16).toString('hex')}`;
    const refreshToken = `mock_refresh_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    db.prepare(
      `UPDATE marketplace_connections SET
         status='connected', merchant_id=?, outlet_id=?, oauth_token=?, refresh_token=?,
         token_expires_at=?, auto_accept=?, sla_accept_minutes=?, sla_ready_minutes=?,
         mdr_percent=?, price_markup_percent=?, connected_at=CURRENT_TIMESTAMP,
         updated_at=CURRENT_TIMESTAMP
       WHERE provider = ?`
    ).run(
      req.body.merchant_id,
      req.body.outlet_id || null,
      oauthToken,
      refreshToken,
      expiresAt,
      Number(req.body.auto_accept || 0),
      req.body.sla_accept_minutes,
      req.body.sla_ready_minutes,
      req.body.mdr_percent,
      req.body.price_markup_percent,
      provider
    );
    res.json(loadConnection(db, provider));
  }
);

router.post('/:provider/disconnect', authenticateToken, requireAdmin, (req, res) => {
  const { provider } = req.params;
  if (!ensureProvider(provider, res)) return;
  const db = getDb();
  db.prepare(
    `UPDATE marketplace_connections SET
         status='disconnected', oauth_token=NULL, refresh_token=NULL,
         token_expires_at=NULL, updated_at=CURRENT_TIMESTAMP
       WHERE provider = ?`
  ).run(provider);
  res.json({ message: 'Disconnected' });
});

router.put(
  '/:provider',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketplaceUpdateSchema }),
  (req, res) => {
    const { provider } = req.params;
    if (!ensureProvider(provider, res)) return;
    const db = getDb();
    const conn = loadConnection(db, provider);
    if (!conn) return res.status(404).json({ error: 'Tidak ditemukan' });
    const fields = [];
    const params = [];
    const allowed = [
      'auto_accept',
      'sla_accept_minutes',
      'sla_ready_minutes',
      'mdr_percent',
      'price_markup_percent',
      'status',
    ];
    for (const k of allowed) {
      if (k in req.body) {
        fields.push(`${k} = ?`);
        params.push(req.body[k]);
      }
    }
    if (!fields.length) {
      return res.json(conn);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(provider);
    db.prepare(`UPDATE marketplace_connections SET ${fields.join(', ')} WHERE provider = ?`).run(
      ...params
    );
    res.json(loadConnection(db, provider));
  }
);

router.post('/:provider/sync-products', authenticateToken, requireAdmin, (req, res) => {
  const { provider } = req.params;
  if (!ensureProvider(provider, res)) return;
  const db = getDb();
  const conn = loadConnection(db, provider);
  if (!conn || conn.status !== 'connected') {
    return res.status(400).json({ error: 'Marketplace belum connected' });
  }
  // Mock sync — semua override pending → synced.
  const result = db
    .prepare(
      `UPDATE marketplace_product_overrides SET sync_status='synced', synced_at=CURRENT_TIMESTAMP, sync_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE provider = ?`
    )
    .run(provider);
  const lastSyncAt = new Date().toISOString();
  db.prepare(
    `UPDATE marketplace_connections SET last_sync_at=?, updated_at=CURRENT_TIMESTAMP WHERE provider = ?`
  ).run(lastSyncAt, provider);
  res.json({
    synced: result.changes,
    failed: 0,
    last_sync_at: lastSyncAt,
  });
});

router.get('/:provider/products', authenticateToken, (req, res) => {
  const { provider } = req.params;
  if (!ensureProvider(provider, res)) return;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT mpo.*, p.name AS product_name, p.sku AS product_sku, p.price AS base_price
       FROM marketplace_product_overrides mpo
       JOIN products p ON p.id = mpo.product_id
       WHERE mpo.provider = ?
       ORDER BY p.name ASC`
    )
    .all(provider);
  res.json(rows);
});

router.post(
  '/:provider/products',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketplaceOverrideUpsertSchema }),
  (req, res) => {
    const { provider } = req.params;
    if (!ensureProvider(provider, res)) return;
    const db = getDb();
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.body.product_id);
    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    const existing = db
      .prepare('SELECT id FROM marketplace_product_overrides WHERE provider = ? AND product_id = ?')
      .get(provider, req.body.product_id);

    if (existing) {
      db.prepare(
        `UPDATE marketplace_product_overrides SET
           override_name=?, override_price=?, override_image_url=?, is_enabled=?,
           sync_status='pending', sync_error=NULL, updated_at=CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(
        req.body.override_name || null,
        req.body.override_price ?? null,
        req.body.override_image_url || null,
        Number(req.body.is_enabled ?? 1),
        existing.id
      );
    } else {
      db.prepare(
        `INSERT INTO marketplace_product_overrides
           (provider, product_id, override_name, override_price, override_image_url, is_enabled)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        provider,
        req.body.product_id,
        req.body.override_name || null,
        req.body.override_price ?? null,
        req.body.override_image_url || null,
        Number(req.body.is_enabled ?? 1)
      );
    }
    const row = db
      .prepare('SELECT * FROM marketplace_product_overrides WHERE provider = ? AND product_id = ?')
      .get(provider, req.body.product_id);
    res.json(row);
  }
);

router.get('/settlement', authenticateToken, (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  const where = ["status = 'COMPLETED'"];
  const params = [];
  if (from) {
    where.push('completed_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('completed_at <= ?');
    params.push(to);
  }
  const rows = db
    .prepare(
      `SELECT channel AS provider, COUNT(*) AS completed_orders, SUM(total) AS gross_revenue
       FROM online_orders WHERE ${where.join(' AND ')}
       GROUP BY channel ORDER BY channel`
    )
    .all(...params);
  const conns = db.prepare('SELECT provider, mdr_percent FROM marketplace_connections').all();
  const mdrByProvider = new Map(conns.map((c) => [c.provider, Number(c.mdr_percent || 0)]));

  const enriched = rows.map((r) => {
    const gross = Number(r.gross_revenue || 0);
    const mdrPct = mdrByProvider.get(r.provider) || 0;
    const mdr = (gross * mdrPct) / 100;
    return {
      provider: r.provider,
      completed_orders: r.completed_orders,
      gross_revenue: gross,
      mdr,
      net_revenue: gross - mdr,
    };
  });
  const totalGross = enriched.reduce((s, r) => s + r.gross_revenue, 0);
  const totalMdr = enriched.reduce((s, r) => s + r.mdr, 0);
  res.json({
    rows: enriched,
    total_gross: totalGross,
    total_mdr: totalMdr,
    total_net: totalGross - totalMdr,
  });
});

module.exports = router;
