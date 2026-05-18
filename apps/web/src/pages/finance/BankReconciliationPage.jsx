// Bank Reconciliation Page
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/format';

export default function BankReconciliationPage() {
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecon, setEditingRecon] = useState(null);
  const [accounts, setAccounts] = useState([]);

  const [formData, setFormData] = useState({
    account_id: '',
    statement_date: '',
    statement_balance: 0,
    book_balance: 0,
    status: 'in_progress',
    notes: '',
    items: [],
  });

  useEffect(() => {
    fetchReconciliations();
    fetchAccounts();
  }, []);

  const fetchReconciliations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bank-reconciliation');
      setReconciliations(res.data || []);
    } catch (error) {
      console.error('Error fetching reconciliations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/account', { params: { type: 'asset' } });
      setAccounts(res.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRecon) {
        await api.put(`/bank-reconciliation/${editingRecon.id}`, formData);
      } else {
        await api.post('/bank-reconciliation', formData);
      }
      setShowForm(false);
      setEditingRecon(null);
      resetForm();
      fetchReconciliations();
    } catch (error) {
      console.error('Error saving reconciliation:', error);
      alert('Failed to save reconciliation');
    }
  };

  const handleEdit = async (recon) => {
    try {
      const res = await api.get(`/bank-reconciliation/${recon.id}`);
      setEditingRecon(res.data);
      setFormData({
        account_id: res.data.account_id,
        statement_date: res.data.statement_date,
        statement_balance: res.data.statement_balance,
        book_balance: res.data.book_balance,
        status: res.data.status,
        notes: res.data.notes || '',
        items: res.data.items || [],
      });
      setShowForm(true);
    } catch (error) {
      console.error('Error fetching reconciliation:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this reconciliation?')) return;
    try {
      await api.delete(`/bank-reconciliation/${id}`);
      fetchReconciliations();
    } catch (error) {
      console.error('Error deleting reconciliation:', error);
      alert('Failed to delete reconciliation');
    }
  };

  const handleComplete = async (id) => {
    if (!confirm('Mark this reconciliation as completed?')) return;
    try {
      await api.post(`/bank-reconciliation/${id}/complete`);
      fetchReconciliations();
    } catch (error) {
      console.error('Error completing reconciliation:', error);
      alert('Failed to complete reconciliation');
    }
  };

  const resetForm = () => {
    setFormData({
      account_id: '',
      statement_date: '',
      statement_balance: 0,
      book_balance: 0,
      status: 'in_progress',
      notes: '',
      items: [],
    });
  };

  const addReconItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { transaction_id: null, description: '', amount: 0, is_matched: 0, notes: '' }],
    });
  };

  const removeReconItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateReconItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/finance" className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingRecon(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New Reconciliation
        </button>
      </header>

      {showForm ? (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">
            {editingRecon ? 'Edit Reconciliation' : 'Create Reconciliation'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Bank Account</label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                >
                  <option value="">Select Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Statement Date</label>
                <input
                  type="date"
                  value={formData.statement_date}
                  onChange={(e) => setFormData({ ...formData, statement_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Statement Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.statement_balance}
                  onChange={(e) => setFormData({ ...formData, statement_balance: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Book Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.book_balance}
                  onChange={(e) => setFormData({ ...formData, book_balance: parseFloat(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                rows={3}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">Reconciliation Items</h3>
                <button
                  type="button"
                  onClick={addReconItem}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateReconItem(index, 'description', e.target.value)}
                      className="flex-1 rounded-lg border px-3 py-2"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => updateReconItem(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-32 rounded-lg border px-3 py-2"
                      required
                    />
                    <label className="flex items-center gap-2 rounded-lg border px-3 py-2">
                      <input
                        type="checkbox"
                        checked={item.is_matched === 1}
                        onChange={(e) => updateReconItem(index, 'is_matched', e.target.checked ? 1 : 0)}
                      />
                      <span className="text-sm">Matched</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeReconItem(index)}
                      className="rounded-lg border border-red-300 px-3 py-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
              >
                {editingRecon ? 'Update' : 'Create'} Reconciliation
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRecon(null);
                  resetForm();
                }}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Account</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Statement Date</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Statement Balance</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Book Balance</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Difference</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Matched</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reconciliations.map((recon) => {
                const difference = recon.statement_balance - recon.book_balance;
                return (
                  <tr key={recon.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {recon.account_code} - {recon.account_name}
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(recon.statement_date)}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatCurrency(recon.statement_balance)}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatCurrency(recon.book_balance)}</td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-medium ${
                        Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(difference)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs ${
                          recon.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : recon.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {recon.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {recon.matched_count || 0} / {recon.item_count || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(recon)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {recon.status === 'in_progress' && (
                          <button
                            onClick={() => handleComplete(recon.id)}
                            className="text-green-600 hover:text-green-800"
                            title="Complete"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(recon.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {reconciliations.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              <XCircle className="mx-auto mb-2 h-12 w-12 text-gray-400" />
              <p>No reconciliations found. Create your first reconciliation to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
