import { useEffect, useState } from 'react';
import { ChefHat, Download, TrendingUp, Clock, Package, AlertTriangle } from 'lucide-react';
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

export default function KitchenReportPage() {
  const [activeTab, setActiveTab] = useState('orders');
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });
  const [ordersData, setOrdersData] = useState([]);
  const [itemsData, setItemsData] = useState([]);
  const [performanceData, setPerformanceData] = useState(null);
  const [wasteData, setWasteData] = useState({ data: [], summary: null });
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams(dateRange);

      if (activeTab === 'orders') {
        const r = await api.get(`/reports/kitchen/orders?${params}`);
        setOrdersData(r.data.data || []);
      } else if (activeTab === 'items') {
        const r = await api.get(`/reports/kitchen/items?${params}`);
        setItemsData(r.data.data || []);
      } else if (activeTab === 'performance') {
        const r = await api.get(`/reports/kitchen/performance?${params}`);
        setPerformanceData(r.data.data || null);
      } else if (activeTab === 'waste') {
        const r = await api.get(`/reports/kitchen/waste?${params}`);
        setWasteData({ data: r.data.data || [], summary: r.data.summary || null });
      }
    } catch (err) {
      toast.error('Gagal memuat laporan dapur');
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

    if (activeTab === 'orders') {
      header = ['Tanggal', 'Total Order', 'Total Item', 'Total Kuantitas', 'Rata-rata Waktu Persiapan (menit)'];
      lines = [header.join(',')];
      ordersData.forEach((row) => {
        lines.push(
          [
            row.order_date,
            row.total_orders,
            row.total_items,
            row.total_quantity,
            row.avg_prep_time_minutes?.toFixed(2) || '-',
          ].join(',')
        );
      });
    } else if (activeTab === 'items') {
      header = ['Kategori', 'Produk', 'Total Kuantitas', 'Jumlah Order', 'Harga Rata-rata'];
      lines = [header.join(',')];
      itemsData.forEach((row) => {
        lines.push(
          [
            `"${row.category_name}"`,
            `"${row.product_name}"`,
            row.total_quantity,
            row.order_count,
            row.avg_price,
          ].join(',')
        );
      });
    } else if (activeTab === 'waste') {
      header = ['No Invoice', 'Tanggal Void', 'Void Oleh', 'Total', 'Catatan'];
      lines = [header.join(',')];
      wasteData.data.forEach((row) => {
        lines.push(
          [
            row.invoice_number,
            new Date(row.voided_at).toLocaleString('id-ID'),
            `"${row.voided_by}"`,
            row.total_amount,
            `"${row.notes || '-'}"`,
          ].join(',')
        );
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kitchen-report-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Laporan Dapur" subtitle="Laporan operasional dapur dan F&B" icon={ChefHat}>
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
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Order Harian
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'items'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Item per Kategori
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'performance'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Performa
          </button>
          <button
            onClick={() => setActiveTab('waste')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'waste'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Waste/Void
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          Memuat...
        </div>
      ) : (
        <>
          {activeTab === 'orders' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {ordersData.length === 0 ? (
                <EmptyState title="Tidak ada data" subtitle="Belum ada order di periode ini" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-right">Total Order</th>
                      <th className="px-3 py-2 text-right">Total Item</th>
                      <th className="px-3 py-2 text-right">Total Kuantitas</th>
                      <th className="px-3 py-2 text-right">Rata-rata Waktu Persiapan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{row.order_date}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.total_orders)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.total_items)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.total_quantity)}</td>
                        <td className="px-3 py-2 text-right">
                          {row.avg_prep_time_minutes ? `${row.avg_prep_time_minutes.toFixed(1)} menit` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'items' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {itemsData.length === 0 ? (
                <EmptyState title="Tidak ada data" subtitle="Belum ada item di periode ini" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Kategori</th>
                      <th className="px-3 py-2 text-left">Produk</th>
                      <th className="px-3 py-2 text-right">Total Kuantitas</th>
                      <th className="px-3 py-2 text-right">Jumlah Order</th>
                      <th className="px-3 py-2 text-right">Harga Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsData.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">{row.category_name}</td>
                        <td className="px-3 py-2 font-medium">{row.product_name}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.total_quantity)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.order_count)}</td>
                        <td className="px-3 py-2 text-right">{formatRp(row.avg_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'performance' && performanceData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs">Jam Puncak</span>
                  </div>
                  <div className="space-y-1">
                    {performanceData.peak_hours?.slice(0, 3).map((peak, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-bold">{peak.hour}:00</span> - {formatNumber(peak.total_orders)} order
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-right">Jam</th>
                      <th className="px-3 py-2 text-right">Order</th>
                      <th className="px-3 py-2 text-right">Item</th>
                      <th className="px-3 py-2 text-right">Rata-rata Waktu Persiapan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.hourly_performance?.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">{row.date}</td>
                        <td className="px-3 py-2 text-right">{row.hour}:00</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.orders)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.items)}</td>
                        <td className="px-3 py-2 text-right">
                          {row.avg_prep_time ? `${row.avg_prep_time.toFixed(1)} menit` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'waste' && (
            <div className="space-y-4">
              {wasteData.summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs">Total Void</span>
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(wasteData.summary.total_voided)}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Package className="w-4 h-4" />
                      <span className="text-xs">Total Item</span>
                    </div>
                    <div className="text-2xl font-bold">{formatNumber(wasteData.summary.total_items)}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs">Total Nilai</span>
                    </div>
                    <div className="text-2xl font-bold">{formatRp(wasteData.summary.total_amount)}</div>
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {wasteData.data.length === 0 ? (
                  <EmptyState title="Tidak ada data" subtitle="Tidak ada transaksi void di periode ini" />
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">No Invoice</th>
                        <th className="px-3 py-2 text-left">Tanggal Void</th>
                        <th className="px-3 py-2 text-left">Void Oleh</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-left">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wasteData.data.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium">{row.invoice_number}</td>
                          <td className="px-3 py-2">{new Date(row.voided_at).toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2">{row.voided_by}</td>
                          <td className="px-3 py-2 text-right">{formatRp(row.total_amount)}</td>
                          <td className="px-3 py-2 text-gray-500">{row.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
