/**
 * Health Check & System Status Endpoint
 *
 * Provides comprehensive health information for monitoring:
 * - Database connectivity
 * - Disk space
 * - Memory usage
 * - Backup status
 * - Service uptime
 *
 * Endpoints:
 * - GET /health - Basic health check (for load balancer)
 * - GET /health/detailed - Detailed system status (for monitoring)
 * - GET /health/backup - Backup status check
 */

const express = require('express');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);
const router = express.Router();

// Cache for health check results (avoid hammering system)
let healthCache = {
  data: null,
  timestamp: 0,
  ttl: 30000, // 30 seconds
};

/**
 * Basic health check - fast, minimal overhead
 * Used by load balancers and uptime monitors
 */
router.get('/', async (req, res) => {
  try {
    // Quick database check
    const db = req.app.get('db');
    await db.get('SELECT 1');

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Detailed health check - comprehensive system status
 * Used by monitoring dashboards (Grafana, etc)
 */
router.get('/detailed', async (req, res) => {
  try {
    // Check cache
    const now = Date.now();
    if (healthCache.data && now - healthCache.timestamp < healthCache.ttl) {
      return res.json(healthCache.data);
    }

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // 1. Database Check
    try {
      const db = req.app.get('db');
      const startTime = Date.now();
      await db.get('SELECT 1');
      const latency = Date.now() - startTime;

      // Get database size
      let dbSize = 0;
      try {
        const dbPath = process.env.DATABASE_PATH || 'apps/backend/data/vipos.db';
        const stats = await fs.stat(dbPath);
        dbSize = stats.size;
      } catch (_e) {
        // PostgreSQL or file not accessible
      }

      health.checks.database = {
        status: 'healthy',
        latency: `${latency}ms`,
        size: formatBytes(dbSize),
        type: process.env.DATABASE_URL?.startsWith('postgres') ? 'PostgreSQL' : 'SQLite',
      };
    } catch (error) {
      health.status = 'unhealthy';
      health.checks.database = {
        status: 'unhealthy',
        error: error.message,
      };
    }

    // 2. Disk Space Check
    try {
      const diskInfo = await getDiskSpace();
      const usagePercent = (diskInfo.used / diskInfo.total) * 100;

      health.checks.disk = {
        status: usagePercent > 90 ? 'critical' : usagePercent > 80 ? 'warning' : 'healthy',
        total: formatBytes(diskInfo.total),
        used: formatBytes(diskInfo.used),
        available: formatBytes(diskInfo.available),
        usagePercent: `${usagePercent.toFixed(1)}%`,
      };

      if (usagePercent > 90) {
        health.status = 'degraded';
      }
    } catch (error) {
      health.checks.disk = {
        status: 'unknown',
        error: error.message,
      };
    }

    // 3. Memory Check
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = (usedMem / totalMem) * 100;

    health.checks.memory = {
      status: memPercent > 90 ? 'critical' : memPercent > 80 ? 'warning' : 'healthy',
      process: {
        rss: formatBytes(memUsage.rss),
        heapUsed: formatBytes(memUsage.heapUsed),
        heapTotal: formatBytes(memUsage.heapTotal),
      },
      system: {
        total: formatBytes(totalMem),
        used: formatBytes(usedMem),
        free: formatBytes(freeMem),
        usagePercent: `${memPercent.toFixed(1)}%`,
      },
    };

    // 4. Uptime
    health.checks.uptime = {
      status: 'healthy',
      process: formatUptime(process.uptime()),
      system: formatUptime(require('os').uptime()),
    };

    // 5. Node.js Version
    health.checks.runtime = {
      status: 'healthy',
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    };

    // Cache the result
    healthCache.data = health;
    healthCache.timestamp = now;

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Backup status check
 * Verifies that backups are running and recent
 */
router.get('/backup', async (req, res) => {
  try {
    const backupDir = process.env.BACKUP_ROOT || '/var/backups/vipos';
    const status = {
      status: 'unknown',
      timestamp: new Date().toISOString(),
      backups: [],
    };

    try {
      // Find all backup files
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(
        (f) => f.startsWith('vipos-backup-') && f.endsWith('.tar.gz')
      );

      if (backupFiles.length === 0) {
        status.status = 'critical';
        status.message = 'No backups found';
        return res.status(200).json(status);
      }

      // Get info for each backup
      for (const file of backupFiles.slice(0, 10)) {
        // Last 10 backups
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);

        status.backups.push({
          filename: file,
          size: formatBytes(stats.size),
          created: stats.mtime.toISOString(),
          ageHours: Math.floor((Date.now() - stats.mtime.getTime()) / 3600000),
        });
      }

      // Sort by date (newest first)
      status.backups.sort((a, b) => new Date(b.created) - new Date(a.created));

      // Check latest backup age
      const latestBackup = status.backups[0];
      const ageHours = latestBackup.ageHours;

      if (ageHours < 48) {
        status.status = 'healthy';
        status.message = `Latest backup is ${ageHours} hours old`;
      } else if (ageHours < 168) {
        status.status = 'warning';
        status.message = `Latest backup is ${ageHours} hours old (> 2 days)`;
      } else {
        status.status = 'critical';
        status.message = `Latest backup is ${ageHours} hours old (> 7 days)`;
      }

      status.latestBackup = latestBackup;
      status.totalBackups = status.backups.length;
    } catch (error) {
      if (error.code === 'ENOENT') {
        status.status = 'critical';
        status.message = 'Backup directory not found';
      } else {
        throw error;
      }
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ---------- Helper Functions ----------

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '< 1m';
}

async function getDiskSpace() {
  try {
    // Try df command (Linux/Unix)
    const { stdout } = await execAsync('df -k .');
    const lines = stdout.trim().split('\n');
    const data = lines[1].split(/\s+/);

    return {
      total: parseInt(data[1]) * 1024, // Convert KB to bytes
      used: parseInt(data[2]) * 1024,
      available: parseInt(data[3]) * 1024,
    };
  } catch (_error) {
    // Fallback for Windows or if df fails
    return {
      total: 0,
      used: 0,
      available: 0,
    };
  }
}

module.exports = router;
