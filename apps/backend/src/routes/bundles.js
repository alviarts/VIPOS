/**
 * Product Bundles API Routes
 *
 * Manages product bundles/packages - combinations of products sold together.
 * A bundle has a fixed price and contains multiple products with quantities.
 */

const express = require('express');
const { z } = require('zod');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../db/prisma');
const { logger } = require('../lib/logger');

const router = express.Router();

// Validation schemas
const BundleCreateSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().min(1).max(100),
  price: z.number().positive(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  items: z.array(
    z.object({
      product_id: z.number().int().positive(),
      quantity: z.number().positive(),
    })
  ).min(1),
});

const BundleUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sku: z.string().min(1).max(100).optional(),
  price: z.number().positive().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

const BundleItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().positive(),
});

// GET /api/v1/bundles - List all bundles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { is_active, search } = req.query;

    // Build where clause
    const where = {
      tenant_id,
      ...(is_active !== undefined && { is_active: is_active === 'true' ? 1 : 0 }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const bundles = await prisma.product_bundles.findMany({
      where,
      include: {
        bundle_items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                stock: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Calculate item count and individual price for each bundle
    const data = bundles.map((bundle) => {
      const item_count = bundle.bundle_items.length;
      const individual_price = bundle.bundle_items.reduce((sum, item) => {
        return sum + (item.quantity * item.products.price);
      }, 0);
      const savings = individual_price - bundle.price;
      const savings_percent = individual_price > 0 ? (savings / individual_price) * 100 : 0;

      return {
        ...bundle,
        item_count,
        individual_price,
        savings,
        savings_percent: Math.round(savings_percent * 100) / 100,
      };
    });

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to list bundles');
    res.status(500).json({ success: false, error: 'Failed to list bundles' });
  }
});

// GET /api/v1/bundles/:id - Get bundle detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;

    const bundle = await prisma.product_bundles.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      include: {
        bundle_items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                stock: true,
                image_url: true,
              },
            },
          },
        },
      },
    });

    if (!bundle) {
      return res.status(404).json({ success: false, error: 'Bundle not found' });
    }

    // Calculate totals
    const individual_price = bundle.bundle_items.reduce((sum, item) => {
      return sum + (item.quantity * item.products.price);
    }, 0);
    const savings = individual_price - bundle.price;
    const savings_percent = individual_price > 0 ? (savings / individual_price) * 100 : 0;

    // Check stock availability
    const min_available_sets = Math.min(
      ...bundle.bundle_items.map((item) => 
        Math.floor(item.products.stock / item.quantity)
      )
    );

    res.json({
      success: true,
      data: {
        ...bundle,
        individual_price,
        savings,
        savings_percent: Math.round(savings_percent * 100) / 100,
        available_sets: min_available_sets,
      },
    });
  } catch (error) {
    logger.error({ error, user: req.user, bundleId: req.params.id }, 'Failed to get bundle');
    res.status(500).json({ success: false, error: 'Failed to get bundle' });
  }
});

// POST /api/v1/bundles - Create bundle
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const validation = BundleCreateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { name, sku, price, description, is_active, items } = validation.data;

    // Check if SKU already exists
    const existingBundle = await prisma.product_bundles.findFirst({
      where: {
        tenant_id,
        sku,
      },
    });

    if (existingBundle) {
      return res.status(400).json({
        success: false,
        error: 'SKU already exists',
      });
    }

    // Verify all products exist
    const productIds = items.map((item) => item.product_id);
    const products = await prisma.products.findMany({
      where: {
        tenant_id,
        id: { in: productIds },
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more products not found',
      });
    }

    // Create bundle with items in a transaction
    const bundle = await prisma.$transaction(async (tx) => {
      const newBundle = await tx.product_bundles.create({
        data: {
          tenant_id,
          name,
          sku,
          price,
          description,
          is_active: is_active ? 1 : 0,
        },
      });

      await tx.product_bundle_items.createMany({
        data: items.map((item) => ({
          tenant_id,
          bundle_id: newBundle.id,
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });

      return await tx.product_bundles.findUnique({
        where: { id: newBundle.id },
        include: {
          bundle_items: {
            include: {
              products: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                },
              },
            },
          },
        },
      });
    });

    logger.info({ user: req.user, bundleId: bundle.id }, 'Bundle created');

    res.status(201).json({
      success: true,
      data: bundle,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to create bundle');
    res.status(500).json({ success: false, error: 'Failed to create bundle' });
  }
});

