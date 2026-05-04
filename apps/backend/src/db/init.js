/**
 * Postgres database initialization & seeding (P2-01b finalstep).
 *
 * Replaces the legacy `models/database.js` bootstrap. Assumes the target
 * Postgres database already has the Prisma migration applied (run
 * `npx prisma migrate deploy` against DATABASE_URL before booting in
 * production; tests apply it via `setup-test-db.mjs`).
 *
 * This module:
 *   - Seeds the default admin user (admin / admin123)
 *   - Seeds the default Indonesian SAK ETAP Chart of Accounts (43 entries)
 *   - Seeds default outlet, tax rates, payment methods, UoMs
 *   - Seeds default Lainnya content (help topics, articles, events, etc.)
 *
 * All seeding is idempotent — uses COUNT(*) checks before inserting.
 */

const bcrypt = require('bcryptjs');
const { query, tx } = require('./index');

const DEFAULT_TENANT_ID = 1;

async function seedDefaultTenant() {
  // The Prisma migration `add_multi_tenant_foundation` already inserts the
  // default tenant (id=1) on schema apply. This is a safety net for installs
  // where the tenants table got truncated (e.g. test resets).
  const exists = (await query('SELECT id FROM tenants WHERE id = $1', [DEFAULT_TENANT_ID])).rows[0];
  if (exists) return;
  await query(
    `INSERT INTO tenants (id, slug, name, tier, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [DEFAULT_TENANT_ID, 'default', 'Default Tenant', 'advance', 'active']
  );
  await query(
    `SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST(1, (SELECT MAX(id) FROM tenants)), true)`
  );
}

async function seedDefaultAdmin() {
  const adminExists = (await query('SELECT id FROM users WHERE username = $1', ['admin'])).rows[0];
  if (adminExists) return;
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  const inserted = await query(
    `INSERT INTO users (username, password, name, role, tenant_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    ['admin', hashedPassword, 'Administrator', 'admin', DEFAULT_TENANT_ID]
  );
  const userId = inserted.rows[0].id;
  await query(
    `INSERT INTO tenant_users (tenant_id, user_id, role, is_default)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (tenant_id, user_id) DO NOTHING`,
    [DEFAULT_TENANT_ID, userId, 'admin']
  );
  console.log('Default admin user created (admin / admin123)');
}

