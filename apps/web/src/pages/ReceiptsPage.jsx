import { useEffect, useState } from 'react';
import { Wallet, Trash2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { ConfirmationDialog, EmptyState, PageHeader } from '../components/ui';

function formatRp(n) {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

const METHOD_LABEL = { cash: 'Cash', transfer: 'Transfer', cheque: 'Cheque' };

export default function ReceiptsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/receipt');
      setList(r.data || []);
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function remove() {
    try {
      await api.delete(`/receipt/${confirmDel.id}`);
      toast.success('Terhapus');
      setConfirmDel(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bukti Pembayaran (Receipts)"
        subtitle="Riwayat pembayaran yang masuk"
        icon={Wallet}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Memuat...</div>
        ) : list.length === 0 ? (
          <EmptyState title="Belum ada receipt" subtitle="Receipts dibuat dari halaman Invoice" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Tgl Bayar</th>
                <th className="px-3 py-2 text-left">Invoice</th>
                <th className="px-3 py-2 text-left">Metode</th>
                <th className="px-3 py-2 text-right">Jumlah</th>
                <th className="px-3 py-2 text-left">Ref</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.number}</td>
                  <td className="px-3 py-2">{r.payment_date}</td>
                  <td className="px-3 py-2 font-mono text-xs">INV #{r.invoice_id}</td>
                  <td className="px-3 py-2">{METHOD_LABEL[r.method] || r.method}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatRp(r.amount)}</td>
                  <td className="px-3 py-2 text-gray-500">{r.ref_number || '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setConfirmDel(r)}
                      className="p-1 hover:bg-red-50 rounded"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmationDialog
        open={!!confirmDel}
        title="Hapus receipt?"
        message="Outstanding invoice akan dihitung ulang."
        variant="danger"
        onCancel={() => setConfirmDel(null)}
        onConfirm={remove}
      />
    </div>
  );
}
