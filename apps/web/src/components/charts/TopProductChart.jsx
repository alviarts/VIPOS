// VIPOS — Horizontal bar chart for top products (Recharts).
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '../../utils/format';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs shadow">
      <div className="font-medium text-gray-900">{p.product_name}</div>
      <div className="mt-1 text-gray-700">Terjual {p.total_sold}</div>
      <div className="text-gray-500">{formatCurrency(p.total_revenue)}</div>
    </div>
  );
}

export default function TopProductChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        Belum ada produk yang terjual.
      </div>
    );
  }

  // Recharts renders top-down; we want descending (largest at top).
  const chartData = [...data]
    .sort((a, b) => a.total_sold - b.total_sold);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
          <XAxis type="number" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="product_name"
            stroke="#374151"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={120}
            tick={{ fill: '#374151' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F0FDF9' }} />
          <Bar dataKey="total_sold" fill="#04C99E" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
