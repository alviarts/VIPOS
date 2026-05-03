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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      urutan INTEGER DEFAULT 0,
      department_id INTEGER,
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
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_cash_transactions_account ON cash_transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_cash_transactions_tanggal ON cash_transactions(tanggal);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
  `);

  // --- Idempotent migrations for existing databases (so users that ran old seeds
  //     still get the new columns).
  addColumnIfMissing(db, 'categories', 'urutan', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'categories', 'department_id', 'INTEGER');
  addColumnIfMissing(db, 'categories', 'is_tampil_di_menu', 'INTEGER DEFAULT 1');

  addColumnIfMissing(db, 'products', 'barcode', 'TEXT');
  addColumnIfMissing(db, 'products', 'harga_modal', 'REAL DEFAULT 0');
  addColumnIfMissing(db, 'products', 'harga_beli', 'REAL DEFAULT 0');
  addColumnIfMissing(db, 'products', 'satuan', "TEXT DEFAULT 'pcs'");
  addColumnIfMissing(db, 'products', 'description', 'TEXT');
  addColumnIfMissing(db, 'products', 'is_tampil_di_menu', 'INTEGER DEFAULT 1');
  addColumnIfMissing(db, 'products', 'is_favorit', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'products', 'monitor_stok', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'products', 'stok_minimum', 'INTEGER DEFAULT 0');

  addColumnIfMissing(db, 'transactions', 'customer_id', 'INTEGER REFERENCES customers(id)');

  // P1-02: auth flow refinement.
  addColumnIfMissing(db, 'users', 'email', 'TEXT');
  addColumnIfMissing(db, 'users', 'totp_secret', 'TEXT');
  addColumnIfMissing(db, 'users', 'totp_enabled', 'INTEGER DEFAULT 0');
  addColumnIfMissing(db, 'users', 'last_login_at', 'DATETIME');

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
