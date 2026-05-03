// Laporan Keuangan — 7 tabs: Jurnal, Buku Besar, Neraca, Laba Rugi, Arus Kas, Hutang, Piutang.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { PageHeader } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/format';

const TABS = [
  { id: 'journal', label: 'Jurnal' },
  { id: 'general-ledger', label: 'Buku Besar' },
  { id: 'balance-sheet', label: 'Neraca' },
  { id: 'income-statement', label: 'Laba Rugi' },
  { id: 'cash-flow', label: 'Arus Kas' },
  { id: 'ap', label: 'Hutang (AP)' },
  { id: 'ar', label: 'Piutang (AR)' },
];

const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

export default function FinancialReportsPage() {
  const [tab, setTab] = useState('balance-sheet');
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(today());
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/account?is_active=1')
      .then((r) => setAccounts(r.data || []))
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, from, to, accountId]);

  async function loadReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (['balance-sheet'].includes(tab)) params.set('as_of', to);
      else {
        params.set('from', from);
        params.set('to', to);
      }
      if (tab === 'general-ledger' && accountId) params.set('account_id', accountId);
      const { data } = await api.get(`/financial-report/${tab}?${params.toString()}`);
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal memuat laporan');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Keuangan"
        description="Jurnal, Buku Besar, Neraca, Laba Rugi, Arus Kas, Hutang & Piutang."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? 'bg-primary-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {tab !== 'balance-sheet' && <DateField label="Dari" value={from} onChange={setFrom} />}
        <DateField
          label={tab === 'balance-sheet' ? 'Per tanggal' : 'Sampai'}
          value={to}
          onChange={setTo}
        />
        {tab === 'general-ledger' && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Akun</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="input-field min-w-[260px]"
            >
              <option value="">Semua akun</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          Memuat laporan…
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          Tidak ada data
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {tab === 'journal' && <JournalReport data={data} />}
          {tab === 'general-ledger' && <GeneralLedgerReport data={data} />}
          {tab === 'balance-sheet' && <BalanceSheetReport data={data} />}
          {tab === 'income-statement' && <IncomeStatementReport data={data} />}
          {tab === 'cash-flow' && <CashFlowReport data={data} />}
          {tab === 'ap' && <ApReport data={data} />}
          {tab === 'ar' && <ArReport data={data} />}
        </div>
      )}
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    </label>
  );
}

