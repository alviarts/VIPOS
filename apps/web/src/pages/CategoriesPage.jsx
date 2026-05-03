import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Tag, X, MoreVertical } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ConfirmationDialog,
  EmptyState,
  Pagination,
  FilterTabs,
  Toggle,
  PageHeader,
} from '../components/ui';

export default function CategoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [form, setForm] = useState(initForm());

  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [catRes, deptRes] = await Promise.all([
        api.get('/categories'),
        api.get('/departments'),
      ]);
      setCategories(catRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      toast.error('Gagal memuat data');
    }
  };

  const counts = useMemo(
    () => ({
      all: categories.length,
      shown: categories.filter((c) => c.is_tampil_di_menu).length,
      hidden: categories.filter((c) => !c.is_tampil_di_menu).length,
    }),
    [categories]
  );

  const filtered = useMemo(() => {
    return categories.filter((c) => {
      if (filter === 'shown' && !c.is_tampil_di_menu) return false;
      if (filter === 'hidden' && c.is_tampil_di_menu) return false;
      const q = search.toLowerCase();
      if (q && !(c.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categories, search, filter]);

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const openForm = (cat = null) => {
    setEditCat(cat);
    if (cat) {
      setForm({
        name: cat.name || '',
        urutan: String(cat.urutan ?? 0),
        department_id: cat.department_id ? String(cat.department_id) : '',
        description: cat.description || '',
        is_tampil_di_menu: !!cat.is_tampil_di_menu,
      });
    } else {
      setForm(initForm());
    }
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditCat(null);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama Kategori wajib diisi';
    if (form.urutan && !Number.isFinite(parseInt(form.urutan, 10)))
      errs.urutan = 'Urutan harus berupa angka';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveClick = () => {
    if (!validate()) return;
    setConfirmSave(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        urutan: parseInt(form.urutan, 10) || 0,
        department_id: form.department_id ? parseInt(form.department_id, 10) : null,
        is_tampil_di_menu: form.is_tampil_di_menu ? 1 : 0,
      };
      if (editCat) {
        await api.put(`/categories/${editCat.id}`, payload);
        toast.success(`Kategori ${form.name} berhasil diupdate`);
      } else {
        await api.post('/categories', payload);
        toast.success(`Kategori ${form.name} berhasil ditambahkan`);
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
      await api.delete(`/categories/${confirmDelete.id}`);
      toast.success('Kategori berhasil dihapus');
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
      <PageHeader title="Daftar Kategori" subtitle={`${categories.length} kategori`} icon={Tag}>
        {isAdmin && (
          <button
            onClick={() => openForm()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Kategori
          </button>
        )}
      </PageHeader>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nama kategori..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {/* Filter tabs */}
      <FilterTabs
        tabs={[
          { id: 'all', label: 'Semua', count: counts.all },
          { id: 'shown', label: 'Tampil di Menu', count: counts.shown },
          { id: 'hidden', label: 'Tidak Tampil di Menu', count: counts.hidden },
        ]}
        activeId={filter}
        onChange={setFilter}
      />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header px-4 py-3 text-left">Nama Kategori</th>
                <th className="table-header px-4 py-3 text-right">Urutan</th>
                <th className="table-header px-4 py-3 text-right">Jumlah Produk</th>
                <th className="table-header px-4 py-3 text-left">Departemen</th>
                <th className="table-header px-4 py-3 text-center">Status</th>
                {isAdmin && <th className="table-header px-4 py-3 w-20 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {paged.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-400">{cat.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{cat.urutan ?? 0}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{cat.product_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-700">{cat.department_name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {cat.is_tampil_di_menu ? (
                      <span className="badge badge-success">Tampil di Menu</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500">Tidak Tampil di Menu</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => openForm(cat)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(cat)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paged.length === 0 && (
          <EmptyState
            description="Belum ada kategori yang sesuai dengan filter Anda."
            action={
              isAdmin && (
                <button
                  onClick={() => openForm()}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Tambah Kategori
                </button>
              )
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

      {/* Form */}
      {showForm && (
        <CategoryFormPage
          editCat={editCat}
          form={form}
          setForm={setForm}
          errors={errors}
          departments={departments}
          onCancel={closeForm}
          onSave={handleSaveClick}
        />
      )}

      <ConfirmationDialog
        open={confirmSave}
        title="Simpan Kategori"
        message={`Kategori "${form.name}" akan disimpan dan tampil di daftar kategori sesuai dengan pengaturan yang telah dilakukan. Lanjutkan?`}
        confirmLabel="Ya, Lanjutkan"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={handleConfirmSave}
      />
      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus Kategori"
        message={confirmDelete ? `Kategori "${confirmDelete.name}" akan dihapus. Lanjutkan?` : ''}
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
    name: '',
    urutan: '0',
    department_id: '',
    description: '',
    is_tampil_di_menu: true,
  };
}

function CategoryFormPage({ editCat, form, setForm, errors, departments, onCancel, onSave }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {editCat ? 'Ubah Kategori' : 'Tambah Kategori'}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nama Kategori<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Contoh: Snack"
                className="input-field"
                autoFocus
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Urutan<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.urutan}
                  onChange={(e) => set({ urutan: e.target.value })}
                  placeholder="Contoh: 1"
                  className="input-field"
                />
                {errors.urutan && <p className="text-xs text-red-500 mt-1">{errors.urutan}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Departemen</label>
                <select
                  value={form.department_id}
                  onChange={(e) => set({ department_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Pilih departemen...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Deskripsi (Opsional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={2}
                className="input-field resize-none"
                placeholder="Deskripsi singkat kategori ini..."
              />
            </div>

            <div className="pt-3 border-t border-gray-100">
              <Toggle
                checked={form.is_tampil_di_menu}
                onChange={(v) => set({ is_tampil_di_menu: v })}
                label="Tampil di Menu"
                description="Tampilkan kategori pada aplikasi kasir"
              />
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
