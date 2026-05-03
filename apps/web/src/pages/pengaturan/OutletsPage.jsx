// Outlets — multi-cabang CRUD.
import { useEffect, useState } from 'react';
import { Edit2, MapPin, Plus, Trash2, X, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, PageHeader } from '../../components/ui';

const initForm = () => ({
  code: '',
  name: '',
  type: 'restaurant',
  address: '',
  city: '',
  province: '',
  phone: '',
  email: '',
  tax_npwp: '',
  timezone: 'Asia/Jakarta',
  currency: 'IDR',
  is_main: false,
  is_active: true,
});

export default function OutletsPage() {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initForm());
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await api.get('/outlet');
    setRows(r.data || []);
  }

  function openCreate() {
    setEditing(null);
    setForm(initForm());
    setShowForm(true);
  }

  function openEdit(o) {
    setEditing(o);
    setForm({ ...o, is_main: !!o.is_main, is_active: !!o.is_active });
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/outlet/${editing.id}`, form);
        toast.success('Outlet diperbarui');
      } else {
        await api.post('/outlet', form);
        toast.success('Outlet ditambahkan');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  }

  async function del() {
    try {
      await api.delete(`/outlet/${confirmDel.id}`);
      toast.success('Outlet dihapus');
      setConfirmDel(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Tidak bisa dihapus');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outlet"
        subtitle="Kelola cabang/outlet bisnis. Outlet utama dipakai sebagai default di transaksi."
      >
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Outlet Baru
        </button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState title="Belum ada outlet" description="Tambah outlet pertama." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Kota</th>
                <th className="px-4 py-3 text-left">Telepon</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{o.code}</td>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {o.is_main ? (
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" />
                      ) : null}
                      {o.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{o.type || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{o.city || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{o.phone || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        o.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {o.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        to={`/settings/outlets/${o.id}/floor-plan`}
                        className="rounded p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                        title="Floor plan"
                      >
                        <MapPin className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => openEdit(o)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDel(o)}
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
              <h2 className="text-base font-semibold">{editing ? 'Edit Outlet' : 'Outlet Baru'}</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode (auto-generate jika kosong)">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Tipe">
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="input-field"
                  >
                    <option value="restaurant">Restoran</option>
                    <option value="cafe">Cafe</option>
                    <option value="retail">Retail</option>
                    <option value="warehouse">Warehouse</option>
                    <option value="other">Lainnya</option>
                  </select>
                </Field>
              </div>
              <Field label="Nama Outlet" required>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kota">
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Provinsi">
                  <input
                    value={form.province}
                    onChange={(e) => setForm({ ...form, province: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telepon">
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="NPWP">
                  <input
                    value={form.tax_npwp}
                    onChange={(e) => setForm({ ...form, tax_npwp: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Mata Uang">
                  <input
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <Field label="Timezone">
                <input
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_main}
                    onChange={(e) => setForm({ ...form, is_main: e.target.checked })}
                  />
                  Outlet utama
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Aktif
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
        open={!!confirmDel}
        title="Hapus outlet?"
        message={`Outlet ${confirmDel?.name} akan dihapus permanen.`}
        confirmLabel="Hapus"
        onCancel={() => setConfirmDel(null)}
        onConfirm={del}
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