function JournalReport({ data }) {
  const items = Array.isArray(data) ? data : data.items || [];
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
        <tr>
          <th className="px-3 py-2 text-left">No. Jurnal</th>
          <th className="px-3 py-2 text-left">Tanggal</th>
          <th className="px-3 py-2 text-left">Sumber</th>
          <th className="px-3 py-2 text-left">Keterangan</th>
          <th className="px-3 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((j) => (
          <tr key={j.id}>
            <td className="px-3 py-2 font-mono text-xs">{j.journal_no}</td>
            <td className="px-3 py-2">{formatDate(j.journal_date)}</td>
            <td className="px-3 py-2 text-xs">{j.source_type}</td>
            <td className="px-3 py-2">{j.description || '-'}</td>
            <td className="px-3 py-2 text-right">{formatCurrency(j.total_amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GeneralLedgerReport({ data }) {
  const accounts = data.accounts || [];
  if (accounts.length === 0)
    return <p className="text-sm text-gray-500">Tidak ada mutasi pada periode ini.</p>;
  return (
    <div className="space-y-6">
      {accounts.map((acc) => (
        <div key={acc.id}>
          <h3 className="mb-2 text-sm font-semibold">
            <span className="font-mono text-xs text-gray-500">{acc.code}</span> — {acc.name}{' '}
            <span className="ml-2 text-xs text-gray-500">
              Saldo Akhir: {formatCurrency(acc.closing_balance)}
            </span>
          </h3>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 uppercase text-gray-500">
              <tr>
                <th className="px-2 py-1.5 text-left">Tanggal</th>
                <th className="px-2 py-1.5 text-left">No. Jurnal</th>
                <th className="px-2 py-1.5 text-right">Debit</th>
                <th className="px-2 py-1.5 text-right">Kredit</th>
                <th className="px-2 py-1.5 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {acc.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-2 py-1.5">{formatDate(l.journal_date)}</td>
                  <td className="px-2 py-1.5 font-mono">{l.journal_no}</td>
                  <td className="px-2 py-1.5 text-right">
                    {l.debit > 0 ? formatCurrency(l.debit) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {l.credit > 0 ? formatCurrency(l.credit) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function BalanceSheetReport({ data }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ReportSection title="Aset" rows={data.aset || []} total={data.total_aset} />
      <div>
        <ReportSection title="Kewajiban" rows={data.kewajiban || []} total={data.total_kewajiban} />
        <ReportSection
          title="Modal"
          rows={data.modal || []}
          total={data.total_modal}
          extraRow={{
            label: 'Laba (Rugi) Tahun Berjalan',
            value: data.laba_tahun_berjalan,
          }}
        />
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span>Total Kewajiban + Modal</span>
            <span className="font-mono">
              {formatCurrency((data.total_kewajiban || 0) + (data.total_modal || 0))}
            </span>
          </div>
          <div className={`mt-1 text-xs ${data.is_balanced ? 'text-green-600' : 'text-red-600'}`}>
            {data.is_balanced
              ? '✓ Aset = Kewajiban + Modal'
              : 'Tidak balanced — periksa saldo awal'}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportSection({ title, rows, total, extraRow }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-2 text-xs text-gray-400" colSpan={2}>
                Tidak ada saldo
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-1.5">
                  <span className="font-mono text-xs text-gray-500">{r.code}</span> {r.name}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(r.balance)}</td>
              </tr>
            ))
          )}
          {extraRow && (
            <tr>
              <td className="px-2 py-1.5 italic text-gray-600">{extraRow.label}</td>
              <td className="px-2 py-1.5 text-right font-mono italic text-gray-600">
                {formatCurrency(extraRow.value || 0)}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="border-t-2 border-gray-300 text-sm font-semibold">
          <tr>
            <td className="px-2 py-1.5">Total {title}</td>
            <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(total || 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function IncomeStatementReport({ data }) {
  return (
    <div className="space-y-4">
      <ReportSection
        title="Pendapatan"
        rows={data.pendapatan || []}
        total={data.total_pendapatan}
      />
      <ReportSection title="Beban" rows={data.beban || []} total={data.total_beban} />
      <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3">
        <div className="flex justify-between text-sm">
          <span className="font-semibold">Laba (Rugi) Bersih</span>
          <span
            className={`font-mono font-bold ${
              data.net_income >= 0 ? 'text-primary-700' : 'text-red-600'
            }`}
          >
            {formatCurrency(data.net_income || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

function CashFlowReport({ data }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-xs">
        <div>
          <p className="text-gray-500">Saldo Awal</p>
          <p className="font-semibold">{formatCurrency(data.opening || 0)}</p>
        </div>
        <div>
          <p className="text-gray-500">Perubahan</p>
          <p
            className={`font-semibold ${
              (data.net_change || 0) >= 0 ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {formatCurrency(data.net_change || 0)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Saldo Akhir</p>
          <p className="font-semibold">{formatCurrency(data.closing || 0)}</p>
        </div>
      </div>
      {(data.sections || []).map((s) => (
        <div key={s.title}>
          <h3 className="mb-2 text-sm font-semibold">{s.title}</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {(s.items || []).map((it, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1.5">{it.label}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(it.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 text-sm font-semibold">
              <tr>
                <td className="px-2 py-1.5">Subtotal</td>
                <td className="px-2 py-1.5 text-right font-mono">{formatCurrency(s.total || 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}
    </div>
  );
}

function ApReport({ data }) {
  const items = data.items || [];
  return (
    <div>
      <p className="mb-3 text-sm">
        Total Hutang: <span className="font-bold">{formatCurrency(data.total || 0)}</span>
      </p>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Vendor</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2 text-right">Umur (hari)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-4 text-center text-xs text-gray-400">
                Tidak ada hutang outstanding
              </td>
            </tr>
          ) : (
            items.map((it, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{it.vendor_name || it.label}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(it.balance || it.amount)}</td>
                <td className="px-3 py-2 text-right">{it.aging_days ?? '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ArReport({ data }) {
  const items = data.items || [];
  return (
    <div>
      <p className="mb-3 text-sm">
        Total Piutang: <span className="font-bold">{formatCurrency(data.total || 0)}</span>
      </p>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left">Pelanggan</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2 text-right">Umur (hari)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-4 text-center text-xs text-gray-400">
                Tidak ada piutang outstanding
              </td>
            </tr>
          ) : (
            items.map((it, i) => (
              <tr key={i}>
                <td className="px-3 py-2">{it.customer_name || it.label}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(it.balance || it.amount)}</td>
                <td className="px-3 py-2 text-right">{it.aging_days ?? '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
