// Buku Kas — list cash/bank accounts + per-account ledger + transfer modal.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { EmptyState, PageHeader } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/format';

const today = () => new Date().toISOString().slice(0, 10);

export default function CashBookPage() {
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [showLedger, setShowLedger] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    transfer_date: today(),
    from_account_id: '',
    to_account_id: '',
    amount: 0,
    fee: 0,
    fee_account_id: '',
    description: '',
  });
  const [feeAccounts, setFeeAccounts] = useState([]);

  useEffect(() => {
    loadCashAccounts();
  }, []);

  async function loadCashAccounts() {
    try {
      const { data } = await api.get('/account?type=ASET');
      const cash = data.filter((a) => a.subtype === 'Kas & Bank' && a.is_active);
      setAccounts(cash);
      // Fetch each account balance.
      const bs = {};
      await Promise.all(
        cash.map(async (a) => {
          try {
            const r = await api.get(`/account/${a.id}`);
            bs[a.id] = r.data.current_balance ?? 0;
          } catch {
            bs[a.id] = 0;
          }
        })
      );
      setBalances(bs);
      // Fee accounts (BEBAN type).
      const feeRes = await api.get('/account?type=BEBAN&is_active=1');
      setFeeAccounts(feeRes.data || []);
    } catch {
      toast.error('Gagal memuat akun kas/bank');
    }
  }

  async function viewLedger(acc) {
    try {
      const { data } = await api.get(`/account/${acc.id}/ledger`);
      setLedger(data);
      setShowLedger(acc);
    } catch {
      toast.error('Gagal memuat ledger');
    }
  }

  async function submitTransfer(e) {
    e.preventDefault();
    try {
      const payload = {
        ...transferForm,
        from_account_id: Number(transferForm.from_account_id),
        to_account_id: Number(transferForm.to_account_id),
        amount: Number(transferForm.amount),
        fee: Number(transferForm.fee) || 0,
        fee_account_id: transferForm.fee_account_id ? Number(transferForm.fee_account_id) : null,
      };
      await api.post('/cash-transfer', payload);
      toast.success('Transfer berhasil di-post');
      setShowTransfer(false);
      setTransferForm({
        transfer_date: today(),
        from_account_id: '',
        to_account_id: '',
        amount: 0,
        fee: 0,
        fee_account_id: '',
        description: '',
      });
      loadCashAccounts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal transfer');
    }
  }

  const totalCash = useMemo(
    () => Object.values(balances).reduce((s, v) => s + (v || 0), 0),
    [balances]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kas & Bank"
        description="Pantau saldo akun kas, bank, dan e-wallet. Lihat ledger per akun atau transfer antar akun."
        actions={
          <button
            onClick={() => setShowTransfer(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            <ArrowLeftRight className="h-4 w-4" /> Transfer
          </button>
        }
      />

      <div className="rounded-xl border border-primary-100 bg-primary-50 px-5 py-4">
        <p className="text-xs text-primary-700">Total saldo kas + bank</p>
        <p className="mt-1 text-2xl font-bold text-primary-900">{formatCurrency(totalCash)}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {accounts.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3">
            <EmptyState
              title="Belum ada akun kas/bank"
              description="Tambahkan di Daftar Akun, set sub-tipe 'Kas & Bank'."
            />
          </div>
        ) : (
          accounts.map((acc) => (
            <div key={acc.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-gray-400">{acc.code}</p>
                  <h3 className="mt-1 font-semibold">{acc.name}</h3>
                </div>
                <button
                  onClick={() => viewLedger(acc)}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-xl font-bold text-gray-900">
                {formatCurrency(balances[acc.id] ?? 0)}
              </p>
            </div>
          ))
        )}
      </div>

      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold">Transfer Antar Akun</h2>
              <button
                onClick={() => setShowTransfer(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitTransfer} className="space-y-3 px-5 py-4">
              <Field label="Tanggal" required>
                <input
                  type="date"
                  required
                  value={transferForm.transfer_date}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, transfer_date: e.target.value })
                  }
                  className="input-field"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dari Akun" required>
                  <select
                    required
                    value={transferForm.from_account_id}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, from_account_id: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="">— Pilih —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ke Akun" required>
                  <select
                    required
                    value={transferForm.to_account_id}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, to_account_id: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="">— Pilih —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Jumlah" required>
                <input
                  type="number"
                  min={0}
                  required
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  className="input-field"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Biaya Bank">
                  <input
                    type="number"
                    min={0}
                    value={transferForm.fee}
                    onChange={(e) => setTransferForm({ ...transferForm, fee: e.target.value })}
                    className="input-field"
                  />
                </Field>
                {Number(transferForm.fee) > 0 && (
                  <Field label="Akun Beban Biaya" required>
                    <select
                      required
                      value={transferForm.fee_account_id}
                      onChange={(e) =>
                        setTransferForm({ ...transferForm, fee_account_id: e.target.value })
                      }
                      className="input-field"
                    >
                      <option value="">— Pilih —</option>
                      {feeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              <Field label="Keterangan">
                <input
                  value={transferForm.description}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, description: e.target.value })
                  }
                  className="input-field"
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTransfer(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLedger && ledger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold">{showLedger.name}</h2>
                <p className="font-mono text-xs text-gray-500">{showLedger.code}</p>
              </div>
              <button
                onClick={() => {
                  setShowLedger(null);
                  setLedger(null);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="mb-4 grid grid-cols-3 gap-3 rounded bg-gray-50 p-3 text-xs">
                <div>
                  <p className="text-gray-500">Saldo Awal</p>
                  <p className="font-semibold">{formatCurrency(ledger.opening_balance)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Saldo Akhir</p>
                  <p className="font-semibold">{formatCurrency(ledger.closing_balance)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Mutasi</p>
                  <p className="font-semibold">{ledger.lines.length} entri</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-left">No. Jurnal</th>
                    <th className="px-3 py-2 text-left">Keterangan</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Kredit</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledger.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 text-xs">{formatDate(l.journal_date)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{l.journal_no}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {l.description || l.journal_description}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {l.debit > 0 ? formatCurrency(l.debit) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {l.credit > 0 ? formatCurrency(l.credit) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(l.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
