// Enhanced metrics endpoint for monitoring (P4-optimization).
//
// Exposes runtime metrics, cache stats, and system health for
// monitoring dashboards (Grafana, Datadog, etc).

const express = require('express');
const { query } = require('../db');
const cache = require('../lib/cache');

const router = express.Router();

// Track request counts and response times
const metrics = {
  requests: {
    total: 0,
    success: 0,
    error: 0,
  },
  responseTimes: [],
  startTime: Date.now(),
};

// Middleware to track metrics
function trackMetrics(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    metrics.requests.total++;
    if (res.statusCode < 400) {
      metrics.requests.success++;
    } else {
      metrics.requests.error++;
    }
    
    const duration = Date.now() - start;
    metrics.responseTimes.push(duration);
    
    // Keep only last 1000 response times
    if (metrics.responseTimes.length > 1000) {
      metrics.responseTimes.shift();
    }
  });
  
  next();
}

// Public metrics endpoint (no auth for monitoring tools)
router.get('/', async (req, res) => {
  try {
    const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
    
    // Calculate response time percentiles
    const sorted = [...metrics.responseTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avg = sorted.length > 0 
      ? sorted.reduce((a, b) => a + b, 0) / sorted.length 
      : 0;
    
    // Database connection check
    let dbHealthy = false;
    let dbLatency = 0;
    try {
      const start = Date.now();
      await query('SELECT 1');
      dbLatency = Date.now() - start;
      dbHealthy = true;
    } catch (err) {
      // DB unhealthy
    }
    
    // Cache stats
    const cacheStats = cache.stats();
    
    // Memory usage
    const mem = process.memoryUsage();
    
    res.json({
      status: 'ok',
      uptime_seconds: uptime,
      timestamp: new Date().toISOString(),
      
      requests: {
        total: metrics.requests.total,
        success: metrics.requests.success,
        error: metrics.requests.error,
        error_rate: metrics.requests.total > 0 
          ? (metrics.requests.error / metrics.requests.total * 100).toFixed(2) + '%'
          : '0%',
      },
      
      response_times_ms: {
        avg: Math.round(avg),
        p50: p50,
        p95: p95,
        p99: p99,
        samples: sorted.length,
      },
      
      database: {
        healthy: dbHealthy,
        latency_ms: dbLatency,
      },
      
      cache: {
        size: cacheStats.size,
        keys: cacheStats.keys.length,
      },
      
      memory: {
        rss_mb: Math.round(mem.rss / 1024 / 1024),
        heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
        external_mb: Math.round(mem.external / 1024 / 1024),
      },
      
      process: {
        pid: process.pid,
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      error: err.message,
    });
  }
});

module.exports = { router, trackMetrics };
