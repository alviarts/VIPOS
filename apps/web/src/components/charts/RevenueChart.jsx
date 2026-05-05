// VIPOS — Daily revenue trend area chart (Recharts).
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { formatCurrency } from '../../utils/format';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs shadow">
      <div className="font-medium text-gray-900">
        {format(new Date(point.date), 'd MMM yyyy', { locale: idLocale })}
      </div>
      <div className="mt-1 text-primary-600">{formatCurrency(point.total)}</div>
      <div className="text-gray-500">{point.transactions} transaksi</div>
    </div>
  );
}

export default function RevenueChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        Belum ada data penjualan untuk rentang ini.
      </div>
    );
  }

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#04C99E" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#04C99E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => format(new Date(d), 'd/M')}
            stroke="#9CA3AF"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) =>
              v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : v
            }
            stroke="#9CA3AF"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#04C99E"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
