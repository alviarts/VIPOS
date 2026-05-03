// VIPOS — Permission + Tier context
//
// Wraps role-based + tier-based feature flagging. Reads role from AuthContext
// and tier from a stored subscription state (mocked for now until the backend
// /api/me/subscription endpoint exists). Components consume `can()` to gate UI.
//
// Spec (P1-01):
// - 9 built-in roles (OWNER, MANAGER, KASIR, STAFF, WAREHOUSE, WAITERS, KITCHEN,
//   ORDER_DISPLAY, SELF_ORDER) — derived from docs/v2/05_PERMISSIONS.md.
// - 5 tiers (LITE, STARTER, ADVANCE, PRIME, PRIME_PLUS) — derived from
//   docs/v2/06_FEATURE_TIERS.md.
//
// Permission matrix is intentionally small here — we only encode the
// menu-group-level visibility ("can this role see this menu group at all?").
// Per-action permissions (V/C/U/D) live in feature pages later.
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const PermissionContext = createContext(null);

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  KASIR: 'kasir',
  STAFF: 'staff',
  WAREHOUSE: 'warehouse',
  WAITERS: 'waiters',
  KITCHEN: 'kitchen',
  ORDER_DISPLAY: 'order_display',
  SELF_ORDER: 'self_order',
};

export const TIERS = {
  LITE: 'lite',
  STARTER: 'starter',
  ADVANCE: 'advance',
  PRIME: 'prime',
  PRIME_PLUS: 'prime_plus',
};

const TIER_RANK = {
  [TIERS.LITE]: 0,
  [TIERS.STARTER]: 1,
  [TIERS.ADVANCE]: 2,
  [TIERS.PRIME]: 3,
  [TIERS.PRIME_PLUS]: 4,
};

// Roles with full owner-level access.
const FULL_ACCESS_ROLES = new Set([ROLES.OWNER, ROLES.ADMIN]);

function normalizeRole(role) {
  if (!role) return ROLES.STAFF;
  return String(role).toLowerCase().replace(/[^a-z_]/g, '_');
}

function normalizeTier(tier) {
  if (!tier) return TIERS.LITE;
  return String(tier).toLowerCase().replace(/[^a-z_]/g, '_');
}

export function PermissionProvider({ children, mockTier }) {
  const { user } = useAuth();

  const role = normalizeRole(user?.role);
  // Tier resolution priority:
  // 1. Explicit prop (used by tests + Storybook)
  // 2. user.subscription.tier (future backend)
  // 3. fallback PRIME (semua fitur kelihatan saat dev/local; production akan
  //    override via prop dari shell setelah panggil /api/me/subscription).
  const tier = normalizeTier(mockTier ?? user?.subscription?.tier ?? TIERS.PRIME);

  const value = useMemo(() => {
    const hasRole = (allowed) => {
      if (!allowed || allowed.length === 0) return true;
      if (FULL_ACCESS_ROLES.has(role)) return true;
      return allowed.includes(role);
    };

    const hasTier = (minTier) => {
      if (!minTier) return true;
      const min = TIER_RANK[normalizeTier(minTier)] ?? 0;
      const cur = TIER_RANK[tier] ?? 0;
      return cur >= min;
    };

    const canAccess = ({ roles, minTier } = {}) => hasRole(roles) && hasTier(minTier);

    return { role, tier, hasRole, hasTier, canAccess };
  }, [role, tier]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermission() {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error('usePermission must be used inside PermissionProvider');
  }
  return ctx;
}
