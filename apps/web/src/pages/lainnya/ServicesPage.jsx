import { useEffect, useState } from 'react';
import { Briefcase, CheckCircle, Clock, AlertCircle, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

const STATUS_BADGE = {
  submitted: { label: 'Diajukan', color: 'bg-blue-100 text-blue-700', icon: Clock },
  review: { label: 'Review', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: {
    label: 'Disetujui',
    color: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Ditolak',
    color: 'bg-rose-100 text-rose-700',
    icon: AlertCircle,
  },
};

export default function ServicesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/services/catalog');
      setItems(res.data);
    } catch {
      toast.error('Gagal memuat layanan');
    } finally {
      setLoading(false);
    }
  }

  async function apply(service) {
    if (service.application?.status === 'submitted' || service.application?.status === 'review') {
      toast('Aplikasi sudah ada, sedang dalam review.');
      return;
    }
    setSubmitting(service.key);
    try {
      await api.post('/services/applications', { service_key: service.key });
      toast.success(`Aplikasi ${service.name} terkirim`);
      void load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal mengajukan layanan');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="LAYANAN"
        subtitle="Layanan tambahan untuk mengembangkan bisnis Anda"
        icon={Briefcase}
      />
      {loading && <p className="text-center text-gray-500 py-10">Memuat...</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((s) => {
          const status = s.application?.status;
          const Badge = status ? STATUS_BADGE[status] : null;
          const isPrime = s.tier === 'prime';
          const isPro = s.tier === 'pro';
          return (
            <div
              key={s.key}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">{s.name}</h3>
                    {isPrime && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                        <Crown className="w-3 h-3" /> Prime+
                      </span>
                    )}
                    {isPro && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        Advance+
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{s.description}</p>
                </div>
                {Badge && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${Badge.color}`}
                  >
                    <Badge.icon className="w-3 h-3" /> {Badge.label}
                  </span>
                )}
              </div>
              <ul className="text-xs text-gray-500 space-y-1 my-3">
                {s.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {b}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 mb-3">ETA: {s.eta_days}</p>
              <button
                onClick={() => apply(s)}
                disabled={
                  submitting === s.key ||
                  status === 'submitted' ||
                  status === 'review' ||
                  status === 'approved'
                }
                className="w-full px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60"
              >
                {status === 'approved'
                  ? 'Sudah Aktif'
                  : status === 'submitted' || status === 'review'
                    ? 'Sedang Diproses'
                    : submitting === s.key
                      ? 'Mengajukan...'
                      : 'Ajukan Sekarang'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
