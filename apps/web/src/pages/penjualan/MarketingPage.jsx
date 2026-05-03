// Halaman Marketing (P1-11) — list campaign, list template, ledger kredit per
// channel + tombol top-up. Untuk buat campaign baru pakai CampaignBuilder
// (5-step wizard).
import { useEffect, useMemo, useState } from 'react';
import {
  Megaphone,
  Plus,
  Send,
  Trash2,
  Wallet,
  Mail,
  Smartphone,
  MessageCircle,
  Image as ImageIcon,
  CheckCircle2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmationDialog, EmptyState, FilterTabs, PageHeader } from '../../components/ui';
import CampaignBuilder from '../../components/marketing/CampaignBuilder';

const TABS = [
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'templates', label: 'Template' },
  { id: 'credit', label: 'Saldo Kredit' },
];

const CHANNEL_LABELS = {
  whatsapp: 'WA',
  sms: 'SMS',
  email: 'Email',
  instagram: 'IG',
};

const CHANNEL_ICONS = {
  whatsapp: MessageCircle,
  sms: Smartphone,
  email: Mail,
  instagram: ImageIcon,
};

const STATUS_BADGES = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  canceled: 'bg-slate-200 text-slate-600',
};

function ChannelChip({ channel }) {
  const Icon = CHANNEL_ICONS[channel] || Megaphone;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
      <Icon className="h-3 w-3" /> {CHANNEL_LABELS[channel] || channel}
    </span>
  );
}

function StatusChip({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_BADGES[status] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  );
}

