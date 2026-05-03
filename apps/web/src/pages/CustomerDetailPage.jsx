import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Wallet, Coins, ShoppingCart, FileText } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../utils/format';

const TABS = [
  { key: 'info', label: 'Info Pelanggan' },
  { key: 'history', label: 'Riwayat Transaksi' },
  { key: 'deposit', label: 'Saldo Deposit' },
  { key: 'points', label: 'Poin' },
  { key: 'notes', label: 'Catatan' },
];

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('info');
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [c, t] = await Promise.all([
          api.get(`/customers/${id}`),
          api.get(`/customers/${id}/transactions`),
        ]);
        if (!cancelled) {
          setCustomer(c.data);
          setTransactions(t.data);
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Gagal memuat pelanggan');
        navigate('/customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Memuat...</div>;
  }
  if (!customer) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/customers"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{customer.name}</h2>
            <p className="text-sm text-gray-500 font-mono">{customer.kode}</p>
          </div>
        </div>
        <Link
          to={`/customers?edit=${customer.id}`}
          className="btn-primary text-sm flex items-center gap-1.5"
          onClick={(e) => {
            e.preventDefault();
            navigate('/customers', { state: { editId: customer.id } });
          }}
        >
          <Edit2 className="w-4 h-4" /> Ubah
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-primary-500" />
          <div>
            <p className="text-xs text-gray-500">Total Belanja</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(customer.total_spent || 0)}
            </p>
            <p className="text-xs text-gray-400">{customer.transaction_count || 0} transaksi</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <Coins className="w-8 h-8 text-amber-500" />
          <div>
            <p className="text-xs text-gray-500">Poin Loyalty</p>
            <p className="text-lg font-semibold text-gray-900">{customer.points || 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <Wallet className="w-8 h-8 text-emerald-500" />
          <div>
            <p className="text-xs text-gray-500">Saldo Deposit</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(customer.deposit || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-3 py-2 text-sm border-b-2 ${
                tab === t.key
                  ? 'border-primary-500 text-primary-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'info' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Telepon" value={customer.phone} />
            <Field label="Email" value={customer.email} />
            <Field
              label="Jenis Kelamin"
              value={customer.gender === 'L' ? 'Pria' : customer.gender === 'P' ? 'Wanita' : null}
            />
            <Field label="Tanggal Lahir" value={customer.birth_date} />
            <Field label="Alamat" value={customer.address} cols={2} />
            <Field label="Kelurahan / Kecamatan" value={customer.district} />
            <Field label="Kota" value={customer.city} />
            <Field label="Provinsi" value={customer.province} />
            <Field label="NPWP" value={customer.npwp} />
            <Field label="No. KTP" value={customer.id_card_no} />
            <Field
              label="Grup"
              value={
                customer.customer_group_name ? (
                  <span
                    className="badge text-white text-[10px] uppercase"
                    style={{ backgroundColor: customer.customer_group_color || '#0EA5E9' }}
                  >
                    {customer.customer_group_name}
                  </span>
                ) : null
              }
            />
            <Field
              label="Tag"
              value={
                customer.tags?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.map((t) => (
                      <span
                        key={t.id}
                        className="badge text-[10px]"
                        style={{
                          backgroundColor: (t.color || '#94A3B8') + '22',
                          color: t.color || '#475569',
                        }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                ) : null
              }
            />
          </dl>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">Belum ada transaksi.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header px-4 py-2 text-left">Tanggal</th>
                  <th className="table-header px-4 py-2 text-left">No. Invoice</th>
                  <th className="table-header px-4 py-2 text-left">Kasir</th>
                  <th className="table-header px-4 py-2 text-left">Metode</th>
                  <th className="table-header px-4 py-2 text-right">Total</th>
                  <th className="table-header px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2 text-gray-700">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{t.invoice_number}</td>
                    <td className="px-4 py-2 text-gray-600">{t.cashier_name || '-'}</td>
                    <td className="px-4 py-2 text-gray-600 uppercase">{t.payment_method}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {formatCurrency(t.total_amount)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`badge text-[10px] uppercase ${
                          t.status === 'voided'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'deposit' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <p className="text-sm text-gray-500">
            Saldo deposit saat ini: <strong>{formatCurrency(customer.deposit || 0)}</strong>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Riwayat top-up / penggunaan akan tersedia setelah modul Loyalty &amp; Deposit (P1-08).
          </p>
        </div>
      )}

      {tab === 'points' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <p className="text-sm text-gray-500">
            Poin saat ini: <strong>{customer.points || 0}</strong>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Riwayat earned / redeemed akan tersedia setelah modul Loyalty (P1-08).
          </p>
        </div>
      )}

      {tab === 'notes' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-start gap-2 text-sm text-gray-700 whitespace-pre-wrap">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
            {customer.notes || <span className="text-gray-400">Tidak ada catatan.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, cols = 1 }) {
  return (
    <div className={cols === 2 ? 'sm:col-span-2' : ''}>
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-gray-800">{value ?? <span className="text-gray-300">-</span>}</dd>
    </div>
  );
}
