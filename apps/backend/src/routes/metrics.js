// P2-05 PR-B — `GET /metrics` Prometheus scrape endpoint.
//
// Returns the shared `prom-client` registry in the standard text
// exposition format (`text/plain; version=0.0.4`). Mounted at the
// app root (not under `/api/v1`) per Prometheus convention so
// scrape configs can hard-code the path.
//
// Auth gating:
//   - When `METRICS_TOKEN` is unset (the default) the endpoint is
//     open. Mirrors the `/health` opt-in pattern — most deployments
//     scrape from a private network anyway.
//   - When `METRICS_TOKEN` is set, callers must present
//     `Authorization: Bearer <token>` matching the env value. A
//     constant-time comparison guards against timing oracles.

const crypto = require('crypto');
const express = require('express');

const { renderMetrics, registry } = require('../lib/metrics');

const BEARER_PREFIX = 'Bearer ';

/**
 * Constant-time string compare. `crypto.timingSafeEqual` requires
 * matching lengths, so we wrap it in a length pre-check that returns
 * false rather than throwing.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Read the configured metrics bearer token. Returns `null` when the
 * env var is unset or empty so callers can short-circuit auth.
 *
 * @returns {string | null}
 */
function getMetricsToken() {
  const raw = process.env.METRICS_TOKEN;
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Bearer-token gate. No-op when `METRICS_TOKEN` is unset.
 *
 * @returns {import('express').RequestHandler}
 */
function metricsAuth() {
  return function metricsAuth(req, res, next) {
    const expected = getMetricsToken();
    if (!expected) return next();

    const header = req.get('authorization') || '';
    if (!header.startsWith(BEARER_PREFIX)) {
      return res.status(401).type('text/plain').send('unauthorized');
    }
    const provided = header.slice(BEARER_PREFIX.length).trim();
    if (!safeEqual(provided, expected)) {
      return res.status(401).type('text/plain').send('unauthorized');
    }
    return next();
  };
}

const router = express.Router();

router.get('/', metricsAuth(), async (_req, res) => {
  try {
    const body = await renderMetrics();
    res.set('Content-Type', registry.contentType);
    // Prometheus scrapes are short-lived and often load-balanced —
    // turn off any intermediate caching so consecutive scrapes
    // never see stale state.
    res.set('Cache-Control', 'no-store');
    res.status(200).send(body);
  } catch (err) {
    res.status(500).type('text/plain').send(`# metrics render failed: ${err.message}`);
  }
});

module.exports = {
  router,
  metricsAuth,
  getMetricsToken,
};