async function seedDefaultChartOfAccounts() {
  const existing = (await query('SELECT COUNT(*)::int AS n FROM gl_accounts')).rows[0];
  if (existing && Number(existing.n) > 0) return;

  const NB = {
    ASET: 'debit',
    KEWAJIBAN: 'credit',
    MODAL: 'credit',
    PENDAPATAN: 'credit',
    BEBAN: 'debit',
  };
  const seedRows = [
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
    { code: '2000', name: 'Kewajiban', type: 'KEWAJIBAN', subtype: 'header' },
    { code: '2101', name: 'Hutang Usaha', type: 'KEWAJIBAN', subtype: 'Kewajiban Lancar' },
    { code: '2102', name: 'Hutang Pajak', type: 'KEWAJIBAN', subtype: 'Kewajiban Lancar' },
    { code: '2103', name: 'Hutang Gaji', type: 'KEWAJIBAN', subtype: 'Kewajiban Lancar' },
    {
      code: '2201',
      name: 'Hutang Bank',
      type: 'KEWAJIBAN',
      subtype: 'Kewajiban Jangka Panjang',
    },
    { code: '3000', name: 'Modal', type: 'MODAL', subtype: 'header' },
    { code: '3101', name: 'Modal Disetor', type: 'MODAL', subtype: 'Modal' },
    { code: '3201', name: 'Laba Ditahan', type: 'MODAL', subtype: 'Modal' },
    { code: '3301', name: 'Laba Tahun Berjalan', type: 'MODAL', subtype: 'Modal' },
    { code: '4000', name: 'Pendapatan', type: 'PENDAPATAN', subtype: 'header' },
    { code: '4101', name: 'Penjualan', type: 'PENDAPATAN', subtype: 'Penjualan' },
    { code: '4102', name: 'Pendapatan Jasa', type: 'PENDAPATAN', subtype: 'Penjualan' },
    { code: '4103', name: 'Pendapatan Lain', type: 'PENDAPATAN', subtype: 'Pendapatan Lain' },
    { code: '4910', name: 'Laba Pelepasan Aset', type: 'PENDAPATAN', subtype: 'Pendapatan Lain' },
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
  await tx(async (txQuery) => {
    for (const row of seedRows) {
      await txQuery(
        `INSERT INTO gl_accounts (code, name, type, subtype, normal_balance, is_active)
         VALUES ($1, $2, $3, $4, $5, 1)`,
        [row.code, row.name, row.type, row.subtype, NB[row.type]]
      );
    }
  });
  console.log(`Seeded ${seedRows.length} default Chart of Accounts entries`);
}

async function seedDefaultSettings() {
  const outletCount = (await query('SELECT COUNT(*)::int AS n FROM outlets')).rows[0];
  if (!outletCount || Number(outletCount.n) === 0) {
    await query(
      `INSERT INTO outlets (code, name, type, address, city, timezone, currency, is_main, is_active)
       VALUES ('OUT-001', 'Outlet Pusat', 'restaurant', '-', 'Jakarta', 'Asia/Jakarta', 'IDR', 1, 1)`
    );
  }

  const taxCount = (await query('SELECT COUNT(*)::int AS n FROM tax_rates')).rows[0];
  if (!taxCount || Number(taxCount.n) === 0) {
    const rates = [
      ['PPN', 'PPN 11%', 11, 0],
      ['SVC', 'Service Charge 5%', 5, 0],
      ['PB1', 'Pajak Restoran (PB1) 10%', 10, 0],
    ];
    for (const r of rates) {
      await query(
        `INSERT INTO tax_rates (code, name, rate, is_inclusive, is_active) VALUES ($1, $2, $3, $4, 1)`,
        r
      );
    }
  }

  const pmCount = (await query('SELECT COUNT(*)::int AS n FROM payment_methods')).rows[0];
  if (!pmCount || Number(pmCount.n) === 0) {
    const pms = [
      ['CASH', 'Tunai', 'cash', 0, 1],
      ['QRIS', 'QRIS', 'qris', 0.7, 2],
      ['DEBIT', 'Kartu Debit', 'debit', 0, 3],
      ['CREDIT', 'Kartu Kredit', 'credit', 2.5, 4],
      ['GOPAY', 'GoPay', 'ewallet', 1.5, 5],
      ['OVO', 'OVO', 'ewallet', 1.5, 6],
      ['TF-BCA', 'Transfer BCA', 'transfer', 0, 7],
    ];
    for (const p of pms) {
      await query(
        `INSERT INTO payment_methods (code, name, type, fee_percent, is_active, sort_order)
         VALUES ($1, $2, $3, $4, 1, $5)`,
        p
      );
    }
  }

  const uomCount = (await query('SELECT COUNT(*)::int AS n FROM uoms')).rows[0];
  if (!uomCount || Number(uomCount.n) === 0) {
    const uoms = [
      ['PCS', 'Pieces', 'pcs'],
      ['KG', 'Kilogram', 'kg'],
      ['GR', 'Gram', 'g'],
      ['LT', 'Liter', 'L'],
      ['ML', 'Mililiter', 'ml'],
      ['PACK', 'Pack', 'pak'],
      ['BOX', 'Box', 'box'],
      ['PORSI', 'Porsi', 'porsi'],
    ];
    for (const u of uoms) {
      await query(
        `INSERT INTO uoms (code, name, symbol, conversion_factor, is_active) VALUES ($1, $2, $3, 1, 1)`,
        u
      );
    }
  }
}

async function seedDefaultLainnya() {
  const helpCount = (await query('SELECT COUNT(*)::int AS n FROM help_topics')).rows[0];
  if (!helpCount || Number(helpCount.n) === 0) {
    const topics = [
      [
        'memulai-vipos',
        'Memulai VIPOS',
        'Onboarding',
        'Panduan setup awal VIPOS untuk outlet baru.',
        '# Memulai\n\nLogin → buka pengaturan outlet → tambah produk → mulai transaksi.',
        1,
      ],
      [
        'transaksi-kasir',
        'Transaksi di Kasir',
        'POS',
        'Cara melakukan transaksi penjualan di menu Kasir.',
        '# Kasir\n\nBuka menu Kasir, pilih produk, klik Bayar, pilih metode, cetak struk.',
        2,
      ],
      [
        'kelola-produk',
        'Mengelola Produk',
        'Master Data',
        'Tambah, edit, dan kelola katalog produk.',
        '# Produk\n\nMenu Produk → tambah → isi nama, harga, stok awal.',
        3,
      ],
      [
        'inventory-stok',
        'Cek Stok & Stock Opname',
        'Inventory',
        'Pantau stok dan lakukan stock opname berkala.',
        '# Stock Opname\n\nMenu Inventory → Opname → buat sesi → input fisik → submit.',
        4,
      ],
      [
        'laporan-harian',
        'Membaca Laporan Harian',
        'Reports',
        'Memahami laporan ringkasan harian, top produk, payment method.',
        '# Laporan\n\nMenu Laporan → pilih kategori → atur tanggal → export.',
        5,
      ],
      [
        'integrasi-payment',
        'Integrasi Payment Gateway',
        'Pembayaran',
        'Aktifkan QRIS, debit, kredit di outlet Anda.',
        '# Payment Gateway\n\nMenu Pengaturan → Payment → aktifkan QRIS / EDC → ikuti onboarding Majoopay.',
        6,
      ],
      [
        'kelola-karyawan',
        'Mengelola Karyawan & Absensi',
        'Karyawan',
        'Tambah karyawan, atur shift, dan tracking absensi.',
        '# Karyawan\n\nMenu Karyawan → tambah karyawan → set role → atur shift mingguan.',
        7,
      ],
      [
        'promo-loyalty',
        'Promo, Voucher & Loyalty',
        'Marketing',
        'Buat promo, voucher, dan program loyalty.',
        '# Marketing\n\nMenu Penjualan → Promo / Voucher / Loyalty → buat baru.',
        8,
      ],
      [
        'backup-data',
        'Backup & Restore Data',
        'Maintenance',
        'Cara backup database VIPOS dan restore.',
        '# Backup\n\nMenu Pengaturan → Import/Export → Export Database.',
        9,
      ],
      [
        'hubungi-support',
        'Hubungi Customer Support',
        'Bantuan',
        'Channel resmi support VIPOS (24/7).',
        '# Support\n\nWA: 0811-XXXX, Email: support@vipos.id, atau form Masukan Perbaikan.',
        10,
      ],
    ];
    for (const t of topics) {
      await query(
        `INSERT INTO help_topics (slug, title, category, excerpt, content, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        t
      );
    }
  }

  const articleCount = (await query('SELECT COUNT(*)::int AS n FROM inspirasi_articles')).rows[0];
  if (!articleCount || Number(articleCount.n) === 0) {
    const articles = [
      [
        'tren-fnb-2025',
        'tren-bisnis',
        '5 Tren F&B 2025 yang Wajib Diketahui Pemilik Resto',
        'Premium ingredients, plant-based, fast-casual experience, dan AI-driven menu.',
        '# Tren F&B 2025\n\n1. Premium ingredients\n2. Plant-based menu\n3. Fast-casual experience\n4. AI menu personalization\n5. Sustainability',
        'Tim majoo',
        5,
      ],
      [
        'kisah-warung-soto',
        'kisah-sukses',
        'Dari Warung Kaki Lima ke 5 Cabang: Cerita Soto Pak Karim',
        'Pak Karim membagikan kunci sukses ekspansi dari satu warung jadi 5 outlet.',
        '# Soto Pak Karim\n\nMulai dari modal 5 juta, sekarang punya 5 outlet di Jabodetabek...',
        'Tim majoo',
        8,
      ],
      [
        'tips-kelola-cashflow',
        'tips',
        '7 Tips Kelola Cashflow Resto biar Tidak Boncos',
        'Strategi mengelola arus kas resto: separate akun, pencatatan harian, kontrol HPP.',
        '# Cashflow\n\nPisahkan rekening bisnis dan pribadi. Catat setiap transaksi. Review mingguan.',
        'Tim majoo',
        6,
      ],
      [
        'inspirasi-branding-coffee',
        'inspirasi',
        'Branding Coffee Shop yang Menggugah: Belajar dari 3 Brand Lokal',
        'Studi kasus branding 3 coffee shop lokal yang berhasil menarik gen Z.',
        '# Branding Kopi\n\nKopi Kenangan, Tuku, Janji Jiwa: 3 brand kopi lokal yang berhasil...',
        'Tim majoo',
        7,
      ],
      [
        'edukasi-pajak-resto',
        'edukasi',
        'PB1, PPN, PPh: Pajak Resto yang Wajib Dipahami',
        'Penjelasan lengkap tentang pajak yang harus dibayar pemilik resto di Indonesia.',
        '# Pajak Resto\n\nPB1 (10%), Service Charge, PPN, PPh21 karyawan...',
        'Tim majoo',
        10,
      ],
      [
        'trivia-makanan-indonesia',
        'trivia',
        'Tahukah Kamu? 10 Fakta Unik Kuliner Indonesia',
        'Fakta menarik kuliner nusantara yang jarang diketahui.',
        '# Trivia\n\nIndonesia punya 5000+ jenis kerupuk. Rendang berasal dari Padang...',
        'Tim majoo',
        4,
      ],
      [
        'berbagi-program-csr',
        'berbagi',
        'Program CSR Sederhana untuk UMKM F&B',
        'Ide CSR yang reasonable untuk UMKM F&B: dari makan gratis sampai cooking class.',
        '# CSR UMKM\n\nFree meal Jumat berkah, cooking class anak yatim, donate makanan sisa...',
        'Tim majoo',
        5,
      ],
      [
        'informasi-update-v3',
        'home',
        'majoo Update v3.0: Apa yang Baru?',
        'Versi 3.0 hadir dengan dashboard baru, AI insights, dan lebih banyak laporan.',
        '# v3.0\n\nDashboard baru, AI insights, 30+ laporan, schedule report Prime+.',
        'Tim majoo',
        3,
      ],
    ];
    for (const a of articles) {
      await query(
        `INSERT INTO inspirasi_articles (slug, category, title, excerpt, content, author, reading_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        a
      );
    }
  }

  const eventCount = (await query('SELECT COUNT(*)::int AS n FROM inspirasi_events')).rows[0];
  if (!eventCount || Number(eventCount.n) === 0) {
    const today = new Date();
    const future = (days) =>
      new Date(today.getTime() + days * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
    const events = [
      [
        'workshop-pos-jakarta',
        'Workshop: Optimasi POS untuk F&B',
        'Belajar best practice setup POS, menu engineering, dan analytics dasar dari mentor majoo.',
        'majoo HQ, Jakarta Selatan',
        future(14),
        40,
      ],
      [
        'webinar-marketing-digital',
        'Webinar: Marketing Digital untuk UMKM',
        'Strategi marketing digital low-budget tinggi impact untuk pemilik UMKM.',
        'Online (Zoom)',
        future(7),
        200,
      ],
      [
        'meetup-preneur-bandung',
        'Meetup majoo Preneur Bandung',
        'Networking bareng pemilik bisnis F&B dan retail di Bandung.',
        'Cafe Lokal, Bandung',
        future(21),
        60,
      ],
    ];
    for (const e of events) {
      await query(
        `INSERT INTO inspirasi_events (slug, title, description, location, event_date, capacity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        e
      );
    }
  }

  const magazineCount = (await query('SELECT COUNT(*)::int AS n FROM inspirasi_magazines')).rows[0];
  if (!magazineCount || Number(magazineCount.n) === 0) {
    const magazines = [
      [
        2025,
        1,
        'majoo Preneur — Edisi Januari 2025',
        '/static/magazines/2025-01.pdf',
        '/static/magazines/2025-01-cover.jpg',
      ],
      [
        2025,
        2,
        'majoo Preneur — Edisi Februari 2025',
        '/static/magazines/2025-02.pdf',
        '/static/magazines/2025-02-cover.jpg',
      ],
      [
        2025,
        3,
        'majoo Preneur — Edisi Maret 2025',
        '/static/magazines/2025-03.pdf',
        '/static/magazines/2025-03-cover.jpg',
      ],
    ];
    for (const m of magazines) {
      await query(
        `INSERT INTO inspirasi_magazines (year, month, title, pdf_url, cover_url)
         VALUES ($1, $2, $3, $4, $5)`,
        m
      );
    }
  }

  const updateCount = (await query('SELECT COUNT(*)::int AS n FROM informasi_updates')).rows[0];
  if (!updateCount || Number(updateCount.n) === 0) {
    const updates = [
      [
        '3.0.0',
        'VIPOS v3.0 — Reports & Schedule',
        'Tambahan 30+ laporan baru, scheduled reports (Prime+), dan integrasi penuh marketplace supplies.',
        '2025-04-01',
      ],
      [
        '2.5.0',
        'VIPOS v2.5 — Multi-Outlet',
        'Dukungan multi-outlet penuh, transfer stock antar outlet, dan konsolidasi laporan.',
        '2025-02-15',
      ],
      [
        '2.0.0',
        'VIPOS v2.0 — Akuntansi Lengkap',
        'Chart of Accounts, jurnal manual, laporan keuangan SAK ETAP.',
        '2025-01-01',
      ],
    ];
    for (const u of updates) {
      await query(
        `INSERT INTO informasi_updates (version, title, body, published_at) VALUES ($1, $2, $3, $4)`,
        u
      );
    }
  }

  const supCatCount = (await query('SELECT COUNT(*)::int AS n FROM supplies_categories')).rows[0];
  if (!supCatCount || Number(supCatCount.n) === 0) {
    const cats = [
      ['bahan-baku-fnb', 'Bahan Baku F&B', 1],
      ['kemasan', 'Kemasan & Packaging', 2],
      ['cleaning', 'Cleaning Supplies', 3],
      ['office-supplies', 'Office Supplies', 4],
      ['equipment', 'Equipment', 5],
    ];
    for (const c of cats) {
      await query(
        `INSERT INTO supplies_categories (slug, name, sort_order) VALUES ($1, $2, $3)`,
        c
      );
    }
  }

  const supProdCount = (await query('SELECT COUNT(*)::int AS n FROM supplies_products')).rows[0];
  if (!supProdCount || Number(supProdCount.n) === 0) {
    const cats = (await query('SELECT id, slug FROM supplies_categories')).rows;
    const catBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
    const products = [
      [
        'BAHAN-001',
        'Beras Premium 25kg',
        'Beras kualitas premium pilihan untuk warteg/resto.',
        null,
        350000,
        1,
        'in_stock',
        'PT Beras Sejahtera',
        catBySlug['bahan-baku-fnb'],
      ],
      [
        'BAHAN-002',
        'Minyak Goreng 18L',
        'Minyak goreng kemasan jerigen 18L.',
        null,
        270000,
        1,
        'in_stock',
        'CV Minyak Nusantara',
        catBySlug['bahan-baku-fnb'],
      ],
      [
        'BAHAN-003',
        'Gula Pasir 50kg',
        'Gula pasir premium 50kg.',
        null,
        700000,
        1,
        'low',
        'PT Gula Murni',
        catBySlug['bahan-baku-fnb'],
      ],
      [
        'KEMAS-001',
        'Box Makanan Kraft 750ml (50pcs)',
        'Box kemasan ramah lingkungan untuk takeaway.',
        null,
        75000,
        5,
        'in_stock',
        'Eco Pack',
        catBySlug['kemasan'],
      ],
      [
        'KEMAS-002',
        'Plastik Wrap 30cm x 300m',
        'Plastik wrap untuk packaging makanan.',
        null,
        90000,
        1,
        'in_stock',
        'Eco Pack',
        catBySlug['kemasan'],
      ],
      [
        'CLEAN-001',
        'Sabun Cuci Piring 5L',
        'Sabun cuci piring food-grade.',
        null,
        65000,
        2,
        'in_stock',
        'Bersih Jaya',
        catBySlug['cleaning'],
      ],
      [
        'CLEAN-002',
        'Tisu Toilet 12 roll',
        'Tisu toilet berkualitas ekonomis.',
        null,
        45000,
        5,
        'in_stock',
        'Bersih Jaya',
        catBySlug['cleaning'],
      ],
      [
        'OFFICE-001',
        'Roll Thermal Printer 80mm (50pcs)',
        'Kertas struk thermal 80mm.',
        null,
        250000,
        1,
        'in_stock',
        'Office Supply Co',
        catBySlug['office-supplies'],
      ],
      [
        'OFFICE-002',
        'Tinta Printer Hitam 100ml',
        'Tinta refill hitam.',
        null,
        35000,
        1,
        'in_stock',
        'Office Supply Co',
        catBySlug['office-supplies'],
      ],
      [
        'EQUIP-001',
        'Blender Industrial 3L',
        'Blender heavy-duty untuk dapur resto.',
        null,
        1850000,
        1,
        'in_stock',
        'Kitchen Pro',
        catBySlug['equipment'],
      ],
      [
        'EQUIP-002',
        'Rice Cooker 10L',
        'Rice cooker komersial 10L.',
        null,
        1200000,
        1,
        'low',
        'Kitchen Pro',
        catBySlug['equipment'],
      ],
      [
        'EQUIP-003',
        'Wajan Anti Lengket 32cm',
        'Wajan keramik anti lengket profesional.',
        null,
        220000,
        1,
        'in_stock',
        'Kitchen Pro',
        catBySlug['equipment'],
      ],
    ];
    for (const p of products) {
      await query(
        `INSERT INTO supplies_products (sku, name, description, image_url, price, moq, stock_status, supplier_name, category_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        p
      );
    }
  }
}

/**
 * Initialize the database. Idempotent — safe to call on every boot.
 * Assumes Prisma migrations are already applied (run `prisma migrate deploy`
 * in CI / startup script before booting the backend).
 */
async function initDatabase() {
  await seedDefaultTenant();
  await seedDefaultAdmin();
  await seedDefaultChartOfAccounts();
  await seedDefaultSettings();
  await seedDefaultLainnya();
  console.log('Database initialized successfully');
}

module.exports = { initDatabase, DEFAULT_TENANT_ID };
