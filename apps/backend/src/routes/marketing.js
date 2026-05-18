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
const { query, tx } = require('../db');
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
async function resolveAudience(q, channel, payload) {
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
    const rows = (
      await q(
        `SELECT c.id, c.name, c.phone, c.email, c.points, c.deposit
           FROM customers c
          WHERE c.is_active = 1`
      )
    ).rows;
    for (const row of rows) pushCustomer(row);
    return out;
  }

  if (payload.audience_type === 'group') {
    const ids = payload.audience_group_ids || [];
    if (ids.length === 0) return out;
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const rows = (
      await q(
        `SELECT c.id, c.name, c.phone, c.email, c.points, c.deposit
           FROM customers c
          WHERE c.is_active = 1
            AND c.customer_group_id IN (${placeholders})`,
        ids
      )
    ).rows;
    for (const row of rows) pushCustomer(row);
    return out;
  }

  if (payload.audience_type === 'tag') {
    const ids = payload.audience_tag_ids || [];
    if (ids.length === 0) return out;
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const rows = (
      await q(
        `SELECT DISTINCT c.id, c.name, c.phone, c.email, c.points, c.deposit
           FROM customers c
           JOIN customer_tag_map m ON m.customer_id = c.id
          WHERE c.is_active = 1
            AND m.tag_id IN (${placeholders})`,
        ids
      )
    ).rows;
    for (const row of rows) pushCustomer(row);
    return out;
  }

  return out;
}

