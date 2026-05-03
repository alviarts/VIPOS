# Phase 4: Android Kasir Full Features

> Tambahkan fitur advanced ke Android Kasir: order online queue, reservation, inventory mutation, kitchen reports, employee module, settings.
> Goal: parity dengan Majoo Kasir Prime+ tier.

**Estimasi total**: 10-12 minggu (16 tasks, banyak paralel)

## Tasks

---

### P4-01: Order Online queue (in-app)  `[pending]`

**Goal**: Pesanan online masuk ke Android Kasir → list, accept/reject, status update, print struk dapur.

**Dependencies**: P3-09 (sync), P3-10 (printer), P3-18 (push), P1-12 (web order online done backend-side)

**Outputs**:
- `feature-online-order` module
- `OnlineOrderListScreen.kt` (filter: NEW, PREPARING, READY, COMPLETED)
- `OnlineOrderDetailScreen.kt`
- Audio notif saat pesanan baru
- Auto-print struk dapur

**Acceptance criteria**:
- [ ] Pesanan baru muncul real-time (FCM + polling fallback)
- [ ] Suara bell + vibration saat pesanan baru
- [ ] Accept → kirim status ke backend → auto-print struk dapur
- [ ] Reject dengan alasan
- [ ] Update status (READY → notify customer)

**Reference**: `docs/v2/menus/order_online/order_baru.md`

**Branch**: `devin/P4-01-online-order-queue`
**Estimasi**: 5-6 hari

---

### P4-02: Reservation / Appointment (kasir-side)  `[pending]`

**Goal**: Cashier lihat reservasi hari ini, check-in customer, convert ke transaksi.

**Dependencies**: P3-16 (customer), P1-13 (web appointment)

**Outputs**:
- `feature-reservation` module
- `ReservationListScreen.kt`
- Quick check-in flow
- Convert reservation → POS cart prefilled

**Acceptance criteria**:
- [ ] List reservasi hari ini
- [ ] Tap reservasi → detail + check-in button
- [ ] Check-in → create transaction with services prefilled
- [ ] Notes from reservation forwarded ke transaction

**Reference**: `docs/v2/menus/appointment/daftar.md`

**Branch**: `devin/P4-02-reservation-kasir`
**Estimasi**: 4-5 hari

---

### P4-03: Inventory mutation (cashier request)  `[pending]`

**Goal**: Cashier bisa request mutasi stok dari outlet lain (saat kehabisan), atau terima mutasi masuk.

**Dependencies**: P3-04, P3-05, P1-07

**Outputs**:
- `feature-inventory` module (mobile)
- `MutationListScreen.kt` (incoming + outgoing)
- `RequestMutationScreen.kt`
- `ReceiveMutationScreen.kt` (verify item + qty saat barang sampai)

**Acceptance criteria**:
- [ ] Cashier lihat list mutation incoming/outgoing
- [ ] Request mutation: pilih produk, qty, asal outlet
- [ ] Receive: scan barcode produk, input qty fisik vs qty dijanjikan, hitung selisih
- [ ] Sync ke backend, update stock kedua outlet

**Reference**: `docs/v2/menus/penjualan/inventori_flows.md`

**Branch**: `devin/P4-03-inventory-mutation-kasir`
**Estimasi**: 4-5 hari

---

### P4-04: Quick stock opname (mobile)  `[pending]`

**Goal**: Stock opname di mobile — scan barcode + input qty fisik per item.

**Dependencies**: P3-11 (scanner), P4-03

**Outputs**:
- `feature-inventory/StockOpnameScreen.kt`
- Bulk input mode (scan → qty input → next)

**Acceptance criteria**:
- [ ] Buka opname session
- [ ] Scan barcode → fokus ke item, input qty fisik
- [ ] Selesai → posting hasilnya, hitung selisih, jurnal otomatis

**Reference**: `docs/v2/15_INVENTORY_FLOWS.md`

**Branch**: `devin/P4-04-stock-opname-mobile`
**Estimasi**: 3-4 hari

---

### P4-05: Kitchen reports + transaction history (mobile)  `[pending]`

**Goal**: Kasir/owner di mobile lihat history transaksi + kitchen report (per item terjual, per kategori).

**Dependencies**: P3-09

**Outputs**:
- `feature-reports/TransactionHistoryScreen.kt`
- `feature-reports/KitchenReportScreen.kt`
- Filter by date, status, payment method, cashier

**Acceptance criteria**:
- [ ] List transaksi + filter
- [ ] Detail transaksi (items, payments, customer, refund)
- [ ] Kitchen report: total per produk, per kategori, per outlet
- [ ] Export PDF/share via WA

**Reference**: `docs/v2/menus/penjualan/kitchen_reports.md`, `docs/v2/16_REPORTS_CATALOG.md`

