// VIPOS — onboarding wizard (PR-3, pra-beta v0.0.1).
//
// Three-step flow shown to brand-new tenants right after signup:
//
//   Step 1 — Welcome + segment pick (3 preset cards or "Mulai dari kosong")
//   Step 2 — Confirm + apply (calls POST /tenant/onboarding/seed-template
//            when a preset is selected; otherwise just goes to step 3)
//   Step 3 — Done (calls POST /tenant/onboarding/complete + redirects to
//            /dashboard with toast)
//
// We gate the wizard purely on `tenant.metadata.onboarding_completed_at`.
// If a user navigates to /onboarding after they finished it, we redirect
// them to /dashboard immediately. Conversely, the dashboard shell can
// redirect new tenants to /onboarding when that flag is missing (PR-3
// hook in App.jsx).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Coffee,
  ShoppingBag,
  Sparkles,
  Sparkle,
  CircleArrowRight,
  CircleCheck,
  CircleSlash,
  Loader2,
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SEGMENT_ICON = {
  fnb: Coffee,
  retail: ShoppingBag,
  salon: Sparkles,
};

function formatRupiah(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selected, setSelected] = useState(null); // template id or null = skip
  const [submitting, setSubmitting] = useState(false);
  const [seedSummary, setSeedSummary] = useState(null);

  // Hydrate the templates list from the API. We deliberately keep this
  // page usable even if the call fails — the merchant can still skip and
  // hit the dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/tenant/onboarding/templates');
        if (!cancelled) {
          setTemplates(res.data?.templates || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Gagal memuat preset onboarding:', err);
        }
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selected) || null,
    [templates, selected]
  );

  function pickPreset(id) {
    setSelected(id);
    setStep(2);
  }

  function pickSkip() {
    setSelected(null);
    setStep(2);
  }

  async function applyAndComplete() {
    if (submitting) return;
    setSubmitting(true);
    try {
      let summary = null;
      if (selected) {
        const res = await api.post('/tenant/onboarding/seed-template', {
          template: selected,
        });
        summary = res.data;
        setSeedSummary(summary);
      }
      await api.post('/tenant/onboarding/complete', {});
      setStep(3);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Gagal menyiapkan akun. Coba lagi.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function finish() {
    toast.success('Selamat datang di VIPOS!');
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 via-white to-primary-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Stepper step={step} />

        {step === 1 && (
          <StepWelcome
            user={user}
            templates={templates}
            loading={loadingTemplates}
            onPick={pickPreset}
            onSkip={pickSkip}
          />
        )}
        {step === 2 && (
          <StepConfirm
            template={selectedTemplate}
            submitting={submitting}
            onBack={() => setStep(1)}
            onConfirm={applyAndComplete}
          />
        )}
        {step === 3 && (
          <StepDone summary={seedSummary} template={selectedTemplate} onFinish={finish} />
        )}
      </div>
    </div>
  );
}

function Stepper({ step }) {
  const steps = [
    { id: 1, label: 'Pilih preset' },
    { id: 2, label: 'Konfirmasi' },
    { id: 3, label: 'Selesai' },
  ];
  return (
    <ol
      data-testid="onboarding-stepper"
      className="flex items-center justify-center gap-2 mb-10 text-sm"
    >
      {steps.map((s, idx) => (
        <li key={s.id} className="flex items-center gap-2">
          <div
            data-testid={`onboarding-step-pill-${s.id}`}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
              step === s.id
                ? 'bg-primary-600 text-white font-medium'
                : step > s.id
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                step > s.id ? 'bg-primary-600 text-white' : 'bg-white/30'
              }`}
            >
              {step > s.id ? '✓' : s.id}
            </span>
            {s.label}
          </div>
          {idx < steps.length - 1 && (
            <span aria-hidden className="text-gray-300">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function StepWelcome({ user, templates, loading, onPick, onSkip }) {
  return (
    <section
      data-testid="onboarding-step-welcome"
      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
          <Sparkle className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Halo {user?.name?.split(' ')[0] || 'Bos'}, selamat datang di VIPOS
          </h1>
          <p className="text-sm text-gray-500">
            Pilih jenis usaha untuk memuat contoh kategori + produk siap pakai.
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Langkah ini opsional — Anda bisa lewati dan setup manual kapan saja.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Memuat pilihan preset…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((t) => {
            const Icon = SEGMENT_ICON[t.id] || Sparkles;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`onboarding-template-${t.id}`}
                onClick={() => onPick(t.id)}
                className="text-left rounded-xl border-2 border-gray-200 hover:border-primary-500 hover:shadow-md transition p-5 flex flex-col gap-3 bg-white"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{t.tagline}</p>
                </div>
                <ul className="text-xs text-gray-600 space-y-1 mt-1">
                  {(t.preview_products || []).map((p) => (
                    <li key={p.name} className="flex justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="text-gray-400">{formatRupiah(p.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-primary-600 font-medium mt-1 flex items-center gap-1">
                  Mulai dengan {t.product_count} produk <CircleArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-dashed border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-gray-500">
          Tidak ada yang cocok? Mulai dari nol — Anda tetap bisa input produk satu per satu.
        </p>
        <button
          type="button"
          data-testid="onboarding-skip"
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg"
        >
          <CircleSlash className="w-4 h-4" />
          Mulai dari kosong
        </button>
      </div>
    </section>
  );
}

function StepConfirm({ template, submitting, onBack, onConfirm }) {
  return (
    <section
      data-testid="onboarding-step-confirm"
      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10"
    >
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {template ? `Pakai preset ${template.name}?` : 'Mulai dengan akun kosong?'}
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        {template
          ? `Kami akan membuat ${template.category_count} kategori dan ${template.product_count} produk contoh. Semua bisa Anda edit / hapus kapan saja dari menu Produk.`
          : 'Akun Anda akan tetap kosong. Anda bisa menambah kategori + produk manual dari menu Produk kapan saja.'}
      </p>

      {template && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Contoh produk yang akan dibuat:
          </h3>
          <ul className="text-sm text-gray-700 space-y-1.5">
            {(template.preview_products || []).map((p) => (
              <li key={p.name} className="flex justify-between gap-3">
                <span>{p.name}</span>
                <span className="text-gray-500 text-xs font-mono">{formatRupiah(p.price)}</span>
              </li>
            ))}
            <li className="text-xs text-gray-400 pt-1">
              +{' '}
              {Math.max(
                0,
                (template.product_count || 0) - (template.preview_products?.length || 0)
              )}{' '}
              produk lainnya
            </li>
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <button
          type="button"
          data-testid="onboarding-back"
          onClick={onBack}
          disabled={submitting}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
        >
          Kembali
        </button>
        <button
          type="button"
          data-testid="onboarding-confirm"
          onClick={onConfirm}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan akun…
            </>
          ) : (
            <>
              {template ? 'Buat data contoh' : 'Lanjut ke dashboard'}
              <CircleArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </section>
  );
}

function StepDone({ summary, template, onFinish }) {
  return (
    <section
      data-testid="onboarding-step-done"
      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <CircleCheck className="w-8 h-8 text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup selesai</h1>

      {summary ? (
        <p className="text-sm text-gray-600 mb-6">
          Kami menambahkan {summary.categories?.added ?? 0} kategori dan{' '}
          {summary.products?.added ?? 0} produk contoh dari preset{' '}
          <strong>{template?.name || summary.template}</strong>. Anda bisa langsung mencoba
          transaksi pertama.
        </p>
      ) : (
        <p className="text-sm text-gray-600 mb-6">
          Akun Anda sudah aktif. Anda bisa langsung mulai menambah kategori dan produk dari menu
          Produk.
        </p>
      )}

      <button
        type="button"
        data-testid="onboarding-finish"
        onClick={onFinish}
        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700"
      >
        Buka dashboard
        <CircleArrowRight className="w-4 h-4" />
      </button>
    </section>
  );
}
