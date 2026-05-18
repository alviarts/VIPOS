// VIPOS — Per-endpoint rate limit configuration.
//
// Defines rate limit tiers for different endpoint categories.
// The actual rate-limit middleware (express-rate-limit) is
// already installed in the project; this module provides
// pre-configured instances for common patterns.
//
// Usage in routes:
//   const { authLimiter, apiLimiter } = require('../middleware/rate-limit-config');
//   router.post('/login', authLimiter, handler);

const rateLimit = require('express-rate-limit');

/**
 * Auth endpoints: strict limit to prevent brute-force.
 * 5 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API endpoints: moderate limit.
 * 100 requests per minute per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Terlalu banyak request. Coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Write-heavy endpoints (transactions, mutations): tighter limit.
 * 30 requests per minute per IP.
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Terlalu banyak operasi tulis. Coba lagi nanti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * QRIS polling: relaxed limit (polls every 3s).
 * 200 requests per minute per IP.
 */
const pollingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Rate limit exceeded for polling.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  apiLimiter,
  writeLimiter,
  pollingLimiter,
};
