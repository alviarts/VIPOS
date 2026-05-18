const jwt = require('jsonwebtoken');
const { runWithTenant, runAsSystem } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'vipos-secret-key-2024';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    return res.status(403).json({ error: 'Token tidak valid' });
  }

  req.user = decoded;
  // P2-02: bind tenant scope to the AsyncLocalStorage so every downstream
  // `query()` / `tx()` runs with `SET LOCAL app.current_tenant = $tenantId`
  // and RLS policies filter rows automatically.
  if (decoded.tenant_id != null) {
    req.tenantId = decoded.tenant_id;
    return runWithTenant(decoded.tenant_id, () => next());
  }
  next();
}

function requireAdmin(req, res, next) {
  // Tenant OWNER is the highest in-tenant role and effectively the "admin" of
  // their own tenant, so it bypasses this gate alongside the SaaS-level
  // ADMIN and SUPER_ADMIN. The frontend `hideForNonAdmin` flag still uses a
  // strict role === ADMIN check (PermissionContext) so tenant owners do not
  // see WIP menus reserved for the platform admin.
  if (req.user.role !== 'owner' && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya admin yang diizinkan.' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya super-admin yang diizinkan.' });
  }
  // Super-admin operations are inherently cross-tenant (manage every tenant
  // record), so we elevate to the system context that bypasses RLS for the
  // remainder of the request. Without this the previous runWithTenant() set
  // by authenticateToken would block updates to other tenants' rows.
  return runAsSystem(() => next());
}

module.exports = { authenticateToken, requireAdmin, requireSuperAdmin, JWT_SECRET };
