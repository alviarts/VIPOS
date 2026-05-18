/**
 * Action Approval Workflow
 *
 * Handles approval workflow for sensitive actions.
 *
 * Flow:
 * 1. Cashier requests void transaction
 * 2. System creates approval request
 * 3. Manager approves/rejects
 * 4. System executes action if approved
 *
 * Actions requiring approval:
 * - Void transaction
 * - Large discount (> 20%)
 * - Delete product
 * - Stock adjustment
 */

const { captureError } = require('../lib/sentry');
const { logAudit } = require('./audit-log');

// Approval status
const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

// Approval types
const APPROVAL_TYPES = {
  TRANSACTION_VOID: 'transaction_void',
  LARGE_DISCOUNT: 'large_discount',
  PRODUCT_DELETE: 'product_delete',
  STOCK_ADJUSTMENT: 'stock_adjustment',
};

/**
 * Create approval request.
 *
 * @param {Object} params - Approval parameters
 * @param {string} params.type - Approval type
 * @param {string} params.requestedBy - User ID who requested
 * @param {string} params.resourceType - Resource type
 * @param {string} params.resourceId - Resource ID
 * @param {Object} params.details - Additional details
 * @param {Object} params.actionData - Data needed to execute action
 * @returns {Promise<Object>} Approval request
 */
async function createApprovalRequest({
  type,
  requestedBy,
  resourceType,
  resourceId,
  details = {},
  actionData = {},
}) {
  try {
    const db = require('../lib/db');

    const approval = await db.approvalRequest.create({
      data: {
        type,
        requested_by: requestedBy,
        resource_type: resourceType,
        resource_id: resourceId,
        details: JSON.stringify(details),
        action_data: JSON.stringify(actionData),
        status: APPROVAL_STATUS.PENDING,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Log audit
    await logAudit({
      action: 'approval.request',
      userId: requestedBy,
      resourceType: 'approval_request',
      resourceId: approval.id,
      details: { type, resourceType, resourceId },
    });

    return approval;
  } catch (error) {
    captureError(error, {
      context: 'create-approval-request',
      extra: { type, requestedBy },
    });
    throw error;
  }
}

/**
 * Approve request.
 *
 * @param {string} approvalId - Approval request ID
 * @param {string} approvedBy - User ID who approved
 * @param {string} notes - Approval notes
 * @returns {Promise<Object>} Updated approval request
 */
async function approveRequest(approvalId, approvedBy, notes = null) {
  try {
    const db = require('../lib/db');

    // Get approval request
    const approval = await db.approvalRequest.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new Error('Approval request not found');
    }

    if (approval.status !== APPROVAL_STATUS.PENDING) {
      throw new Error(`Approval request is already ${approval.status}`);
    }

    if (new Date() > new Date(approval.expires_at)) {
      throw new Error('Approval request has expired');
    }

    // Update approval
    const updated = await db.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: APPROVAL_STATUS.APPROVED,
        approved_by: approvedBy,
        approved_at: new Date(),
        notes,
      },
    });

    // Log audit
    await logAudit({
      action: 'approval.approve',
      userId: approvedBy,
      resourceType: 'approval_request',
      resourceId: approvalId,
      details: { type: approval.type, notes },
    });

    return updated;
  } catch (error) {
    captureError(error, {
      context: 'approve-request',
      extra: { approvalId, approvedBy },
    });
    throw error;
  }
}

/**
 * Reject request.
 *
 * @param {string} approvalId - Approval request ID
 * @param {string} rejectedBy - User ID who rejected
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Updated approval request
 */
async function rejectRequest(approvalId, rejectedBy, reason) {
  try {
    const db = require('../lib/db');

    // Get approval request
    const approval = await db.approvalRequest.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new Error('Approval request not found');
    }

    if (approval.status !== APPROVAL_STATUS.PENDING) {
      throw new Error(`Approval request is already ${approval.status}`);
    }

    // Update approval
    const updated = await db.approvalRequest.update({
      where: { id: approvalId },
      data: {
        status: APPROVAL_STATUS.REJECTED,
        approved_by: rejectedBy,
        approved_at: new Date(),
        notes: reason,
      },
    });

    // Log audit
    await logAudit({
      action: 'approval.reject',
      userId: rejectedBy,
      resourceType: 'approval_request',
      resourceId: approvalId,
      details: { type: approval.type, reason },
    });

    return updated;
  } catch (error) {
    captureError(error, {
      context: 'reject-request',
      extra: { approvalId, rejectedBy },
    });
    throw error;
  }
}

/**
 * Get pending approval requests.
 *
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Approval requests
 */
async function getPendingApprovals(filters = {}) {
  try {
    const db = require('../lib/db');

    const where = {
      status: APPROVAL_STATUS.PENDING,
      expires_at: {
        gt: new Date(),
      },
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.requestedBy) {
      where.requested_by = filters.requestedBy;
    }

    const approvals = await db.approvalRequest.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
    });

    return approvals;
  } catch (error) {
    captureError(error, {
      context: 'get-pending-approvals',
      extra: { filters },
    });
    throw error;
  }
}

/**
 * Middleware to require approval for action.
 *
 * Usage:
 * router.post('/transaction/void', requireApproval('transaction_void'), voidTransaction);
 *
 * @param {string} approvalType - Approval type
 * @returns {Function} Express middleware
 */
function requireApproval(approvalType) {
  return async (req, res, next) => {
    try {
      const user = req.user;

      // Check if user can bypass approval (OWNER, MANAGER)
      const { hasPermission } = require('./rbac');
      if (hasPermission(user.role, 'approval:bypass')) {
        return next();
      }

      // Check if approval is provided
      const approvalId = req.body.approval_id || req.query.approval_id;

      if (!approvalId) {
        // No approval provided, create approval request
        const approval = await createApprovalRequest({
          type: approvalType,
          requestedBy: user.id,
          resourceType: req.params.resourceType || 'unknown',
          resourceId: req.params.id || req.body.id,
          details: req.body,
          actionData: {
            method: req.method,
            path: req.path,
            body: req.body,
            params: req.params,
          },
        });

        return res.status(202).json({
          message: 'Approval required',
          approval_id: approval.id,
          status: 'pending',
        });
      }

      // Approval provided, verify it
      const db = require('../lib/db');
      const approval = await db.approvalRequest.findUnique({
        where: { id: approvalId },
      });

      if (!approval) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Approval request not found',
        });
      }

      if (approval.status !== APPROVAL_STATUS.APPROVED) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Approval is ${approval.status}`,
        });
      }

      if (approval.type !== approvalType) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Approval type mismatch',
        });
      }

      // Approval valid, proceed
      req.approval = approval;
      next();
    } catch (error) {
      captureError(error, { context: 'require-approval-middleware' });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check approval',
      });
    }
  };
}

module.exports = {
  APPROVAL_STATUS,
  APPROVAL_TYPES,
  createApprovalRequest,
  approveRequest,
  rejectRequest,
  getPendingApprovals,
  requireApproval,
};
