import { useEffect, useMemo, useState } from 'react';
import { HelpCircle, Search, MessageSquare, ChevronRight, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader, EmptyState } from '../../components/ui';

const PANDUAN_INTRO = [
  {
    title: 'Mulai berjualan dalam 3 langkah',
    steps: [
      'Tambahkan produk lewat menu Produk → tombol "Tambah Produk".',
      'Buka menu Kasir, scan/pilih produk, lalu tekan "Bayar" untuk menyelesaikan transaksi.',
      'Lihat hasil di Dashboard atau Laporan untuk memantau penjualan harian.',
    ],
  },
  {
    title: 'Kelola pegawai & hak akses',
    steps: [
      'Buka Karyawan → Daftar Karyawan untuk menambah pegawai baru.',
      'Atur role (admin / manager / kasir) sesuai tugas; role menentukan menu yang bisa diakses.',
      'Owner & admin bisa melihat semua menu. Kasir hanya melihat menu yang relevan untuk transaksi.',
    ],
  },
  {
    title: 'Backup, langganan & dukungan',
    steps: [
      'Profil & ubah password ada di Pengaturan → Akun & Profil.',
      'Butuh bantuan? Kirim "Masukan" lewat tab di halaman ini, tim akan membalas via email.',
      'Update fitur terbaru ditandai dengan badge di sidebar. Beberapa fitur masih dalam tahap pengembangan dan disembunyikan otomatis.',
    ],
  },
];

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug / Error' },
  { value: 'feature', label: 'Permintaan Fitur' },
  { value: 'general', label: 'Lainnya' },
];

export default function HelpPage() {
  const [tab, setTab] = useState('panduan');
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTopic, setActiveTopic] = useState(null);

  const [feedback, setFeedback] = useState({ type: 'bug', title: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);

  useEffect(() => {
    void loadTopics();
    void loadFeedback();
  }, []);

  async function loadTopics() {
    setTopicsLoading(true);
    try {
      const res = await api.get('/help/topics');
      setTopics(res.data);
    } catch {
      toast.error('Gagal memuat panduan');
    } finally {
      setTopicsLoading(false);
    }
  }

  async function loadFeedback() {
    try {
      const res = await api.get('/help/feedback');
      setFeedbackList(res.data);
    } catch {
      // Silent — feedback list is supplementary.
    }
  }

  const filtered = useMemo(() => {
    if (!search) return topics;
    const q = search.toLowerCase();
    return topics.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.excerpt || '').toLowerCase().includes(q)
    );
  }, [topics, search]);

  async function openTopic(slug) {
    try {
      const res = await api.get(`/help/topics/${slug}`);
      setActiveTopic(res.data);
    } catch {
      toast.error('Topik tidak ditemukan');
    }
  }

  async function submitFeedback(e) {
    e.preventDefault();
    if (feedback.title.trim().length < 3 || feedback.description.trim().length < 10) {
      toast.error('Judul minimal 3 karakter, deskripsi minimal 10 karakter');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/help/feedback', feedback);
      toast.success('Masukan terkirim');
      setFeedback({ type: 'bug', title: '', description: '' });
      void loadFeedback();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Gagal kirim masukan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Bantuan" subtitle="Panduan & Masukan" icon={HelpCircle} />

      <section className="rounded-xl border border-primary-100 bg-primary-50/40 p-4 text-sm text-gray-700">
        <h2 className="mb-2 text-sm font-semibold text-primary-800">Panduan Penggunaan Singkat</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {PANDUAN_INTRO.map((s) => (
            <div key={s.title} className="rounded-lg bg-white p-3 shadow-sm">
              <p className="mb-1 text-xs font-semibold text-primary-700">{s.title}</p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-600">
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[
          { key: 'panduan', label: 'Panduan Penggunaan' },
          { key: 'masukan', label: 'Masukan Perbaikan' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'panduan' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl p-3">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari topik..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            {topicsLoading && <p className="text-sm text-gray-500 text-center py-6">Memuat...</p>}
            {!topicsLoading && filtered.length === 0 && (
              <EmptyState icon={HelpCircle} title="Tidak ada topik" />
            )}
            <ul className="space-y-1">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => openTopic(t.slug)}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 ${
                      activeTopic?.slug === t.slug ? 'bg-primary-50 text-primary-700' : ''
                    }`}
                  >
                    <span>
                      <span className="font-medium block">{t.title}</span>
                      {t.category && <span className="text-xs text-gray-400">{t.category}</span>}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
            {activeTopic ? (
              <article>
                <div className="text-xs text-primary-600 font-medium uppercase mb-1">
                  {activeTopic.category}
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">{activeTopic.title}</h2>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                  {activeTopic.content}
                </div>
              </article>
            ) : (
              <EmptyState
                icon={HelpCircle}
                title="Pilih topik panduan"
                description="Klik salah satu topik di sebelah kiri untuk membaca panduan."
              />
            )}
          </div>
        </div>
      )}

      {tab === 'masukan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form
            onSubmit={submitFeedback}
            className="bg-white border border-gray-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-900">Kirim Masukan</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
              <select
                value={feedback.type}
                onChange={(e) => setFeedback((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
              >
                {FEEDBACK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Judul</label>
              <input
                value={feedback.title}
                onChange={(e) => setFeedback((f) => ({ ...f, title: e.target.value }))}
                placeholder="Singkat & spesifik"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <textarea
                value={feedback.description}
                onChange={(e) => setFeedback((f) => ({ ...f, description: e.target.value }))}
                rows={5}
                placeholder="Ceritakan dengan detail apa yang terjadi atau apa yang Anda harapkan."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> {submitting ? 'Mengirim...' : 'Kirim Masukan'}
            </button>
          </form>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              <MessageSquare className="inline w-5 h-5 mr-1 text-primary-600" />
              Masukan yang Sudah Anda Kirim
            </h3>
            {feedbackList.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada masukan dikirim.</p>
            ) : (
              <ul className="space-y-3">
                {feedbackList.map((f) => (
                  <li key={f.id} className="border-b last:border-0 pb-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full font-medium uppercase">
                        {f.type}
                      </span>
                      <span className="text-gray-400">{f.status}</span>
                    </div>
                    <p className="font-medium text-sm mt-1">{f.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{f.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
