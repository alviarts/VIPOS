// Subscription — view current plan, upgrade tier, claim voucher, support ticket link.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

const PLANS = [
  {
    code: 'lite',
    name: 'Lite',
    price: 'Rp 0',
    desc: 'Free forever — fitur dasar untuk usaha mikro.',
    features: ['Kasir + Produk + Pelanggan', '1 outlet, 2 user', 'Laporan dasar'],
  },
  {
    code: 'advance',
    name: 'Advance+',
    price: 'Rp 199.000/bulan',
    desc: 'Untuk UMKM tumbuh — multi-outlet + akuntansi sederhana.',
    features: [
      'Multi-outlet (sampai 3)',
      'Buku Kas + Penerimaan/Pengeluaran',
      'Inventory + Variant Produk',
      'Loyalty + Promo Dasar',
    ],
  },
  {
    code: 'prime',
    name: 'Prime',
    price: 'Rp 499.000/bulan',
    desc: 'Akuntansi lengkap + multi-outlet unlimited.',
    features: [
      'Multi-outlet unlimited',
      'Akuntansi penuh (Jurnal/Neraca/L-R/Buku Besar)',
      'Aset Tetap + Penyusutan',
      'Approval Workflow + Payroll',
      'Hardware bridge (printer/EDC/scale)',
    ],
  },
];

export default function SubscriptionPage() {
  const [current, setCurrent] = useState('lite');
  const [voucher, setVoucher] = useState('');

  useEffect(() => {
    api
      .get('/setting?category=subscription')
      .then((r) => {
        const tier = (r.data || []).find((s) => s.key === 'tier');
        if (tier?.value) setCurrent(tier.value);
      })
      .catch(() => {});
  }, []);

  async function selectPlan(code) {
    try {
      await api.put('/setting', {
        category: 'subscription',
        key: 'tier',
        value: code,
      });
      setCurrent(code);
      toast.success(`Pilihan plan ${code.toUpperCase()} disimpan. Tim sales akan menghubungi.`);
    } catch (err) {
      toast.error('Gagal simpan');
    }
  }

  async function claimVoucher(e) {
    e.preventDefault();
    if (!voucher.trim()) return;
    try {
      await api.put('/setting', {
        category: 'subscription',
        key: `voucher_${Date.now()}`,
        value: { code: voucher, claimed_at: new Date().toISOString() },
      });
      toast.success(`Voucher ${voucher} terdaftar — menunggu validasi.`);
      setVoucher('');
    } catch (err) {
      toast.error('Gagal klaim');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Langganan"
        subtitle="Lihat plan aktif, upgrade tier, klaim voucher, dan akses tiket support."
      />

      <div className="rounded-xl border border-primary-100 bg-primary-50 p-5">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary-600" />
          <div>
            <p className="text-xs text-primary-700">Plan Aktif</p>
            <p className="text-2xl font-bold text-primary-900">{current.toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.code}
            className={`rounded-xl border-2 bg-white p-5 shadow-sm ${
              current === p.code ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200'
            }`}
          >
            <p className="text-xs uppercase text-gray-500">{p.name}</p>
            <p className="mb-1 text-xl font-bold">{p.price}</p>
            <p className="mb-3 text-xs text-gray-600">{p.desc}</p>
            <ul className="mb-4 space-y-1 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => selectPlan(p.code)}
              disabled={current === p.code}
              className={`w-full rounded-lg px-3 py-2 text-sm font-semibold ${
                current === p.code
                  ? 'cursor-default bg-gray-100 text-gray-400'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {current === p.code ? 'Plan Aktif' : 'Pilih Plan'}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Klaim Voucher</h2>
        <form onSubmit={claimVoucher} className="flex gap-2">
          <input
            value={voucher}
            onChange={(e) => setVoucher(e.target.value.toUpperCase())}
            placeholder="Masukkan kode voucher"
            className="input-field flex-1"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Klaim
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">Butuh Bantuan?</h2>
        <p className="mb-3 text-xs text-gray-500">
          Tim support VIPOS siap membantu via WhatsApp atau email.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://wa.me/6281234567890"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"
          >
            WhatsApp Support
          </a>
          <a
            href="mailto:support@vipos.id"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Email Support
          </a>
        </div>
      </div>
    </div>
  );
}
