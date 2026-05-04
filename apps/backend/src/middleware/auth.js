const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'vipos-secret-key-2024';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if (decoded.tenant_id != null) {
      req.tenantId = decoded.tenant_id;
    }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token tidak valid' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya admin yang diizinkan.' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya super-admin yang diizinkan.' });
  }
  next();
}

module.exports = { authenticateToken, requireAdmin, requireSuperAdmin, JWT_SECRET };
