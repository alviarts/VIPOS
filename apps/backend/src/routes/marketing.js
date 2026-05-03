// Marketing endpoints (P1-11): templates + campaigns + delivery events +
// per-channel credit ledger.
//
// Endpoints:
//   GET    /api/marketing/template
//   POST   /api/marketing/template
//   PUT    /api/marketing/template/:id
//   DELETE /api/marketing/template/:id
//
//   GET    /api/marketing/campaign                 List + filter channel/status.
//   POST   /api/marketing/campaign                 Create + resolve audience + render.
//   GET    /api/marketing/campaign/:id             Detail.
//   PUT    /api/marketing/campaign/:id             Update (only draft/scheduled).
//   DELETE /api/marketing/campaign/:id             Cancel/delete (not sent yet).
//   POST   /api/marketing/campaign/:id/send        Execute send (mock provider).
//   POST   /api/marketing/campaign/:id/test-send   Test send to single contact.
//   GET    /api/marketing/campaign/:id/recipients  List recipients.
//   POST   /api/marketing/campaign/:id/recipient/:rid/event   Mark delivered/opened/clicked/failed.
//   GET    /api/marketing/campaign/:id/report      Aggregate metrics.
//
//   GET    /api/marketing/credit/balance           Per-channel balance.
//   GET    /api/marketing/credit/ledger            Ledger entries.
//   POST   /api/marketing/credit/topup             Top up (admin).
//
// Provider eksternal di-abstract via field `provider` (default `mock`).
// Untuk provider `mock`, send() langsung mark recipient `sent` + emit
// auto-delivery setelah simulasi. Wiring resmi (WhatsApp Business API,
// SMS gateway, SendGrid, Meta Graph) ditunda; UI/UX flow lengkap supaya
// integrasi nanti tinggal swap provider adapter.
const express = require('express');
const { getDb } = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  MarketingTemplateCreateSchema,
  MarketingTemplateUpdateSchema,
  MarketingCampaignCreateSchema,
  MarketingCampaignUpdateSchema,
  MarketingCampaignTestSendSchema,
  MarketingRecipientEventSchema,
  MarketingCreditTopupSchema,
} = require('@vipos/shared');

const router = express.Router();

const CHANNELS = ['whatsapp', 'sms', 'email', 'instagram'];

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToTemplate(row) {
  if (!row) return null;
  return {
    ...row,
    buttons: parseJson(row.buttons, []),
  };
}

function rowToCampaign(row) {
  if (!row) return null;
  return {
    ...row,
    audience_group_ids: parseJson(row.audience_group_ids, []),
    audience_tag_ids: parseJson(row.audience_tag_ids, []),
    audience_custom_recipients: parseJson(row.audience_custom_recipients, []),
    template_snapshot: parseJson(row.template_snapshot, {
      body: '',
      buttons: [],
    }),
  };
}

function rowToRecipient(row) {
  if (!row) return null;
  const { customer_name, ...rest } = row;
  return {
    ...rest,
    customer_name: customer_name || undefined,
  };
}

