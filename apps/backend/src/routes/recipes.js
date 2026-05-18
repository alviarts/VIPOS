/**
 * Product Recipes API Routes
 *
 * Manages product recipes (Master Resep) for F&B businesses.
 * A recipe defines how to make a product from ingredients.
 */

const express = require('express');
const { z } = require('zod');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../db/prisma');
const { logger } = require('../lib/logger');

const router = express.Router();

// Validation schemas
const RecipeCreateSchema = z.object({
  product_id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  yield_quantity: z.number().positive(),
  yield_unit: z.string().min(1).max(50),
  preparation_time_minutes: z.number().int().min(0).optional(),
  cooking_time_minutes: z.number().int().min(0).optional(),
  instructions: z.string().optional(),
  is_active: z.boolean().default(true),
});

const RecipeIngredientSchema = z.object({
  ingredient_product_id: z.number().int().positive(),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(50),
  notes: z.string().optional(),
});

// GET /api/v1/recipes - List all recipes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { product_id, is_active, search } = req.query;

    // Build where clause
    const where = {
      tenant_id,
      ...(product_id && { product_id: parseInt(product_id) }),
      ...(is_active !== undefined && { is_active: is_active === 'true' ? 1 : 0 }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { products: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const recipes = await prisma.product_recipes.findMany({
      where,
      include: {
        products: {
          select: {
            name: true,
            sku: true,
          },
        },
        recipe_ingredients: {
          include: {
            products: {
              select: {
                harga_modal: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Calculate ingredient count and total cost for each recipe
    const data = recipes.map((recipe) => {
      const ingredient_count = recipe.recipe_ingredients.length;
      const total_cost = recipe.recipe_ingredients.reduce((sum, ingredient) => {
        return sum + (ingredient.quantity * (ingredient.products.harga_modal || 0));
      }, 0);

      return {
        ...recipe,
        product_name: recipe.products.name,
        product_sku: recipe.products.sku,
        ingredient_count,
        total_cost,
        // Remove nested objects to match original response format
        products: undefined,
        recipe_ingredients: undefined,
      };
    });

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to list recipes');
    res.status(500).json({ success: false, error: 'Failed to list recipes' });
  }
});

// GET /api/v1/recipes/:id - Get recipe detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;

    const recipe = await prisma.product_recipes.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      include: {
        products: {
          select: {
            name: true,
            sku: true,
            image_url: true,
          },
        },
        recipe_ingredients: {
          include: {
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                harga_modal: true,
                satuan: true,
              },
            },
          },
          orderBy: {
            sort_order: 'asc',
          },
        },
        recipe_steps: {
          orderBy: {
            step_number: 'asc',
          },
        },
      },
    });

    if (!recipe) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }

    // Format ingredients
    const ingredients = recipe.recipe_ingredients.map((ingredient) => ({
      id: ingredient.id,
      ingredient_product_id: ingredient.ingredient_product_id,
      ingredient_name: ingredient.products.name,
      ingredient_sku: ingredient.products.sku,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      unit_cost: ingredient.products.harga_modal,
      cost: ingredient.quantity * (ingredient.products.harga_modal || 0),
      notes: ingredient.notes,
      sort_order: ingredient.sort_order,
      stock_unit: ingredient.products.satuan,
    }));

    // Format steps
    const steps = recipe.recipe_steps.map((step) => ({
      id: step.id,
      step_number: step.step_number,
      instruction: step.instruction,
      duration_minutes: step.duration_minutes,
      image_url: step.image_url,
    }));

    // Calculate total cost
    const total_cost = ingredients.reduce((sum, ing) => sum + ing.cost, 0);

    const data = {
      ...recipe,
      product_name: recipe.products.name,
      product_sku: recipe.products.sku,
      product_image: recipe.products.image_url,
      ingredients,
      steps,
      total_cost,
      // Remove nested objects
      products: undefined,
      recipe_ingredients: undefined,
      recipe_steps: undefined,
    };

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ error, user: req.user, recipeId: req.params.id }, 'Failed to get recipe');
    res.status(500).json({ success: false, error: 'Failed to get recipe' });
  }
});

