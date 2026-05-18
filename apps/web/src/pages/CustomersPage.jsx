import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users, X, Download, Upload } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';
import {
  ConfirmationDialog, EmptyState, Pagination, PageHeader,
} from '../components/ui';

export default function CustomersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editCust, setEditCust] = useState(null);
  const [form, setForm] = useState(initForm());
  const [errors, setErrors] = useState({});

  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/customers?active_only=false');
      setCustomers(res.data);
    } catch (err) {
      toast.error('Gagal memuat pelanggan');
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.kode, c.phone, c.email, c.address]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [customers, search]);

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search]);

  const openForm = (cust = null) => {
    setEditCust(cust);
    if (cust) {
      setForm({
        kode: cust.kode || '',
        name: cust.name || '',
        phone: cust.phone || '',
        email: cust.email || '',
        address: cust.address || '',
        gender: cust.gender || '',
        birth_date: cust.birth_date || '',
        points: String(cust.points ?? 0),
        deposit: String(cust.deposit ?? 0),
        notes: cust.notes || '',
      });
    } else {
      setForm(initForm());
    }
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditCust(null);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama pelanggan wajib diisi';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Format email tidak valid';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    setConfirmSave(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      const payload = {
        kode: form.kode.trim() || undefined,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        points: parseInt(form.points, 10) || 0,
        deposit: parseFloat(form.deposit) || 0,
        notes: form.notes.trim() || null,
      };
      if (editCust) {
        await api.put(`/customers/${editCust.id}`, payload);
        toast.success(`Pelanggan ${form.name} berhasil diupdate`);
      } else {
        await api.post('/customers', payload);
        toast.success(`Pelanggan ${form.name} berhasil ditambahkan`);
      }
      setConfirmSave(false);
      closeForm();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/customers/${confirmDelete.id}`);
      toast.success('Pelanggan berhasil dihapus');
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Daftar Pelanggan" subtitle={`${customers.length} pelanggan`} icon={Users}>
        <button
          onClick={() => toast('Fitur Ekspor Data segera hadir', { icon: 'ℹ️' })}
          className="flex items-center gap-1.5 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm"
        >
          <Download className="w-4 h-4" /> Ekspor
        </button>
        <button
          onClick={() => toast('Fitur Impor Data segera hadir', { icon: 'ℹ️' })}
          className="flex items-center gap-1.5 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm"
        >
          <Upload className="w-4 h-4" /> Impor
        </button>
        <button onClick={() => openForm()} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Tambah Pelanggan
        </button>
      </PageHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nama, kode, telepon, atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header px-4 py-3 text-left">Nama</th>
                <th className="table-header px-4 py-3 text-left">Kode Pelanggan</th>
                <th className="table-header px-4 py-3 text-left">Alamat</th>
                <th className="table-header px-4 py-3 text-left">Telepon</th>
                <th className="table-header px-4 py-3 text-center">Jenis Kelamin</th>
                <th className="table-header px-4 py-3 text-right">Poin</th>
                <th className="table-header px-4 py-3 text-right">Saldo Deposit</th>
                <th className="table-header px-4 py-3 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => (
                <tr key={c.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${!c.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.name}
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.kode || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={c.address || ''}>
                    {c.address || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.phone || '-'}</td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {c.gender === 'L' ? 'Pria' : c.gender === 'P' ? 'Wanita' : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{c.points || 0}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(c.deposit || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => openForm(c)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setConfirmDelete(c)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paged.length === 0 && (
          <EmptyState
            description="Belum ada pelanggan yang terdaftar."
            action={
              <button onClick={() => openForm()} className="btn-primary text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Tambah Pelanggan
              </button>
            }
          />
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {showForm && (
        <CustomerFormPage
          editCust={editCust}
          form={form}
          setForm={setForm}
          errors={errors}
          onCancel={closeForm}
          onSave={handleSave}
        />
      )}

      <ConfirmationDialog
        open={confirmSave}
        title="Simpan Pelanggan"
        message={`Pelanggan "${form.name}" akan disimpan ke daftar pelanggan. Lanjutkan?`}
        confirmLabel="Ya, Lanjutkan"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={handleConfirmSave}
      />
      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus Pelanggan"
        message={confirmDelete ? `Pelanggan "${confirmDelete.name}" akan dihapus. Lanjutkan?` : ''}
        confirmLabel="Ya, Hapus"
        variant="danger"
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function initForm() {
  return {
    kode: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    gender: '',
    birth_date: '',
    points: '0',
    deposit: '0',
    notes: '',
  };
}

function CustomerFormPage({ editCust, form, setForm, errors, onCancel, onSave }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {editCust ? 'Ubah Pelanggan' : 'Tambah Pelanggan'}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Informasi Pelanggan</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nama<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="input-field"
                  placeholder="Nama lengkap"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode Pelanggan</label>
                <input
                  type="text"
                  value={form.kode}
                  onChange={(e) => set({ kode: e.target.value })}
                  className="input-field"
                  placeholder="Otomatis (PLG0001)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telepon</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className="input-field"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  className="input-field"
                  placeholder="email@contoh.com"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Kelamin</label>
                <select
                  value={form.gender}
                  onChange={(e) => set({ gender: e.target.value })}
                  className="input-field"
                >
                  <option value="">-</option>
                  <option value="L">Pria</option>
                  <option value="P">Wanita</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal Lahir</label>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => set({ birth_date: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
                <textarea
                  value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Alamat lengkap"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Loyalti & Deposit</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Poin</label>
                <input
                  type="number"
                  min="0"
                  value={form.points}
                  onChange={(e) => set({ points: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Saldo Deposit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rp</span>
                  <input
                    type="number"
                    min="0"
                    value={form.deposit}
                    onChange={(e) => set({ deposit: e.target.value })}
                    className="input-field pl-9"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Catatan</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set({ notes: e.target.value })}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Catatan internal mengenai pelanggan"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 sm:px-6 py-3 bg-white flex items-center justify-between">
        <button
          onClick={onCancel}
          className="text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium"
        >
          Batal
        </button>
        <button onClick={onSave} className="btn-primary text-sm">
          Simpan
        </button>
      </div>
    </div>
  );
}