// Render template body with variable substitution. Variables follow the
// `{{name}}`, `{{outlet}}`, `{{points_balance}}`, `{{deposit_balance}}`,
// `{{trx_count}}`, `{{last_visit}}` convention from
// docs/v2/menus/penjualan/marketing.md. Unknown variables stay as `{{var}}`.
function renderMessage(body, variables) {
  if (!body) return '';
  return body.replace(/\{\{\s*([\w_-]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      const v = variables[key];
      return v === null || v === undefined ? '' : String(v);
    }
    return match;
  });
}

function renderTemplateSnapshot(snapshot, variables) {
  if (!snapshot) return '';
  const parts = [];
  if (snapshot.subject) {
    parts.push(`Subject: ${renderMessage(snapshot.subject, variables)}`);
  }
  if (snapshot.header) {
    parts.push(renderMessage(snapshot.header, variables));
  }
  parts.push(renderMessage(snapshot.body || '', variables));
  if (snapshot.footer) {
    parts.push(renderMessage(snapshot.footer, variables));
  }
  if (snapshot.caption) {
    parts.push(renderMessage(snapshot.caption, variables));
  }
  if (Array.isArray(snapshot.buttons) && snapshot.buttons.length > 0) {
    const labels = snapshot.buttons.map((b) => `[${b.label}](${b.value})`).join(' ');
    parts.push(labels);
  }
  return parts
    .filter((p) => p && p.length > 0)
    .join('\n')
    .trim();
}

function customerVariables(customer, outletName) {
  return {
    name: customer.name || '',
    nama: customer.name || '',
    outlet: outletName || '',
    points_balance: customer.points || 0,
    deposit_balance: customer.deposit || 0,
    trx_count: customer.transaction_count || 0,
    last_visit: customer.last_visit ? customer.last_visit.split('T')[0] : '',
    phone: customer.phone || '',
    email: customer.email || '',
  };
}

function getOutletName() {
  return process.env.VIPOS_OUTLET_NAME || 'VIPOS';
}

function getChannelContact(channel, customer) {
  if (channel === 'email') return customer.email || null;
  return customer.phone || null;
}

// Resolve audience -> array of { customer, contact }. Custom recipients have
// no customer FK.
function resolveAudience(db, channel, payload) {
  const out = [];
  const seen = new Set();

  function pushCustomer(customer) {
    const contact = getChannelContact(channel, customer);
    if (!contact) return;
    const key = `c:${customer.id}:${contact}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ customer, contact, label: customer.name });
  }

  if (payload.audience_type === 'custom') {
    for (const recipient of payload.audience_custom_recipients) {
      const key = `x:${recipient.contact}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        customer: null,
        contact: recipient.contact,
        label: recipient.label || null,
      });
    }
    return out;
  }

  if (payload.audience_type === 'all') {
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.phone, c.email, c.points, c.deposit
           FROM customers c
          WHERE c.is_active = 1`
      )
      .all();
    for (const row of rows) pushCustomer(row);
    return out;
  }

  if (payload.audience_type === 'group') {
    const ids = payload.audience_group_ids || [];
    if (ids.length === 0) return out;
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.phone, c.email, c.points, c.deposit
           FROM customers c
          WHERE c.is_active = 1
            AND c.customer_group_id IN (${placeholders})`
      )
      .all(...ids);
    for (const row of rows) pushCustomer(row);
    return out;
  }

  if (payload.audience_type === 'tag') {
    const ids = payload.audience_tag_ids || [];
    if (ids.length === 0) return out;
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT DISTINCT c.id, c.name, c.phone, c.email, c.points, c.deposit
           FROM customers c
           JOIN customer_tag_map m ON m.customer_id = c.id
          WHERE c.is_active = 1
            AND m.tag_id IN (${placeholders})`
      )
      .all(...ids);
    for (const row of rows) pushCustomer(row);
    return out;
  }

  return out;
}

function defaultCostPerMessage(channel, override) {
  if (override !== null && override !== undefined && override > 0) {
    return Number(override);
  }
  // Defaults (Rp). Tunable via /api/marketing/credit/topup ledger or
  // override per campaign body.
  switch (channel) {
    case 'whatsapp':
      return 350;
    case 'sms':
      return 500;
    case 'email':
      return 50;
    case 'instagram':
      return 0;
    default:
      return 0;
  }
}

function balanceForChannel(db, channel) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(delta), 0) AS balance
         FROM marketing_credit_ledger
        WHERE channel = ?`
    )
    .get(channel);
  return row ? Number(row.balance) : 0;
}

function balanceAll(db) {
  const out = { whatsapp: 0, sms: 0, email: 0, instagram: 0 };
  for (const channel of CHANNELS) {
    out[channel] = balanceForChannel(db, channel);
  }
  return out;
}