// PUT /api/v1/bundles/:id - Update bundle
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;
    const validation = BundleUpdateSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const updateData = validation.data;

    // If updating SKU, check for duplicates
    if (updateData.sku) {
      const existingBundle = await prisma.product_bundles.findFirst({
        where: {
          tenant_id,
          sku: updateData.sku,
          id: { not: parseInt(id) },
        },
      });

      if (existingBundle) {
        return res.status(400).json({
          success: false,
          error: 'SKU already exists',
        });
      }
    }

    // Convert is_active boolean to integer
    if (updateData.is_active !== undefined) {
      updateData.is_active = updateData.is_active ? 1 : 0;
    }

    const bundle = await prisma.product_bundles.updateMany({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      data: {
        ...updateData,
        updated_at: new Date(),
      },
    });

    if (bundle.count === 0) {
      return res.status(404).json({ success: false, error: 'Bundle not found' });
    }

    const updatedBundle = await prisma.product_bundles.findUnique({
      where: { id: parseInt(id) },
      include: {
        bundle_items: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
              },
            },
          },
        },
      },
    });

    logger.info({ user: req.user, bundleId: id }, 'Bundle updated');

    res.json({
      success: true,
      data: updatedBundle,
    });
  } catch (error) {
    logger.error({ error, user: req.user, bundleId: req.params.id }, 'Failed to update bundle');
    res.status(500).json({ success: false, error: 'Failed to update bundle' });
  }
});

// DELETE /api/v1/bundles/:id - Delete bundle
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;

    const bundle = await prisma.product_bundles.deleteMany({
      where: {
        id: parseInt(id),
        tenant_id,
      },
    });

    if (bundle.count === 0) {
      return res.status(404).json({ success: false, error: 'Bundle not found' });
    }

    logger.info({ user: req.user, bundleId: id }, 'Bundle deleted');

    res.json({
      success: true,
      message: 'Bundle deleted successfully',
    });
  } catch (error) {
    logger.error({ error, user: req.user, bundleId: req.params.id }, 'Failed to delete bundle');
    res.status(500).json({ success: false, error: 'Failed to delete bundle' });
  }
});

// POST /api/v1/bundles/:id/items - Add item to bundle
router.post('/:id/items', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;
    const validation = BundleItemSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

    const { product_id, quantity } = validation.data;

    // Verify bundle exists
    const bundle = await prisma.product_bundles.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
    });

    if (!bundle) {
      return res.status(404).json({ success: false, error: 'Bundle not found' });
    }

    // Verify product exists
    const product = await prisma.products.findFirst({
      where: {
        id: product_id,
        tenant_id,
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check if item already exists in bundle
    const existingItem = await prisma.product_bundle_items.findFirst({
      where: {
        bundle_id: parseInt(id),
        product_id,
        tenant_id,
      },
    });

    if (existingItem) {
      return res.status(400).json({
        success: false,
        error: 'Product already exists in bundle',
      });
    }

    // Add item
    const item = await prisma.product_bundle_items.create({
      data: {
        tenant_id,
        bundle_id: parseInt(id),
        product_id,
        quantity,
      },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
          },
        },
      },
    });

    logger.info({ user: req.user, bundleId: id, itemId: item.id }, 'Bundle item added');

    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    logger.error({ error, user: req.user, bundleId: req.params.id }, 'Failed to add bundle item');
    res.status(500).json({ success: false, error: 'Failed to add bundle item' });
  }
});

// DELETE /api/v1/bundles/:id/items/:itemId - Remove item from bundle
router.delete('/:id/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id, itemId } = req.params;

    const item = await prisma.product_bundle_items.deleteMany({
      where: {
        id: parseInt(itemId),
        bundle_id: parseInt(id),
        tenant_id,
      },
    });

    if (item.count === 0) {
      return res.status(404).json({ success: false, error: 'Bundle item not found' });
    }

    logger.info({ user: req.user, bundleId: id, itemId }, 'Bundle item removed');

    res.json({
      success: true,
      message: 'Bundle item removed successfully',
    });
  } catch (error) {
    logger.error(
      { error, user: req.user, bundleId: req.params.id, itemId: req.params.itemId },
      'Failed to remove bundle item'
    );
    res.status(500).json({ success: false, error: 'Failed to remove bundle item' });
  }
});

module.exports = router;
