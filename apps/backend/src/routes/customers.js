const express = require("express");
const { getDb } = require("../models/database");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { CustomerCreateSchema, CustomerUpdateSchema } = require("@vipos/shared");

const router = express.Router();

function generateKode(db) {
  const last = db
    .prepare(
      `SELECT kode FROM customers WHERE kode LIKE 'PLG%' ORDER BY id DESC LIMIT 1`,
    )
    .get();
  if (!last) return "PLG0001";
  const num = parseInt((last.kode || "").replace(/\D/g, ""), 10) || 0;
  return "PLG" + String(num + 1).padStart(4, "0");
}

router.get("/", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { search, active_only } = req.query;

    const conditions = [];
    const params = [];
    if (active_only !== "false") {
      conditions.push("is_active = 1");
    }
    if (search) {
      conditions.push(
        "(name LIKE ? OR kode LIKE ? OR phone LIKE ? OR email LIKE ?)",
      );
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db
      .prepare(`SELECT * FROM customers ${where} ORDER BY created_at DESC`)
      .all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(req.params.id);
    if (!row)
      return res.status(404).json({ error: "Pelanggan tidak ditemukan" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  "/",
  authenticateToken,
  validate({ body: CustomerCreateSchema }),
  (req, res) => {
    try {
      const {
        kode,
        name,
        phone,
        email,
        address,
        gender,
        birth_date,
        points,
        deposit,
        notes,
      } = req.body;

      const db = getDb();
      const kodeFinal = (kode && kode.trim()) || generateKode(db);
      const result = db
        .prepare(
          `
      INSERT INTO customers (kode, name, phone, email, address, gender, birth_date, points, deposit, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        )
        .run(
          kodeFinal,
          name.trim(),
          phone ? phone.trim() : null,
          email ? email.trim() : null,
          address ? address.trim() : null,
          gender || null,
          birth_date || null,
          Number.isFinite(parseInt(points, 10)) ? parseInt(points, 10) : 0,
          Number.isFinite(parseFloat(deposit)) ? parseFloat(deposit) : 0,
          notes ? notes.trim() : null,
        );

      const row = db
        .prepare("SELECT * FROM customers WHERE id = ?")
        .get(result.lastInsertRowid);
      res.status(201).json(row);
    } catch (err) {
      if (err.message.includes("UNIQUE")) {
        return res
          .status(400)
          .json({ error: "Kode pelanggan sudah digunakan" });
      }
      res.status(500).json({ error: err.message });
    }
  },
);

router.put(
  "/:id",
  authenticateToken,
  validate({ body: CustomerUpdateSchema }),
  (req, res) => {
    try {
      const {
        kode,
        name,
        phone,
        email,
        address,
        gender,
        birth_date,
        points,
        deposit,
        notes,
        is_active,
      } = req.body;
      if (!name) return res.status(400).json({ error: "Nama wajib diisi" });
      const db = getDb();

      const existing = db
        .prepare("SELECT * FROM customers WHERE id = ?")
        .get(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Pelanggan tidak ditemukan" });

      db.prepare(
        `
      UPDATE customers
         SET kode = ?,
             name = ?,
             phone = ?,
             email = ?,
             address = ?,
             gender = ?,
             birth_date = ?,
             points = ?,
             deposit = ?,
             notes = ?,
             is_active = ?,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `,
      ).run(
        kode ? kode.trim() : existing.kode,
        name.trim(),
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        address ? address.trim() : null,
        gender || null,
        birth_date || null,
        Number.isFinite(parseInt(points, 10)) ? parseInt(points, 10) : 0,
        Number.isFinite(parseFloat(deposit)) ? parseFloat(deposit) : 0,
        notes ? notes.trim() : null,
        is_active === false || is_active === 0 ? 0 : 1,
        req.params.id,
      );

      const row = db
        .prepare("SELECT * FROM customers WHERE id = ?")
        .get(req.params.id);
      res.json(row);
    } catch (err) {
      if (err.message.includes("UNIQUE")) {
        return res
          .status(400)
          .json({ error: "Kode pelanggan sudah digunakan" });
      }
      res.status(500).json({ error: err.message });
    }
  },
);

router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const used = db
      .prepare(
        "SELECT COUNT(*) as count FROM transactions WHERE customer_id = ?",
      )
      .get(req.params.id);
    if (used.count > 0) {
      db.prepare("UPDATE customers SET is_active = 0 WHERE id = ?").run(
        req.params.id,
      );
      return res.json({
        message:
          "Pelanggan dinonaktifkan karena sudah memiliki riwayat transaksi",
      });
    }
    db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
    res.json({ message: "Pelanggan berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
