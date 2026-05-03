const Database = require('better-sqlite3');
const path = require('path');

// Allow override via env (handy for tests / CI). Default mirrors monorepo
// layout: apps/backend/data/vipos.db.
const DEFAULT_DB_PATH = path.join(__dirname, '../../data/vipos.db');
function resolveDbPath() {
  return process.env.VIPOS_DB_PATH || DEFAULT_DB_PATH;
}

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const targetPath = resolveDbPath();
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(targetPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// For tests: forcibly close + reset the singleton so subsequent calls open
// against the (possibly new) DB path. Production code should never call this.
function _resetDbForTests() {
  if (db) {
    try {
      db.close();
    } catch (_) {
      /* ignore */
    }
    db = null;
  }
}

// Idempotent column addition: skip if column already exists.
function addColumnIfMissing(db, table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'cashier' CHECK(role IN ('admin', 'cashier')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      urutan INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      urutan INTEGER DEFAULT 0,
      department_id INTEGER,
      color TEXT,
      icon_url TEXT,
      is_tampil_di_menu INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      barcode TEXT,
      price REAL NOT NULL,
      harga_modal REAL DEFAULT 0,
      harga_beli REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      satuan TEXT DEFAULT 'pcs',
      description TEXT,
      category_id INTEGER,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      is_tampil_di_menu INTEGER DEFAULT 1,
      is_favorit INTEGER DEFAULT 0,
      monitor_stok INTEGER DEFAULT 0,
      stok_minimum INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS customer_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      discount_percent REAL DEFAULT 0,
      points_multiplier REAL DEFAULT 1,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customer_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      gender TEXT CHECK(gender IN ('L', 'P') OR gender IS NULL),
      birth_date DATE,
      points INTEGER DEFAULT 0,
      deposit REAL DEFAULT 0,
      notes TEXT,
      customer_group_id INTEGER,
      npwp TEXT,
      id_card_no TEXT,
      province TEXT,
      city TEXT,
      district TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_group_id) REFERENCES customer_groups(id)
    );

    CREATE TABLE IF NOT EXISTS customer_tag_map (
      customer_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (customer_id, tag_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES customer_tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      customer_id INTEGER,
      total_amount REAL NOT NULL,
      payment_amount REAL NOT NULL,
      change_amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash' CHECK(payment_method IN ('cash', 'card', 'qris')),
      status TEXT DEFAULT 'completed' CHECK(status IN ('completed', 'voided')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS cash_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      tipe TEXT DEFAULT 'detail' CHECK(tipe IN ('header', 'detail')),
      nama TEXT NOT NULL,
      kategori TEXT DEFAULT 'Kas & Bank',
      saldo_awal REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
      tipe TEXT NOT NULL CHECK(tipe IN ('pemasukan', 'pengeluaran', 'transfer')),
      account_id INTEGER NOT NULL,
      account_to_id INTEGER,
      kategori TEXT,
      jumlah REAL NOT NULL,
      keterangan TEXT,
      reference TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES cash_accounts(id),
      FOREIGN KEY (account_to_id) REFERENCES cash_accounts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
      product_id INTEGER NOT NULL,
      tipe TEXT NOT NULL CHECK(tipe IN ('stok_in', 'stok_out', 'opname')),
      qty INTEGER NOT NULL,
      stok_sebelum INTEGER NOT NULL,
      stok_sesudah INTEGER NOT NULL,
      unit_cost REAL,
      reason TEXT,
      ref_type TEXT,
      ref_id INTEGER,
      keterangan TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      replaced_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (replaced_by) REFERENCES refresh_tokens(id)
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      option_label TEXT NOT NULL,
      price_modifier REAL DEFAULT 0,
      sku_suffix TEXT,
      stock INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_recipe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL,
      qty REAL NOT NULL,
      unit TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS stock_opname (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'final', 'cancelled')),
      catatan TEXT,
      created_by INTEGER,
      finalized_by INTEGER,
      finalized_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (finalized_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS stock_opname_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opname_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty_sistem INTEGER NOT NULL DEFAULT 0,
      qty_fisik INTEGER,
      catatan TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (opname_id, product_id),
      FOREIGN KEY (opname_id) REFERENCES stock_opname(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- P1-10: B2B Invoice 5-stage flow (Quotation → SO → DO → Invoice → Receipt)
    CREATE TABLE IF NOT EXISTS b2b_quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT NOT NULL,
      quote_date TEXT NOT NULL,
      valid_until TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED
      subtotal REAL NOT NULL DEFAULT 0,
      tax_percent REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      terms TEXT,
      converted_so_id INTEGER,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS b2b_quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (quotation_id) REFERENCES b2b_quotations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS b2b_sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      quotation_id INTEGER REFERENCES b2b_quotations(id),
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT NOT NULL,
      order_date TEXT NOT NULL,
      expected_delivery TEXT,
      status TEXT NOT NULL DEFAULT 'NEW', -- NEW/PARTIAL/FULFILLED/CANCELLED
      subtotal REAL NOT NULL DEFAULT 0,
      tax_percent REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS b2b_sales_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sales_order_id INTEGER NOT NULL,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      qty_delivered REAL NOT NULL DEFAULT 0,
      qty_invoiced REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sales_order_id) REFERENCES b2b_sales_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS b2b_delivery_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      sales_order_id INTEGER REFERENCES b2b_sales_orders(id),
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT NOT NULL,
      delivery_date TEXT NOT NULL,
      expected_arrival TEXT,
      carrier TEXT,
      driver TEXT,
      status TEXT NOT NULL DEFAULT 'PREPARING', -- PREPARING/IN_TRANSIT/DELIVERED/RETURNED
      notes TEXT,
      signature_url TEXT,
      stock_posted INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS b2b_delivery_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_order_id INTEGER NOT NULL,
      sales_order_item_id INTEGER REFERENCES b2b_sales_order_items(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      FOREIGN KEY (delivery_order_id) REFERENCES b2b_delivery_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS b2b_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      sales_order_id INTEGER REFERENCES b2b_sales_orders(id),
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'ISSUED', -- ISSUED/PARTIAL/PAID/OVERDUE/VOID
      subtotal REAL NOT NULL DEFAULT 0,
      tax_percent REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      down_payment REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      outstanding REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS b2b_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      sales_order_item_id INTEGER REFERENCES b2b_sales_order_items(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES b2b_invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS b2b_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      invoice_id INTEGER NOT NULL REFERENCES b2b_invoices(id),
      customer_id INTEGER REFERENCES customers(id),
      payment_date TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash', -- cash/transfer/cheque
      amount REAL NOT NULL,
      bank_account_id INTEGER REFERENCES cash_accounts(id),
      ref_number TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- P1-09: Komisi (commission groups + per-transaction assignments)
    CREATE TABLE IF NOT EXISTS commission_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('FIXED', 'TIERED')),
      applies_to_scope TEXT NOT NULL DEFAULT 'all' CHECK(applies_to_scope IN ('all', 'roles', 'employees')),
      applies_to_role_keys TEXT,
      applies_to_employee_ids TEXT,
      applies_to_products_scope TEXT NOT NULL DEFAULT 'all' CHECK(applies_to_products_scope IN ('all', 'categories', 'products')),
      applies_to_category_ids TEXT,
      applies_to_product_ids TEXT,
      amount REAL,
      amount_basis TEXT DEFAULT 'PER_TRANSACTION' CHECK(amount_basis IN ('PER_TRANSACTION', 'PER_ITEM')),
      tiers TEXT,
      calc_period TEXT NOT NULL DEFAULT 'MONTH' CHECK(calc_period IN ('DAY', 'WEEK', 'MONTH')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS commission_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      commission_group_id INTEGER NOT NULL,
      basis_amount REAL NOT NULL DEFAULT 0,
      basis_qty INTEGER NOT NULL DEFAULT 0,
      computed_amount REAL NOT NULL DEFAULT 0,
      tier_percentage REAL,
      period_key TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES users(id),
      FOREIGN KEY (commission_group_id) REFERENCES commission_groups(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_commission_assign_employee ON commission_assignments(employee_id);
    CREATE INDEX IF NOT EXISTS idx_commission_assign_period ON commission_assignments(period_key);
    CREATE INDEX IF NOT EXISTS idx_commission_assign_transaction ON commission_assignments(transaction_id);

    CREATE TABLE IF NOT EXISTS promos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      promo_type TEXT NOT NULL CHECK(promo_type IN (
        'PERCENT', 'NOMINAL', 'FREE_PRODUCT', 'BUY_X_GET_Y',
        'BUNDLE_PRICE', 'MIN_PURCHASE', 'STEP_DISCOUNT', 'MEMBER_PRICE'
      )),
      discount_value REAL NOT NULL DEFAULT 0,
      max_discount REAL,
      bundle_price REAL,
      qty_required INTEGER DEFAULT 0,
      give_qty INTEGER DEFAULT 0,
      discount_target TEXT DEFAULT 'WHOLE_CART' CHECK(discount_target IN (
        'WHOLE_CART', 'TARGET_PRODUCTS', 'CHEAPEST_OF_TARGET', 'MOST_EXPENSIVE_OF_TARGET'
      )),
      target_product_ids TEXT,
      target_category_ids TEXT,
      customer_group_ids TEXT,
      valid_from DATETIME,
      valid_until DATETIME,
      day_of_week_mask INTEGER DEFAULT 127,
      time_of_day_start TEXT,
      time_of_day_end TEXT,
      min_purchase REAL DEFAULT 0,
      max_use_per_customer INTEGER DEFAULT 0,
      max_total_use INTEGER DEFAULT 0,
      current_use_count INTEGER DEFAULT 0,
      step_tiers TEXT,
      is_stackable INTEGER DEFAULT 0,
      requires_coupon INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      batch_id TEXT,
      max_uses INTEGER DEFAULT 1,
      used_count INTEGER DEFAULT 0,
      assigned_customer_id INTEGER,
      valid_from DATETIME,
      valid_until DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (promo_id) REFERENCES promos(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id INTEGER NOT NULL,
      transaction_id INTEGER,
      customer_id INTEGER,
      amount REAL DEFAULT 0,
      redeemed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS loyalty_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rule_type TEXT NOT NULL CHECK(rule_type IN ('earn_per_total', 'earn_per_product', 'redemption')),
      earn_rate REAL,
      bonus_points INTEGER,
      target_product_ids TEXT,
      multiplier_per_group TEXT,
      excluded_payment_methods TEXT,
      excluded_categories TEXT,
      redemption_rate REAL,
      min_redeem_per_transaction INTEGER,
      max_redeem_per_transaction INTEGER,
      max_redeem_per_day_per_customer INTEGER,
      redemption_block INTEGER,
      points_expire_after_months INTEGER,
      valid_from DATETIME,
      valid_until DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('earn', 'redeem', 'expire', 'adjust')),
      points INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      transaction_id INTEGER,
      rule_id INTEGER,
      notes TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (rule_id) REFERENCES loyalty_rules(id)
    );

    CREATE INDEX IF NOT EXISTS idx_promos_active ON promos(is_active);
    CREATE INDEX IF NOT EXISTS idx_promos_type ON promos(promo_type);
    CREATE INDEX IF NOT EXISTS idx_coupons_promo ON coupons(promo_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_batch ON coupons(batch_id);
    CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
    CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_customer ON coupon_redemptions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_loyalty_rules_type ON loyalty_rules(rule_type);
    CREATE INDEX IF NOT EXISTS idx_loyalty_rules_active ON loyalty_rules(is_active);
    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_loyalty_tx_type ON loyalty_transactions(type);

    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_tanggal ON inventory_movements(tanggal);
    CREATE INDEX IF NOT EXISTS idx_cash_transactions_account ON cash_transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_cash_transactions_tanggal ON cash_transactions(tanggal);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_recipe_product ON product_recipe_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_customer_tag_map_customer ON customer_tag_map(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_tag_map_tag ON customer_tag_map(tag_id);
    CREATE INDEX IF NOT EXISTS idx_stock_opname_status ON stock_opname(status);
    CREATE INDEX IF NOT EXISTS idx_stock_opname_items_opname ON stock_opname_items(opname_id);

    CREATE INDEX IF NOT EXISTS idx_b2b_quotations_customer ON b2b_quotations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_b2b_quotations_status ON b2b_quotations(status);
    CREATE INDEX IF NOT EXISTS idx_b2b_quotation_items_qid ON b2b_quotation_items(quotation_id);
    CREATE INDEX IF NOT EXISTS idx_b2b_sales_orders_customer ON b2b_sales_orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_b2b_sales_orders_status ON b2b_sales_orders(status);
    CREATE INDEX IF NOT EXISTS idx_b2b_sales_order_items_so ON b2b_sales_order_items(sales_order_id);
    CREATE INDEX IF NOT EXISTS idx_b2b_delivery_orders_so ON b2b_delivery_orders(sales_order_id);
    CREATE INDEX IF NOT EXISTS idx_b2b_delivery_order_items_do ON b2b_delivery_order_items(delivery_order_id);
    CREATE INDEX IF NOT EXISTS idx_b2b_invoices_customer ON b2b_invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_b2b_invoices_status ON b2b_invoices(status);
    CREATE INDEX IF NOT EXISTS idx_b2b_invoices_due ON b2b_invoices(due_date);
    CREATE INDEX IF NOT EXISTS idx_b2b_invoice_items_inv ON b2b_invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_b2b_receipts_invoice ON b2b_receipts(invoice_id);

    -- P1-12: Online orders + marketplace integrations + storefront/consumer app config.
    CREATE TABLE IF NOT EXISTS online_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_no TEXT UNIQUE NOT NULL,
      channel TEXT NOT NULL CHECK(channel IN ('emenu', 'consumer_app', 'gofood', 'grabfood', 'shopeefood', 'grabmart', 'tokopedia')),
      external_ref TEXT,
      order_type TEXT NOT NULL DEFAULT 'delivery' CHECK(order_type IN ('dine_in', 'takeaway', 'delivery')),
      table_no TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      delivery_zone TEXT,
      delivery_fee REAL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      service_charge REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'cod', 'refunded')),
      status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED')),
      reject_reason TEXT,
      cancel_reason TEXT,
      sla_minutes INTEGER DEFAULT 30,
      accepted_at DATETIME,
      ready_at DATETIME,
      completed_at DATETIME,
      cancelled_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS online_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      modifiers TEXT,
      notes TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES online_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT UNIQUE NOT NULL CHECK(provider IN ('gofood', 'grabfood', 'shopeefood', 'grabmart', 'tokopedia')),
      status TEXT NOT NULL DEFAULT 'disconnected' CHECK(status IN ('connected', 'disconnected', 'paused')),
      merchant_id TEXT,
      outlet_id TEXT,
      oauth_token TEXT,
      refresh_token TEXT,
      token_expires_at DATETIME,
      auto_accept INTEGER DEFAULT 0,
      sla_accept_minutes INTEGER DEFAULT 5,
      sla_ready_minutes INTEGER DEFAULT 15,
      mdr_percent REAL DEFAULT 20,
      price_markup_percent REAL DEFAULT 0,
      settings TEXT,
      connected_at DATETIME,
      last_sync_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS marketplace_product_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL CHECK(provider IN ('gofood', 'grabfood', 'shopeefood', 'grabmart', 'tokopedia')),
      product_id INTEGER NOT NULL,
      override_name TEXT,
      override_price REAL,
      override_image_url TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      synced_at DATETIME,
      sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'failed')),
      sync_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, product_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS storefront_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      slug TEXT,
      custom_domain TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      brand_name TEXT,
      logo_url TEXT,
      cover_image_url TEXT,
      primary_color TEXT DEFAULT '#04C99E',
      accent_color TEXT,
      theme TEXT DEFAULT 'light' CHECK(theme IN ('light', 'dark', 'auto')),
      language TEXT DEFAULT 'id',
      currency TEXT DEFAULT 'IDR',
      tagline TEXT,
      about_text TEXT,
      contact_phone TEXT,
      contact_whatsapp TEXT,
      contact_email TEXT,
      contact_instagram TEXT,
      tos_text TEXT,
      privacy_text TEXT,
      faq_text TEXT,
      seo_title TEXT,
      seo_description TEXT,
      seo_og_image_url TEXT,
      ga_id TEXT,
      fb_pixel_id TEXT,
      operating_hours TEXT,
      payment_methods TEXT,
      delivery_zones TEXT,
      min_order_amount REAL DEFAULT 0,
      service_charge_percent REAL DEFAULT 0,
      tax_percent REAL DEFAULT 0,
      supports_dine_in INTEGER DEFAULT 1,
      supports_takeaway INTEGER DEFAULT 1,
      supports_delivery INTEGER DEFAULT 1,
      banner_slides TEXT,
      featured_product_ids TEXT,
      hidden_category_ids TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS consumer_app_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      app_name TEXT,
      app_icon_url TEXT,
      splash_image_url TEXT,
      primary_color TEXT DEFAULT '#04C99E',
      bundle_id_android TEXT,
      bundle_id_ios TEXT,
      play_store_url TEXT,
      app_store_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'review', 'published', 'rejected')),
      provisioned_at DATETIME,
      published_at DATETIME,
      featured_promo_ids TEXT,
      hidden_product_ids TEXT,
      operating_hours TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
    CREATE INDEX IF NOT EXISTS idx_online_orders_channel ON online_orders(channel);
    CREATE INDEX IF NOT EXISTS idx_online_orders_created ON online_orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_online_order_items_order ON online_order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_marketplace_overrides_provider ON marketplace_product_overrides(provider);
    CREATE INDEX IF NOT EXISTS idx_marketplace_overrides_product ON marketplace_product_overrides(product_id);
  `);

  // --- Idempotent migrations for existing databases (so users that ran old seeds
  //     still get the new columns).
  addColumnIfMissing(db, 'categories', 'urutan', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'categories', 'department_id', 'INTEGER');
  addColumnIfMissing(db, 'categories', 'is_tampil_di_menu', 'INTEGER DEFAULT 1');

  // P1-05: Kategori + Departemen master.
  addColumnIfMissing(db, 'departments', 'urutan', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'departments', 'is_active', 'INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'categories', 'color', 'TEXT');
  addColumnIfMissing(db, 'categories', 'icon_url', 'TEXT');

  addColumnIfMissing(db, 'products', 'barcode', 'TEXT');
  addColumnIfMissing(db, 'products', 'harga_modal', 'REAL DEFAULT 0');
  addColumnIfMissing(db, 'products', 'harga_beli', 'REAL DEFAULT 0');
  addColumnIfMissing(db, 'products', 'satuan', "TEXT DEFAULT 'pcs'");
  addColumnIfMissing(db, 'products', 'description', 'TEXT');
  addColumnIfMissing(db, 'products', 'is_tampil_di_menu', 'INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'products', 'is_favorit', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'products', 'monitor_stok', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'products', 'stok_minimum', 'INTEGER DEFAULT 0');

  // P1-04: products master + 5-tab wizard.
  addColumnIfMissing(db, 'products', 'price_online', 'REAL');
  addColumnIfMissing(db, 'products', 'is_online_active', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'products', 'image_urls', 'TEXT'); // JSON array of up to 4 image URLs.
  addColumnIfMissing(db, 'products', 'has_variants', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'products', 'has_recipe', 'INTEGER DEFAULT 0');

  addColumnIfMissing(db, 'transactions', 'customer_id', 'INTEGER REFERENCES customers(id)');

  // P1-06: customer groups + tags + extended fields.
  addColumnIfMissing(
    db,
    'customers',
    'customer_group_id',
    'INTEGER REFERENCES customer_groups(id)'
  );
  addColumnIfMissing(db, 'customers', 'npwp', 'TEXT');
  addColumnIfMissing(db, 'customers', 'id_card_no', 'TEXT');
  addColumnIfMissing(db, 'customers', 'province', 'TEXT');
  addColumnIfMissing(db, 'customers', 'city', 'TEXT');
  addColumnIfMissing(db, 'customers', 'district', 'TEXT');

  // P1-07: inventory enrichment for COGS averaging + opname linkage + reason taxonomy.
  addColumnIfMissing(db, 'inventory_movements', 'unit_cost', 'REAL');
  addColumnIfMissing(db, 'inventory_movements', 'ref_type', 'TEXT');
  addColumnIfMissing(db, 'inventory_movements', 'ref_id', 'INTEGER');
  addColumnIfMissing(db, 'inventory_movements', 'reason', 'TEXT');

  // P1-02: auth flow refinement.
  addColumnIfMissing(db, 'users', 'email', 'TEXT');
  addColumnIfMissing(db, 'users', 'totp_secret', 'TEXT');
  addColumnIfMissing(db, 'users', 'totp_enabled', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'users', 'last_login_at', 'DATETIME');

  // Indexes that reference columns added via addColumnIfMissing must run AFTER
  // those migrations so existing databases without the new columns can still
  // boot.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON inventory_movements(ref_type, ref_id);
    CREATE INDEX IF NOT EXISTS idx_customers_group ON customers(customer_group_id);
  `);

  // Seed default admin if not exists
  const bcrypt = require('bcryptjs');
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)').run(
      'admin',
      hashedPassword,
      'Administrator',
      'admin'
    );
    console.log('Default admin user created (admin / admin123)');
  }

  console.log('Database initialized successfully');
}

module.exports = { getDb, initDatabase, _resetDbForTests };