**Branch**: `devin/P4-05-history-kitchen-reports`
**Estimasi**: 4-5 hari

---

### P4-06: Karyawan absensi + payslip (mobile)  `[pending]`

**Goal**: Karyawan check-in/check-out via app dengan selfie + GPS, lihat payslip.

**Dependencies**: P3-03, P1-14 (backend payroll/attendance)

**Outputs**:
- `feature-karyawan/AttendanceScreen.kt`
- `feature-karyawan/PayslipScreen.kt`
- Camera selfie + GPS capture
- Geofence check (ada validasi outlet)

**Acceptance criteria**:
- [ ] Check-in/out dengan selfie + GPS
- [ ] Geofence validasi (radius 100m dari outlet)
- [ ] Lihat history attendance bulan ini
- [ ] Lihat payslip per period (PDF download)

**Reference**: `docs/v2/menus/karyawan/absensi.md`, `docs/v2/menus/karyawan/payroll.md`

**Branch**: `devin/P4-06-karyawan-mobile`
**Estimasi**: 5-6 hari

---

### P4-07: Owner dashboard (mobile)  `[pending]`

**Goal**: Owner login dari HP-nya → lihat KPI, alerts, top products, stok rendah, pesanan online pending.

**Dependencies**: P3-09, P1-03 (web dashboard backend)

**Outputs**:
- `feature-owner-dashboard/OwnerHomeScreen.kt`
- KPI cards, mini chart, alert list
- Multi-outlet roll-up (kalau owner > 1 outlet)

**Acceptance criteria**:
- [ ] Owner role login → masuk ke Owner Home (bukan POS)
- [ ] KPI today, MTD, YTD
- [ ] Alerts: stok rendah, transaksi mencurigakan, approval pending
- [ ] Quick action: lihat detail per outlet

**Reference**: `docs/v2/menus/penjualan/pos_dashboard.md`

**Branch**: `devin/P4-07-owner-dashboard-mobile`
**Estimasi**: 5-6 hari

---

### P4-08: Approval workflow (mobile, manager remote)  `[pending]`

**Goal**: Manager approve/reject void, refund, discount, purchase order via push notif.

**Dependencies**: P3-18, P1-14 (backend approval)

**Outputs**:
- `feature-approval/ApprovalListScreen.kt`
- `feature-approval/ApprovalDetailScreen.kt`
- Push deep link → langsung ke approval detail
- Swipe to approve/reject

**Acceptance criteria**:
- [ ] Push notif tap → buka approval detail
- [ ] Swipe approve/reject + alasan
- [ ] List pending approval
- [ ] History approval (with audit)

**Reference**: `docs/v2/menus/karyawan/approval_workflow.md`

**Branch**: `devin/P4-08-approval-mobile`
**Estimasi**: 4 hari

---

### P4-09: Multi-payment + tip + service charge polish  `[pending]`

**Goal**: Refine checkout — multi-payment per transaksi, tip, service charge non-cash, deposit/voucher pelanggan.

**Dependencies**: P3-08

**Outputs**:
- Refactor `CheckoutScreen.kt`
- Multi-payment editor: tambah pembayaran sampai total tercapai
- Tip input (untuk F&B)
- Deposit ledger checking + redeem
- Voucher merchant lookup

**Acceptance criteria**:
- [ ] 1 transaksi bisa pakai 3+ metode pembayaran
- [ ] Tip 5%/10%/custom dengan output ke karyawan tip pool
- [ ] Service charge auto sesuai outlet config
- [ ] Pelanggan punya deposit Rp 200k → bisa redeem
- [ ] Voucher value kupon di-validate

**Reference**: `docs/v2/14_PAYMENT_METHODS.md`

**Branch**: `devin/P4-09-multi-payment-polish`
**Estimasi**: 5-6 hari

---

### P4-10: Refund / Void / Reprint  `[pending]`

**Goal**: Cashier bisa void transaksi (manager approval), refund partial, reprint struk lama.

**Dependencies**: P3-09, P4-08

**Outputs**:
- `feature-pos/VoidTransactionDialog.kt`
- `feature-pos/RefundScreen.kt` (partial / full)
- `feature-pos/ReprintReceiptDialog.kt`

**Acceptance criteria**:
- [ ] Void: cari transaksi → request manager PIN → reverse stock + jurnal
- [ ] Refund partial: pilih item + qty → cash refund
- [ ] Reprint: cari transaksi → print ulang
- [ ] Audit log per action

**Reference**: `docs/v2/menus/pengaturan/notifikasi.md` (deleted-transaction notification)

**Branch**: `devin/P4-10-refund-void-reprint`
**Estimasi**: 5-6 hari

---

### P4-11: Offline mode resilience (long-term)  `[pending]`