// POST /api/v1/recipes - Create recipe
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const validated = RecipeCreateSchema.parse(req.body);

    // Check if product exists
    const product = await prisma.products.findFirst({
      where: {
        id: validated.product_id,
        tenant_id,
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Create recipe
    const recipe = await prisma.product_recipes.create({
      data: {
        tenant_id,
        product_id: validated.product_id,
        name: validated.name,
        description: validated.description,
        yield_quantity: validated.yield_quantity,
        yield_unit: validated.yield_unit,
        preparation_time: validated.preparation_time_minutes || 0,
        cooking_time: validated.cooking_time_minutes || 0,
        is_active: validated.is_active ? 1 : 0,
        created_by: user_id,
      },
    });

    logger.info({ user: req.user, recipe }, 'Recipe created');

    res.status(201).json({
      success: true,
      data: recipe,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    logger.error({ error, user: req.user }, 'Failed to create recipe');
    res.status(500).json({ success: false, error: 'Failed to create recipe' });
  }
});

// PUT /api/v1/recipes/:id - Update recipe
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;
    const validated = RecipeCreateSchema.partial().parse(req.body);

    // Build update data object, only including provided fields
    const updateData = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.yield_quantity !== undefined) updateData.yield_quantity = validated.yield_quantity;
    if (validated.yield_unit !== undefined) updateData.yield_unit = validated.yield_unit;
    if (validated.preparation_time_minutes !== undefined) updateData.preparation_time = validated.preparation_time_minutes;
    if (validated.cooking_time_minutes !== undefined) updateData.cooking_time = validated.cooking_time_minutes;
    if (validated.is_active !== undefined) updateData.is_active = validated.is_active ? 1 : 0;
    updateData.updated_at = new Date();

    const recipe = await prisma.product_recipes.updateMany({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      data: updateData,
    });

    if (recipe.count === 0) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }

    // Fetch updated recipe
    const updatedRecipe = await prisma.product_recipes.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
    });

    logger.info({ user: req.user, recipe: updatedRecipe }, 'Recipe updated');

    res.json({
      success: true,
      data: updatedRecipe,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    logger.error({ error, user: req.user, recipeId: req.params.id }, 'Failed to update recipe');
    res.status(500).json({ success: false, error: 'Failed to update recipe' });
  }
});

// DELETE /api/v1/recipes/:id - Delete recipe
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;

    // Check if recipe exists
    const recipe = await prisma.product_recipes.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
    });

    if (!recipe) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }

    // Delete recipe (cascade will handle ingredients and steps)
    await prisma.product_recipes.delete({
      where: {
        id: parseInt(id),
      },
    });

    logger.info({ user: req.user, recipeId: id }, 'Recipe deleted');

    res.json({
      success: true,
      message: 'Recipe deleted successfully',
    });
  } catch (error) {
    logger.error({ error, user: req.user, recipeId: req.params.id }, 'Failed to delete recipe');
    res.status(500).json({ success: false, error: 'Failed to delete recipe' });
  }
});

// POST /api/v1/recipes/:id/ingredients - Add ingredient to recipe
router.post('/:id/ingredients', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;
    const validated = RecipeIngredientSchema.parse(req.body);

    // Check if recipe exists
    const recipe = await prisma.product_recipes.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
    });

    if (!recipe) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }

    // Check if ingredient product exists
    const product = await prisma.products.findFirst({
      where: {
        id: validated.ingredient_product_id,
        tenant_id,
      },
      select: {
        id: true,
        name: true,
        harga_modal: true,
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Ingredient product not found' });
    }

    // Get max sort order
    const maxSortOrder = await prisma.recipe_ingredients.aggregate({
      where: {
        recipe_id: parseInt(id),
        tenant_id,
      },
      _max: {
        sort_order: true,
      },
    });

    const sortOrder = (maxSortOrder._max.sort_order || 0) + 1;

    // Calculate cost
    const cost = validated.quantity * (product.harga_modal || 0);

    // Add ingredient
    const ingredient = await prisma.recipe_ingredients.create({
      data: {
        tenant_id,
        recipe_id: parseInt(id),
        ingredient_product_id: validated.ingredient_product_id,
        quantity: validated.quantity,
        unit: validated.unit,
        cost,
        notes: validated.notes,
        sort_order: sortOrder,
      },
    });

    logger.info({ user: req.user, ingredient }, 'Recipe ingredient added');

    res.status(201).json({
      success: true,
      data: ingredient,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    logger.error({ error, user: req.user, recipeId: req.params.id }, 'Failed to add ingredient');
    res.status(500).json({ success: false, error: 'Failed to add ingredient' });
  }
});

// PUT /api/v1/recipes/:id/ingredients/:ingredientId - Update ingredient
router.put('/:id/ingredients/:ingredientId', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id, ingredientId } = req.params;
    const validated = RecipeIngredientSchema.partial().parse(req.body);

    // Build update data
    const updateData = {};
    if (validated.quantity !== undefined) updateData.quantity = validated.quantity;
    if (validated.unit !== undefined) updateData.unit = validated.unit;
    if (validated.notes !== undefined) updateData.notes = validated.notes;

    // If quantity changed, recalculate cost
    if (validated.quantity !== undefined) {
      const ingredient = await prisma.recipe_ingredients.findFirst({
        where: {
          id: parseInt(ingredientId),
          recipe_id: parseInt(id),
          tenant_id,
        },
        include: {
          products: {
            select: {
              harga_modal: true,
            },
          },
        },
      });

      if (ingredient) {
        updateData.cost = validated.quantity * (ingredient.products.harga_modal || 0);
      }
    }

    const result = await prisma.recipe_ingredients.updateMany({
      where: {
        id: parseInt(ingredientId),
        recipe_id: parseInt(id),
        tenant_id,
      },
      data: updateData,
    });

    if (result.count === 0) {
      return res.status(404).json({ success: false, error: 'Ingredient not found' });
    }

    // Fetch updated ingredient
    const updatedIngredient = await prisma.recipe_ingredients.findFirst({
      where: {
        id: parseInt(ingredientId),
        recipe_id: parseInt(id),
        tenant_id,
      },
    });

    logger.info({ user: req.user, ingredient: updatedIngredient }, 'Recipe ingredient updated');

    res.json({
      success: true,
      data: updatedIngredient,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    logger.error({ error, user: req.user }, 'Failed to update ingredient');
    res.status(500).json({ success: false, error: 'Failed to update ingredient' });
  }
});

