import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck, Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { ConfirmationDialog, EmptyState, PageHeader } from '../components/ui';
import B2BDocumentBuilder from '../components/b2b/B2BDocumentBuilder';

const STATUS_COLOR = {
  PREPARING: 'bg-yellow-100 text-yellow-700',
  IN_TRANSIT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  RETURNED: 'bg-red-100 text-red-700',
};

export default function DeliveryOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefilledSO, setPrefilledSO] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const r = await api.get(`/delivery-order?${params.toString()}`);
      setList(r.data || []);
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load() reads filterStatus directly; effect intentionally re-runs only on [filterStatus]
  }, [filterStatus]);

  useEffect(() => {
    const fromSO = searchParams.get('from_so');
    if (fromSO) {
      api.get(`/sales-order/${fromSO}`).then((r) => {
        setPrefilledSO(r.data);
        setEditing(null);
        setShowForm(true);
      });
      const next = new URLSearchParams(searchParams);
      next.delete('from_so');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function remove() {
    try {
      await api.delete(`/delivery-order/${confirmDel.id}`);
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
        title="Surat Jalan (Delivery Order)"
        subtitle="Track pengiriman dari sales order"
        icon={Truck}
      >
        <button
          onClick={() => {
            setEditing(null);
            setPrefilledSO(null);
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Buat Pengiriman
        </button>
      </PageHeader>

      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap gap-3 items-center">
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
          <EmptyState title="Belum ada pengiriman" subtitle="Buat dari sales order" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Tanggal</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Carrier</th>
                <th className="px-3 py-2 text-left">Driver</th>
                <th className="px-3 py-2 text-center">Stok</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{d.number}</td>
                  <td className="px-3 py-2">{d.delivery_date}</td>
                  <td className="px-3 py-2">{d.customer_name}</td>
                  <td className="px-3 py-2">{d.carrier || '-'}</td>
                  <td className="px-3 py-2">{d.driver || '-'}</td>
                  <td className="px-3 py-2 text-center">
                    {d.stock_posted ? (
                      <span className="text-green-600 text-xs">posted</span>
                    ) : (
                      <span className="text-gray-400 text-xs">pending</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full ${STATUS_COLOR[d.status] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          api.get(`/delivery-order/${d.id}`).then((r) => {
                            setEditing(r.data);
                            setPrefilledSO(null);
                            setShowForm(true);
                          });
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => setConfirmDel(d)}
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
        kind="delivery-order"
        open={showForm}
        initial={editing}
        prefilledFromSO={prefilledSO}
        onClose={() => {
          setShowForm(false);
          setPrefilledSO(null);
        }}
        onSaved={load}
      />

      <ConfirmationDialog
        open={!!confirmDel}
        title="Hapus pengiriman?"
        message={`Yakin hapus ${confirmDel?.number}?`}
        variant="danger"
        onCancel={() => setConfirmDel(null)}
        onConfirm={remove}
      />
    </div>
  );
}
