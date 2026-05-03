const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  StockOpnameCreateSchema,
  StockOpnameUpdateSchema,
  StockOpnameFinalizeSchema,
} = require('@vipos/shared');

const router = express.Router();

function generateKode(db) {
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `OP-${yyyymmdd}-`;
  const last = db
    .prepare(`SELECT kode FROM stock_opname WHERE kode LIKE ? ORDER BY id DESC LIMIT 1`)
    .get(`${prefix}%`);
  let n = 1;
  if (last && last.kode) {
    const tail = parseInt(last.kode.slice(prefix.length), 10);
    if (Number.isFinite(tail)) n = tail + 1;
  }
  return `${prefix}${String(n).padStart(3, '0')}`;
}

function loadOpname(db, id) {
  const opname = db
    .prepare(
      `
      SELECT
        o.*,
        uc.name AS created_by_name,
        uf.name AS finalized_by_name,
        (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id) AS item_count,
        (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id AND oi.qty_fisik IS NOT NULL) AS counted_count,
        (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id AND oi.qty_fisik IS NOT NULL AND oi.qty_fisik <> oi.qty_sistem) AS variance_count
      FROM stock_opname o
      LEFT JOIN users uc ON uc.id = o.created_by
      LEFT JOIN users uf ON uf.id = o.finalized_by
      WHERE o.id = ?
    `
    )
    .get(id);
  if (!opname) return null;
  const items = db
    .prepare(
      `
      SELECT
        oi.*,
        p.name AS product_name,
        p.sku AS product_sku,
        p.satuan AS product_satuan,
        CASE WHEN oi.qty_fisik IS NOT NULL THEN oi.qty_fisik - oi.qty_sistem ELSE NULL END AS selisih
      FROM stock_opname_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.opname_id = ?
      ORDER BY p.name COLLATE NOCASE
    `
    )
    .all(id);
  return { ...opname, items };
}

