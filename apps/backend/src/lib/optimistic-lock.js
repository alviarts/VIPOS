/**
 * Optimistic Locking Helper
 *
 * Prevents race conditions when multiple users update the same resource.
 * Uses version field to detect concurrent modifications.
 *
 * How it works:
 * 1. Read resource with version field
 * 2. User makes changes
 * 3. Update with WHERE version = old_version
 * 4. If no rows updated, version changed (conflict)
 * 5. Retry or fail
 *
 * Usage:
 * await updateWithOptimisticLock('product', productId, {
 *   stock: newStock,
 * }, currentVersion);
 */

const { captureError } = require('../lib/sentry');

/**
 * Update resource with optimistic locking.
 *
 * @param {string} model - Model name (product, transaction, etc.)
 * @param {string} id - Resource ID
 * @param {Object} data - Update data
 * @param {number} expectedVersion - Expected version number
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Updated resource
 */
async function updateWithOptimisticLock(model, id, data, expectedVersion, maxRetries = 3) {
  const db = require('../lib/db');
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Update with version check
      const updated = await db[model].updateMany({
        where: {
          id,
          version: expectedVersion,
        },
        data: {
          ...data,
          version: {
            increment: 1,
          },
          updated_at: new Date(),
        },
      });

      if (updated.count === 0) {
        // Version mismatch, resource was modified by another user
        attempt++;

        if (attempt >= maxRetries) {
          throw new Error(
            `Optimistic lock failed after ${maxRetries} attempts. Resource was modified by another user.`
          );
        }

        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)));

        // Fetch latest version
        const latest = await db[model].findUnique({
          where: { id },
          select: { version: true },
        });

        if (!latest) {
          throw new Error('Resource not found');
        }

        expectedVersion = latest.version;
        continue;
      }

      // Success, fetch updated resource
      const result = await db[model].findUnique({
        where: { id },
      });

      return result;
    } catch (error) {
      if (attempt >= maxRetries - 1) {
        captureError(error, {
          context: 'optimistic-lock',
          extra: { model, id, attempt },
        });
        throw error;
      }
      attempt++;
    }
  }
}

/**
 * Update product stock with optimistic locking.
 * Prevents race condition when 2 cashiers checkout same product simultaneously.
 *
 * @param {string} productId - Product ID
 * @param {number} quantityChange - Quantity to add (positive) or subtract (negative)
 * @param {number} expectedVersion - Expected version
 * @returns {Promise<Object>} Updated product
 */
async function updateStockWithLock(productId, quantityChange, expectedVersion) {
  const db = require('../lib/db');

  try {
    // Use atomic increment/decrement with version check
    const updated = await db.product.updateMany({
      where: {
        id: productId,
        version: expectedVersion,
      },
      data: {
        stock: {
          increment: quantityChange,
        },
        version: {
          increment: 1,
        },
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      // Version mismatch or insufficient stock
      const product = await db.product.findUnique({
        where: { id: productId },
        select: { stock: true, version: true },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock + quantityChange < 0) {
        throw new Error(
          `Insufficient stock. Available: ${product.stock}, Required: ${Math.abs(quantityChange)}`
        );
      }

      throw new Error('Product was modified by another user. Please retry.');
    }

    // Fetch updated product
    const result = await db.product.findUnique({
      where: { id: productId },
    });

    return result;
  } catch (error) {
    captureError(error, {
      context: 'update-stock-with-lock',
      extra: { productId, quantityChange },
    });
    throw error;
  }
}

/**
 * Middleware to add version field to response.
 * Frontend should send this version back on update.
 *
 * Usage:
 * router.get('/product/:id', addVersionToResponse, getProduct);
 */
function addVersionToResponse(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Add version field if not present
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.version === undefined) {
        data.version = data.version || 1;
      }
    }

    return originalJson(data);
  };

  next();
}

/**
 * Middleware to check version on update.
 * Rejects request if version is missing or mismatched.
 *
 * Usage:
 * router.put('/product/:id', checkVersion, updateProduct);
 */
function checkVersion(req, res, next) {
  const version = req.body.version || req.query.version;

  if (version === undefined) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Version field is required for updates',
    });
  }

  req.expectedVersion = parseInt(version);
  next();
}

module.exports = {
  updateWithOptimisticLock,
  updateStockWithLock,
  addVersionToResponse,
  checkVersion,
};
