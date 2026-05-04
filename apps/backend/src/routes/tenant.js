// VIPOS — tenant management routes (P2-02 multi-tenant foundation).
//
// Public:
//   POST /api/v1/tenant/register     — sign up a new tenant + first admin user
//
// Authenticated (tenant-scoped):
//   GET  /api/v1/tenant/me           — return the caller's tenant
//
// Super-admin only (cross-tenant):
//   GET    /api/admin/tenant         — list every tenant
//   POST   /api/admin/tenant         — create a tenant (without admin user)
//   GET    /api/admin/tenant/:id     — read a tenant
//   PATCH  /api/admin/tenant/:id     — update tier / status / name / metadata
//   DELETE /api/admin/tenant/:id     — soft-archive a tenant
const express = require('express');
const bcrypt = require('bcryptjs');
const { query, tx } = require('../db');
const { authenticateToken, requireSuperAdmin, requireAdmin } = require('../middleware/auth');
const {
  KNOWN_TEMPLATES,
  isKnownTemplate,
  listTemplates,
  seedTemplate,
} = require('../lib/onboarding-templates');
const {
  signAccessToken,
  generateOpaqueToken,
  hashToken,
  refreshExpiry,
  ACCESS_TOKEN_TTL_SECONDS,
} = require('../utils/tokens');
const { normalizeTier, TIER_RANK } = require('../middleware/tier');

const router = express.Router();

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