// GET /api/stock-opname?status=
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { status } = req.query;
    const conditions = [];
    const params = [];
    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `
      SELECT
        o.*,
        uc.name AS created_by_name,
        uf.name AS finalized_by_name,
        (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id) AS item_count,
        (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id AND oi.qty_fisik IS NOT NULL) AS counted_count,
        (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id AND oi.qty_fisik IS NOT NULL AND oi.qty_fisik <> oi.qty_sistem) AS variance_count
      FROM stock_opname o
      LEFT JOIN users uc ON uc.id = o.created_by
      LEFT JOIN users uf ON uf.id = o.finalized_by
      ${where}
      ORDER BY o.tanggal DESC, o.id DESC
    `
      )
      .all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stock-opname
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validate({ body: StockOpnameCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const { tanggal, catatan, product_ids } = req.body;

      // Resolve which products to include.
      let productList;
      if (product_ids && product_ids.length > 0) {
        const placeholders = product_ids.map(() => '?').join(',');
        productList = db
          .prepare(`SELECT id, stock FROM products WHERE id IN (${placeholders}) AND is_active = 1`)
          .all(...product_ids);
      } else {
        productList = db
          .prepare(
            `SELECT id, stock FROM products WHERE is_active = 1 AND monitor_stok = 1 ORDER BY name COLLATE NOCASE`
          )
          .all();
      }

      if (productList.length === 0) {
        return res.status(400).json({
          error:
            'Tidak ada produk yang dapat di-opname (aktifkan monitor_stok dulu, atau berikan product_ids).',
        });
      }

      const trx = db.transaction(() => {
        const kode = generateKode(db);
        const result = db
          .prepare(
            `INSERT INTO stock_opname (kode, tanggal, status, catatan, created_by) VALUES (?, ?, 'draft', ?, ?)`
          )
          .run(
            kode,
            tanggal || new Date().toISOString().slice(0, 10),
            catatan ? catatan.trim() : null,
            req.user.id
          );
        const opnameId = result.lastInsertRowid;

        const insertItem = db.prepare(
          `INSERT INTO stock_opname_items (opname_id, product_id, qty_sistem, qty_fisik) VALUES (?, ?, ?, NULL)`
        );
        for (const p of productList) {
          insertItem.run(opnameId, p.id, p.stock || 0);
        }
        return opnameId;
      });

      const opnameId = trx();
      res.status(201).json(loadOpname(db, opnameId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/stock-opname/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const opname = loadOpname(db, req.params.id);
    if (!opname) return res.status(404).json({ error: 'Opname tidak ditemukan' });
    res.json(opname);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/stock-opname/:id - update qty_fisik per item (only when draft)
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: StockOpnameUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const opname = db.prepare('SELECT id, status FROM stock_opname WHERE id = ?').get(id);
      if (!opname) return res.status(404).json({ error: 'Opname tidak ditemukan' });
      if (opname.status !== 'draft')
        return res.status(400).json({ error: 'Opname hanya bisa diubah saat status draft' });

      const { catatan, items } = req.body;
      const trx = db.transaction(() => {
        if (catatan !== undefined) {
          db.prepare(
            `UPDATE stock_opname SET catatan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
          ).run(catatan == null ? null : catatan.trim(), id);
        }
        if (items && items.length > 0) {
          const upsert = db.prepare(
            `UPDATE stock_opname_items SET qty_fisik = ?, catatan = ? WHERE opname_id = ? AND product_id = ?`
          );
          for (const it of items) {
            upsert.run(
              it.qty_fisik == null ? null : it.qty_fisik,
              it.catatan ? it.catatan.trim() : null,
              id,
              it.product_id
            );
          }
        }
      });
      trx();
      res.json(loadOpname(db, id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/stock-opname/:id/finalize - lock + post movements
router.post(
  '/:id/finalize',
  authenticateToken,
  requireAdmin,
  validate({ body: StockOpnameFinalizeSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const id = parseInt(req.params.id, 10);
      const opname = db.prepare('SELECT * FROM stock_opname WHERE id = ?').get(id);
      if (!opname) return res.status(404).json({ error: 'Opname tidak ditemukan' });
      if (opname.status !== 'draft')
        return res.status(400).json({ error: `Opname sudah ${opname.status}` });

      const items = db
        .prepare(`SELECT * FROM stock_opname_items WHERE opname_id = ? AND qty_fisik IS NOT NULL`)
        .all(id);
      if (items.length === 0)
        return res.status(400).json({ error: 'Belum ada item yang dihitung (qty_fisik kosong)' });

      const trx = db.transaction(() => {
        const insertMov = db.prepare(`
          INSERT INTO inventory_movements
            (tanggal, product_id, tipe, qty, stok_sebelum, stok_sesudah, keterangan, user_id, ref_type, ref_id)
          VALUES (?, ?, 'opname', ?, ?, ?, ?, ?, 'stock_opname', ?)
        `);
        const updateStock = db.prepare(
          `UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        );

        const tanggal = opname.tanggal || new Date().toISOString().slice(0, 10);
        let postedCount = 0;
        for (const it of items) {
          const stokSebelum = it.qty_sistem;
          const stokSesudah = it.qty_fisik;
          if (stokSebelum === stokSesudah) continue;
          insertMov.run(
            tanggal,
            it.product_id,
            stokSesudah,
            stokSebelum,
            stokSesudah,
            `Opname ${opname.kode}`,
            req.user.id,
            id
          );
          updateStock.run(stokSesudah, it.product_id);
          postedCount++;
        }

        db.prepare(
          `UPDATE stock_opname SET status = 'final', finalized_by = ?, finalized_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(req.user.id, id);
        return postedCount;
      });

      trx();
      res.json(loadOpname(db, id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/stock-opname/:id - cancel draft
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const opname = db.prepare('SELECT id, status FROM stock_opname WHERE id = ?').get(id);
    if (!opname) return res.status(404).json({ error: 'Tidak ditemukan' });
    if (opname.status === 'final')
      return res.status(400).json({ error: 'Opname final tidak bisa dihapus' });
    db.prepare(`DELETE FROM stock_opname WHERE id = ?`).run(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
