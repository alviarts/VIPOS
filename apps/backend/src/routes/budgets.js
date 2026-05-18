// Budget Planning Routes
// CRUD operations for budgets and budget items

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireTier } = require('../middleware/tier');

const router = express.Router();

// Get all budgets
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, period_start, period_end } = req.query;
    let sql = `
      SELECT b.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM budget_items WHERE budget_id = b.id) as item_count
      FROM budgets b
      LEFT JOIN users u ON u.id = b.created_by
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (status) {
      sql += ` AND b.status = $${idx++}`;
      params.push(status);
    }
    if (period_start) {
      sql += ` AND b.period_start >= $${idx++}`;
      params.push(period_start);
    }
    if (period_end) {
      sql += ` AND b.period_end <= $${idx++}`;
      params.push(period_end);
    }

    sql += ' ORDER BY b.period_start DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Get budget by ID with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const budgetSql = `
      SELECT b.*, u.name as created_by_name
      FROM budgets b
      LEFT JOIN users u ON u.id = b.created_by
      WHERE b.id = $1
    `;
    const budgetResult = await query(budgetSql, [req.params.id]);

    if (budgetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const itemsSql = `
      SELECT bi.*, ga.code as account_code, ga.name as account_name
      FROM budget_items bi
      JOIN gl_accounts ga ON ga.id = bi.account_id
      WHERE bi.budget_id = $1
      ORDER BY ga.code
    `;
    const itemsResult = await query(itemsSql, [req.params.id]);

    const budget = budgetResult.rows[0];
    budget.items = itemsResult.rows;

    res.json(budget);
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Create budget
router.post('/', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { name, period_start, period_end, total_amount, category, notes, items } = req.body;

    if (!name || !period_start || !period_end) {
      return res.status(400).json({ error: 'Name, period_start, and period_end are required' });
    }

    // Insert budget
    const budgetSql = `
      INSERT INTO budgets (name, period_start, period_end, total_amount, category, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const budgetResult = await query(budgetSql, [
      name,
      period_start,
      period_end,
      total_amount || 0,
      category,
      notes,
      req.user.id,
    ]);

    const budget = budgetResult.rows[0];

    // Insert budget items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await query(
          `INSERT INTO budget_items (budget_id, account_id, amount, notes)
           VALUES ($1, $2, $3, $4)`,
          [budget.id, item.account_id, item.amount, item.notes]
        );
      }
    }

    res.status(201).json(budget);
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// Update budget
router.put('/:id', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { name, period_start, period_end, total_amount, category, status, notes, items } = req.body;

    // Update budget
    const budgetSql = `
      UPDATE budgets
      SET name = $1, period_start = $2, period_end = $3, total_amount = $4,
          category = $5, status = $6, notes = $7, updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `;
    const budgetResult = await query(budgetSql, [
      name,
      period_start,
      period_end,
      total_amount,
      category,
      status,
      notes,
      req.params.id,
    ]);

    if (budgetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Update budget items if provided
    if (items && Array.isArray(items)) {
      // Delete existing items
      await query('DELETE FROM budget_items WHERE budget_id = $1', [req.params.id]);

      // Insert new items
      for (const item of items) {
        await query(
          `INSERT INTO budget_items (budget_id, account_id, amount, actual_amount, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, item.account_id, item.amount, item.actual_amount || 0, item.notes]
        );
      }
    }

    res.json(budgetResult.rows[0]);
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Delete budget
router.delete('/:id', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const result = await query('DELETE FROM budgets WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// Get budget variance report
router.get('/:id/variance', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT
        bi.id,
        ga.code as account_code,
        ga.name as account_name,
        bi.amount as budgeted_amount,
        bi.actual_amount,
        (bi.actual_amount - bi.amount) as variance,
        CASE
          WHEN bi.amount > 0 THEN ((bi.actual_amount - bi.amount) * 100.0 / bi.amount)
          ELSE 0
        END as variance_percentage
      FROM budget_items bi
      JOIN gl_accounts ga ON ga.id = bi.account_id
      WHERE bi.budget_id = $1
      ORDER BY ABS(bi.actual_amount - bi.amount) DESC
    `;
    const result = await query(sql, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching budget variance:', error);
    res.status(500).json({ error: 'Failed to fetch budget variance' });
  }
});

module.exports = router;
