// Payroll endpoints (P1-14): settings, structures, runs (calculate +
// approve + paid + bank file CSV).
//
// Payroll calculation (MVP):
//   gross = basic_salary + allowances + overtime
//   bpjs_kesehatan = gross * settings.bpjs_kesehatan_employee% (jika include_bpjs)
//   bpjs_jht       = gross * settings.bpjs_jht_employee% (jika include_bpjs)
//   bpjs_jp        = gross * settings.bpjs_jp_employee%  (jika include_bpjs)
//   pph21          = (settings.tax_method === 'progressive') ? PROGRESSIVE
//                  : (gross * 5%) (flat MVP) — ditandai sbg approximasi
//   total_deductions = sum(structure.deductions) + bpjs + pph21
//   net = gross - total_deductions
const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  PayrollSettingsUpdateSchema,
  PayrollStructureCreateSchema,
  PayrollStructureUpdateSchema,
  PayrollRunCreateSchema,
} = require('@vipos/shared');

const settingsRouter = express.Router();
const structureRouter = express.Router();
const runRouter = express.Router();

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToStructure(row) {
  if (!row) return null;
  return {
    ...row,
    allowances: parseJson(row.allowances, []),
    deductions: parseJson(row.deductions, []),
  };
}

async function rowToRun(q, row, withPayslips = false) {
  if (!row) return null;
  if (!withPayslips) return row;
  const payslips = (
    await q(`SELECT * FROM payslips WHERE payroll_run_id = $1 ORDER BY employee_name ASC`, [row.id])
  ).rows.map((p) => ({
    ...p,
    breakdown: parseJson(p.breakdown, null),
  }));
  return { ...row, payslips };
}

async function generateRefNo(q) {
  const last = (
    await q(`SELECT ref_no FROM payroll_runs WHERE ref_no LIKE 'PR%' ORDER BY id DESC LIMIT 1`)
  ).rows[0];
  if (!last) return 'PR0001';
  const num = parseInt((last.ref_no || '').replace(/\D/g, ''), 10) || 0;
  return 'PR' + String(num + 1).padStart(4, '0');
}

async function getOrCreateSettings(q) {
  let row = (await q(`SELECT * FROM payroll_settings WHERE id = 1`)).rows[0];
  if (!row) {
    await q(`INSERT INTO payroll_settings (id) VALUES (1)`);
    row = (await q(`SELECT * FROM payroll_settings WHERE id = 1`)).rows[0];
  }
  return row;
}

// ============== SETTINGS ==============
settingsRouter.get('/', authenticateToken, async (req, res) => {
  try {
    res.json(await getOrCreateSettings(query));
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

settingsRouter.put(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: PayrollSettingsUpdateSchema }),
  async (req, res) => {
    try {
      await getOrCreateSettings(query);
      const allowed = [
        'period',
        'cutoff_day',
        'payment_day',
        'working_hours_per_month',
        'overtime_multiplier',
        'tax_method',
        'bpjs_kesehatan_employee',
        'bpjs_jht_employee',
        'bpjs_jp_employee',
      ];
      const fields = [];
      const values = [];
      let p = 1;
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = $${p++}`);
          values.push(req.body[key]);
        }
      }
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        await query(`UPDATE payroll_settings SET ${fields.join(', ')} WHERE id = 1`, values);
      }
      res.json(await getOrCreateSettings(query));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

// ============== STRUCTURE ==============
structureRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (await query(`SELECT * FROM payroll_structures ORDER BY name ASC`)).rows;
    res.json(rows.map(rowToStructure));
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

structureRouter.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: PayrollStructureCreateSchema }),
  async (req, res) => {
    try {
      const data = req.body;
      const ins = await query(
        `INSERT INTO payroll_structures (
            name, description, basic_salary, allowances, deductions,
            overtime_rate, include_bpjs, include_pph21, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          data.name,
          data.description || null,
          data.basic_salary || 0,
          JSON.stringify(data.allowances || []),
          JSON.stringify(data.deductions || []),
          data.overtime_rate || 0,
          data.include_bpjs ?? 1,
          data.include_pph21 ?? 1,
          data.is_active ?? 1,
        ]
      );
      const row = (await query(`SELECT * FROM payroll_structures WHERE id = $1`, [ins.rows[0].id]))
        .rows[0];
      res.status(201).json(rowToStructure(row));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

structureRouter.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: PayrollStructureUpdateSchema }),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const exists = (await query(`SELECT id FROM payroll_structures WHERE id = $1`, [id])).rows[0];
      if (!exists) return res.status(404).json({ error: 'Not found' });
      const allowed = [
        'name',
        'description',
        'basic_salary',
        'overtime_rate',
        'include_bpjs',
        'include_pph21',
        'is_active',
      ];
      const fields = [];
      const values = [];
      let p = 1;
      for (const key of allowed) {
        if (key in req.body) {
          fields.push(`${key} = $${p++}`);
          values.push(req.body[key] ?? null);
        }
      }
      if ('allowances' in req.body) {
        fields.push(`allowances = $${p++}`);
        values.push(JSON.stringify(req.body.allowances || []));
      }
      if ('deductions' in req.body) {
        fields.push(`deductions = $${p++}`);
        values.push(JSON.stringify(req.body.deductions || []));
      }
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await query(`UPDATE payroll_structures SET ${fields.join(', ')} WHERE id = $${p}`, values);
      }
      const row = (await query(`SELECT * FROM payroll_structures WHERE id = $1`, [id])).rows[0];
      res.json(rowToStructure(row));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

