const express = require("express");
const { getDb } = require("../models/database");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `
      SELECT
        d.*,
        (SELECT COUNT(*) FROM categories c WHERE c.department_id = d.id) AS category_count
      FROM departments d
      ORDER BY d.name
    `,
      )
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name)
      return res.status(400).json({ error: "Nama departemen wajib diisi" });
    const db = getDb();
    const result = db
      .prepare("INSERT INTO departments (name, description) VALUES (?, ?)")
      .run(name.trim(), description ? description.trim() : null);
    const row = db
      .prepare("SELECT * FROM departments WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Departemen sudah ada" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name)
      return res.status(400).json({ error: "Nama departemen wajib diisi" });
    const db = getDb();
    db.prepare(
      "UPDATE departments SET name = ?, description = ? WHERE id = ?",
    ).run(name.trim(), description ? description.trim() : null, req.params.id);
    const row = db
      .prepare("SELECT * FROM departments WHERE id = ?")
      .get(req.params.id);
    res.json(row);
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Departemen sudah ada" });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const used = db
      .prepare(
        "SELECT COUNT(*) as count FROM categories WHERE department_id = ?",
      )
      .get(req.params.id);
    if (used.count > 0) {
      return res
        .status(400)
        .json({
          error:
            "Departemen masih dipakai oleh kategori. Pindahkan kategori dulu.",
        });
    }
    db.prepare("DELETE FROM departments WHERE id = ?").run(req.params.id);
    res.json({ message: "Departemen berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
