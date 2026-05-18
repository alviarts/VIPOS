/**
 * Inter-outlet Transfers Management Page
 * 
 * Manages product transfers between outlets.
 * Features:
 * - List all transfers with status badges
 * - Filter by status, from_outlet, to_outlet
 * - Search by transfer number
 * - Create new transfer with products
 * - View transfer details
 * - Status workflow actions (Submit, Approve, Ship, Receive, Cancel)
 */

import { useState, useEffect } from 'react';
import { 
  Plus, Search, Eye, Edit, X, Package, 
  Send, CheckCircle, Truck, Archive, XCircle,
  ArrowRight, Calendar, User, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOutlet } from '../context/OutletContext';
import toast from '../utils/toast';
import api from '../utils/api';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: FileText },
  SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-800', icon: Send },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-800', icon: Truck },
  RECEIVED: { label: 'Received', color: 'bg-teal-100 text-teal-800', icon: Archive },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function TransfersPage() {
  const { token } = useAuth();
  const { outlets } = useOutlet();
  
  const [transfers, setTransfers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFromOutlet, setFilterFromOutlet] = useState('all');
  const [filterToOutlet, setFilterToOutlet] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadTransfers();
    loadProducts();
  }, []);

  const loadTransfers = async () => {
    try {
      const res = await api.get('/transfers');
      if (res.data.success) {
        setTransfers(res.data.data);
      }
    } catch (error) {
      toast.error('Failed to load transfers');
      console.error('Load transfers error:', error);
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

  const handleViewDetails = async (transfer) => {
    try {
      const res = await api.get(`/transfers/${transfer.id}`);
      if (res.data.success) {
        setSelectedTransfer(res.data.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      toast.error('Failed to load transfer details');
    }
  };

  const handleStatusAction = async (transferId, action, data = {}) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/transfers/${transferId}/${action}`, data);
      if (res.data.success) {
        toast.success(`Transfer ${action}ed successfully`);
        await loadTransfers();
        if (selectedTransfer?.id === transferId) {
          const detailRes = await api.get(`/transfers/${transferId}`);
          if (detailRes.data.success) {
            setSelectedTransfer(detailRes.data.data);
          }
        }
      } else {
        toast.error(res.data.error || `Failed to ${action} transfer`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} transfer`);
      console.error(`${action} error:`, error);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTransfers = transfers.filter((transfer) => {
    const matchesSearch = transfer.transfer_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || transfer.status === filterStatus;
    const matchesFromOutlet = filterFromOutlet === 'all' || transfer.from_outlet_id === filterFromOutlet;
    const matchesToOutlet = filterToOutlet === 'all' || transfer.to_outlet_id === filterToOutlet;
    return matchesSearch && matchesStatus && matchesFromOutlet && matchesToOutlet;
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
        <h1 className="text-2xl font-bold text-gray-900">Inter-outlet Transfers</h1>
        <p className="text-gray-600 mt-1">Manage product transfers between outlets</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search transfer number..."
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
            value={filterFromOutlet}
            onChange={(e) => setFilterFromOutlet(e.target.value)}
            className="input-field"
          >
            <option value="all">All From Outlets</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>

          <select
            value={filterToOutlet}
            onChange={(e) => setFilterToOutlet(e.target.value)}
            className="input-field"
          >
            <option value="all">All To Outlets</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Transfer
          </button>
        </div>
      </div>

      {/* Transfers List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transfer Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                From Outlet
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                To Outlet
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTransfers.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No transfers found</p>
                </td>
              </tr>
            ) : (
              filteredTransfers.map((transfer) => {
                const statusConfig = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.DRAFT;
                const StatusIcon = statusConfig.icon;
                return (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {transfer.transfer_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{transfer.from_outlet_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{transfer.to_outlet_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{transfer.items_count || 0} items</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transfer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(transfer)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Transfer Modal */}
      {showCreateModal && (
        <CreateTransferModal
          outlets={outlets}
          products={products}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadTransfers();
          }}
        />
      )}

      {/* Transfer Detail Modal */}
      {showDetailModal && selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTransfer(null);
          }}
          onAction={handleStatusAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

// Create Transfer Modal Component
function CreateTransferModal({ outlets, products, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    from_outlet_id: '',
    to_outlet_id: '',
    notes: '',
    items: [],
  });
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');

  const handleAddItem = () => {
    if (!selectedProduct || !quantity || quantity <= 0) {
      toast.error('Please select a product and enter a valid quantity');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingItemIndex = formData.items.findIndex(item => item.product_id === selectedProduct);
    
    if (existingItemIndex >= 0) {
      const updatedItems = [...formData.items];
      updatedItems[existingItemIndex].quantity = parseInt(quantity);
      setFormData({ ...formData, items: updatedItems });
    } else {
      setFormData({
        ...formData,
        items: [
          ...formData.items,
          {
            product_id: selectedProduct,
            product_name: product.name,
            quantity: parseInt(quantity),
          },
        ],
      });
    }

    setSelectedProduct('');
    setQuantity('');
  };

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.from_outlet_id || !formData.to_outlet_id) {
      toast.error('Please select both from and to outlets');
      return;
    }

    if (formData.from_outlet_id === formData.to_outlet_id) {
      toast.error('From and To outlets must be different');
      return;
    }

    if (formData.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/transfers', formData);
      if (res.data.success) {
        toast.success('Transfer created successfully');
        onSuccess();
      } else {
        toast.error(res.data.error || 'Failed to create transfer');
      }
    } catch (error) {
      toast.error('Failed to create transfer');
      console.error('Create transfer error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Create New Transfer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Outlet Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Outlet *
              </label>
              <select
                value={formData.from_outlet_id}
                onChange={(e) => setFormData({ ...formData, from_outlet_id: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Select outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Outlet *
              </label>
              <select
                value={formData.to_outlet_id}
                onChange={(e) => setFormData({ ...formData, to_outlet_id: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Select outlet</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Add Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Products
            </label>
            <div className="flex gap-2">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="input-field flex-1"
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input-field w-24"
                min="1"
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="btn-secondary"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Items List */}
          {formData.items.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.product_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field"
              rows="3"
              placeholder="Add any notes about this transfer..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Transfer Detail Modal Component
function TransferDetailModal({ transfer, onClose, onAction, actionLoading }) {
  const [receiveQuantities, setReceiveQuantities] = useState({});
  const [showReceiveForm, setShowReceiveForm] = useState(false);

  useEffect(() => {
    if (transfer.items) {
      const initialQuantities = {};
      transfer.items.forEach(item => {
        initialQuantities[item.id] = item.quantity_requested - (item.quantity_received || 0);
      });
      setReceiveQuantities(initialQuantities);
    }
  }, [transfer]);

  const handleReceive = async () => {
    const items = Object.entries(receiveQuantities).map(([itemId, quantity]) => ({
      item_id: itemId,
      quantity_received: parseInt(quantity) || 0,
    }));

    await onAction(transfer.id, 'receive', { items });
    setShowReceiveForm(false);
  };

  const canEdit = transfer.status === 'DRAFT';
  const canSubmit = transfer.status === 'DRAFT';
  const canApprove = transfer.status === 'SUBMITTED';
  const canShip = transfer.status === 'APPROVED';
  const canReceive = transfer.status === 'SHIPPED';
  const canCancel = ['DRAFT', 'SUBMITTED'].includes(transfer.status);

  const statusConfig = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.DRAFT;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Transfer Details</h2>
            <p className="text-sm text-gray-500 mt-1">{transfer.transfer_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status and Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    {statusConfig.label}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created Date</label>
                <div className="mt-1 flex items-center gap-2 text-gray-900">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {new Date(transfer.created_at).toLocaleString()}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">From Outlet</label>
                <div className="mt-1 text-gray-900 font-medium">
                  {transfer.from_outlet_name}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">To Outlet</label>
                <div className="mt-1 text-gray-900 font-medium">
                  {transfer.to_outlet_name}
                </div>
              </div>
              {transfer.created_by_name && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Created By</label>
                  <div className="mt-1 flex items-center gap-2 text-gray-900">
                    <User className="w-4 h-4 text-gray-400" />
                    {transfer.created_by_name}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div>
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <p className="mt-1 text-gray-600 bg-gray-50 rounded p-3">{transfer.notes}</p>
            </div>
          )}

          {/* Items List */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Transfer Items</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Requested
                    </th>
                    {transfer.status === 'SHIPPED' || transfer.status === 'RECEIVED' ? (
                      <>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Shipped
                        </th>
                        {transfer.status === 'RECEIVED' && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Received
                          </th>
                        )}
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transfer.items && transfer.items.length > 0 ? (
                    transfer.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.product_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {item.quantity_requested}
                        </td>
                        {transfer.status === 'SHIPPED' || transfer.status === 'RECEIVED' ? (
                          <>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {item.quantity_shipped || item.quantity_requested}
                            </td>
                            {transfer.status === 'RECEIVED' && (
                              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                {item.quantity_received || 0}
                              </td>
                            )}
                          </>
                        ) : null}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receive Form */}
          {showReceiveForm && canReceive && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-3">Receive Items</h4>
              <div className="space-y-2">
                {transfer.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 flex-1">{item.product_name}</span>
                    <span className="text-sm text-gray-500">
                      Shipped: {item.quantity_shipped || item.quantity_requested}
                    </span>
                    <input
                      type="number"
                      value={receiveQuantities[item.id] || 0}
                      onChange={(e) => setReceiveQuantities({
                        ...receiveQuantities,
                        [item.id]: e.target.value
                      })}
                      className="input-field w-24"
                      min="0"
                      max={item.quantity_shipped || item.quantity_requested}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowReceiveForm(false)}
                  className="btn-secondary text-sm"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReceive}
                  className="btn-primary text-sm"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Confirm Receipt'}
                </button>
              </div>
            </div>
          )}

          {/* Status History */}
          {transfer.status_history && transfer.status_history.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Status History</h3>
              <div className="space-y-2">
                {transfer.status_history.map((history, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-primary-600"></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {STATUS_CONFIG[history.status]?.label || history.status}
                        </span>
                        <span className="text-gray-500">
                          {new Date(history.created_at).toLocaleString()}
                        </span>
                      </div>
                      {history.notes && (
                        <p className="text-gray-600 mt-1">{history.notes}</p>
                      )}
                      {history.created_by_name && (
                        <p className="text-gray-500 text-xs mt-1">by {history.created_by_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
            {canSubmit && (
              <button
                onClick={() => onAction(transfer.id, 'submit')}
                className="btn-primary flex items-center gap-2"
                disabled={actionLoading}
              >
                <Send className="w-4 h-4" />
                Submit
              </button>
            )}
            {canApprove && (
              <>
                <button
                  onClick={() => onAction(transfer.id, 'approve')}
                  className="btn-primary flex items-center gap-2"
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to reject this transfer?')) {
                      onAction(transfer.id, 'cancel');
                    }
                  }}
                  className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
                  disabled={actionLoading}
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </>
            )}
            {canShip && (
              <button
                onClick={() => onAction(transfer.id, 'ship')}
                className="btn-primary flex items-center gap-2"
                disabled={actionLoading}
              >
                <Truck className="w-4 h-4" />
                Ship
              </button>
            )}
            {canReceive && !showReceiveForm && (
              <button
                onClick={() => setShowReceiveForm(true)}
                className="btn-primary flex items-center gap-2"
                disabled={actionLoading}
              >
                <Archive className="w-4 h-4" />
                Receive
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this transfer?')) {
                    onAction(transfer.id, 'cancel');
                  }
                }}
                className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
                disabled={actionLoading}
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            )}
            <button
              onClick={onClose}
              className="btn-secondary ml-auto"
              disabled={actionLoading}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
