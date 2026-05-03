const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin, JWT_SECRET } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { LoginRequestSchema, RegisterRequestSchema } = require('@vipos/shared');

const router = express.Router();

// Login
router.post('/login', validate({ body: LoginRequestSchema }), (req, res) => {
  try {
    const { username, password } = req.body;

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Register new user (admin only)
router.post(
  '/register',
  authenticateToken,
  requireAdmin,
  validate({ body: RegisterRequestSchema }),
  (req, res) => {
    try {
      const { username, password, name, role } = req.body;

      const db = getDb();
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db
        .prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)')
        .run(username, hashedPassword, name, role);

      res.status(201).json({
        message: 'User berhasil dibuat',
        user: { id: result.lastInsertRowid, username, name, role },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get all users (admin only)
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT id, username, name, role, created_at FROM users').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
