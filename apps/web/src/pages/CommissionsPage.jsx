import { useEffect, useMemo, useState } from 'react';
import { Award, Edit2, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ConfirmationDialog, EmptyState, FilterTabs, PageHeader } from '../components/ui';
import CommissionGroupForm from '../components/commissions/CommissionGroupForm';

const TYPE_LABEL = { FIXED: 'Tetap', TIERED: 'Bertingkat' };
const PERIOD_LABEL = { DAY: 'Per Hari', WEEK: 'Per Minggu', MONTH: 'Per Bulan' };

function formatRp(n) {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

function describeGroup(g) {
  if (g.type === 'FIXED') {
    const basis = g.amount_basis === 'PER_ITEM' ? 'per item' : 'per transaksi';
    return `${formatRp(g.amount)} ${basis}`;
  }
  if (g.type === 'TIERED' && Array.isArray(g.tiers) && g.tiers.length) {
    const last = g.tiers[g.tiers.length - 1];
    return `${g.tiers.length} tier, max ${last.percentage}%`;
  }
  return '-';
}

function AssignDialog({ open, onClose, onSaved }) {
  const [transactionId, setTransactionId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [recentTxns, setRecentTxns] = useState([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTransactionId('');
    setEmployeeId('');
    setNotes('');
    api
      .get('/auth/users')
      .then((r) => setEmployees(r.data || []))
      .catch(() => {});
    api
      .get('/transactions?limit=20')
      .then((r) => setRecentTxns(r.data?.transactions || r.data || []))
      .catch(() => setRecentTxns([]));
  }, [open]);

  async function save() {
    if (!transactionId || !employeeId) {
      toast.error('Pilih transaksi & karyawan');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/commission-assignment', {
        transaction_id: Number(transactionId),
        employee_id: Number(employeeId),
        notes: notes.trim() || null,
      });
      const total = res.data?.total_commission || 0;
      const count = res.data?.assignments?.length || 0;
      if (count === 0) {
        toast('Tidak ada grup komisi yang qualifying');
      } else {
        toast.success(`${count} komisi tagged (${formatRp(total)})`);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal tag komisi');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold">Tag Komisi ke Transaksi</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Transaksi *</label>
            <select
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="input w-full"
            >
              <option value="">— pilih transaksi —</option>
              {recentTxns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.invoice_number || `TXN-${t.id}`} · {formatRp(t.total_amount)}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Hanya 20 transaksi terbaru. Untuk tag transaksi lama, masukkan ID:
            </p>
            <input
              type="number"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="input w-full mt-1 text-xs"
              placeholder="Atau masukkan transaction id"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Karyawan *</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="input w-full"
            >
              <option value="">— pilih karyawan —</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Catatan</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full"
              placeholder="opsional"
            />
          </div>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Batal
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Menyimpan...' : 'Tag'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CommissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const [tab, setTab] = useState('groups');

  // Groups
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Assignments
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [confirmUntag, setConfirmUntag] = useState(null);

  // Report
  const [report, setReport] = useState({ rows: [], total_commission: 0 });
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [groupBy, setGroupBy] = useState('MONTH');

  useEffect(() => {
    loadGroups();
    api
      .get('/auth/users')
      .then((r) => setEmployees(r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'assignments') loadAssignments();
    if (tab === 'report') loadReport();
  }, [tab, filterEmployee, reportFrom, reportTo, groupBy]);

  async function loadGroups() {
    try {
      const res = await api.get('/commission-group');
      setGroups(res.data || []);
    } catch {
      toast.error('Gagal memuat grup komisi');
    }
  }

  async function loadAssignments() {
    try {
      const params = new URLSearchParams();
      if (filterEmployee) params.set('employee_id', filterEmployee);
      params.set('limit', '200');
      const res = await api.get(`/commission-assignment?${params.toString()}`);
      setAssignments(res.data?.items || []);
    } catch {
      toast.error('Gagal memuat assignments');
    }
  }

  async function loadReport() {
    try {
      const params = new URLSearchParams();
      if (filterEmployee) params.set('employee_id', filterEmployee);
      if (reportFrom) params.set('from', reportFrom);
      if (reportTo) params.set('to', reportTo);
      if (groupBy) params.set('group_by', groupBy);
      const res = await api.get(`/commission-report?${params.toString()}`);
      setReport(res.data || { rows: [], total_commission: 0 });
    } catch {
      toast.error('Gagal memuat laporan');
    }
  }

  async function toggleActive(g) {
    try {
      await api.put(`/commission-group/${g.id}`, { is_active: !g.is_active });
      await loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal update');
    }
  }

  async function deleteGroup() {
    if (!confirmDelete) return;
    try {
      await api.delete(`/commission-group/${confirmDelete.id}`);
      toast.success('Grup dihapus');
      setConfirmDelete(null);
      await loadGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal hapus');
    }
  }

  async function untag() {
    if (!confirmUntag) return;
    try {
      await api.delete(`/commission-assignment/${confirmUntag.id}`);
      toast.success('Assignment dihapus');
      setConfirmUntag(null);
      await loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal hapus');
    }
  }

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (statusFilter === 'active' && !g.is_active) return false;
      if (statusFilter === 'inactive' && g.is_active) return false;
      if (typeFilter !== 'all' && g.type !== typeFilter) return false;
      if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [groups, statusFilter, typeFilter, search]);

  function exportReportCSV() {
    if (!report.rows.length) {
      toast.error('Tidak ada data untuk export');
      return;
    }
    const header = [
      'employee_id',
      'employee_name',
      'period_key',
      'transaction_count',
      'total_basis',
      'total_commission',
    ];
    const rows = report.rows.map((r) =>
      header.map((k) => `"${(r[k] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commission_report_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs = [
    { id: 'groups', label: 'Grup Komisi', count: groups.length },
    { id: 'assignments', label: 'Assignments', count: assignments.length },
    { id: 'report', label: 'Laporan' },
  ];

  return (
    <div>
      <PageHeader
        title="Komisi"
        subtitle="Setup grup komisi (fixed / tiered) + tag karyawan per transaksi"
        icon={Award}
      >
        {isAdmin && tab === 'groups' && (
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Grup Baru
          </button>
        )}
        {isAdmin && tab === 'assignments' && (
          <button
            onClick={() => setShowAssign(true)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Tag Komisi
          </button>
        )}
        {tab === 'report' && (
          <button onClick={exportReportCSV} className="btn-secondary">
            Export CSV
          </button>
        )}
      </PageHeader>

      <FilterTabs tabs={tabs} activeId={tab} onChange={setTab} />

      {tab === 'groups' && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama grup..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input"
            >
              <option value="all">Semua Jenis</option>
              <option value="FIXED">Tetap</option>
              <option value="TIERED">Bertingkat</option>
            </select>
          </div>

          {filteredGroups.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Belum ada grup komisi"
              description={
                isAdmin
                  ? 'Buat grup komisi untuk mulai tag karyawan.'
                  : 'Hubungi admin untuk setup grup komisi.'
              }
            />
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-left">Jenis</th>
                    <th className="px-4 py-3 text-left">Detail</th>
                    <th className="px-4 py-3 text-left">Periode</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    {isAdmin && <th className="px-4 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((g) => (
                    <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{g.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            g.type === 'FIXED'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {TYPE_LABEL[g.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{describeGroup(g)}</td>
                      <td className="px-4 py-3 text-gray-600">{PERIOD_LABEL[g.calc_period]}</td>
                      <td className="px-4 py-3 text-center">
                        {isAdmin ? (
                          <button
                            onClick={() => toggleActive(g)}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                              g.is_active
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {g.is_active ? 'Aktif' : 'Nonaktif'}
                          </button>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs ${
                              g.is_active
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {g.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setEditing(g);
                              setShowForm(true);
                            }}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(g)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'assignments' && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="input"
            >
              <option value="">Semua karyawan</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
          </div>

          {assignments.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Belum ada assignment"
              description="Tag karyawan ke transaksi untuk menghitung komisi otomatis."
            />
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Karyawan</th>
                    <th className="px-4 py-3 text-left">Invoice</th>
                    <th className="px-4 py-3 text-left">Grup</th>
                    <th className="px-4 py-3 text-right">Basis</th>
                    <th className="px-4 py-3 text-right">Komisi</th>
                    {isAdmin && <th className="px-4 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {a.created_at?.slice(0, 10) || '-'}
                      </td>
                      <td className="px-4 py-3">{a.employee_name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.invoice_number || '-'}</td>
                      <td className="px-4 py-3">{a.commission_group_name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.basis_qty ? `${a.basis_qty} item · ` : ''}
                        {formatRp(a.basis_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary-700">
                        {formatRp(a.computed_amount)}
                        {a.tier_percentage !== null && a.tier_percentage !== undefined && (
                          <span className="text-xs text-gray-400 ml-1">({a.tier_percentage}%)</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setConfirmUntag(a)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Karyawan</label>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="input"
              >
                <option value="">Semua</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Dari</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sampai</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Group by</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="input"
              >
                <option value="DAY">Per Hari</option>
                <option value="WEEK">Per Minggu</option>
                <option value="MONTH">Per Bulan</option>
              </select>
            </div>
          </div>

          <div className="bg-primary-50 border border-primary-100 rounded-lg p-4">
            <div className="text-xs text-primary-700">Total Komisi (filter aktif)</div>
            <div className="text-2xl font-bold text-primary-700">
              {formatRp(report.total_commission)}
            </div>
          </div>

          {report.rows.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Belum ada data komisi"
              description="Tag karyawan ke transaksi atau ubah filter."
            />
          ) : (
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Periode</th>
                    <th className="px-4 py-3 text-left">Karyawan</th>
                    <th className="px-4 py-3 text-right">Transaksi</th>
                    <th className="px-4 py-3 text-right">Total Basis</th>
                    <th className="px-4 py-3 text-right">Total Komisi</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r, idx) => (
                    <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.period_key}</td>
                      <td className="px-4 py-3">{r.employee_name}</td>
                      <td className="px-4 py-3 text-right">{r.transaction_count}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatRp(r.total_basis)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary-700">
                        {formatRp(r.total_commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <CommissionGroupForm
        open={showForm}
        group={editing}
        onClose={() => setShowForm(false)}
        onSaved={loadGroups}
      />

      <AssignDialog
        open={showAssign}
        onClose={() => setShowAssign(false)}
        onSaved={loadAssignments}
      />

      <ConfirmationDialog
        open={!!confirmDelete}
        title="Hapus grup komisi?"
        message={`Grup "${confirmDelete?.name}" dan semua assignment terkait akan dihapus.`}
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={deleteGroup}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmationDialog
        open={!!confirmUntag}
        title="Hapus assignment?"
        message={`Assignment komisi "${confirmUntag?.commission_group_name}" untuk ${confirmUntag?.employee_name} akan dihapus.`}
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={untag}
        onCancel={() => setConfirmUntag(null)}
      />
    </div>
  );
}
