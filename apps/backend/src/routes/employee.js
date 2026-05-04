// Employee CRUD + dokumen + permission overrides (P1-14).
const express = require('express');
const { query, tx, iLikePattern } = require('../db');
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

async function generateNo(q) {
  const last = (
    await q(
      `SELECT employee_no FROM employees WHERE employee_no LIKE 'EMP%' ORDER BY id DESC LIMIT 1`
    )
  ).rows[0];
  if (!last) return 'EMP0001';
  const num = parseInt((last.employee_no || '').replace(/\D/g, ''), 10) || 0;
  return 'EMP' + String(num + 1).padStart(4, '0');
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const conds = [];
    const params = [];
    let p = 1;
    if (req.query.status) {
      conds.push(`e.status = $${p++}`);
      params.push(req.query.status);
    }
    if (req.query.department_id) {
      conds.push(`e.department_id = $${p++}`);
      params.push(parseInt(req.query.department_id, 10));
    }
    if (req.query.search) {
      const pattern = `%${iLikePattern(req.query.search)}%`;
      conds.push(`(e.name LIKE $${p} OR e.phone LIKE $${p + 1} OR e.position LIKE $${p + 2})`);
      params.push(pattern, pattern, pattern);
      p += 3;
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT e.*,
                d.name AS department_name,
                ps.name AS payroll_structure_name
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department_id
           LEFT JOIN payroll_structures ps ON ps.id = e.payroll_structure_id
           ${where}
           ORDER BY e.name ASC`,
        params
      )
    ).rows;
    res.json(rows.map(rowToEmployee));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employees', details: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = (
      await query(
        `SELECT e.*,
                d.name AS department_name,
                ps.name AS payroll_structure_name
           FROM employees e
           LEFT JOIN departments d ON d.id = e.department_id
           LEFT JOIN payroll_structures ps ON ps.id = e.payroll_structure_id
          WHERE e.id = $1`,
        [id]
      )
    ).rows[0];
    if (!row) return res.status(404).json({ error: 'Employee not found' });
    const docs = (
      await query(
        `SELECT * FROM employee_documents WHERE employee_id = $1 ORDER BY uploaded_at DESC`,
        [id]
      )
    ).rows;
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
  async (req, res) => {
    try {
      const data = req.body;
      const employeeNo = await generateNo(query);
      const ins = await query(
        `INSERT INTO employees (
            employee_no, name, photo_url, nik_ktp, npwp, birth_date,
            birth_place, gender, marital_status, religion, blood_type,
            nationality, phone, email, address, address_ktp,
            emergency_contact_name, emergency_contact_relation,
            emergency_contact_phone, department_id, position, employee_type,
            date_joined, date_resigned, role, payroll_structure_id,
            bank_name, bank_account_no, bank_account_name, base_salary,
            pin_code, attendance_methods, allowed_outlet_ids, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34
          ) RETURNING id`,
        [
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
          data.status || 'active',
        ]
      );
      const created = (await query(`SELECT * FROM employees WHERE id = $1`, [ins.rows[0].id]))
        .rows[0];
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const exists = (await query(`SELECT id FROM employees WHERE id = $1`, [id])).rows[0];
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
      let p = 1;
      for (const key of allowed) {
        if (key in data) {
          fields.push(`${key} = $${p++}`);
          values.push(data[key] ?? null);
        }
      }
      for (const key of JSON_FIELDS) {
        if (key in data) {
          fields.push(`${key} = $${p++}`);
          values.push(data[key] != null ? JSON.stringify(data[key]) : null);
        }
      }
      if (fields.length === 0) {
        const row = (await query(`SELECT * FROM employees WHERE id = $1`, [id])).rows[0];
        return res.json(rowToEmployee(row));
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await query(`UPDATE employees SET ${fields.join(', ')} WHERE id = $${p}`, values);
      const row = (await query(`SELECT * FROM employees WHERE id = $1`, [id])).rows[0];
      res.json(rowToEmployee(row));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update employee', details: err.message });
    }
  }
);

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const exists = (await query(`SELECT id FROM employees WHERE id = $1`, [id])).rows[0];
    if (!exists) return res.status(404).json({ error: 'Employee not found' });
    if (req.query.hard === '1') {
      await query(`DELETE FROM employees WHERE id = $1`, [id]);
    } else {
      await query(
        `UPDATE employees SET status = 'resigned', date_resigned = COALESCE(date_resigned, date('now')), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const employee = (await query(`SELECT id FROM employees WHERE id = $1`, [id])).rows[0];
      if (!employee) return res.status(404).json({ error: 'Employee not found' });
      const ins = await query(
        `INSERT INTO employee_documents (employee_id, doc_type, file_url, file_name)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [id, req.body.doc_type, req.body.file_url, req.body.file_name || null]
      );
      const doc = (await query(`SELECT * FROM employee_documents WHERE id = $1`, [ins.rows[0].id]))
        .rows[0];
      res.status(201).json(doc);
    } catch (err) {
      res.status(500).json({ error: 'Failed to add document', details: err.message });
    }
  }
);

router.delete('/:id/document/:documentId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const docId = parseInt(req.params.documentId, 10);
    const result = await query(
      `DELETE FROM employee_documents WHERE id = $1 AND employee_id = $2`,
      [docId, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Document not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document', details: err.message });
  }
});

// Permissions
router.get('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rows = (
      await query(
        `SELECT * FROM permission_overrides WHERE employee_id = $1 ORDER BY permission_key ASC`,
        [id]
      )
    ).rows;
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const exists = (await query(`SELECT id FROM employees WHERE id = $1`, [id])).rows[0];
      if (!exists) return res.status(404).json({ error: 'Employee not found' });
      await tx(async (txQuery) => {
        for (const p of req.body.permissions) {
          await txQuery(
            `INSERT INTO permission_overrides (employee_id, permission_key, granted)
             VALUES ($1, $2, $3)
             ON CONFLICT(employee_id, permission_key)
             DO UPDATE SET granted = excluded.granted`,
            [id, p.permission_key, p.granted ? 1 : 0]
          );
        }
      });
      const rows = (
        await query(
          `SELECT * FROM permission_overrides WHERE employee_id = $1 ORDER BY permission_key ASC`,
          [id]
        )
      ).rows;
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update permissions', details: err.message });
    }
  }
);

module.exports = router;
