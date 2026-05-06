import { useState, useEffect } from 'react';
import { Eye, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/format';
import toast from 'react-hot-toast';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [page, dateFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (dateFilter) params.date = dateFilter;
      const res = await api.get('/transactions', { params });
      setTransactions(res.data.data);
      setPagination(res.data.pagination);
    } catch (_err) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const viewDetail = async (id) => {
    try {
      const res = await api.get(`/transactions/${id}`);
      setDetail(res.data);
    } catch (_err) {
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
        <p className="text-sm text-gray-400">{pagination.total || 0} total transaksi</p>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          className="input-field sm:w-48"
        />
        {dateFilter && (
          <button onClick={() => setDateFilter('')} className="btn-secondary text-sm">
            Reset Filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 bg-gray-50">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Kasir</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Metode</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent mx-auto" />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-gray-400">
                    Belum ada transaksi
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{tx.invoice_number}</td>
                    <td className="px-4 py-3">{tx.cashier_name}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(tx.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-gray-100 text-gray-600 uppercase">
                        {tx.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {tx.status === 'completed' ? 'Selesai' : 'Batal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDateTime(tx.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => viewDetail(tx.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title="Detail"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {tx.status === 'completed' && (
                          <button
                            onClick={() => voidTransaction(tx.id)}
                            className="p-2 hover:bg-red-50 rounded-lg"
                            title="Batalkan"
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-400">
              Hal. {pagination.page} dari {pagination.total_pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary p-2 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="btn-secondary p-2 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Detail Transaksi</h2>
                <button
                  onClick={() => setDetail(null)}
                  className="p-2 hover:bg-gray-100 rounded-xl"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice</span>
                  <span className="font-mono">{detail.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Kasir</span>
                  <span>{detail.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Waktu</span>
                  <span>{formatDateTime(detail.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span
                    className={`badge ${detail.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {detail.status === 'completed' ? 'Selesai' : 'Batal'}
                  </span>
                </div>

                <hr />

                <p className="font-medium text-gray-900">Item Produk</p>
                {detail.items?.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-600">
                      {item.product_name} x{item.quantity}
                    </span>
                    <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}

                <hr />

                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(detail.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bayar ({detail.payment_method})</span>
                  <span>{formatCurrency(detail.payment_amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Kembalian</span>
                  <span>{formatCurrency(detail.change_amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
