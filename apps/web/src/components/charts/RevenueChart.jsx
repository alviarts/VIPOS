// VIPOS — Daily revenue trend area chart.
//
// Vanilla-SVG implementation (no recharts). The previous recharts-based
// version pulled the entire 334 kB shared CartesianChart chunk into
// the lazy bundle even though the dashboard only renders two charts.
// This component does the same thing in ~5 kB by computing scales,
// path data, and tooltip positioning manually.
//
// Visual contract (must match the recharts version):
// - 256 px tall container (h-64), full width.
// - Mint-green (#04C99E) stroke + linearGradient fill (45% -> 0%).
// - Light-gray horizontal grid (#F3F4F6, dasharray 3 3), no vertical.
// - X labels: `d/M` short form (date-fns).
// - Y labels: `Xjt` for >=1m, `Xrb` for >=1k, raw int otherwise.
// - Hover anywhere over the plot area -> tooltip card with the date,
//   formatted total, and transaction count for the nearest x-bin.

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { formatCurrency } from '../../utils/format';
import useChartSize from './useChartSize';

const MARGIN = { top: 8, right: 12, left: 48, bottom: 24 };
const Y_TICKS = 4;
const STROKE_COLOR = '#04C99E';
const GRID_COLOR = '#F3F4F6';
const TICK_COLOR = '#9CA3AF';

function formatYTick(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return String(v);
}

function buildAreaPath(points, plotHeight) {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  const top = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  return `${top} L${last.x.toFixed(2)},${plotHeight} L${first.x.toFixed(2)},${plotHeight} Z`;
}

function buildLinePath(points) {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

function pickXLabelStep(count, plotWidth) {
  // Aim for one label every ~70 px so they don't collide on narrow
  // containers. Always show first + last.
  const target = Math.max(1, Math.floor(plotWidth / 70));
  return Math.max(1, Math.ceil(count / target));
}

export default function RevenueChart({ data = [] }) {
  const [containerRef, { width, height }] = useChartSize();
  const [hoverIdx, setHoverIdx] = useState(null);

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const { points, yMax, xLabelStep } = useMemo(() => {
    if (data.length === 0 || plotWidth <= 0 || plotHeight <= 0) {
      return { points: [], yMax: 0, xLabelStep: 1 };
    }
    const max = Math.max(...data.map((d) => Number(d.total) || 0));
    // Pad y so the area doesn't touch the top edge; if max is 0 we
    // still need a non-zero scale to avoid divide-by-zero.
    const yMaxPadded = max > 0 ? max * 1.1 : 1;
    const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
    const pts = data.map((d, i) => {
      const total = Number(d.total) || 0;
      return {
        x: data.length > 1 ? i * stepX : plotWidth / 2,
        y: plotHeight - (total / yMaxPadded) * plotHeight,
        raw: d,
      };
    });
    return {
      points: pts,
      yMax: yMaxPadded,
      xLabelStep: pickXLabelStep(data.length, plotWidth),
    };
  }, [data, plotWidth, plotHeight]);

  const yTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= Y_TICKS; i += 1) {
      const value = (yMax * i) / Y_TICKS;
      ticks.push({
        value,
        y: plotHeight - (value / (yMax || 1)) * plotHeight,
      });
    }
    return ticks;
  }, [yMax, plotHeight]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        Belum ada data penjualan untuk rentang ini.
      </div>
    );
  }

  const handleMouseMove = (event) => {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = event.clientX - rect.left - MARGIN.left;
    if (cursorX < 0 || cursorX > plotWidth) {
      setHoverIdx(null);
      return;
    }
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      const dist = Math.abs(points[i].x - cursorX);
      if (dist < nearestDist) {
        nearest = i;
        nearestDist = dist;
      }
    }
    setHoverIdx(nearest);
  };

  const handleMouseLeave = () => setHoverIdx(null);

  const hover = hoverIdx != null ? points[hoverIdx] : null;
  const tooltipLeft = hover ? hover.x + MARGIN.left : 0;
  const tooltipDate = hover
    ? format(new Date(hover.raw.date), 'd MMM yyyy', { locale: idLocale })
    : '';
  const tooltipTotal = hover ? formatCurrency(hover.raw.total) : '';
  const tooltipTxns = hover ? `${hover.raw.transactions} transaksi` : '';

  return (
    <div ref={containerRef} className="relative h-64 w-full min-w-0">
      {width > 0 && height > 0 ? (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Tren pendapatan harian"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STROKE_COLOR} stopOpacity={0.45} />
              <stop offset="100%" stopColor={STROKE_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
            {yTicks.map((t) => (
              <g key={t.value}>
                <line
                  x1={0}
                  x2={plotWidth}
                  y1={t.y}
                  y2={t.y}
                  stroke={GRID_COLOR}
                  strokeDasharray="3 3"
                />
                <text
                  x={-8}
                  y={t.y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill={TICK_COLOR}
                  fontSize="11"
                >
                  {formatYTick(t.value)}
                </text>
              </g>
            ))}
            <path d={buildAreaPath(points, plotHeight)} fill="url(#revenueGradient)" />
            <path d={buildLinePath(points)} fill="none" stroke={STROKE_COLOR} strokeWidth={2} />
            {points.map((p, i) => {
              if (i % xLabelStep !== 0 && i !== points.length - 1) return null;
              return (
                <text
                  key={p.raw.date}
                  x={p.x}
                  y={plotHeight + 16}
                  textAnchor="middle"
                  fill={TICK_COLOR}
                  fontSize="11"
                >
                  {format(new Date(p.raw.date), 'd/M')}
                </text>
              );
            })}
            {hover ? (
              <line
                x1={hover.x}
                x2={hover.x}
                y1={0}
                y2={plotHeight}
                stroke={STROKE_COLOR}
                strokeOpacity={0.4}
                strokeDasharray="2 3"
              />
            ) : null}
          </g>
        </svg>
      ) : null}
      {hover ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs shadow"
          style={{ left: tooltipLeft, top: 4 }}
          role="tooltip"
        >
          <div className="font-medium text-gray-900">{tooltipDate}</div>
          <div className="mt-1 text-primary-600">{tooltipTotal}</div>
          <div className="text-gray-500">{tooltipTxns}</div>
        </div>
      ) : null}
    </div>
  );
}
