// Jurnal Umum — list + manual journal entry form with balance check.
import { useEffect, useMemo, useState } from 'react';
import { Eye, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { EmptyState, PageHeader } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/format';

const SOURCE_TYPE_LABEL = {
  manual: 'Manual',
  sale: 'Penjualan',
  income: 'Penerimaan',
  expense: 'Pengeluaran',
  transfer: 'Transfer',
  payroll: 'Payroll',
  depreciation: 'Penyusutan',
  disposal: 'Pelepasan',
  opening: 'Saldo Awal',
};

const today = () => new Date().toISOString().slice(0, 10);

const blankLine = () => ({ account_id: '', debit: 0, credit: 0, description: '' });

export default function JournalPage() {
  const [journals, setJournals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(null);

  const [form, setForm] = useState({
    journal_date: today(),
    description: '',
    lines: [blankLine(), blankLine()],
  });

  useEffect(() => {
    loadJournals();
    loadAccounts();
  }, [filterFrom, filterTo]);

  async function loadJournals() {
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      const { data } = await api.get(`/journal?${params.toString()}`);
      setJournals(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat jurnal');
    }
  }

  async function loadAccounts() {
    try {
      const { data } = await api.get('/account?is_active=1');
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setAccounts([]);
    }
  }

  const totalDebit = useMemo(
    () => form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0),
    [form.lines]
  );
  const totalCredit = useMemo(
    () => form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0),
    [form.lines]
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  function updateLine(idx, patch) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, blankLine()] }));
  }

  function removeLine(idx) {
    setForm((f) => ({
      ...f,
      lines: f.lines.length > 2 ? f.lines.filter((_, i) => i !== idx) : f.lines,
    }));
  }

  function resetForm() {
    setForm({
      journal_date: today(),
      description: '',
      lines: [blankLine(), blankLine()],
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isBalanced) {
      toast.error('Total debit harus sama dengan total credit');
      return;
    }
    try {
      const payload = {
        journal_date: form.journal_date,
        description: form.description || null,
        source_type: 'manual',
        lines: form.lines
          .filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
          .map((l) => ({
            account_id: Number(l.account_id),
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || null,
          })),
      };
      await api.post('/journal', payload);
      toast.success('Jurnal berhasil di-post');
      setShowForm(false);
      resetForm();
      loadJournals();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal posting jurnal');
    }
  }

  async function viewDetail(id) {
    try {
      const { data } = await api.get(`/journal/${id}`);
      setShowDetail(data);
    } catch {
      toast.error('Gagal memuat detail jurnal');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurnal Umum"
        description="Posting jurnal manual + view jurnal otomatis dari sistem (penjualan, penerimaan, pengeluaran, dll)."
        actions={
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Jurnal Baru
          </button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <DateField label="Dari" value={filterFrom} onChange={setFilterFrom} />
        <DateField label="Sampai" value={filterTo} onChange={setFilterTo} />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {journals.length === 0 ? (
          <EmptyState
            title="Belum ada jurnal"
            description="Posting jurnal manual atau lakukan transaksi yang otomatis ter-jurnal."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">No. Jurnal</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Sumber</th>
                <th className="px-4 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Lines</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {journals.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{j.journal_no}</td>
                  <td className="px-4 py-3">{formatDate(j.journal_date)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="rounded bg-gray-100 px-2 py-0.5">
                      {SOURCE_TYPE_LABEL[j.source_type] || j.source_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{j.description || '-'}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(j.total_amount)}</td>
                  <td className="px-4 py-3 text-center">{j.line_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => viewDetail(j.id)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Eye className="h-4 w-4" />
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">Jurnal Manual Baru</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tanggal" required>
                  <input
                    type="date"
                    required
                    value={form.journal_date}
                    onChange={(e) => setForm({ ...form, journal_date: e.target.value })}
                    className="input-field"
                  />
                </Field>
                <Field label="Keterangan">
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input-field"
                    placeholder="Deskripsi singkat jurnal"
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Akun</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Kredit</th>
                      <th className="px-3 py-2 text-left">Keterangan</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <select
                            value={line.account_id}
                            onChange={(e) => updateLine(idx, { account_id: e.target.value })}
                            className="input-field"
                          >
                            <option value="">— Pilih akun —</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} — {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={line.debit}
                            onChange={(e) => updateLine(idx, { debit: e.target.value, credit: 0 })}
                            className="input-field text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={line.credit}
                            onChange={(e) => updateLine(idx, { credit: e.target.value, debit: 0 })}
                            className="input-field text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={line.description}
                            onChange={(e) => updateLine(idx, { description: e.target.value })}
                            className="input-field"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={form.lines.length <= 2}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 text-sm">
                    <tr>
                      <td className="px-3 py-2 font-semibold">Total</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(totalDebit)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(totalCredit)}
                      </td>
                      <td colSpan={2} className="px-3 py-2 text-xs">
                        {isBalanced ? (
                          <span className="text-green-600">✓ Balanced</span>
                        ) : (
                          <span className="text-red-600">
                            Selisih: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-2 rounded border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah baris
              </button>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Posting Jurnal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">{showDetail.journal_no}</h2>
                <p className="text-xs text-gray-500">
                  {formatDate(showDetail.journal_date)} •{' '}
                  {SOURCE_TYPE_LABEL[showDetail.source_type]}
                </p>
              </div>
              <button
                onClick={() => setShowDetail(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              {showDetail.description && (
                <p className="mb-3 text-sm text-gray-600">{showDetail.description}</p>
              )}
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Akun</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {showDetail.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-gray-500">{l.account_code}</span>{' '}
                        {l.account_name}
                        {l.description && (
                          <div className="text-xs text-gray-500">{l.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(l.debit)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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

function DateField({ label, value, onChange }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    </label>
  );
}
