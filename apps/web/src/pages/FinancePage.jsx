import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  X,
  Search,
  TrendingUp,
  TrendingDown,
  Coins,
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';
import {
  ConfirmationDialog,
  EmptyState,
  Pagination,
  FilterTabs,
  PageHeader,
} from '../components/ui';

const TIPE_LABEL = {
  pemasukan: 'Pemasukan',
  pengeluaran: 'Pengeluaran',
  transfer: 'Transfer',
};

export default function FinancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('transactions');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [tipeFilter, setTipeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showTxForm, setShowTxForm] = useState(false);
  const [txForm, setTxForm] = useState(initTxForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [accRes, txRes, sumRes] = await Promise.all([
        api.get('/finance/accounts'),
        api.get('/finance/transactions?limit=500'),
        api.get('/finance/summary'),
      ]);
      setAccounts(accRes.data);
      setTransactions(txRes.data);
      setSummary(sumRes.data);
    } catch (err) {
      toast.error('Gagal memuat keuangan');
    }
  };

  const filteredTx = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      if (tipeFilter !== 'all' && t.tipe !== tipeFilter) return false;
      if (q) {
        return [t.account_name, t.account_to_name, t.kategori, t.keterangan]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q));
      }
      return true;
    });
  }, [transactions, tipeFilter, search]);

  const txCounts = useMemo(
    () => ({
      all: transactions.length,
      pemasukan: transactions.filter((t) => t.tipe === 'pemasukan').length,
      pengeluaran: transactions.filter((t) => t.tipe === 'pengeluaran').length,
      transfer: transactions.filter((t) => t.tipe === 'transfer').length,
    }),
    [transactions]
  );

  const total = filteredTx.length;
  const paged = filteredTx.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setPage(1);
  }, [tipeFilter, search, tab]);

  const openTxForm = (tipe) => {
    setTxForm({ ...initTxForm(), tipe });
    setErrors({});
    setShowTxForm(true);
  };

  const validate = () => {
    const errs = {};
    if (!txForm.account_id) errs.account_id = 'Akun wajib dipilih';
    if (txForm.tipe === 'transfer' && !txForm.account_to_id)
      errs.account_to_id = 'Akun tujuan wajib dipilih';
    if (txForm.tipe === 'transfer' && txForm.account_id === txForm.account_to_id)
      errs.account_to_id = 'Akun tujuan harus berbeda';
    if (!txForm.jumlah || parseFloat(txForm.jumlah) <= 0) errs.jumlah = 'Jumlah harus lebih dari 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    setConfirmSave(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      await api.post('/finance/transactions', {
        tanggal: txForm.tanggal,
        tipe: txForm.tipe,
        account_id: parseInt(txForm.account_id, 10),
        account_to_id: txForm.account_to_id ? parseInt(txForm.account_to_id, 10) : null,
        kategori: txForm.kategori.trim() || null,
        jumlah: parseFloat(txForm.jumlah),
        keterangan: txForm.keterangan.trim() || null,
      });
      toast.success(`${TIPE_LABEL[txForm.tipe]} berhasil dicatat`);
      setConfirmSave(false);
      setShowTxForm(false);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Keuangan" subtitle="Buku Kas, pemasukan, pengeluaran" icon={Wallet}>
        <button
          onClick={() => openTxForm('pemasukan')}
          className="flex items-center gap-1.5 text-emerald-600 hover:bg-emerald-50 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-200"
        >
          <ArrowDownCircle className="w-4 h-4" /> Pemasukan
        </button>
        <button
          onClick={() => openTxForm('pengeluaran')}
          className="flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg text-sm font-medium border border-rose-200"
        >
          <ArrowUpCircle className="w-4 h-4" /> Pengeluaran
        </button>
        <button
          onClick={() => openTxForm('transfer')}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <ArrowLeftRight className="w-4 h-4" /> Transfer
        </button>
      </PageHeader>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
            label="Total Pemasukan"
            value={formatCurrency(summary.pemasukan || 0)}
            tone="emerald"
          />
          <SummaryCard
            icon={<TrendingDown className="w-5 h-5 text-rose-600" />}
            label="Total Pengeluaran"
            value={formatCurrency(summary.pengeluaran || 0)}
            tone="rose"
          />
          <SummaryCard
            icon={<Coins className="w-5 h-5 text-primary-600" />}
            label="Saldo Bersih (Periode)"
            value={formatCurrency(summary.saldo || 0)}
            tone={summary.saldo >= 0 ? 'primary' : 'rose'}
          />
          <SummaryCard
            icon={<ArrowLeftRight className="w-5 h-5 text-blue-600" />}
            label="Total Transaksi"
            value={summary.count || 0}
            tone="blue"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'transactions', label: 'Transaksi' },
          { id: 'accounts', label: 'Buku Kas & Bank' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2.5 text-sm font-medium ${
              tab === t.id ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kategori, akun, atau keterangan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>

          <FilterTabs
            tabs={[
              { id: 'all', label: 'Semua', count: txCounts.all },
              { id: 'pemasukan', label: 'Pemasukan', count: txCounts.pemasukan },
              { id: 'pengeluaran', label: 'Pengeluaran', count: txCounts.pengeluaran },
              { id: 'transfer', label: 'Transfer', count: txCounts.transfer },
            ]}
            activeId={tipeFilter}
            onChange={setTipeFilter}
          />

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="table-header px-4 py-3 text-left">Tanggal</th>
                    <th className="table-header px-4 py-3 text-center">Tipe</th>
                    <th className="table-header px-4 py-3 text-left">Akun</th>
                    <th className="table-header px-4 py-3 text-left">Kategori</th>
                    <th className="table-header px-4 py-3 text-left">Keterangan</th>
                    <th className="table-header px-4 py-3 text-right">Jumlah</th>
                    <th className="table-header px-4 py-3 text-left">User</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-600">{formatDate(t.tanggal)}</td>
                      <td className="px-4 py-3 text-center">
                        <TipeBadge tipe={t.tipe} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{t.account_name}</p>
                        {t.tipe === 'transfer' && t.account_to_name && (
                          <p className="text-xs text-gray-400">→ {t.account_to_name}</p>
                        )}
                        <p className="text-xs text-gray-400 font-mono">{t.account_kode}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.kategori || '-'}</td>
                      <td
                        className="px-4 py-3 text-gray-600 max-w-xs truncate"
                        title={t.keterangan || ''}
                      >
                        {t.keterangan || '-'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          t.tipe === 'pemasukan'
                            ? 'text-emerald-600'
                            : t.tipe === 'pengeluaran'
                              ? 'text-rose-600'
                              : 'text-blue-600'
                        }`}
                      >
                        {t.tipe === 'pemasukan' ? '+' : t.tipe === 'pengeluaran' ? '-' : ''}
                        {formatCurrency(t.jumlah)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t.user_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paged.length === 0 && (
              <EmptyState
                description="Belum ada transaksi keuangan."
                action={
                  <button
                    onClick={() => openTxForm('pemasukan')}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Catat Pemasukan
                  </button>
                }
              />
            )}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      )}

      {tab === 'accounts' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header px-4 py-3 text-left">Kode Akun</th>
                  <th className="table-header px-4 py-3 text-left">Tipe</th>
                  <th className="table-header px-4 py-3 text-left">Nama Akun</th>
                  <th className="table-header px-4 py-3 text-left">Kategori Akun</th>
                  <th className="table-header px-4 py-3 text-right">Saldo Awal</th>
                  <th className="table-header px-4 py-3 text-right">Saldo di VIPOS</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{a.kode}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${a.tipe === 'header' ? 'bg-gray-100 text-gray-600' : 'badge-info'}`}
                      >
                        {a.tipe === 'header' ? 'Header' : 'Detail'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{a.nama}</td>
                    <td className="px-4 py-3 text-gray-600">{a.kategori}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(a.saldo_awal || 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {a.tipe === 'header' ? '-' : formatCurrency(a.saldo || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {accounts.length === 0 && <EmptyState description="Belum ada akun kas/bank." />}
        </div>
      )}

      {showTxForm && (
        <CashTxFormPage
          form={txForm}
          setForm={setTxForm}
          accounts={accounts.filter((a) => a.tipe === 'detail')}
          errors={errors}
          onCancel={() => setShowTxForm(false)}
          onSave={handleSave}
        />
      )}

      <ConfirmationDialog
        open={confirmSave}
        title={`Simpan ${TIPE_LABEL[txForm.tipe]}`}
        message={`Transaksi ${TIPE_LABEL[txForm.tipe]} sebesar ${formatCurrency(parseFloat(txForm.jumlah) || 0)} akan dicatat. Lanjutkan?`}
        confirmLabel="Ya, Lanjutkan"
        loading={saving}
        onCancel={() => setConfirmSave(false)}
        onConfirm={handleConfirmSave}
      />
    </div>
  );
}

