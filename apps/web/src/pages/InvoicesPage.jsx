import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt as ReceiptIcon, Plus, Edit2, Trash2, Wallet } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { ConfirmationDialog, EmptyState, PageHeader } from '../components/ui';
import B2BDocumentBuilder from '../components/b2b/B2BDocumentBuilder';

const STATUS_COLOR = {
  ISSUED: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  VOID: 'bg-gray-100 text-gray-500',
};

function formatRp(n) {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function PaymentDialog({ open, invoice, onClose, onSaved }) {
  const [form, setForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    method: 'transfer',
    amount: '',
    ref_number: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open && invoice) {
      setForm({
        payment_date: new Date().toISOString().slice(0, 10),
        method: 'transfer',
        amount: String(invoice.outstanding || ''),
        ref_number: '',
        notes: '',
      });
    }
  }, [open, invoice]);
  if (!open || !invoice) return null;
  async function save() {
    setSaving(true);
    try {
      await api.post('/receipt', {
        invoice_id: invoice.id,
        payment_date: form.payment_date,
        method: form.method,
        amount: Number(form.amount),
        ref_number: form.ref_number || null,
        notes: form.notes || null,
      });
      toast.success('Pembayaran tercatat');
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="font-bold text-lg mb-1">Catat Pembayaran</h3>
        <p className="text-sm text-gray-500 mb-4">
          {invoice.number} · outstanding {formatRp(invoice.outstanding)}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tanggal</label>
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Metode</label>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="input w-full"
            >
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Jumlah</label>
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">No. Ref / Bank</label>
            <input
              type="text"
              value={form.ref_number}
              onChange={(e) => setForm({ ...form, ref_number: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Catatan</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">
            Batal
          </button>
          <button onClick={save} disabled={saving || !Number(form.amount)} className="btn-primary">
            {saving ? 'Menyimpan...' : 'Catat'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefilledSO, setPrefilledSO] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [paymentInv, setPaymentInv] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const r = await api.get(`/invoice?${params.toString()}`);
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
      await api.delete(`/invoice/${confirmDel.id}`);
      toast.success('Terhapus / di-void');
      setConfirmDel(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus');
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Invoice B2B" subtitle="Tagihan + tracking outstanding" icon={ReceiptIcon}>
        <button
          onClick={() => {
            setEditing(null);
            setPrefilledSO(null);
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Buat Invoice
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
          <EmptyState title="Belum ada invoice" subtitle="Buat dari sales order" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">No.</th>
                <th className="px-3 py-2 text-left">Tgl</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Jatuh Tempo</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => (
                <tr key={inv.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{inv.number}</td>
                  <td className="px-3 py-2">{inv.invoice_date}</td>
                  <td className="px-3 py-2">{inv.customer_name}</td>
                  <td className="px-3 py-2 text-gray-500">{inv.due_date || '-'}</td>
                  <td className="px-3 py-2 text-right">{formatRp(inv.total)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatRp(inv.outstanding)}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full ${STATUS_COLOR[inv.status] || 'bg-gray-100 text-gray-700'}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                        <button
                          onClick={() => setPaymentInv(inv)}
                          className="p-1 hover:bg-green-50 rounded"
                          title="Catat pembayaran"
                        >
                          <Wallet className="w-4 h-4 text-green-600" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          api.get(`/invoice/${inv.id}`).then((r) => {
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
                        onClick={() => setConfirmDel(inv)}
                        className="p-1 hover:bg-red-50 rounded"
                        title="Void"
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
        kind="invoice"
        open={showForm}
        initial={editing}
        prefilledFromSO={prefilledSO}
        onClose={() => {
          setShowForm(false);
          setPrefilledSO(null);
        }}
        onSaved={load}
      />

      <PaymentDialog
        open={!!paymentInv}
        invoice={paymentInv}
        onClose={() => setPaymentInv(null)}
        onSaved={load}
      />

      <ConfirmationDialog
        open={!!confirmDel}
        title="Void / hapus invoice?"
        message={`Yakin pada ${confirmDel?.number}? Jika sudah ada receipt, invoice akan di-set VOID.`}
        variant="danger"
        onCancel={() => setConfirmDel(null)}
        onConfirm={remove}
      />
    </div>
  );
}
