# Payroll — 6 Sub-Screens

> Indonesian payroll: gaji pokok + tunjangan + lembur + komisi + potongan PPh21 + BPJS Kesehatan + BPJS Ketenagakerjaan.

`[Prime]` for full payroll.

## §1 Pengaturan Payroll

URL: `payroll-menu/setting`

Global settings:
- Payroll period: monthly / bi-weekly / weekly
- Cut-off day (e.g. 25th)
- Payment day (e.g. 1st of next month)
- Default working hours per month (e.g. 173 hr)
- Overtime rate multiplier
- Tax method: gross-up / nett / progressive

## §2 Struktur Gaji

URL: `gaji/struktur-gaji`

Define salary structures (templates) that employees can be assigned to.

Structure:
- Basic salary (gaji pokok)
- Allowances (tunjangan):
  - Jabatan
  - Transport
  - Makan
  - Komunikasi
  - Lainnya
- Deductions (potongan):
  - BPJS Kesehatan (1% employee)
  - BPJS Ketenagakerjaan (4 categories: JHT 2%, JKK varies, JK 0.3%, JP 1%)
  - PPh 21 (computed)
  - Pinjaman (loans)
  - Lainnya
- Variable components:
  - Lembur rate (per hour overtime)
  - Komisi (linked to commission groups)
  - Insentif

Per employee: assign structure + override individual components.

## §3 Daftar Pemetaan Akun Gaji

URL: `gaji/list-mapping-payroll-account`

Map salary components to accounting accounts (chart of accounts).

E.g.:
- Gaji Pokok → "Beban Gaji" account 5101
- Tunjangan Makan → "Beban Tunjangan Makan" 5102
- BPJS deduction → "Hutang BPJS" 2105

When payroll runs, journal entries auto-post to these accounts.

## §4 Pembayaran Payroll

URL: `gaji/pembayaran-payroll`

Process payroll for the period.

Workflow:
1. Pick period (auto = current).
2. App pre-computes per employee: basic + allowances + overtime (from absensi) + komisi - deductions = nett.
3. Manager reviews.
4. Approve → posts journal entries + generates payslips.
5. Generate transfer file (CSV for bank batch payment) or pay one-by-one.
6. Mark as PAID after bank confirms.

Bulk payslip: generate PDFs, email to employees.

## §5 Laporan Pembayaran

URL: `gaji/laporan-pembayaran`

Historical payroll runs.

Columns:
- Period
- Employee count
- Gross total
- Deductions
- Nett paid
- Status (DRAFT / APPROVED / PAID)

Drill-down to individual payslips.

## §6 Rekonsiliasi Pembayaran

URL: `gaji/rekonsiliasi-pembayaran`

Reconcile actual bank transfers against payroll plan.

UI:
- List planned payments.
- For each: mark as TRANSFERRED + ref no.
- Variance highlights.

## §7 Mobile considerations

- Owner App: full payroll access.
- Employee App: view own payslips + history.
- Approvals: push notification to manager when payroll ready for approval.
- PDF payslip downloadable + WA/email sharable.

## §8 API

- `GET/POST /payroll/api/v1/setting`
- `GET/POST /payroll/api/v1/structure`
- `GET/POST /payroll/api/v1/run` (process period)
- `GET /payroll/api/v1/payslip/:id` (PDF)
- `POST /payroll/api/v1/run/:id/approve`
- `POST /payroll/api/v1/run/:id/pay`

## §9 Open questions

- e-SPT export for monthly tax filing? `[unknown]`
- BPJS Kesehatan and Ketenagakerjaan auto-debit integration? `[unknown]`
- THR (Tunjangan Hari Raya — Eid bonus) workflow? `[inferred]` likely separate run with multiplier.
