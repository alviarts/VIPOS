const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { safeLogAudit, ACTIONS } = require('../lib/audit');

const router = express.Router();

// Get all serials
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, status } = req.query;
    
    const conditions = [];
    const params = [];
    let p = 1;

    if (product_id) {
      conditions.push(`ps.product_id = $${p++}`);
      params.push(product_id);
    }

    if (status) {
      conditions.push(`ps.status = $${p++}`);
      params.push(status);
    }

    let whereClause = '';
    if (conditions.length > 0) whereClause = ' WHERE ' + conditions.join(' AND ');

    const sql = `
      SELECT ps.*, p.name AS product_name, p.sku,
             t.invoice_number AS transaction_invoice
      FROM product_serials ps
      LEFT JOIN products p ON ps.product_id = p.id
      LEFT JOIN transactions t ON ps.transaction_id = t.id
      ${whereClause}
      ORDER BY ps.created_at DESC
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get serials for a specific product
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { status } = req.query;
    
    let sql = `
      SELECT ps.*, t.invoice_number AS transaction_invoice
      FROM product_serials ps
      LEFT JOIN transactions t ON ps.transaction_id = t.id
      WHERE ps.product_id = $1
    `;
    
    const params = [productId];
    
    if (status) {
      sql += ` AND ps.status = $2`;
      params.push(status);
    }
    
    sql += ` ORDER BY ps.status, ps.created_at DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get serial by serial number
router.get('/lookup/:serialNumber', authenticateToken, async (req, res) => {
  try {
    const { serialNumber } = req.params;
    
    const sql = `
      SELECT ps.*, p.name AS product_name, p.sku,
             t.invoice_number AS transaction_invoice
      FROM product_serials ps
      LEFT JOIN products p ON ps.product_id = p.id
      LEFT JOIN transactions t ON ps.transaction_id = t.id
      WHERE ps.serial_number = $1
    `;

    const result = await query(sql, [serialNumber]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Serial number not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create serial
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { product_id, serial_number, status = 'available', notes } = req.body;

    if (!product_id || !serial_number) {
      return res.status(400).json({ error: 'Missing required fields: product_id, serial_number' });
    }

    const validStatuses = ['available', 'sold', 'returned', 'defective'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const sql = `
      INSERT INTO product_serials (product_id, serial_number, status, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await query(sql, [product_id, serial_number, status, notes || null]);
    const created = result.rows[0];

    await safeLogAudit(req, ACTIONS.CREATE, 'product_serials', created.id, null, created);

    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes('duplicate key')) {
      return res.status(409).json({ error: 'Serial number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Bulk create serials
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { product_id, serial_numbers, status = 'available', notes } = req.body;

    if (!product_id || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: product_id, serial_numbers (array)' 
      });
    }

    const validStatuses = ['available', 'sold', 'returned', 'defective'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const created = [];
    const errors = [];

    for (const serial_number of serial_numbers) {
      try {
        const sql = `
          INSERT INTO product_serials (product_id, serial_number, status, notes)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        const result = await query(sql, [product_id, serial_number, status, notes || null]);
        created.push(result.rows[0]);
        
        await safeLogAudit(req, ACTIONS.CREATE, 'product_serials', result.rows[0].id, null, result.rows[0]);
      } catch (err) {
        errors.push({ serial_number, error: err.message });
      }
    }

    res.status(201).json({ 
      created: created.length,
      serials: created,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update serial
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Get existing record
    const existing = await query('SELECT * FROM product_serials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Serial not found' });
    }

    const updates = [];
    const params = [];
    let p = 1;

    if (status !== undefined) {
      const validStatuses = ['available', 'sold', 'returned', 'defective'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
        });
      }
      updates.push(`status = $${p++}`);
      params.push(status);
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
      UPDATE product_serials
      SET ${updates.join(', ')}
      WHERE id = $${p}
      RETURNING *
    `;

    const result = await query(sql, params);
    const updated = result.rows[0];

    await safeLogAudit(req, ACTIONS.UPDATE, 'product_serials', id, existing.rows[0], updated);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark serial as sold
router.put('/:id/sell', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_id } = req.body;

    // Get existing record
    const existing = await query('SELECT * FROM product_serials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Serial not found' });
    }

    if (existing.rows[0].status === 'sold') {
      return res.status(400).json({ error: 'Serial is already sold' });
    }

    const sql = `
      UPDATE product_serials
      SET status = 'sold',
          sold_date = CURRENT_TIMESTAMP,
          transaction_id = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(sql, [transaction_id || null, id]);
    const updated = result.rows[0];

    await safeLogAudit(req, ACTIONS.UPDATE, 'product_serials', id, existing.rows[0], updated);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete serial
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM product_serials WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Serial not found' });
    }

    await query('DELETE FROM product_serials WHERE id = $1', [id]);

    await safeLogAudit(req, ACTIONS.DELETE, 'product_serials', id, existing.rows[0], null);

    res.json({ message: 'Serial deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
