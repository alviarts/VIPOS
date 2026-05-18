'use strict';

/**
 * P2-06: shared security middleware factories.
 *
 * Three independent concerns live here so `app.js` can wire them in a
 * single import:
 *
 *  - `configureTrustProxy(app)` — flips Express's `trust proxy` setting
 *    so `req.ip` reflects the upstream client (X-Forwarded-For) instead
 *    of the load balancer. Required for per-IP rate limiting to behave
 *    correctly behind nginx / Cloudflare / Heroku-style routers.
 *
 *  - `helmetMiddleware()` — sane Helmet defaults plus a relaxed CSP that
 *    matches what the React/Vite frontend actually needs. CSP is
 *    intentionally disabled outside `NODE_ENV=production` so the dev
 *    server (Vite HMR, websocket) keeps working without bespoke
 *    workarounds.
 *
 *  - `corsMiddleware()` — strict origin allowlist driven by the
 *    `CORS_ALLOWLIST` env var. Fail-closed in production: if the env is
 *    missing the helper throws on first call so the misconfiguration is
 *    impossible to miss. Local dev gets a sensible default
 *    (`http://localhost:5173,http://localhost:3000`) so you can `npm run
 *    dev` without extra setup.
 */

const cors = require('cors');
const helmet = require('helmet');
const { logger } = require('./logger');

const DEV_ALLOWLIST = ['http://localhost:5173', 'http://localhost:3000'];

const TRUST_PROXY_DEFAULT = 'loopback, linklocal, uniquelocal';

/**
 * Configure Express's trust-proxy setting based on the `TRUST_PROXY`
 * env var. Accepts:
 *
 *  - unset / empty: defaults to `'loopback, linklocal, uniquelocal'`
 *    which lets `req.ip` use `X-Forwarded-For` only when the request
 *    arrives via a private network (typical nginx-on-localhost
 *    deploy).
 *  - integer string (e.g. `'1'`): trust the N-th proxy hop.
 *  - `'true'`: trust ALL proxies (only safe behind a closed network).
 *  - any other string: passed verbatim (CIDR list, hostname, etc.)
 *    per the Express docs.
 *
 * @param {import('express').Express} app
 */
function configureTrustProxy(app) {
  const raw = process.env.TRUST_PROXY;
  if (!raw || raw.trim() === '') {
    app.set('trust proxy', TRUST_PROXY_DEFAULT);
    return TRUST_PROXY_DEFAULT;
  }
  const trimmed = raw.trim();
  if (trimmed === 'true') {
    app.set('trust proxy', true);
    return true;
  }
  if (trimmed === 'false') {
    app.set('trust proxy', false);
    return false;
  }
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    app.set('trust proxy', n);
    return n;
  }
  app.set('trust proxy', trimmed);
  return trimmed;
}

/**
 * Build the Helmet middleware chain. Returns a single middleware
 * function so callers can `app.use(helmetMiddleware())`.
 *
 * Production: Helmet defaults + an explicit `contentSecurityPolicy`
 * directive set tuned for a Vite/React SPA (allows inline styles for
 * Material UI, allows inline `<script>` only for the bootstrap entry,
 * permits images and fonts from data URIs / HTTPS). Dev: CSP disabled
 * to avoid breaking Vite HMR.
 *
 * `crossOriginEmbedderPolicy` is disabled because the SPA loads images
 * (uploads) cross-origin and `require-corp` would block them.
 */
function helmetMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    });
  }

  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
        // Disable upgrade-insecure-requests so HTTP→HTTPS upgrade is
        // explicit (handled at the nginx layer per defaults #7).
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

/**
 * Parse a comma-separated env var into a unique, trimmed origin list.
 *
 * @param {string | undefined} raw
 * @returns {string[]}
 */
function parseAllowlist(raw) {
  if (!raw) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Resolve the effective CORS allowlist, honouring env + dev fallback.
 *
 * @returns {{ origins: string[], wildcard: boolean }}
 */
function resolveAllowlist() {
  const fromEnv = parseAllowlist(process.env.CORS_ALLOWLIST);
  if (fromEnv.length > 0) {
    return {
      origins: fromEnv,
      wildcard: fromEnv.includes('*'),
    };
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CORS_ALLOWLIST must be set in production (e.g. CORS_ALLOWLIST=https://app.vipos.id)'
    );
  }
  return { origins: DEV_ALLOWLIST.slice(), wildcard: false };
}

/**
 * Build the CORS middleware. Honours `CORS_ALLOWLIST` env var; supports
 * the literal `*` entry to opt in to wildcard explicitly.
 *
 * Same-origin requests (no `Origin` header — typical curl, server-to-
 * server) are allowed unconditionally so internal traffic is never
 * blocked.
 */
function corsMiddleware() {
  const { origins, wildcard } = resolveAllowlist();
  if (wildcard) {
    logger.warn(
      { component: 'cors', allowlist: origins },
      'CORS allowlist contains "*" — all origins will be accepted. ' +
        'This is intentional only for staging or fully-public APIs.'
    );
    return cors({
      origin: true,
      credentials: false,
    });
  }

  const allowed = new Set(origins);
  return cors({
    origin(origin, callback) {
      if (!origin) {
        // Same-origin / curl / server-to-server.
        return callback(null, true);
      }
      if (allowed.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not in CORS_ALLOWLIST`));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Tenant-ID'],
    exposedHeaders: ['X-Request-ID', 'Deprecation', 'Sunset', 'Link'],
  });
}

module.exports = {
  configureTrustProxy,
  helmetMiddleware,
  corsMiddleware,
  resolveAllowlist,
  parseAllowlist,
  DEV_ALLOWLIST,
  TRUST_PROXY_DEFAULT,
};
