import { useState, useEffect, useMemo } from 'react';
import {
  Search, Eye, XCircle, ChevronLeft, ChevronRight, Calendar,
  X, Receipt, CreditCard, Banknote, QrCode, Printer,
} from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/format';
import toast from 'react-hot-toast';

const PAYMENT_LABEL = {
  cash: 'Tunai',
  card: 'Kartu',
  qris: 'QRIS',
  ewallet: 'E-Wallet',
  transfer: 'Transfer',
};

const PAYMENT_ICON = {
  cash: Banknote,
  card: CreditCard,
  qris: QrCode,
};

const QUICK_DATES = [
  { value: 'today',     label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
];

function toDateInput(date) {
  const d = new Date(date);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [page, dateFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (dateFilter) params.date = dateFilter;
      const res = await api.get('/transactions', { params });
      setTransactions(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const viewDetail = async (id) => {
    try {
      const res = await api.get(`/transactions/${id}`);
      setDetail(res.data);
    } catch (err) {
      toast.error('Gagal memuat detail');
    }
  };

  const voidTransaction = async (id) => {
    if (!confirm('Batalkan transaksi ini? Stok akan dikembalikan.')) return;
    try {
      await api.post(`/transactions/${id}/void`);
      toast.success('Transaksi dibatalkan');
      loadData();
      setDetail(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal membatalkan');
    }
  };

  const applyQuickDate = (key) => {
    const d = new Date();
    if (key === 'yesterday') d.setDate(d.getDate() - 1);
    setDateFilter(toDateInput(d));
    setPage(1);
  };

  // Client-side filter for search + status (server only filters by date)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchStatus = statusFilter === 'all' || tx.status === statusFilter;
      const matchSearch =
        !q ||
        tx.invoice_number?.toLowerCase().includes(q) ||
        tx.cashier_name?.toLowerCase().includes(q) ||
        tx.payment_method?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [transactions, search, statusFilter]);

  const summary = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'completed');
    const total = completed.reduce((s, t) => s + (t.total_amount || 0), 0);
    return {
      total,
      count: completed.length,
      voided: transactions.filter((t) => t.status !== 'completed').length,
    };
  }, [transactions]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
          <p className="text-sm text-gray-400">{pagination.total || 0} total transaksi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="input-field pl-9 py-2 text-sm w-auto"
            />
          </div>
          {QUICK_DATES.map((q) => (
            <button
              key={q.value}
              onClick={() => applyQuickDate(q.value)}
              className="chip whitespace-nowrap"
            >
              {q.label}
            </button>
          ))}
          {dateFilter && (
            <button
              onClick={() => { setDateFilter(''); setPage(1); }}
              className="btn-ghost text-xs flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="text-xs text-gray-500">Pendapatan</p>
          <p className="text-base sm:text-lg font-bold text-gray-900 mt-1 truncate">
            {formatCurrency(summary.total)}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500">Transaksi Selesai</p>
          <p className="text-base sm:text-lg font-bold text-emerald-600 mt-1">{summary.count}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500">Transaksi Batal</p>
          <p className="text-base sm:text-lg font-bold text-rose-600 mt-1">{summary.voided}</p>
        </div>
      </div>

      {/* Search + status chips */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari invoice, kasir, atau metode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {[
            { value: 'all',       label: 'Semua' },
            { value: 'completed', label: 'Selesai' },
            { value: 'voided',    label: 'Batal' },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`chip ${statusFilter === s.value ? 'chip-active' : ''} whitespace-nowrap`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table (desktop) */}
      <div className="card overflow-hidden p-0 hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 table-header">Invoice</th>
                <th className="px-4 py-3 table-header">Kasir</th>
                <th className="px-4 py-3 table-header text-right">Total</th>
                <th className="px-4 py-3 table-header">Metode</th>
                <th className="px-4 py-3 table-header">Status</th>
                <th className="px-4 py-3 table-header text-right">Waktu</th>
                <th className="px-4 py-3 table-header text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="skeleton h-3 w-28" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-3 w-20" /></td>
                    <td className="px-4 py-3 text-right"><div className="skeleton h-3 w-20 ml-auto" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-3 w-16" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3 text-right"><div className="skeleton h-3 w-24 ml-auto" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-7 w-16 ml-auto rounded-lg" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-14">
                    <div className="empty-state">
                      <div className="empty-state-icon"><Receipt className="w-7 h-7" /></div>
                      <p className="text-sm font-medium text-gray-700">Tidak ada transaksi</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Coba ubah filter tanggal atau kata kunci pencarian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const PIcon = PAYMENT_ICON[tx.payment_method] || CreditCard;
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{tx.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-700">{tx.cashier_name}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 text-right">
                        {formatCurrency(tx.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <PIcon className="w-3.5 h-3.5 text-gray-400" />
                          {PAYMENT_LABEL[tx.payment_method] || tx.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${tx.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                          {tx.status === 'completed' ? 'Selesai' : 'Batal'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap text-right">
                        {formatDateTime(tx.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => viewDetail(tx.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                            title="Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {tx.status === 'completed' && (
                            <button
                              onClick={() => voidTransaction(tx.id)}
                              className="p-2 hover:bg-rose-50 rounded-lg text-rose-500"
                              title="Batalkan"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination.total_pages > 1 && (
          <Pagination
            page={page}
            totalPages={pagination.total_pages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
          />
        )}
      </div>

      {/* Card list (mobile) */}
      <div className="md:hidden space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-2">
              <div className="flex justify-between">
                <div className="space-y-2 flex-1">
                  <div className="skeleton h-3 w-28" />
                  <div className="skeleton h-3 w-24" />
                  <div className="skeleton h-3 w-36" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="skeleton h-4 w-20 ml-auto" />
                  <div className="skeleton h-5 w-14 rounded-full ml-auto" />
                </div>
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><Receipt className="w-7 h-7" /></div>
              <p className="text-sm font-medium text-gray-700">Tidak ada transaksi</p>
              <p className="text-xs text-gray-400 mt-1">
                Ubah filter tanggal atau pencarian untuk melihat data lain.
              </p>
            </div>
          </div>
        ) : (
          filtered.map((tx) => {
            const PIcon = PAYMENT_ICON[tx.payment_method] || CreditCard;
            return (
              <button
                key={tx.id}
                onClick={() => viewDetail(tx.id)}
                className="card w-full text-left hover:border-primary-200 active:scale-[0.99] transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gray-500">{tx.invoice_number}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{tx.cashier_name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <PIcon className="w-3.5 h-3.5" />
                        {PAYMENT_LABEL[tx.payment_method] || tx.payment_method}
                      </span>
                      <span>·</span>
                      <span>{formatDateTime(tx.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(tx.total_amount)}</p>
                    <span className={`badge mt-1 ${tx.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                      {tx.status === 'completed' ? 'Selesai' : 'Batal'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}

        {pagination.total_pages > 1 && (
          <div className="card p-0">
            <Pagination
              page={page}
              totalPages={pagination.total_pages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[95vh] overflow-y-auto animate-slide-up">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Detail Transaksi</h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{detail.invoice_number}</p>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-xl p-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400">Kasir</p>
                  <p className="font-medium text-gray-800 truncate">{detail.cashier_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <span className={`badge ${detail.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                    {detail.status === 'completed' ? 'Selesai' : 'Batal'}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Waktu</p>
                  <p className="font-medium text-gray-800">{formatDateTime(detail.created_at)}</p>
                </div>
              </div>

              <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">
                Item Produk
              </p>
              <div className="space-y-1.5 text-sm">
                {detail.items?.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-700 truncate pr-2">
                      {item.product_name} <span className="text-gray-400">x{item.quantity}</span>
                    </span>
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="my-4 border-t border-dashed border-gray-200" />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between font-bold text-base text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(detail.total_amount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Bayar ({PAYMENT_LABEL[detail.payment_method] || detail.payment_method})</span>
                  <span>{formatCurrency(detail.payment_amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Kembalian</span>
                  <span>{formatCurrency(detail.change_amount)}</span>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm"
                >
                  <Printer className="w-4 h-4" />
                  Cetak
                </button>
                {detail.status === 'completed' && (
                  <button
                    onClick={() => voidTransaction(detail.id)}
                    className="btn-danger flex-1 text-sm"
                  >
                    Batalkan Transaksi
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Halaman <span className="font-semibold text-gray-700">{page}</span> dari{' '}
        <span className="font-semibold text-gray-700">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="btn-secondary p-2 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="btn-secondary p-2 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
