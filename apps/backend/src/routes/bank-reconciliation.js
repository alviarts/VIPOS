// Bank Reconciliation Routes
// CRUD operations for bank reconciliations

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { requireTier } = require('../middleware/tier');

const router = express.Router();

// Get all bank reconciliations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { account_id, status, from, to } = req.query;
    let sql = `
      SELECT br.*, ga.code as account_code, ga.name as account_name,
        u.name as reconciled_by_name,
        (SELECT COUNT(*) FROM bank_reconciliation_items WHERE reconciliation_id = br.id) as item_count,
        (SELECT COUNT(*) FROM bank_reconciliation_items WHERE reconciliation_id = br.id AND is_matched = 1) as matched_count
      FROM bank_reconciliations br
      JOIN gl_accounts ga ON ga.id = br.account_id
      LEFT JOIN users u ON u.id = br.reconciled_by
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (account_id) {
      sql += ` AND br.account_id = $${idx++}`;
      params.push(account_id);
    }
    if (status) {
      sql += ` AND br.status = $${idx++}`;
      params.push(status);
    }
    if (from) {
      sql += ` AND br.statement_date >= $${idx++}`;
      params.push(from);
    }
    if (to) {
      sql += ` AND br.statement_date <= $${idx++}`;
      params.push(to);
    }

    sql += ' ORDER BY br.statement_date DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching bank reconciliations:', error);
    res.status(500).json({ error: 'Failed to fetch bank reconciliations' });
  }
});

// Get reconciliation by ID with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const reconSql = `
      SELECT br.*, ga.code as account_code, ga.name as account_name,
        u.name as reconciled_by_name
      FROM bank_reconciliations br
      JOIN gl_accounts ga ON ga.id = br.account_id
      LEFT JOIN users u ON u.id = br.reconciled_by
      WHERE br.id = $1
    `;
    const reconResult = await query(reconSql, [req.params.id]);

    if (reconResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    const itemsSql = `
      SELECT bri.*, gj.journal_no, gj.description as journal_description
      FROM bank_reconciliation_items bri
      LEFT JOIN gl_journals gj ON gj.id = bri.transaction_id
      WHERE bri.reconciliation_id = $1
      ORDER BY bri.is_matched, bri.id
    `;
    const itemsResult = await query(itemsSql, [req.params.id]);

    const reconciliation = reconResult.rows[0];
    reconciliation.items = itemsResult.rows;

    res.json(reconciliation);
  } catch (error) {
    console.error('Error fetching reconciliation:', error);
    res.status(500).json({ error: 'Failed to fetch reconciliation' });
  }
});

// Create bank reconciliation
router.post('/', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { account_id, statement_date, statement_balance, book_balance, notes, items } = req.body;

    if (!account_id || !statement_date || statement_balance === undefined || book_balance === undefined) {
      return res.status(400).json({ error: 'Account, statement date, and balances are required' });
    }

    // Insert reconciliation
    const reconSql = `
      INSERT INTO bank_reconciliations (account_id, statement_date, statement_balance, book_balance, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const reconResult = await query(reconSql, [
      account_id,
      statement_date,
      statement_balance,
      book_balance,
      notes,
    ]);

    const reconciliation = reconResult.rows[0];

    // Insert reconciliation items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await query(
          `INSERT INTO bank_reconciliation_items (reconciliation_id, transaction_id, description, amount, is_matched, notes)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [reconciliation.id, item.transaction_id, item.description, item.amount, item.is_matched || 0, item.notes]
        );
      }
    }

    res.status(201).json(reconciliation);
  } catch (error) {
    console.error('Error creating reconciliation:', error);
    res.status(500).json({ error: 'Failed to create reconciliation' });
  }
});

// Update bank reconciliation
router.put('/:id', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const { account_id, statement_date, statement_balance, book_balance, status, notes, items } = req.body;

    // Update reconciliation
    const reconSql = `
      UPDATE bank_reconciliations
      SET account_id = $1, statement_date = $2, statement_balance = $3, book_balance = $4,
          status = $5, notes = $6, updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;
    const reconResult = await query(reconSql, [
      account_id,
      statement_date,
      statement_balance,
      book_balance,
      status,
      notes,
      req.params.id,
    ]);

    if (reconResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    // Update reconciliation items if provided
    if (items && Array.isArray(items)) {
      // Delete existing items
      await query('DELETE FROM bank_reconciliation_items WHERE reconciliation_id = $1', [req.params.id]);

      // Insert new items
      for (const item of items) {
        await query(
          `INSERT INTO bank_reconciliation_items (reconciliation_id, transaction_id, description, amount, is_matched, matched_at, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            req.params.id,
            item.transaction_id,
            item.description,
            item.amount,
            item.is_matched || 0,
            item.is_matched ? new Date() : null,
            item.notes,
          ]
        );
      }
    }

    res.json(reconResult.rows[0]);
  } catch (error) {
    console.error('Error updating reconciliation:', error);
    res.status(500).json({ error: 'Failed to update reconciliation' });
  }
});

// Mark reconciliation as completed
router.post('/:id/complete', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const sql = `
      UPDATE bank_reconciliations
      SET status = 'completed', reconciled_by = $1, reconciled_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await query(sql, [req.user.id, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error completing reconciliation:', error);
    res.status(500).json({ error: 'Failed to complete reconciliation' });
  }
});

// Match/unmatch reconciliation item
router.post('/:id/items/:itemId/match', authenticateToken, async (req, res) => {
  try {
    const { is_matched } = req.body;
    const sql = `
      UPDATE bank_reconciliation_items
      SET is_matched = $1, matched_at = $2
      WHERE id = $3 AND reconciliation_id = $4
      RETURNING *
    `;
    const result = await query(sql, [
      is_matched ? 1 : 0,
      is_matched ? new Date() : null,
      req.params.itemId,
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reconciliation item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error matching item:', error);
    res.status(500).json({ error: 'Failed to match item' });
  }
});

// Delete bank reconciliation
router.delete('/:id', authenticateToken, requireTier('starter'), async (req, res) => {
  try {
    const result = await query('DELETE FROM bank_reconciliations WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    res.json({ message: 'Reconciliation deleted successfully' });
  } catch (error) {
    console.error('Error deleting reconciliation:', error);
    res.status(500).json({ error: 'Failed to delete reconciliation' });
  }
});

module.exports = router;
