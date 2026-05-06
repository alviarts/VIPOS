// VIPOS — Horizontal bar chart for top products.
//
// Vanilla-SVG implementation (no recharts). Drops the shared 334 kB
// CartesianChart chunk in favour of ~5 kB of hand-rolled scales +
// path math. See `RevenueChart.jsx` for the matching rationale.
//
// Visual contract (must match the recharts version):
// - 256 px tall container (h-64), full width.
// - Mint-green (#04C99E) bars with right-rounded corners (radius 4).
// - 120 px reserved on the left for product-name labels.
// - Vertical grid disabled; horizontal grid is the implicit baseline
//   between rows (no extra gridlines drawn — recharts version had
//   `horizontal={false}` so this matches).
// - X axis labels: numeric (total_sold).
// - Hover anywhere over a bar -> tooltip card with product name,
//   units sold, and total revenue formatted as IDR.

import { useMemo, useState } from 'react';
import { formatCurrency } from '../../utils/format';
import useChartSize from './useChartSize';

const MARGIN = { top: 4, right: 24, left: 128, bottom: 24 };
const X_TICKS = 4;
const BAR_FILL = '#04C99E';
const BAR_HOVER_FILL = '#03A684';
const HOVER_BG = '#F0FDF9';
const TICK_COLOR = '#9CA3AF';
const NAME_COLOR = '#374151';
const BAR_RADIUS = 4;
const BAR_PADDING_RATIO = 0.25;

export default function TopProductChart({ data = [] }) {
  const [containerRef, { width, height }] = useChartSize();
  const [hoverIdx, setHoverIdx] = useState(null);

  // Recharts renders top-down; ascending order puts the largest at
  // the top after vertical inversion. Mirror the original ordering.
  const sorted = useMemo(() => [...data].sort((a, b) => a.total_sold - b.total_sold), [data]);

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const { bars, xTicks } = useMemo(() => {
    if (sorted.length === 0 || plotWidth <= 0 || plotHeight <= 0) {
      return { bars: [], xTicks: [] };
    }
    const max = Math.max(...sorted.map((d) => Number(d.total_sold) || 0));
    const xMaxPadded = max > 0 ? max * 1.05 : 1;
    const rowHeight = plotHeight / sorted.length;
    const barHeight = rowHeight * (1 - BAR_PADDING_RATIO);
    const built = sorted.map((d, i) => {
      const value = Number(d.total_sold) || 0;
      const w = (value / xMaxPadded) * plotWidth;
      // Render top-down: largest bar should land at the top of the
      // plot. `sorted` is ascending so the LAST entry is the largest;
      // we invert via (sorted.length - 1 - i) when computing y.
      const rowIdx = sorted.length - 1 - i;
      const y = rowIdx * rowHeight + (rowHeight - barHeight) / 2;
      return { raw: d, x: 0, y, w, h: barHeight, rowIdx };
    });
    const ticks = [];
    for (let t = 0; t <= X_TICKS; t += 1) {
      const value = (xMaxPadded * t) / X_TICKS;
      ticks.push({ value, x: (value / xMaxPadded) * plotWidth });
    }
    return { bars: built, xTicks: ticks };
  }, [sorted, plotWidth, plotHeight]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        Belum ada produk yang terjual.
      </div>
    );
  }

  const truncate = (label) => (label.length > 18 ? `${label.slice(0, 17)}\u2026` : label);

  const hover = hoverIdx != null ? bars.find((b) => b.rowIdx === hoverIdx) : null;
  const tooltipLeft = hover ? MARGIN.left + Math.min(hover.w + 16, plotWidth - 8) : 0;
  const tooltipTop = hover ? MARGIN.top + hover.y + hover.h / 2 : 0;

  return (
    <div ref={containerRef} className="relative h-64 w-full min-w-0">
      {width > 0 && height > 0 ? (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Top produk berdasarkan unit terjual"
        >
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {/* Hover row background — placed first so it sits behind everything else. */}
            {bars.map((b) =>
              hover && hover.rowIdx === b.rowIdx ? (
                <rect
                  key={`bg-${b.raw.product_name}`}
                  x={-MARGIN.left + 8}
                  y={b.y - (plotHeight / bars.length - b.h) / 2}
                  width={width - 8}
                  height={plotHeight / bars.length}
                  fill={HOVER_BG}
                />
              ) : null
            )}
            {bars.map((b) => (
              <g
                key={b.raw.product_name}
                onMouseEnter={() => setHoverIdx(b.rowIdx)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={-MARGIN.left + 8}
                  y={b.y - (plotHeight / bars.length - b.h) / 2}
                  width={width - 8}
                  height={plotHeight / bars.length}
                  fill="transparent"
                />
                <text
                  x={-8}
                  y={b.y + b.h / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill={NAME_COLOR}
                  fontSize="11"
                >
                  {truncate(b.raw.product_name)}
                </text>
                <Bar
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  fill={hover && hover.rowIdx === b.rowIdx ? BAR_HOVER_FILL : BAR_FILL}
                />
              </g>
            ))}
            {xTicks.map((t) => (
              <text
                key={t.value}
                x={t.x}
                y={plotHeight + 16}
                textAnchor="middle"
                fill={TICK_COLOR}
                fontSize="11"
              >
                {Math.round(t.value)}
              </text>
            ))}
          </g>
        </svg>
      ) : null}
      {hover ? (
        <div
          className="pointer-events-none absolute -translate-y-1/2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs shadow"
          style={{ left: tooltipLeft, top: tooltipTop }}
          role="tooltip"
        >
          <div className="font-medium text-gray-900">{hover.raw.product_name}</div>
          <div className="mt-1 text-gray-700">Terjual {hover.raw.total_sold}</div>
          <div className="text-gray-500">{formatCurrency(hover.raw.total_revenue)}</div>
        </div>
      ) : null}
    </div>
  );
}

// Right-rounded bar (matches the recharts radius={[0, 4, 4, 0]}).
// Renders a path so the corner rounding only applies on the right side.
function Bar({ x, y, width: w, height: h, fill }) {
  if (w <= 0 || h <= 0) return null;
  const r = Math.min(BAR_RADIUS, w, h / 2);
  const d =
    `M${x},${y} ` +
    `H${x + w - r} ` +
    `Q${x + w},${y} ${x + w},${y + r} ` +
    `V${y + h - r} ` +
    `Q${x + w},${y + h} ${x + w - r},${y + h} ` +
    `H${x} Z`;
  return <path d={d} fill={fill} />;
}
