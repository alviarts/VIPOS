const { getDb, initDatabase } = require('../models/database');

initDatabase();
const db = getDb();

// Seed categories
const categories = [
  { name: 'Makanan', description: 'Aneka makanan dan snack' },
  { name: 'Minuman', description: 'Aneka minuman dingin dan panas' },
  { name: 'Dessert', description: 'Aneka dessert dan kue' },
  { name: 'Paket', description: 'Paket hemat dan bundling' },
  { name: 'Lainnya', description: 'Produk lainnya' }
];

const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)');
for (const cat of categories) {
  insertCategory.run(cat.name, cat.description);
}

// Seed products
const products = [
  { name: 'Nasi Goreng Spesial', sku: 'MKN001', price: 25000, stock: 100, category: 'Makanan' },
  { name: 'Mie Goreng', sku: 'MKN002', price: 20000, stock: 100, category: 'Makanan' },
  { name: 'Ayam Goreng', sku: 'MKN003', price: 22000, stock: 50, category: 'Makanan' },
  { name: 'Ayam Bakar', sku: 'MKN004', price: 28000, stock: 50, category: 'Makanan' },
  { name: 'Sate Ayam (10 tusuk)', sku: 'MKN005', price: 30000, stock: 40, category: 'Makanan' },
  { name: 'Nasi Putih', sku: 'MKN006', price: 5000, stock: 200, category: 'Makanan' },
  { name: 'Kentang Goreng', sku: 'MKN007', price: 15000, stock: 80, category: 'Makanan' },
  { name: 'Burger Classic', sku: 'MKN008', price: 25000, stock: 60, category: 'Makanan' },
  { name: 'Es Teh Manis', sku: 'MNM001', price: 5000, stock: 200, category: 'Minuman' },
  { name: 'Es Jeruk', sku: 'MNM002', price: 8000, stock: 150, category: 'Minuman' },
  { name: 'Kopi Hitam', sku: 'MNM003', price: 10000, stock: 100, category: 'Minuman' },
  { name: 'Cappuccino', sku: 'MNM004', price: 18000, stock: 80, category: 'Minuman' },
  { name: 'Latte', sku: 'MNM005', price: 20000, stock: 80, category: 'Minuman' },
  { name: 'Jus Alpukat', sku: 'MNM006', price: 15000, stock: 60, category: 'Minuman' },
  { name: 'Air Mineral', sku: 'MNM007', price: 4000, stock: 300, category: 'Minuman' },
  { name: 'Teh Tarik', sku: 'MNM008', price: 12000, stock: 100, category: 'Minuman' },
  { name: 'Pudding Coklat', sku: 'DSR001', price: 12000, stock: 40, category: 'Dessert' },
  { name: 'Es Krim Vanilla', sku: 'DSR002', price: 10000, stock: 50, category: 'Dessert' },
  { name: 'Brownies', sku: 'DSR003', price: 15000, stock: 30, category: 'Dessert' },
  { name: 'Paket Nasi + Ayam + Teh', sku: 'PKT001', price: 30000, stock: 100, category: 'Paket' },
  { name: 'Paket Burger + Kentang + Minum', sku: 'PKT002', price: 40000, stock: 80, category: 'Paket' },
];

const getCategoryId = db.prepare('SELECT id FROM categories WHERE name = ?');
const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (name, sku, price, stock, category_id)
  VALUES (?, ?, ?, ?, ?)
`);

for (const prod of products) {
  const cat = getCategoryId.get(prod.category);
  insertProduct.run(prod.name, prod.sku, prod.price, prod.stock, cat ? cat.id : null);
}

console.log('Seed data berhasil ditambahkan!');
console.log(`- ${categories.length} kategori`);
console.log(`- ${products.length} produk`);
