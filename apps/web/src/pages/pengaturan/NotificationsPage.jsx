// Notifications — per-event channel preferences for current user.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

const EVENT_CATALOG = [
  { key: 'low_stock', label: 'Stok Rendah', desc: 'Notifikasi saat stok produk di bawah minimum.' },
  {
    key: 'sale_completed',
    label: 'Penjualan Selesai',
    desc: 'Setiap struk dicetak / transaksi sukses.',
  },
  { key: 'cash_drawer_short', label: 'Selisih Kas', desc: 'Saat tutup kas terdeteksi selisih.' },
  { key: 'invoice_overdue', label: 'Invoice Jatuh Tempo', desc: 'Invoice/AR melewati due_date.' },
  { key: 'payroll_run', label: 'Payroll Dijalankan', desc: 'Setelah hitung & approve payroll.' },
  {
    key: 'approval_required',
    label: 'Approval Dibutuhkan',
    desc: 'Saat ada PO/cash-out menunggu approval.',
  },
  { key: 'employee_late', label: 'Karyawan Terlambat', desc: 'Late check-in di luar jadwal.' },
  {
    key: 'recurring_bill_due',
    label: 'Tagihan Rutin Jatuh Tempo',
    desc: 'Recurring bill due hari ini.',
  },
];

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const r = await api.get('/notification-pref');
    const map = {};
    for (const p of r.data || []) {
      map[p.event_key] = p;
    }
    setPrefs(map);
  }

  async function toggle(eventKey, channel) {
    const current = prefs[eventKey] || {
      via_push: 1,
      via_email: 1,
      via_wa: 0,
      via_sms: 0,
    };
    const next = {
      ...current,
      [channel]: current[channel] ? 0 : 1,
    };
    setPrefs({ ...prefs, [eventKey]: next });
    setSaving({ ...saving, [eventKey]: true });
    try {
      await api.put('/notification-pref', {
        event_key: eventKey,
        via_push: !!next.via_push,
        via_wa: !!next.via_wa,
        via_sms: !!next.via_sms,
        via_email: !!next.via_email,
      });
    } catch (_err) {
      toast.error('Gagal simpan');
      load();
    } finally {
      setSaving({ ...saving, [eventKey]: false });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifikasi"
        subtitle="Atur channel notifikasi (Push, Email, WhatsApp, SMS) per kategori event."
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-3 py-3 text-center">Push</th>
              <th className="px-3 py-3 text-center">Email</th>
              <th className="px-3 py-3 text-center">WhatsApp</th>
              <th className="px-3 py-3 text-center">SMS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {EVENT_CATALOG.map((ev) => {
              const p = prefs[ev.key] || { via_push: 1, via_email: 1, via_wa: 0, via_sms: 0 };
              return (
                <tr key={ev.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{ev.label}</p>
                    <p className="text-xs text-gray-500">{ev.desc}</p>
                  </td>
                  {['via_push', 'via_email', 'via_wa', 'via_sms'].map((ch) => (
                    <td key={ch} className="px-3 py-3 text-center">
                      <Toggle on={!!p[ch]} onClick={() => toggle(ev.key, ch)} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
        on ? 'bg-primary-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
          on ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
