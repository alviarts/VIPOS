const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { safeLogAudit, ACTIONS } = require('../lib/audit');

const router = express.Router();

// Get all batches
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, expiring_days } = req.query;
    
    const conditions = [];
    const params = [];
    let p = 1;

    if (product_id) {
      conditions.push(`pb.product_id = $${p++}`);
      params.push(product_id);
    }

    if (expiring_days) {
      const days = parseInt(expiring_days, 10);
      conditions.push(`pb.expiry_date IS NOT NULL AND pb.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'`);
    }

    let whereClause = '';
    if (conditions.length > 0) whereClause = ' WHERE ' + conditions.join(' AND ');

    const sql = `
      SELECT pb.*, p.name AS product_name, p.sku
      FROM product_batches pb
      LEFT JOIN products p ON pb.product_id = p.id
      ${whereClause}
      ORDER BY pb.expiry_date ASC NULLS LAST, pb.received_date DESC
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get batches for a specific product
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const sql = `
      SELECT * FROM product_batches
      WHERE product_id = $1
      ORDER BY expiry_date ASC NULLS LAST, received_date DESC
    `;

    const result = await query(sql, [productId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get expiring batches (within specified days, default 30)
router.get('/expiring', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    
    const sql = `
      SELECT pb.*, p.name AS product_name, p.sku, p.category_id
      FROM product_batches pb
      LEFT JOIN products p ON pb.product_id = p.id
      WHERE pb.expiry_date IS NOT NULL 
        AND pb.expiry_date <= CURRENT_DATE + $1::interval
        AND pb.quantity > 0
      ORDER BY pb.expiry_date ASC
    `;

    const result = await query(sql, [`${days} days`]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create batch
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { product_id, batch_number, quantity, expiry_date, received_date, notes } = req.body;

    if (!product_id || !batch_number || !quantity) {
      return res.status(400).json({ error: 'Missing required fields: product_id, batch_number, quantity' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    const sql = `
      INSERT INTO product_batches (product_id, batch_number, quantity, expiry_date, received_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query(sql, [
      product_id,
      batch_number,
      quantity,
      expiry_date || null,
      received_date || null,
      notes || null
    ]);
    const created = result.rows[0];

    await safeLogAudit(req, ACTIONS.CREATE, 'product_batches', created.id, null, created);

    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('duplicate key')) {
      return res.status(409).json({ error: 'Batch number already exists for this product' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update batch
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, expiry_date, received_date, notes } = req.body;

    // Get existing record
    const existing = await query('SELECT * FROM product_batches WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const updates = [];
    const params = [];
    let p = 1;

    if (quantity !== undefined) {
      if (quantity < 0) {
        return res.status(400).json({ error: 'Quantity cannot be negative' });
      }
      updates.push(`quantity = $${p++}`);
      params.push(quantity);
    }

    if (expiry_date !== undefined) {
      updates.push(`expiry_date = $${p++}`);
      params.push(expiry_date || null);
    }

    if (received_date !== undefined) {
      updates.push(`received_date = $${p++}`);
      params.push(received_date || null);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${p++}`);
      params.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const sql = `
      UPDATE product_batches
      SET ${updates.join(', ')}
      WHERE id = $${p}
      RETURNING *
    `;

    const result = await query(sql, params);
    const updated = result.rows[0];

    await safeLogAudit(req, ACTIONS.UPDATE, 'product_batches', id, existing.rows[0], updated);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete batch
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM product_batches WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    await query('DELETE FROM product_batches WHERE id = $1', [id]);

    await safeLogAudit(req, ACTIONS.DELETE, 'product_batches', id, existing.rows[0], null);

    res.json({ message: 'Batch deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
