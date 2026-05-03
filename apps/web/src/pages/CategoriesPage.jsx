import { useEffect, useMemo, useState } from 'react';
import { Edit2, GripVertical, LayoutGrid, List, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ConfirmationDialog,
  EmptyState,
  FilterTabs,
  PageHeader,
  Pagination,
  Toggle,
} from '../components/ui';
import ColorPicker from '../components/categories/ColorPicker';
import IconUploader from '../components/categories/IconUploader';

const NO_DEPARTMENT_ID = '__none__';

function resolveIconUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = api.defaults.baseURL.replace(/\/api\/?$/, '');
  return `${base}${url}`;
}

export default function CategoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('groups'); // 'groups' | 'list'
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

  const [drag, setDrag] = useState(null); // { id, deptKey }

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

  // Group filtered categories by department, preserving department order.
  const grouped = useMemo(() => {
    const buckets = new Map();
    departments.forEach((d) => buckets.set(String(d.id), { dept: d, items: [] }));
    buckets.set(NO_DEPARTMENT_ID, { dept: null, items: [] });
    filtered.forEach((c) => {
      const key = c.department_id ? String(c.department_id) : NO_DEPARTMENT_ID;
      if (!buckets.has(key)) {
        buckets.set(key, { dept: { id: c.department_id, name: c.department_name }, items: [] });
      }
      buckets.get(key).items.push(c);
    });
    // Empty bucket for "no department" hidden if no items.
    return Array.from(buckets.entries()).filter(
      ([key, b]) => key !== NO_DEPARTMENT_ID || b.items.length > 0
    );
  }, [departments, filtered]);

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
        color: cat.color || null,
        icon_url: cat.icon_url || null,
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
    if (form.color && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(form.color))
      errs.color = 'Format warna harus hex (#RRGGBB)';
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
        color: form.color || null,
        icon_url: form.icon_url || null,
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

  // Drag-reorder: drag dalam dept yang sama → reorder; drop ke dept lain → move.
  const handleDragStart = (cat, deptKey) => setDrag({ id: cat.id, deptKey });
  const handleDragOver = (e) => e.preventDefault();
  const handleDropOnRow = async (overCat, deptKey) => {
    if (!drag || drag.id === overCat.id) {
      setDrag(null);
      return;
    }
    const sameDept = drag.deptKey === deptKey;
    if (sameDept) {
      const bucket = grouped.find(([k]) => k === deptKey)?.[1].items || [];
      const ids = bucket.map((c) => c.id);
      const fromIdx = ids.indexOf(drag.id);
      const toIdx = ids.indexOf(overCat.id);
      if (fromIdx < 0 || toIdx < 0) {
        setDrag(null);
        return;
      }
      const next = [...ids];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, drag.id);
      setDrag(null);
      await persistReorder(deptKey, next);
    } else {
      // Drop ke kategori di departemen lain → move ke target dept di posisi target.
      const targetBucket = grouped.find(([k]) => k === deptKey)?.[1].items || [];
      const targetIds = targetBucket.map((c) => c.id);
      const insertIdx = targetIds.indexOf(overCat.id);
      const next = [...targetIds];
      if (insertIdx >= 0) next.splice(insertIdx, 0, drag.id);
      else next.push(drag.id);
      setDrag(null);
      await persistReorder(deptKey, next);
    }
  };

  // Drop ke section header (kosong) → move ke dept itu di posisi terakhir.
  const handleDropOnSection = async (deptKey) => {
    if (!drag) return;
    if (drag.deptKey === deptKey) {
      setDrag(null);
      return;
    }
    const targetBucket = grouped.find(([k]) => k === deptKey)?.[1].items || [];
    const next = targetBucket.map((c) => c.id);
    next.push(drag.id);
    setDrag(null);
    await persistReorder(deptKey, next);
  };

  const persistReorder = async (deptKey, ids) => {
    const department_id = deptKey === NO_DEPARTMENT_ID ? null : parseInt(deptKey, 10);

    // Optimistic update.
    const byId = Object.fromEntries(categories.map((c) => [c.id, c]));
    setCategories((prev) =>
      prev.map((c) => {
        const idx = ids.indexOf(c.id);
        if (idx < 0) return c;
        return {
          ...c,
          urutan: idx,
          department_id,
          department_name:
            department_id == null
              ? null
              : departments.find((d) => d.id === department_id)?.name || c.department_name,
        };
      })
    );

    try {
      await api.post('/categories/reorder', { ids, department_id });
      toast.success('Urutan kategori tersimpan');
    } catch (err) {
      toast.error('Gagal simpan urutan, refresh');
      // Rollback by reload.
      const fresh = byId; // keep ref to suppress unused warning
      void fresh;
      loadData();
    }
  };

  const reorderable = isAdmin && view === 'groups' && !search && filter === 'all';

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

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 self-start">
          <button
            type="button"
            onClick={() => setView('groups')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              view === 'groups' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Per Departemen
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
              view === 'list' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <List className="w-3.5 h-3.5" /> Tabel
          </button>
        </div>
      </div>

      <FilterTabs
        tabs={[
          { id: 'all', label: 'Semua', count: counts.all },
          { id: 'shown', label: 'Tampil di Menu', count: counts.shown },
          { id: 'hidden', label: 'Tidak Tampil di Menu', count: counts.hidden },
        ]}
        activeId={filter}
        onChange={setFilter}
      />

      {view === 'groups' ? (
        <CategoryGroups
          grouped={grouped}
          isAdmin={isAdmin}
          reorderable={reorderable}
          drag={drag}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDropRow={handleDropOnRow}
          onDropSection={handleDropOnSection}
          onEdit={openForm}
          onDelete={setConfirmDelete}
          onCreate={() => openForm()}
        />
      ) : (
        <CategoryTable
          paged={paged}
          isAdmin={isAdmin}
          onEdit={openForm}
          onDelete={setConfirmDelete}
          onCreate={() => openForm()}
          page={page}
          pageSize={pageSize}
          total={total}
          setPage={setPage}
          setPageSize={setPageSize}
        />
      )}

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

function CategoryAvatar({ cat, size = 'md' }) {
  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-10 w-10 text-sm';
  if (cat.icon_url) {
    return (
      <img
        src={resolveIconUrl(cat.icon_url)}
        alt=""
        className={`${dim} rounded-lg object-cover bg-gray-100`}
      />
    );
  }
  const initial = (cat.name || '?').slice(0, 1).toUpperCase();
  return (
    <span
      className={`${dim} rounded-lg flex items-center justify-center font-semibold text-white`}
      style={{ backgroundColor: cat.color || '#94A3B8' }}
    >
      {initial}
    </span>
  );
}

function CategoryGroups({
  grouped,
  isAdmin,
  reorderable,
  drag,
  onDragStart,
  onDragOver,
  onDropRow,
  onDropSection,
  onEdit,
  onDelete,
  onCreate,
}) {
  if (grouped.length === 0 || grouped.every(([, b]) => b.items.length === 0)) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          description="Belum ada kategori. Tambahkan untuk mengelompokkan produk."
          action={
            isAdmin && (
              <button onClick={onCreate} className="btn-primary text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Tambah Kategori
              </button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([key, { dept, items }]) => (
        <div
          key={key}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          onDragOver={onDragOver}
          onDrop={() => onDropSection(key)}
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                {dept ? dept.name : 'Tanpa Departemen'}
              </h3>
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            {reorderable && drag && drag.deptKey !== key && (
              <span className="text-[11px] text-primary-600">
                Drop di sini untuk pindahkan ke departemen ini
              </span>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-400">
              Belum ada kategori di departemen ini.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((cat) => (
                <li
                  key={cat.id}
                  draggable={reorderable}
                  onDragStart={() => onDragStart(cat, key)}
                  onDrop={(e) => {
                    e.stopPropagation();
                    onDropRow(cat, key);
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition ${
                    drag?.id === cat.id ? 'opacity-40' : ''
                  }`}
                  data-testid={`cat-row-${cat.id}`}
                >
                  {reorderable && (
                    <span
                      className="flex h-7 w-5 items-center justify-center text-gray-300 cursor-grab hover:text-gray-500"
                      title="Drag untuk ubah urutan / pindah departemen"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                  )}
                  <CategoryAvatar cat={cat} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{cat.name}</p>
                      {!cat.is_tampil_di_menu && (
                        <span className="badge bg-gray-100 text-gray-500">Tidak Tampil</span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-gray-400 truncate">{cat.description}</p>
                    )}
                  </div>
                  <div className="hidden sm:block text-xs text-gray-500">
                    {cat.product_count ?? 0} produk
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(cat)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                        aria-label="Ubah kategori"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(cat)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                        aria-label="Hapus kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryTable({
  paged,
  isAdmin,
  onEdit,
  onDelete,
  onCreate,
  page,
  pageSize,
  total,
  setPage,
  setPageSize,
}) {
  return (
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
              <tr key={cat.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <CategoryAvatar cat={cat} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-gray-400">{cat.description}</p>
                      )}
                    </div>
                  </div>
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
                        onClick={() => onEdit(cat)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(cat)}
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
              <button onClick={onCreate} className="btn-primary text-sm flex items-center gap-2">
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
  );
}

function initForm() {
  return {
    name: '',
    urutan: '0',
    department_id: '',
    description: '',
    color: null,
    icon_url: null,
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
                  <option value="">Tanpa departemen</option>
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
              <ColorPicker value={form.color} onChange={(v) => set({ color: v })} />
              {errors.color && <p className="text-xs text-red-500 mt-1">{errors.color}</p>}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <IconUploader value={form.icon_url} onChange={(v) => set({ icon_url: v })} />
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
