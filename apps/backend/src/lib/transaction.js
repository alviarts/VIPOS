/**
 * Database Transaction Helper
 *
 * Provides atomic transaction support for critical operations.
 * Ensures all-or-nothing execution (ACID compliance).
 *
 * Usage:
 * await withTransaction(async (tx) => {
 *   await tx.product.update({ ... });
 *   await tx.inventory.create({ ... });
 *   await tx.transaction.create({ ... });
 * });
 */

const { captureError } = require('../lib/sentry');

/**
 * Execute operations within a database transaction.
 * If any operation fails, all changes are rolled back.
 *
 * @param {Function} callback - Async function that receives transaction client
 * @returns {Promise<any>} Result of callback
 */
async function withTransaction(callback) {
  const db = require('../lib/db');

  try {
    const result = await db.$transaction(async (tx) => {
      return await callback(tx);
    });

    return result;
  } catch (error) {
    captureError(error, { context: 'database-transaction' });
    throw error;
  }
}

/**
 * Execute checkout transaction atomically.
 *
 * Steps:
 * 1. Validate stock availability
 * 2. Create transaction record
 * 3. Update stock levels
 * 4. Create transaction items
 * 5. Update customer loyalty points (if applicable)
 * 6. Create receipt
 *
 * All steps must succeed or all are rolled back.
 *
 * @param {Object} checkoutData - Checkout data
 * @returns {Promise<Object>} Transaction result
 */
