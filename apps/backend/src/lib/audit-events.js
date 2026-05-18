// VIPOS — Audit event constants for structured logging.
//
// Centralizes all audit action names so they're consistent
// across routes and queryable in the audit_logs table.

const AUDIT_EVENTS = {
  // Transactions
  TRANSACTION_CREATE: 'transaction.create',
  TRANSACTION_VOID: 'transaction.void',
  TRANSACTION_REFUND: 'transaction.refund',

  // Cashier shifts
  SHIFT_OPEN: 'shift.open',
  SHIFT_CLOSE: 'shift.close',
  SHIFT_CASH_DROP: 'shift.cash_drop',
  SHIFT_CASH_PICKUP: 'shift.cash_pickup',

  // QRIS
  QRIS_MINT: 'qris.mint',
  QRIS_PAID: 'qris.paid',
  QRIS_EXPIRED: 'qris.expired',

  // Customers
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',

  // Loyalty
  LOYALTY_EARN: 'loyalty.earn',
  LOYALTY_REDEEM: 'loyalty.redeem',
  LOYALTY_ADJUST: 'loyalty.adjust',

  // Online orders
  ORDER_ACCEPT: 'order.accept',
  ORDER_REJECT: 'order.reject',
  ORDER_READY: 'order.ready',

  // Inventory
  INVENTORY_MUTATION: 'inventory.mutation',
  STOCK_OPNAME_SUBMIT: 'stock_opname.submit',

  // Auth
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_REFRESH: 'auth.refresh',
  AUTH_PASSWORD_CHANGE: 'auth.password_change',

  // Settings
  SETTING_UPDATE: 'setting.update',
};

module.exports = { AUDIT_EVENTS };
