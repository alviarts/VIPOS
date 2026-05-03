import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { formatDate, formatNumber } from '../../utils/format';

const TIPE_LABEL = {
  stok_in: { label: 'Stok Masuk', cls: 'bg-emerald-100 text-emerald-700', sign: '+' },
  stok_out: { label: 'Stok Keluar', cls: 'bg-rose-100 text-rose-700', sign: '-' },
  opname: { label: 'Opname', cls: 'bg-blue-100 text-blue-700', sign: '' },
};

const REASON_LABEL = {
  damaged: 'Rusak',
  expired: 'Kedaluwarsa',
  shrinkage: 'Selisih',
  production: 'Produksi',
  manual: 'Manual',
  other: 'Lainnya',
};

export default function ProductMovementHistoryDialog({ product, onClose }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get(`/inventory/movements/${product.id}?limit=200`);
        if (!cancelled) setMovements(res.data);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Gagal memuat riwayat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Riwayat Stok</h3>
            <p className="text-xs text-gray-500">
              {product.name}
              {product.sku ? <span className="font-mono ml-1">({product.sku})</span> : null}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 p-6 text-center">Memuat...</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">
              Belum ada pergerakan stok untuk produk ini.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="table-header px-4 py-2 text-left">Tanggal</th>
                  <th className="table-header px-4 py-2 text-left">Tipe</th>
                  <th className="table-header px-4 py-2 text-right">Qty</th>
                  <th className="table-header px-4 py-2 text-right">Sebelum</th>
                  <th className="table-header px-4 py-2 text-right">Sesudah</th>
                  <th className="table-header px-4 py-2 text-left">Alasan / Ket.</th>
                  <th className="table-header px-4 py-2 text-left">User</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const t = TIPE_LABEL[m.tipe] || { label: m.tipe, cls: '', sign: '' };
                  return (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2 text-gray-600">{formatDate(m.tanggal)}</td>
                      <td className="px-4 py-2">
                        <span className={`badge text-[10px] ${t.cls}`}>{t.label}</span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {t.sign}
                        {formatNumber(m.qty)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {formatNumber(m.stok_sebelum)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {formatNumber(m.stok_sesudah)}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {m.reason && (
                          <span className="text-xs uppercase mr-1 text-gray-500">
                            {REASON_LABEL[m.reason] || m.reason}:
                          </span>
                        )}
                        {m.keterangan || (m.reason ? '' : '-')}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{m.user_name || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-end">
          <button
            onClick={onClose}
            className="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