// DELETE /api/v1/recipes/:id/ingredients/:ingredientId - Remove ingredient
router.delete('/:id/ingredients/:ingredientId', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id, ingredientId } = req.params;

    const result = await prisma.recipe_ingredients.deleteMany({
      where: {
        id: parseInt(ingredientId),
        recipe_id: parseInt(id),
        tenant_id,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ success: false, error: 'Ingredient not found' });
    }

    logger.info({ user: req.user, ingredientId }, 'Recipe ingredient removed');

    res.json({
      success: true,
      message: 'Ingredient removed successfully',
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to remove ingredient');
    res.status(500).json({ success: false, error: 'Failed to remove ingredient' });
  }
});

// GET /api/v1/recipes/:id/cost-analysis - Calculate recipe cost
router.get('/:id/cost-analysis', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { id } = req.params;

    const recipe = await prisma.product_recipes.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      include: {
        products: {
          select: {
            price: true,
          },
        },
        recipe_ingredients: {
          include: {
            products: {
              select: {
                harga_modal: true,
              },
            },
          },
        },
      },
    });

    if (!recipe) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }

    const total_ingredient_cost = recipe.recipe_ingredients.reduce((sum, ingredient) => {
      return sum + (ingredient.quantity * (ingredient.products.harga_modal || 0));
    }, 0);

    const ingredient_count = recipe.recipe_ingredients.length;
    const costPerUnit = recipe.yield_quantity > 0 ? total_ingredient_cost / recipe.yield_quantity : 0;
    const product_sell_price = recipe.products.price || 0;
    const profitPerUnit = product_sell_price - costPerUnit;
    const profitMargin = product_sell_price > 0 ? (profitPerUnit / product_sell_price) * 100 : 0;

    res.json({
      success: true,
      data: {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        yield_quantity: recipe.yield_quantity,
        yield_unit: recipe.yield_unit,
        ingredient_count,
        total_ingredient_cost,
        cost_per_unit: costPerUnit,
        product_sell_price,
        profit_per_unit: profitPerUnit,
        profit_margin_percent: profitMargin,
      },
    });
  } catch (error) {
    logger.error({ error, user: req.user, recipeId: req.params.id }, 'Failed to calculate cost');
    res.status(500).json({ success: false, error: 'Failed to calculate cost' });
  }
});

// POST /api/v1/recipes/:id/duplicate - Duplicate recipe
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, user_id } = req.user;
    const { id } = req.params;

    // Get original recipe with ingredients
    const original = await prisma.product_recipes.findFirst({
      where: {
        id: parseInt(id),
        tenant_id,
      },
      include: {
        recipe_ingredients: true,
        recipe_steps: true,
      },
    });

    if (!original) {
      return res.status(404).json({ success: false, error: 'Recipe not found' });
    }

    // Use transaction to create duplicate recipe with ingredients and steps
    const newRecipe = await prisma.$transaction(async (tx) => {
      // Create duplicate recipe
      const recipe = await tx.product_recipes.create({
        data: {
          tenant_id,
          product_id: original.product_id,
          name: `${original.name} (Copy)`,
          description: original.description,
          yield_quantity: original.yield_quantity,
          yield_unit: original.yield_unit,
          preparation_time: original.preparation_time,
          cooking_time: original.cooking_time,
          is_active: 0, // Set as inactive by default
          created_by: user_id,
        },
      });

      // Copy ingredients
      if (original.recipe_ingredients.length > 0) {
        await tx.recipe_ingredients.createMany({
          data: original.recipe_ingredients.map((ingredient) => ({
            tenant_id,
            recipe_id: recipe.id,
            ingredient_product_id: ingredient.ingredient_product_id,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            cost: ingredient.cost,
            notes: ingredient.notes,
            sort_order: ingredient.sort_order,
          })),
        });
      }

      // Copy steps
      if (original.recipe_steps.length > 0) {
        await tx.recipe_steps.createMany({
          data: original.recipe_steps.map((step) => ({
            tenant_id,
            recipe_id: recipe.id,
            step_number: step.step_number,
            instruction: step.instruction,
            duration_minutes: step.duration_minutes,
            image_url: step.image_url,
          })),
        });
      }

      return recipe;
    });

    logger.info(
      { user: req.user, originalId: id, newId: newRecipe.id },
      'Recipe duplicated'
    );

    res.status(201).json({
      success: true,
      data: newRecipe,
    });
  } catch (error) {
    logger.error({ error, user: req.user, recipeId: req.params.id }, 'Failed to duplicate recipe');
    res.status(500).json({ success: false, error: 'Failed to duplicate recipe' });
  }
});

module.exports = router;
