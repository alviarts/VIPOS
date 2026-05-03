# Laporan Keuangan (Financial Reports)

> Standard accounting reports. All sourced from journal entries.

`[Prime]`

## §1 Laporan Jurnal

URL: `laporan-keuangan/accounting-jurnal`

All journal entries chronologically.

Columns: Date, Reference, Debit account, Credit account, Description, Amount, Source (POS sale, manual journal, payroll run, etc).

Filters: date range, account, source type, amount range.

Export: CSV, Excel.

## §2 Laporan Neraca (Balance Sheet)

URL: `laporan-keuangan/accounting-neraca`

Snapshot of Aset = Kewajiban + Modal.

Format (Indonesian standard):
```
ASET
  Aset Lancar
    Kas & Bank          xxx
    Piutang Usaha       xxx
    Persediaan          xxx
    Aset Lancar Lain    xxx
  Aset Tetap
    Tanah               xxx
    Bangunan            xxx
    Kendaraan           xxx
    Peralatan           xxx
    (-) Akm. Penyusutan (xxx)
  Aset Tidak Berwujud   xxx

KEWAJIBAN & MODAL
  Kewajiban Lancar
    Hutang Usaha        xxx
    Hutang Pajak        xxx
    Hutang BPJS         xxx
  Kewajiban Jk Panjang
    Hutang Bank         xxx
  Modal
    Modal Disetor       xxx
    Laba Ditahan        xxx
    Laba Tahun Berjalan xxx
```

Compare two periods side-by-side.

## §3 Laporan Laba Rugi (P&L)

URL: `laporan-keuangan/accounting-rugi-laba`

Period revenue - expenses = profit.

Format:
```
Pendapatan
  Penjualan Bersih      xxx
HPP                     (xxx)
Laba Kotor              xxx
Beban Operasional
  Beban Gaji            xxx
  Beban Sewa            xxx
  Beban Listrik         xxx
  ...
Laba Operasi            xxx
Pendapatan Lain         xxx
Beban Lain              (xxx)
Laba Sebelum Pajak      xxx
Pajak Penghasilan       (xxx)
Laba Bersih             xxx
```

Filter: period (month/quarter/year/custom), outlet (consolidated or per-outlet).

## §4 Laporan Buku Besar

URL: `laporan-keuangan/accounting-buku-besar`

Per-account ledger (general ledger).

Pick account → see all entries chronologically with running balance.

## §5 Laporan Arus Kas (Cash Flow)

URL: `laporan-keuangan/accounting-arus-kas`

Indirect method:
```
Arus Kas Operasi
  Laba Bersih           xxx
  Penyesuaian
    Penyusutan          xxx
    Δ Piutang           xxx
    Δ Persediaan        xxx
    Δ Hutang            xxx
  Kas dari Operasi      xxx

Arus Kas Investasi
  Pembelian Aset Tetap (xxx)
  Penjualan Aset Tetap  xxx

Arus Kas Pendanaan
  Setoran Modal         xxx
  Pengambilan           (xxx)
  Pinjaman Bank         xxx
  Cicilan Pinjaman      (xxx)

Δ Saldo Kas             xxx
Saldo Awal              xxx
Saldo Akhir             xxx
```

## §6 Laporan Hutang (AP — Accounts Payable)

URL: `laporan-keuangan/accounting-hutang`

Outstanding payables to vendors.

Columns: Vendor, Invoice #, Date, Due date, Amount, Paid, Outstanding, Aging (0-30, 31-60, 61-90, >90).

Drill-down: per-vendor history.

## §7 Laporan Piutang (AR — Accounts Receivable)

URL: `laporan-keuangan/accounting-piutang`

Outstanding receivables from customers.

Same as AP but inverse direction.

## §8 Mobile considerations

- All reports read-only on mobile.
- Phone: card-style summary.
- Tablet: full report tables.
- PDF/Excel export.
- Owner-only access.
- 5-year history; older archived.

## §9 API

- `GET /api/v1/accounting/journal?from=&to=&account=`
- `GET /api/v1/accounting/balance-sheet?as_of=`
- `GET /api/v1/accounting/income-statement?from=&to=`
- `GET /api/v1/accounting/general-ledger?account=&from=&to=`
- `GET /api/v1/accounting/cash-flow?from=&to=`
- `GET /api/v1/accounting/ap?as_of=`
- `GET /api/v1/accounting/ar?as_of=`

## §10 Closing the books

Periodically:
- Month-end close: lock journal, run depreciation, run accruals.
- Year-end close: roll P&L into Laba Ditahan, lock previous fiscal year.

## §11 Open questions

- Indonesian PSAK vs IFRS reporting? `[inferred]` PSAK (Pernyataan Standar Akuntansi Keuangan).
- Multi-currency with FX gain/loss? `[unknown]`
- Consolidated reports across multiple legal entities? `[unknown]`
