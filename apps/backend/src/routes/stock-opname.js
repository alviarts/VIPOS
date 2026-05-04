const express = require('express');
const { query, tx } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  StockOpnameCreateSchema,
  StockOpnameUpdateSchema,
  StockOpnameFinalizeSchema,
} = require('@vipos/shared');

const router = express.Router();

async function generateKode(q) {
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `OP-${yyyymmdd}-`;
  const last = (
    await q(`SELECT kode FROM stock_opname WHERE kode LIKE $1 ORDER BY id DESC LIMIT 1`, [
      `${prefix}%`,
    ])
  ).rows[0];
  let n = 1;
  if (last && last.kode) {
    const tail = parseInt(last.kode.slice(prefix.length), 10);
    if (Number.isFinite(tail)) n = tail + 1;
  }
  return `${prefix}${String(n).padStart(3, '0')}`;
}

async function loadOpname(q, id) {
  const opname = (
    await q(
      `SELECT
         o.*,
         uc.name AS created_by_name,
         uf.name AS finalized_by_name,
         (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id) AS item_count,
         (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id AND oi.qty_fisik IS NOT NULL) AS counted_count,
         (SELECT COUNT(*) FROM stock_opname_items oi WHERE oi.opname_id = o.id AND oi.qty_fisik IS NOT NULL AND oi.qty_fisik <> oi.qty_sistem) AS variance_count
       FROM stock_opname o
       LEFT JOIN users uc ON uc.id = o.created_by
       LEFT JOIN users uf ON uf.id = o.finalized_by
       WHERE o.id = $1`,
      [id]
    )
  ).rows[0];
  if (!opname) return null;
  const items = (
    await q(
      `SELECT
         oi.*,
         p.name AS product_name,
         p.sku AS product_sku,
         p.satuan AS product_satuan,
         CASE WHEN oi.qty_fisik IS NOT NULL THEN oi.qty_fisik - oi.qty_sistem ELSE NULL END AS selisih
       FROM stock_opname_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.opname_id = $1
       ORDER BY LOWER(p.name)`,
      [id]
    )
  ).rows;
  return { ...opname, items };
}

// GET /api/stock-opname?status=
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;
    if (status) {
      conditions.push(`o.status = $${p++}`);
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT
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
         ORDER BY o.tanggal DESC, o.id DESC`,
        params
      )
    ).rows;
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
  async (req, res) => {
    try {
      const { tanggal, catatan, product_ids } = req.body;

      // Resolve which products to include.
      let productList;
      if (product_ids && product_ids.length > 0) {
        const placeholders = product_ids.map((_, i) => `$${i + 1}`).join(',');
        productList = (
          await query(
            `SELECT id, stock FROM products WHERE id IN (${placeholders}) AND is_active = 1`,
            product_ids
          )
        ).rows;
      } else {
        productList = (
          await query(
            `SELECT id, stock FROM products WHERE is_active = 1 AND monitor_stok = 1 ORDER BY LOWER(name)`
          )
        ).rows;
      }

      if (productList.length === 0) {
        return res.status(400).json({
          error:
            'Tidak ada produk yang dapat di-opname (aktifkan monitor_stok dulu, atau berikan product_ids).',
        });
      }

      const opnameId = await tx(async (txQuery) => {
        const kode = await generateKode(txQuery);
        const ins = await txQuery(
          `INSERT INTO stock_opname (kode, tanggal, status, catatan, created_by) VALUES ($1, $2, 'draft', $3, $4) RETURNING id`,
          [
            kode,
            tanggal || new Date().toISOString().slice(0, 10),
            catatan ? catatan.trim() : null,
            req.user.id,
          ]
        );
        const newId = ins.rows[0].id;

        for (const p of productList) {
          await txQuery(
            `INSERT INTO stock_opname_items (opname_id, product_id, qty_sistem, qty_fisik) VALUES ($1, $2, $3, NULL)`,
            [newId, p.id, p.stock || 0]
          );
        }
        return newId;
      });

      res.status(201).json(await loadOpname(query, opnameId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/stock-opname/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const opname = await loadOpname(query, req.params.id);
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const opname = (await query('SELECT id, status FROM stock_opname WHERE id = $1', [id]))
        .rows[0];
      if (!opname) return res.status(404).json({ error: 'Opname tidak ditemukan' });
      if (opname.status !== 'draft')
        return res.status(400).json({ error: 'Opname hanya bisa diubah saat status draft' });

      const { catatan, items } = req.body;
      await tx(async (txQuery) => {
        if (catatan !== undefined) {
          await txQuery(
            `UPDATE stock_opname SET catatan = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [catatan == null ? null : catatan.trim(), id]
          );
        }
        if (items && items.length > 0) {
          for (const it of items) {
            await txQuery(
              `UPDATE stock_opname_items SET qty_fisik = $1, catatan = $2 WHERE opname_id = $3 AND product_id = $4`,
              [
                it.qty_fisik == null ? null : it.qty_fisik,
                it.catatan ? it.catatan.trim() : null,
                id,
                it.product_id,
              ]
            );
          }
        }
      });
      res.json(await loadOpname(query, id));
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
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const opname = (await query('SELECT * FROM stock_opname WHERE id = $1', [id])).rows[0];
      if (!opname) return res.status(404).json({ error: 'Opname tidak ditemukan' });
      if (opname.status !== 'draft')
        return res.status(400).json({ error: `Opname sudah ${opname.status}` });

      const items = (
        await query(
          `SELECT * FROM stock_opname_items WHERE opname_id = $1 AND qty_fisik IS NOT NULL`,
          [id]
        )
      ).rows;
      if (items.length === 0)
        return res.status(400).json({ error: 'Belum ada item yang dihitung (qty_fisik kosong)' });

      await tx(async (txQuery) => {
        const tanggal = opname.tanggal || new Date().toISOString().slice(0, 10);
        for (const it of items) {
          const stokSebelum = it.qty_sistem;
          const stokSesudah = it.qty_fisik;
          if (stokSebelum === stokSesudah) continue;
          await txQuery(
            `INSERT INTO inventory_movements
               (tanggal, product_id, tipe, qty, stok_sebelum, stok_sesudah, keterangan, user_id, ref_type, ref_id)
             VALUES ($1, $2, 'opname', $3, $4, $5, $6, $7, 'stock_opname', $8)`,
            [
              tanggal,
              it.product_id,
              stokSesudah,
              stokSebelum,
              stokSesudah,
              `Opname ${opname.kode}`,
              req.user.id,
              id,
            ]
          );
          await txQuery(
            `UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [stokSesudah, it.product_id]
          );
        }

        await txQuery(
          `UPDATE stock_opname SET status = 'final', finalized_by = $1, finalized_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [req.user.id, id]
        );
      });

      res.json(await loadOpname(query, id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/stock-opname/:id - cancel draft
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const opname = (await query('SELECT id, status FROM stock_opname WHERE id = $1', [id])).rows[0];
    if (!opname) return res.status(404).json({ error: 'Tidak ditemukan' });
    if (opname.status === 'final')
      return res.status(400).json({ error: 'Opname final tidak bisa dihapus' });
    await query(`DELETE FROM stock_opname WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
