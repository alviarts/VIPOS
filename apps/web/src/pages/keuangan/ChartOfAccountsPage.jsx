// Chart of Accounts (CoA) — list + CRUD form.
import { useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, FilterTabs, PageHeader } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

const TYPE_TABS = [
  { id: 'all', label: 'Semua' },
  { id: 'ASET', label: 'Aset' },
  { id: 'KEWAJIBAN', label: 'Kewajiban' },
  { id: 'MODAL', label: 'Modal' },
  { id: 'PENDAPATAN', label: 'Pendapatan' },
  { id: 'BEBAN', label: 'Beban' },
];

const TYPE_OPTIONS = TYPE_TABS.filter((t) => t.id !== 'all');

const initForm = () => ({
  code: '',
  name: '',
  type: 'ASET',
  subtype: '',
  parent_id: '',
  opening_balance: 0,
  description: '',
  is_active: 1,
});

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [typeTab, setTypeTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initForm());
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      const { data } = await api.get('/account');
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat akun');
    }
  }

  const filtered = useMemo(() => {
    let rows = accounts;
    if (typeTab !== 'all') rows = rows.filter((a) => a.type === typeTab);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [accounts, typeTab, search]);

  function openCreate() {
    setEditing(null);
    setForm(initForm());
    setShowForm(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      type: row.type,
      subtype: row.subtype || '',
      parent_id: row.parent_id || '',
      opening_balance: row.opening_balance || 0,
      description: row.description || '',
      is_active: row.is_active,
    });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        parent_id: form.parent_id || null,
        subtype: form.subtype || null,
        opening_balance: Number(form.opening_balance) || 0,
      };
      if (editing) {
        await api.put(`/account/${editing.id}`, payload);
        toast.success('Akun diperbarui');
      } else {
        await api.post('/account', payload);
        toast.success('Akun dibuat');
      }
      setShowForm(false);
      loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan akun');
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/account/${confirmDelete.id}`);
      toast.success('Akun dihapus');
      setConfirmDelete(null);
      loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus akun');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Akun (Chart of Accounts)"
        description="Standar SAK ETAP — 1xxx Aset, 2xxx Kewajiban, 3xxx Modal, 4xxx Pendapatan, 5xxx Beban."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Akun Baru
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs tabs={TYPE_TABS} active={typeTab} onChange={setTypeTab} />
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode atau nama"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState
            title="Belum ada akun"
            description="Tambahkan akun baru atau import dari template SAK ETAP."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Nama Akun</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Sub-tipe</th>
                <th className="px-4 py-3 text-left">Saldo Normal</th>
                <th className="px-4 py-3 text-right">Saldo Awal</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((acc) => (
                <tr key={acc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{acc.code}</td>
                  <td className="px-4 py-3 font-medium">{acc.name}</td>
                  <td className="px-4 py-3 text-xs">{acc.type}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{acc.subtype || '-'}</td>
                  <td className="px-4 py-3 text-xs uppercase">{acc.normal_balance}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(acc.opening_balance)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        acc.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {acc.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(acc)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(acc)}
                        className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">{editing ? 'Edit Akun' : 'Akun Baru'}</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode" required>
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="input-field"
                    placeholder="cth: 1101"
                  />
                </Field>
                <Field label="Tipe" required>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="input-field"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Nama Akun" required>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sub-tipe">
                  <input
                    value={form.subtype}
                    onChange={(e) => setForm({ ...form, subtype: e.target.value })}
                    className="input-field"
                    placeholder="cth: Kas & Bank"
                  />
                </Field>
                <Field label="Saldo Awal">
                  <input
                    type="number"
                    value={form.opening_balance}
                    onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <Field label="Deskripsi">
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={!!form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="is_active" className="text-sm">
                  Akun aktif
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus akun?"
        description={`Akun ${confirmDelete?.code} ${confirmDelete?.name} akan dihapus permanen. Akun yang sudah terpakai di journal tidak bisa dihapus.`}
        confirmLabel="Hapus"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
