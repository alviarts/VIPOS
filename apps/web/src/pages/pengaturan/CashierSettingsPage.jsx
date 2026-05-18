// Cashier Settings — list cashier user + kategori kas (income/expense).
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Users, Tag } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';

export default function CashierSettingsPage() {
  const [cashiers, setCashiers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState('cashier');

  useEffect(() => {
    Promise.all([api.get('/auth/users'), api.get('/finance/accounts')])
      .then(([u, a]) => {
        // Tenant-level cashier list. Include 'kasir' plus admin-tier roles
        // (owner/admin) so the seeded admin + tenant owner can also operate
        // the till when needed.
        setCashiers((u.data || []).filter((x) => ['kasir', 'admin', 'owner'].includes(x.role)));
        setAccounts((a.data || []).filter((x) => ['ASET', 'PENDAPATAN', 'BEBAN'].includes(x.type)));
      })
      .catch(() => toast.error('Gagal load'));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Kasir"
        subtitle="Kelola daftar kasir dan kategori kas (income/expense)."
      />

      <div className="flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === 'cashier'} onClick={() => setTab('cashier')}>
          <Users className="mr-1.5 h-3.5 w-3.5 inline" />
          Daftar Kasir
        </TabBtn>
        <TabBtn active={tab === 'cash'} onClick={() => setTab('cash')}>
          <Tag className="mr-1.5 h-3.5 w-3.5 inline" />
          Kategori Kas
        </TabBtn>
      </div>

      {tab === 'cashier' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold">Daftar Pengguna Kasir</h3>
            <Link to="/users" className="text-xs font-semibold text-primary-600 hover:underline">
              + Kelola di halaman Pengguna
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-center">Aktif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cashiers.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{u.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {u.is_active === 0 ? 'Nonaktif' : 'Aktif'}
                  </td>
                </tr>
              ))}
              {cashiers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">
                    Belum ada kasir. Tambahkan dari menu Pengguna.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cash' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold">Kategori Kas (CoA)</h3>
            <Link
              to="/finance/accounts"
              className="text-xs font-semibold text-primary-600 hover:underline"
            >
              + Kelola di Daftar Akun
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Subtype</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.slice(0, 30).map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                  <td className="px-4 py-3">{a.name}</td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        a.type === 'PENDAPATAN'
                          ? 'bg-green-50 text-green-700'
                          : a.type === 'BEBAN'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.subtype || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {accounts.length > 30 && (
            <div className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
              Menampilkan 30 dari {accounts.length} akun
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium ${
        active
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}
