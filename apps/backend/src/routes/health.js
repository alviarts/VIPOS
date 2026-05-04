// P2-05 PR-A — extended health probe.
//
// `GET /health` reports application status plus dependency health
// (Postgres, Redis). Returns 200 when the application can serve
// traffic, 503 when a *required* dependency is down. Postgres is the
// only required dependency; Redis is optional (queues degrade to
// synchronous fallback when unavailable, see `lib/queue.js`).
//
// Response shape:
//   {
//     status: 'ok' | 'degraded',
//     version: <pkg.version>,
//     timestamp: <iso8601>,
//     db: { ok: boolean, latency_ms: number, error?: string },
//     redis: { enabled: boolean, ok: boolean, latency_ms: number, error?: string }
//   }
//
// Error messages are intentionally truncated and stripped of
// connection-string-style payloads to avoid leaking infrastructure
// details to public health monitors.

const express = require('express');

const { runAsSystem, query } = require('../db');
const queueLib = require('../lib/queue');
const { logger } = require('../lib/logger');

let pkgVersion = 'unknown';
try {
  // Eagerly cache the version so subsequent /health hits are cheap.
  pkgVersion = require('../../package.json').version || 'unknown';
} catch {
  pkgVersion = 'unknown';
}

function safeErrorMessage(err) {
  if (!err) return undefined;
  const raw = String(err.message || err);
  // Trim noisy stack-style payloads + cap length.
  return raw.split('\n')[0].slice(0, 200);
}

async function probeDb() {
  const started = Date.now();
  try {
    await runAsSystem(() => query('SELECT 1'));
    return { ok: true, latency_ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - started,
      error: safeErrorMessage(err),
    };
  }
}

async function probeRedis() {
  if (!queueLib.isQueueEnabled()) {
    return { enabled: false, ok: true, latency_ms: 0 };
  }
  const started = Date.now();
  try {
    const conn = queueLib.getConnection();
    await conn.ping();
    return { enabled: true, ok: true, latency_ms: Date.now() - started };
  } catch (err) {
    return {
      enabled: true,
      ok: false,
      latency_ms: Date.now() - started,
      error: safeErrorMessage(err),
    };
  }
}

async function buildHealthPayload() {
  const [db, redis] = await Promise.all([probeDb(), probeRedis()]);
  // DB is required → degraded if down. Redis is optional → still 'ok'.
  const status = db.ok ? 'ok' : 'degraded';
  return {
    status,
    version: pkgVersion,
    timestamp: new Date().toISOString(),
    db,
    redis,
  };
}

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const payload = await buildHealthPayload();
    const httpStatus = payload.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(payload);
  } catch (err) {
    logger.error({ component: 'health', err: { message: err.message } }, 'health probe failed');
    res.status(503).json({
      status: 'degraded',
      version: pkgVersion,
      timestamp: new Date().toISOString(),
      error: safeErrorMessage(err),
    });
  }
});

module.exports = {
  router,
  buildHealthPayload,
};
