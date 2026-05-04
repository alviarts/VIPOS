// VIPOS — tier-based feature flag middleware (P2-02 multi-tenant foundation).
//
// Each tenant has a subscription `tier` stored in the `tenants` table. We
// expose a small middleware factory `requireTier(min)` that 403s if the
// tenant's tier rank is below the required minimum.
//
// Tier ranking (low -> high), matches `docs/v2/06_FEATURE_TIERS.md`:
//   lite < starter < advance < prime < prime_plus
//
// Usage:
//   const { requireTier } = require('../middleware/tier');
//   router.get('/komisi', authenticateToken, requireTier('advance'), handler);
const { query } = require('../db');

const TIER_RANK = Object.freeze({
  lite: 1,
  starter: 2,
  advance: 3,
  prime: 4,
  prime_plus: 5,
});

const TIER_ALIASES = Object.freeze({
  'prime+': 'prime_plus',
  'prime-plus': 'prime_plus',
});

function normalizeTier(t) {
  if (!t) return 'lite';
  const lower = String(t).toLowerCase().trim();
  return TIER_ALIASES[lower] || lower;
}

function tierRank(tier) {
  return TIER_RANK[normalizeTier(tier)] || 0;
}

async function fetchTenantTier(tenantId) {
  if (tenantId == null) return null;
  const r = await query('SELECT tier, status FROM tenants WHERE id = $1', [tenantId]);
  return r.rows[0] || null;
}

function requireTier(minTier) {
  const minRank = tierRank(minTier);
  if (!minRank) {
    throw new Error(`requireTier(): unknown tier "${minTier}"`);
  }
  return async function tierGuard(req, res, next) {
    try {
      if (req.tenantId == null) {
        return res.status(403).json({ error: 'Tenant tidak terdeteksi' });
      }
      const tenant = await fetchTenantTier(req.tenantId);
      if (!tenant) {
        return res.status(403).json({ error: 'Tenant tidak ditemukan' });
      }
      if (tenant.status !== 'active') {
        return res.status(403).json({ error: `Tenant status ${tenant.status}` });
      }
      const rank = tierRank(tenant.tier);
      if (rank < minRank) {
        return res.status(403).json({
          error: `Fitur ini butuh tier ${minTier} atau lebih tinggi (tenant kamu: ${tenant.tier})`,
          required_tier: normalizeTier(minTier),
          current_tier: normalizeTier(tenant.tier),
        });
      }
      req.tenantTier = normalizeTier(tenant.tier);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  requireTier,
  TIER_RANK,
  normalizeTier,
  tierRank,
};
