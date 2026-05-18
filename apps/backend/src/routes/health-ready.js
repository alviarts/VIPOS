// VIPOS — Readiness probe (P4-14 production readiness).
//
// Unlike /api/v1/health (liveness — always 200 if process is up),
// this endpoint checks all critical dependencies and returns 503
// if any are unhealthy. Used by load balancers and monitoring.
//
// Surface:
//   GET /api/v1/health/ready
//     200: { ready: true, checks: {...} }
//     503: { ready: false, checks: {...}, failed: [...] }

const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.get('/ready', async (_req, res) => {
  const checks = {};
  const failed = [];

  // Check 1: Database connectivity
  try {
    const start = Date.now();
    await query('SELECT 1 as ok');
    checks.database = { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    checks.database = { status: 'error', error: err.message };
    failed.push('database');
  }

  // Check 2: Database can read a table (RLS works)
  try {
    const start = Date.now();
    const { rows } = await query('SELECT COUNT(*) as cnt FROM tenants');
    checks.database_read = {
      status: 'ok',
      latency_ms: Date.now() - start,
      tenant_count: Number(rows[0].cnt),
    };
  } catch (err) {
    checks.database_read = { status: 'error', error: err.message };
    failed.push('database_read');
  }

  // Check 3: Disk space (basic — process can write to tmp)
  try {
    const fs = require('fs');
    const tmpFile = `/tmp/vipos-health-${Date.now()}`;
    fs.writeFileSync(tmpFile, 'ok');
    fs.unlinkSync(tmpFile);
    checks.disk_write = { status: 'ok' };
  } catch (err) {
    checks.disk_write = { status: 'error', error: err.message };
    failed.push('disk_write');
  }

  // Check 4: Memory usage
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  checks.memory = {
    status: heapUsedMB < 512 ? 'ok' : 'warning',
    heap_used_mb: heapUsedMB,
    heap_total_mb: heapTotalMB,
    rss_mb: Math.round(mem.rss / 1024 / 1024),
  };

  const ready = failed.length === 0;
  const statusCode = ready ? 200 : 503;

  return res.status(statusCode).json({
    ready,
    checks,
    failed: failed.length > 0 ? failed : undefined,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
  });
});

module.exports = router;
