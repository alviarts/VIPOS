const { getDb, initDatabase } = require('../models/database');

initDatabase();
const db = getDb();

// Departments
const departments = [
  { name: 'F&B', description: 'Makanan & Minuman' },
  { name: 'Retail', description: 'Penjualan retail / merchandise' },
  { name: 'Layanan', description: 'Jasa / layanan' },
];
const insertDept = db.prepare(
  'INSERT OR IGNORE INTO departments (name, description) VALUES (?, ?)'
);
for (const d of departments) insertDept.run(d.name, d.description);

const getDeptId = db.prepare('SELECT id FROM departments WHERE name = ?');
const fbId = getDeptId.get('F&B')?.id || null;

// Categories (with new fields)
const categories = [
  { name: 'Makanan', description: 'Aneka makanan dan snack', urutan: 1, dept: 'F&B', tampil: 1 },
  { name: 'Minuman', description: 'Aneka minuman dingin/panas', urutan: 2, dept: 'F&B', tampil: 1 },
  { name: 'Dessert', description: 'Aneka dessert dan kue', urutan: 3, dept: 'F&B', tampil: 1 },
  { name: 'Paket', description: 'Paket hemat dan bundling', urutan: 4, dept: 'F&B', tampil: 1 },
  { name: 'Lainnya', description: 'Produk lainnya', urutan: 99, dept: null, tampil: 1 },
];
const upsertCat = db.prepare(`
  INSERT INTO categories (name, description, urutan, department_id, is_tampil_di_menu)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET
    description = excluded.description,
    urutan = excluded.urutan,
    department_id = excluded.department_id,
    is_tampil_di_menu = excluded.is_tampil_di_menu
`);
for (const c of categories) {
  const deptId = c.dept ? getDeptId.get(c.dept)?.id || null : null;
  upsertCat.run(c.name, c.description, c.urutan, deptId, c.tampil);
}

// Products (with new fields)
const products = [
  {
    name: 'Nasi Goreng Spesial',
    sku: 'MKN001',
    price: 25000,
    modal: 12000,
    beli: 11000,
    stock: 100,
    category: 'Makanan',
    satuan: 'porsi',
    favorit: 1,
  },
  {
    name: 'Mie Goreng',
    sku: 'MKN002',
    price: 20000,
    modal: 9000,
    beli: 8500,
    stock: 100,
    category: 'Makanan',
    satuan: 'porsi',
  },
  {
    name: 'Ayam Goreng',
    sku: 'MKN003',
    price: 22000,
    modal: 11000,
    beli: 10000,
    stock: 50,
    category: 'Makanan',
    satuan: 'porsi',
  },
  {
    name: 'Ayam Bakar',
    sku: 'MKN004',
    price: 28000,
    modal: 14000,
    beli: 13000,
    stock: 50,
    category: 'Makanan',
    satuan: 'porsi',
  },
  {
    name: 'Sate Ayam (10 tusuk)',
    sku: 'MKN005',
    price: 30000,
    modal: 15000,
    beli: 14000,
    stock: 40,
    category: 'Makanan',
    satuan: 'porsi',
  },
  {
    name: 'Nasi Putih',
    sku: 'MKN006',
    price: 5000,
    modal: 1500,
    beli: 1200,
    stock: 200,
    category: 'Makanan',
    satuan: 'porsi',
  },
  {
    name: 'Kentang Goreng',
    sku: 'MKN007',
    price: 15000,
    modal: 6000,
    beli: 5500,
    stock: 80,
    category: 'Makanan',
    satuan: 'porsi',
  },
  {
    name: 'Burger Classic',
    sku: 'MKN008',
    price: 25000,
    modal: 12000,
    beli: 11000,
    stock: 60,
    category: 'Makanan',
    satuan: 'pcs',
    favorit: 1,
  },
  {
    name: 'Es Teh Manis',
    sku: 'MNM001',
    price: 5000,
    modal: 1500,
    beli: 1200,
    stock: 200,
    category: 'Minuman',
    satuan: 'gelas',
    favorit: 1,
  },
  {
    name: 'Es Jeruk',
    sku: 'MNM002',
    price: 8000,
    modal: 3000,
    beli: 2500,
    stock: 150,
    category: 'Minuman',
    satuan: 'gelas',
  },
  {
    name: 'Kopi Hitam',
    sku: 'MNM003',
    price: 10000,
    modal: 4000,
    beli: 3500,
    stock: 100,
    category: 'Minuman',
    satuan: 'gelas',
  },
  {
    name: 'Cappuccino',
    sku: 'MNM004',
    price: 18000,
    modal: 8000,
    beli: 7500,
    stock: 80,
    category: 'Minuman',
    satuan: 'gelas',
  },
  {
    name: 'Latte',
    sku: 'MNM005',
    price: 20000,
    modal: 9000,
    beli: 8500,
    stock: 80,
    category: 'Minuman',
    satuan: 'gelas',
  },
  {
    name: 'Jus Alpukat',
    sku: 'MNM006',
    price: 15000,
    modal: 6000,
    beli: 5500,
    stock: 60,
    category: 'Minuman',
    satuan: 'gelas',
  },
  {
    name: 'Air Mineral',
    sku: 'MNM007',
    price: 4000,
    modal: 1500,
    beli: 1200,
    stock: 300,
    category: 'Minuman',
    satuan: 'botol',
  },
  {
    name: 'Teh Tarik',
    sku: 'MNM008',
    price: 12000,
    modal: 5000,
    beli: 4500,
    stock: 100,
    category: 'Minuman',
    satuan: 'gelas',
  },
  {
    name: 'Pudding Coklat',
    sku: 'DSR001',
    price: 12000,
    modal: 5000,
    beli: 4500,
    stock: 40,
    category: 'Dessert',
    satuan: 'pcs',
  },
  {
    name: 'Es Krim Vanilla',
    sku: 'DSR002',
    price: 10000,
    modal: 4000,
    beli: 3500,
    stock: 50,
    category: 'Dessert',
    satuan: 'pcs',
  },
  {
    name: 'Brownies',
    sku: 'DSR003',
    price: 15000,
    modal: 6000,
    beli: 5500,
    stock: 30,
    category: 'Dessert',
    satuan: 'pcs',
  },
  {
    name: 'Paket Nasi + Ayam + Teh',
    sku: 'PKT001',
    price: 30000,
    modal: 15000,
    beli: 14000,
    stock: 100,
    category: 'Paket',
    satuan: 'paket',
  },
  {
    name: 'Paket Burger + Kentang + Minum',
    sku: 'PKT002',
    price: 40000,
    modal: 20000,
    beli: 19000,
    stock: 80,
    category: 'Paket',
    satuan: 'paket',
  },
];