function defaultCostPerMessage(channel, override) {
  if (override !== null && override !== undefined && override > 0) {
    return Number(override);
  }
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

async function balanceForChannel(q, channel) {
  const row = (
    await q(
      `SELECT COALESCE(SUM(delta), 0) AS balance
         FROM marketing_credit_ledger
        WHERE channel = $1`,
      [channel]
    )
  ).rows[0];
  return row ? Number(row.balance) : 0;
}

async function balanceAll(q) {
  const out = { whatsapp: 0, sms: 0, email: 0, instagram: 0 };
  for (const channel of CHANNELS) {
    out[channel] = await balanceForChannel(q, channel);
  }
  return out;
}

async function appendLedger(q, { channel, delta, type, campaign_id, notes, userId }) {
  const balance = (await balanceForChannel(q, channel)) + Number(delta);
  const ins = await q(
    `INSERT INTO marketing_credit_ledger
        (channel, delta, balance_after, type, campaign_id, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [channel, delta, balance, type, campaign_id || null, notes || null, userId || null]
  );
  return {
    id: ins.rows[0].id,
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

router.get('/template', authenticateToken, async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let p = 1;
    if (req.query.channel) {
      conditions.push(`channel = $${p++}`);
      params.push(req.query.channel);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (
      await query(
        `SELECT * FROM marketing_templates ${where} ORDER BY created_at DESC, id DESC`,
        params
      )
    ).rows;
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
  async (req, res) => {
    try {
      const body = req.body;
      const buttons = JSON.stringify(body.buttons || []);
      const ins = await query(
        `INSERT INTO marketing_templates
            (name, channel, header, body, footer, buttons, subject, caption)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          body.name,
          body.channel,
          body.header || null,
          body.body,
          body.footer || null,
          buttons,
          body.subject || null,
          body.caption || null,
        ]
      );
      const row = (await query('SELECT * FROM marketing_templates WHERE id = $1', [ins.rows[0].id]))
        .rows[0];
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
  async (req, res) => {
    try {
      const existing = (
        await query('SELECT * FROM marketing_templates WHERE id = $1', [req.params.id])
      ).rows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Template tidak ditemukan' });
      }
      const body = { ...req.body };
      const sets = [];
      const params = [];
      let p = 1;
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
          sets.push(`${col} = $${p++}`);
          params.push(body[key] === undefined ? null : body[key]);
        }
      }
      if ('buttons' in body) {
        sets.push(`buttons = $${p++}`);
        params.push(JSON.stringify(body.buttons || []));
      }
      if (sets.length === 0) {
        return res.json(rowToTemplate(existing));
      }
      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      await query(`UPDATE marketing_templates SET ${sets.join(', ')} WHERE id = $${p}`, params);
      const row = (await query('SELECT * FROM marketing_templates WHERE id = $1', [req.params.id]))
        .rows[0];
      res.json(rowToTemplate(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/template/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM marketing_templates WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Template tidak ditemukan' });
    }
    res.json({ message: 'Template dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================ Campaigns =================================

router.get('/campaign', authenticateToken, async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let p = 1;
    if (req.query.channel) {
      conditions.push(`channel = $${p++}`);
      params.push(req.query.channel);
    }
    if (req.query.status) {
      conditions.push(`status = $${p++}`);
      params.push(req.query.status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const total = Number(
      (await query(`SELECT COUNT(*) AS n FROM marketing_campaigns ${where}`, params)).rows[0].n
    );
    const rows = (
      await query(
        `SELECT * FROM marketing_campaigns ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset]
      )
    ).rows;
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
  async (req, res) => {
    try {
      const body = req.body;

      const audience = await resolveAudience(query, body.channel, body);
      if (audience.length === 0) {
        return res.status(400).json({
          error: 'Audience kosong — tidak ada penerima yang valid untuk channel ini',
        });
      }

      const cost = defaultCostPerMessage(body.channel, body.cost_per_message);
      const totalCost = cost * audience.length;
      const status = body.schedule_type === 'scheduled' ? 'scheduled' : 'draft';

      const campaignId = await tx(async (txQuery) => {
        const ins = await txQuery(
          `INSERT INTO marketing_campaigns
              (name, channel, provider, audience_type,
               audience_group_ids, audience_tag_ids, audience_custom_recipients,
               template_id, template_snapshot,
               schedule_type, scheduled_at, recurrence_rule,
               cost_per_message, total_cost, status,
               notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
          [
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
            req.user?.id || null,
          ]
        );
        const newId = ins.rows[0].id;

        const outletName = getOutletName();
        for (const rec of audience) {
          const vars = rec.customer
            ? customerVariables(rec.customer, outletName)
            : { name: rec.label || '', outlet: outletName };
          const rendered = renderTemplateSnapshot(body.template_snapshot, vars);
          await txQuery(
            `INSERT INTO marketing_campaign_recipients
              (campaign_id, customer_id, contact, contact_label,
               rendered_message, status, cost)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
            [newId, rec.customer ? rec.customer.id : null, rec.contact, rec.label, rendered, cost]
          );
        }
        return newId;
      });

      const row = (await query('SELECT * FROM marketing_campaigns WHERE id = $1', [campaignId]))
        .rows[0];
      res.status(201).json(rowToCampaign(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/campaign/:id', authenticateToken, async (req, res) => {
  try {
    const row = (await query('SELECT * FROM marketing_campaigns WHERE id = $1', [req.params.id]))
      .rows[0];
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
  async (req, res) => {
    try {
      const existing = (
        await query('SELECT * FROM marketing_campaigns WHERE id = $1', [req.params.id])
      ).rows[0];
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
      let p = 1;
      const map = {
        name: 'name',
        notes: 'notes',
        scheduled_at: 'scheduled_at',
        schedule_type: 'schedule_type',
        cost_per_message: 'cost_per_message',
      };
      for (const [key, col] of Object.entries(map)) {
        if (key in body) {
          sets.push(`${col} = $${p++}`);
          params.push(body[key] === undefined ? null : body[key]);
        }
      }
      if (sets.length === 0) {
        return res.json(rowToCampaign(existing));
      }
      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);
      await query(`UPDATE marketing_campaigns SET ${sets.join(', ')} WHERE id = $${p}`, params);

      // If cost_per_message changed, refresh total_cost based on recipients.
      if ('cost_per_message' in body) {
        const recipientCount = Number(
          (
            await query(
              'SELECT COUNT(*) AS n FROM marketing_campaign_recipients WHERE campaign_id = $1',
              [req.params.id]
            )
          ).rows[0].n
        );
        const total = Number(body.cost_per_message) * recipientCount;
        await query('UPDATE marketing_campaigns SET total_cost = $1 WHERE id = $2', [
          total,
          req.params.id,
        ]);
        await query('UPDATE marketing_campaign_recipients SET cost = $1 WHERE campaign_id = $2', [
          body.cost_per_message,
          req.params.id,
        ]);
      }

      // If schedule_type or scheduled_at changed, sync status.
      const scheduleType = 'schedule_type' in body ? body.schedule_type : existing.schedule_type;
      if (scheduleType === 'scheduled' && existing.status !== 'scheduled') {
        await query("UPDATE marketing_campaigns SET status = 'scheduled' WHERE id = $1", [
          req.params.id,
        ]);
      } else if (scheduleType === 'now' && existing.status !== 'draft') {
        await query("UPDATE marketing_campaigns SET status = 'draft' WHERE id = $1", [
          req.params.id,
        ]);
      }

      const row = (await query('SELECT * FROM marketing_campaigns WHERE id = $1', [req.params.id]))
        .rows[0];
      res.json(rowToCampaign(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete('/campaign/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = (
      await query('SELECT * FROM marketing_campaigns WHERE id = $1', [req.params.id])
    ).rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    }
    if (['sending', 'sent'].includes(existing.status)) {
      return res
        .status(400)
        .json({ error: 'Campaign yang sudah/sedang dikirim tidak bisa dihapus' });
    }
    await query('DELETE FROM marketing_campaigns WHERE id = $1', [req.params.id]);
    res.json({ message: 'Campaign dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaign/:id/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const campaign = (
      await query('SELECT * FROM marketing_campaigns WHERE id = $1', [req.params.id])
    ).rows[0];
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    }
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ error: `Campaign sudah dalam status ${campaign.status}` });
    }
    const balance = await balanceForChannel(query, campaign.channel);
    if (balance < campaign.total_cost) {
      return res.status(400).json({
        error: 'Saldo kredit tidak cukup',
        balance,
        required: campaign.total_cost,
        channel: campaign.channel,
      });
    }

    await tx(async (txQuery) => {
      await txQuery(
        "UPDATE marketing_campaigns SET status = 'sending', sent_at = CURRENT_TIMESTAMP WHERE id = $1",
        [req.params.id]
      );

      const recipients = (
        await txQuery(
          'SELECT * FROM marketing_campaign_recipients WHERE campaign_id = $1 AND status = $2',
          [req.params.id, 'pending']
        )
      ).rows;

      const provider = campaign.provider || 'mock';
      const isMock = provider === 'mock';
      let sentCount = 0;
      let deliveredCount = 0;

      for (const rec of recipients) {
        const providerRef = `${provider}-${campaign.id}-${rec.id}-${Date.now()}`;
        if (isMock) {
          // Mock provider: assume delivered immediately.
          await txQuery(
            `UPDATE marketing_campaign_recipients
                SET status = $1, provider_ref = $2, sent_at = CURRENT_TIMESTAMP,
                    delivered_at = $3
              WHERE id = $4`,
            [
              'delivered',
              providerRef,
              new Date().toISOString().replace('T', ' ').slice(0, 19),
              rec.id,
            ]
          );
          sentCount += 1;
          deliveredCount += 1;
        } else {
          await txQuery(
            `UPDATE marketing_campaign_recipients
                SET status = $1, provider_ref = $2, sent_at = CURRENT_TIMESTAMP,
                    delivered_at = $3
              WHERE id = $4`,
            ['sent', providerRef, null, rec.id]
          );
          sentCount += 1;
        }
      }

      const recipientCount = recipients.length;
      const totalCost = recipientCount * Number(campaign.cost_per_message);
      if (recipientCount > 0 && totalCost > 0) {
        await appendLedger(txQuery, {
          channel: campaign.channel,
          delta: -totalCost,
          type: 'spend',
          campaign_id: campaign.id,
          notes: `Send campaign #${campaign.id}: ${recipientCount} recipients`,
          userId: req.user?.id,
        });
      }

      await txQuery(
        `UPDATE marketing_campaigns
              SET status = 'sent',
                  sent_count = $1,
                  delivered_count = $2,
                  completed_at = CURRENT_TIMESTAMP
            WHERE id = $3`,
        [sentCount, deliveredCount, req.params.id]
      );
    });

    const row = (await query('SELECT * FROM marketing_campaigns WHERE id = $1', [req.params.id]))
      .rows[0];
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
  async (req, res) => {
    try {
      const campaign = (
        await query('SELECT * FROM marketing_campaigns WHERE id = $1', [req.params.id])
      ).rows[0];
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

router.get('/campaign/:id/recipients', authenticateToken, async (req, res) => {
  try {
    const campaign = (
      await query('SELECT id FROM marketing_campaigns WHERE id = $1', [req.params.id])
    ).rows[0];
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    }
    const conditions = [`r.campaign_id = $1`];
    const params = [req.params.id];
    let p = 2;
    if (req.query.status) {
      conditions.push(`r.status = $${p++}`);
      params.push(req.query.status);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
    const offset = parseInt(req.query.offset, 10) || 0;
    const total = Number(
      (await query(`SELECT COUNT(*) AS n FROM marketing_campaign_recipients r ${where}`, params))
        .rows[0].n
    );
    const rows = (
      await query(
        `SELECT r.*, c.name AS customer_name
           FROM marketing_campaign_recipients r
           LEFT JOIN customers c ON c.id = r.customer_id
          ${where}
          ORDER BY r.id ASC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset]
      )
    ).rows;
    res.json({ items: rows.map(rowToRecipient), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/campaign/:id/recipient/:recipientId/event',
  authenticateToken,
  validate({ body: MarketingRecipientEventSchema }),
  async (req, res) => {
    try {
      const recipient = (
        await query(
          `SELECT * FROM marketing_campaign_recipients
            WHERE id = $1 AND campaign_id = $2`,
          [req.params.recipientId, req.params.id]
        )
      ).rows[0];
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient tidak ditemukan' });
      }
      const event = req.body.event;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      await tx(async (txQuery) => {
        if (event === 'delivered') {
          await txQuery(
            `UPDATE marketing_campaign_recipients
                SET status = 'delivered', delivered_at = COALESCE(delivered_at, $1)
              WHERE id = $2`,
            [now, recipient.id]
          );
          await txQuery(
            `UPDATE marketing_campaigns
                SET delivered_count = delivered_count + $1
              WHERE id = $2`,
            [recipient.status === 'delivered' ? 0 : 1, recipient.campaign_id]
          );
        } else if (event === 'opened') {
          await txQuery(
            `UPDATE marketing_campaign_recipients
                SET status = 'opened', opened_at = COALESCE(opened_at, $1)
              WHERE id = $2`,
            [now, recipient.id]
          );
          await txQuery(
            `UPDATE marketing_campaigns
                SET opened_count = opened_count + 1
              WHERE id = $1`,
            [recipient.campaign_id]
          );
        } else if (event === 'clicked') {
          await txQuery(
            `UPDATE marketing_campaign_recipients
                SET status = 'clicked', clicked_at = COALESCE(clicked_at, $1)
              WHERE id = $2`,
            [now, recipient.id]
          );
          await txQuery(
            `UPDATE marketing_campaigns
                SET clicked_count = clicked_count + 1
              WHERE id = $1`,
            [recipient.campaign_id]
          );
        } else if (event === 'failed') {
          await txQuery(
            `UPDATE marketing_campaign_recipients
                SET status = 'failed', error_message = $1
              WHERE id = $2`,
            [req.body.error_message || 'Unknown error', recipient.id]
          );
          await txQuery(
            `UPDATE marketing_campaigns
                SET failed_count = failed_count + 1
              WHERE id = $1`,
            [recipient.campaign_id]
          );
          if (Number(recipient.cost) > 0) {
            const channelRow = (
              await txQuery('SELECT channel FROM marketing_campaigns WHERE id = $1', [
                recipient.campaign_id,
              ])
            ).rows[0];
            await appendLedger(txQuery, {
              channel: channelRow.channel,
              delta: Number(recipient.cost),
              type: 'refund',
              campaign_id: recipient.campaign_id,
              notes: `Refund recipient #${recipient.id} (failed)`,
              userId: req.user?.id,
            });
          }
        }
      });
      const row = (
        await query(
          `SELECT r.*, c.name AS customer_name
             FROM marketing_campaign_recipients r
             LEFT JOIN customers c ON c.id = r.customer_id
            WHERE r.id = $1`,
          [recipient.id]
        )
      ).rows[0];
      res.json(rowToRecipient(row));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/campaign/:id/report', authenticateToken, async (req, res) => {
  try {
    const campaign = (
      await query('SELECT * FROM marketing_campaigns WHERE id = $1', [req.params.id])
    ).rows[0];
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign tidak ditemukan' });
    }
    const total = Number(
      (
        await query(
          'SELECT COUNT(*) AS n FROM marketing_campaign_recipients WHERE campaign_id = $1',
          [req.params.id]
        )
      ).rows[0].n
    );
    const sent = Number(campaign.sent_count) || 0;
    const delivered = Number(campaign.delivered_count) || 0;
    const opened = Number(campaign.opened_count) || 0;
    const clicked = Number(campaign.clicked_count) || 0;
    const failed = Number(campaign.failed_count) || 0;
    const cost = Number(campaign.total_cost) || 0;
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

router.get('/credit/balance', authenticateToken, async (_req, res) => {
  try {
    res.json(await balanceAll(query));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/credit/ledger', authenticateToken, async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    let p = 1;
    if (req.query.channel) {
      conditions.push(`channel = $${p++}`);
      params.push(req.query.channel);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const total = Number(
      (await query(`SELECT COUNT(*) AS n FROM marketing_credit_ledger ${where}`, params)).rows[0].n
    );
    const rows = (
      await query(
        `SELECT * FROM marketing_credit_ledger ${where}
          ORDER BY created_at DESC, id DESC
          LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset]
      )
    ).rows;
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
  async (req, res) => {
    try {
      const entry = await appendLedger(query, {
        channel: req.body.channel,
        delta: req.body.amount,
        type: 'topup',
        notes: req.body.notes || null,
        userId: req.user?.id,
      });
      res.json({
        channel: req.body.channel,
        balance: await balanceForChannel(query, req.body.channel),
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
