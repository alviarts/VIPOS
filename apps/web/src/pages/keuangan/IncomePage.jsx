// Penerimaan — manual income entry list + form. Auto-posts journal Dr Cash, Cr Revenue.
import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { ConfirmationDialog, EmptyState, PageHeader } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function IncomePage() {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({
    income_date: today(),
    source_type: 'other',
    customer_id: '',
    source_other: '',
    category: '',
    amount: 0,
    cash_account_id: '',
    revenue_account_id: '',
    tax_amount: 0,
    description: '',
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [r, a, c] = await Promise.all([
      api.get('/income'),
      api.get('/account?is_active=1'),
      api.get('/customers').catch(() => ({ data: [] })),
    ]);
    setRows(Array.isArray(r.data) ? r.data : []);
    setAccounts(Array.isArray(a.data) ? a.data : []);
    setCustomers(Array.isArray(c.data) ? c.data : []);
  }

  const cashAccounts = accounts.filter((a) => a.type === 'ASET' && a.subtype === 'Kas & Bank');
  const revenueAccounts = accounts.filter((a) => a.type === 'PENDAPATAN');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        tax_amount: Number(form.tax_amount) || 0,
        cash_account_id: Number(form.cash_account_id),
        revenue_account_id: Number(form.revenue_account_id),
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        source_other: form.source_other || null,
        category: form.category || null,
        description: form.description || null,
      };
      await api.post('/income', payload);
      toast.success('Penerimaan tersimpan + jurnal otomatis di-post');
      setShowForm(false);
      setForm({
        income_date: today(),
        source_type: 'other',
        customer_id: '',
        source_other: '',
        category: '',
        amount: 0,
        cash_account_id: '',
        revenue_account_id: '',
        tax_amount: 0,
        description: '',
      });
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/income/${confirmDelete.id}`);
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
        title="Penerimaan"
        description="Catat pendapatan / penerimaan kas selain transaksi POS. Sistem otomatis membuat jurnal Dr Kas, Cr Pendapatan."
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Penerimaan Baru
          </button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            title="Belum ada penerimaan"
            description="Tambahkan penerimaan baru untuk mulai."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Ref</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Kategori</th>
                <th className="px-4 py-3 text-left">Akun Kas</th>
                <th className="px-4 py-3 text-left">Akun Pendapatan</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.ref_no}</td>
                  <td className="px-4 py-3">{formatDate(r.income_date)}</td>
                  <td className="px-4 py-3 text-xs">{r.category || '-'}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.cash_account_code} — {r.cash_account_name}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.revenue_account_code} — {r.revenue_account_name}
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
              <h2 className="text-base font-semibold">Penerimaan Baru</h2>
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
                    value={form.income_date}
                    onChange={(e) => setForm({ ...form, income_date: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Sumber">
                  <select
                    value={form.source_type}
                    onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="other">Lainnya</option>
                    <option value="customer">Pelanggan</option>
                  </select>
                </Field>
              </div>
              {form.source_type === 'customer' && (
                <Field label="Pelanggan">
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">— Pilih pelanggan —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama || c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {form.source_type === 'other' && (
                <Field label="Sumber Lain">
                  <input
                    value={form.source_other}
                    onChange={(e) => setForm({ ...form, source_other: e.target.value })}
                    className="input-field"
                    placeholder="cth: Rental gedung"
                  />
                </Field>
              )}
              <Field label="Kategori">
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="input-field"
                  placeholder="cth: Konsultasi, Sewa, Bunga Bank"
                />
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
              <Field label="Akun Kas/Bank (Dr)" required>
                <select
                  required
                  value={form.cash_account_id}
                  onChange={(e) => setForm({ ...form, cash_account_id: e.target.value })}
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
              <Field label="Akun Pendapatan (Cr)" required>
                <select
                  required
                  value={form.revenue_account_id}
                  onChange={(e) => setForm({ ...form, revenue_account_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">— Pilih akun pendapatan —</option>
                  {revenueAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Keterangan">
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                />
              </Field>
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
        title="Hapus penerimaan?"
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
