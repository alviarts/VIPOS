/**
 * Inter-outlet Transfers API Routes
 *
 * Manages stock transfers between outlets using Prisma ORM
 */

const express = require('express');
const { z } = require('zod');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../db/prisma');
const { logger } = require('../lib/logger');

const router = express.Router();

// Validation schemas
const TransferCreateSchema = z.object({
  from_outlet_id: z.number().int().positive(),
  to_outlet_id: z.number().int().positive(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity: z.number().positive(),
      unit_cost: z.number().min(0).optional(),
    })
  ),
});

/**
 * Generate unique transfer number
 * Format: TRF-YYYYMMDD-XXXX
 */
async function generateTransferNumber(tenantId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${dateStr}`;

  // Find the last transfer number for today
  const lastTransfer = await prisma.outlet_transfers.findFirst({
    where: {
      tenant_id: tenantId,
      transfer_number: {
        startsWith: prefix,
      },
    },
    orderBy: {
      transfer_number: 'desc',
    },
  });

  let sequence = 1;
  if (lastTransfer) {
    const lastSequence = parseInt(lastTransfer.transfer_number.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
}

// GET /api/v1/transfers - List transfers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { status, from_outlet_id, to_outlet_id } = req.query;

    const where = {
      tenant_id,
      ...(status && { status }),
      ...(from_outlet_id && { from_outlet_id: parseInt(from_outlet_id) }),
      ...(to_outlet_id && { to_outlet_id: parseInt(to_outlet_id) }),
    };

    const transfers = await prisma.outlet_transfers.findMany({
      where,
      include: {
        from_outlet: {
          select: { id: true, name: true },
        },
        to_outlet: {
          select: { id: true, name: true },
        },
        created_by_user: {
          select: { id: true, name: true },
        },
        transfer_items: {
          select: {
            quantity: true,
            unit_cost: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Calculate item_count and total_value for each transfer
    const transfersWithStats = transfers.map((transfer) => {
      const item_count = transfer.transfer_items.length;
      const total_value = transfer.transfer_items.reduce(
        (sum, item) => sum + item.quantity * (item.unit_cost || 0),
        0
      );

      return {
        id: transfer.id,
        transfer_number: transfer.transfer_number,
        from_outlet_id: transfer.from_outlet_id,
        to_outlet_id: transfer.to_outlet_id,
        status: transfer.status,
        notes: transfer.notes,
        shipping_date: transfer.shipping_date,
        received_date: transfer.received_date,
        created_by: transfer.created_by,
        approved_by: transfer.approved_by,
        received_by: transfer.received_by,
        created_at: transfer.created_at,
        updated_at: transfer.updated_at,
        from_outlet_name: transfer.from_outlet.name,
        to_outlet_name: transfer.to_outlet.name,
        created_by_name: transfer.created_by_user?.name || null,
        item_count,
        total_value,
      };
    });

    res.json({
      success: true,
      data: transfersWithStats,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to list transfers');
    res.status(500).json({ success: false, error: 'Failed to list transfers' });
  }
});

// GET /api/v1/transfers/:id - Get transfer detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;

    const transfer = await prisma.outlet_transfers.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      include: {
        from_outlet: {
          select: { id: true, name: true },
        },
        to_outlet: {
          select: { id: true, name: true },
        },
        created_by_user: {
          select: { id: true, name: true },
        },
        approved_by_user: {
          select: { id: true, name: true },
        },
        received_by_user: {
          select: { id: true, name: true },
        },
        transfer_items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                stock: true,
              },
            },
          },
        },
        transfer_status_history: {
          include: {
            users: {
              select: { id: true, name: true },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });

    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }

    // Format the response
    const response = {
      id: transfer.id,
      transfer_number: transfer.transfer_number,
      from_outlet_id: transfer.from_outlet_id,
      to_outlet_id: transfer.to_outlet_id,
      status: transfer.status,
      notes: transfer.notes,
      shipping_date: transfer.shipping_date,
      received_date: transfer.received_date,
      created_by: transfer.created_by,
      approved_by: transfer.approved_by,
      received_by: transfer.received_by,
      created_at: transfer.created_at,
      updated_at: transfer.updated_at,
      from_outlet_name: transfer.from_outlet.name,
      to_outlet_name: transfer.to_outlet.name,
      created_by_name: transfer.created_by_user?.name || null,
      approved_by_name: transfer.approved_by_user?.name || null,
      received_by_name: transfer.received_by_user?.name || null,
      items: transfer.transfer_items.map((item) => ({
        id: item.id,
        transfer_id: item.transfer_id,
        product_id: item.product_id,
        product_name: item.products.name,
        product_sku: item.products.sku,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        notes: item.notes,
        received_quantity: item.received_quantity,
        current_stock: item.products.stock,
      })),
      status_history: transfer.transfer_status_history.map((history) => ({
        id: history.id,
        status: history.status,
        notes: history.notes,
        created_by: history.created_by,
        created_by_name: history.users?.name || null,
        created_at: history.created_at,
      })),
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get transfer detail');
    res.status(500).json({ success: false, error: 'Failed to get transfer detail' });
  }
});

// POST /api/v1/transfers - Create new transfer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const validation = TransferCreateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { from_outlet_id, to_outlet_id, notes, items } = validation.data;

    // Validate outlets exist and belong to tenant
    const [fromOutlet, toOutlet] = await Promise.all([
      prisma.outlets.findFirst({
        where: { id: from_outlet_id, tenant_id },
      }),
      prisma.outlets.findFirst({
        where: { id: to_outlet_id, tenant_id },
      }),
    ]);

    if (!fromOutlet || !toOutlet) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outlet(s)',
      });
    }

    if (from_outlet_id === to_outlet_id) {
      return res.status(400).json({
        success: false,
        error: 'Source and destination outlets must be different',
      });
    }

    // Validate products exist
    const productIds = items.map((item) => item.product_id);
    const products = await prisma.products.findMany({
      where: {
        id: { in: productIds },
        tenant_id,
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more products not found',
      });
    }

    // Generate transfer number
    const transferNumber = await generateTransferNumber(tenant_id);

    // Create transfer with items in a transaction
    const transfer = await prisma.$transaction(async (tx) => {
      // Create transfer
      const newTransfer = await tx.outlet_transfers.create({
        data: {
          transfer_number: transferNumber,
          from_outlet_id,
          to_outlet_id,
          status: 'DRAFT',
          notes,
          created_by: user_id,
          tenant_id,
          transfer_items: {
            create: items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_cost: item.unit_cost || 0,
              tenant_id,
            })),
          },
        },
        include: {
          from_outlet: {
            select: { id: true, name: true },
          },
          to_outlet: {
            select: { id: true, name: true },
          },
          created_by_user: {
            select: { id: true, name: true },
          },
          transfer_items: {
            include: {
              products: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      });

      // Create status history
      await tx.outlet_transfer_status_history.create({
        data: {
          transfer_id: newTransfer.id,
          status: 'DRAFT',
          notes: 'Transfer created',
          created_by: user_id,
          tenant_id,
        },
      });

      return newTransfer;
    });

    logger.info({ user: req.user, transferId: transfer.id }, 'Transfer created');

    res.status(201).json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to create transfer');
    res.status(500).json({ success: false, error: 'Failed to create transfer' });
  }
});

// PUT /api/v1/transfers/:id - Update transfer (only in DRAFT status)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;
    const validation = TransferCreateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { from_outlet_id, to_outlet_id, notes, items } = validation.data;

    // Check if transfer exists and is in DRAFT status
    const existingTransfer = await prisma.outlet_transfers.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
        status: 'DRAFT',
      },
    });

    if (!existingTransfer) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found or cannot be edited',
      });
    }

    // Validate outlets
    const [fromOutlet, toOutlet] = await Promise.all([
      prisma.outlets.findFirst({
        where: { id: from_outlet_id, tenant_id },
      }),
      prisma.outlets.findFirst({
        where: { id: to_outlet_id, tenant_id },
      }),
    ]);

    if (!fromOutlet || !toOutlet) {
      return res.status(400).json({
        success: false,
        error: 'Invalid outlet(s)',
      });
    }

    if (from_outlet_id === to_outlet_id) {
      return res.status(400).json({
        success: false,
        error: 'Source and destination outlets must be different',
      });
    }

    // Validate products
    const productIds = items.map((item) => item.product_id);
    const products = await prisma.products.findMany({
      where: {
        id: { in: productIds },
        tenant_id,
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more products not found',
      });
    }

    // Update transfer with items in a transaction
    const transfer = await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.outlet_transfer_items.deleteMany({
        where: { transfer_id: parseInt(id) },
      });

      // Update transfer and create new items
      const updatedTransfer = await tx.outlet_transfers.update({
        where: { id: parseInt(id) },
        data: {
          from_outlet_id,
          to_outlet_id,
          notes,
          updated_at: new Date(),
          transfer_items: {
            create: items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_cost: item.unit_cost || 0,
              tenant_id,
            })),
          },
        },
        include: {
          from_outlet: {
            select: { id: true, name: true },
          },
          to_outlet: {
            select: { id: true, name: true },
          },
          transfer_items: {
            include: {
              products: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      });

      return updatedTransfer;
    });

    logger.info({ user: req.user, transferId: id }, 'Transfer updated');

    res.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to update transfer');
    res.status(500).json({ success: false, error: 'Failed to update transfer' });
  }
});

// POST /api/v1/transfers/:id/submit - Submit transfer for approval
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;

    const transfer = await prisma.$transaction(async (tx) => {
      const updatedTransfer = await tx.outlet_transfers.updateMany({
        where: {
          id: parseInt(id),
          tenant_id,
          status: 'DRAFT',
        },
        data: {
          status: 'SUBMITTED',
          updated_at: new Date(),
        },
      });

      if (updatedTransfer.count === 0) {
        throw new Error('Transfer not found or cannot be submitted');
      }

      // Create status history
      await tx.outlet_transfer_status_history.create({
        data: {
          transfer_id: parseInt(id),
          status: 'SUBMITTED',
          notes: 'Transfer submitted for approval',
          created_by: user_id,
          tenant_id,
        },
      });

      return await tx.outlet_transfers.findUnique({
        where: { id: parseInt(id) },
        include: {
          from_outlet: { select: { id: true, name: true } },
          to_outlet: { select: { id: true, name: true } },
        },
      });
    });

    logger.info({ user: req.user, transferId: id }, 'Transfer submitted');

    res.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    if (error.message === 'Transfer not found or cannot be submitted') {
      return res.status(404).json({ success: false, error: error.message });
    }
    logger.error({ error, user: req.user }, 'Failed to submit transfer');
    res.status(500).json({ success: false, error: 'Failed to submit transfer' });
  }
});

// POST /api/v1/transfers/:id/approve - Approve transfer
router.post('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;

    const transfer = await prisma.$transaction(async (tx) => {
      const updatedTransfer = await tx.outlet_transfers.updateMany({
        where: {
          id: parseInt(id),
          tenant_id,
          status: 'SUBMITTED',
        },
        data: {
          status: 'APPROVED',
          approved_by: user_id,
          updated_at: new Date(),
        },
      });

      if (updatedTransfer.count === 0) {
        throw new Error('Transfer not found or cannot be approved');
      }

      // Create status history
      await tx.outlet_transfer_status_history.create({
        data: {
          transfer_id: parseInt(id),
          status: 'APPROVED',
          notes: 'Transfer approved',
          created_by: user_id,
          tenant_id,
        },
      });

      return await tx.outlet_transfers.findUnique({
        where: { id: parseInt(id) },
        include: {
          from_outlet: { select: { id: true, name: true } },
          to_outlet: { select: { id: true, name: true } },
        },
      });
    });

    logger.info({ user: req.user, transferId: id }, 'Transfer approved');

    res.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    if (error.message === 'Transfer not found or cannot be approved') {
      return res.status(404).json({ success: false, error: error.message });
    }
    logger.error({ error, user: req.user }, 'Failed to approve transfer');
    res.status(500).json({ success: false, error: 'Failed to approve transfer' });
  }
});

// POST /api/v1/transfers/:id/ship - Mark transfer as shipped
router.post('/:id/ship', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;

    const transfer = await prisma.$transaction(async (tx) => {
      // Get transfer items to deduct stock from source outlet
      const transferData = await tx.outlet_transfers.findFirst({
        where: {
          id: parseInt(id),
          tenant_id,
          status: 'APPROVED',
        },
        include: {
          transfer_items: true,
        },
      });

      if (!transferData) {
        throw new Error('Transfer not found or cannot be shipped');
      }

      // Deduct stock from source outlet (from products table)
      for (const item of transferData.transfer_items) {
        await tx.products.update({
          where: { id: item.product_id },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // Update transfer status
      await tx.outlet_transfers.update({
        where: { id: parseInt(id) },
        data: {
          status: 'SHIPPED',
          shipping_date: new Date(),
          updated_at: new Date(),
        },
      });

      // Create status history
      await tx.outlet_transfer_status_history.create({
        data: {
          transfer_id: parseInt(id),
          status: 'SHIPPED',
          notes: 'Transfer shipped, stock deducted from source outlet',
          created_by: user_id,
          tenant_id,
        },
      });

      return await tx.outlet_transfers.findUnique({
        where: { id: parseInt(id) },
        include: {
          from_outlet: { select: { id: true, name: true } },
          to_outlet: { select: { id: true, name: true } },
        },
      });
    });

    logger.info({ user: req.user, transferId: id }, 'Transfer shipped');

    res.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    if (error.message === 'Transfer not found or cannot be shipped') {
      return res.status(404).json({ success: false, error: error.message });
    }
    logger.error({ error, user: req.user }, 'Failed to ship transfer');
    res.status(500).json({ success: false, error: 'Failed to ship transfer' });
  }
});

// POST /api/v1/transfers/:id/receive - Receive transfer
router.post('/:id/receive', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;
    const { received_items } = req.body;

    // Validate received_items format
    if (!Array.isArray(received_items)) {
      return res.status(400).json({
        success: false,
        error: 'received_items must be an array',
      });
    }

    const transfer = await prisma.$transaction(async (tx) => {
      // Get transfer data
      const transferData = await tx.outlet_transfers.findFirst({
        where: {
          id: parseInt(id),
          tenant_id,
          status: 'SHIPPED',
        },
        include: {
          transfer_items: true,
        },
      });

      if (!transferData) {
        throw new Error('Transfer not found or cannot be received');
      }

      // Update received quantities and add stock to destination outlet
      for (const receivedItem of received_items) {
        const transferItem = transferData.transfer_items.find(
          (item) => item.id === receivedItem.item_id
        );

        if (!transferItem) {
          throw new Error(`Transfer item ${receivedItem.item_id} not found`);
        }

        // Update received quantity
        await tx.outlet_transfer_items.update({
          where: { id: receivedItem.item_id },
          data: {
            received_quantity: receivedItem.received_quantity,
          },
        });

        // Add stock to destination outlet (to products table)
        await tx.products.update({
          where: { id: transferItem.product_id },
          data: {
            stock: {
              increment: receivedItem.received_quantity,
            },
          },
        });
      }

      // Update transfer status
      await tx.outlet_transfers.update({
        where: { id: parseInt(id) },
        data: {
          status: 'RECEIVED',
          received_by: user_id,
          received_date: new Date(),
          updated_at: new Date(),
        },
      });

      // Create status history
      await tx.outlet_transfer_status_history.create({
        data: {
          transfer_id: parseInt(id),
          status: 'RECEIVED',
          notes: 'Transfer received, stock added to destination outlet',
          created_by: user_id,
          tenant_id,
        },
      });

      return await tx.outlet_transfers.findUnique({
        where: { id: parseInt(id) },
        include: {
          from_outlet: { select: { id: true, name: true } },
          to_outlet: { select: { id: true, name: true } },
          transfer_items: {
            include: {
              products: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      });
    });

    logger.info({ user: req.user, transferId: id }, 'Transfer received');

    res.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    if (error.message.includes('Transfer')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    logger.error({ error, user: req.user }, 'Failed to receive transfer');
    res.status(500).json({ success: false, error: 'Failed to receive transfer' });
  }
});

// POST /api/v1/transfers/:id/cancel - Cancel transfer
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    const transfer = await prisma.$transaction(async (tx) => {
      const updatedTransfer = await tx.outlet_transfers.updateMany({
        where: {
          id: parseInt(id),
          tenant_id,
          status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
        },
        data: {
          status: 'CANCELLED',
          updated_at: new Date(),
        },
      });

      if (updatedTransfer.count === 0) {
        throw new Error('Transfer not found or cannot be cancelled');
      }

      // Create status history
      await tx.outlet_transfer_status_history.create({
        data: {
          transfer_id: parseInt(id),
          status: 'CANCELLED',
          notes: reason || 'Transfer cancelled',
          created_by: user_id,
          tenant_id,
        },
      });

      return await tx.outlet_transfers.findUnique({
        where: { id: parseInt(id) },
        include: {
          from_outlet: { select: { id: true, name: true } },
          to_outlet: { select: { id: true, name: true } },
        },
      });
    });

    logger.info({ user: req.user, transferId: id }, 'Transfer cancelled');

    res.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    if (error.message === 'Transfer not found or cannot be cancelled') {
      return res.status(404).json({ success: false, error: error.message });
    }
    logger.error({ error, user: req.user }, 'Failed to cancel transfer');
    res.status(500).json({ success: false, error: 'Failed to cancel transfer' });
  }
});

module.exports = router;