const getCategoryId = db.prepare('SELECT id FROM categories WHERE name = ?');
const upsertProduct = db.prepare(`
  INSERT INTO products (
    name, sku, price, harga_modal, harga_beli, stock, category_id, satuan,
    is_tampil_di_menu, is_favorit, monitor_stok, stok_minimum
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(sku) DO UPDATE SET
    name = excluded.name,
    price = excluded.price,
    harga_modal = excluded.harga_modal,
    harga_beli = excluded.harga_beli,
    stock = excluded.stock,
    category_id = excluded.category_id,
    satuan = excluded.satuan,
    is_favorit = excluded.is_favorit
`);
for (const p of products) {
  const cat = getCategoryId.get(p.category);
  upsertProduct.run(
    p.name,
    p.sku,
    p.price,
    p.modal,
    p.beli,
    p.stock,
    cat ? cat.id : null,
    p.satuan || 'pcs',
    1, // is_tampil_di_menu
    p.favorit ? 1 : 0,
    1, // monitor_stok ON for seeded data
    10 // stok_minimum default
  );
}

// Customers (sample data — Majoo's "Daftar Pelanggan" pattern)
const customers = [
  {
    kode: 'PLG0001',
    name: 'Budi Santoso',
    phone: '081234567001',
    email: 'budi.santoso@example.com',
    address: 'Jl. Mawar No. 1, Jakarta',
    gender: 'L',
    points: 120,
    deposit: 0,
  },
  {
    kode: 'PLG0002',
    name: 'Siti Aminah',
    phone: '081234567002',
    email: 'siti.aminah@example.com',
    address: 'Jl. Melati No. 5, Bandung',
    gender: 'P',
    points: 50,
    deposit: 25000,
  },
  {
    kode: 'PLG0003',
    name: 'Andi Wijaya',
    phone: '081234567003',
    email: 'andi.wijaya@example.com',
    address: 'Jl. Kenanga No. 12, Surabaya',
    gender: 'L',
    points: 200,
    deposit: 0,
  },
  {
    kode: 'PLG0004',
    name: 'Dewi Lestari',
    phone: '081234567004',
    email: 'dewi.lestari@example.com',
    address: 'Jl. Anggrek No. 8, Yogyakarta',
    gender: 'P',
    points: 0,
    deposit: 100000,
  },
  {
    kode: 'PLG0005',
    name: 'Rian Pratama',
    phone: '081234567005',
    email: null,
    address: null,
    gender: 'L',
    points: 30,
    deposit: 0,
  },
];
const upsertCust = db.prepare(`
  INSERT INTO customers (kode, name, phone, email, address, gender, points, deposit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(kode) DO UPDATE SET
    name = excluded.name,
    phone = excluded.phone,
    email = excluded.email,
    address = excluded.address,
    gender = excluded.gender,
    points = excluded.points,
    deposit = excluded.deposit
`);
for (const c of customers) {
  upsertCust.run(c.kode, c.name, c.phone, c.email, c.address, c.gender, c.points, c.deposit);
}

