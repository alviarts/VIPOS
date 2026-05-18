// Multi-warehouse Management Routes
// CRUD operations for warehouses and warehouse stock

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireTier } = require('../middleware/tier');

const router = express.Router();

// Get all warehouses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { is_active } = req.query;
    let sql = `
      SELECT w.*,
        (SELECT COUNT(*) FROM warehouse_stock WHERE warehouse_id = w.id) as product_count,
        (SELECT SUM(quantity) FROM warehouse_stock WHERE warehouse_id = w.id) as total_stock
      FROM warehouses w
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (is_active !== undefined) {
      sql += ` AND w.is_active = $${idx++}`;
      params.push(is_active);
    }

    sql += ' ORDER BY w.code';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

// Get warehouse by ID with stock
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const warehouseSql = `
      SELECT w.*
      FROM warehouses w
      WHERE w.id = $1
    `;
    const warehouseResult = await query(warehouseSql, [req.params.id]);

    if (warehouseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    const stockSql = `
      SELECT ws.*, p.name as product_name, p.sku, p.barcode
      FROM warehouse_stock ws
      JOIN products p ON p.id = ws.product_id
      WHERE ws.warehouse_id = $1
      ORDER BY p.name
    `;
    const stockResult = await query(stockSql, [req.params.id]);

    const warehouse = warehouseResult.rows[0];
    warehouse.stock = stockResult.rows;

    res.json(warehouse);
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse' });
  }
});

// Create warehouse
router.post('/', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { code, name, address, is_active } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Code and name are required' });
    }

    const sql = `
      INSERT INTO warehouses (code, name, address, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query(sql, [code, name, address, is_active !== undefined ? is_active : 1]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating warehouse:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Warehouse code already exists' });
    }
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
});

// Update warehouse
router.put('/:id', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { code, name, address, is_active } = req.body;

    const sql = `
      UPDATE warehouses
      SET code = $1, name = $2, address = $3, is_active = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    const result = await query(sql, [code, name, address, is_active, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating warehouse:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Warehouse code already exists' });
    }
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
});

// Delete warehouse
router.delete('/:id', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    // Check if warehouse has stock
    const stockCheck = await query('SELECT COUNT(*) as count FROM warehouse_stock WHERE warehouse_id = $1', [
      req.params.id,
    ]);

    if (parseInt(stockCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete warehouse with existing stock' });
    }

    const result = await query('DELETE FROM warehouses WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }

    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ error: 'Failed to delete warehouse' });
  }
});

// Get warehouse stock for a specific product
router.get('/:id/stock/:productId', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT ws.*, p.name as product_name, p.sku, p.barcode
      FROM warehouse_stock ws
      JOIN products p ON p.id = ws.product_id
      WHERE ws.warehouse_id = $1 AND ws.product_id = $2
    `;
    const result = await query(sql, [req.params.id, req.params.productId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// Update warehouse stock
router.put('/:id/stock/:productId', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { quantity, min_quantity, max_quantity } = req.body;

    // Check if stock record exists
    const checkSql = 'SELECT id FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2';
    const checkResult = await query(checkSql, [req.params.id, req.params.productId]);

    let result;
    if (checkResult.rows.length > 0) {
      // Update existing stock
      const updateSql = `
        UPDATE warehouse_stock
        SET quantity = $1, min_quantity = $2, max_quantity = $3, updated_at = NOW()
        WHERE warehouse_id = $4 AND product_id = $5
        RETURNING *
      `;
      result = await query(updateSql, [quantity, min_quantity, max_quantity, req.params.id, req.params.productId]);
    } else {
      // Insert new stock record
      const insertSql = `
        INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, min_quantity, max_quantity)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      result = await query(insertSql, [req.params.id, req.params.productId, quantity, min_quantity, max_quantity]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Adjust warehouse stock (add/subtract)
router.post('/:id/stock/:productId/adjust', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { adjustment, reason } = req.body;

    if (adjustment === undefined || adjustment === 0) {
      return res.status(400).json({ error: 'Adjustment amount is required' });
    }

    // Check if stock record exists
    const checkSql = 'SELECT * FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2';
    const checkResult = await query(checkSql, [req.params.id, req.params.productId]);

    let result;
    if (checkResult.rows.length > 0) {
      // Update existing stock
      const updateSql = `
        UPDATE warehouse_stock
        SET quantity = quantity + $1, updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
        RETURNING *
      `;
      result = await query(updateSql, [adjustment, req.params.id, req.params.productId]);
    } else {
      // Insert new stock record
      const insertSql = `
        INSERT INTO warehouse_stock (warehouse_id, product_id, quantity)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      result = await query(insertSql, [req.params.id, req.params.productId, Math.max(0, adjustment)]);
    }

    // Log the adjustment in inventory_movements
    await query(
      `INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.params.productId,
        adjustment > 0 ? 'in' : 'out',
        Math.abs(adjustment),
        'warehouse_adjustment',
        req.params.id,
        reason || 'Warehouse stock adjustment',
        req.user.id,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// Get low stock items for a warehouse
router.get('/:id/low-stock', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT ws.*, p.name as product_name, p.sku, p.barcode
      FROM warehouse_stock ws
      JOIN products p ON p.id = ws.product_id
      WHERE ws.warehouse_id = $1 AND ws.quantity <= COALESCE(ws.min_quantity, 0)
      ORDER BY ws.quantity
    `;
    const result = await query(sql, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// Transfer stock between warehouses
router.post('/transfer', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { from_warehouse_id, to_warehouse_id, product_id, quantity, notes } = req.body;

    if (!from_warehouse_id || !to_warehouse_id || !product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid transfer parameters' });
    }

    if (from_warehouse_id === to_warehouse_id) {
      return res.status(400).json({ error: 'Cannot transfer to the same warehouse' });
    }

    // Check source warehouse stock
    const sourceSql = 'SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2';
    const sourceResult = await query(sourceSql, [from_warehouse_id, product_id]);

    if (sourceResult.rows.length === 0 || sourceResult.rows[0].quantity < quantity) {
      return res.status(400).json({ error: 'Insufficient stock in source warehouse' });
    }

    // Deduct from source warehouse
    await query(
      'UPDATE warehouse_stock SET quantity = quantity - $1, updated_at = NOW() WHERE warehouse_id = $2 AND product_id = $3',
      [quantity, from_warehouse_id, product_id]
    );

    // Add to destination warehouse
    const destCheckSql = 'SELECT id FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2';
    const destCheckResult = await query(destCheckSql, [to_warehouse_id, product_id]);

    if (destCheckResult.rows.length > 0) {
      await query(
        'UPDATE warehouse_stock SET quantity = quantity + $1, updated_at = NOW() WHERE warehouse_id = $2 AND product_id = $3',
        [quantity, to_warehouse_id, product_id]
      );
    } else {
      await query('INSERT INTO warehouse_stock (warehouse_id, product_id, quantity) VALUES ($1, $2, $3)', [
        to_warehouse_id,
        product_id,
        quantity,
      ]);
    }

    // Log the transfer
    await query(
      `INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        product_id,
        'transfer',
        quantity,
        'warehouse_transfer',
        from_warehouse_id,
        notes || `Transfer from warehouse ${from_warehouse_id} to ${to_warehouse_id}`,
        req.user.id,
      ]
    );

    res.json({ message: 'Stock transferred successfully' });
  } catch (error) {
    console.error('Error transferring stock:', error);
    res.status(500).json({ error: 'Failed to transfer stock' });
  }
});

module.exports = router;
