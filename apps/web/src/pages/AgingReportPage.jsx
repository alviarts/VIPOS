import { useEffect, useState } from 'react';
import { TrendingDown, Download } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { EmptyState, PageHeader } from '../components/ui';

function formatRp(n) {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export default function AgingReportPage() {
  const [data, setData] = useState({ rows: [], totals: null });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/aging-report');
      setData(r.data);
    } catch {
      toast.error('Gagal memuat aging report');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function exportCsv() {
    const header = ['Customer', '0-30 hari', '31-60 hari', '61-90 hari', '>90 hari', 'Total'];
    const lines = [header.join(',')];
    for (const r of data.rows) {
      lines.push(
        [
          `"${r.customer_name.replace(/"/g, '""')}"`,
          r.bucket_0_30,
          r.bucket_31_60,
          r.bucket_61_90,
          r.bucket_90_plus,
          r.total_outstanding,
        ].join(',')
      );
    }
    if (data.totals) {
      lines.push(
        [
          'Total',
          data.totals.bucket_0_30,
          data.totals.bucket_31_60,
          data.totals.bucket_61_90,
          data.totals.bucket_90_plus,
          data.totals.total_outstanding,
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aging-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Aging Report" subtitle="Outstanding piutang per umur" icon={TrendingDown}>
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </PageHeader>

      {data.totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500">0-30 hari</div>
            <div className="text-lg font-bold text-green-600">
              {formatRp(data.totals.bucket_0_30)}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500">31-60 hari</div>
            <div className="text-lg font-bold text-yellow-600">
              {formatRp(data.totals.bucket_31_60)}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500">61-90 hari</div>
            <div className="text-lg font-bold text-orange-600">
              {formatRp(data.totals.bucket_61_90)}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500">{'>'} 90 hari</div>
            <div className="text-lg font-bold text-red-600">
              {formatRp(data.totals.bucket_90_plus)}
            </div>
          </div>
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
            <div className="text-xs text-primary-700">Total Outstanding</div>
            <div className="text-lg font-bold text-primary-700">
              {formatRp(data.totals.total_outstanding)}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Memuat...</div>
        ) : data.rows.length === 0 ? (
          <EmptyState title="Tidak ada outstanding" subtitle="Semua invoice sudah lunas" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-right">0-30</th>
                <th className="px-3 py-2 text-right">31-60</th>
                <th className="px-3 py-2 text-right">61-90</th>
                <th className="px-3 py-2 text-right">{'>'} 90</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{r.customer_name}</td>
                  <td className="px-3 py-2 text-right">{formatRp(r.bucket_0_30)}</td>
                  <td className="px-3 py-2 text-right">{formatRp(r.bucket_31_60)}</td>
                  <td className="px-3 py-2 text-right">{formatRp(r.bucket_61_90)}</td>
                  <td className="px-3 py-2 text-right">{formatRp(r.bucket_90_plus)}</td>
                  <td className="px-3 py-2 text-right font-bold">
                    {formatRp(r.total_outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
