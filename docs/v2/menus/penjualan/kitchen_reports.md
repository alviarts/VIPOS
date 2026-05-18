# Kitchen Reports (Laporan Dapur)

> Track kitchen processing efficiency.

## §1 Laporan Proses Order

URL: `laporan/dapur/proses-order`

Per kitchen ticket:
- Order # / table
- Sent to kitchen at
- Started at (kitchen marks "Cooking")
- Ready at (kitchen marks "Ready")
- Served at (waiter marks "Served")
- Total elapsed
- Cook time (sent → ready)
- Wait time (ready → served)

Filters: outlet, kitchen station, date range.

Aggregate stats:
- Avg cook time
- Avg wait time
- Late tickets (>20 min)
- Quickest / slowest tickets

## §2 Laporan Proses Produk

URL: `laporan/dapur/proses-produk`

Same dimensions but per product (e.g. "Nasi Goreng Spesial avg cook time 7 min over 200 orders").

## Mobile considerations

- KDS app shows real-time view; reports show historical aggregate.
- Reports are read-only and cacheable for offline reading (last 7 days).

## API

- `GET /api/laporan/dapur/proses-order?from=&to=&outlet=`
- `GET /api/laporan/dapur/proses-produk?from=&to=&outlet=`
