import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Users, Tag } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'cashier',
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [catRes] = await Promise.all([api.get('/categories')]);
      setCategories(catRes.data);
      if (isAdmin) {
        const usersRes = await api.get('/auth/users');
        setUsers(usersRes.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Category handlers
  const openCatForm = (cat = null) => {
    setEditCat(cat);
    setCatForm(
      cat ? { name: cat.name, description: cat.description || '' } : { name: '', description: '' }
    );
    setShowCatForm(true);
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editCat) {
        await api.put(`/categories/${editCat.id}`, catForm);
        toast.success('Kategori diupdate');
      } else {
        await api.post('/categories', catForm);
        toast.success('Kategori ditambahkan');
      }
      setShowCatForm(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  };

  const deleteCat = async (cat) => {
    if (!confirm(`Hapus kategori "${cat.name}"?`)) return;
    try {
      await api.delete(`/categories/${cat.id}`);
      toast.success('Kategori dihapus');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    }
  };

  // User handlers
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', userForm);
      toast.success('User berhasil dibuat');
      setShowUserForm(false);
      setUserForm({ username: '', password: '', name: '', role: 'cashier' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membuat user');
    }
  };

  const tabs = [
    { id: 'categories', label: 'Kategori', icon: Tag },
    ...(isAdmin ? [{ id: 'users', label: 'Pengguna', icon: Users }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-400">Kelola kategori dan pengguna</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${tab === t.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Daftar Kategori</h2>
            {isAdmin && (
              <button
                onClick={() => openCatForm()}
                className="btn-primary flex items-center gap-2 text-sm py-2"
              >
                <Plus className="w-4 h-4" /> Tambah
              </button>
            )}
          </div>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between bg-gray-50 rounded-xl p-3"
              >
                <div>
                  <p className="font-medium text-gray-900">{cat.name}</p>
                  {cat.description && <p className="text-xs text-gray-400">{cat.description}</p>}
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openCatForm(cat)}
                      className="p-2 hover:bg-gray-200 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => deleteCat(cat)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-gray-400 py-8">Belum ada kategori</p>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && isAdmin && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Daftar Pengguna</h2>
            <button
              onClick={() => setShowUserForm(true)}
              className="btn-primary flex items-center gap-2 text-sm py-2"
            >
              <Plus className="w-4 h-4" /> Tambah User
            </button>
          </div>
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between bg-gray-50 rounded-xl p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold text-sm">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">
                      @{u.username} &middot; {u.role}
                    </p>
                  </div>
                </div>
                <span
                  className={`badge ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}
                >
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCatForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editCat ? 'Edit Kategori' : 'Tambah Kategori'}
                </h2>
                <button
                  onClick={() => setShowCatForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCatSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                  <input
                    type="text"
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                  <input
                    type="text"
                    value={catForm.description}
                    onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                    className="input-field"
                  />
                </div>
                <button type="submit" className="btn-primary w-full">
                  Simpan
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Tambah User</h2>
                <button
                  onClick={() => setShowUserForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUserSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="input-field"
                  >
                    <option value="cashier">Kasir</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary w-full">
                  Buat User
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
