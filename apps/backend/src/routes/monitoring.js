// Monitoring and observability endpoints (P4-optimization).
//
// Surface:
//   GET /api/v1/monitoring/cache-stats    Cache statistics
//   GET /api/v1/monitoring/db-stats       Database connection pool stats
//   GET /api/v1/monitoring/metrics        Application metrics

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const cache = require('../lib/cache');
const { pool } = require('../db');

const router = express.Router();

// Cache statistics (admin only)
router.get('/cache-stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const stats = cache.stats();
  return res.json({
    cache_size: stats.size,
    cache_keys: stats.keys,
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// Database connection pool stats (admin only)
router.get('/db-stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  return res.json({
    total_connections: pool.totalCount,
    idle_connections: pool.idleCount,
    waiting_requests: pool.waitingCount,
  });
});

// Application metrics (admin only)
router.get('/metrics', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const memUsage = process.memoryUsage();

  return res.json({
    uptime_seconds: Math.floor(process.uptime()),
    memory: {
      rss_mb: Math.round(memUsage.rss / 1024 / 1024),
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      external_mb: Math.round(memUsage.external / 1024 / 1024),
    },
    node_version: process.version,
    platform: process.platform,
    pid: process.pid,
  });
});

module.exports = router;
