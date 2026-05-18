import { useEffect, useState } from 'react';
import { RotateCcw, Download, TrendingDown, DollarSign, Package, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { EmptyState, PageHeader } from '../../components/ui';

function formatRp(n) {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function formatNumber(n) {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('id-ID').format(Number(n));
}

export default function RefundReportPage() {
  const [activeTab, setActiveTab] = useState('list');
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [refundsData, setRefundsData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [byReasonData, setByReasonData] = useState([]);
  const [byProductData, setByProductData] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams(dateRange);

      if (activeTab === 'list') {
        const r = await api.get(`/reports/refunds?${params}`);
        setRefundsData(r.data.data || []);
      } else if (activeTab === 'summary') {
        const r = await api.get(`/reports/refunds/summary?${params}`);
        setSummaryData(r.data.data || null);
      } else if (activeTab === 'by-reason') {
        const r = await api.get(`/reports/refunds/by-reason?${params}`);
        setByReasonData(r.data.data || []);
      } else if (activeTab === 'by-product') {
        const r = await api.get(`/reports/refunds/by-product?${params}`);
        setByProductData(r.data.data || []);
      }
    } catch (err) {
      toast.error('Gagal memuat laporan refund');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab, dateRange]);

  function exportCsv() {
    let header = [];
    let lines = [];

    if (activeTab === 'list') {
      header = ['No Invoice', 'Tanggal', 'Total', 'Jumlah Refund', 'Alasan', 'Refund Oleh', 'Customer'];
      lines = [header.join(',')];
      refundsData.forEach((row) => {
        lines.push(
          [
            row.invoice_number,
            new Date(row.transaction_date).toLocaleString('id-ID'),
            row.total_amount,
            row.refund_amount,
            `"${row.refund_reason}"`,
            `"${row.refunded_by}"`,
            `"${row.customer_name}"`,
          ].join(',')
        );
      });
    } else if (activeTab === 'by-reason') {
      header = ['Alasan', 'Jumlah', 'Total Nilai', 'Rata-rata'];
      lines = [header.join(',')];
      byReasonData.forEach((row) => {
        lines.push([`"${row.reason}"`, row.count, row.total_amount, row.avg_amount].join(','));
      });
    } else if (activeTab === 'by-product') {
      header = ['Produk', 'SKU', 'Jumlah Refund', 'Total Kuantitas', 'Total Nilai'];
      lines = [header.join(',')];
      byProductData.forEach((row) => {
        lines.push(
          [
            `"${row.product_name}"`,
            row.sku,
            row.refund_count,
            row.total_quantity_refunded,
            row.total_amount_refunded,
          ].join(',')
        );
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refund-report-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Laporan Refund" subtitle="Laporan transaksi refund dan void" icon={RotateCcw}>
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </PageHeader>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'list'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Daftar Refund
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Ringkasan
          </button>
          <button
            onClick={() => setActiveTab('by-reason')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'by-reason'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Per Alasan
          </button>
          <button
            onClick={() => setActiveTab('by-product')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'by-product'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Per Produk
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          Memuat...
        </div>
      ) : (
        <>
          {activeTab === 'list' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {refundsData.length === 0 ? (
                <EmptyState title="Tidak ada refund" subtitle="Tidak ada transaksi refund di periode ini" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">No Invoice</th>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Jumlah Refund</th>
                      <th className="px-3 py-2 text-left">Alasan</th>
                      <th className="px-3 py-2 text-left">Refund Oleh</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundsData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{row.invoice_number}</td>
                        <td className="px-3 py-2">{new Date(row.transaction_date).toLocaleString('id-ID')}</td>
                        <td className="px-3 py-2 text-right">{formatRp(row.total_amount)}</td>
                        <td className="px-3 py-2 text-right text-red-600 font-medium">
                          {formatRp(row.refund_amount)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.refund_reason}</td>
                        <td className="px-3 py-2">{row.refunded_by}</td>
                        <td className="px-3 py-2">{row.customer_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'summary' && summaryData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs">Total Refund</span>
                  </div>
                  <div className="text-2xl font-bold">{formatNumber(summaryData.summary?.total_refunds || 0)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs">Total Nilai</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {formatRp(summaryData.summary?.total_refund_amount || 0)}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-xs">Rata-rata</span>
                  </div>
                  <div className="text-2xl font-bold">{formatRp(summaryData.summary?.avg_refund_amount || 0)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <span className="text-xs">Minimum</span>
                  </div>
                  <div className="text-lg font-bold">{formatRp(summaryData.summary?.min_refund_amount || 0)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <span className="text-xs">Maximum</span>
                  </div>
                  <div className="text-lg font-bold">{formatRp(summaryData.summary?.max_refund_amount || 0)}</div>
                </div>
              </div>

              {summaryData.trend && summaryData.trend.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="font-medium">Trend Refund</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Periode</th>
                        <th className="px-3 py-2 text-right">Jumlah Refund</th>
                        <th className="px-3 py-2 text-right">Total Nilai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.trend.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{row.period}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(row.refund_count)}</td>
                          <td className="px-3 py-2 text-right text-red-600">
                            {formatRp(row.total_refund_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'by-reason' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {byReasonData.length === 0 ? (
                <EmptyState title="Tidak ada data" subtitle="Tidak ada refund di periode ini" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Alasan</th>
                      <th className="px-3 py-2 text-right">Jumlah</th>
                      <th className="px-3 py-2 text-right">Total Nilai</th>
                      <th className="px-3 py-2 text-right">Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byReasonData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{row.reason}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.count)}</td>
                        <td className="px-3 py-2 text-right text-red-600">{formatRp(row.total_amount)}</td>
                        <td className="px-3 py-2 text-right">{formatRp(row.avg_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'by-product' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {byProductData.length === 0 ? (
                <EmptyState title="Tidak ada data" subtitle="Tidak ada produk yang di-refund di periode ini" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Produk</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-right">Jumlah Refund</th>
                      <th className="px-3 py-2 text-right">Total Kuantitas</th>
                      <th className="px-3 py-2 text-right">Total Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProductData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{row.product_name}</td>
                        <td className="px-3 py-2 text-gray-500">{row.sku}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.refund_count)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.total_quantity_refunded)}</td>
                        <td className="px-3 py-2 text-right text-red-600">
                          {formatRp(row.total_amount_refunded)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
