// VIPOS — onboarding sample-data seeder (PR-4, pra-beta v0.0.1).
//
// Dependency-injected loader + seeder for the JSON template bundles in
// apps/backend/src/data/onboarding-templates/. Mirrors the DI pattern used
// by jobs/restore-test.js so the seeder is unit-testable without the real
// Postgres pool.
//
// Idempotency: every category INSERT and every product INSERT uses
// `ON CONFLICT (...) DO NOTHING` against the existing
// (tenant_id, name) / (tenant_id, sku) unique constraints. Calling the
// same seeder twice for the same tenant is safe — the second call returns
// added=0 for every row that already exists.

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TEMPLATE_DIR = path.join(__dirname, '..', 'data', 'onboarding-templates');
const KNOWN_TEMPLATES = ['fnb', 'retail', 'salon'];

function isKnownTemplate(id) {
  return typeof id === 'string' && KNOWN_TEMPLATES.includes(id);
}

function loadTemplate(id, { templateDir = DEFAULT_TEMPLATE_DIR } = {}) {
  if (!isKnownTemplate(id)) {
    const err = new Error(`template tidak dikenali. Pilihan: ${KNOWN_TEMPLATES.join(', ')}`);
    err.code = 'UNKNOWN_TEMPLATE';
    throw err;
  }
  const file = path.join(templateDir, `${id}.json`);
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!data || data.id !== id) {
    const err = new Error(`template ${id} tidak konsisten dengan id di file`);
    err.code = 'TEMPLATE_CORRUPT';
    throw err;
  }
  return data;
}

function listTemplates({ templateDir = DEFAULT_TEMPLATE_DIR } = {}) {
  return KNOWN_TEMPLATES.map((id) => {
    const data = loadTemplate(id, { templateDir });
    return {
      id: data.id,
      name: data.name,
      tagline: data.tagline,
      category_count: Array.isArray(data.categories) ? data.categories.length : 0,
      product_count: Array.isArray(data.products) ? data.products.length : 0,
      preview_products: (data.products || []).slice(0, 3).map((p) => ({
        name: p.name,
        price: p.price,
        category: p.category,
      })),
    };
  });
}

// Seed a template into the caller's tenant. The transaction handle
// (`txQuery`) MUST already have the tenant scoped — typically via the
// authenticateToken middleware that sets `app.current_tenant`.
async function seedTemplate(id, txQuery, { templateDir = DEFAULT_TEMPLATE_DIR } = {}) {
  const data = loadTemplate(id, { templateDir });

  let categoriesAdded = 0;
  let categoriesSkipped = 0;
  const categoryByName = new Map();

  for (const cat of data.categories || []) {
    const inserted = await txQuery(
      `INSERT INTO categories (name, color, urutan, is_tampil_di_menu)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tenant_id, name) DO NOTHING
       RETURNING id`,
      [cat.name, cat.color || null, Number.isFinite(cat.urutan) ? cat.urutan : 0]
    );
    if (inserted.rowCount > 0) {
      categoriesAdded += 1;
      categoryByName.set(cat.name, inserted.rows[0].id);
    } else {
      categoriesSkipped += 1;
      const existing = await txQuery(`SELECT id FROM categories WHERE name = $1 LIMIT 1`, [
        cat.name,
      ]);
      if (existing.rows[0]) categoryByName.set(cat.name, existing.rows[0].id);
    }
  }

  let productsAdded = 0;
  let productsSkipped = 0;
  for (const p of data.products || []) {
    const categoryId = categoryByName.get(p.category) ?? null;
    const inserted = await txQuery(
      `INSERT INTO products (
         name, sku, description, satuan,
         price, harga_modal, harga_beli, stock,
         category_id, is_tampil_di_menu, is_favorit,
         monitor_stok, stok_minimum, is_active
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, 1, 0,
         $10, $11, 1
       )
       ON CONFLICT (tenant_id, sku) DO NOTHING
       RETURNING id`,
      [
        p.name,
        p.sku,
        p.description || null,
        p.satuan || 'pcs',
        Number.isFinite(p.price) ? p.price : 0,
        Number.isFinite(p.harga_modal) ? p.harga_modal : 0,
        Number.isFinite(p.harga_beli) ? p.harga_beli : 0,
        Number.isFinite(p.stock) ? p.stock : 0,
        categoryId,
        Number.isFinite(p.monitor_stok) ? p.monitor_stok : 0,
        Number.isFinite(p.stok_minimum) ? p.stok_minimum : 0,
      ]
    );
    if (inserted.rowCount > 0) productsAdded += 1;
    else productsSkipped += 1;
  }

  return {
    template: data.id,
    categories: { added: categoriesAdded, skipped: categoriesSkipped },
    products: { added: productsAdded, skipped: productsSkipped },
  };
}

module.exports = {
  KNOWN_TEMPLATES,
  isKnownTemplate,
  loadTemplate,
  listTemplates,
  seedTemplate,
};
