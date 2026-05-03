// VIPOS — Image upload endpoint (P1-04 product master).
//
// Saves files into <backend>/uploads/products/ and returns a public URL the
// frontend can persist into `products.image_urls`. The static handler is
// mounted in app.js so /uploads/* is served back to clients.
const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const multer = require("multer");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "products");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const safe = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}${ext || ".bin"}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype);
    if (!ok) return cb(new Error("Format file harus image (PNG/JPEG/WEBP/GIF)"));
    cb(null, true);
  },
});

router.post("/products", authenticateToken, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File tidak ditemukan" });
  const url = `/uploads/products/${req.file.filename}`;
  res.status(201).json({ url, size: req.file.size, mimetype: req.file.mimetype });
});

module.exports = { router, UPLOAD_DIR };