**Goal**: App stabil offline > 7 hari. Conflict resolution mature.

**Dependencies**: P3-09, P3-04

**Outputs**:
- Outbox enhanced: per-entity conflict strategy
- "Sync Issues" screen di settings dengan retry/discard
- "Last sync" indicator di header
- Offline banner saat tidak ada koneksi

**Acceptance criteria**:
- [ ] Test scenario: 7 hari offline, ratusan transaksi → sync semua tanpa data loss
- [ ] Conflict (master data berubah di server) → user prompted, pilih strategy
- [ ] Sync Issues screen tampilkan failed entries dengan reason
- [ ] App tetap responsive offline (no UI freeze)

**Reference**: `docs/v2/09_OFFLINE_AND_SYNC.md`

**Branch**: `devin/P4-11-offline-resilience`
**Estimasi**: 6-8 hari

---

### P4-12: Customer Display second screen (Android-Android cast)  `[pending]`

**Goal**: Stream cart info ke second tablet/monitor sebagai customer-facing display via Bluetooth/Wi-Fi Direct atau MQTT.

**Dependencies**: P3-07 (cart)

**Outputs**:
- `feature-customer-display` module (di main app, optional)
- Discovery: detect VIPOS Customer Display app di network
- Stream cart events
- Settings to enable/disable

**Acceptance criteria**:
- [ ] Pair dengan tablet display
- [ ] Stream cart real-time (item, total, payment)
- [ ] Auto-disconnect kalau idle > 5 menit
- [ ] Reconnect on next transaction

**Reference**: `docs/v2/08_HARDWARE_INTEGRATION.md` (customer display section)

**Branch**: `devin/P4-12-customer-display-stream`
**Estimasi**: 5-7 hari

---

### P4-13: Localization (Indonesian + English)  `[pending]`

**Goal**: Semua string di-extract ke `strings.xml`, support ID + EN.

**Dependencies**: P3-22 (after beta release, polish)

**Outputs**:
- `strings.xml` (Indonesian default)
- `strings-en/strings.xml` (English)
- Locale switcher di Settings
- Date/time/currency localization

**Acceptance criteria**:
- [ ] Switch ke EN → semua text ter-translate
- [ ] Currency format pakai locale (Rp)
- [ ] Date format ID (dd/MM/yyyy) vs EN (MM/dd/yyyy)

**Branch**: `devin/P4-13-localization`
**Estimasi**: 3-4 hari

---

### P4-14: Performance optimization  `[pending]`

**Goal**: App startup < 2 detik, catalog scroll 60 FPS, transaction commit < 500ms (offline) / < 2 detik (online).

**Dependencies**: P3-22

**Outputs**:
- Baseline Profiles untuk startup
- Compose recomposition audit
- Database query optimization (index)
- Image loading: Coil dengan disk cache

**Acceptance criteria**:
- [ ] Cold start < 2 detik di tablet murah (Snapdragon 4xx, RAM 3GB)
- [ ] Catalog scroll 1000 produk smooth (no jank)
- [ ] Transaction commit perceived latency < 500ms

**Branch**: `devin/P4-14-performance`
**Estimasi**: 4-5 hari

---

### P4-15: A/B testing + feature flag  `[pending]`

**Goal**: Firebase Remote Config untuk feature flag dan A/B test.

**Dependencies**: P3-21

**Outputs**:
- Remote Config integration
- Feature flag wrappers di kode
- Sample experiment (e.g. cart UI variant A vs B)

**Acceptance criteria**:
- [ ] Feature flag control via Firebase console (no app update needed)
- [ ] A/B test sample berjalan, hasil terlihat di Firebase

**Branch**: `devin/P4-15-feature-flag`
**Estimasi**: 2-3 hari

---

### P4-16: Production release v1.0  `[pending]`

**Goal**: APK production di Play Store (closed/open testing → production).

**Dependencies**: All P4 tasks

**Outputs**:
- Signed release APK + AAB
- Play Store production listing (full screenshot suite, video, ASO keywords)
- In-app update flow (force update kalau breaking)
- Privacy policy + ToS published

**Acceptance criteria**:
- [ ] Production track aktif
- [ ] App scoring 4+ di test
- [ ] Crash-free rate > 99.5%
- [ ] In-app update tested

**Branch**: `devin/P4-16-production-release`
**Estimasi**: 5-7 hari

---

## Definition of Done — Phase 4

- [ ] Android Kasir punya fitur parity dengan Majoo Kasir Prime+
- [ ] Production-ready, di Play Store production
- [ ] 50+ merchant pakai produktif
- [ ] Crash-free rate > 99.5%

Setelah Phase 4, VIPOS Kasir = produk komersial yang bisa dipasarkan secara penuh.