function validRequiredString(value, max = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function publicTenantShape(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tier: row.tier,
    status: row.status,
    metadata: row.metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.post('/register', async (req, res) => {
  try {
    const {
      tenant_slug,
      tenant_name,
      tier,
      admin_username,
      admin_password,
      admin_name,
      admin_email,
    } = req.body || {};

    if (!validRequiredString(tenant_slug, 40) || !SLUG_REGEX.test(tenant_slug)) {
      return res.status(400).json({
        error:
          'tenant_slug harus 2-40 karakter (a-z, 0-9, -), tidak boleh diawali/diakhiri tanda hubung',
      });
    }
    if (!validRequiredString(tenant_name)) {
      return res.status(400).json({ error: 'tenant_name wajib diisi' });
    }
    if (!validRequiredString(admin_username, 60)) {
      return res.status(400).json({ error: 'admin_username wajib diisi' });
    }
    if (typeof admin_password !== 'string' || admin_password.length < 6) {
      return res.status(400).json({ error: 'admin_password minimal 6 karakter' });
    }
    if (!validRequiredString(admin_name)) {
      return res.status(400).json({ error: 'admin_name wajib diisi' });
    }
    const normalizedTier = normalizeTier(tier || 'lite');
    if (!TIER_RANK[normalizedTier]) {
      return res.status(400).json({
        error: `tier tidak dikenali. Pilihan: ${Object.keys(TIER_RANK).join(', ')}`,
      });
    }

    const existingSlug = (await query('SELECT id FROM tenants WHERE slug = $1', [tenant_slug]))
      .rows[0];
    if (existingSlug) {
      return res.status(409).json({ error: 'tenant_slug sudah digunakan' });
    }
    const existingUser = (await query('SELECT id FROM users WHERE username = $1', [admin_username]))
      .rows[0];
    if (existingUser) {
      return res.status(409).json({ error: 'admin_username sudah digunakan' });
    }

    const hashed = bcrypt.hashSync(admin_password, 10);
    const result = await tx(async (txQuery) => {
      const tenantRow = (
        await txQuery(
          `INSERT INTO tenants (slug, name, tier, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING id, slug, name, tier, status, metadata, created_at, updated_at`,
          [tenant_slug, tenant_name, normalizedTier]
        )
      ).rows[0];
      const userRow = (
        await txQuery(
          `INSERT INTO users (username, password, name, role, email, tenant_id)
           VALUES ($1, $2, $3, 'admin', $4, $5)
           RETURNING id, username, name, role, email, tenant_id`,
          [admin_username, hashed, admin_name, admin_email || null, tenantRow.id]
        )
      ).rows[0];
      await txQuery(
        `INSERT INTO tenant_users (tenant_id, user_id, role, is_default)
         VALUES ($1, $2, 'admin', TRUE)`,
        [tenantRow.id, userRow.id]
      );
      return { tenant: tenantRow, user: userRow };
    });

    const token = signAccessToken(result.user);
    const refreshRaw = generateOpaqueToken();
    const refreshHash = hashToken(refreshRaw);
    const refreshExp = refreshExpiry(false).toISOString();
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [result.user.id, refreshHash, refreshExp]
    );

    res.status(201).json({
      message: 'Tenant berhasil dibuat',
      tenant: publicTenantShape(result.tenant),
      user: {
        id: result.user.id,
        username: result.user.username,
        name: result.user.name,
        role: result.user.role,
        email: result.user.email,
        tenant_id: result.user.tenant_id,
      },
      token,
      refresh_token: refreshRaw,
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Konflik unik: slug atau username sudah dipakai' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    if (tenantId == null) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan di token' });
    }
    const r = await query(
      `SELECT id, slug, name, tier, status, metadata, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [tenantId]
    );
    const tenant = r.rows[0];
    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    res.json(publicTenantShape(tenant));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Onboarding sample-data templates (PR-4). Lists the bundled F&B / Retail /
// Salon presets so the wizard can show preview cards, and seeds the chosen
// preset's categories + products into the caller's tenant. Seeding is
// idempotent: re-running for the same tenant skips rows that already exist
// (UNIQUE on (tenant_id, name) for categories, (tenant_id, sku) for products).
router.get('/onboarding/templates', authenticateToken, (_req, res) => {
  try {
    res.json({ templates: listTemplates() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/onboarding/seed-template', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { template } = req.body || {};
    if (!isKnownTemplate(template)) {
      return res.status(400).json({
        error: `template tidak dikenali. Pilihan: ${KNOWN_TEMPLATES.join(', ')}`,
      });
    }
    const summary = await tx(async (txQuery) => seedTemplate(template, txQuery));
    res.status(201).json(summary);
  } catch (err) {
    if (err && err.code === 'UNKNOWN_TEMPLATE') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Flag the wizard finished. Stored as ISO-8601 timestamp on
// `tenants.metadata.onboarding_completed_at` so the wizard route can
// short-circuit to /dashboard for users who already saw it. Idempotent —
// re-posting overwrites with the latest timestamp; never errors.
router.post('/onboarding/complete', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    if (tenantId == null) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan di token' });
    }
    const r = await query(
      `UPDATE tenants
       SET metadata = COALESCE(metadata, '{}'::jsonb) ||
                      jsonb_build_object('onboarding_completed_at', to_jsonb(NOW())),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, slug, name, tier, status, metadata, created_at, updated_at`,
      [tenantId]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    res.json(publicTenantShape(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const adminRouter = express.Router();

adminRouter.use(authenticateToken, requireSuperAdmin);

adminRouter.get('/', async (req, res) => {
  try {
    const r = await query(
      `SELECT id, slug, name, tier, status, metadata, created_at, updated_at
       FROM tenants ORDER BY id ASC`
    );
    res.json(r.rows.map(publicTenantShape));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/', async (req, res) => {
  try {
    const { slug, name, tier, status, metadata } = req.body || {};
    if (!validRequiredString(slug, 40) || !SLUG_REGEX.test(slug)) {
      return res.status(400).json({ error: 'slug tidak valid' });
    }
    if (!validRequiredString(name)) {
      return res.status(400).json({ error: 'name wajib diisi' });
    }
    const normalizedTier = normalizeTier(tier || 'lite');
    if (!TIER_RANK[normalizedTier]) {
      return res.status(400).json({ error: 'tier tidak dikenali' });
    }
    const r = await query(
      `INSERT INTO tenants (slug, name, tier, status, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, slug, name, tier, status, metadata, created_at, updated_at`,
      [slug, name, normalizedTier, status || 'active', metadata || null]
    );
    res.status(201).json(publicTenantShape(r.rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'slug sudah dipakai' });
    }
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
    const r = await query(
      `SELECT id, slug, name, tier, status, metadata, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [id]
    );
    const tenant = r.rows[0];
    if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    res.json(publicTenantShape(tenant));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
    const { name, tier, status, metadata } = req.body || {};
    const sets = [];
    const params = [];
    if (name !== undefined) {
      if (!validRequiredString(name)) {
        return res.status(400).json({ error: 'name tidak valid' });
      }
      params.push(name);
      sets.push(`name = $${params.length}`);
    }
    if (tier !== undefined) {
      const normalizedTier = normalizeTier(tier);
      if (!TIER_RANK[normalizedTier]) {
        return res.status(400).json({ error: 'tier tidak dikenali' });
      }
      params.push(normalizedTier);
      sets.push(`tier = $${params.length}`);
    }
    if (status !== undefined) {
      if (!['active', 'suspended', 'archived'].includes(status)) {
        return res.status(400).json({ error: 'status tidak valid' });
      }
      params.push(status);
      sets.push(`status = $${params.length}`);
    }
    if (metadata !== undefined) {
      params.push(metadata);
      sets.push(`metadata = $${params.length}`);
    }
    if (!sets.length) {
      return res.status(400).json({ error: 'Tidak ada field yang diubah' });
    }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);
    const r = await query(
      `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, slug, name, tier, status, metadata, created_at, updated_at`,
      params
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    res.json(publicTenantShape(r.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id tidak valid' });
    if (id === 1) {
      return res.status(400).json({ error: 'Tenant default tidak boleh dihapus' });
    }
    const r = await query(
      `UPDATE tenants SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Tenant tidak ditemukan' });
    res.json({ message: 'Tenant di-arsipkan', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, adminRouter };
