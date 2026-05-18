const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { safeLogAudit, ACTIONS } = require('../lib/audit');

const router = express.Router();

// Get all time-based prices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, is_active } = req.query;
    
    const conditions = [];
    const params = [];
    let p = 1;

    if (product_id) {
      conditions.push(`product_id = $${p++}`);
      params.push(product_id);
    }

    if (is_active === '0' || is_active === '1') {
      conditions.push(`is_active = $${p++}`);
      params.push(parseInt(is_active, 10));
    }

    let whereClause = '';
    if (conditions.length > 0) whereClause = ' WHERE ' + conditions.join(' AND ');

    const sql = `
      SELECT tp.*, p.name AS product_name, p.sku
      FROM product_time_prices tp
      LEFT JOIN products p ON tp.product_id = p.id
      ${whereClause}
      ORDER BY tp.product_id, tp.day_of_week, tp.time_start
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get time-based prices for a specific product
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const sql = `
      SELECT * FROM product_time_prices
      WHERE product_id = $1 AND is_active = 1
      ORDER BY day_of_week, time_start
    `;

    const result = await query(sql, [productId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current price for a product based on current time
router.get('/current/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, etc.
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format

    const sql = `
      SELECT * FROM product_time_prices
      WHERE product_id = $1 
        AND day_of_week = $2
        AND time_start <= $3
        AND time_end >= $3
        AND is_active = 1
      ORDER BY time_start DESC
      LIMIT 1
    `;

    const result = await query(sql, [productId, dayOfWeek, currentTime]);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      // Return base price from products table
      const productResult = await query('SELECT price FROM products WHERE id = $1', [productId]);
      if (productResult.rows.length > 0) {
        res.json({ price: productResult.rows[0].price, is_base_price: true });
      } else {
        res.status(404).json({ error: 'Product not found' });
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create time-based price
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { product_id, day_of_week, time_start, time_end, price, is_active = 1 } = req.body;

    if (!product_id || day_of_week === undefined || !time_start || !time_end || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({ error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' });
    }

    const sql = `
      INSERT INTO product_time_prices (product_id, day_of_week, time_start, time_end, price, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query(sql, [product_id, day_of_week, time_start, time_end, price, is_active]);
    const created = result.rows[0];

    await safeLogAudit(req, ACTIONS.CREATE, 'product_time_prices', created.id, null, created);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update time-based price
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, time_start, time_end, price, is_active } = req.body;

    // Get existing record
    const existing = await query('SELECT * FROM product_time_prices WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Time price not found' });
    }

    const updates = [];
    const params = [];
    let p = 1;

    if (day_of_week !== undefined) {
      if (day_of_week < 0 || day_of_week > 6) {
        return res.status(400).json({ error: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)' });
      }
      updates.push(`day_of_week = $${p++}`);
      params.push(day_of_week);
    }

    if (time_start !== undefined) {
      updates.push(`time_start = $${p++}`);
      params.push(time_start);
    }

    if (time_end !== undefined) {
      updates.push(`time_end = $${p++}`);
      params.push(time_end);
    }

    if (price !== undefined) {
      updates.push(`price = $${p++}`);
      params.push(price);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${p++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `
      UPDATE product_time_prices
      SET ${updates.join(', ')}
      WHERE id = $${p}
      RETURNING *
    `;

    const result = await query(sql, params);
    const updated = result.rows[0];

    await safeLogAudit(req, ACTIONS.UPDATE, 'product_time_prices', id, existing.rows[0], updated);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete time-based price
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM product_time_prices WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Time price not found' });
    }

    await query('DELETE FROM product_time_prices WHERE id = $1', [id]);

    await safeLogAudit(req, ACTIONS.DELETE, 'product_time_prices', id, existing.rows[0], null);

    res.json({ message: 'Time price deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
