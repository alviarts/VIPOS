/**
 * Audit Log Routes
 *
 * Endpoints for viewing audit logs.
 * Only accessible by OWNER and MANAGER roles.
 */

const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbac');
const { getAuditLogs, getUserAuditLogs, searchAuditLogs } = require('../middleware/audit-log');
const { captureError } = require('../lib/sentry');

/**
 * GET /api/audit-logs
 * Search audit logs with filters.
 *
 * Query params:
 * - action: Filter by action type
 * - userId: Filter by user
 * - resourceType: Filter by resource type
 * - startDate: Filter by start date
 * - endDate: Filter by end date
 * - limit: Number of results (default 100, max 1000)
 * - offset: Pagination offset
 */
router.get('/', requireRole('MANAGER'), async (req, res) => {
  try {
    const filters = {
      action: req.query.action,
      userId: req.query.userId,
      resourceType: req.query.resourceType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };

    const options = {
      limit: Math.min(parseInt(req.query.limit) || 100, 1000),
      offset: parseInt(req.query.offset) || 0,
    };

    const logs = await searchAuditLogs(filters, options);

    res.json({
      logs,
      count: logs.length,
      filters,
      pagination: {
        limit: options.limit,
        offset: options.offset,
      },
    });
  } catch (error) {
    captureError(error, { context: 'audit-logs-search' });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit logs',
    });
  }
});

/**
 * GET /api/audit-logs/resource/:resourceType/:resourceId
 * Get audit logs for a specific resource.
 */
router.get('/resource/:resourceType/:resourceId', requireRole('MANAGER'), async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;

    const options = {
      limit: Math.min(parseInt(req.query.limit) || 100, 1000),
      offset: parseInt(req.query.offset) || 0,
    };

    const logs = await getAuditLogs(resourceType, resourceId, options);

    res.json({
      logs,
      count: logs.length,
      resource: {
        type: resourceType,
        id: resourceId,
      },
    });
  } catch (error) {
    captureError(error, { context: 'audit-logs-resource' });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit logs',
    });
  }
});

/**
 * GET /api/audit-logs/user/:userId
 * Get audit logs for a specific user.
 */
router.get('/user/:userId', requireRole('MANAGER'), async (req, res) => {
  try {
    const { userId } = req.params;

    const options = {
      limit: Math.min(parseInt(req.query.limit) || 100, 1000),
      offset: parseInt(req.query.offset) || 0,
    };

    const logs = await getUserAuditLogs(userId, options);

    res.json({
      logs,
      count: logs.length,
      userId,
    });
  } catch (error) {
    captureError(error, { context: 'audit-logs-user' });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit logs',
    });
  }
});

/**
 * GET /api/audit-logs/me
 * Get audit logs for current user.
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user.id;

    const options = {
      limit: Math.min(parseInt(req.query.limit) || 100, 1000),
      offset: parseInt(req.query.offset) || 0,
    };

    const logs = await getUserAuditLogs(userId, options);

    res.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    captureError(error, { context: 'audit-logs-me' });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit logs',
    });
  }
});

module.exports = router;
