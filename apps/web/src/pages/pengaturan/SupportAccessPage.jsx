// Support Access — time-bounded access grant for support engineer.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, ShieldX, X } from 'lucide-react';
import api from '../../utils/api';
import { EmptyState, PageHeader } from '../../components/ui';
import { formatDate } from '../../utils/format';

const initForm = () => ({
  grantee_email: '',
  reason: '',
  expires_at: defaultExpiry(),
});

function defaultExpiry() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export default function SupportAccessPage() {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initForm());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await api.get('/support-access');
    setRows(r.data || []);
  }

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post('/support-access', {
        ...form,
        expires_at: new Date(form.expires_at).toISOString(),
      });
      toast.success('Akses diberikan');
      setShowForm(false);
      setForm(initForm());
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal');
    }
  }

  async function revoke(g) {
    if (!confirm(`Cabut akses ${g.grantee_email}?`)) return;
    try {
      await api.post(`/support-access/${g.id}/revoke`);
      toast.success('Akses dicabut');
      load();
    } catch (err) {
      toast.error('Gagal');
    }
  }

  function statusBadge(g) {
    if (g.revoked_at) {
      return (
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          Dicabut
        </span>
      );
    }
    const exp = new Date(g.expires_at).getTime();
    if (Date.now() > exp) {
      return (
        <span className="inline-flex rounded-full bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">
          Kadaluarsa
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
        Aktif
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Izin Akses Support"
        subtitle="Berikan akses sementara ke tim support untuk debug masalah."
      >
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Beri Akses
        </button>
      </PageHeader>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            title="Belum ada akses support"
            description="Berikan akses sementara untuk tim support."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Alasan</th>
                <th className="px-4 py-3 text-left">Diberi oleh</th>
                <th className="px-4 py-3 text-left">Berlaku Sampai</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{g.grantee_email}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{g.reason || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{g.granted_by_name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(g.expires_at)}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(g)}</td>
                  <td className="px-4 py-3 text-right">
                    {!g.revoked_at && (
                      <button
                        onClick={() => revoke(g)}
                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                      >
                        <ShieldX className="h-3.5 w-3.5" /> Cabut
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">Beri Akses Support</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3 px-5 py-4">
              <Field label="Email Support Engineer" required>
                <input
                  type="email"
                  required
                  value={form.grantee_email}
                  onChange={(e) => setForm({ ...form, grantee_email: e.target.value })}
                  placeholder="support@vipos.id"
                  className="input-field"
                />
              </Field>
              <Field label="Alasan">
                <textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Debug payroll calculation bug"
                  className="input-field"
                />
              </Field>
              <Field label="Berlaku Sampai" required>
                <input
                  type="datetime-local"
                  required
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Beri Akses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
