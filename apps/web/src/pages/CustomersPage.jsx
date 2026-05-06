import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Edit2,
  Filter,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import api, { getAccessToken } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';
import { ConfirmationDialog, EmptyState, PageHeader, Pagination } from '../components/ui';
import CustomerFormPage from '../components/customers/CustomerFormPage';
import CustomerImportDialog from '../components/customers/CustomerImportDialog';

const initForm = () => ({
  kode: '',
  name: '',
  phone: '',
  email: '',
  address: '',
  gender: '',
  birth_date: '',
  customer_group_id: '',
  npwp: '',
  id_card_no: '',
  province: '',
  city: '',
  district: '',
  points: '0',
  deposit: '0',
  notes: '',
  tag_ids: [],
});

export default function CustomersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);

  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterFlag, setFilterFlag] = useState(''); // '', 'has_deposit', 'has_points'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editCust, setEditCust] = useState(null);
  const [form, setForm] = useState(initForm());
  const [errors, setErrors] = useState({});

  const [showImport, setShowImport] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadCustomers(), loadGroups(), loadTags()]);
  }

  async function loadCustomers() {
    try {
      const params = new URLSearchParams({ active_only: 'false' });
      if (filterGroup) params.set('group_id', filterGroup);
      if (filterTag) params.set('tag_id', filterTag);
      if (filterFlag === 'has_deposit') params.set('has_deposit', 'true');
      if (filterFlag === 'has_points') params.set('has_points', 'true');
      const res = await api.get(`/customers?${params.toString()}`);
      setCustomers(res.data);
    } catch (_err) {
      toast.error('Gagal memuat pelanggan');
    }
  }

  async function loadGroups() {
    try {
      const res = await api.get('/customer-groups');
      setGroups(res.data);
    } catch (_err) {
      // Optional master, ignore.
    }
  }

  async function loadTags() {
    try {
      const res = await api.get('/customer-tags');
      setTags(res.data);
    } catch (_err) {
      // Optional master, ignore.
    }
  }

  // Re-fetch when server-side filters change.
  useEffect(() => {
    loadCustomers();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGroup, filterTag, filterFlag]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.kode, c.phone, c.email, c.address, c.npwp]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [customers, search]);

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [search]);

  function openForm(cust = null) {
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
        customer_group_id: cust.customer_group_id ? String(cust.customer_group_id) : '',
        npwp: cust.npwp || '',
        id_card_no: cust.id_card_no || '',
        province: cust.province || '',
        city: cust.city || '',
        district: cust.district || '',
        points: String(cust.points ?? 0),
        deposit: String(cust.deposit ?? 0),
        notes: cust.notes || '',
        tag_ids: (cust.tags || []).map((t) => t.id),
      });
    } else {
      setForm(initForm());
    }
    setErrors({});
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditCust(null);
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama pelanggan wajib diisi';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Format email tidak valid';
    if (form.phone && !/^(\+?62|0)[0-9]{8,13}$/.test(form.phone.replace(/[\s-]/g, '')))
      errs.phone = 'Nomor telepon tidak valid';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    setConfirmSave(true);
  }

  async function handleConfirmSave() {
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
        customer_group_id: form.customer_group_id ? parseInt(form.customer_group_id, 10) : null,
        npwp: form.npwp.trim() || null,
        id_card_no: form.id_card_no.trim() || null,
        province: form.province.trim() || null,
        city: form.city.trim() || null,
        district: form.district.trim() || null,
        points: parseInt(form.points, 10) || 0,
        deposit: parseFloat(form.deposit) || 0,
        notes: form.notes.trim() || null,
        tag_ids: form.tag_ids,
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
      loadCustomers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/customers/${confirmDelete.id}`);
      toast.success(res.data?.message || 'Pelanggan berhasil dihapus');
      setConfirmDelete(null);
      loadCustomers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    try {
      const base = api.defaults.baseURL.replace(/\/$/, '');
      const token = getAccessToken();
      const res = await fetch(`${base}/customers/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Berhasil diekspor');
    } catch (_err) {
      toast.error('Gagal ekspor');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Daftar Pelanggan" subtitle={`${customers.length} pelanggan`} icon={Users}>
        <Link
          to="/customer-groups"
          className="hidden sm:flex items-center gap-1.5 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm"
        >
          <Settings2 className="w-4 h-4" /> Kelola Grup & Tag
        </Link>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm"
        >
          <Download className="w-4 h-4" /> Ekspor
        </button>
        {isAdmin && (
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm"
          >
            <Upload className="w-4 h-4" /> Impor
          </button>
        )}
        <button onClick={() => openForm()} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Tambah Pelanggan
        </button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama, kode, telepon, email, atau NPWP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="input-field min-w-[10rem]"
        >
          <option value="">Semua Grup</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="input-field min-w-[10rem]"
        >
          <option value="">Semua Tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={filterFlag}
          onChange={(e) => setFilterFlag(e.target.value)}
          className="input-field min-w-[10rem]"
        >
          <option value="">Status</option>
          <option value="has_deposit">Punya Deposit</option>
          <option value="has_points">Punya Poin</option>
        </select>
      </div>

      {(filterGroup || filterTag || filterFlag) && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Filter className="w-3 h-3" />
          Filter aktif:
          {filterGroup && (
            <span className="badge bg-primary-50 text-primary-700">
              Grup: {groups.find((g) => String(g.id) === filterGroup)?.name}
            </span>
          )}
          {filterTag && (
            <span className="badge bg-primary-50 text-primary-700">
              Tag: {tags.find((t) => String(t.id) === filterTag)?.name}
            </span>
          )}
          {filterFlag && (
            <span className="badge bg-primary-50 text-primary-700">
              {filterFlag === 'has_deposit' ? 'Punya Deposit' : 'Punya Poin'}
            </span>
          )}
          <button
            onClick={() => {
              setFilterGroup('');
              setFilterTag('');
              setFilterFlag('');
            }}
            className="text-primary-600 hover:underline"
          >
            Reset
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header px-4 py-3 text-left">Pelanggan</th>
                <th className="table-header px-4 py-3 text-left">Kontak</th>
                <th className="table-header px-4 py-3 text-left">Grup & Tag</th>
                <th className="table-header px-4 py-3 text-left">Last Visit</th>
                <th className="table-header px-4 py-3 text-right">Total Belanja</th>
                <th className="table-header px-4 py-3 text-right">Poin</th>
                <th className="table-header px-4 py-3 text-right">Deposit</th>
                <th className="table-header px-4 py-3 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${!c.is_active ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/customers/${c.id}`}
                      className="font-medium text-gray-900 hover:text-primary-600"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-gray-400 font-mono">{c.kode || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.phone || '-'}
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {c.customer_group_name && (
                        <span
                          className="badge text-white text-[10px] uppercase tracking-wide"
                          style={{
                            backgroundColor: c.customer_group_color || '#0EA5E9',
                          }}
                        >
                          {c.customer_group_name}
                        </span>
                      )}
                      {(c.tags || []).map((t) => (
                        <span
                          key={t.id}
                          className="badge text-[10px]"
                          style={{
                            backgroundColor: (t.color || '#94A3B8') + '22',
                            color: t.color || '#475569',
                          }}
                        >
                          {t.name}
                        </span>
                      ))}
                      {!c.customer_group_name && !(c.tags || []).length && (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {c.last_visit ? formatDate(c.last_visit) : '-'}
                    {c.transaction_count > 0 && (
                      <p className="text-[11px] text-gray-400">{c.transaction_count} transaksi</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(c.total_spent || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{c.points || 0}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(c.deposit || 0)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => openForm(c)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                        aria-label="Ubah"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setConfirmDelete(c)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                          aria-label="Hapus"
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
            description="Belum ada pelanggan yang sesuai filter."
            action={
              <button
                onClick={() => openForm()}
                className="btn-primary text-sm flex items-center gap-2"
              >
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
          groups={groups}
          tags={tags}
          onCancel={closeForm}
          onSave={handleSave}
        />
      )}

      {showImport && (
        <CustomerImportDialog
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            loadCustomers();
          }}
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
        message={
          confirmDelete
            ? `Pelanggan "${confirmDelete.name}" akan dihapus / dinonaktifkan jika sudah punya transaksi. Lanjutkan?`
            : ''
        }
        confirmLabel="Ya, Hapus"
        variant="danger"
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
