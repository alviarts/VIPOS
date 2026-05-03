# POS Dashboard (sales-dashboard)

URL: `sales-dashboard`

> Top-level view shown after login. KPIs + quick navigation tiles.

## §1 KPI cards

- **Pendapatan Hari Ini** (today gross revenue)
- **Transaksi Hari Ini** (today trx count)
- **Rata-rata per Transaksi** (avg ticket today)
- **Pelanggan Hari Ini** (unique customers today)
- **Stok Menipis** (low stock count, click to drill)
- **Pesanan Online** (pending online orders count, click to drill)

Each card shows:
- Big number
- Comparison to yesterday (% delta with arrow)
- Mini sparkline (last 7 days)

## §2 Charts

- **Grafik Penjualan Mingguan** — line chart, last 7 days
- **Top 5 Produk Hari Ini** — bar chart
- **Distribusi Order Type** — pie chart
- **Heatmap jam-vs-hari penjualan** — 7×24 grid

## §3 Quick action tiles

- Buka Kasir / POS
- Tutup Kasir
- Tambah Produk
- Tambah Pelanggan
- Lihat Laporan
- Pesanan Online

## §4 Outlet switcher

Top-right dropdown to switch active outlet (if user has multi-outlet access).

## §5 Notifications

Bell icon → recent notifications (low stock, new online order, void approval pending, etc).

## §6 Mobile considerations

- Phone version: scrollable single column. KPIs at top, then charts, then quick actions.
- Tablet version: 2-column layout (KPIs left, charts right) or 3-column on landscape.
- Charts use Vico (Compose-native).
- Refresh: pull-to-refresh; auto-refresh every 60 s when foreground.
- KPI computation:
  - Online: `GET /api/v1/dashboard/stats?outlet=&period=today` (single endpoint, server aggregates).
  - Offline: compute from local transactions (degraded — only shows local-known data).

## §7 Permission gating

- All KPIs visible to OWNER/MANAGER.
- KASIR sees only "Today" stats, no historical comparison or financial drill-downs.
- Multi-outlet KPIs only if user has multi-outlet access.

## §8 Open questions

- Single dashboard endpoint or multiple? `[inferred]` — recommend single for mobile efficiency.
- Caching policy for charts? `[unknown]` — recommend 5-min stale acceptable.
