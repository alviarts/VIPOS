/**
 * Audit Logging System
 *
 * Logs all critical actions for security and compliance.
 *
 * Features:
 * - Tamper-proof logging (append-only)
 * - User tracking (who did what)
 * - Resource tracking (what was changed)
 * - Timestamp tracking (when)
 * - IP address tracking (from where)
 * - Before/after values (what changed)
 *
 * Usage:
 * await logAudit({
 *   action: 'transaction.void',
 *   userId: req.user.id,
 *   resourceType: 'transaction',
 *   resourceId: transactionId,
 *   details: { reason: 'Customer request' },
 * });
 */

const { captureError } = require('../lib/sentry');

// Audit action types
const AUDIT_ACTIONS = {
  // Transaction actions
  TRANSACTION_CREATE: 'transaction.create',
  TRANSACTION_VOID: 'transaction.void',
  TRANSACTION_DELETE: 'transaction.delete',
  TRANSACTION_REFUND: 'transaction.refund',

  // Product actions
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  PRODUCT_PRICE_CHANGE: 'product.price_change',

  // Inventory actions
  STOCK_IN: 'inventory.stock_in',
  STOCK_OUT: 'inventory.stock_out',
  STOCK_TRANSFER: 'inventory.transfer',
  STOCK_OPNAME: 'inventory.opname',
  STOCK_ADJUSTMENT: 'inventory.adjustment',

  // Employee actions
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_DELETE: 'employee.delete',
  EMPLOYEE_ROLE_CHANGE: 'employee.role_change',

  // Customer actions
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DELETE: 'customer.delete',

  // Discount actions
  DISCOUNT_APPLY: 'discount.apply',
  DISCOUNT_LARGE: 'discount.large', // > 20%

  // Settings actions
  SETTINGS_UPDATE: 'settings.update',
  SETTINGS_FINANCIAL: 'settings.financial',

  // Auth actions
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  LOGIN_FAILED: 'auth.login_failed',
  PASSWORD_CHANGE: 'auth.password_change',
  PASSWORD_RESET: 'auth.password_reset',

  // Cashier shift actions
  SHIFT_OPEN: 'shift.open',
  SHIFT_CLOSE: 'shift.close',
  CASH_DROP: 'shift.cash_drop',
  CASH_PICKUP: 'shift.cash_pickup',
};

/**
 * Log an audit event.
 *
 * @param {Object} params - Audit parameters
 * @param {string} params.action - Action type (from AUDIT_ACTIONS)
 * @param {string} params.userId - User who performed the action
 * @param {string} params.resourceType - Type of resource (transaction, product, etc.)
 * @param {string} params.resourceId - ID of the resource
 * @param {Object} params.details - Additional details
 * @param {Object} params.before - State before change (optional)
 * @param {Object} params.after - State after change (optional)
 * @param {string} params.ipAddress - IP address (optional)
 * @param {string} params.userAgent - User agent (optional)
 * @param {Object} params.req - Express request object (optional, will extract IP/UA)
 * @returns {Promise<Object>} Audit log entry
 */
async function logAudit({
  action,
  userId,
  resourceType,
  resourceId,
  details = {},
  before = null,
  after = null,
  ipAddress = null,
  userAgent = null,
  req = null,
}) {
  try {
    // Extract IP and User Agent from request if provided
    if (req) {
      ipAddress = ipAddress || req.ip || req.connection.remoteAddress;
      userAgent = userAgent || req.get('user-agent');
    }

    // Get database connection
    const db = require('../lib/db');

    // Create audit log entry
    const auditLog = await db.auditLog.create({
      data: {
        action,
        user_id: userId,
        resource_type: resourceType,
        resource_id: resourceId,
        details: JSON.stringify(details),
        before: before ? JSON.stringify(before) : null,
        after: after ? JSON.stringify(after) : null,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date(),
      },
    });

    return auditLog;
  } catch (error) {
    // Log error but don't fail the request
    captureError(error, {
      context: 'audit-logging',
      tags: { action, user_id: userId },
      extra: { resourceType, resourceId },
    });

    // Return null to indicate logging failed
    return null;
  }
}

/**
 * Middleware to automatically log audit events.
 *
 * Usage:
 * router.post('/transaction/void', auditMiddleware('transaction.void'), voidTransaction);
 *
 * @param {string} action - Audit action type
 * @param {Function} getResourceInfo - Function to extract resource info from req
 * @returns {Function} Express middleware
 */
function auditMiddleware(action, getResourceInfo = null) {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (data) {
      // Log audit after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Extract resource info
        let resourceType = null;
        let resourceId = null;
        let details = {};

        if (getResourceInfo) {
          const info = getResourceInfo(req, data);
          resourceType = info.resourceType;
          resourceId = info.resourceId;
          details = info.details || {};
        } else {
          // Default: try to extract from params or body
          resourceType = req.params.resourceType || req.body.resourceType;
          resourceId = req.params.id || req.body.id || data.id;
        }

        // Log audit (async, don't wait)
        logAudit({
          action,
          userId: req.user?.id,
          resourceType,
          resourceId,
          details,
          req,
        }).catch((error) => {
          captureError(error, { context: 'audit-middleware' });
        });
      }

      // Call original res.json
      return originalJson(data);
    };

    next();
  };
}

/**
 * Get audit logs for a resource.
 *
 * @param {string} resourceType - Resource type
 * @param {string} resourceId - Resource ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit logs
 */
async function getAuditLogs(resourceType, resourceId, options = {}) {
  try {
    const db = require('../lib/db');

    const logs = await db.auditLog.findMany({
      where: {
        resource_type: resourceType,
        resource_id: resourceId,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: options.limit || 100,
      skip: options.offset || 0,
    });

    return logs;
  } catch (error) {
    captureError(error, {
      context: 'get-audit-logs',
      extra: { resourceType, resourceId },
    });
    throw error;
  }
}

/**
 * Get audit logs for a user.
 *
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit logs
 */
async function getUserAuditLogs(userId, options = {}) {
  try {
    const db = require('../lib/db');

    const logs = await db.auditLog.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: options.limit || 100,
      skip: options.offset || 0,
    });

    return logs;
  } catch (error) {
    captureError(error, {
      context: 'get-user-audit-logs',
      extra: { userId },
    });
    throw error;
  }
}

/**
 * Search audit logs.
 *
 * @param {Object} filters - Search filters
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Audit logs
 */
async function searchAuditLogs(filters = {}, options = {}) {
  try {
    const db = require('../lib/db');

    const where = {};

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.userId) {
      where.user_id = filters.userId;
    }

    if (filters.resourceType) {
      where.resource_type = filters.resourceType;
    }

    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) {
        where.created_at.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.created_at.lte = new Date(filters.endDate);
      }
    }

    const logs = await db.auditLog.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: options.limit || 100,
      skip: options.offset || 0,
    });

    return logs;
  } catch (error) {
    captureError(error, {
      context: 'search-audit-logs',
      extra: { filters },
    });
    throw error;
  }
}

module.exports = {
  AUDIT_ACTIONS,
  logAudit,
  auditMiddleware,
  getAuditLogs,
  getUserAuditLogs,
  searchAuditLogs,
};
