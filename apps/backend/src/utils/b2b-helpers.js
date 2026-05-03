// Shared helpers untuk B2B 5-stage flow.
//
// - Number generator per dokumen (QT, SO, DO, INV, RCP)
// - Total/subtotal/tax recompute dari items array
// - Item normalization

const PREFIX_BY_TABLE = {
  b2b_quotations: 'QT',
  b2b_sales_orders: 'SO',
  b2b_delivery_orders: 'DO',
  b2b_invoices: 'INV',
  b2b_receipts: 'RCP',
};

function pad(n, len) {
  return String(n).padStart(len, '0');
}

function generateNumber(db, table, dateRef) {
  const prefix = PREFIX_BY_TABLE[table];
  if (!prefix) throw new Error(`No prefix configured for ${table}`);
  const date = dateRef ? new Date(dateRef) : new Date();
  const ym = `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}`;
  const like = `${prefix}-${ym}-%`;
  const last = db
    .prepare(`SELECT number FROM ${table} WHERE number LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(like);
  let next = 1;
  if (last) {
    const m = String(last.number).match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return `${prefix}-${ym}-${pad(next, 4)}`;
}

function lineSubtotal(qty, unit_price, discount_percent) {
  const q = Number(qty) || 0;
  const u = Number(unit_price) || 0;
  const d = Number(discount_percent) || 0;
  const gross = q * u;
  return Math.round((gross - (gross * d) / 100) * 100) / 100;
}

function recomputeTotals({ items, tax_percent = 0, discount_amount = 0 }) {
  const safeItems = (items || []).map((it) => ({
    ...it,
    subtotal: lineSubtotal(it.qty, it.unit_price, it.discount_percent),
  }));
  const subtotal = safeItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  const afterDiscount = Math.max(subtotal - (Number(discount_amount) || 0), 0);
  const tax_amount = Math.round(((afterDiscount * (Number(tax_percent) || 0)) / 100) * 100) / 100;
  const total = Math.round((afterDiscount + tax_amount) * 100) / 100;
  return { items: safeItems, subtotal, tax_amount, total };
}

function loadItems(db, table, fkColumn, fkValue) {
  return db.prepare(`SELECT * FROM ${table} WHERE ${fkColumn} = ? ORDER BY id ASC`).all(fkValue);
}

function deleteItems(db, table, fkColumn, fkValue) {
  db.prepare(`DELETE FROM ${table} WHERE ${fkColumn} = ?`).run(fkValue);
}

module.exports = {
  generateNumber,
  lineSubtotal,
  recomputeTotals,
  loadItems,
  deleteItems,
};
