import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

// Daftar permission keys yang bisa di-override (di luar role default).
const PERMISSION_KEYS = [
  { key: 'kasir.refund', label: 'Refund Transaksi' },
  { key: 'kasir.discount', label: 'Diskon Manual' },
  { key: 'kasir.void', label: 'Void Transaksi' },
  { key: 'kasir.open_drawer', label: 'Buka Cash Drawer' },
  { key: 'inventory.write', label: 'Edit Inventaris' },
  { key: 'inventory.adjust', label: 'Stock Adjustment' },
  { key: 'finance.view', label: 'Lihat Laporan Keuangan' },
  { key: 'finance.write', label: 'Input Transaksi Keuangan' },
  { key: 'reports.export', label: 'Export Laporan' },
  { key: 'employee.write', label: 'Edit Karyawan' },
  { key: 'payroll.run', label: 'Jalankan Payroll' },
  { key: 'approval.approve', label: 'Approve Dokumen' },
];

const ROLE_DEFAULTS = {
  admin: 'all',
  manager: [
    'kasir.refund',
    'kasir.discount',
    'kasir.void',
    'kasir.open_drawer',
    'inventory.write',
    'inventory.adjust',
    'finance.view',
    'reports.export',
    'employee.write',
    'approval.approve',
  ],
  cashier: ['kasir.discount', 'kasir.open_drawer'],
  staff: [],
  waiters: [],
};

function defaultGranted(role, key) {
  const def = ROLE_DEFAULTS[role];
  if (def === 'all') return true;
  return Array.isArray(def) && def.includes(key);
}

export default function PermissionsPage() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [overrides, setOverrides] = useState({}); // permission_key -> 0|1
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      const { data } = await api.get('/employee?status=active');
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal memuat karyawan');
    }
  }

  async function selectEmployee(emp) {
    setSelected(emp);
    try {
      const { data } = await api.get(`/employee/${emp.id}/permissions`);
      const map = {};
      for (const p of data) map[p.permission_key] = p.granted;
      setOverrides(map);
    } catch {
      toast.error('Gagal memuat hak akses');
    }
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/employee/${selected.id}/permissions`, {
        permissions: PERMISSION_KEYS.map((p) => ({
          permission_key: p.key,
          granted: getEffective(p.key) ? 1 : 0,
        })),
      });
      toast.success('Hak akses tersimpan');
    } catch {
      toast.error('Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  function getEffective(key) {
    if (key in overrides) return !!overrides[key];
    return defaultGranted(selected?.role, key);
  }
  function toggleEffective(key, val) {
    setOverrides((o) => ({ ...o, [key]: val ? 1 : 0 }));
  }
  function resetKey(key) {
    setOverrides((o) => {
      const next = { ...o };
      delete next[key];
      return next;
    });
  }

  const filtered = useMemo(
    () => employees.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase())),
    [employees, search]
  );

  return (
    <div>
      <PageHeader
        title="Hak Akses"
        subtitle="Atur permission per karyawan, dengan override di atas role default"
        icon={ClipboardCheck}
      />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 bg-white rounded-xl border border-gray-200">
          <div className="p-3 border-b border-gray-200">
            <input
              placeholder="Cari karyawan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-gray-500">Tidak ada karyawan.</div>
            )}
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => selectEmployee(e)}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 text-sm ${
                  selected?.id === e.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-gray-500">
                  {e.position || '-'} · {e.role}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-8 bg-white rounded-xl border border-gray-200">
          {!selected ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Pilih karyawan untuk mengatur hak akses.
            </div>
          ) : (
            <div>
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <div className="font-semibold">{selected.name}</div>
                  <div className="text-xs text-gray-500">
                    Role default: <span className="font-mono">{selected.role}</span>
                  </div>
                </div>
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
              <div>
                {PERMISSION_KEYS.map((p) => {
                  const def = defaultGranted(selected.role, p.key);
                  const overridden = p.key in overrides;
                  const eff = getEffective(p.key);
                  return (
                    <div
                      key={p.key}
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-100 text-sm"
                    >
                      <div>
                        <div className="font-medium">{p.label}</div>
                        <div className="text-xs text-gray-500">
                          <span className="font-mono">{p.key}</span> · default:{' '}
                          <span className={def ? 'text-green-700' : 'text-gray-400'}>
                            {def ? 'granted' : 'denied'}
                          </span>
                          {overridden && <span className="text-orange-600 ml-2">(override)</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={eff}
                            onChange={(e) => toggleEffective(p.key, e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="ml-2 text-xs">{eff ? 'Granted' : 'Denied'}</span>
                        </label>
                        {overridden && (
                          <button
                            onClick={() => resetKey(p.key)}
                            className="text-xs text-gray-500 hover:text-primary-600"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
