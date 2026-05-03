// Employee CRUD + dokumen + permission overrides (P1-14).
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  EmployeeCreateSchema,
  EmployeeUpdateSchema,
  EmployeeDocumentCreateSchema,
  PermissionAssignSchema,
} = require('@vipos/shared');

const router = express.Router();

const JSON_FIELDS = ['attendance_methods', 'allowed_outlet_ids'];

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToEmployee(row) {
  if (!row) return null;
  const result = { ...row };
  for (const field of JSON_FIELDS) {
    result[field] = parseJson(row[field], null);
  }
  return result;
}

function generateNo(db) {
  const last = db
    .prepare(
      `SELECT employee_no FROM employees WHERE employee_no LIKE 'EMP%' ORDER BY id DESC LIMIT 1`
    )
    .get();
  if (!last) return 'EMP0001';
  const num = parseInt((last.employee_no || '').replace(/\D/g, ''), 10) || 0;
  return 'EMP' + String(num + 1).padStart(4, '0');
}

router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conds = [];
    const params = [];
    if (req.query.status) {
      conds.push('e.status = ?');
      params.push(req.query.status);
    }
    if (req.query.department_id) {
      conds.push('e.department_id = ?');
      params.push(parseInt(req.query.department_id, 10));
    }
    if (req.query.search) {
      conds.push('(e.name LIKE ? OR e.phone LIKE ? OR e.position LIKE ?)');
      const q = `%${req.query.search}%`;
      params.push(q, q, q);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT e.*,
                d.name AS department_name,
                ps.name AS payroll_structure_name
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department_id
           LEFT JOIN payroll_structures ps ON ps.id = e.payroll_structure_id
           ${where}
           ORDER BY e.name ASC`
      )
      .all(...params);
    res.json(rows.map(rowToEmployee));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employees', details: err.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const row = db
      .prepare(
        `SELECT e.*,
                d.name AS department_name,
                ps.name AS payroll_structure_name
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department_id
           LEFT JOIN payroll_structures ps ON ps.id = e.payroll_structure_id
          WHERE e.id = ?`
      )
      .get(id);
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    const docs = db
      .prepare(`SELECT * FROM employee_documents WHERE employee_id = ? ORDER BY uploaded_at DESC`)
      .all(id);
    res.json({ ...rowToEmployee(row), documents: docs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employee', details: err.message });
  }
});

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: EmployeeCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const data = req.body;
      const employeeNo = generateNo(db);
      const result = db
        .prepare(
          `INSERT INTO employees (
             employee_no, name, photo_url, nik_ktp, npwp, birth_date,
             birth_place, gender, marital_status, religion, blood_type,
             nationality, phone, email, address, address_ktp,
             emergency_contact_name, emergency_contact_relation,
             emergency_contact_phone, department_id, position, employee_type,
             date_joined, date_resigned, role, payroll_structure_id,
             bank_name, bank_account_no, bank_account_name, base_salary,
             pin_code, attendance_methods, allowed_outlet_ids, status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          employeeNo,
          data.name,
          data.photo_url || null,
          data.nik_ktp || null,
          data.npwp || null,
          data.birth_date || null,
          data.birth_place || null,
          data.gender || null,
          data.marital_status || null,
          data.religion || null,
          data.blood_type || null,
          data.nationality || 'Indonesia',
          data.phone || null,
          data.email || null,
          data.address || null,
          data.address_ktp || null,
          data.emergency_contact_name || null,
          data.emergency_contact_relation || null,
          data.emergency_contact_phone || null,
          data.department_id || null,
          data.position || null,
          data.employee_type || 'permanent',
          data.date_joined || null,
          data.date_resigned || null,
          data.role || 'cashier',
          data.payroll_structure_id || null,
          data.bank_name || null,
          data.bank_account_no || null,
          data.bank_account_name || null,
          data.base_salary || 0,
          data.pin_code || null,
          data.attendance_methods ? JSON.stringify(data.attendance_methods) : null,
          data.allowed_outlet_ids ? JSON.stringify(data.allowed_outlet_ids) : null,
          data.status || 'active'
        );
      const created = db
        .prepare(`SELECT * FROM employees WHERE id = ?`)
        .get(result.lastInsertRowid);
      res.status(201).json(rowToEmployee(created));
    } catch (err) {
      res.status(500).json({ error: 'Failed to create employee', details: err.message });
    }
  }
);

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: EmployeeUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const exists = db.prepare(`SELECT id FROM employees WHERE id = ?`).get(id);
      if (!exists) return res.status(404).json({ error: 'Employee not found' });
      const data = req.body;
      const allowed = [
        'name',
        'photo_url',
        'nik_ktp',
        'npwp',
        'birth_date',
        'birth_place',
        'gender',
        'marital_status',
        'religion',
        'blood_type',
        'nationality',
        'phone',
        'email',
        'address',
        'address_ktp',
        'emergency_contact_name',
        'emergency_contact_relation',
        'emergency_contact_phone',
        'department_id',
        'position',
        'employee_type',
        'date_joined',
        'date_resigned',
        'role',
        'payroll_structure_id',
        'bank_name',
        'bank_account_no',
        'bank_account_name',
        'base_salary',
        'pin_code',
        'status',
      ];
      const fields = [];
      const values = [];
      for (const key of allowed) {
        if (key in data) {
          fields.push(`${key} = ?`);
          values.push(data[key] ?? null);
        }
      }
      for (const key of JSON_FIELDS) {
        if (key in data) {
          fields.push(`${key} = ?`);
          values.push(data[key] != null ? JSON.stringify(data[key]) : null);
        }
      }
      if (fields.length === 0) {
        const row = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id);
        return res.json(rowToEmployee(row));
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      db.prepare(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      const row = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(id);
      res.json(rowToEmployee(row));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update employee', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const exists = db.prepare(`SELECT id FROM employees WHERE id = ?`).get(id);
    if (!exists) return res.status(404).json({ error: 'Employee not found' });
    // Soft delete (status = resigned), kalau mau hard delete pakai ?hard=1.
    if (req.query.hard === '1') {
      db.prepare(`DELETE FROM employees WHERE id = ?`).run(id);
    } else {
      db.prepare(
        `UPDATE employees SET status = 'resigned', date_resigned = COALESCE(date_resigned, date('now')), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete employee', details: err.message });
  }
});

// Documents
router.post(
  '/:id/document',
  authenticateToken,
  requireAdmin,
  validate({ body: EmployeeDocumentCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const employee = db.prepare(`SELECT id FROM employees WHERE id = ?`).get(id);
      if (!employee) return res.status(404).json({ error: 'Employee not found' });
      const result = db
        .prepare(
          `INSERT INTO employee_documents (employee_id, doc_type, file_url, file_name)
           VALUES (?, ?, ?, ?)`
        )
        .run(id, req.body.doc_type, req.body.file_url, req.body.file_name || null);
      const doc = db
        .prepare(`SELECT * FROM employee_documents WHERE id = ?`)
        .get(result.lastInsertRowid);
      res.status(201).json(doc);
    } catch (err) {
      res.status(500).json({ error: 'Failed to add document', details: err.message });
    }
  }
);

router.delete('/:id/document/:documentId', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const docId = parseInt(req.params.documentId, 10);
    const result = db
      .prepare(`DELETE FROM employee_documents WHERE id = ? AND employee_id = ?`)
      .run(docId, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document', details: err.message });
  }
});

// Permissions
router.get('/:id/permissions', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const rows = db
      .prepare(
        `SELECT * FROM permission_overrides WHERE employee_id = ? ORDER BY permission_key ASC`
      )
      .all(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load permissions', details: err.message });
  }
});

router.put(
  '/:id/permissions',
  authenticateToken,
  requireAdmin,
  validate({ body: PermissionAssignSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const exists = db.prepare(`SELECT id FROM employees WHERE id = ?`).get(id);
      if (!exists) return res.status(404).json({ error: 'Employee not found' });
      const upsert = db.prepare(
        `INSERT INTO permission_overrides (employee_id, permission_key, granted)
         VALUES (?, ?, ?)
         ON CONFLICT(employee_id, permission_key)
         DO UPDATE SET granted = excluded.granted`
      );
      const tx = db.transaction(() => {
        for (const p of req.body.permissions) {
          upsert.run(id, p.permission_key, p.granted ? 1 : 0);
        }
      });
      tx();
      const rows = db
        .prepare(
          `SELECT * FROM permission_overrides WHERE employee_id = ? ORDER BY permission_key ASC`
        )
        .all(id);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update permissions', details: err.message });
    }
  }
);

module.exports = router;
