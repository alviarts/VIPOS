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
const { query } = require('../db');
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

async function loadConnection(provider) {
  return (await query('SELECT * FROM marketplace_connections WHERE provider = $1', [provider]))
    .rows[0];
}

async function ensureConnectionRow(provider) {
  let conn = await loadConnection(provider);
  if (!conn) {
    await query(
      `INSERT INTO marketplace_connections (provider, status) VALUES ($1, 'disconnected')`,
      [provider]
    );
    conn = await loadConnection(provider);
  }
  return conn;
}

router.get('/', authenticateToken, async (_req, res) => {
  try {
    for (const p of VALID_PROVIDERS) await ensureConnectionRow(p);
    const rows = (await query('SELECT * FROM marketplace_connections ORDER BY provider')).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/:provider/connect',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketplaceConnectSchema }),
  async (req, res) => {
    try {
      const { provider } = req.params;
      if (!ensureProvider(provider, res)) return;
      await ensureConnectionRow(provider);
      const oauthToken = `mock_${crypto.randomBytes(16).toString('hex')}`;
      const refreshToken = `mock_refresh_${crypto.randomBytes(16).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      await query(
        `UPDATE marketplace_connections SET
           status='connected', merchant_id=$1, outlet_id=$2, oauth_token=$3, refresh_token=$4,
           token_expires_at=$5, auto_accept=$6, sla_accept_minutes=$7, sla_ready_minutes=$8,
           mdr_percent=$9, price_markup_percent=$10, connected_at=CURRENT_TIMESTAMP,
           updated_at=CURRENT_TIMESTAMP
         WHERE provider = $11`,
        [
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
          provider,
        ]
      );
      res.json(await loadConnection(provider));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/:provider/disconnect', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { provider } = req.params;
    if (!ensureProvider(provider, res)) return;
    await query(
      `UPDATE marketplace_connections SET
         status='disconnected', oauth_token=NULL, refresh_token=NULL,
         token_expires_at=NULL, updated_at=CURRENT_TIMESTAMP
       WHERE provider = $1`,
      [provider]
    );
    res.json({ message: 'Disconnected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/:provider',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketplaceUpdateSchema }),
  async (req, res) => {
    try {
      const { provider } = req.params;
      if (!ensureProvider(provider, res)) return;
      const conn = await loadConnection(provider);
      if (!conn) return res.status(404).json({ error: 'Tidak ditemukan' });
      const fields = [];
      const params = [];
      let p = 1;
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
          fields.push(`${k} = $${p++}`);
          params.push(req.body[k]);
        }
      }
      if (!fields.length) {
        return res.json(conn);
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(provider);
      await query(
        `UPDATE marketplace_connections SET ${fields.join(', ')} WHERE provider = $${p}`,
        params
      );
      res.json(await loadConnection(provider));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/:provider/sync-products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { provider } = req.params;
    if (!ensureProvider(provider, res)) return;
    const conn = await loadConnection(provider);
    if (!conn || conn.status !== 'connected') {
      return res.status(400).json({ error: 'Marketplace belum connected' });
    }
    const result = await query(
      `UPDATE marketplace_product_overrides SET sync_status='synced', synced_at=CURRENT_TIMESTAMP, sync_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE provider = $1`,
      [provider]
    );
    const lastSyncAt = new Date().toISOString();
    await query(
      `UPDATE marketplace_connections SET last_sync_at=$1, updated_at=CURRENT_TIMESTAMP WHERE provider = $2`,
      [lastSyncAt, provider]
    );
    res.json({
      synced: result.rowCount,
      failed: 0,
      last_sync_at: lastSyncAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:provider/products', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    if (!ensureProvider(provider, res)) return;
    const rows = (
      await query(
        `SELECT mpo.*, p.name AS product_name, p.sku AS product_sku, p.price AS base_price
         FROM marketplace_product_overrides mpo
         JOIN products p ON p.id = mpo.product_id
         WHERE mpo.provider = $1
         ORDER BY p.name ASC`,
        [provider]
      )
    ).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/:provider/products',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketplaceOverrideUpsertSchema }),
  async (req, res) => {
    try {
      const { provider } = req.params;
      if (!ensureProvider(provider, res)) return;
      const product = (await query('SELECT id FROM products WHERE id = $1', [req.body.product_id]))
        .rows[0];
      if (!product) {
        return res.status(404).json({ error: 'Produk tidak ditemukan' });
      }
      const existing = (
        await query(
          'SELECT id FROM marketplace_product_overrides WHERE provider = $1 AND product_id = $2',
          [provider, req.body.product_id]
        )
      ).rows[0];

      if (existing) {
        await query(
          `UPDATE marketplace_product_overrides SET
             override_name=$1, override_price=$2, override_image_url=$3, is_enabled=$4,
             sync_status='pending', sync_error=NULL, updated_at=CURRENT_TIMESTAMP
           WHERE id = $5`,
          [
            req.body.override_name || null,
            req.body.override_price ?? null,
            req.body.override_image_url || null,
            Number(req.body.is_enabled ?? 1),
            existing.id,
          ]
        );
      } else {
        await query(
          `INSERT INTO marketplace_product_overrides
             (provider, product_id, override_name, override_price, override_image_url, is_enabled)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            provider,
            req.body.product_id,
            req.body.override_name || null,
            req.body.override_price ?? null,
            req.body.override_image_url || null,
            Number(req.body.is_enabled ?? 1),
          ]
        );
      }
      const row = (
        await query(
          'SELECT * FROM marketplace_product_overrides WHERE provider = $1 AND product_id = $2',
          [provider, req.body.product_id]
        )
      ).rows[0];
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/settlement', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = ["status = 'COMPLETED'"];
    const params = [];
    let p = 1;
    if (from) {
      where.push(`completed_at >= $${p++}`);
      params.push(from);
    }
    if (to) {
      where.push(`completed_at <= $${p++}`);
      params.push(to);
    }
    const rows = (
      await query(
        `SELECT channel AS provider, COUNT(*) AS completed_orders, SUM(total) AS gross_revenue
         FROM online_orders WHERE ${where.join(' AND ')}
         GROUP BY channel ORDER BY channel`,
        params
      )
    ).rows;
    const conns = (await query('SELECT provider, mdr_percent FROM marketplace_connections')).rows;
    const mdrByProvider = new Map(conns.map((c) => [c.provider, Number(c.mdr_percent || 0)]));

    const enriched = rows.map((r) => {
      const gross = Number(r.gross_revenue || 0);
      const mdrPct = mdrByProvider.get(r.provider) || 0;
      const mdr = (gross * mdrPct) / 100;
      return {
        provider: r.provider,
        completed_orders: Number(r.completed_orders),
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
