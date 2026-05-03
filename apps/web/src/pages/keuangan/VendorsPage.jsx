// Daftar Mitra (Vendor) — CRUD master vendor.
import { useEffect, useState } from 'react';
import { Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, PageHeader } from '../../components/ui';

const initForm = () => ({
  code: '',
  name: '',
  npwp: '',
  address: '',
  phone: '',
  email: '',
  bank_name: '',
  bank_account_no: '',
  bank_account_holder: '',
  payment_terms_days: 0,
  is_active: 1,
  note: '',
});

export default function VendorsPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initForm());
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data } = await api.get('/vendor');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat vendor');
    }
  }

  const filtered = search
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.code.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

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
      npwp: row.npwp || '',
      address: row.address || '',
      phone: row.phone || '',
      email: row.email || '',
      bank_name: row.bank_name || '',
      bank_account_no: row.bank_account_no || '',
      bank_account_holder: row.bank_account_holder || '',
      payment_terms_days: row.payment_terms_days || 0,
      is_active: row.is_active,
      note: row.note || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        payment_terms_days: Number(form.payment_terms_days) || 0,
      };
      if (editing) {
        await api.put(`/vendor/${editing.id}`, payload);
        toast.success('Vendor diperbarui');
      } else {
        // Don't pass empty string code so backend auto-generates.
        if (!payload.code) delete payload.code;
        await api.post('/vendor', payload);
        toast.success('Vendor dibuat');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/vendor/${confirmDelete.id}`);
      toast.success('Vendor dihapus');
      setConfirmDelete(null);
      load();
    } catch {
      toast.error('Gagal menghapus');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Mitra (Vendor)"
        description="Master vendor untuk pembelian + pengeluaran. Bisa di-link ke akun beban default."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Vendor Baru
          </button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode atau nama vendor"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState title="Belum ada vendor" description="Tambahkan vendor baru." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">NPWP</th>
                <th className="px-4 py-3 text-left">Telp</th>
                <th className="px-4 py-3 text-left">Bank</th>
                <th className="px-4 py-3 text-right">Term (hari)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{v.code}</td>
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3 text-xs">{v.npwp || '-'}</td>
                  <td className="px-4 py-3 text-xs">{v.phone || '-'}</td>
                  <td className="px-4 py-3 text-xs">
                    {v.bank_name ? `${v.bank_name} ${v.bank_account_no || ''}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">{v.payment_terms_days}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        v.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {v.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(v)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(v)}
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
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">{editing ? 'Edit Vendor' : 'Vendor Baru'}</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode (kosongkan untuk auto)">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="input-field"
                    placeholder="VND0001"
                  />
                </Field>
                <Field label="Nama" required>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="NPWP">
                  <input
                    value={form.npwp}
                    onChange={(e) => setForm({ ...form, npwp: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Telepon">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input-field"
                />
              </Field>
              <Field label="Alamat">
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Bank">
                  <input
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="No. Rekening">
                  <input
                    value={form.bank_account_no}
                    onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="A.N.">
                  <input
                    value={form.bank_account_holder}
                    onChange={(e) => setForm({ ...form, bank_account_holder: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <Field label="Term Pembayaran (hari)">
                <input
                  type="number"
                  min={0}
                  value={form.payment_terms_days}
                  onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })}
                  className="input-field"
                />
              </Field>
              <Field label="Catatan">
                <textarea
                  rows={2}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vendor_is_active"
                  checked={!!form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="vendor_is_active" className="text-sm">
                  Vendor aktif
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
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
        title="Hapus vendor?"
        description={`Vendor ${confirmDelete?.code} ${confirmDelete?.name} akan dihapus.`}
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
