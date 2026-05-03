// Loyalty: rules (earn/redemption) + tier overview (read-only dari customer-groups)
// + manual point adjust + ledger.
import { useEffect, useMemo, useState } from 'react';
import { Edit2, HeartHandshake, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmationDialog, EmptyState, FilterTabs, PageHeader } from '../../components/ui';

const TABS = [
  { id: 'rules', label: 'Rules' },
  { id: 'tiers', label: 'Tier Customer' },
  { id: 'ledger', label: 'Ledger Poin' },
];

const RULE_TYPE_LABELS = {
  earn_per_total: 'Earn — per total',
  earn_per_product: 'Earn — per produk',
  redemption: 'Redemption',
};

const initRuleForm = () => ({
  id: null,
  name: '',
  rule_type: 'earn_per_total',
  earn_rate: '',
  bonus_points: '',
  redemption_rate: '',
  min_redeem_per_transaction: '',
  max_redeem_per_transaction: '',
  redemption_block: '',
  points_expire_after_months: '',
  excluded_payment_methods: [],
  is_active: true,
});

function RuleDialog({ rule, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    rule
      ? {
          ...initRuleForm(),
          ...rule,
          earn_rate: rule.earn_rate ?? '',
          bonus_points: rule.bonus_points ?? '',
          redemption_rate: rule.redemption_rate ?? '',
          min_redeem_per_transaction: rule.min_redeem_per_transaction ?? '',
          max_redeem_per_transaction: rule.max_redeem_per_transaction ?? '',
          redemption_block: rule.redemption_block ?? '',
          points_expire_after_months: rule.points_expire_after_months ?? '',
          excluded_payment_methods: rule.excluded_payment_methods || [],
          is_active: !!rule.is_active,
        }
      : initRuleForm()
  );
  const [saving, setSaving] = useState(false);

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Nama rule wajib');
      return;
    }
    setSaving(true);
    try {
      const trimNum = (v) => (v === '' || v === null ? null : Number(v));
      const payload = {
        name: form.name.trim(),
        rule_type: form.rule_type,
        earn_rate: trimNum(form.earn_rate),
        bonus_points: trimNum(form.bonus_points),
        redemption_rate: trimNum(form.redemption_rate),
        min_redeem_per_transaction: trimNum(form.min_redeem_per_transaction),
        max_redeem_per_transaction: trimNum(form.max_redeem_per_transaction),
        redemption_block: trimNum(form.redemption_block),
        points_expire_after_months: trimNum(form.points_expire_after_months),
        target_product_ids: form.target_product_ids || [],
        excluded_payment_methods: form.excluded_payment_methods,
        is_active: form.is_active,
      };
      if (rule?.id) {
        await api.put(`/loyalty-rule/${rule.id}`, payload);
        toast.success('Rule diupdate');
      } else {
        await api.post('/loyalty-rule', payload);
        toast.success('Rule dibuat');
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan rule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold">
            {rule?.id ? 'Edit Rule Loyalty' : 'Buat Rule Loyalty'}
          </h3>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <div>
            <label className="text-sm font-medium">Nama rule</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="cth. Earn 1 poin per Rp 1.000"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Tipe rule</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.rule_type}
              onChange={(e) => update({ rule_type: e.target.value })}
            >
              <option value="earn_per_total">Earn — per total transaksi</option>
              <option value="earn_per_product">Earn — per produk tertentu</option>
              <option value="redemption">Redemption (tukar poin)</option>
            </select>
          </div>

          {form.rule_type === 'earn_per_total' && (
            <div>
              <label className="text-sm font-medium">Earn rate (Rp per 1 poin)</label>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                value={form.earn_rate}
                onChange={(e) => update({ earn_rate: e.target.value })}
                placeholder="cth. 1000 → setiap Rp 1.000 = 1 poin"
              />
            </div>
          )}

          {form.rule_type === 'earn_per_product' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Bonus poin per produk</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.bonus_points}
                  onChange={(e) => update({ bonus_points: e.target.value })}
                  placeholder="cth. 50"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Earn rate (per Rp)</label>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.earn_rate}
                  onChange={(e) => update({ earn_rate: e.target.value })}
                  placeholder="opsional"
                />
              </div>
            </div>
          )}

          {form.rule_type === 'redemption' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Redemption rate (Rp per 1 poin)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={form.redemption_rate}
                  onChange={(e) => update({ redemption_rate: e.target.value })}
                  placeholder="cth. 50 → 100 poin = Rp 5.000"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Min poin / transaksi</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.min_redeem_per_transaction}
                    onChange={(e) => update({ min_redeem_per_transaction: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Maks poin / transaksi</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.max_redeem_per_transaction}
                    onChange={(e) => update({ max_redeem_per_transaction: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Block size</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.redemption_block}
                    onChange={(e) => update({ redemption_block: e.target.value })}
                    placeholder="kelipatan, cth. 100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Poin expire (bulan)</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    value={form.points_expire_after_months}
                    onChange={(e) => update({ points_expire_after_months: e.target.value })}
                    placeholder="cth. 12"
                  />
                </div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update({ is_active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            Aktif
          </label>
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

function AdjustDialog({ customers, onClose, onSaved }) {
  const [form, setForm] = useState({
    customer_id: '',
    points: 0,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const filteredCustomers = useMemo(
    () =>
      customers
        .filter(
          (c) =>
            !search ||
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.phone || '').includes(search)
        )
        .slice(0, 50),
    [customers, search]
  );

  async function save() {
    if (!form.customer_id) {
      toast.error('Pilih customer dulu');
      return;
    }
    if (!form.points || Number(form.points) === 0) {
      toast.error('Jumlah poin tidak boleh 0');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/loyalty/adjust', {
        customer_id: Number(form.customer_id),
        points: Number(form.points),
        notes: form.notes.trim() || undefined,
      });
      toast.success(`Saldo baru: ${res.data.balance} poin`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal adjust poin');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold">Adjust Poin Manual</h3>
          <button onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <div>
            <label className="text-sm font-medium">Cari customer</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama atau telp"
            />
            <select
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              size={5}
            >
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.points || 0} poin)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">
              Jumlah poin (positif=tambah, negatif=kurangi)
            </label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Catatan</label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="cth. Bonus opening"
              maxLength={255}
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

export default function LoyaltyPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [ledger, setLedger] = useState({ items: [], total: 0 });
  const [customers, setCustomers] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [showRule, setShowRule] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [r, t, l, c] = await Promise.all([
        api.get('/loyalty-rule'),
        api.get('/customer-groups'),
        api.get('/loyalty/transactions'),
        api.get('/customers'),
      ]);
      setRules(r.data);
      setTiers(t.data);
      setLedger(l.data);
      setCustomers((c.data?.items || c.data || []).map((cust) => cust));
    } catch (err) {
      toast.error('Gagal memuat data loyalty');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteRule(id) {
    try {
      await api.delete(`/loyalty-rule/${id}`);
      toast.success('Rule dihapus');
      load();
    } catch (err) {
      toast.error('Gagal hapus rule');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Loyalty"
        subtitle="Atur earn rate, redemption, tier customer, dan ledger poin."
        icon={HeartHandshake}
      >
        {isAdmin && tab === 'rules' && (
          <button
            type="button"
            onClick={() => {
              setEditingRule(null);
              setShowRule(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Buat Rule
          </button>
        )}
        {isAdmin && tab === 'ledger' && (
          <button
            type="button"
            onClick={() => setShowAdjust(true)}
            className="flex items-center gap-2 rounded-lg border border-primary-600 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
          >
            Adjust Poin
          </button>
        )}
      </PageHeader>

      <FilterTabs tabs={TABS} activeId={tab} onChange={setTab} />

      {tab === 'rules' && (
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Detail</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Memuat…
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <EmptyState
                      title="Belum ada rule"
                      description="Buat rule untuk mengaktifkan earn/redemption poin."
                    />
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        {RULE_TYPE_LABELS[r.rule_type] || r.rule_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {r.rule_type === 'earn_per_total' &&
                        r.earn_rate &&
                        `Rp ${Number(r.earn_rate).toLocaleString('id-ID')} = 1 poin`}
                      {r.rule_type === 'earn_per_product' &&
                        `${r.bonus_points || 0} poin per produk`}
                      {r.rule_type === 'redemption' &&
                        r.redemption_rate &&
                        `1 poin = Rp ${Number(r.redemption_rate).toLocaleString('id-ID')}`}
                      {r.points_expire_after_months ? (
                        <span className="ml-1 rounded bg-yellow-100 px-1 py-0.5 text-[10px] text-yellow-700">
                          expire {r.points_expire_after_months} bln
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {r.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRule(r);
                              setShowRule(true);
                            }}
                            className="rounded p-1 text-gray-600 hover:bg-gray-100"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(r)}
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'tiers' && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {tiers.length === 0 ? (
            <div className="md:col-span-3">
              <EmptyState
                title="Belum ada tier"
                description="Buat customer group di menu Pelanggan → Grup. Setiap grup berfungsi sebagai tier dengan benefit (discount_percent + points_multiplier)."
              />
            </div>
          ) : (
            tiers.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
                style={{ borderLeft: `4px solid ${t.color || '#04C99E'}` }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold">{t.name}</h3>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                    {t.member_count ?? 0} member
                  </span>
                </div>
                {t.description && <p className="mt-1 text-sm text-gray-500">{t.description}</p>}
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Diskon</span>
                    <span className="font-semibold">{t.discount_percent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Multiplier poin</span>
                    <span className="font-semibold">{t.points_multiplier}x</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-right">Poin</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-left">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ledger.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState
                      title="Belum ada aktivitas poin"
                      description="Earn/redeem akan muncul di sini setelah ada transaksi."
                    />
                  </td>
                </tr>
              ) : (
                ledger.items.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(t.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3">{t.customer_name || `#${t.customer_id}`}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          t.type === 'earn'
                            ? 'bg-green-100 text-green-700'
                            : t.type === 'redeem'
                              ? 'bg-blue-100 text-blue-700'
                              : t.type === 'expire'
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono ${
                        t.points >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {t.points > 0 ? '+' : ''}
                      {t.points}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{t.balance_after}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{t.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showRule && (
        <RuleDialog
          rule={editingRule}
          onClose={() => {
            setShowRule(false);
            setEditingRule(null);
          }}
          onSaved={load}
        />
      )}
      {showAdjust && (
        <AdjustDialog customers={customers} onClose={() => setShowAdjust(false)} onSaved={load} />
      )}
      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus rule?"
        message={confirmDelete ? `Rule "${confirmDelete.name}" akan dihapus.` : ''}
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={() => confirmDelete && deleteRule(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
