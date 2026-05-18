// Budget Planning Page
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, TrendingUp, DollarSign } from 'lucide-react';
import api from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/format';

export default function BudgetPlanningPage() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [accounts, setAccounts] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    period_start: '',
    period_end: '',
    total_amount: 0,
    category: 'operational',
    status: 'draft',
    notes: '',
    items: [],
  });

  useEffect(() => {
    fetchBudgets();
    fetchAccounts();
  }, []);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/budgets');
      setBudgets(res.data || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/account');
      setAccounts(res.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBudget) {
        await api.put(`/budgets/${editingBudget.id}`, formData);
      } else {
        await api.post('/budgets', formData);
      }
      setShowForm(false);
      setEditingBudget(null);
      resetForm();
      fetchBudgets();
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Failed to save budget');
    }
  };

  const handleEdit = async (budget) => {
    try {
      const res = await api.get(`/budgets/${budget.id}`);
      setEditingBudget(res.data);
      setFormData({
        name: res.data.name,
        period_start: res.data.period_start,
        period_end: res.data.period_end,
        total_amount: res.data.total_amount,
        category: res.data.category || 'operational',
        status: res.data.status,
        notes: res.data.notes || '',
        items: res.data.items || [],
      });
      setShowForm(true);
    } catch (error) {
      console.error('Error fetching budget:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    try {
      await api.delete(`/budgets/${id}`);
      fetchBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
      alert('Failed to delete budget');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      period_start: '',
      period_end: '',
      total_amount: 0,
      category: 'operational',
      status: 'draft',
      notes: '',
      items: [],
    });
  };

  const addBudgetItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { account_id: '', amount: 0, actual_amount: 0, notes: '' }],
    });
  };

  const removeBudgetItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateBudgetItem = (index, field, value) => {
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
          <h1 className="text-2xl font-bold">Budget Planning</h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingBudget(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> New Budget
        </button>
      </header>

      {showForm ? (
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">{editingBudget ? 'Edit Budget' : 'Create Budget'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Budget Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                >
                  <option value="operational">Operational</option>
                  <option value="capital">Capital</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Period Start</label>
                <input
                  type="date"
                  value={formData.period_start}
                  onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Period End</label>
                <input
                  type="date"
                  value={formData.period_end}
                  onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
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
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
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
                <h3 className="font-medium">Budget Items</h3>
                <button
                  type="button"
                  onClick={addBudgetItem}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <select
                      value={item.account_id}
                      onChange={(e) => updateBudgetItem(index, 'account_id', e.target.value)}
                      className="flex-1 rounded-lg border px-3 py-2"
                      required
                    >
                      <option value="">Select Account</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Budgeted Amount"
                      value={item.amount}
                      onChange={(e) => updateBudgetItem(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-40 rounded-lg border px-3 py-2"
                      required
                    />
                    {editingBudget && (
                      <input
                        type="number"
                        placeholder="Actual Amount"
                        value={item.actual_amount}
                        onChange={(e) => updateBudgetItem(index, 'actual_amount', parseFloat(e.target.value) || 0)}
                        className="w-40 rounded-lg border px-3 py-2"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeBudgetItem(index)}
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
                {editingBudget ? 'Update' : 'Create'} Budget
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingBudget(null);
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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Period</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Category</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Total Amount</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Items</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {budgets.map((budget) => (
                <tr key={budget.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{budget.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {formatDate(budget.period_start)} - {formatDate(budget.period_end)}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{budget.category}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(budget.total_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs ${
                        budget.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : budget.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : budget.status === 'closed'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {budget.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">{budget.item_count || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(budget)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(budget.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {budgets.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              <DollarSign className="mx-auto mb-2 h-12 w-12 text-gray-400" />
              <p>No budgets found. Create your first budget to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
