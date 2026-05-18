// 5-step wizard untuk buat campaign marketing (P1-11):
//   1. Channel & nama
//   2. Audience (all / group / tag / custom)
//   3. Template body + variable
//   4. Schedule + cost
//   5. Preview + Test send
//
// Variable substitution dukungan: {{name}}, {{outlet}}, {{points_balance}},
// {{deposit_balance}}, {{trx_count}}, {{last_visit}}, {{phone}}, {{email}}.
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Hash,
  MessageCircle,
  Mail,
  Send,
  Smartphone,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const CHANNEL_DEFS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp Blast',
    description: 'Kirim pesan personal + tombol via WhatsApp Business.',
    Icon: MessageCircle,
    contactKind: 'phone',
    cost: 350,
  },
  {
    id: 'sms',
    label: 'SMS Broadcast',
    description: '160 chars per SMS (otomatis di-split kalau lebih panjang).',
    Icon: Smartphone,
    contactKind: 'phone',
    cost: 500,
  },
  {
    id: 'email',
    label: 'Email Blast',
    description: 'HTML email dengan subject + merge fields.',
    Icon: Mail,
    contactKind: 'email',
    cost: 50,
  },
  {
    id: 'instagram',
    label: 'IG Feed',
    description: 'Generate desain feed dengan caption + variable.',
    Icon: ImageIcon,
    contactKind: 'phone',
    cost: 0,
  },
];

const VARIABLE_HINTS = [
  '{{name}}',
  '{{outlet}}',
  '{{points_balance}}',
  '{{deposit_balance}}',
  '{{trx_count}}',
  '{{last_visit}}',
  '{{phone}}',
  '{{email}}',
];

function emptyForm() {
  return {
    name: '',
    channel: 'whatsapp',
    provider: 'mock',
    audience_type: 'all',
    audience_group_ids: [],
    audience_tag_ids: [],
    audience_custom_recipients_text: '',
    template_id: null,
    template_snapshot: {
      header: '',
      body: '',
      footer: '',
      subject: '',
      caption: '',
      buttons: [],
    },
    schedule_type: 'now',
    scheduled_at: '',
    recurrence_rule: '',
    cost_per_message: 0,
    notes: '',
  };
}

function previewMessage(snapshot, sample) {
  const text = [snapshot.subject, snapshot.header, snapshot.body, snapshot.footer, snapshot.caption]
    .filter(Boolean)
    .join('\n');
  return text.replace(/\{\{\s*([\w_-]+)\s*\}\}/g, (m, k) =>
    sample[k] !== undefined ? String(sample[k]) : m
  );
}

function parseCustomRecipients(text) {
  return text
    .split(/[\n,;]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // "Nama <kontak>" ATAU "kontak"
      const match = line.match(/^(.+?)\s*<(.+?)>\s*$/);
      if (match) return { label: match[1].trim(), contact: match[2].trim() };
      return { label: '', contact: line };
    });
}

const STEP_TITLES = ['Channel', 'Audience', 'Template', 'Jadwal & Biaya', 'Preview'];

