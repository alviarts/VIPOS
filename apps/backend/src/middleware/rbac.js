/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Provides fine-grained access control based on user roles and permissions.
 *
 * Roles:
 * - OWNER: Full access to everything
 * - MANAGER: Access to reports, inventory, employees (no financial settings)
 * - CASHIER: Access to POS, transactions (no delete/void without approval)
 * - STAFF: Limited access (appointments, stock movement)
 *
 * Usage:
 * router.post('/transaction/void', requireRole('MANAGER'), voidTransaction);
 * router.delete('/product/:id', requirePermission('product:delete'), deleteProduct);
 */

const { captureError } = require('./sentry');

// Role hierarchy (higher roles inherit lower role permissions)
const ROLES = {
  OWNER: 4,
  MANAGER: 3,
  CASHIER: 2,
  STAFF: 1,
};

// Permission definitions
const PERMISSIONS = {
  // Transaction permissions
  'transaction:create': ['OWNER', 'MANAGER', 'CASHIER'],
  'transaction:read': ['OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
  'transaction:void': ['OWNER', 'MANAGER'], // Requires approval
  'transaction:delete': ['OWNER'], // Only owner

  // Product permissions
  'product:create': ['OWNER', 'MANAGER'],
  'product:read': ['OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
  'product:update': ['OWNER', 'MANAGER'],
  'product:delete': ['OWNER'],

  // Inventory permissions
  'inventory:read': ['OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
  'inventory:update': ['OWNER', 'MANAGER', 'STAFF'],
  'stock:transfer': ['OWNER', 'MANAGER'],
  'stock:opname': ['OWNER', 'MANAGER'],

  // Employee permissions
  'employee:create': ['OWNER', 'MANAGER'],
  'employee:read': ['OWNER', 'MANAGER'],
  'employee:update': ['OWNER', 'MANAGER'],
  'employee:delete': ['OWNER'],

  // Report permissions
  'report:sales': ['OWNER', 'MANAGER'],
  'report:inventory': ['OWNER', 'MANAGER'],
  'report:employee': ['OWNER', 'MANAGER'],

  // Settings permissions
  'settings:read': ['OWNER', 'MANAGER'],
  'settings:update': ['OWNER'],
  'settings:financial': ['OWNER'], // Tax, payment gateway, etc.

  // Appointment permissions
  'appointment:create': ['OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
  'appointment:read': ['OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
  'appointment:update': ['OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
  'appointment:cancel': ['OWNER', 'MANAGER'],

  // Customer permissions
  'customer:create': ['OWNER', 'MANAGER', 'CASHIER'],
  'customer:read': ['OWNER', 'MANAGER', 'CASHIER', 'STAFF'],
  'customer:update': ['OWNER', 'MANAGER'],
  'customer:delete': ['OWNER'],

  // Discount permissions
  'discount:apply': ['OWNER', 'MANAGER', 'CASHIER'],
  'discount:large': ['OWNER', 'MANAGER'], // > 20%
};

/**
 * Check if user has required role.
 *
 * @param {string} requiredRole - Minimum required role
 * @returns {Function} Express middleware
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userRoleLevel = ROLES[user.role];
      const requiredRoleLevel = ROLES[requiredRole];

      if (!userRoleLevel) {
        captureError(new Error(`Invalid user role: ${user.role}`), {
          context: 'rbac-check',
          tags: { user_id: user.id, role: user.role },
        });
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Invalid user role configuration',
        });
      }

      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `This action requires ${requiredRole} role or higher`,
          required_role: requiredRole,
          user_role: user.role,
        });
      }

      next();
    } catch (error) {
      captureError(error, { context: 'rbac-middleware' });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check permissions',
      });
    }
  };
}

/**
 * Check if user has required permission.
 *
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const allowedRoles = PERMISSIONS[permission];

      if (!allowedRoles) {
        captureError(new Error(`Unknown permission: ${permission}`), {
          context: 'rbac-check',
          tags: { permission },
        });
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Invalid permission configuration',
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to perform this action',
          required_permission: permission,
          user_role: user.role,
        });
      }

      next();
    } catch (error) {
      captureError(error, { context: 'rbac-middleware' });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check permissions',
      });
    }
  };
}

/**
 * Check if user has any of the required permissions.
 *
 * @param {string[]} permissions - Array of permissions (OR logic)
 * @returns {Function} Express middleware
 */
function requireAnyPermission(permissions) {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const hasPermission = permissions.some((permission) => {
        const allowedRoles = PERMISSIONS[permission];
        return allowedRoles && allowedRoles.includes(user.role);
      });

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to perform this action',
          required_permissions: permissions,
          user_role: user.role,
        });
      }

      next();
    } catch (error) {
      captureError(error, { context: 'rbac-middleware' });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check permissions',
      });
    }
  };
}

/**
 * Check if user owns the resource or has required role.
 * Useful for endpoints like "update my profile" vs "update any profile".
 *
 * @param {string} resourceUserIdField - Field name containing resource owner ID
 * @param {string} fallbackRole - Role that can access any resource
 * @returns {Function} Express middleware
 */
function requireOwnershipOr(resourceUserIdField, fallbackRole = 'MANAGER') {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Check if user has fallback role
      const userRoleLevel = ROLES[user.role];
      const fallbackRoleLevel = ROLES[fallbackRole];

      if (userRoleLevel >= fallbackRoleLevel) {
        return next();
      }

      // Check ownership
      const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];

      if (resourceUserId && resourceUserId === user.id) {
        return next();
      }

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own resources',
      });
    } catch (error) {
      captureError(error, { context: 'rbac-middleware' });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check permissions',
      });
    }
  };
}

/**
 * Get user permissions based on role.
 * Useful for frontend to show/hide UI elements.
 *
 * @param {string} role - User role
 * @returns {string[]} Array of permissions
 */
function getUserPermissions(role) {
  const permissions = [];

  for (const [permission, allowedRoles] of Object.entries(PERMISSIONS)) {
    if (allowedRoles.includes(role)) {
      permissions.push(permission);
    }
  }

  return permissions;
}

/**
 * Check if role has permission (without middleware).
 *
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean} True if role has permission
 */
function hasPermission(role, permission) {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles && allowedRoles.includes(role);
}

module.exports = {
  ROLES,
  PERMISSIONS,
  requireRole,
  requirePermission,
  requireAnyPermission,
  requireOwnershipOr,
  getUserPermissions,
  hasPermission,
};