async function atomicCheckout(checkoutData) {
  return await withTransaction(async (tx) => {
    const {
      items,
      customerId,
      paymentMethod,
      amountPaid,
      cashierId,
      outletId,
      discount = 0,
    } = checkoutData;

    // Step 1: Validate and lock stock
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, stock: true, price: true },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for product ${item.productId}. Available: ${product.stock}, Required: ${item.quantity}`
        );
      }
    }

    // Step 2: Calculate totals
    let subtotal = 0;
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { price: true },
      });
      subtotal += product.price * item.quantity;
    }

    const total = subtotal - discount;
    const change = amountPaid - total;

    if (change < 0) {
      throw new Error('Insufficient payment amount');
    }

    // Step 3: Create transaction
    const transaction = await tx.transaction.create({
      data: {
        customer_id: customerId,
        cashier_id: cashierId,
        outlet_id: outletId,
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        change,
        status: 'completed',
        created_at: new Date(),
      },
    });

    // Step 4: Create transaction items and update stock
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { price: true },
      });

      // Create transaction item
      await tx.transactionItem.create({
        data: {
          transaction_id: transaction.id,
          product_id: item.productId,
          quantity: item.quantity,
          price: product.price,
          subtotal: product.price * item.quantity,
        },
      });

      // Update stock (atomic decrement)
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });

      // Create stock movement record
      await tx.stockMovement.create({
        data: {
          product_id: item.productId,
          type: 'out',
          quantity: item.quantity,
          reference_type: 'transaction',
          reference_id: transaction.id,
          outlet_id: outletId,
          created_by: cashierId,
          created_at: new Date(),
        },
      });
    }

    // Step 5: Update customer loyalty points (if applicable)
    if (customerId) {
      const pointsEarned = Math.floor(total / 10000); // 1 point per 10,000 IDR

      if (pointsEarned > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            loyalty_points: {
              increment: pointsEarned,
            },
          },
        });

        // Create loyalty transaction
        await tx.loyaltyTransaction.create({
          data: {
            customer_id: customerId,
            transaction_id: transaction.id,
            points: pointsEarned,
            type: 'earn',
            created_at: new Date(),
          },
        });
      }
    }

    return transaction;
  });
}

/**
 * Execute stock transfer atomically.
 *
 * Steps:
 * 1. Validate source outlet has sufficient stock
 * 2. Decrement stock from source outlet
 * 3. Increment stock to destination outlet
 * 4. Create transfer record
 * 5. Create stock movements for both outlets
 *
 * @param {Object} transferData - Transfer data
 * @returns {Promise<Object>} Transfer result
 */
async function atomicStockTransfer(transferData) {
  return await withTransaction(async (tx) => {
    const { productId, quantity, fromOutletId, toOutletId, requestedBy, notes } = transferData;

    // Step 1: Validate source stock
    const sourceStock = await tx.outletStock.findUnique({
      where: {
        outlet_id_product_id: {
          outlet_id: fromOutletId,
          product_id: productId,
        },
      },
    });

    if (!sourceStock || sourceStock.quantity < quantity) {
      throw new Error(
        `Insufficient stock at source outlet. Available: ${sourceStock?.quantity || 0}, Required: ${quantity}`
      );
    }

    // Step 2: Create transfer record
    const transfer = await tx.stockTransfer.create({
      data: {
        product_id: productId,
        quantity,
        from_outlet_id: fromOutletId,
        to_outlet_id: toOutletId,
        status: 'completed',
        requested_by: requestedBy,
        notes,
        created_at: new Date(),
      },
    });

    // Step 3: Update source outlet stock
    await tx.outletStock.update({
      where: {
        outlet_id_product_id: {
          outlet_id: fromOutletId,
          product_id: productId,
        },
      },
      data: {
        quantity: {
          decrement: quantity,
        },
      },
    });

    // Step 4: Update destination outlet stock
    await tx.outletStock.upsert({
      where: {
        outlet_id_product_id: {
          outlet_id: toOutletId,
          product_id: productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
        outlet_id: toOutletId,
        product_id: productId,
        quantity,
      },
    });

    // Step 5: Create stock movements
    await tx.stockMovement.createMany({
      data: [
        {
          product_id: productId,
          type: 'transfer_out',
          quantity,
          reference_type: 'transfer',
          reference_id: transfer.id,
          outlet_id: fromOutletId,
          created_by: requestedBy,
          created_at: new Date(),
        },
        {
          product_id: productId,
          type: 'transfer_in',
          quantity,
          reference_type: 'transfer',
          reference_id: transfer.id,
          outlet_id: toOutletId,
          created_by: requestedBy,
          created_at: new Date(),
        },
      ],
    });

    return transfer;
  });
}

/**
 * Execute stock opname finalization atomically.
 *
 * Steps:
 * 1. Validate opname is in draft status
 * 2. Calculate variances
 * 3. Update stock levels
 * 4. Create stock adjustments
 * 5. Mark opname as final
 *
 * @param {string} opnameId - Stock opname ID
 * @param {string} finalizedBy - User ID
 * @returns {Promise<Object>} Opname result
 */
async function atomicStockOpnameFinalize(opnameId, finalizedBy) {
  return await withTransaction(async (tx) => {
    // Step 1: Get opname
    const opname = await tx.stockOpname.findUnique({
      where: { id: opnameId },
      include: { items: true },
    });

    if (!opname) {
      throw new Error('Stock opname not found');
    }

    if (opname.status !== 'draft') {
      throw new Error('Stock opname is already finalized');
    }

    // Step 2: Process each item
    for (const item of opname.items) {
      const variance = item.physical_quantity - item.system_quantity;

      if (variance !== 0) {
        // Update product stock
        await tx.product.update({
          where: { id: item.product_id },
          data: {
            stock: item.physical_quantity,
          },
        });

        // Create stock adjustment
        await tx.stockMovement.create({
          data: {
            product_id: item.product_id,
            type: variance > 0 ? 'adjustment_in' : 'adjustment_out',
            quantity: Math.abs(variance),
            reference_type: 'opname',
            reference_id: opnameId,
            outlet_id: opname.outlet_id,
            created_by: finalizedBy,
            notes: `Stock opname adjustment: ${variance > 0 ? '+' : ''}${variance}`,
            created_at: new Date(),
          },
        });
      }
    }

    // Step 3: Mark opname as final
    const updated = await tx.stockOpname.update({
      where: { id: opnameId },
      data: {
        status: 'final',
        finalized_by: finalizedBy,
        finalized_at: new Date(),
      },
    });

    return updated;
  });
}

module.exports = {
  withTransaction,
  atomicCheckout,
  atomicStockTransfer,
  atomicStockOpnameFinalize,
};
