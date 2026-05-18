// VIPOS — Image upload endpoint (P1-04 product master).
//
// Saves files into <backend>/uploads/products/ and returns a public URL the
// frontend can persist into `products.image_urls`. The static handler is
// mounted in app.js so /uploads/* is served back to clients.
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'products');
const CATEGORY_ICON_DIR = path.join(__dirname, '..', '..', 'uploads', 'category-icons');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(CATEGORY_ICON_DIR, { recursive: true });

function makeStorage(dir) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path
        .extname(file.originalname)
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '');
      const safe = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}${ext || '.bin'}`;
      cb(null, safe);
    },
  });
}

const imageFileFilter = (_req, file, cb) => {
  const ok = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.mimetype);
  if (!ok) return cb(new Error('Format file harus image (PNG/JPEG/WEBP/GIF/SVG)'));
  cb(null, true);
};

const upload = multer({
  storage: makeStorage(UPLOAD_DIR),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: imageFileFilter,
});

const uploadIcon = multer({
  storage: makeStorage(CATEGORY_ICON_DIR),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB (icons should be small)
  fileFilter: imageFileFilter,
});

router.post('/products', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
  const url = `/uploads/products/${req.file.filename}`;
  res.status(201).json({ url, size: req.file.size, mimetype: req.file.mimetype });
});

// P1-05: per-kategori icon (kecil; max 1 MB).
router.post('/category-icons', authenticateToken, uploadIcon.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
  const url = `/uploads/category-icons/${req.file.filename}`;
  res.status(201).json({ url, size: req.file.size, mimetype: req.file.mimetype });
});

module.exports = { router, UPLOAD_DIR, CATEGORY_ICON_DIR };
