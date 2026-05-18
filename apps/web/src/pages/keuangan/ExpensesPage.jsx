// Pengeluaran — manual expense entry list + form. Auto-posts journal Dr Beban, Cr Kas.
import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, PageHeader } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPage() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({
    expense_date: today(),
    vendor_id: '',
    expense_account_id: '',
    payment_account_id: '',
    amount: 0,
    tax_amount: 0,
    description: '',
    is_recurring: 0,
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [r, a, v] = await Promise.all([
      api.get('/expense'),
      api.get('/account?is_active=1'),
      api.get('/vendor').catch(() => ({ data: [] })),
    ]);
    setRows(Array.isArray(r.data) ? r.data : []);
    setAccounts(Array.isArray(a.data) ? a.data : []);
    setVendors(Array.isArray(v.data) ? v.data : []);
  }

  const expenseAccounts = accounts.filter((a) => a.type === 'BEBAN');
  const cashAccounts = accounts.filter((a) => a.type === 'ASET' && a.subtype === 'Kas & Bank');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        tax_amount: Number(form.tax_amount) || 0,
        expense_account_id: Number(form.expense_account_id),
        payment_account_id: Number(form.payment_account_id),
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
        description: form.description || null,
        is_recurring: form.is_recurring ? 1 : 0,
      };
      await api.post('/expense', payload);
      toast.success('Pengeluaran tersimpan + jurnal otomatis di-post');
      setShowForm(false);
      setForm({
        expense_date: today(),
        vendor_id: '',
        expense_account_id: '',
        payment_account_id: '',
        amount: 0,
        tax_amount: 0,
        description: '',
        is_recurring: 0,
      });
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/expense/${confirmDelete.id}`);
      toast.success('Dihapus');
      setConfirmDelete(null);
      loadAll();
    } catch {
      toast.error('Gagal menghapus');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengeluaran"
        description="Catat pengeluaran kas. Sistem otomatis membuat jurnal Dr Beban, Cr Kas."
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Pengeluaran Baru
          </button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            title="Belum ada pengeluaran"
            description="Tambahkan pengeluaran baru untuk mulai."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Ref</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-left">Akun Beban</th>
                <th className="px-4 py-3 text-left">Akun Kas</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.ref_no}</td>
                  <td className="px-4 py-3">{formatDate(r.expense_date)}</td>
                  <td className="px-4 py-3 text-xs">{r.vendor_name || '-'}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.expense_account_code} — {r.expense_account_name}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.payment_account_code} — {r.payment_account_name}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{r.description || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setConfirmDelete(r)}
                      className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">Pengeluaran Baru</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tanggal" required>
                  <input
                    type="date"
                    required
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Vendor">
                  <select
                    value={form.vendor_id}
                    onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">— Tidak ada —</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} — {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Akun Beban (Dr)" required>
                <select
                  required
                  value={form.expense_account_id}
                  onChange={(e) => setForm({ ...form, expense_account_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Pilih akun beban —</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bayar dari Akun (Cr)" required>
                <select
                  required
                  value={form.payment_account_id}
                  onChange={(e) => setForm({ ...form, payment_account_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Pilih akun kas/bank —</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jumlah" required>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Pajak (opsional)">
                  <input
                    type="number"
                    min={0}
                    value={form.tax_amount}
                    onChange={(e) => setForm({ ...form, tax_amount: e.target.value })}
                    className="input-field"
                  />
                </Field>
              </div>
              <Field label="Keterangan">
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={!!form.is_recurring}
                  onChange={(e) => setForm({ ...form, is_recurring: e.target.checked ? 1 : 0 })}
                />
                <label htmlFor="is_recurring" className="text-sm">
                  Tandai sebagai pengeluaran berulang
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus pengeluaran?"
        description={`${confirmDelete?.ref_no} ${formatCurrency(confirmDelete?.amount)} akan dihapus, termasuk jurnal terkait.`}
        confirmLabel="Hapus"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
