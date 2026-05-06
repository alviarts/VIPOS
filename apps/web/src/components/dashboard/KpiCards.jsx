// VIPOS — Dashboard KPI tiles.
import { DollarSign, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

export default function KpiCards({ summary, loading }) {
  const cards = [
    {
      label: 'Pendapatan',
      value: summary ? formatCurrency(summary.revenue) : '—',
      sub: summary ? `Hari ini: ${formatCurrency(summary.today.revenue)}` : '',
      icon: DollarSign,
      tone: 'bg-primary-50 text-primary-600',
    },
    {
      label: 'Transaksi',
      value: summary ? summary.transactions.toLocaleString('id-ID') : '—',
      sub: summary ? `Hari ini: ${summary.today.transactions}` : '',
      icon: Receipt,
      tone: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'Avg. Ticket',
      value: summary ? formatCurrency(summary.avg_ticket) : '—',
      sub: 'Pendapatan / transaksi',
      icon: TrendingUp,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Item Terjual',
      value: summary ? summary.items_sold.toLocaleString('id-ID') : '—',
      sub: summary ? `${summary.products} produk aktif` : '',
      icon: ShoppingBag,
      tone: 'bg-violet-50 text-violet-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="flex items-start justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                {c.label}
              </p>
              <p
                className={`mt-1 text-xl font-bold text-gray-900 ${
                  loading ? 'animate-pulse text-gray-200' : ''
                }`}
              >
                {c.value}
              </p>
              {c.sub && <p className="mt-1 truncate text-xs text-gray-500">{c.sub}</p>}
            </div>
            <div
              className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${c.tone}`}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
