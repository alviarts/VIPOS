import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2, Tag as TagIcon, Users } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ConfirmationDialog, EmptyState, PageHeader } from '../components/ui';
import ColorPicker from '../components/customers/ColorPicker';

const TABS = [
  { key: 'groups', label: 'Grup Pelanggan' },
  { key: 'tags', label: 'Tag Pelanggan' },
];

const initGroupForm = () => ({
  id: null,
  name: '',
  description: '',
  discount_percent: '0',
  points_multiplier: '1',
  color: null,
});

const initTagForm = () => ({
  id: null,
  name: '',
  color: null,
});

export default function CustomerGroupsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('groups');

  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);

  const [groupForm, setGroupForm] = useState(initGroupForm());
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null);

  const [tagForm, setTagForm] = useState(initTagForm());
  const [showTagForm, setShowTagForm] = useState(false);
  const [confirmDeleteTag, setConfirmDeleteTag] = useState(null);

  useEffect(() => {
    loadGroups();
    loadTags();
  }, []);

  async function loadGroups() {
    try {
      const res = await api.get('/customer-groups');
      setGroups(res.data);
    } catch (_err) {
      toast.error('Gagal memuat grup');
    }
  }
  async function loadTags() {
    try {
      const res = await api.get('/customer-tags');
      setTags(res.data);
    } catch (_err) {
      toast.error('Gagal memuat tag');
    }
  }

  function openGroupForm(g = null) {
    setGroupForm(
      g
        ? {
            id: g.id,
            name: g.name,
            description: g.description || '',
            discount_percent: String(g.discount_percent ?? 0),
            points_multiplier: String(g.points_multiplier ?? 1),
            color: g.color,
          }
        : initGroupForm()
    );
    setShowGroupForm(true);
  }

  async function saveGroup() {
    if (!groupForm.name.trim()) {
      toast.error('Nama grup wajib');
      return;
    }
    try {
      const payload = {
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || null,
        discount_percent: parseFloat(groupForm.discount_percent) || 0,
        points_multiplier: parseFloat(groupForm.points_multiplier) || 1,
        color: groupForm.color,
      };
      if (groupForm.id) {
        await api.put(`/customer-groups/${groupForm.id}`, payload);
        toast.success('Grup diupdate');
      } else {
        await api.post('/customer-groups', payload);
        toast.success('Grup dibuat');
      }
      setShowGroupForm(false);
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  }

  async function deleteGroup() {
    if (!confirmDeleteGroup) return;
    try {
      await api.delete(`/customer-groups/${confirmDeleteGroup.id}`);
      toast.success('Grup dihapus');
      setConfirmDeleteGroup(null);
      loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    }
  }

  function openTagForm(t = null) {
    setTagForm(t ? { id: t.id, name: t.name, color: t.color } : initTagForm());
    setShowTagForm(true);
  }

  async function saveTag() {
    if (!tagForm.name.trim()) {
      toast.error('Nama tag wajib');
      return;
    }
    try {
      const payload = { name: tagForm.name.trim(), color: tagForm.color };
      if (tagForm.id) {
        await api.put(`/customer-tags/${tagForm.id}`, payload);
        toast.success('Tag diupdate');
      } else {
        await api.post('/customer-tags', payload);
        toast.success('Tag dibuat');
      }
      setShowTagForm(false);
      loadTags();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  }

  async function deleteTag() {
    if (!confirmDeleteTag) return;
    try {
      await api.delete(`/customer-tags/${confirmDeleteTag.id}`);
      toast.success('Tag dihapus');
      setConfirmDeleteTag(null);
      loadTags();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Grup & Tag Pelanggan"
        subtitle="Klasifikasi pelanggan untuk promo, harga spesial, & loyalty"
        icon={Users}
      >
        {isAdmin && tab === 'groups' && (
          <button
            onClick={() => openGroupForm()}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tambah Grup
          </button>
        )}
        {isAdmin && tab === 'tags' && (
          <button
            onClick={() => openTagForm()}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Tambah Tag
          </button>
        )}
      </PageHeader>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm border-b-2 ${
                tab === t.key
                  ? 'border-primary-500 text-primary-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'groups' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {groups.length === 0 ? (
            <EmptyState
              description="Belum ada grup pelanggan."
              action={
                isAdmin && (
                  <button
                    onClick={() => openGroupForm()}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Tambah Grup
                  </button>
                )
              }
            />
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header px-4 py-3 text-left">Nama</th>
                  <th className="table-header px-4 py-3 text-left">Deskripsi</th>
                  <th className="table-header px-4 py-3 text-right">Diskon %</th>
                  <th className="table-header px-4 py-3 text-right">Multiplier Poin</th>
                  <th className="table-header px-4 py-3 text-right">Anggota</th>
                  <th className="table-header px-4 py-3 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <span
                        className="badge text-white text-[11px] uppercase"
                        style={{ backgroundColor: g.color || '#0EA5E9' }}
                      >
                        {g.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{g.description || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {g.discount_percent || 0}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {g.points_multiplier || 1}x
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{g.customer_count || 0}</td>
                    <td className="px-4 py-3 text-center">
                      {isAdmin && (
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openGroupForm(g)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteGroup(g)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'tags' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {tags.length === 0 ? (
            <EmptyState
              description="Belum ada tag pelanggan."
              action={
                isAdmin && (
                  <button
                    onClick={() => openTagForm()}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Tambah Tag
                  </button>
                )
              }
            />
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header px-4 py-3 text-left">Tag</th>
                  <th className="table-header px-4 py-3 text-right">Pelanggan</th>
                  <th className="table-header px-4 py-3 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <span
                        className="badge text-[11px]"
                        style={{
                          backgroundColor: (t.color || '#94A3B8') + '22',
                          color: t.color || '#475569',
                        }}
                      >
                        <TagIcon className="w-3 h-3 inline mr-1" />
                        {t.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.customer_count || 0}</td>
                    <td className="px-4 py-3 text-center">
                      {isAdmin && (
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => openTagForm(t)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteTag(t)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showGroupForm && (
        <FormDialog
          title={groupForm.id ? 'Ubah Grup' : 'Tambah Grup'}
          onCancel={() => setShowGroupForm(false)}
          onSave={saveGroup}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nama<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={groupForm.name}
              onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field"
              placeholder="VIP, Reseller, Member..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Deskripsi</label>
            <input
              type="text"
              value={groupForm.description}
              onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Diskon (%)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={groupForm.discount_percent}
                onChange={(e) => setGroupForm((f) => ({ ...f, discount_percent: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Multiplier Poin
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={groupForm.points_multiplier}
                onChange={(e) => setGroupForm((f) => ({ ...f, points_multiplier: e.target.value }))}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Warna Badge</label>
            <ColorPicker
              value={groupForm.color}
              onChange={(c) => setGroupForm((f) => ({ ...f, color: c }))}
            />
          </div>
        </FormDialog>
      )}

      {showTagForm && (
        <FormDialog
          title={tagForm.id ? 'Ubah Tag' : 'Tambah Tag'}
          onCancel={() => setShowTagForm(false)}
          onSave={saveTag}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nama<span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={tagForm.name}
              onChange={(e) => setTagForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field"
              placeholder="Loyal, Penghutang..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Warna</label>
            <ColorPicker
              value={tagForm.color}
              onChange={(c) => setTagForm((f) => ({ ...f, color: c }))}
            />
          </div>
        </FormDialog>
      )}

      <ConfirmationDialog
        open={!!confirmDeleteGroup}
        title="Hapus Grup"
        message={
          confirmDeleteGroup
            ? `Grup "${confirmDeleteGroup.name}" akan dihapus. Tidak bisa kalau masih ada pelanggan di dalamnya. Lanjutkan?`
            : ''
        }
        confirmLabel="Ya, Hapus"
        variant="danger"
        onCancel={() => setConfirmDeleteGroup(null)}
        onConfirm={deleteGroup}
      />
      <ConfirmationDialog
        open={!!confirmDeleteTag}
        title="Hapus Tag"
        message={
          confirmDeleteTag
            ? `Tag "${confirmDeleteTag.name}" akan dihapus dari semua pelanggan yang memilikinya. Lanjutkan?`
            : ''
        }
        confirmLabel="Ya, Hapus"
        variant="danger"
        onCancel={() => setConfirmDeleteTag(null)}
        onConfirm={deleteTag}
      />
    </div>
  );
}

function FormDialog({ title, onCancel, onSave, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="p-4 sm:p-5 space-y-3">{children}</div>
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium"
          >
            Batal
          </button>
          <button onClick={onSave} className="btn-primary text-sm">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
