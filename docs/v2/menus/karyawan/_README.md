# KARYAWAN — Menu Group

> 31 menu items. Employee management, payroll, attendance, schedules, approvals.

`[Advance+]` for most; `[Prime]` for full payroll; `[Prime+]` for complex approval workflows.

## Inventory

### Pengaturan Karyawan
- Daftar Karyawan (`employee/employee-list`) → [`karyawan_master.md`](karyawan_master.md)

### Payroll
- Pengaturan Payroll (`payroll-menu/setting`)
- Struktur Gaji (`gaji/struktur-gaji`)
- Daftar Pemetaan Akun Gaji (`gaji/list-mapping-payroll-account`)
- Pembayaran Payroll (`gaji/pembayaran-payroll`)
- Laporan Pembayaran (`gaji/laporan-pembayaran`)
- Rekonsiliasi Pembayaran (`gaji/rekonsiliasi-pembayaran`)

→ [`payroll.md`](payroll.md)

### Hak Akses
- Daftar Hak Akses (`employee/privilege-list`)
- Pengaturan Hak Akses (`karyawan/hak-akses`)

→ [`hak_akses.md`](hak_akses.md)

### Absensi
- Akses Absensi (`employee/attendance-access`)
- Radius Absensi (`employee/attendance-radius`)

→ [`absensi.md`](absensi.md)

### majoo Teams
- Akses majoo Teams (`majoo-teams/access`)
- Kirim Notifikasi (`majoo-teams/send-notification`)

→ [`majoo_teams.md`](majoo_teams.md)

### Jadwal Kerja
- Daftar Shift (`work-schedule/master-shift-list`)
- Daftar Jadwal Kerja (`work-schedule/master-schedule-list`)
- Jadwal Kerja Karyawan (`work-schedule/employee-schedule`)

→ [`jadwal_kerja.md`](jadwal_kerja.md)

### Pengaturan Master
- Tingkat Jabatan (`master-setting/position-level`)
- Organisasi (`master-setting/organization`)
- Tipe Karyawan (`master-setting/employee-type`)

→ [`master_data.md`](master_data.md)

### Alur Kerja Persetujuan
- Persetujuan Pembelian (`approval-workflow/purchase`)
- Persetujuan Keuangan (`approval-workflow/finance`)

→ [`approval_workflow.md`](approval_workflow.md)

## Mobile considerations

- Owner App: full HR module access.
- Cashier App: limited (own attendance check-in only, view shift schedule).
- Employee App ("majoo Teams"): own profile, attendance, payroll slip, shift schedule.
- Geo-fenced check-in (radius absensi).
- Biometric / face-recognition for check-in (optional).