function TemplateDialog({ template, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    name: template?.name || '',
    channel: template?.channel || 'whatsapp',
    header: template?.header || '',
    body: template?.body || '',
    footer: template?.footer || '',
    subject: template?.subject || '',
    caption: template?.caption || '',
    buttons: template?.buttons || [],
  }));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim() || !form.body.trim()) {
      toast.error('Nama + body wajib diisi');
      return;
    }
    setSaving(true);
    try {
      if (template?.id) {
        await api.put(`/marketing/template/${template.id}`, form);
      } else {
        await api.post('/marketing/template', form);
      }
      toast.success('Template tersimpan');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal simpan template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold">{template?.id ? 'Edit Template' : 'Template Baru'}</h3>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <div>
            <label className="text-sm font-medium">Nama</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Channel</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          {form.channel === 'email' && (
            <div>
              <label className="text-sm font-medium">Subject</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Body</label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Halo {{name}}, ada promo spesial!"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Footer (opsional)</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.footer}
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopupDialog({ onClose, onSaved }) {
  const [form, setForm] = useState({ channel: 'whatsapp', amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  async function save() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Jumlah top up harus positif');
      return;
    }
    setSaving(true);
    try {
      await api.post('/marketing/credit/topup', {
        channel: form.channel,
        amount,
        notes: form.notes,
      });
      toast.success('Top up berhasil');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal top up');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold">Top up Saldo</h3>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <div>
            <label className="text-sm font-medium">Channel</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Jumlah (Rp)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Catatan</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Top up'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignDetail({ campaign, onClose, onSent }) {
  const [recipients, setRecipients] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [r, rep] = await Promise.all([
        api.get(`/marketing/campaign/${campaign.id}/recipients?limit=20`),
        api.get(`/marketing/campaign/${campaign.id}/report`),
      ]);
      setRecipients(r.data.items || []);
      setReport(rep.data);
    } catch {
      toast.error('Gagal memuat detail');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  async function send() {
    setSending(true);
    try {
      await api.post(`/marketing/campaign/${campaign.id}/send`);
      toast.success('Campaign dikirim');
      onSent?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal kirim');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold">{campaign.name}</h3>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <ChannelChip channel={campaign.channel} />
              <StatusChip status={campaign.status} />
              <span className="text-gray-500">
                Cost Rp {Number(campaign.total_cost).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
          {report && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                { label: 'Recipients', value: report.total_recipients },
                { label: 'Delivered', value: report.delivered },
                { label: 'Opened', value: report.opened },
                { label: 'Clicked', value: report.clicked },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{m.value}</p>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Sample Recipients</p>
            <div className="mt-2 overflow-x-auto rounded-xl ring-1 ring-gray-100">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Kontak</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Pesan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                        Memuat…
                      </td>
                    </tr>
                  ) : recipients.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                        Belum ada recipient.
                      </td>
                    </tr>
                  ) : (
                    recipients.map((r) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">
                            {r.customer_name || r.contact_label || r.contact}
                          </div>
                          <div className="text-xs text-gray-500">{r.contact}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <StatusChip status={r.status} />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <pre className="max-w-md whitespace-pre-wrap text-xs text-gray-700">
                            {r.rendered_message}
                          </pre>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Tutup
          </button>
          {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
            <button
              onClick={send}
              disabled={sending}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {sending ? 'Mengirim…' : 'Kirim sekarang'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('campaigns');
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [balances, setBalances] = useState({
    whatsapp: 0,
    sms: 0,
    email: 0,
    instagram: 0,
  });
  const [ledger, setLedger] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showTopup, setShowTopup] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [activeCampaign, setActiveCampaign] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [c, t, b, l, g, tg] = await Promise.all([
        api.get('/marketing/campaign?limit=100'),
        api.get('/marketing/template'),
        api.get('/marketing/credit/balance'),
        api.get('/marketing/credit/ledger?limit=50'),
        api.get('/customer-groups'),
        api.get('/customer-tags'),
      ]);
      setCampaigns(c.data.items || []);
      setTemplates(t.data || []);
      setBalances(b.data || {});
      setLedger(l.data.items || []);
      setGroups(g.data || []);
      setTags(tg.data || []);
    } catch {
      toast.error('Gagal memuat data marketing');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteTemplate(id) {
    try {
      await api.delete(`/marketing/template/${id}`);
      toast.success('Template dihapus');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal hapus');
    } finally {
      setConfirmDelete(null);
    }
  }

  async function deleteCampaign(id) {
    try {
      await api.delete(`/marketing/campaign/${id}`);
      toast.success('Campaign dihapus');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal hapus');
    } finally {
      setConfirmDelete(null);
    }
  }

  const totalBalance = useMemo(
    () => Object.values(balances || {}).reduce((acc, n) => acc + Number(n || 0), 0),
    [balances]
  );

  return (
    <div>
      <PageHeader
        title="Marketing"
        subtitle="WhatsApp Blast, SMS, Email, dan IG Feed dengan variable substitution + cost tracking."
        icon={Megaphone}
      >
        {isAdmin && tab === 'campaigns' && (
          <button
            type="button"
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Buat Campaign
          </button>
        )}
        {isAdmin && tab === 'templates' && (
          <button
            type="button"
            onClick={() => {
              setEditingTemplate(null);
              setShowTemplate(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Template Baru
          </button>
        )}
        {isAdmin && tab === 'credit' && (
          <button
            type="button"
            onClick={() => setShowTopup(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Wallet className="h-4 w-4" /> Top up
          </button>
        )}
      </PageHeader>

      <FilterTabs tabs={TABS} activeId={tab} onChange={setTab} />

      {tab === 'campaigns' && (
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-left">Audience</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Sent / Total</th>
                <th className="px-4 py-3 text-right">Cost (Rp)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Memuat…
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <EmptyState
                      title="Belum ada campaign"
                      description="Mulai dengan membuat WA Blast atau Email Blast pertama."
                    />
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3">
                      <ChannelChip channel={c.channel} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.audience_type}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {c.sent_count} /{' '}
                      {c.delivered_count +
                        c.failed_count +
                        (c.sent_count - c.delivered_count - c.failed_count) || c.sent_count}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {Number(c.total_cost).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setActiveCampaign(c)}
                          className="rounded p-1 text-primary-600 hover:bg-primary-50"
                          title="Detail"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        {isAdmin && c.status !== 'sent' && c.status !== 'sending' && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({ kind: 'campaign', id: c.id, name: c.name })
                            }
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'templates' && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="text-sm text-gray-400">Memuat…</p>
          ) : templates.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3">
              <EmptyState
                title="Belum ada template"
                description="Simpan template pesan supaya tidak perlu mengetik ulang setiap kali blast."
              />
            </div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <ChannelChip channel={t.channel} />
                    <h4 className="mt-2 text-sm font-semibold">{t.name}</h4>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTemplate(t);
                          setShowTemplate(true);
                        }}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({ kind: 'template', id: t.id, name: t.name })
                        }
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                  {t.subject ? `Subject: ${t.subject}\n\n` : ''}
                  {t.body}
                </pre>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'credit' && (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {Object.entries(balances).map(([channel, bal]) => {
              const Icon = CHANNEL_ICONS[channel] || Megaphone;
              return (
                <div
                  key={channel}
                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
                >
                  <div className="flex items-center gap-2 text-xs uppercase text-gray-500">
                    <Icon className="h-4 w-4" /> {CHANNEL_LABELS[channel] || channel}
                  </div>
                  <p className="mt-2 text-xl font-bold text-gray-900">
                    Rp {Number(bal).toLocaleString('id-ID')}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-gray-100">
            <p className="text-xs uppercase tracking-wider text-gray-500">Total saldo gabungan</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              Rp {Number(totalBalance).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Channel</th>
                  <th className="px-4 py-3 text-left">Tipe</th>
                  <th className="px-4 py-3 text-right">Δ (Rp)</th>
                  <th className="px-4 py-3 text-right">Saldo (Rp)</th>
                  <th className="px-4 py-3 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                      Belum ada transaksi.
                    </td>
                  </tr>
                ) : (
                  ledger.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3 text-gray-600">
                        {e.created_at ? String(e.created_at).slice(0, 19) : ''}
                      </td>
                      <td className="px-4 py-3">
                        <ChannelChip channel={e.channel} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{e.type}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          Number(e.delta) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {Number(e.delta) > 0 ? '+' : ''}
                        {Number(e.delta).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {Number(e.balance_after).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{e.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CampaignBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onCreated={() => load()}
        customerGroups={groups}
        customerTags={tags}
        templates={templates}
        balances={balances}
      />

      {showTemplate && (
        <TemplateDialog
          template={editingTemplate}
          onClose={() => {
            setShowTemplate(false);
            setEditingTemplate(null);
          }}
          onSaved={() => {
            setShowTemplate(false);
            setEditingTemplate(null);
            load();
          }}
        />
      )}

      {showTopup && (
        <TopupDialog
          onClose={() => setShowTopup(false)}
          onSaved={() => {
            setShowTopup(false);
            load();
          }}
        />
      )}

      {activeCampaign && (
        <CampaignDetail
          campaign={activeCampaign}
          onClose={() => setActiveCampaign(null)}
          onSent={() => load()}
        />
      )}

      {confirmDelete && (
        <ConfirmationDialog
          isOpen
          title={confirmDelete.kind === 'template' ? 'Hapus Template?' : 'Hapus Campaign?'}
          message={`Hapus "${confirmDelete.name}"? Tindakan ini tidak bisa diurungkan.`}
          onConfirm={() =>
            confirmDelete.kind === 'template'
              ? deleteTemplate(confirmDelete.id)
              : deleteCampaign(confirmDelete.id)
          }
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
