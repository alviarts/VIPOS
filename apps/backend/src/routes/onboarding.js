// VIPOS — Tenant onboarding / self-service signup (P6-02 prep).
//
// Surface:
//   POST /api/v1/onboarding/register
//     body: { business_name, owner_name, email, phone, password }
//     201:  { tenant, user, token }
//     400:  validation errors
//     409:  email already registered
//
// Creates a new tenant + admin user in one atomic operation.
// The tenant starts on the "lite" tier with a 14-day trial.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, tx } = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { business_name, owner_name, email, phone, password } = req.body || {};

    // Validation
    if (!business_name || business_name.trim().length < 2) {
      return res.status(400).json({ error: 'Nama bisnis minimal 2 karakter' });
    }
    if (!owner_name || owner_name.trim().length < 2) {
      return res.status(400).json({ error: 'Nama pemilik minimal 2 karakter' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email tidak valid' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter' });
    }

    // Check email uniqueness
    const { rows: existing } = await query(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase().trim()],
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email sudah terdaftar' });
    }

    // Generate slug from business name
    const slug = business_name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    // Check slug uniqueness
    const { rows: slugExists } = await query(
      `SELECT id FROM tenants WHERE slug = $1`,
      [slug],
    );
    const finalSlug = slugExists.length > 0
      ? `${slug}-${Date.now().toString(36)}`
      : slug;

    // Create tenant + user atomically
    const result = await tx(async (txQuery) => {
      // Create tenant
      const { rows: tenantRows } = await txQuery(
        `INSERT INTO tenants (slug, name, tier, status)
         VALUES ($1, $2, 'lite', 'trial')
         RETURNING id, slug, name, tier, status`,
        [finalSlug, business_name.trim()],
      );
      const tenant = tenantRows[0];

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin user (bypass RLS for onboarding)
      const { rows: userRows } = await txQuery(
        `INSERT INTO users (username, password, name, role, email, phone, tenant_id)
         VALUES ($1, $2, $3, 'owner', $4, $5, $6)
         RETURNING id, username, name, role, email`,
        [
          email.toLowerCase().trim(),
          hashedPassword,
          owner_name.trim(),
          email.toLowerCase().trim(),
          phone || null,
          tenant.id,
        ],
      );
      const user = userRows[0];

      // Create tenant_user link
      await txQuery(
        `INSERT INTO tenant_users (tenant_id, user_id, role, is_default)
         VALUES ($1, $2, 'owner', true)`,
        [tenant.id, user.id],
      );

      return { tenant, user };
    });

    // Generate JWT
    const token = jwt.sign(
      {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
        tenantId: result.tenant.id,
      },
      process.env.JWT_SECRET || 'vipos-dev-secret',
      { expiresIn: '7d' },
    );

    return res.status(201).json({
      tenant: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        name: result.tenant.name,
        tier: result.tenant.tier,
        status: result.tenant.status,
      },
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      token,
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    return res.status(500).json({ error: 'Gagal mendaftarkan bisnis' });
  }
});

module.exports = router;
