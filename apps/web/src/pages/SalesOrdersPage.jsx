import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  Search,
  Truck,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { ConfirmationDialog, EmptyState, PageHeader } from '../components/ui';
import B2BDocumentBuilder from '../components/b2b/B2BDocumentBuilder';

const STATUS_COLOR = {
  NEW: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  FULFILLED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

function formatRp(n) {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export default function SalesOrdersPage() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (search) params.set('q', search);
      const r = await api.get(`/sales-order?${params.toString()}`);
      setList(r.data || []);
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [filterStatus]);

  async function remove() {
    try {
      await api.delete(`/sales-order/${confirmDel.id}`);
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
        title="Sales Order"
        subtitle="Order pasti dari customer setelah quote disetujui"
        icon={ClipboardList}
      >
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Buat Sales Order
        </button>
      </PageHeader>

      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Cari nomor / nama..."
            className="input pl-8"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input"
        >
          <option value="">Semua status</option>
          {Object.keys(STATUS_COLOR).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button onClick={load} className="btn-secondary text-sm">
          Refresh
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Memuat...</div>
        ) : list.length === 0 ? (
          <EmptyState
            title="Belum ada sales order"
            subtitle="Buat dari quote atau langsung di sini"
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Tanggal</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Estimasi Kirim</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{s.number}</td>
                  <td className="px-3 py-2">{s.order_date}</td>
                  <td className="px-3 py-2">{s.customer_name}</td>
                  <td className="px-3 py-2 text-gray-500">{s.expected_delivery || '-'}</td>
                  <td className="px-3 py-2 text-right">{formatRp(s.total)}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full ${STATUS_COLOR[s.status] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => navigate(`/delivery-orders?from_so=${s.id}`)}
                        className="p-1 hover:bg-blue-50 rounded"
                        title="Buat DO"
                      >
                        <Truck className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => navigate(`/invoices?from_so=${s.id}`)}
                        className="p-1 hover:bg-green-50 rounded"
                        title="Buat Invoice"
                      >
                        <ReceiptIcon className="w-4 h-4 text-green-600" />
                      </button>
                      <button
                        onClick={() => {
                          api.get(`/sales-order/${s.id}`).then((r) => {
                            setEditing(r.data);
                            setShowForm(true);
                          });
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => setConfirmDel(s)}
                        className="p-1 hover:bg-red-50 rounded"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <B2BDocumentBuilder
        kind="sales-order"
        open={showForm}
        initial={editing}
        onClose={() => setShowForm(false)}
        onSaved={load}
      />

      <ConfirmationDialog
        open={!!confirmDel}
        title="Hapus sales order?"
        message={`Yakin hapus ${confirmDel?.number}?`}
        variant="danger"
        onCancel={() => setConfirmDel(null)}
        onConfirm={remove}
      />
    </div>
  );
}
