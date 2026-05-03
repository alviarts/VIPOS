import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { key: 'manager', label: 'Manager' },
  { key: 'kasir', label: 'Kasir' },
  { key: 'staff', label: 'Staff' },
  { key: 'waiters', label: 'Waiters' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'kitchen', label: 'Kitchen' },
];

const initForm = () => ({
  name: '',
  description: '',
  type: 'FIXED',
  applies_to_scope: 'all',
  applies_to_role_keys: [],
  applies_to_employee_ids: [],
  applies_to_products_scope: 'all',
  applies_to_category_ids: [],
  applies_to_product_ids: [],
  amount: '',
  amount_basis: 'PER_TRANSACTION',
  tiers: [{ from: 0, to: 1000000, percentage: 2 }],
  calc_period: 'MONTH',
  is_active: true,
});

function MultiSelect({ label, options, selected, onChange, getKey, getLabel }) {
  return (
    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto p-2">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      {options.length === 0 && <div className="text-xs text-gray-400">Tidak ada data</div>}
      {options.map((opt) => {
        const k = getKey(opt);
        const checked = selected.some((s) => String(s) === String(k));
        return (
          <label
            key={k}
            className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                if (checked) onChange(selected.filter((s) => String(s) !== String(k)));
                else onChange([...selected, k]);
              }}
              className="rounded text-primary-600"
            />
            <span className="text-sm">{getLabel(opt)}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function CommissionGroupForm({ open, group, onClose, onSaved }) {
  const [form, setForm] = useState(initForm());
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(group ? fromGroup(group) : initForm());
    Promise.all([
      api
        .get('/categories')
        .then((r) => setCategories(r.data || []))
        .catch(() => {}),
      api
        .get('/products?limit=500')
        .then((r) => {
          const data = r.data?.products || r.data || [];
          setProducts(data);
        })
        .catch(() => {}),
      api
        .get('/auth/users')
        .then((r) => setEmployees(r.data || []))
        .catch(() => setEmployees([])),
    ]);
  }, [open, group]);

  const visibleProducts = useMemo(() => products.filter((p) => p.is_active !== 0), [products]);

  function fromGroup(g) {
    return {
      ...initForm(),
      ...g,
      amount: g.amount === null || g.amount === undefined ? '' : String(g.amount),
      applies_to_role_keys: g.applies_to_role_keys || [],
      applies_to_employee_ids: g.applies_to_employee_ids || [],
      applies_to_category_ids: g.applies_to_category_ids || [],
      applies_to_product_ids: g.applies_to_product_ids || [],
      tiers:
        Array.isArray(g.tiers) && g.tiers.length
          ? g.tiers
          : [{ from: 0, to: 1000000, percentage: 2 }],
      is_active: g.is_active !== false && g.is_active !== 0,
    };
  }

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function updateTier(idx, patch) {
    setForm((f) => ({
      ...f,
      tiers: f.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  }

  function addTier() {
    setForm((f) => {
      const last = f.tiers[f.tiers.length - 1];
      const newFrom = last && last.to ? Number(last.to) : 0;
      return { ...f, tiers: [...f.tiers, { from: newFrom, to: null, percentage: 0 }] };
    });
  }

  function removeTier(idx) {
    setForm((f) => ({ ...f, tiers: f.tiers.filter((_, i) => i !== idx) }));
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Nama wajib diisi');
      return;
    }
    if (form.type === 'FIXED' && (!form.amount || Number(form.amount) <= 0)) {
      toast.error('Amount wajib > 0 untuk FIXED');
      return;
    }
    if (
      form.type === 'TIERED' &&
      (!form.tiers.length || form.tiers.some((t) => t.percentage < 0))
    ) {
      toast.error('Minimal 1 tier valid');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        type: form.type,
        applies_to_scope: form.applies_to_scope,
        applies_to_role_keys: form.applies_to_scope === 'roles' ? form.applies_to_role_keys : null,
        applies_to_employee_ids:
          form.applies_to_scope === 'employees' ? form.applies_to_employee_ids.map(Number) : null,
        applies_to_products_scope: form.applies_to_products_scope,
        applies_to_category_ids:
          form.applies_to_products_scope === 'categories'
            ? form.applies_to_category_ids.map(Number)
            : null,
        applies_to_product_ids:
          form.applies_to_products_scope === 'products'
            ? form.applies_to_product_ids.map(Number)
            : null,
        amount: form.type === 'FIXED' ? Number(form.amount) : null,
        amount_basis: form.amount_basis,
        tiers:
          form.type === 'TIERED'
            ? form.tiers.map((t) => ({
                from: Number(t.from) || 0,
                to: t.to === null || t.to === '' ? null : Number(t.to),
                percentage: Number(t.percentage) || 0,
              }))
            : null,
        calc_period: form.calc_period,
        is_active: !!form.is_active,
      };
      if (group?.id) {
        await api.put(`/commission-group/${group.id}`, payload);
        toast.success('Grup komisi diupdate');
      } else {
        await api.post('/commission-group', payload);
        toast.success('Grup komisi dibuat');
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold">{group ? 'Edit Grup Komisi' : 'Buat Grup Komisi'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nama Grup *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              className="input w-full"
              placeholder="contoh: Komisi Spa Tier 1"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Deskripsi</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => update({ description: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Catatan internal (opsional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Jenis Komisi *</label>
              <select
                value={form.type}
                onChange={(e) => update({ type: e.target.value })}
                className="input w-full"
              >
                <option value="FIXED">Tetap (Fixed)</option>
                <option value="TIERED">Bertingkat (Tiered)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Periode Kalkulasi</label>
              <select
                value={form.calc_period}
                onChange={(e) => update({ calc_period: e.target.value })}
                className="input w-full"
              >
                <option value="DAY">Per Hari</option>
                <option value="WEEK">Per Minggu</option>
                <option value="MONTH">Per Bulan</option>
              </select>
            </div>
          </div>

          {form.type === 'FIXED' && (
            <div className="grid grid-cols-2 gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount (Rp) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => update({ amount: e.target.value })}
                  className="input w-full"
                  placeholder="5000"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dihitung</label>
                <select
                  value={form.amount_basis}
                  onChange={(e) => update({ amount_basis: e.target.value })}
                  className="input w-full"
                >
                  <option value="PER_TRANSACTION">Per Transaksi</option>
                  <option value="PER_ITEM">Per Item</option>
                </select>
              </div>
            </div>
          )}

          {form.type === 'TIERED' && (
            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
              <div className="text-sm font-medium text-gray-700">Tier Persentase</div>
              {form.tiers.map((t, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <label className="block text-[10px] text-gray-400">Dari (Rp)</label>
                    <input
                      type="number"
                      value={t.from}
                      onChange={(e) => updateTier(idx, { from: e.target.value })}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-gray-400">Sampai (Rp)</label>
                    <input
                      type="number"
                      value={t.to ?? ''}
                      onChange={(e) =>
                        updateTier(idx, { to: e.target.value === '' ? null : e.target.value })
                      }
                      placeholder="∞"
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] text-gray-400">% Komisi</label>
                    <input
                      type="number"
                      step="0.1"
                      value={t.percentage}
                      onChange={(e) => updateTier(idx, { percentage: e.target.value })}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <button
                      onClick={() => removeTier(idx)}
                      disabled={form.tiers.length <= 1}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addTier} className="btn-secondary text-xs flex items-center gap-1">
                <Plus className="w-3 h-3" /> Tambah Tier
              </button>
            </div>
          )}

          <div className="border-t pt-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Berlaku untuk Karyawan</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { v: 'all', label: 'Semua' },
                { v: 'roles', label: 'Role tertentu' },
                { v: 'employees', label: 'Karyawan tertentu' },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => update({ applies_to_scope: o.v })}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    form.applies_to_scope === o.v
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {form.applies_to_scope === 'roles' && (
              <MultiSelect
                label="Pilih role"
                options={ROLE_OPTIONS}
                selected={form.applies_to_role_keys}
                onChange={(arr) => update({ applies_to_role_keys: arr })}
                getKey={(o) => o.key}
                getLabel={(o) => o.label}
              />
            )}
            {form.applies_to_scope === 'employees' && (
              <MultiSelect
                label="Pilih karyawan"
                options={employees}
                selected={form.applies_to_employee_ids.map(String)}
                onChange={(arr) => update({ applies_to_employee_ids: arr })}
                getKey={(o) => o.id}
                getLabel={(o) => `${o.name} (${o.role})`}
              />
            )}
          </div>

          <div className="border-t pt-3">
            <div className="text-sm font-medium text-gray-700 mb-2">Berlaku untuk Produk</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[
                { v: 'all', label: 'Semua' },
                { v: 'categories', label: 'Kategori tertentu' },
                { v: 'products', label: 'Produk tertentu' },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => update({ applies_to_products_scope: o.v })}
                  className={`px-3 py-2 text-sm rounded-lg border ${
                    form.applies_to_products_scope === o.v
                      ? 'bg-primary-50 border-primary-500 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {form.applies_to_products_scope === 'categories' && (
              <MultiSelect
                label="Pilih kategori"
                options={categories}
                selected={form.applies_to_category_ids.map(String)}
                onChange={(arr) => update({ applies_to_category_ids: arr })}
                getKey={(o) => o.id}
                getLabel={(o) => o.name}
              />
            )}
            {form.applies_to_products_scope === 'products' && (
              <MultiSelect
                label="Pilih produk"
                options={visibleProducts}
                selected={form.applies_to_product_ids.map(String)}
                onChange={(arr) => update({ applies_to_product_ids: arr })}
                getKey={(o) => o.id}
                getLabel={(o) => o.name}
              />
            )}
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => update({ is_active: e.target.checked })}
              className="rounded text-primary-600"
            />
            <span className="text-sm">Aktif</span>
          </label>
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-secondary">
            Batal
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