structureRouter.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query(`DELETE FROM payroll_structures WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

// ============== RUN ==============
runRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const rows = (await query(`SELECT * FROM payroll_runs ORDER BY period_start DESC, id DESC`))
      .rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

runRouter.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [id])).rows[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(await rowToRun(query, row, true));
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

runRouter.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: PayrollRunCreateSchema }),
  async (req, res) => {
    try {
      const refNo = await generateRefNo(query);
      const ins = await query(
        `INSERT INTO payroll_runs (ref_no, period_start, period_end, payment_date, status, notes)
         VALUES ($1, $2, $3, $4, 'DRAFT', $5) RETURNING id`,
        [
          refNo,
          req.body.period_start,
          req.body.period_end,
          req.body.payment_date || null,
          req.body.notes || null,
        ]
      );
      const row = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [ins.rows[0].id]))
        .rows[0];
      res.status(201).json(await rowToRun(query, row, true));
    } catch (err) {
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  }
);

function calculatePayslip(employee, structure, settings) {
  const basic = structure ? structure.basic_salary : employee.base_salary || 0;
  const allowanceList = structure ? structure.allowances : [];
  const deductionList = structure ? structure.deductions : [];
  const totalAllowances = allowanceList.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const totalStructureDeductions = deductionList.reduce(
    (sum, d) => sum + (Number(d.amount) || 0),
    0
  );
  const overtimeHours = 0;
  const overtimeAmount =
    overtimeHours * (structure?.overtime_rate || 0) * (settings.overtime_multiplier || 1);

  const gross = basic + totalAllowances + overtimeAmount;
  let bpjsKesehatan = 0;
  let bpjsJht = 0;
  let bpjsJp = 0;
  if (!structure || structure.include_bpjs) {
    bpjsKesehatan = gross * (settings.bpjs_kesehatan_employee / 100);
    bpjsJht = gross * (settings.bpjs_jht_employee / 100);
    bpjsJp = gross * (settings.bpjs_jp_employee / 100);
  }
  let pph21 = 0;
  if (!structure || structure.include_pph21) {
    if (settings.tax_method === 'progressive') {
      const annual = gross * 12;
      if (annual <= 60_000_000) pph21 = (gross * 5) / 100;
      else if (annual <= 250_000_000) pph21 = (gross * 15) / 100;
      else if (annual <= 500_000_000) pph21 = (gross * 25) / 100;
      else if (annual <= 5_000_000_000) pph21 = (gross * 30) / 100;
      else pph21 = (gross * 35) / 100;
    } else if (settings.tax_method === 'gross-up') {
      pph21 = (gross * 5) / 100;
    } else {
      pph21 = (gross * 5) / 100;
    }
  }
  const totalDeductions = totalStructureDeductions + bpjsKesehatan + bpjsJht + bpjsJp + pph21;
  const net = gross - totalDeductions;
  return {
    basic_salary: basic,
    total_allowances: totalAllowances,
    total_deductions: totalDeductions,
    overtime_hours: overtimeHours,
    overtime_amount: overtimeAmount,
    bpjs_kesehatan: bpjsKesehatan,
    bpjs_jht: bpjsJht,
    bpjs_jp: bpjsJp,
    pph21,
    gross_salary: gross,
    net_salary: net,
    breakdown: {
      allowances: allowanceList,
      structure_deductions: deductionList,
    },
  };
}

runRouter.post('/:id/calculate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const run = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [id])).rows[0];
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'DRAFT' && run.status !== 'CALCULATED') {
      return res.status(400).json({ error: 'Hanya run DRAFT/CALCULATED yang bisa di-recalculate' });
    }
    const settings = await getOrCreateSettings(query);
    const employees = (
      await query(`SELECT * FROM employees WHERE status = 'active' ORDER BY name ASC`)
    ).rows;
    const structureMap = new Map();
    const structures = (await query(`SELECT * FROM payroll_structures`)).rows;
    for (const s of structures) {
      structureMap.set(s.id, rowToStructure(s));
    }

    await tx(async (txQuery) => {
      await txQuery(`DELETE FROM payslips WHERE payroll_run_id = $1`, [id]);
      let totalGross = 0;
      let totalDed = 0;
      let totalNet = 0;
      for (const emp of employees) {
        const structure = emp.payroll_structure_id
          ? structureMap.get(emp.payroll_structure_id)
          : null;
        const calc = calculatePayslip(emp, structure, settings);
        await txQuery(
          `INSERT INTO payslips (
              payroll_run_id, employee_id, employee_no, employee_name,
              structure_id, basic_salary, total_allowances, total_deductions,
              overtime_hours, overtime_amount,
              bpjs_kesehatan, bpjs_jht, bpjs_jp, pph21,
              gross_salary, net_salary, breakdown,
              bank_name, bank_account_no
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19
            )`,
          [
            id,
            emp.id,
            emp.employee_no,
            emp.name,
            structure?.id || null,
            calc.basic_salary,
            calc.total_allowances,
            calc.total_deductions,
            calc.overtime_hours,
            calc.overtime_amount,
            calc.bpjs_kesehatan,
            calc.bpjs_jht,
            calc.bpjs_jp,
            calc.pph21,
            calc.gross_salary,
            calc.net_salary,
            JSON.stringify(calc.breakdown),
            emp.bank_name || null,
            emp.bank_account_no || null,
          ]
        );
        totalGross += calc.gross_salary;
        totalDed += calc.total_deductions;
        totalNet += calc.net_salary;
      }
      await txQuery(
        `UPDATE payroll_runs SET status = 'CALCULATED', total_gross = $1, total_deductions = $2, total_net = $3, employee_count = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
        [totalGross, totalDed, totalNet, employees.length, id]
      );
    });
    const row = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [id])).rows[0];
    res.json(await rowToRun(query, row, true));
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