function SummaryCard({ icon, label, value, tone = 'gray' }) {
  const toneCls =
    {
      primary: 'border-primary-200 bg-primary-50/40',
      emerald: 'border-emerald-200 bg-emerald-50/40',
      rose: 'border-rose-200 bg-rose-50/40',
      blue: 'border-blue-200 bg-blue-50/40',
      gray: 'border-gray-200',
    }[tone] || 'border-gray-200';
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 bg-white ${toneCls}`}>
      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function TipeBadge({ tipe }) {
  const map = {
    pemasukan: { label: 'Pemasukan', cls: 'bg-emerald-100 text-emerald-700' },
    pengeluaran: { label: 'Pengeluaran', cls: 'bg-rose-100 text-rose-700' },
    transfer: { label: 'Transfer', cls: 'bg-blue-100 text-blue-700' },
  };
  const t = map[tipe] || { label: tipe, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`badge ${t.cls}`}>{t.label}</span>;
}

function initTxForm() {
  return {
    tipe: 'pemasukan',
    tanggal: new Date().toISOString().slice(0, 10),
    account_id: '',
    account_to_id: '',
    kategori: '',
    jumlah: '',
    keterangan: '',
  };
}

function CashTxFormPage({ form, setForm, accounts, errors, onCancel, onSave }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Catat {TIPE_LABEL[form.tipe]}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tipe Transaksi
              </label>
              <select
                value={form.tipe}
                onChange={(e) => set({ tipe: e.target.value })}
                className="input-field"
              >
                <option value="pemasukan">Pemasukan</option>
                <option value="pengeluaran">Pengeluaran</option>
                <option value="transfer">Transfer Antar Akun</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
                <input
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => set({ tanggal: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Jumlah<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.jumlah}
                    onChange={(e) => set({ jumlah: e.target.value })}
                    className="input-field pl-9"
                    placeholder="0"
                  />
                </div>
                {errors.jumlah && <p className="text-xs text-red-500 mt-1">{errors.jumlah}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {form.tipe === 'transfer' ? 'Akun Sumber' : 'Akun'}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                value={form.account_id}
                onChange={(e) => set({ account_id: e.target.value })}
                className="input-field"
              >
                <option value="">Pilih akun...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.kode} — {a.nama}
                  </option>
                ))}
              </select>
              {errors.account_id && (
                <p className="text-xs text-red-500 mt-1">{errors.account_id}</p>
              )}
            </div>

            {form.tipe === 'transfer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Akun Tujuan<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={form.account_to_id}
                  onChange={(e) => set({ account_to_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Pilih akun tujuan...</option>
                  {accounts
                    .filter((a) => String(a.id) !== String(form.account_id))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.kode} — {a.nama}
                      </option>
                    ))}
                </select>
                {errors.account_to_id && (
                  <p className="text-xs text-red-500 mt-1">{errors.account_to_id}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori</label>
              <input
                type="text"
                value={form.kategori}
                onChange={(e) => set({ kategori: e.target.value })}
                className="input-field"
                placeholder="Contoh: Penjualan, Operasional, Belanja Bahan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Keterangan</label>
              <textarea
                value={form.keterangan}
                onChange={(e) => set({ keterangan: e.target.value })}
                rows={2}
                className="input-field resize-none"
                placeholder="Detail transaksi"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 sm:px-6 py-3 bg-white flex items-center justify-between">
        <button
          onClick={onCancel}
          className="text-primary-600 hover:bg-primary-50 px-3 py-2 rounded-lg text-sm font-medium"
        >
          Batal
        </button>
        <button onClick={onSave} className="btn-primary text-sm">
          Simpan
        </button>
      </div>
    </div>
  );
}
