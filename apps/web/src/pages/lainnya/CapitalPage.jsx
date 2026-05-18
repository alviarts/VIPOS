import { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

const TENURE_OPTIONS = [3, 6, 12, 18, 24];

const STATUS_BADGE = {
  submitted: { label: 'Diajukan', color: 'bg-blue-100 text-blue-700', icon: Clock },
  review: { label: 'Review', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: {
    label: 'Disetujui',
    color: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle,
  },
  disbursed: {
    label: 'Dicairkan',
    color: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Ditolak',
    color: 'bg-rose-100 text-rose-700',
    icon: XCircle,
  },
};

function formatRupiah(n) {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CapitalPage() {
  const [preq, setPreq] = useState(null);
  const [applications, setApplications] = useState([]);
  const [form, setForm] = useState({
    amount: '',
    tenure_months: 6,
    purpose: '',
    collateral: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const [preqRes, appsRes] = await Promise.all([
        api.get('/capital/pre-qualification'),
        api.get('/capital/applications'),
      ]);
      setPreq(preqRes.data);
      setApplications(appsRes.data);
    } catch {
      toast.error('Gagal memuat data Capital');
    }
  }

  async function submitApplication(e) {
    e.preventDefault();
    if (!form.amount || !form.purpose || form.purpose.length < 3) {
      toast.error('Jumlah dan tujuan pinjaman wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/capital/applications', {
        amount: Number(form.amount),
        tenure_months: Number(form.tenure_months),
        purpose: form.purpose,
        collateral: form.collateral || undefined,
      });
      toast.success('Aplikasi pinjaman terkirim');
      setForm({ amount: '', tenure_months: 6, purpose: '', collateral: '' });
      setShowForm(false);
      void load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengajukan');
    } finally {
      setSubmitting(false);
    }
  }

  const monthlyEstimate =
    form.amount && form.tenure_months
      ? Math.round((Number(form.amount) * 1.18) / Number(form.tenure_months))
      : 0; // Placeholder: 18% APR over tenure (mock).

  return (
    <div>
      <PageHeader
        title="Capital"
        subtitle="Pinjaman modal usaha cepat tanpa ribet"
        icon={CreditCard}
      />

      {!preq && <p className="text-gray-500 text-center py-10">Memuat...</p>}

      {preq && (
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm opacity-80">Skor Pre-Qualification</p>
              <p className="text-4xl font-bold mt-1">{preq.score}/100</p>
              <p className="text-sm opacity-80 mt-2">
                Aktif {preq.months_active} bulan · Rata-rata{' '}
                {formatRupiah(preq.avg_monthly_revenue)}/bulan
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Pre-Approved Limit</p>
              <p className="text-3xl font-bold mt-1">{formatRupiah(preq.pre_approved_limit)}</p>
              {preq.is_eligible ? (
                <span className="inline-flex items-center gap-1 text-xs bg-white/20 px-3 py-1 rounded-full mt-2">
                  <CheckCircle className="w-3 h-3" /> Eligible
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs bg-white/20 px-3 py-1 rounded-full mt-2">
                  <AlertTriangle className="w-3 h-3" /> Belum Eligible
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {preq.factors.map((f) => (
              <div key={f.key} className="bg-white/10 rounded-lg p-3 flex items-start gap-2">
                {f.passed ? (
                  <CheckCircle className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-300 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-medium">{f.label}</p>
                  {f.message && <p className="text-xs opacity-80">{f.message}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {preq?.is_eligible && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-4 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 mb-6"
        >
          + Ajukan Pinjaman Baru
        </button>
      )}

      {showForm && (
        <form
          onSubmit={submitApplication}
          className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pengajuan Pinjaman</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Batal
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jumlah Pinjaman
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="10000000"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Maks: {formatRupiah(preq?.pre_approved_limit)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenor (bulan)</label>
              <select
                value={form.tenure_months}
                onChange={(e) => setForm((f) => ({ ...f, tenure_months: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                {TENURE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} bulan
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tujuan</label>
            <input
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              placeholder="e.g. Tambah modal stok bahan baku"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jaminan (opsional)
            </label>
            <input
              value={form.collateral}
              onChange={(e) => setForm((f) => ({ ...f, collateral: e.target.value }))}
              placeholder="e.g. BPKB Mobil 2018"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {monthlyEstimate > 0 && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm">
              <TrendingUp className="inline w-4 h-4 text-primary-600 mr-1" />
              Estimasi cicilan/bulan: <strong>{formatRupiah(monthlyEstimate)}</strong>
              <span className="text-xs text-gray-500 ml-2">
                (estimasi dengan bunga 18% efektif/tahun)
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? 'Mengajukan...' : 'Ajukan Pinjaman'}
          </button>
        </form>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mb-3">Riwayat Pengajuan</h3>
      {applications.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-6 text-center">
          Belum ada pengajuan pinjaman.
        </p>
      ) : (
        <div className="space-y-3">
          {applications.map((a) => {
            const Badge = STATUS_BADGE[a.status];
            return (
              <div
                key={a.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{formatRupiah(a.amount)}</span>
                    <span className="text-xs text-gray-500">/ {a.tenure_months} bulan</span>
                    {Badge && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${Badge.color}`}
                      >
                        <Badge.icon className="w-3 h-3" /> {Badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{a.purpose}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Diajukan {new Date(a.submitted_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
