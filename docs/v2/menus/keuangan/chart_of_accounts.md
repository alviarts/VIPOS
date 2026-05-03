# Daftar Akun (Chart of Accounts)

## §1 Daftar Akun

URL: `akunting/account-list`

Chart of Accounts (Bagan Akun).

Columns: Code, Name, Type (Aset/Kewajiban/Modal/Pendapatan/Beban), Sub-type, Parent, Is active, Balance.

Add form:
- Code (e.g. 1101)
- Name
- Type
- Sub-type (e.g. Aset Lancar / Aset Tetap)
- Parent account (FK, for hierarchy)
- Normal balance (Debit / Credit — auto from type)
- Description

Pre-seeded structure (Indonesian SAK ETAP-style):
```
1xxx Aset
  11xx Aset Lancar
    1101 Kas
    1102 Bank BCA
    1103 Bank Mandiri
    1110 Kas Kasir
    1201 Piutang Usaha
    1301 Persediaan Barang
  15xx Aset Tetap
    1501 Tanah
    1502 Bangunan
    1503 Kendaraan
    1504 Peralatan
    1505 Akumulasi Penyusutan Bangunan
2xxx Kewajiban
  21xx Kewajiban Lancar
    2101 Hutang Usaha
    2102 Hutang Pajak (PPN, PPh21)
    2103 Hutang Gaji
3xxx Modal
  3101 Modal Disetor
  3201 Laba Ditahan
4xxx Pendapatan
  4101 Penjualan
  4102 Pendapatan Lain
5xxx Beban
  5101 HPP
  5201 Beban Gaji
  5202 Beban Sewa
  ...
```

## §2 Jurnal Umum

URL: `jurnal-umum-penyesuaian`

Manual journal entries (adjustments).

Add form:
- Date
- Reference (auto)
- Description
- Lines (min 2):
  - Account
  - Debit / Credit
  - Amount
  - Description
- Total debit must equal total credit (validation)
- Attachment

Use cases:
- Year-end adjustments
- Bank charges
- Accrued expenses
- Prepaid amortization
- Inventory write-downs

Requires manager+ approval.

## §3 Saldo Awal

URL: `saldo-awal`

Set opening balances when migrating from another system.

Per account: enter opening balance.

App posts a single opening journal entry:
- Dr asset accounts (their opening balance)
- Cr liability accounts
- Cr equity accounts
- (with "Opening Balance Equity" balancer if needed)

Locked after first transaction in the period.

## §4 Mobile considerations

- Read-only viewing on phone.
- Manual journal entry on tablet (or web).
- Owner-only access.

## §5 API

- `GET/POST /api/v1/account` (CoA)
- `GET/POST /api/v1/manual-journal`
- `GET/POST /api/v1/opening-balance`

## §6 Open questions

- Custom CoA template per business type (F&B vs retail vs salon)? `[verified]` Majoo provides industry templates.
- Multi-currency CoA? `[unknown]`
- Department dimension on accounts (cost center reporting)? `[unknown]`
