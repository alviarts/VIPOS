// Helper untuk posting journal entries (P1-15 Keuangan).
//
// Setiap business event (transfer, income, expense, depresiasi, disposal,
// dll) memanggil `postJournal()` di dalam tx() supaya atomicity terjaga.
//
// Return: ID journal yang dibuat.

/**
 * Generate journal_no auto, format JRNL/YYYYMM/00001 (per bulan).
 *
 * @param {Function} q async query function
 * @param {string} journalDate ISO YYYY-MM-DD
 * @returns {Promise<string>}
 */
async function generateJournalNo(q, journalDate) {
  const ym = journalDate.replace(/-/g, '').slice(0, 6); // YYYYMM
  const prefix = `JRNL/${ym}/`;
  const last = (
    await q(
      `SELECT journal_no FROM gl_journals WHERE journal_no LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    )
  ).rows[0];
  const seq = last ? Number(last.journal_no.split('/')[2]) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

/**
 * Post a balanced journal entry.
 *
 * @param {Function} q async query function (txQuery from tx())
 * @param {object} args
 * @param {string} args.journal_date ISO date.
 * @param {string} [args.description]
 * @param {string} [args.source_type] manual | sale | income | expense | transfer | payroll | depreciation | disposal | opening
 * @param {number} [args.source_id]
 * @param {number} [args.created_by] user id
 * @param {Array<{account_id:number, debit?:number, credit?:number, description?:string}>} args.lines
 * @returns {Promise<number>} journal id
 */
async function postJournal(q, args) {
  const lines = args.lines || [];
  if (lines.length < 2) {
    throw new Error('Journal must have at least 2 lines');
  }
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced journal: total debit ${totalDebit} != total credit ${totalCredit}`);
  }

  const journalNo = await generateJournalNo(q, args.journal_date);
  const ins = await q(
    `INSERT INTO gl_journals
       (journal_no, journal_date, description, source_type, source_id, total_amount, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      journalNo,
      args.journal_date,
      args.description || null,
      args.source_type || 'manual',
      args.source_id || null,
      totalDebit,
      args.created_by || null,
    ]
  );
  const journalId = ins.rows[0].id;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const l = lines[idx];
    await q(
      `INSERT INTO gl_journal_lines
         (journal_id, account_id, debit, credit, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        journalId,
        l.account_id,
        Number(l.debit) || 0,
        Number(l.credit) || 0,
        l.description || null,
        idx,
      ]
    );
  }

  return Number(journalId);
}

/**
 * Compute current balance for an account based on journal lines + opening balance.
 *
 * @param {Function} q async query function
 * @param {number} accountId
 * @param {string} [asOfDate] ISO YYYY-MM-DD inclusive (default: open-ended).
 * @returns {Promise<number>} balance — signed in account's normal_balance direction.
 */
async function getAccountBalance(q, accountId, asOfDate) {
  const acc = (
    await q(`SELECT type, normal_balance, opening_balance FROM gl_accounts WHERE id = $1`, [
      accountId,
    ])
  ).rows[0];
  if (!acc) return 0;

  let sql = `SELECT COALESCE(SUM(jl.debit), 0) AS d, COALESCE(SUM(jl.credit), 0) AS c
             FROM gl_journal_lines jl
             JOIN gl_journals j ON j.id = jl.journal_id
             WHERE jl.account_id = $1`;
  const params = [accountId];
  if (asOfDate) {
    sql += ' AND j.journal_date <= $2';
    params.push(asOfDate);
  }
  const row = (await q(sql, params)).rows[0];
  const opening = Number(acc.opening_balance) || 0;
  const debit = Number(row.d) || 0;
  const credit = Number(row.c) || 0;
  if (acc.normal_balance === 'debit') {
    return opening + debit - credit;
  }
  return opening + credit - debit;
}

module.exports = { generateJournalNo, postJournal, getAccountBalance };
