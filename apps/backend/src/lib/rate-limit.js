'use strict';

/**
 * P2-06: rate limiting helpers.
 *
 * Two limiters are exported:
 *
 *  - `loginRateLimit()` — strict per-IP gate for `/auth/login` and
 *    `/auth/login/2fa`. Default budget: 5 attempts per 15 minutes per
 *    IP (industry-standard OWASP guidance, slightly stricter than the
 *    docs's `5/min` because credential-stuffing tools batch attempts).
 *
 *  - `apiRateLimit()` — broader gate mounted globally. Budget: 100
 *    requests per minute per **caller** — keyed by the authenticated
 *    `user_id` when present, falling back to `req.ip`. `/metrics` and
 *    any `/health` path are skipped so Prometheus + uptime probes
 *    never burn budget.
 *
 * Both helpers prefer a Redis-backed store (`rate-limit-redis`) when
 * `REDIS_URL` is set, falling back to the in-memory store otherwise.
 * The in-memory fallback keeps the unit tests fast (no Redis required)
 * and means non-Redis local dev still gets *some* protection.
 *
 * The helpers also accept a `windowMs`, `max`, and `keyGenerator`
 * override so tests can crank limits down without monkey-patching.
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('./logger');

const DEFAULT_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_LOGIN_MAX = 5;

const DEFAULT_API_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_API_MAX = 100;

const SKIP_PATHS = new Set(['/metrics', '/health', '/api/health', '/api/v1/health']);
// Prefixes that should also skip the limiter — covers sub-paths like
// `/api/v1/health/backup` (and any future `/health/*` probes) without
// having to enumerate them one-by-one.
const SKIP_PREFIXES = ['/health/', '/api/health/', '/api/v1/health/'];

let RedisStoreCache;
let sharedConnectionFactory;

/**
 * Return true when the calling environment has a Redis URL configured.
 * Tests may override by setting `process.env.REDIS_URL` ad-hoc.
 */
function hasRedis() {
  return Boolean(process.env.REDIS_URL);
}

/**
 * Reset the cached RedisStore class (test hook). Allows tests to
 * inject a fake redis client without dragging the real ioredis
 * connection in.
 */
function _resetForTests() {
  RedisStoreCache = undefined;
  sharedConnectionFactory = undefined;
}

/**
 * Build (or reuse) the shared RedisStore class lazily so the require
 * cost only happens when rate-limit middleware is actually
 * instantiated.
 */
function loadRedisStore() {
  if (!RedisStoreCache) {
    RedisStoreCache = require('rate-limit-redis').RedisStore;
  }
  return RedisStoreCache;
}

/**
 * Build (or reuse) the shared ioredis connection factory. We piggy-
 * back on `lib/queue.getConnection()` so BullMQ + rate-limit share a
 * single TCP connection per process — simplifies pool sizing and
 * cuts socket count.
 */
function getRedisFactory() {
  if (!sharedConnectionFactory) {
    const queue = require('./queue');
    sharedConnectionFactory = () => queue.getConnection();
  }
  return sharedConnectionFactory;
}

/**
 * Build the Redis store for a given prefix. Returns undefined when
 * Redis is not configured so callers fall back to the in-memory
 * store.
 *
 * @param {string} prefix
 */
function buildRedisStore(prefix) {
  if (!hasRedis()) return undefined;
  try {
    const RedisStore = loadRedisStore();
    const client = getRedisFactory()();
    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `vipos:rl:${prefix}:`,
    });
  } catch (err) {
    logger.warn(
      { component: 'rate-limit', err: err.message },
      'Failed to construct Redis store, falling back to in-memory'
    );
    return undefined;
  }
}

/**
 * Construct the login limiter. Per-IP, hard-fail when budget is
 * exhausted. We surface a structured 429 body so the frontend can
 * show a readable error.
 *
 * @param {{ windowMs?: number, max?: number, store?: object, keyGenerator?: Function }} opts
 */
function loginRateLimit(opts = {}) {
  const windowMs = opts.windowMs ?? DEFAULT_LOGIN_WINDOW_MS;
  const max = opts.max ?? DEFAULT_LOGIN_MAX;
  const store = opts.store ?? buildRedisStore('login');

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store,
    keyGenerator: opts.keyGenerator ?? ((req /* , res */) => req.ip || 'unknown'),
    handler(req, res /* , next, options */) {
      if (req.log?.warn) {
        req.log.warn(
          {
            component: 'rate-limit',
            limiter: 'login',
            ip: req.ip,
            path: req.originalUrl,
          },
          'Login rate limit exceeded'
        );
      }
      res.status(429).json({
        error: 'Too many login attempts. Please wait and try again.',
        retry_after_seconds: Math.ceil(windowMs / 1000),
      });
    },
  });
}

/**
 * Construct the global API limiter. Keyed per authenticated user when
 * available (so a busy multi-user tenant on a single egress IP doesn't
 * starve), falling back to `req.ip`. `/metrics` and every `/health`
 * variant skip the limiter so observability scrapes don't burn budget.
 *
 * @param {{ windowMs?: number, max?: number, store?: object, keyGenerator?: Function, skip?: Function }} opts
 */
function apiRateLimit(opts = {}) {
  const windowMs = opts.windowMs ?? DEFAULT_API_WINDOW_MS;
  const max = opts.max ?? DEFAULT_API_MAX;
  const store = opts.store ?? buildRedisStore('api');

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store,
    skip:
      opts.skip ??
      ((req) => {
        const url = req.originalUrl || req.url || '';
        const path = url.split('?')[0];
        if (SKIP_PATHS.has(path)) return true;
        return SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
      }),
    keyGenerator:
      opts.keyGenerator ??
      ((req /* , res */) => {
        const userId = req.user?.user_id ?? req.user?.id;
        if (userId !== undefined && userId !== null) {
          return `user:${userId}`;
        }
        return `ip:${req.ip || 'unknown'}`;
      }),
    handler(req, res /* , next, options */) {
      if (req.log?.warn) {
        req.log.warn(
          {
            component: 'rate-limit',
            limiter: 'api',
            user_id: req.user?.user_id ?? req.user?.id ?? null,
            ip: req.ip,
            path: req.originalUrl,
          },
          'API rate limit exceeded'
        );
      }
      res.status(429).json({
        error: 'Rate limit exceeded',
        retry_after_seconds: Math.ceil(windowMs / 1000),
      });
    },
  });
}

module.exports = {
  loginRateLimit,
  apiRateLimit,
  hasRedis,
  buildRedisStore,
  SKIP_PATHS,
  SKIP_PREFIXES,
  DEFAULT_LOGIN_WINDOW_MS,
  DEFAULT_LOGIN_MAX,
  DEFAULT_API_WINDOW_MS,
  DEFAULT_API_MAX,
  _resetForTests,
};
