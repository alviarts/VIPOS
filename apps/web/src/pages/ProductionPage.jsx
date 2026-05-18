/**
 * Production Management Page
 * 
 * Manages production orders and material consumption.
 * Features:
 * - List all production orders with status badges
 * - Filter by status and product
 * - Search by order number
 * - Create new production order
 * - View order details with materials
 * - Status workflow actions (Start, Complete, Cancel)
 */

import { useState, useEffect } from 'react';
import { 
  Plus, Search, Eye, Package, 
  Play, CheckCircle, XCircle, Calendar, 
  FileText, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from '../utils/toast';
import api from '../utils/api';

const STATUS_CONFIG = {
  PLANNED: { label: 'Planned', color: 'bg-blue-100 text-blue-800', icon: FileText },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: Play },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function ProductionPage() {
  const { token } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProduct, setFilterProduct] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadOrders();
    loadProducts();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await api.get('/production');
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load production orders');
      console.error('Load orders error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.get('/products');
      if (res.data.success) {
        setProducts(res.data.data);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleViewDetails = async (order) => {
    try {
      const res = await api.get(`/production/${order.id}`);
      if (res.data.success) {
        setSelectedOrder(res.data.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      toast.error('Failed to load order details');
    }
  };

  const handleStatusAction = async (orderId, action, data = {}) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/production/${orderId}/${action}`, data);
      if (res.data.success) {
        toast.success(`Production order ${action}ed successfully`);
        await loadOrders();
        if (selectedOrder?.id === orderId) {
          const detailRes = await api.get(`/production/${orderId}`);
          if (detailRes.data.success) {
            setSelectedOrder(detailRes.data.data);
          }
        }
      } else {
        toast.error(res.data.error || `Failed to ${action} order`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || `Failed to ${action} order`;
      toast.error(errorMsg);
      console.error(`${action} error:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesProduct = filterProduct === 'all' || order.product_id === parseInt(filterProduct);
    return matchesSearch && matchesStatus && matchesProduct;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Production Management</h1>
        <p className="text-gray-600 mt-1">Manage production orders and material consumption</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search order number or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field"
          >
            <option value="all">All Status</option>
            {Object.keys(STATUS_CONFIG).map((status) => (
              <option key={status} value={status}>
                {STATUS_CONFIG[status].label}
              </option>
            ))}
          </select>

          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="input-field"
          >
            <option value="all">All Products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Production Order
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scheduled Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Materials
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No production orders found</p>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const StatusIcon = STATUS_CONFIG[order.status]?.icon || FileText;
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{order.product_name}</div>
                      <div className="text-xs text-gray-500">{order.product_sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.quantity}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[order.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_CONFIG[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.scheduled_date ? new Date(order.scheduled_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.material_count || 0} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(order)}
                        className="text-primary-600 hover:text-primary-900 inline-flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateProductionModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadOrders();
          }}
          products={products}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <ProductionDetailModal
          order={selectedOrder}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedOrder(null);
          }}
          onAction={handleStatusAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

// Create Production Order Modal Component
function CreateProductionModal({ onClose, onSuccess, products }) {
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    scheduled_date: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/production', {
        ...formData,
        product_id: parseInt(formData.product_id),
        quantity: parseFloat(formData.quantity),
      });

      if (res.data.success) {
        toast.success('Production order created successfully');
        onSuccess();
      } else {
        toast.error(res.data.error || 'Failed to create production order');
      }
    } catch (error) {
      toast.error('Failed to create production order');
      console.error('Create error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create Production Order</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product *
            </label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="input-field"
              required
              min="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Date
            </label>
            <input
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field"
              rows="3"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Production Detail Modal Component
function ProductionDetailModal({ order, onClose, onAction, actionLoading }) {
  const StatusIcon = STATUS_CONFIG[order.status]?.icon || FileText;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{order.order_number}</h2>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${STATUS_CONFIG[order.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                <StatusIcon className="w-3 h-3" />
                {STATUS_CONFIG[order.status]?.label || order.status}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Product</label>
              <p className="text-gray-900 mt-1">{order.product_name}</p>
              <p className="text-sm text-gray-500">{order.product_sku}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Quantity</label>
              <p className="text-gray-900 mt-1">{order.quantity}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Scheduled Date</label>
              <p className="text-gray-900 mt-1">
                {order.scheduled_date ? new Date(order.scheduled_date).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Created By</label>
              <p className="text-gray-900 mt-1">{order.created_by_name || '-'}</p>
            </div>
          </div>

          {order.notes && (
            <div>
              <label className="text-sm font-medium text-gray-500">Notes</label>
              <p className="text-gray-900 mt-1">{order.notes}</p>
            </div>
          )}

          {/* Materials */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Materials Required</h3>
            {order.materials && order.materials.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Used</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.materials.map((material) => (
                      <tr key={material.id}>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{material.material_name}</div>
                          <div className="text-xs text-gray-500">{material.material_sku}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {material.required_quantity} {material.material_unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {material.used_quantity || 0} {material.material_unit}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${material.current_stock < material.required_quantity ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                            {material.current_stock} {material.material_unit}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No materials defined for this order</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {order.status === 'PLANNED' && (
              <>
                <button
                  onClick={() => onAction(order.id, 'start')}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={actionLoading}
                >
                  <Play className="w-4 h-4" />
                  Start Production
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Enter cancellation reason:');
                    if (reason) onAction(order.id, 'cancel', { reason });
                  }}
                  className="btn-secondary flex items-center justify-center gap-2"
                  disabled={actionLoading}
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              </>
            )}
            {order.status === 'IN_PROGRESS' && (
              <>
                <button
                  onClick={() => onAction(order.id, 'complete')}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Production
                </button>
              </>
            )}
            {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
              <button
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
