import { useEffect, useState } from 'react';
import { Lightbulb, Calendar, BookOpen, Newspaper, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

const ARTICLE_CATEGORIES = [
  { key: 'home', label: 'Semua' },
  { key: 'berbagi', label: 'Berbagi' },
  { key: 'tren-bisnis', label: 'Tren Bisnis' },
  { key: 'trivia', label: 'Trivia' },
  { key: 'kisah-sukses', label: 'Kisah Sukses' },
  { key: 'tips', label: 'Tips' },
  { key: 'inspirasi', label: 'Inspirasi' },
  { key: 'edukasi', label: 'Edukasi' },
];

export default function InspirasiPage() {
  const [tab, setTab] = useState('articles');
  const [category, setCategory] = useState('home');
  const [articles, setArticles] = useState([]);
  const [activeArticle, setActiveArticle] = useState(null);
  const [events, setEvents] = useState([]);
  const [magazines, setMagazines] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load() reads category + tab directly; effect intentionally re-runs only on those
  }, [category, tab]);

  async function load() {
    setLoading(true);
    try {
      if (tab === 'articles') {
        const params = category !== 'home' ? { category } : {};
        const res = await api.get('/inspirasi/articles', { params });
        setArticles(res.data);
      } else if (tab === 'events') {
        const res = await api.get('/inspirasi/events?upcoming=true');
        setEvents(res.data);
      } else if (tab === 'magazines') {
        const res = await api.get('/inspirasi/magazines');
        setMagazines(res.data);
      } else if (tab === 'updates') {
        const res = await api.get('/inspirasi/changelog');
        setUpdates(res.data);
      }
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  async function rsvp(eventId) {
    try {
      await api.post(`/inspirasi/events/${eventId}/rsvp`, { status: 'going' });
      toast.success('RSVP terkirim');
      void load();
    } catch {
      toast.error('Gagal RSVP');
    }
  }

  async function openArticle(slug) {
    try {
      const res = await api.get(`/inspirasi/articles/${slug}`);
      setActiveArticle(res.data);
    } catch {
      toast.error('Gagal memuat artikel');
    }
  }

  return (
    <div>
      <PageHeader
        title="INSPIRASI"
        subtitle="Konten edukasi dan inspirasi untuk pebisnis"
        icon={Lightbulb}
      />

      <div className="flex gap-2 mb-4 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'articles', label: 'majoo Blog', icon: BookOpen },
          { key: 'events', label: 'Event', icon: Calendar },
          { key: 'magazines', label: 'Majalah', icon: Newspaper },
          { key: 'updates', label: 'Informasi Update', icon: Users },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setActiveArticle(null);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${
              tab === t.key
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500 text-center py-10">Memuat...</p>}

      {tab === 'articles' && !activeArticle && (
        <div>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {ARTICLE_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap ${
                  category === c.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a) => (
              <button
                key={a.id}
                onClick={() => openArticle(a.slug)}
                className="text-left bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-primary-500" />
                </div>
                <div className="p-4">
                  <span className="text-xs text-primary-600 font-medium uppercase">
                    {a.category}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-1 line-clamp-2">{a.title}</h3>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{a.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
                    <span>{a.author}</span>
                    <span>{a.reading_minutes} menit</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'articles' && activeArticle && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <button onClick={() => setActiveArticle(null)} className="text-sm text-primary-600 mb-4">
            ← Kembali ke daftar artikel
          </button>
          <span className="text-xs text-primary-600 font-medium uppercase">
            {activeArticle.category}
          </span>
          <h2 className="text-2xl font-bold text-gray-900 mt-1 mb-2">{activeArticle.title}</h2>
          <div className="text-xs text-gray-500 mb-4">
            {activeArticle.author} · {activeArticle.reading_minutes} menit baca
          </div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
            {activeArticle.content}
          </div>
        </div>
      )}

      {tab === 'events' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((e) => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-primary-600" />
                <span className="text-xs text-gray-500">
                  {new Date(e.event_date).toLocaleString('id-ID', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{e.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{e.description}</p>
              <div className="text-xs text-gray-500 mt-2">📍 {e.location}</div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-400">
                  {e.rsvp_count}/{e.capacity || '∞'} RSVP
                </span>
                <button
                  onClick={() => rsvp(e.id)}
                  disabled={e.user_rsvp_status === 'going'}
                  className="px-3 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60"
                >
                  {e.user_rsvp_status === 'going' ? 'Anda sudah RSVP' : 'RSVP Sekarang'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'magazines' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {magazines.map((m) => (
            <a
              key={m.id}
              href={m.pdf_url}
              target="_blank"
              rel="noreferrer noopener"
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                <Newspaper className="w-10 h-10 text-primary-500" />
              </div>
              <div className="p-3">
                <p className="text-xs text-gray-500">
                  {String(m.month).padStart(2, '0')}/{m.year}
                </p>
                <p className="font-semibold text-sm text-gray-900 line-clamp-2">{m.title}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      {tab === 'updates' && (
        <div className="space-y-3">
          {updates.map((u) => (
            <div
              key={u.id}
              className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start"
            >
              <div className="bg-primary-50 text-primary-700 text-xs font-bold px-3 py-2 rounded-lg flex-shrink-0">
                v{u.version}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{u.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{u.body}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(u.published_at).toLocaleDateString('id-ID')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
