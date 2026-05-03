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
  `);

  // ============================================================
  // P1-14: Karyawan + Payroll + Absensi + Schedule + Approval
  // ============================================================
  db.exec(`
    -- Master karyawan. user_id (optional) link ke users table buat login.
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      employee_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      photo_url TEXT,
      nik_ktp TEXT,
      npwp TEXT,
      birth_date DATE,
      birth_place TEXT,
      gender TEXT CHECK(gender IN ('M', 'F') OR gender IS NULL),
      marital_status TEXT,
      religion TEXT,
      blood_type TEXT,
      nationality TEXT DEFAULT 'Indonesia',
      phone TEXT,
      email TEXT,
      address TEXT,
      address_ktp TEXT,
      emergency_contact_name TEXT,
      emergency_contact_relation TEXT,
      emergency_contact_phone TEXT,
      department_id INTEGER,
      position TEXT,
      employee_type TEXT DEFAULT 'permanent' CHECK(employee_type IN ('permanent', 'contract', 'intern', 'freelance')),
      date_joined DATE,
      date_resigned DATE,
      role TEXT DEFAULT 'cashier' CHECK(role IN ('admin', 'manager', 'cashier', 'staff', 'waiters')),
      payroll_structure_id INTEGER,
      bank_name TEXT,
      bank_account_no TEXT,
      bank_account_name TEXT,
      base_salary REAL DEFAULT 0,
      pin_code TEXT,
      attendance_methods TEXT,
      allowed_outlet_ids TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'resigned', 'on_leave')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
    CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);

    -- Dokumen pendukung (KTP, KK, NPWP, ijazah, kontrak).
    CREATE TABLE IF NOT EXISTS employee_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- Per-employee permission overrides (atas role default).
    CREATE TABLE IF NOT EXISTS permission_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      permission_key TEXT NOT NULL,
      granted INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, permission_key),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- Pengaturan payroll global (single-row).
    CREATE TABLE IF NOT EXISTS payroll_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      period TEXT NOT NULL DEFAULT 'monthly' CHECK(period IN ('monthly', 'biweekly', 'weekly')),
      cutoff_day INTEGER DEFAULT 25,
      payment_day INTEGER DEFAULT 1,
      working_hours_per_month REAL DEFAULT 173,
      overtime_multiplier REAL DEFAULT 1.5,
      tax_method TEXT DEFAULT 'gross' CHECK(tax_method IN ('gross', 'nett', 'progressive', 'gross-up')),
      bpjs_kesehatan_employee REAL DEFAULT 1.0,
      bpjs_jht_employee REAL DEFAULT 2.0,
      bpjs_jp_employee REAL DEFAULT 1.0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Struktur gaji (template) — komponen disimpan JSON utk fleksibilitas.
    CREATE TABLE IF NOT EXISTS payroll_structures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      basic_salary REAL NOT NULL DEFAULT 0,
      allowances TEXT,
      deductions TEXT,
      overtime_rate REAL DEFAULT 0,
      include_bpjs INTEGER DEFAULT 1,
      include_pph21 INTEGER DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Run payroll per periode (header).
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_no TEXT UNIQUE NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      payment_date DATE,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'VOIDED')),
      total_gross REAL DEFAULT 0,
      total_deductions REAL DEFAULT 0,
      total_net REAL DEFAULT 0,
      employee_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Payslip per karyawan per run.
    CREATE TABLE IF NOT EXISTS payslips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payroll_run_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      employee_no TEXT,
      employee_name TEXT,
      structure_id INTEGER,
      basic_salary REAL DEFAULT 0,
      total_allowances REAL DEFAULT 0,
      total_deductions REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      overtime_amount REAL DEFAULT 0,
      bpjs_kesehatan REAL DEFAULT 0,
      bpjs_jht REAL DEFAULT 0,
      bpjs_jp REAL DEFAULT 0,
      pph21 REAL DEFAULT 0,
      gross_salary REAL DEFAULT 0,
      net_salary REAL DEFAULT 0,
      breakdown TEXT,
      bank_name TEXT,
      bank_account_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_payslips_run ON payslips(payroll_run_id);
    CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

    -- Attendance log entries.
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      log_type TEXT NOT NULL CHECK(log_type IN ('check_in', 'check_out', 'break_start', 'break_end')),
      logged_at DATETIME NOT NULL,
      method TEXT NOT NULL DEFAULT 'manual' CHECK(method IN ('gps', 'selfie', 'nfc', 'manual', 'qr')),
      latitude REAL,
      longitude REAL,
      photo_url TEXT,
      note TEXT,
      is_off_site INTEGER DEFAULT 0,
      approved_by INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_logs(employee_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_logged ON attendance_logs(logged_at);

    -- Geofence config per outlet (untuk MVP, single outlet — id default 1).
    CREATE TABLE IF NOT EXISTS attendance_geofences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outlet_id INTEGER UNIQUE NOT NULL,
      outlet_name TEXT,
      latitude REAL,
      longitude REAL,
      radius_m INTEGER DEFAULT 100,
      strict_mode INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Shift template.
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      break_minutes INTEGER DEFAULT 0,
      color TEXT DEFAULT '#04C99E',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Schedule assignment (employee × date × shift).
    CREATE TABLE IF NOT EXISTS schedule_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      shift_id INTEGER,
      schedule_date DATE NOT NULL,
      is_off INTEGER DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, schedule_date),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_schedule_employee ON schedule_assignments(employee_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule_assignments(schedule_date);

    -- Schedule swap requests.
    CREATE TABLE IF NOT EXISTS schedule_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      requester_assignment_id INTEGER NOT NULL,
      partner_id INTEGER NOT NULL,
      partner_assignment_id INTEGER NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
      decided_by INTEGER,
      decided_at DATETIME,
      decision_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requester_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (partner_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (requester_assignment_id) REFERENCES schedule_assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (partner_assignment_id) REFERENCES schedule_assignments(id) ON DELETE CASCADE
    );

    -- Approval chain config (purchase / finance / leave / etc).
    CREATE TABLE IF NOT EXISTS approval_chains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL CHECK(domain IN ('purchase', 'finance', 'leave', 'overtime', 'attendance_correction', 'other')),
      name TEXT NOT NULL,
      threshold_amount REAL DEFAULT 0,
      steps TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- P1-15: Keuangan (Buku Kas + Penerimaan + Pengeluaran + Aset Tetap + Laporan)
    -- ============================================================

    -- Chart of Accounts (CoA). Indonesian SAK ETAP-style:
    --   1xxx Aset, 2xxx Kewajiban, 3xxx Modal, 4xxx Pendapatan, 5xxx Beban
    CREATE TABLE IF NOT EXISTS gl_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ASET', 'KEWAJIBAN', 'MODAL', 'PENDAPATAN', 'BEBAN')),
      subtype TEXT,
      parent_id INTEGER REFERENCES gl_accounts(id),
      normal_balance TEXT NOT NULL CHECK(normal_balance IN ('debit', 'credit')),
      opening_balance REAL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gl_accounts_type ON gl_accounts(type);
    CREATE INDEX IF NOT EXISTS idx_gl_accounts_parent ON gl_accounts(parent_id);

    -- General journals (header). Every business event posts a journal:
    --   manual / sale / income / expense / transfer / payroll / depreciation / disposal / opening
    CREATE TABLE IF NOT EXISTS gl_journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_no TEXT UNIQUE NOT NULL,
      journal_date DATE NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL DEFAULT 'manual'
        CHECK(source_type IN ('manual', 'sale', 'income', 'expense', 'transfer', 'payroll', 'depreciation', 'disposal', 'opening')),
      source_id INTEGER,
      total_amount REAL NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gl_journals_date ON gl_journals(journal_date);
    CREATE INDEX IF NOT EXISTS idx_gl_journals_source ON gl_journals(source_type, source_id);

    -- Journal lines (per account debit/credit). Sum debit must equal sum credit.
    CREATE TABLE IF NOT EXISTS gl_journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_id INTEGER NOT NULL REFERENCES gl_journals(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_gl_journal_lines_journal ON gl_journal_lines(journal_id);
    CREATE INDEX IF NOT EXISTS idx_gl_journal_lines_account ON gl_journal_lines(account_id);

    -- Vendors / Mitra (for expense / fixed asset purchase).
    CREATE TABLE IF NOT EXISTS gl_vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      npwp TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      bank_name TEXT,
      bank_account_no TEXT,
      bank_account_holder TEXT,
      default_account_id INTEGER REFERENCES gl_accounts(id),
      payment_terms_days INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Income (Penerimaan): manual income, auto-posts journal Dr Cash/Bank, Cr Revenue.
    CREATE TABLE IF NOT EXISTS gl_incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_no TEXT UNIQUE NOT NULL,
      income_date DATE NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'other' CHECK(source_type IN ('customer', 'other')),
      customer_id INTEGER REFERENCES customers(id),
      source_other TEXT,
      category TEXT,
      amount REAL NOT NULL,
      cash_account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      revenue_account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      tax_amount REAL DEFAULT 0,
      description TEXT,
      attachment TEXT,
      journal_id INTEGER REFERENCES gl_journals(id),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gl_incomes_date ON gl_incomes(income_date);

    -- Expenses (Pengeluaran): vendor + category + auto-journal.
    CREATE TABLE IF NOT EXISTS gl_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_no TEXT UNIQUE NOT NULL,
      expense_date DATE NOT NULL,
      vendor_id INTEGER REFERENCES gl_vendors(id),
      expense_account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      payment_account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      amount REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      description TEXT,
      attachment TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      journal_id INTEGER REFERENCES gl_journals(id),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_gl_expenses_date ON gl_expenses(expense_date);

    -- Recurring bills (auto-create monthly draft expense).
    CREATE TABLE IF NOT EXISTS gl_recurring_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      vendor_id INTEGER REFERENCES gl_vendors(id),
      expense_account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      payment_account_id INTEGER REFERENCES gl_accounts(id),
      amount REAL NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('monthly', 'quarterly', 'annually')),
      due_day INTEGER NOT NULL DEFAULT 1,
      last_run_at DATETIME,
      next_run_at DATETIME,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Fixed assets register.
    CREATE TABLE IF NOT EXISTS gl_fixed_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      acquisition_date DATE NOT NULL,
      cost REAL NOT NULL,
      useful_life_years INTEGER NOT NULL DEFAULT 1,
      salvage_value REAL NOT NULL DEFAULT 0,
      depreciation_method TEXT NOT NULL DEFAULT 'STRAIGHT_LINE'
        CHECK(depreciation_method IN ('STRAIGHT_LINE', 'DOUBLE_DECLINING')),
      accumulated_depreciation REAL NOT NULL DEFAULT 0,
      location TEXT,
      vendor_id INTEGER REFERENCES gl_vendors(id),
      photo_url TEXT,
      asset_account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      accum_dep_account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      dep_expense_account_id INTEGER NOT NULL REFERENCES gl_accounts(id),
      payment_account_id INTEGER REFERENCES gl_accounts(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disposed')),
      acquisition_journal_id INTEGER REFERENCES gl_journals(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Per-period depreciation runs.
    CREATE TABLE IF NOT EXISTS gl_fixed_asset_depreciations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES gl_fixed_assets(id) ON DELETE CASCADE,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL,
      amount REAL NOT NULL,
      journal_id INTEGER REFERENCES gl_journals(id),
      run_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(asset_id, period_year, period_month)
    );

    -- Disposal records.
    CREATE TABLE IF NOT EXISTS gl_fixed_asset_disposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL UNIQUE REFERENCES gl_fixed_assets(id),
      disposal_date DATE NOT NULL,
      disposal_type TEXT NOT NULL CHECK(disposal_type IN ('SOLD', 'SCRAPPED', 'DONATED', 'LOST')),
      proceeds REAL NOT NULL DEFAULT 0,
      buyer TEXT,
      gain_loss REAL NOT NULL DEFAULT 0,
      proceeds_account_id INTEGER REFERENCES gl_accounts(id),
      journal_id INTEGER REFERENCES gl_journals(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // P1-16: Pengaturan / Settings tables.
  db.exec(`
    -- Outlet/cabang master.
    CREATE TABLE IF NOT EXISTS outlets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT,
      address TEXT,
      city TEXT,
      province TEXT,
      phone TEXT,
      email TEXT,
      logo_url TEXT,
      tax_npwp TEXT,
      timezone TEXT DEFAULT 'Asia/Jakarta',
      currency TEXT DEFAULT 'IDR',
      is_main INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outlet_floor_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outlet_id INTEGER NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      width INTEGER DEFAULT 1000,
      height INTEGER DEFAULT 700,
      tables_json TEXT NOT NULL DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Hardware terminals (PC kasir, printer, soundbox, EDC).
    CREATE TABLE IF NOT EXISTS terminals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cashier','printer','soundbox','edc','kitchen_display','tablet','other')),
      outlet_id INTEGER REFERENCES outlets(id),
      model TEXT,
      serial_no TEXT,
      ip_address TEXT,
      mac_address TEXT,
      paired_user_id INTEGER REFERENCES users(id),
      config_json TEXT,
      last_seen_at DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Generic key-value app settings (per-outlet or global). Scope NULL = global.
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outlet_id INTEGER REFERENCES outlets(id),
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(outlet_id, category, key)
    );

    -- Notification channel preferences per user.
    CREATE TABLE IF NOT EXISTS notification_prefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      via_push INTEGER DEFAULT 1,
      via_wa INTEGER DEFAULT 0,
      via_sms INTEGER DEFAULT 0,
      via_email INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, event_key)
    );

    -- Time-bounded support access grants.
    CREATE TABLE IF NOT EXISTS support_access_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grantee_email TEXT NOT NULL,
      reason TEXT,
      granted_by INTEGER REFERENCES users(id),
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Pajak rate (multi-tax). Sales tax / service charge configurable.
    CREATE TABLE IF NOT EXISTS tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      rate REAL NOT NULL DEFAULT 0,
      is_inclusive INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Non-cash payment method master.
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('cash','debit','credit','qris','ewallet','transfer','voucher','other')),
      provider TEXT,
      fee_percent REAL DEFAULT 0,
      fee_flat REAL DEFAULT 0,
      account_id INTEGER REFERENCES gl_accounts(id),
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- UoM master (satuan).
    CREATE TABLE IF NOT EXISTS uoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      symbol TEXT,
      base_uom_id INTEGER REFERENCES uoms(id),
      conversion_factor REAL DEFAULT 1,
      is_active INTEGER DEFAULT 1
    );

    -- P1-17 Report Schedules (Prime+ tier feature).
    -- params_json: JSON-encoded filter (from/to/outlet/etc) yang akan dipakai
    -- saat run scheduled. recipients: comma-separated email list.
    CREATE TABLE IF NOT EXISTS report_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_key TEXT NOT NULL,
      name TEXT NOT NULL,
      params_json TEXT,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly')),
      recipients TEXT,
      format TEXT DEFAULT 'pdf' CHECK(format IN ('csv', 'xlsx', 'pdf')),
      is_active INTEGER DEFAULT 1,
      last_run_at DATETIME,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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

  // P1-16: profile photo + phone untuk Account Profile page.
  addColumnIfMissing(db, 'users', 'photo_url', 'TEXT');
  addColumnIfMissing(db, 'users', 'phone', 'TEXT');

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

  // P1-15: Seed default Chart of Accounts (Indonesian SAK ETAP) if empty.
  seedDefaultChartOfAccounts(db);

  // P1-16: Seed default settings data (outlet, tax rates, payment methods, UoM) if empty.
  seedDefaultSettings(db);

  console.log('Database initialized successfully');
}

function seedDefaultSettings(db) {
  // Default main outlet kalau tabel masih kosong.
  const outletCount = db.prepare('SELECT COUNT(*) AS n FROM outlets').get();
  if (!outletCount || outletCount.n === 0) {
    db.prepare(
      `INSERT INTO outlets (code, name, type, address, city, timezone, currency, is_main, is_active)
       VALUES ('OUT-001', 'Outlet Pusat', 'restaurant', '-', 'Jakarta', 'Asia/Jakarta', 'IDR', 1, 1)`
    ).run();
  }

  const taxCount = db.prepare('SELECT COUNT(*) AS n FROM tax_rates').get();
  if (!taxCount || taxCount.n === 0) {
    const insert = db.prepare(
      `INSERT INTO tax_rates (code, name, rate, is_inclusive, is_active) VALUES (?, ?, ?, ?, 1)`
    );
    insert.run('PPN', 'PPN 11%', 11, 0);
    insert.run('SVC', 'Service Charge 5%', 5, 0);
    insert.run('PB1', 'Pajak Restoran (PB1) 10%', 10, 0);
  }

  const pmCount = db.prepare('SELECT COUNT(*) AS n FROM payment_methods').get();
  if (!pmCount || pmCount.n === 0) {
    const insert = db.prepare(
      `INSERT INTO payment_methods (code, name, type, fee_percent, is_active, sort_order)
       VALUES (?, ?, ?, ?, 1, ?)`
    );
    insert.run('CASH', 'Tunai', 'cash', 0, 1);
    insert.run('QRIS', 'QRIS', 'qris', 0.7, 2);
    insert.run('DEBIT', 'Kartu Debit', 'debit', 0, 3);
    insert.run('CREDIT', 'Kartu Kredit', 'credit', 2.5, 4);
    insert.run('GOPAY', 'GoPay', 'ewallet', 1.5, 5);
    insert.run('OVO', 'OVO', 'ewallet', 1.5, 6);
    insert.run('TF-BCA', 'Transfer BCA', 'transfer', 0, 7);
  }

  const uomCount = db.prepare('SELECT COUNT(*) AS n FROM uoms').get();
  if (!uomCount || uomCount.n === 0) {
    const insert = db.prepare(
      `INSERT INTO uoms (code, name, symbol, conversion_factor, is_active) VALUES (?, ?, ?, 1, 1)`
    );
    insert.run('PCS', 'Pieces', 'pcs');
    insert.run('KG', 'Kilogram', 'kg');
    insert.run('GR', 'Gram', 'g');
    insert.run('LT', 'Liter', 'L');
    insert.run('ML', 'Mililiter', 'ml');
    insert.run('PACK', 'Pack', 'pak');
    insert.run('BOX', 'Box', 'box');
    insert.run('PORSI', 'Porsi', 'porsi');
  }
}

/**
 * Seed default Chart of Accounts (Indonesian SAK ETAP-style).
 * Idempotent — only runs when the CoA table is empty.
 */
function seedDefaultChartOfAccounts(db) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM gl_accounts').get();
  if (existing && existing.n > 0) return;

  // Type → normal_balance (Aset/Beban = debit; Kewajiban/Modal/Pendapatan = credit).
  const NB = {
    ASET: 'debit',
    KEWAJIBAN: 'credit',
    MODAL: 'credit',
    PENDAPATAN: 'credit',
    BEBAN: 'debit',
  };
  const insert = db.prepare(
    `INSERT INTO gl_accounts (code, name, type, subtype, normal_balance, is_active)
     VALUES (@code, @name, @type, @subtype, @nb, 1)`
  );
  const seedRows = [
    // ===== Aset =====
    { code: '1000', name: 'Aset', type: 'ASET', subtype: 'header' },
    { code: '1100', name: 'Aset Lancar', type: 'ASET', subtype: 'header' },
    { code: '1101', name: 'Kas', type: 'ASET', subtype: 'Kas & Bank' },
    { code: '1102', name: 'Bank BCA', type: 'ASET', subtype: 'Kas & Bank' },
    { code: '1103', name: 'Bank Mandiri', type: 'ASET', subtype: 'Kas & Bank' },
    { code: '1110', name: 'Kas Kasir', type: 'ASET', subtype: 'Kas & Bank' },
    { code: '1201', name: 'Piutang Usaha', type: 'ASET', subtype: 'Aset Lancar Lain' },
    { code: '1301', name: 'Persediaan Barang', type: 'ASET', subtype: 'Aset Lancar Lain' },
    { code: '1500', name: 'Aset Tetap', type: 'ASET', subtype: 'header' },
    { code: '1501', name: 'Tanah', type: 'ASET', subtype: 'Aset Tetap' },
    { code: '1502', name: 'Bangunan', type: 'ASET', subtype: 'Aset Tetap' },
    { code: '1503', name: 'Kendaraan', type: 'ASET', subtype: 'Aset Tetap' },
    { code: '1504', name: 'Peralatan', type: 'ASET', subtype: 'Aset Tetap' },
    {
      code: '1591',
      name: 'Akumulasi Penyusutan Bangunan',
      type: 'ASET',
      subtype: 'Akm. Penyusutan',
    },
    {
      code: '1592',
      name: 'Akumulasi Penyusutan Kendaraan',
      type: 'ASET',
      subtype: 'Akm. Penyusutan',
    },
    {
      code: '1593',
      name: 'Akumulasi Penyusutan Peralatan',
      type: 'ASET',
      subtype: 'Akm. Penyusutan',
    },
    // ===== Kewajiban =====
    { code: '2000', name: 'Kewajiban', type: 'KEWAJIBAN', subtype: 'header' },
    { code: '2101', name: 'Hutang Usaha', type: 'KEWAJIBAN', subtype: 'Kewajiban Lancar' },
    { code: '2102', name: 'Hutang Pajak', type: 'KEWAJIBAN', subtype: 'Kewajiban Lancar' },
    { code: '2103', name: 'Hutang Gaji', type: 'KEWAJIBAN', subtype: 'Kewajiban Lancar' },
    { code: '2201', name: 'Hutang Bank', type: 'KEWAJIBAN', subtype: 'Kewajiban Jangka Panjang' },
    // ===== Modal =====
    { code: '3000', name: 'Modal', type: 'MODAL', subtype: 'header' },
    { code: '3101', name: 'Modal Disetor', type: 'MODAL', subtype: 'Modal' },
    { code: '3201', name: 'Laba Ditahan', type: 'MODAL', subtype: 'Modal' },
    { code: '3301', name: 'Laba Tahun Berjalan', type: 'MODAL', subtype: 'Modal' },
    // ===== Pendapatan =====
    { code: '4000', name: 'Pendapatan', type: 'PENDAPATAN', subtype: 'header' },
    { code: '4101', name: 'Penjualan', type: 'PENDAPATAN', subtype: 'Penjualan' },
    { code: '4102', name: 'Pendapatan Jasa', type: 'PENDAPATAN', subtype: 'Penjualan' },
    { code: '4103', name: 'Pendapatan Lain', type: 'PENDAPATAN', subtype: 'Pendapatan Lain' },
    { code: '4910', name: 'Laba Pelepasan Aset', type: 'PENDAPATAN', subtype: 'Pendapatan Lain' },
    // ===== Beban =====
    { code: '5000', name: 'Beban', type: 'BEBAN', subtype: 'header' },
    { code: '5101', name: 'HPP', type: 'BEBAN', subtype: 'HPP' },
    { code: '5201', name: 'Beban Gaji', type: 'BEBAN', subtype: 'Beban Operasional' },
    { code: '5202', name: 'Beban Sewa', type: 'BEBAN', subtype: 'Beban Operasional' },
    { code: '5203', name: 'Beban Listrik & Air', type: 'BEBAN', subtype: 'Beban Operasional' },
    { code: '5204', name: 'Beban Internet', type: 'BEBAN', subtype: 'Beban Operasional' },
    { code: '5205', name: 'Beban Marketing', type: 'BEBAN', subtype: 'Beban Operasional' },
    { code: '5206', name: 'Beban Perlengkapan', type: 'BEBAN', subtype: 'Beban Operasional' },
    { code: '5207', name: 'Beban Transport', type: 'BEBAN', subtype: 'Beban Operasional' },
    { code: '5208', name: 'Beban Komunikasi', type: 'BEBAN', subtype: 'Beban Operasional' },
    { code: '5301', name: 'Beban Penyusutan', type: 'BEBAN', subtype: 'Beban Penyusutan' },
    { code: '5910', name: 'Rugi Pelepasan Aset', type: 'BEBAN', subtype: 'Beban Lain' },
    { code: '5911', name: 'Beban Bank', type: 'BEBAN', subtype: 'Beban Lain' },
  ];
  const txn = db.transaction((rows) => {
    for (const row of rows) {
      insert.run({
        code: row.code,
        name: row.name,
        type: row.type,
        subtype: row.subtype,
        nb: NB[row.type],
      });
    }
  });
  txn(seedRows);
  console.log(`Seeded ${seedRows.length} default Chart of Accounts entries`);
}

module.exports = { getDb, initDatabase, _resetDbForTests };