runRouter.post('/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const run = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [id])).rows[0];
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'CALCULATED') {
      return res.status(400).json({ error: 'Hanya CALCULATED yang bisa di-approve' });
    }
    await query(
      `UPDATE payroll_runs SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    const row = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [id])).rows[0];
    res.json(await rowToRun(query, row, true));
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

runRouter.post('/:id/paid', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const run = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [id])).rows[0];
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Hanya APPROVED yang bisa ditandai paid' });
    }
    await query(
      `UPDATE payroll_runs SET status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    const row = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [id])).rows[0];
    res.json(await rowToRun(query, row, true));
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

runRouter.get('/:id/bank-file', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const run = (await query(`SELECT * FROM payroll_runs WHERE id = $1`, [id])).rows[0];
    if (!run) return res.status(404).json({ error: 'Not found' });
    const payslips = (
      await query(
        `SELECT employee_no, employee_name, bank_name, bank_account_no, net_salary FROM payslips WHERE payroll_run_id = $1 ORDER BY employee_name ASC`,
        [id]
      )
    ).rows;
    const lines = ['employee_no,employee_name,bank_name,bank_account_no,net_salary'];
    for (const p of payslips) {
      lines.push(
        [
          p.employee_no,
          (p.employee_name || '').replace(/,/g, ' '),
          p.bank_name || '',
          p.bank_account_no || '',
          (p.net_salary || 0).toFixed(0),
        ].join(',')
      );
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${run.ref_no}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed', details: err.message });
  }
});

module.exports = { settingsRouter, structureRouter, runRouter };