function appendLedger(db, { channel, delta, type, campaign_id, notes, userId }) {
  const balance = balanceForChannel(db, channel) + Number(delta);
  const stmt = db.prepare(
    `INSERT INTO marketing_credit_ledger
      (channel, delta, balance_after, type, campaign_id, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    channel,
    delta,
    balance,
    type,
    campaign_id || null,
    notes || null,
    userId || null
  );
  return {
    id: result.lastInsertRowid,
    channel,
    delta: Number(delta),
    balance_after: balance,
    type,
    campaign_id: campaign_id || null,
    notes: notes || null,
    created_by: userId || null,
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

// ============================ Templates =================================

router.get('/template', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (req.query.channel) {
      conditions.push('channel = ?');
      params.push(req.query.channel);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM marketing_templates ${where} ORDER BY created_at DESC, id DESC`)
      .all(...params);
    res.json(rows.map(rowToTemplate));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/template',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketingTemplateCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const body = req.body;
      const buttons = JSON.stringify(body.buttons || []);
      const result = db
        .prepare(
          `INSERT INTO marketing_templates
            (name, channel, header, body, footer, buttons, subject, caption)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          body.name,
          body.channel,
          body.header || null,
          body.body,
          body.footer || null,
          buttons,
          body.subject || null,
          body.caption || null
        );
      const row = db
        .prepare('SELECT * FROM marketing_templates WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(rowToTemplate(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.put(
  '/template/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketingTemplateUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const existing = db
        .prepare('SELECT * FROM marketing_templates WHERE id = ?')
        .get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Template tidak ditemukan' });
      }
      const body = { ...req.body };
      const sets = [];
      const params = [];
      const fieldMap = {
        name: 'name',
        channel: 'channel',
        header: 'header',
        body: 'body',
        footer: 'footer',
        subject: 'subject',
        caption: 'caption',
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in body) {
          sets.push(`${col} = ?`);
          params.push(body[key] === undefined ? null : body[key]);
        }
      }
      if ('buttons' in body) {
        sets.push('buttons = ?');
        params.push(JSON.stringify(body.buttons || []));
      }
      if (sets.length === 0) {
        return res.json(rowToTemplate(existing));
      }
      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      db.prepare(`UPDATE marketing_templates SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      const row = db.prepare('SELECT * FROM marketing_templates WHERE id = ?').get(req.params.id);
      res.json(rowToTemplate(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/template/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM marketing_templates WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Template tidak ditemukan' });
    }
    res.json({ message: 'Template dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================ Campaigns =================================

router.get('/campaign', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (req.query.channel) {
      conditions.push('channel = ?');
      params.push(req.query.channel);
    }
    if (req.query.status) {
      conditions.push('status = ?');
      params.push(req.query.status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM marketing_campaigns ${where}`)
      .get(...params).n;
    const rows = db
      .prepare(
        `SELECT * FROM marketing_campaigns ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
    res.json({ items: rows.map(rowToCampaign), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/campaign',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketingCampaignCreateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const body = req.body;

      const audience = resolveAudience(db, body.channel, body);
      if (audience.length === 0) {
        return res.status(400).json({
          error: 'Audience kosong — tidak ada penerima yang valid untuk channel ini',
        });
      }

      const cost = defaultCostPerMessage(body.channel, body.cost_per_message);
      const totalCost = cost * audience.length;
      const status = body.schedule_type === 'scheduled' ? 'scheduled' : 'draft';

      const insert = db.transaction(() => {
        const result = db
          .prepare(
            `INSERT INTO marketing_campaigns
              (name, channel, provider, audience_type,
               audience_group_ids, audience_tag_ids, audience_custom_recipients,
               template_id, template_snapshot,
               schedule_type, scheduled_at, recurrence_rule,
               cost_per_message, total_cost, status,
               notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            body.name,
            body.channel,
            body.provider,
            body.audience_type,
            JSON.stringify(body.audience_group_ids || []),
            JSON.stringify(body.audience_tag_ids || []),
            JSON.stringify(body.audience_custom_recipients || []),
            body.template_id || null,
            JSON.stringify(body.template_snapshot),
            body.schedule_type,
            body.scheduled_at || null,
            body.recurrence_rule || null,
            cost,
            totalCost,
            status,
            body.notes || null,
            req.user?.id || null
          );
        const campaignId = result.lastInsertRowid;

        const outletName = getOutletName();
        const insertRecipient = db.prepare(
          `INSERT INTO marketing_campaign_recipients
            (campaign_id, customer_id, contact, contact_label,
             rendered_message, status, cost)
           VALUES (?, ?, ?, ?, ?, 'pending', ?)`
        );
        for (const rec of audience) {
          const vars = rec.customer
            ? customerVariables(rec.customer, outletName)
            : { name: rec.label || '', outlet: outletName };
          const rendered = renderTemplateSnapshot(body.template_snapshot, vars);
          insertRecipient.run(
            campaignId,
            rec.customer ? rec.customer.id : null,
            rec.contact,
            rec.label,
            rendered,
            cost
          );
        }
        return campaignId;
      });

      const campaignId = insert();
      const row = db.prepare('SELECT * FROM marketing_campaigns WHERE id = ?').get(campaignId);
      res.status(201).json(rowToCampaign(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/campaign/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM marketing_campaigns WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    res.json(rowToCampaign(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/campaign/:id',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketingCampaignUpdateSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const existing = db
        .prepare('SELECT * FROM marketing_campaigns WHERE id = ?')
        .get(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Campaign tidak ditemukan' });
      }
      if (!['draft', 'scheduled'].includes(existing.status)) {
        return res
          .status(400)
          .json({ error: 'Hanya campaign draft / scheduled yang bisa diupdate' });
      }
      const body = req.body;
      const sets = [];
      const params = [];
      const map = {
        name: 'name',
        notes: 'notes',
        scheduled_at: 'scheduled_at',
        schedule_type: 'schedule_type',
        cost_per_message: 'cost_per_message',
      };
      for (const [key, col] of Object.entries(map)) {
        if (key in body) {
          sets.push(`${col} = ?`);
          params.push(body[key] === undefined ? null : body[key]);
        }
      }
      if (sets.length === 0) {
        return res.json(rowToCampaign(existing));
      }
      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      db.prepare(`UPDATE marketing_campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...params);

      // If cost_per_message changed, refresh total_cost based on recipients.
      if ('cost_per_message' in body) {
        const recipientCount = db
          .prepare('SELECT COUNT(*) AS n FROM marketing_campaign_recipients WHERE campaign_id = ?')
          .get(req.params.id).n;
        const total = Number(body.cost_per_message) * recipientCount;
        db.prepare('UPDATE marketing_campaigns SET total_cost = ? WHERE id = ?').run(
          total,
          req.params.id
        );
        db.prepare('UPDATE marketing_campaign_recipients SET cost = ? WHERE campaign_id = ?').run(
          body.cost_per_message,
          req.params.id
        );
      }

      // If schedule_type or scheduled_at changed, sync status.
      const scheduleType = 'schedule_type' in body ? body.schedule_type : existing.schedule_type;
      if (scheduleType === 'scheduled' && existing.status !== 'scheduled') {
        db.prepare("UPDATE marketing_campaigns SET status = 'scheduled' WHERE id = ?").run(
          req.params.id
        );
      } else if (scheduleType === 'now' && existing.status !== 'draft') {
        db.prepare("UPDATE marketing_campaigns SET status = 'draft' WHERE id = ?").run(
          req.params.id
        );
      }

      const row = db.prepare('SELECT * FROM marketing_campaigns WHERE id = ?').get(req.params.id);
      res.json(rowToCampaign(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/campaign/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM marketing_campaigns WHERE id = ?')
      .get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    }
    if (['sending', 'sent'].includes(existing.status)) {
      return res
        .status(400)
        .json({ error: 'Campaign yang sudah/sedang dikirim tidak bisa dihapus' });
    }
    db.prepare('DELETE FROM marketing_campaigns WHERE id = ?').run(req.params.id);
    res.json({ message: 'Campaign dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaign/:id/send', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const campaign = db
      .prepare('SELECT * FROM marketing_campaigns WHERE id = ?')
      .get(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    }
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ error: `Campaign sudah dalam status ${campaign.status}` });
    }
    const balance = balanceForChannel(db, campaign.channel);
    if (balance < campaign.total_cost) {
      return res.status(400).json({
        error: 'Saldo kredit tidak cukup',
        balance,
        required: campaign.total_cost,
        channel: campaign.channel,
      });
    }

    const send = db.transaction(() => {
      db.prepare(
        "UPDATE marketing_campaigns SET status = 'sending', sent_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(req.params.id);

      const recipients = db
        .prepare('SELECT * FROM marketing_campaign_recipients WHERE campaign_id = ? AND status = ?')
        .all(req.params.id, 'pending');

      const provider = campaign.provider || 'mock';
      const isMock = provider === 'mock';
      let sentCount = 0;
      let deliveredCount = 0;

      const updateRec = db.prepare(
        `UPDATE marketing_campaign_recipients
              SET status = ?, provider_ref = ?, sent_at = CURRENT_TIMESTAMP,
                  delivered_at = ?
            WHERE id = ?`
      );

      for (const rec of recipients) {
        const providerRef = `${provider}-${campaign.id}-${rec.id}-${Date.now()}`;
        if (isMock) {
          // Mock provider: assume delivered immediately.
          updateRec.run(
            'delivered',
            providerRef,
            new Date().toISOString().replace('T', ' ').slice(0, 19),
            rec.id
          );
          sentCount += 1;
          deliveredCount += 1;
        } else {
          // Other providers: mark sent; expect webhook /event to update.
          updateRec.run('sent', providerRef, null, rec.id);
          sentCount += 1;
        }
      }

      const recipientCount = recipients.length;
      const totalCost = recipientCount * campaign.cost_per_message;
      if (recipientCount > 0 && totalCost > 0) {
        appendLedger(db, {
          channel: campaign.channel,
          delta: -totalCost,
          type: 'spend',
          campaign_id: campaign.id,
          notes: `Send campaign #${campaign.id}: ${recipientCount} recipients`,
          userId: req.user?.id,
        });
      }

      db.prepare(
        `UPDATE marketing_campaigns
              SET status = 'sent',
                  sent_count = ?,
                  delivered_count = ?,
                  completed_at = CURRENT_TIMESTAMP
            WHERE id = ?`
      ).run(sentCount, deliveredCount, req.params.id);

      return { sentCount, deliveredCount };
    });

    send();

    const row = db.prepare('SELECT * FROM marketing_campaigns WHERE id = ?').get(req.params.id);
    res.json(rowToCampaign(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/campaign/:id/test-send',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketingCampaignTestSendSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const campaign = db
        .prepare('SELECT * FROM marketing_campaigns WHERE id = ?')
        .get(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign tidak ditemukan' });
      }
      const snapshot = parseJson(campaign.template_snapshot, { body: '' });
      const variables = {
        name: req.body.contact_label || 'Tester',
        nama: req.body.contact_label || 'Tester',
        outlet: getOutletName(),
        points_balance: 0,
        deposit_balance: 0,
        trx_count: 0,
        last_visit: '',
      };
      const rendered = renderTemplateSnapshot(snapshot, variables);
      res.json({
        contact: req.body.contact,
        rendered_message: rendered,
        provider: campaign.provider || 'mock',
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/campaign/:id/recipients', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const campaign = db
      .prepare('SELECT id FROM marketing_campaigns WHERE id = ?')
      .get(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    }
    const conditions = ['r.campaign_id = ?'];
    const params = [req.params.id];
    if (req.query.status) {
      conditions.push('r.status = ?');
      params.push(req.query.status);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = parseInt(req.query.offset, 10) || 0;
    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM marketing_campaign_recipients r ${where}`)
      .get(...params).n;
    const rows = db
      .prepare(
        `SELECT r.*, c.name AS customer_name
           FROM marketing_campaign_recipients r
           LEFT JOIN customers c ON c.id = r.customer_id
          ${where}
          ORDER BY r.id ASC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
    res.json({ items: rows.map(rowToRecipient), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/campaign/:id/recipient/:recipientId/event',
  authenticateToken,
  validate({ body: MarketingRecipientEventSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const recipient = db
        .prepare(
          `SELECT * FROM marketing_campaign_recipients
            WHERE id = ? AND campaign_id = ?`
        )
        .get(req.params.recipientId, req.params.id);
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient tidak ditemukan' });
      }
      const event = req.body.event;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const tx = db.transaction(() => {
        if (event === 'delivered') {
          db.prepare(
            `UPDATE marketing_campaign_recipients
                SET status = 'delivered', delivered_at = COALESCE(delivered_at, ?)
              WHERE id = ?`
          ).run(now, recipient.id);
          db.prepare(
            `UPDATE marketing_campaigns
                SET delivered_count = delivered_count + ?
              WHERE id = ?`
          ).run(recipient.status === 'delivered' ? 0 : 1, recipient.campaign_id);
        } else if (event === 'opened') {
          db.prepare(
            `UPDATE marketing_campaign_recipients
                SET status = 'opened', opened_at = COALESCE(opened_at, ?)
              WHERE id = ?`
          ).run(now, recipient.id);
          db.prepare(
            `UPDATE marketing_campaigns
                SET opened_count = opened_count + 1
              WHERE id = ?`
          ).run(recipient.campaign_id);
        } else if (event === 'clicked') {
          db.prepare(
            `UPDATE marketing_campaign_recipients
                SET status = 'clicked', clicked_at = COALESCE(clicked_at, ?)
              WHERE id = ?`
          ).run(now, recipient.id);
          db.prepare(
            `UPDATE marketing_campaigns
                SET clicked_count = clicked_count + 1
              WHERE id = ?`
          ).run(recipient.campaign_id);
        } else if (event === 'failed') {
          db.prepare(
            `UPDATE marketing_campaign_recipients
                SET status = 'failed', error_message = ?
              WHERE id = ?`
          ).run(req.body.error_message || 'Unknown error', recipient.id);
          db.prepare(
            `UPDATE marketing_campaigns
                SET failed_count = failed_count + 1
              WHERE id = ?`
          ).run(recipient.campaign_id);
          if (recipient.cost > 0) {
            appendLedger(db, {
              channel: db
                .prepare('SELECT channel FROM marketing_campaigns WHERE id = ?')
                .get(recipient.campaign_id).channel,
              delta: recipient.cost,
              type: 'refund',
              campaign_id: recipient.campaign_id,
              notes: `Refund recipient #${recipient.id} (failed)`,
              userId: req.user?.id,
            });
          }
        }
      });
      tx();
      const row = db
        .prepare(
          `SELECT r.*, c.name AS customer_name
             FROM marketing_campaign_recipients r
             LEFT JOIN customers c ON c.id = r.customer_id
            WHERE r.id = ?`
        )
        .get(recipient.id);
      res.json(rowToRecipient(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/campaign/:id/report', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const campaign = db
      .prepare('SELECT * FROM marketing_campaigns WHERE id = ?')
      .get(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    }
    const total = db
      .prepare('SELECT COUNT(*) AS n FROM marketing_campaign_recipients WHERE campaign_id = ?')
      .get(req.params.id).n;
    const sent = campaign.sent_count;
    const delivered = campaign.delivered_count;
    const opened = campaign.opened_count;
    const clicked = campaign.clicked_count;
    const failed = campaign.failed_count;
    const cost = campaign.total_cost;
    const safe = (n, d) => (d > 0 ? Number(n) / d : 0);
    res.json({
      campaign_id: campaign.id,
      total_recipients: total,
      sent,
      delivered,
      opened,
      clicked,
      failed,
      delivery_rate: safe(delivered, sent),
      open_rate: safe(opened, delivered || sent),
      click_rate: safe(clicked, delivered || sent),
      cost_total: cost,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================ Credit ====================================

router.get('/credit/balance', authenticateToken, (_req, res) => {
  try {
    res.json(balanceAll(getDb()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/credit/ledger', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (req.query.channel) {
      conditions.push('channel = ?');
      params.push(req.query.channel);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const total = db
      .prepare(`SELECT COUNT(*) AS n FROM marketing_credit_ledger ${where}`)
      .get(...params).n;
    const rows = db
      .prepare(
        `SELECT * FROM marketing_credit_ledger ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
    res.json({ items: rows, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/credit/topup',
  authenticateToken,
  requireAdmin,
  validate({ body: MarketingCreditTopupSchema }),
  (req, res) => {
    try {
      const db = getDb();
      const entry = appendLedger(db, {
        channel: req.body.channel,
        delta: req.body.amount,
        type: 'topup',
        notes: req.body.notes || null,
        userId: req.user?.id,
      });
      res.json({
        channel: req.body.channel,
        balance: balanceForChannel(db, req.body.channel),
        entry,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
module.exports.renderMessage = renderMessage;
module.exports.renderTemplateSnapshot = renderTemplateSnapshot;
