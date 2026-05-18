/**
 * Product Recipes Management Page
 * 
 * Manages product recipes (Master Resep) for F&B businesses.
 * Features:
 * - List all recipes with search and filter
 * - Create/edit/delete recipes
 * - Manage ingredients and steps
 * - Calculate recipe costs
 * - Duplicate recipes
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Copy, ChefHat, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RecipesPage() {
  const { token } = useAuth();
  // Using toast directly
  
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);

  useEffect(() => {
    loadRecipes();
    loadProducts();
  }, []);

  const loadRecipes = async () => {
    try {
      const res = await fetch('/api/v1/recipes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setRecipes(data.data);
      }
    } catch (error) {
      toast('Gagal memuat resep', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/v1/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleCreate = () => {
    setEditingRecipe(null);
    setShowModal(true);
  };

  const handleEdit = (recipe) => {
    setEditingRecipe(recipe);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus resep ini?')) return;

    try {
      const res = await fetch(`/api/v1/recipes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast('Resep berhasil dihapus', 'success');
        loadRecipes();
      } else {
        toast(data.error || 'Gagal menghapus resep', 'error');
      }
    } catch (error) {
      toast('Gagal menghapus resep', 'error');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await fetch(`/api/v1/recipes/${id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast('Resep berhasil diduplikasi', 'success');
        loadRecipes();
      } else {
        toast(data.error || 'Gagal menduplikasi resep', 'error');
      }
    } catch (error) {
      toast('Gagal menduplikasi resep', 'error');
    }
  };

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && recipe.is_active === 1) ||
      (filterActive === 'inactive' && recipe.is_active === 0);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Memuat resep...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Resep</h1>
          <p className="text-sm text-gray-500">
            Kelola resep produk dan bahan baku
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Buat Resep
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari resep atau produk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="input-field w-48"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Tidak Aktif</option>
        </select>
      </div>

      {/* Recipe List */}
      {filteredRecipes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <ChefHat className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Belum ada resep
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Mulai dengan membuat resep pertama Anda
          </p>
          <button
            onClick={handleCreate}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Buat Resep
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onEdit={() => handleEdit(recipe)}
              onDelete={() => handleDelete(recipe.id)}
              onDuplicate={() => handleDuplicate(recipe.id)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <RecipeModal
          recipe={editingRecipe}
          products={products}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            loadRecipes();
          }}
          token={token}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function RecipeCard({ recipe, onEdit, onDelete, onDuplicate }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{recipe.name}</h3>
          <p className="text-sm text-gray-500">{recipe.product_name}</p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            recipe.is_active === 1
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {recipe.is_active === 1 ? 'Aktif' : 'Nonaktif'}
        </span>
      </div>

      {recipe.description && (
        <p className="mb-3 text-sm text-gray-600 line-clamp-2">
          {recipe.description}
        </p>
      )}

      <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <ChefHat className="h-4 w-4" />
          <span>{recipe.ingredient_count || 0} bahan</span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="h-4 w-4" />
          <span>
            Rp {(recipe.total_cost || 0).toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <button
          onClick={onEdit}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Edit className="inline h-4 w-4 mr-1" />
          Edit
        </button>
        <button
          onClick={onDuplicate}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          title="Duplikasi"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          title="Hapus"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RecipeModal({ recipe, products, onClose, onSave, token, showToast }) {
  const [formData, setFormData] = useState({
    product_id: recipe?.product_id || '',
    name: recipe?.name || '',
    description: recipe?.description || '',
    yield_quantity: recipe?.yield_quantity || 1,
    yield_unit: recipe?.yield_unit || 'pcs',
    preparation_time: recipe?.preparation_time || 0,
    cooking_time: recipe?.cooking_time || 0,
    is_active: recipe?.is_active === 1,
  });
  const [ingredients, setIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (recipe?.id) {
      loadRecipeDetails();
    }
  }, [recipe]);

  const loadRecipeDetails = async () => {
    try {
      const res = await fetch(`/api/v1/recipes/${recipe.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setIngredients(data.data.ingredients || []);
        setSteps(data.data.steps || []);
      }
    } catch (error) {
      console.error('Failed to load recipe details:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = recipe?.id
        ? `/api/v1/recipes/${recipe.id}`
        : '/api/v1/recipes';
      const method = recipe?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          is_active: formData.is_active ? 1 : 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast(
          recipe?.id ? 'Resep berhasil diupdate' : 'Resep berhasil dibuat',
          'success'
        );
        onSave();
      } else {
        toast(data.error || 'Gagal menyimpan resep', 'error');
      }
    } catch (error) {
      toast('Gagal menyimpan resep', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {recipe?.id ? 'Edit Resep' : 'Buat Resep Baru'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-2 text-sm font-medium ${
                activeTab === 'info'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Informasi Dasar
            </button>
            {recipe?.id && (
              <>
                <button
                  onClick={() => setActiveTab('ingredients')}
                  className={`pb-2 text-sm font-medium ${
                    activeTab === 'ingredients'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Bahan ({ingredients.length})
                </button>
                <button
                  onClick={() => setActiveTab('steps')}
                  className={`pb-2 text-sm font-medium ${
                    activeTab === 'steps'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Langkah ({steps.length})
                </button>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Produk *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) =>
                    setFormData({ ...formData, product_id: parseInt(e.target.value) })
                  }
                  className="input-field"
                  required
                  disabled={!!recipe?.id}
                >
                  <option value="">Pilih produk</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nama Resep *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Deskripsi
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input-field"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Hasil Produksi *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.yield_quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        yield_quantity: parseFloat(e.target.value),
                      })
                    }
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Satuan *
                  </label>
                  <input
                    type="text"
                    value={formData.yield_unit}
                    onChange={(e) =>
                      setFormData({ ...formData, yield_unit: e.target.value })
                    }
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Waktu Persiapan (menit)
                  </label>
                  <input
                    type="number"
                    value={formData.preparation_time}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preparation_time: parseInt(e.target.value),
                      })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Waktu Memasak (menit)
                  </label>
                  <input
                    type="number"
                    value={formData.cooking_time}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cooking_time: parseInt(e.target.value),
                      })
                    }
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Aktif
                </label>
              </div>
            </div>
          )}

          {activeTab === 'ingredients' && (
            <div className="text-center text-gray-500 py-8">
              Kelola bahan di halaman detail resep
            </div>
          )}

          {activeTab === 'steps' && (
            <div className="text-center text-gray-500 py-8">
              Kelola langkah di halaman detail resep
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
