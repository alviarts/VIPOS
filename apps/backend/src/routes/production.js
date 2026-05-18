/**
 * Production Management API Routes
 *
 * Manages production orders and material consumption using Prisma ORM
 */

const express = require('express');
const { z } = require('zod');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../db/prisma');
const { logger } = require('../lib/logger');

const router = express.Router();

// Validation schemas
const ProductionOrderCreateSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().positive(),
  scheduled_date: z.string().optional(),
  notes: z.string().optional(),
  materials: z.array(
    z.object({
      material_product_id: z.number().int().positive(),
      required_quantity: z.number().positive(),
    })
  ).optional(),
});

const ProductionOrderUpdateSchema = z.object({
  quantity: z.number().positive().optional(),
  scheduled_date: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

/**
 * Generate unique production order number
 * Format: PRD-YYYYMMDD-XXXX
 */
async function generateOrderNumber(tenantId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `PRD-${dateStr}`;

  // Find the last order number for today
  const lastOrder = await prisma.production_orders.findFirst({
    where: {
      tenant_id: tenantId,
      order_number: {
        startsWith: prefix,
      },
    },
    orderBy: {
      order_number: 'desc',
    },
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.order_number.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}-${sequence.toString().padStart(4, '0')}`;
}

// GET /api/v1/production - List production orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { status, product_id } = req.query;

    const where = {
      tenant_id,
      ...(status && { status }),
      ...(product_id && { product_id: parseInt(product_id) }),
    };

    const orders = await prisma.production_orders.findMany({
      where,
      include: {
        products: {
          select: { id: true, name: true, sku: true },
        },
        created_by_user: {
          select: { id: true, name: true },
        },
        production_order_materials: {
          select: {
            required_quantity: true,
            used_quantity: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Calculate material count for each order
    const ordersWithStats = orders.map((order) => {
      const material_count = order.production_order_materials.length;
      const total_materials_required = order.production_order_materials.reduce(
        (sum, mat) => sum + mat.required_quantity,
        0
      );
      const total_materials_used = order.production_order_materials.reduce(
        (sum, mat) => sum + (mat.used_quantity || 0),
        0
      );

      return {
        id: order.id,
        order_number: order.order_number,
        product_id: order.product_id,
        product_name: order.products.name,
        product_sku: order.products.sku,
        quantity: order.quantity,
        status: order.status,
        scheduled_date: order.scheduled_date,
        started_date: order.started_date,
        completed_date: order.completed_date,
        notes: order.notes,
        created_by: order.created_by,
        created_by_name: order.created_by_user?.name || null,
        created_at: order.created_at,
        updated_at: order.updated_at,
        material_count,
        total_materials_required,
        total_materials_used,
      };
    });

    res.json({
      success: true,
      data: ordersWithStats,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to list production orders');
    res.status(500).json({ success: false, error: 'Failed to list production orders' });
  }
});

// GET /api/v1/production/:id - Get production order detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;

    const order = await prisma.production_orders.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      include: {
        products: {
          select: { id: true, name: true, sku: true, stock: true },
        },
        created_by_user: {
          select: { id: true, name: true },
        },
        production_order_materials: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                stock: true,
                satuan: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Production order not found' });
    }

    // Format the response
    const response = {
      id: order.id,
      order_number: order.order_number,
      product_id: order.product_id,
      product_name: order.products.name,
      product_sku: order.products.sku,
      product_stock: order.products.stock,
      quantity: order.quantity,
      status: order.status,
      scheduled_date: order.scheduled_date,
      started_date: order.started_date,
      completed_date: order.completed_date,
      notes: order.notes,
      created_by: order.created_by,
      created_by_name: order.created_by_user?.name || null,
      created_at: order.created_at,
      updated_at: order.updated_at,
      materials: order.production_order_materials.map((mat) => ({
        id: mat.id,
        material_product_id: mat.material_product_id,
        material_name: mat.products.name,
        material_sku: mat.products.sku,
        material_unit: mat.products.satuan,
        required_quantity: mat.required_quantity,
        used_quantity: mat.used_quantity,
        current_stock: mat.products.stock,
      })),
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get production order detail');
    res.status(500).json({ success: false, error: 'Failed to get production order detail' });
  }
});

// POST /api/v1/production - Create new production order
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const validation = ProductionOrderCreateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { product_id, quantity, scheduled_date, notes, materials } = validation.data;

    // Validate product exists
    const product = await prisma.products.findFirst({
      where: { id: product_id, tenant_id },
    });

    if (!product) {
      return res.status(400).json({
        success: false,
        error: 'Product not found',
      });
    }

    // If materials provided, validate they exist
    if (materials && materials.length > 0) {
      const materialIds = materials.map((m) => m.material_product_id);
      const materialProducts = await prisma.products.findMany({
        where: {
          id: { in: materialIds },
          tenant_id,
        },
      });

      if (materialProducts.length !== materialIds.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more material products not found',
        });
      }
    }

    // Generate order number
    const orderNumber = await generateOrderNumber(tenant_id);

    // Create production order with materials in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.production_orders.create({
        data: {
          order_number: orderNumber,
          product_id,
          quantity,
          status: 'PLANNED',
          scheduled_date: scheduled_date ? new Date(scheduled_date) : null,
          notes,
          created_by: user_id,
          tenant_id,
          production_order_materials: materials && materials.length > 0 ? {
            create: materials.map((mat) => ({
              material_product_id: mat.material_product_id,
              required_quantity: mat.required_quantity,
              tenant_id,
            })),
          } : undefined,
        },
        include: {
          products: {
            select: { id: true, name: true, sku: true },
          },
          created_by_user: {
            select: { id: true, name: true },
          },
          production_order_materials: {
            include: {
              products: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      });

      return newOrder;
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to create production order');
    res.status(500).json({ success: false, error: 'Failed to create production order' });
  }
});

// PUT /api/v1/production/:id - Update production order
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;
    const validation = ProductionOrderUpdateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    // Check if order exists
    const existingOrder = await prisma.production_orders.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ success: false, error: 'Production order not found' });
    }

    // Cannot update completed or cancelled orders
    if (existingOrder.status === 'COMPLETED' || existingOrder.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update completed or cancelled orders',
      });
    }

    const updateData = {};
    if (validation.data.quantity !== undefined) updateData.quantity = validation.data.quantity;
    if (validation.data.scheduled_date !== undefined) {
      updateData.scheduled_date = validation.data.scheduled_date ? new Date(validation.data.scheduled_date) : null;
    }
    if (validation.data.notes !== undefined) updateData.notes = validation.data.notes;
    if (validation.data.status !== undefined) updateData.status = validation.data.status;

    const updatedOrder = await prisma.production_orders.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        products: {
          select: { id: true, name: true, sku: true },
        },
        created_by_user: {
          select: { id: true, name: true },
        },
        production_order_materials: {
          include: {
            products: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to update production order');
    res.status(500).json({ success: false, error: 'Failed to update production order' });
  }
});

// POST /api/v1/production/:id/start - Start production (deduct materials)
router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;

    const order = await prisma.production_orders.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      include: {
        production_order_materials: {
          include: {
            products: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Production order not found' });
    }

    if (order.status !== 'PLANNED') {
      return res.status(400).json({
        success: false,
        error: 'Can only start orders with PLANNED status',
      });
    }

    // Check if all materials have sufficient stock
    const insufficientMaterials = [];
    for (const material of order.production_order_materials) {
      if (material.products.stock < material.required_quantity) {
        insufficientMaterials.push({
          name: material.products.name,
          required: material.required_quantity,
          available: material.products.stock,
        });
      }
    }

    if (insufficientMaterials.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock for materials',
        details: insufficientMaterials,
      });
    }

    // Start production in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct materials from stock
      for (const material of order.production_order_materials) {
        await tx.products.update({
          where: { id: material.material_product_id },
          data: {
            stock: {
              decrement: material.required_quantity,
            },
          },
        });

        // Update used quantity
        await tx.production_order_materials.update({
          where: { id: material.id },
          data: {
            used_quantity: material.required_quantity,
          },
        });

        // Create inventory movement
        await tx.inventory_movements.create({
          data: {
            product_id: material.material_product_id,
            movement_type: 'PRODUCTION_USE',
            quantity: -material.required_quantity,
            reference_type: 'production_order',
            reference_id: order.id.toString(),
            notes: `Used for production order ${order.order_number}`,
            created_by: user_id,
            tenant_id,
          },
        });
      }

      // Update order status
      const updatedOrder = await tx.production_orders.update({
        where: { id: parseInt(id) },
        data: {
          status: 'IN_PROGRESS',
          started_date: new Date(),
        },
        include: {
          products: {
            select: { id: true, name: true, sku: true },
          },
          production_order_materials: {
            include: {
              products: {
                select: { id: true, name: true, sku: true, stock: true },
              },
            },
          },
        },
      });

      return updatedOrder;
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to start production');
    res.status(500).json({ success: false, error: 'Failed to start production' });
  }
});

// POST /api/v1/production/:id/complete - Complete production (add finished goods)
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;

    const order = await prisma.production_orders.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      include: {
        products: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Production order not found' });
    }

    if (order.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        error: 'Can only complete orders with IN_PROGRESS status',
      });
    }

    // Complete production in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Add finished goods to stock
      await tx.products.update({
        where: { id: order.product_id },
        data: {
          stock: {
            increment: order.quantity,
          },
        },
      });

      // Create inventory movement
      await tx.inventory_movements.create({
        data: {
          product_id: order.product_id,
          movement_type: 'PRODUCTION_OUTPUT',
          quantity: order.quantity,
          reference_type: 'production_order',
          reference_id: order.id.toString(),
          notes: `Completed production order ${order.order_number}`,
          created_by: user_id,
          tenant_id,
        },
      });

      // Update order status
      const updatedOrder = await tx.production_orders.update({
        where: { id: parseInt(id) },
        data: {
          status: 'COMPLETED',
          completed_date: new Date(),
        },
        include: {
          products: {
            select: { id: true, name: true, sku: true, stock: true },
          },
          production_order_materials: {
            include: {
              products: {
                select: { id: true, name: true, sku: true, stock: true },
              },
            },
          },
        },
      });

      return updatedOrder;
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to complete production');
    res.status(500).json({ success: false, error: 'Failed to complete production' });
  }
});

// POST /api/v1/production/:id/cancel - Cancel production order
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    const order = await prisma.production_orders.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Production order not found' });
    }

    if (order.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel completed orders',
      });
    }

    if (order.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Order is already cancelled',
      });
    }

    // If order was IN_PROGRESS, we should return materials to stock
    // For simplicity, we'll just mark as cancelled
    // In a real system, you might want to handle material returns

    const updatedOrder = await prisma.production_orders.update({
      where: { id: parseInt(id) },
      data: {
        status: 'CANCELLED',
        notes: reason ? `${order.notes || ''}\nCancellation reason: ${reason}` : order.notes,
      },
      include: {
        products: {
          select: { id: true, name: true, sku: true },
        },
        production_order_materials: {
          include: {
            products: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to cancel production order');
    res.status(500).json({ success: false, error: 'Failed to cancel production order' });
  }
});

module.exports = router;
