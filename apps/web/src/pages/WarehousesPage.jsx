// Multi-warehouse Management Page
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Package, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import api from '../utils/api';
import { formatNumber } from '../utils/format';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showStockView, setShowStockView] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    manager_id: '',
    is_active: 1,
  });

  const [transferData, setTransferData] = useState({
    from_warehouse_id: '',
    to_warehouse_id: '',
    product_id: '',
    quantity: 0,
    notes: '',
  });

  useEffect(() => {
    fetchWarehouses();
    fetchUsers();
    fetchProducts();
  }, []);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/warehouses');
      setWarehouses(res.data || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/employee');
      setUsers(res.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await api.put(`/warehouses/${editingWarehouse.id}`, formData);
      } else {
        await api.post('/warehouses', formData);
      }
      setShowForm(false);
      setEditingWarehouse(null);
      resetForm();
      fetchWarehouses();
    } catch (error) {
      console.error('Error saving warehouse:', error);
      alert(error.response?.data?.error || 'Failed to save warehouse');
    }
  };

  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData({
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address || '',
      phone: warehouse.phone || '',
      manager_id: warehouse.manager_id || '',
      is_active: warehouse.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this warehouse?')) return;
    try {
      await api.delete(`/warehouses/${id}`);
      fetchWarehouses();
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      alert(error.response?.data?.error || 'Failed to delete warehouse');
    }
  };

  const handleViewStock = async (warehouse) => {
    try {
      const res = await api.get(`/warehouses/${warehouse.id}`);
      setSelectedWarehouse(res.data);
      setShowStockView(true);
    } catch (error) {
      console.error('Error fetching warehouse stock:', error);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/warehouses/transfer', transferData);
      setShowTransferForm(false);
      resetTransferForm();
      fetchWarehouses();
      alert('Stock transferred successfully');
    } catch (error) {
      console.error('Error transferring stock:', error);
      alert(error.response?.data?.error || 'Failed to transfer stock');
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      address: '',
      phone: '',
      manager_id: '',
      is_active: 1,
    });
  };

  const resetTransferForm = () => {
    setTransferData({
      from_warehouse_id: '',
      to_warehouse_id: '',
      product_id: '',
      quantity: 0,
      notes: '',
    });
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/inventory" className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">Warehouse Management</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTransferForm(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-600 px-4 py-2 text-primary-600 hover:bg-primary-50"
          >
            <ArrowRightLeft className="h-4 w-4" /> Transfer Stock
          </button>
          <button
            onClick={() => {
              resetForm();
              setEditingWarehouse(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> New Warehouse
          </button>
        </div>
      </header>

      {showForm && (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">{editingWarehouse ? 'Edit Warehouse' : 'Create Warehouse'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Warehouse Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Warehouse Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Manager</label>
                <select
                  value={formData.manager_id}
                  onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="">Select Manager</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active === 1}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
              >
                {editingWarehouse ? 'Update' : 'Create'} Warehouse
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingWarehouse(null);
                  resetForm();
                }}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showTransferForm && (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Transfer Stock Between Warehouses</h2>
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">From Warehouse *</label>
                <select
                  value={transferData.from_warehouse_id}
                  onChange={(e) => setTransferData({ ...transferData, from_warehouse_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                >
                  <option value="">Select Warehouse</option>
                  {warehouses
                    .filter((w) => w.is_active === 1)
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} - {warehouse.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">To Warehouse *</label>
                <select
                  value={transferData.to_warehouse_id}
                  onChange={(e) => setTransferData({ ...transferData, to_warehouse_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                >
                  <option value="">Select Warehouse</option>
                  {warehouses
                    .filter((w) => w.is_active === 1 && w.id !== parseInt(transferData.from_warehouse_id))
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} - {warehouse.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Product *</label>
                <select
                  value={transferData.product_id}
                  onChange={(e) => setTransferData({ ...transferData, product_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={transferData.quantity}
                  onChange={(e) => setTransferData({ ...transferData, quantity: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={transferData.notes}
                  onChange={(e) => setTransferData({ ...transferData, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
              >
                Transfer Stock
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowTransferForm(false);
                  resetTransferForm();
                }}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showStockView && selectedWarehouse && (
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Stock in {selectedWarehouse.code} - {selectedWarehouse.name}
            </h2>
            <button
              onClick={() => {
                setShowStockView(false);
                setSelectedWarehouse(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Product</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">SKU</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Quantity</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Min</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Max</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {selectedWarehouse.stock?.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{item.product_name}</td>
                  <td className="px-4 py-3 text-sm">{item.sku}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatNumber(item.quantity)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatNumber(item.min_quantity || 0)}</td>
                  <td className="px-4 py-3 text-right text-sm">{item.max_quantity ? formatNumber(item.max_quantity) : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {item.quantity <= (item.min_quantity || 0) && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="h-3 w-3" /> Low Stock
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!selectedWarehouse.stock || selectedWarehouse.stock.length === 0) && (
            <div className="py-8 text-center text-gray-500">No stock items found</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((warehouse) => (
          <div key={warehouse.id} className="rounded-lg border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{warehouse.name}</h3>
                <p className="text-sm text-gray-500">{warehouse.code}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  warehouse.is_active === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {warehouse.is_active === 1 ? 'Active' : 'Inactive'}
              </span>
            </div>

            {warehouse.address && (
              <p className="mb-2 text-sm text-gray-600">{warehouse.address}</p>
            )}
            {warehouse.phone && (
              <p className="mb-2 text-sm text-gray-600">Phone: {warehouse.phone}</p>
            )}
            {warehouse.manager_name && (
              <p className="mb-4 text-sm text-gray-600">Manager: {warehouse.manager_name}</p>
            )}

            <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-3">
              <div>
                <p className="text-xs text-gray-500">Products</p>
                <p className="text-lg font-semibold">{warehouse.product_count || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Stock</p>
                <p className="text-lg font-semibold">{formatNumber(warehouse.total_stock || 0)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleViewStock(warehouse)}
                className="flex-1 rounded-lg border border-primary-600 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
              >
                <Package className="mx-auto h-4 w-4" />
              </button>
              <button
                onClick={() => handleEdit(warehouse)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                <Edit className="mx-auto h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(warehouse.id)}
                className="flex-1 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="mx-auto h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {warehouses.length === 0 && (
        <div className="rounded-lg border bg-white py-12 text-center text-gray-500">
          <Package className="mx-auto mb-2 h-12 w-12 text-gray-400" />
          <p>No warehouses found. Create your first warehouse to get started.</p>
        </div>
      )}
    </div>
  );
}