export default function CampaignBuilder({
  open,
  onClose,
  onCreated,
  customerGroups = [],
  customerTags = [],
  templates = [],
  balances = {},
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testContact, setTestContact] = useState('');
  const [testResult, setTestResult] = useState(null);

  const channelDef = useMemo(
    () => CHANNEL_DEFS.find((c) => c.id === form.channel) || CHANNEL_DEFS[0],
    [form.channel]
  );

  useEffect(() => {
    if (!open) {
      setStep(0);
      setForm(emptyForm());
      setTestResult(null);
      setTestContact('');
    }
  }, [open]);

  const filteredTemplates = useMemo(
    () => templates.filter((t) => t.channel === form.channel),
    [templates, form.channel]
  );

  function updateForm(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function updateSnapshot(patch) {
    setForm((f) => ({
      ...f,
      template_snapshot: { ...f.template_snapshot, ...patch },
    }));
  }

  function pickTemplate(id) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    updateForm({
      template_id: id,
      template_snapshot: {
        header: tpl.header || '',
        body: tpl.body || '',
        footer: tpl.footer || '',
        subject: tpl.subject || '',
        caption: tpl.caption || '',
        buttons: tpl.buttons || [],
      },
    });
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error('Nama campaign wajib diisi');
      setStep(0);
      return;
    }
    if (!form.template_snapshot.body.trim()) {
      toast.error('Body template wajib diisi');
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      const customRecipients =
        form.audience_type === 'custom'
          ? parseCustomRecipients(form.audience_custom_recipients_text)
          : [];
      if (form.audience_type === 'custom' && customRecipients.length === 0) {
        toast.error('Minimal 1 recipient untuk audience custom');
        setStep(1);
        return;
      }
      const payload = {
        name: form.name.trim(),
        channel: form.channel,
        provider: form.provider || 'mock',
        audience_type: form.audience_type,
        audience_group_ids: form.audience_group_ids,
        audience_tag_ids: form.audience_tag_ids,
        audience_custom_recipients: customRecipients,
        template_id: form.template_id,
        template_snapshot: form.template_snapshot,
        schedule_type: form.schedule_type,
        scheduled_at:
          form.schedule_type === 'scheduled' && form.scheduled_at
            ? new Date(form.scheduled_at).toISOString()
            : null,
        recurrence_rule: form.schedule_type === 'recurring' ? form.recurrence_rule || null : null,
        cost_per_message: Number(form.cost_per_message) || 0,
        notes: form.notes,
      };
      const res = await api.post('/marketing/campaign', payload);
      toast.success('Campaign dibuat');
      onCreated?.(res.data);
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membuat campaign');
    } finally {
      setSaving(false);
    }
  }

  async function runTestSend() {
    if (!testContact.trim()) {
      toast.error('Isi nomor/email tujuan tester');
      return;
    }
    setTestSending(true);
    try {
      // Test send butuh campaign existing — kalau belum, simpan dulu sebagai draft.
      const customRecipients =
        form.audience_type === 'custom'
          ? parseCustomRecipients(form.audience_custom_recipients_text)
          : [];
      const draftRes = await api.post('/marketing/campaign', {
        name: form.name.trim() || `Test ${new Date().toISOString()}`,
        channel: form.channel,
        provider: form.provider || 'mock',
        audience_type: 'custom',
        audience_custom_recipients:
          customRecipients.length > 0
            ? customRecipients
            : [{ contact: testContact.trim(), label: 'Tester' }],
        template_snapshot: form.template_snapshot,
        schedule_type: 'now',
        cost_per_message: 0,
      });
      const testRes = await api.post(`/marketing/campaign/${draftRes.data.id}/test-send`, {
        contact: testContact.trim(),
        contact_label: 'Tester',
      });
      setTestResult(testRes.data);
      toast.success('Preview siap');
      // Hapus draft test (cleanup).
      try {
        await api.delete(`/marketing/campaign/${draftRes.data.id}`);
      } catch {
        /* ignore */
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal test send');
    } finally {
      setTestSending(false);
    }
  }

  if (!open) return null;

  const audienceCount = (() => {
    if (form.audience_type === 'all') return 'Semua pelanggan aktif';
    if (form.audience_type === 'group') return `${form.audience_group_ids.length} group dipilih`;
    if (form.audience_type === 'tag') return `${form.audience_tag_ids.length} tag dipilih`;
    return `${parseCustomRecipients(form.audience_custom_recipients_text).length} recipient`;
  })();

  const balance = balances?.[form.channel] ?? 0;
  const cost = Number(form.cost_per_message) || channelDef.cost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold">Buat Campaign Marketing</h3>
            <p className="text-xs text-gray-500">
              Step {step + 1} dari {STEP_TITLES.length} — {STEP_TITLES[step]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-2 text-gray-400 hover:bg-gray-100"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nama campaign</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="cth. Promo VIP Weekend"
                />
              </div>
              <div>
                <p className="text-sm font-medium">Channel</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {CHANNEL_DEFS.map((c) => {
                    const active = form.channel === c.id;
                    const Icon = c.Icon;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() =>
                          updateForm({
                            channel: c.id,
                            template_id: null,
                            cost_per_message: c.cost,
                          })
                        }
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                          active
                            ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-300'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`rounded-lg p-2 ${
                            active ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{c.label}</div>
                          <p className="text-xs text-gray-500">{c.description}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            Saldo: Rp {Number(balances?.[c.id] || 0).toLocaleString('id-ID')} ·
                            Default cost Rp {c.cost}/msg
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Provider</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.provider}
                  onChange={(e) => updateForm({ provider: e.target.value })}
                >
                  <option value="mock">Mock (simulasi delivery)</option>
                  {form.channel === 'whatsapp' && (
                    <option value="whatsapp_business_api">WhatsApp Business API</option>
                  )}
                  {form.channel === 'sms' && (
                    <>
                      <option value="twilio">Twilio</option>
                      <option value="majoo_sms">Majoo SMS Gateway</option>
                    </>
                  )}
                  {form.channel === 'email' && <option value="sendgrid">SendGrid</option>}
                  {form.channel === 'instagram' && <option value="meta_graph">Meta Graph</option>}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Wiring resmi belum aktif — pilih `mock` untuk simulasi delivery.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Audience target</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'group', label: 'Group' },
                  { id: 'tag', label: 'Tag' },
                  { id: 'custom', label: 'Custom' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateForm({ audience_type: opt.id })}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      form.audience_type === opt.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {form.audience_type === 'group' && (
                <div>
                  <p className="text-sm font-medium">Pilih group customer</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {customerGroups.map((g) => {
                      const checked = form.audience_group_ids.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={(e) =>
                              updateForm({
                                audience_group_ids: e.target.checked
                                  ? [...form.audience_group_ids, g.id]
                                  : form.audience_group_ids.filter((id) => id !== g.id),
                              })
                            }
                          />
                          <span className="font-medium">{g.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.audience_type === 'tag' && (
                <div>
                  <p className="text-sm font-medium">Pilih tag customer</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {customerTags.map((t) => {
                      const checked = form.audience_tag_ids.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            updateForm({
                              audience_tag_ids: checked
                                ? form.audience_tag_ids.filter((id) => id !== t.id)
                                : [...form.audience_tag_ids, t.id],
                            })
                          }
                          className={`rounded-full px-3 py-1 text-xs ${
                            checked ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.audience_type === 'custom' && (
                <div>
                  <p className="text-sm font-medium">
                    Daftar recipient (1 per baris, format `Nama &lt;kontak&gt;` atau `kontak`)
                  </p>
                  <textarea
                    rows={6}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                    placeholder={`Andi <08123456789>\nBudi <08222222222>`}
                    value={form.audience_custom_recipients_text}
                    onChange={(e) =>
                      updateForm({ audience_custom_recipients_text: e.target.value })
                    }
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    {parseCustomRecipients(form.audience_custom_recipients_text).length} recipient
                    terdeteksi.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {filteredTemplates.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Mulai dari template (opsional)</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={form.template_id || ''}
                    onChange={(e) => (e.target.value ? pickTemplate(Number(e.target.value)) : null)}
                  >
                    <option value="">— pilih template —</option>
                    {filteredTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {channelDef.id === 'email' && (
                <div>
                  <label className="text-sm font-medium">Subject email</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={form.template_snapshot.subject || ''}
                    onChange={(e) => updateSnapshot({ subject: e.target.value })}
                    placeholder="Subject email"
                  />
                </div>
              )}

              {channelDef.id === 'whatsapp' && (
                <div>
                  <label className="text-sm font-medium">Header (opsional)</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={form.template_snapshot.header || ''}
                    onChange={(e) => updateSnapshot({ header: e.target.value })}
                    placeholder="Header pesan"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Body pesan</label>
                <textarea
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.template_snapshot.body || ''}
                  onChange={(e) => updateSnapshot({ body: e.target.value })}
                  placeholder="Halo {{name}}, ada promo spesial untuk Anda di {{outlet}}!"
                />
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  <span className="text-gray-500">Variable:</span>
                  {VARIABLE_HINTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700 hover:bg-gray-200"
                      onClick={() =>
                        updateSnapshot({ body: (form.template_snapshot.body || '') + ` ${v}` })
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {(channelDef.id === 'whatsapp' || channelDef.id === 'email') && (
                <div>
                  <label className="text-sm font-medium">Footer (opsional)</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={form.template_snapshot.footer || ''}
                    onChange={(e) => updateSnapshot({ footer: e.target.value })}
                  />
                </div>
              )}

              {channelDef.id === 'instagram' && (
                <div>
                  <label className="text-sm font-medium">Caption IG</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={form.template_snapshot.caption || ''}
                    onChange={(e) => updateSnapshot({ caption: e.target.value })}
                    placeholder="Caption + hashtag"
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Kapan dikirim?</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { id: 'now', label: 'Kirim sekarang' },
                    { id: 'scheduled', label: 'Jadwalkan' },
                    { id: 'recurring', label: 'Berulang' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateForm({ schedule_type: opt.id })}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        form.schedule_type === opt.id
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.schedule_type === 'scheduled' && (
                <div>
                  <label className="text-sm font-medium">Tanggal & waktu kirim</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={form.scheduled_at}
                    onChange={(e) => updateForm({ scheduled_at: e.target.value })}
                  />
                </div>
              )}

              {form.schedule_type === 'recurring' && (
                <div>
                  <label className="text-sm font-medium">Aturan recurrence</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={form.recurrence_rule}
                    onChange={(e) => updateForm({ recurrence_rule: e.target.value })}
                    placeholder="e.g. FREQ=WEEKLY;BYDAY=FR;BYHOUR=17"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Schedule recurring di-eksekusi worker (P2-04). Untuk sekarang dijadikan template
                    kirim manual.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Cost per message (Rp)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.cost_per_message}
                  onChange={(e) => updateForm({ cost_per_message: Number(e.target.value) || 0 })}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Default {channelDef.cost} untuk channel {channelDef.label}. Saldo {form.channel}:{' '}
                  Rp {Number(balance).toLocaleString('id-ID')}.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Catatan internal</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={form.notes}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                  placeholder="cth. Bagian dari kampanye Q4"
                  maxLength={500}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">Ringkasan</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Channel</dt>
                    <dd className="font-medium">{channelDef.label}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Audience</dt>
                    <dd className="font-medium">{audienceCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Schedule</dt>
                    <dd className="font-medium">
                      {form.schedule_type === 'now'
                        ? 'Kirim sekarang'
                        : form.schedule_type === 'scheduled'
                          ? form.scheduled_at || '—'
                          : form.recurrence_rule || 'Recurring'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cost / message</dt>
                    <dd className="font-medium">Rp {Number(cost).toLocaleString('id-ID')}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">Preview</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-gray-800">
                  {previewMessage(form.template_snapshot, {
                    name: 'Andi',
                    outlet: 'Outlet Pusat',
                    points_balance: 320,
                    deposit_balance: 50000,
                    trx_count: 12,
                    last_visit: '2025-04-22',
                    phone: '08123456789',
                    email: 'andi@example.com',
                  })}
                </pre>
              </div>

              <div className="rounded-xl border border-dashed border-gray-300 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">Test send</p>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <input
                    type="text"
                    placeholder={
                      channelDef.contactKind === 'email' ? 'tester@example.com' : '08123456789'
                    }
                    value={testContact}
                    onChange={(e) => setTestContact(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={runTestSend}
                    disabled={testSending}
                    className="flex items-center justify-center gap-2 rounded-lg border border-primary-600 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> {testSending ? 'Mengirim…' : 'Test send'}
                  </button>
                </div>
                {testResult && (
                  <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-gray-700">
                    Provider: {testResult.provider}
                    {'\n'}Tujuan: {testResult.contact}
                    {'\n\n'}
                    {testResult.rendered_message}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" /> Kembali
          </button>
          <p className="hidden text-xs text-gray-500 md:block">
            <Hash className="-mt-0.5 mr-1 inline h-3 w-3" />
            {STEP_TITLES.map((t, i) => (i === step ? <strong key={t}> {t}</strong> : null))}
          </p>
          {step < STEP_TITLES.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEP_TITLES.length - 1, s + 1))}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Lanjut <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {saving ? 'Menyimpan…' : 'Buat Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