// Cash accounts (Majoo "Daftar Buku Kas & Bank" defaults)
const cashAccounts = [
  { kode: '1-10000', tipe: 'header', nama: 'KAS', kategori: 'Kas & Bank' },
  {
    kode: '1-10001',
    tipe: 'detail',
    nama: 'Kas Outlet',
    kategori: 'Kas & Bank',
    saldo_awal: 500000,
  },
  {
    kode: '1-10002',
    tipe: 'detail',
    nama: 'Rekening Bank',
    kategori: 'Kas & Bank',
    saldo_awal: 5000000,
  },
  {
    kode: '1-10003',
    tipe: 'detail',
    nama: 'Kas Kasir Outlet',
    kategori: 'Kas & Bank',
    saldo_awal: 200000,
  },
  { kode: '1-10004', tipe: 'detail', nama: 'Giro', kategori: 'Kas & Bank' },
  { kode: '1-19001', tipe: 'detail', nama: 'Ayat Silang Kas & Bank', kategori: 'Kas & Bank' },
  {
    kode: '1-19002',
    tipe: 'detail',
    nama: 'Ayat Silang Buka / Tutup Kasir',
    kategori: 'Kas & Bank',
  },
];
const upsertAccount = db.prepare(`
  INSERT INTO cash_accounts (kode, tipe, nama, kategori, saldo_awal)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(kode) DO UPDATE SET
    tipe = excluded.tipe,
    nama = excluded.nama,
    kategori = excluded.kategori
`);
for (const a of cashAccounts) {
  upsertAccount.run(a.kode, a.tipe, a.nama, a.kategori, a.saldo_awal || 0);
}

// Sample cash transactions (so the page isn't empty)
const accKas = db.prepare('SELECT id FROM cash_accounts WHERE kode = ?').get('1-10001')?.id;
const accBank = db.prepare('SELECT id FROM cash_accounts WHERE kode = ?').get('1-10002')?.id;
if (accKas && accBank) {
  const sampleTxs = [
    {
      tanggal: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      tipe: 'pemasukan',
      account_id: accKas,
      jumlah: 750000,
      kategori: 'Penjualan',
      keterangan: 'Setoran kas dari penjualan harian',
    },
    {
      tanggal: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
      tipe: 'pengeluaran',
      account_id: accKas,
      jumlah: 150000,
      kategori: 'Belanja Bahan',
      keterangan: 'Beli bahan baku ke pasar',
    },
    {
      tanggal: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
      tipe: 'transfer',
      account_id: accKas,
      account_to_id: accBank,
      jumlah: 500000,
      kategori: 'Setor Bank',
      keterangan: 'Setor sebagian kas ke bank',
    },
    {
      tanggal: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
      tipe: 'pengeluaran',
      account_id: accBank,
      jumlah: 1000000,
      kategori: 'Operasional',
      keterangan: 'Bayar listrik & internet outlet',
    },
  ];
  const insertTx = db.prepare(`
    INSERT INTO cash_transactions (tanggal, tipe, account_id, account_to_id, kategori, jumlah, keterangan, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  // Only insert if no transactions exist yet (idempotent re-seed)
  const txCount = db.prepare('SELECT COUNT(*) as count FROM cash_transactions').get();
  if (txCount.count === 0) {
    for (const t of sampleTxs) {
      insertTx.run(
        t.tanggal,
        t.tipe,
        t.account_id,
        t.account_to_id || null,
        t.kategori,
        t.jumlah,
        t.keterangan
      );
    }
  }
}

console.log('Seed data berhasil ditambahkan!');
console.log(`- ${departments.length} departemen`);
console.log(`- ${categories.length} kategori`);
console.log(`- ${products.length} produk`);
console.log(`- ${customers.length} pelanggan`);
console.log(`- ${cashAccounts.length} akun kas/bank`);
