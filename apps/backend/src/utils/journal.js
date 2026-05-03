// Helper untuk posting journal entries (P1-15 Keuangan).
//
// Setiap business event (transfer, income, expense, depresiasi, disposal,
// dll) memanggil `postJournal()` di dalam db.transaction sehingga atomicity
// terjaga.
//
// Return: ID journal yang dibuat.

/**
 * Generate journal_no auto, format JRNL/YYYYMM/00001 (per bulan).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} journalDate ISO YYYY-MM-DD
 * @returns {string}
 */
function generateJournalNo(db, journalDate) {
  const ym = journalDate.replace(/-/g, '').slice(0, 6); // YYYYMM
  const prefix = `JRNL/${ym}/`;
  const last = db
    .prepare(`SELECT journal_no FROM gl_journals WHERE journal_no LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(`${prefix}%`);
  const seq = last ? Number(last.journal_no.split('/')[2]) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

/**
 * Post a balanced journal entry.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} args
 * @param {string} args.journal_date ISO date.
 * @param {string} [args.description]
 * @param {string} [args.source_type] manual | sale | income | expense | transfer | payroll | depreciation | disposal | opening
 * @param {number} [args.source_id]
 * @param {number} [args.created_by] user id
 * @param {Array<{account_id:number, debit?:number, credit?:number, description?:string}>} args.lines
 * @returns {number} journal id
 */
function postJournal(db, args) {
  const lines = args.lines || [];
  if (lines.length < 2) {
    throw new Error('Journal must have at least 2 lines');
  }
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Unbalanced journal: total debit ${totalDebit} != total credit ${totalCredit}`);
  }

  const journalNo = generateJournalNo(db, args.journal_date);
  const insertHeader = db.prepare(
    `INSERT INTO gl_journals
       (journal_no, journal_date, description, source_type, source_id, total_amount, created_by)
     VALUES (@journal_no, @journal_date, @description, @source_type, @source_id, @total_amount, @created_by)`
  );
  const result = insertHeader.run({
    journal_no: journalNo,
    journal_date: args.journal_date,
    description: args.description || null,
    source_type: args.source_type || 'manual',
    source_id: args.source_id || null,
    total_amount: totalDebit,
    created_by: args.created_by || null,
  });
  const journalId = result.lastInsertRowid;

  const insertLine = db.prepare(
    `INSERT INTO gl_journal_lines
       (journal_id, account_id, debit, credit, description, sort_order)
     VALUES (@journal_id, @account_id, @debit, @credit, @description, @sort_order)`
  );
  lines.forEach((l, idx) => {
    insertLine.run({
      journal_id: journalId,
      account_id: l.account_id,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      description: l.description || null,
      sort_order: idx,
    });
  });

  return Number(journalId);
}

/**
 * Compute current balance for an account based on journal lines + opening balance.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} accountId
 * @param {string} [asOfDate] ISO YYYY-MM-DD inclusive (default: open-ended).
 * @returns {number} balance — signed in account's normal_balance direction.
 */
function getAccountBalance(db, accountId, asOfDate) {
  const acc = db
    .prepare(`SELECT type, normal_balance, opening_balance FROM gl_accounts WHERE id = ?`)
    .get(accountId);
  if (!acc) return 0;

  let sql = `SELECT COALESCE(SUM(jl.debit), 0) AS d, COALESCE(SUM(jl.credit), 0) AS c
             FROM gl_journal_lines jl
             JOIN gl_journals j ON j.id = jl.journal_id
             WHERE jl.account_id = ?`;
  const params = [accountId];
  if (asOfDate) {
    sql += ' AND j.journal_date <= ?';
    params.push(asOfDate);
  }
  const row = db.prepare(sql).get(...params);
  const opening = Number(acc.opening_balance) || 0;
  const debit = Number(row.d) || 0;
  const credit = Number(row.c) || 0;
  if (acc.normal_balance === 'debit') {
    return opening + debit - credit;
  }
  return opening + credit - debit;
}

module.exports = { generateJournalNo, postJournal, getAccountBalance };
