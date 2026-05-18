// VIPOS — onboarding template seeder unit tests (PR-4).
//
// Pure DI-only tests for the seeder library: no DB, no app, no Postgres.
// Mirrors the dependency-injection pattern used by restore-test.test.mjs.
// HTTP-level integration tests live in onboarding-templates.test.mjs (which
// boots setup-test-db.mjs and hits the real express app).

import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const TEMPLATE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'onboarding-templates'
);

const {
  KNOWN_TEMPLATES,
  isKnownTemplate,
  loadTemplate,
  listTemplates,
  seedTemplate,
} = require('../lib/onboarding-templates');

function makeFakeTxQuery() {
  // Behaves enough like real Postgres for the seeder: tracks
  // INSERT-into-categories (unique on name) and INSERT-into-products
  // (unique on sku) and lets us inspect what got inserted.
  const categories = new Map();
  const products = new Map();
  let nextCatId = 1000;
  let nextProdId = 5000;

  async function txQuery(sql, params) {
    const isCatInsert = /INSERT INTO categories/.test(sql);
    const isProdInsert = /INSERT INTO products/.test(sql);
    const isCatSelect = /^\s*SELECT id FROM categories WHERE name/.test(sql);

    if (isCatInsert) {
      const [name, color, urutan] = params;
      if (categories.has(name)) {
        return { rowCount: 0, rows: [] };
      }
      const id = nextCatId++;
      categories.set(name, { id, color, urutan });
      return { rowCount: 1, rows: [{ id }] };
    }

    if (isProdInsert) {
      const [name, sku, , , , , , , categoryId] = params;
      if (products.has(sku)) {
        return { rowCount: 0, rows: [] };
      }
      const id = nextProdId++;
      products.set(sku, { id, name, sku, category_id: categoryId });
      return { rowCount: 1, rows: [{ id }] };
    }

    if (isCatSelect) {
      const [name] = params;
      const c = categories.get(name);
      return c ? { rowCount: 1, rows: [{ id: c.id }] } : { rowCount: 0, rows: [] };
    }

    throw new Error(`fake txQuery received an unexpected SQL: ${sql.slice(0, 80)}`);
  }

  txQuery.__categories = categories;
  txQuery.__products = products;
  return txQuery;
}

describe('onboarding-templates lib', () => {
  it('exposes the three known template ids', () => {
    expect(KNOWN_TEMPLATES).toEqual(['fnb', 'retail', 'salon']);
    expect(isKnownTemplate('fnb')).toBe(true);
    expect(isKnownTemplate('beverage')).toBe(false);
    expect(isKnownTemplate(null)).toBe(false);
  });

  it('loadTemplate returns parsed json with id matching filename', () => {
    for (const id of KNOWN_TEMPLATES) {
      const data = loadTemplate(id);
      expect(data.id).toBe(id);
      expect(typeof data.name).toBe('string');
      expect(Array.isArray(data.categories)).toBe(true);
      expect(Array.isArray(data.products)).toBe(true);
      expect(data.products.length).toBeGreaterThanOrEqual(8);
      const catNames = new Set(data.categories.map((c) => c.name));
      for (const p of data.products) {
        expect(catNames.has(p.category)).toBe(true);
        expect(typeof p.sku).toBe('string');
        expect(p.sku.length).toBeGreaterThan(0);
        expect(typeof p.name).toBe('string');
        expect(typeof p.price).toBe('number');
        expect(p.price).toBeGreaterThan(0);
      }
    }
  });

  it('loadTemplate throws UNKNOWN_TEMPLATE for unknown id', () => {
    expect(() => loadTemplate('unknown')).toThrowError(/template tidak dikenali/);
  });

  it('listTemplates returns an entry for each preset with preview rows', () => {
    const list = listTemplates({ templateDir: TEMPLATE_DIR });
    expect(list.map((t) => t.id)).toEqual(['fnb', 'retail', 'salon']);
    for (const t of list) {
      expect(typeof t.tagline).toBe('string');
      expect(t.product_count).toBeGreaterThan(0);
      expect(t.category_count).toBeGreaterThan(0);
      expect(Array.isArray(t.preview_products)).toBe(true);
      expect(t.preview_products.length).toBeGreaterThan(0);
      for (const p of t.preview_products) {
        expect(typeof p.name).toBe('string');
        expect(typeof p.price).toBe('number');
      }
    }
  });

  it('seedTemplate inserts categories + products on first run, idempotent on second', async () => {
    const txQuery = makeFakeTxQuery();
    const summary1 = await seedTemplate('fnb', txQuery);
    expect(summary1.template).toBe('fnb');
    expect(summary1.categories.added).toBeGreaterThan(0);
    expect(summary1.products.added).toBeGreaterThanOrEqual(8);
    expect(summary1.products.skipped).toBe(0);

    const summary2 = await seedTemplate('fnb', txQuery);
    expect(summary2.categories.added).toBe(0);
    expect(summary2.products.added).toBe(0);
    expect(summary2.categories.skipped).toBeGreaterThan(0);
    expect(summary2.products.skipped).toBeGreaterThanOrEqual(8);
  });

  it('seedTemplate links each product to its category id', async () => {
    const txQuery = makeFakeTxQuery();
    await seedTemplate('retail', txQuery);
    for (const p of txQuery.__products.values()) {
      expect(p.category_id).toBeTypeOf('number');
    }
  });

  it('seedTemplate refuses unknown template id', async () => {
    const txQuery = makeFakeTxQuery();
    await expect(seedTemplate('mystery', txQuery)).rejects.toThrow(/tidak dikenali/);
  });
});
