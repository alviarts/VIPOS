// VIPOS — Departments master page (P1-05).
//
// CRUD departemen + drag-reorder. Departemen = grup di atas kategori (mis.
// "Beverages" → kategori "Coffee", "Tea", "Juice"). Hanya admin yang bisa
// CRUD; user lain read-only.
import { useEffect, useMemo, useState } from 'react';
import { Boxes, Edit2, GripVertical, Plus, Search, Trash2, X } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ConfirmationDialog, EmptyState, PageHeader, Toggle } from '../components/ui';

function initForm() {
  return {
    name: '',
    description: '',
    is_active: true,
  };
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [form, setForm] = useState(initForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [dragId, setDragId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      toast.error('Gagal memuat departemen');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter((d) => (d.name || '').toLowerCase().includes(q));
  }, [departments, search]);

  const openForm = (dept = null) => {
    setEditDept(dept);
    if (dept) {
      setForm({
        name: dept.name || '',
        description: dept.description || '',
        is_active: !!dept.is_active,
      });
    } else {
      setForm(initForm());
    }
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditDept(null);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama Departemen wajib diisi';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: form.is_active ? 1 : 0,
      };
      if (editDept) {
        await api.put(`/departments/${editDept.id}`, payload);
        toast.success(`Departemen ${form.name} berhasil diupdate`);
      } else {
        await api.post('/departments', payload);
        toast.success(`Departemen ${form.name} berhasil ditambahkan`);
      }
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
      await api.delete(`/departments/${confirmDelete.id}`);
      toast.success('Departemen berhasil dihapus');
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    } finally {
      setDeleting(false);
    }
  };

  // Drag-reorder via HTML5 native (sama pola dengan ImageUploader).
  const onDragStart = (id) => setDragId(id);
  const onDragOver = (e) => e.preventDefault();
  const onDropOn = async (overId) => {
    if (dragId == null || dragId === overId) {
      setDragId(null);
      return;
    }
    const ids = filtered.map((d) => d.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(overId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, dragId);
    setDragId(null);

    // Optimistic update.
    const byId = Object.fromEntries(departments.map((d) => [d.id, d]));
    setDepartments(next.map((id) => byId[id]).filter(Boolean));

    try {
      await api.post('/departments/reorder', { ids: next });
      toast.success('Urutan tersimpan');
    } catch (err) {
      toast.error('Gagal simpan urutan, refresh');
      loadData();
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Daftar Departemen"
        subtitle={`${departments.length} departemen`}
        icon={Boxes}
      >
        {isAdmin && (
          <button
            onClick={() => openForm()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Departemen
          </button>
        )}
      </PageHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nama departemen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuat...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            description="Belum ada departemen. Tambahkan untuk mengelompokkan kategori."
            action={
              isAdmin && (
                <button
                  onClick={() => openForm()}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Tambah Departemen
                </button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((dept) => (
              <li
                key={dept.id}
                draggable={isAdmin && !search}
                onDragStart={() => onDragStart(dept.id)}
                onDragOver={onDragOver}
                onDrop={() => onDropOn(dept.id)}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition ${
                  dragId === dept.id ? 'opacity-40' : ''
                }`}
                data-testid={`dept-row-${dept.id}`}
              >
                {isAdmin && (
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-gray-300 ${
                      search
                        ? 'cursor-not-allowed'
                        : 'cursor-grab hover:bg-gray-100 hover:text-gray-500'
                    }`}
                    title={
                      search ? 'Hilangkan search untuk drag-reorder' : 'Drag untuk ubah urutan'
                    }
                  >
                    <GripVertical className="w-4 h-4" />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{dept.name}</p>
                    {!dept.is_active && (
                      <span className="badge bg-gray-100 text-gray-500">Nonaktif</span>
                    )}
                  </div>
                  {dept.description && (
                    <p className="text-xs text-gray-400 truncate">{dept.description}</p>
                  )}
                </div>
                <div className="hidden sm:block text-xs text-gray-500">
                  {dept.category_count ?? 0} kategori
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openForm(dept)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                      aria-label="Ubah departemen"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(dept)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                      aria-label="Hapus departemen"
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

      {showForm && (
        <DepartmentFormDialog
          editDept={editDept}
          form={form}
          setForm={setForm}
          errors={errors}
          saving={saving}
          onCancel={closeForm}
          onSave={handleSave}
        />
      )}

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus Departemen"
        message={confirmDelete ? `Departemen "${confirmDelete.name}" akan dihapus. Lanjutkan?` : ''}
        confirmLabel="Ya, Hapus"
        variant="danger"
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function DepartmentFormDialog({ editDept, form, setForm, errors, saving, onCancel, onSave }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            {editDept ? 'Ubah Departemen' : 'Tambah Departemen'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nama Departemen<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Contoh: Beverages"
              className="input-field"
              autoFocus
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
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
              placeholder="Deskripsi singkat..."
            />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <Toggle
              checked={form.is_active}
              onChange={(v) => set({ is_active: v })}
              label="Aktif"
              description="Nonaktifkan untuk menyembunyikan departemen tanpa menghapus"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onCancel} disabled={saving} className="btn-secondary text-sm">
            Batal
          </button>
          <button onClick={onSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
