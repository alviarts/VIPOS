# Phase 1: Web Dashboard

> Polish `/vipos/` jadi Owner Dashboard penuh untuk semua 11 menu group.
> Goal: setiap Devin pasang 1 menu group di web. Setelah Phase 1 selesai, owner bisa kelola seluruh bisnis dari laptop.

**Estimasi total**: 8-10 minggu (18 tasks, banyak paralel setelah P1-01 + P1-02)

## Tasks

---

### P1-01: Layout shell `[done]`

> PR: [#13](https://github.com/alviarts/VIPOS/pull/13) (merged 2026-05-03), session: https://app.devin.ai/sessions/8546e9f2afa1429f8a23153a782e872a

**Goal**: Layout dasar — sidebar + header + breadcrumb + outlet switcher + role-based menu visibility.

**Dependencies**: P0-04 (API contract), P0-05 (testing)

**Outputs**:

- `apps/web/src/components/layout/AppShell.jsx`
- `apps/web/src/components/layout/Sidebar.jsx` (collapsible, role-aware)
- `apps/web/src/components/layout/Header.jsx` (logo, search, profile, notif badge)
- `apps/web/src/components/layout/OutletSwitcher.jsx`
- `apps/web/src/contexts/OutletContext.jsx`
- `apps/web/src/contexts/PermissionContext.jsx` (role + tier feature flag)

**Acceptance criteria**:

- [ ] Sidebar punya 11 menu group (Penjualan, Order Online, Appointment, Karyawan, Keuangan, Pengaturan, Lainnya, Bantuan, LAYANAN, INSPIRASI, Capital, SUPPLIES)
- [ ] Sidebar collapsible (icon-only mode)
- [ ] Outlet switcher di header berfungsi (mock 2 outlet)
- [ ] Role-based: kasir tidak lihat menu Keuangan, dst (gunakan permission matrix `docs/v2/05_PERMISSIONS.md`)
- [ ] Tier-based: Lite tier tidak lihat fitur Prime+ (gunakan `docs/v2/06_FEATURE_TIERS.md`)
- [ ] Breadcrumb auto-update per route
- [ ] Notification badge di header (mock count)
- [ ] Mobile-responsive (sidebar jadi drawer di < 768px)

**Reference**:

- `docs/v2/05_PERMISSIONS.md`
- `docs/v2/06_FEATURE_TIERS.md`
- `docs/v2/menus/*/  _README.md` (untuk struktur menu)

**Branch**: `devin/P1-01-layout-shell`
**Estimasi**: 3-4 hari

---

### P1-02: Auth flow refinement `[done]`

> PR: [#14](https://github.com/alviarts/VIPOS/pull/14) (merged 2026-05-03), session: https://app.devin.ai/sessions/8546e9f2afa1429f8a23153a782e872a

**Goal**: Login + logout + token refresh + remember me + reset password + change password + 2FA setup. Replace existing simple login dengan flow lengkap.

**Dependencies**: P0-04

**Outputs**:

- `apps/web/src/pages/auth/LoginPage.jsx` (refresh)
- `apps/web/src/pages/auth/ForgotPasswordPage.jsx`
- `apps/web/src/pages/auth/ResetPasswordPage.jsx`
- `apps/web/src/pages/auth/ChangePasswordPage.jsx`
- `apps/web/src/pages/auth/Setup2FAPage.jsx`
- `apps/web/src/api/auth.js` (axios interceptor untuk refresh token)
- Backend: tambah endpoint `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `/auth/2fa/setup`, `/auth/2fa/verify`
- Email/SMS sender via SendGrid/Nexmo (atau mock di dev)

**Acceptance criteria**:

- [ ] Login pakai email + password (atau username), JWT issued
- [ ] Token expiry 15 min, refresh token 30 hari
- [ ] Auto-refresh token via axios interceptor
- [ ] Forgot password kirim email reset link
- [ ] Reset password via link valid 24 jam
- [ ] Change password butuh password lama
- [ ] 2FA setup via TOTP (Google Authenticator)
- [ ] Logout invalidate refresh token

**Reference**: `docs/v2/04_AUTH_AND_SESSION.md`

**Branch**: `devin/P1-02-auth-flow`
**Estimasi**: 3-4 hari

---

### P1-03: Dashboard (POS Dashboard) page `[done]`

> PR: [#16](https://github.com/alviarts/VIPOS/pull/16) (merged 2026-05-03), session: https://app.devin.ai/sessions/8546e9f2afa1429f8a23153a782e872a

**Goal**: Halaman Dashboard utama di Penjualan group — KPI cards, charts, quick actions.

**Dependencies**: P1-01

**Outputs**:

- `apps/web/src/pages/penjualan/DashboardPage.jsx`
- `apps/web/src/components/charts/RevenueChart.jsx`
- `apps/web/src/components/charts/TopProductChart.jsx`
- Backend: endpoint `/api/v1/dashboard/summary`, `/api/v1/dashboard/sales-trend`, `/api/v1/dashboard/top-products`

**Acceptance criteria**:

- [ ] KPI cards: pendapatan today/MTD, transaksi count, avg ticket, item terjual
- [ ] Chart pendapatan 30 hari terakhir (Recharts)
- [ ] Chart top 10 produk
- [ ] Quick action tiles: New Sale, Add Product, View Reports
- [ ] Outlet filter (kalau owner punya > 1 outlet, tampilkan filter)
- [ ] Date range picker
- [ ] Loading skeleton state
- [ ] Empty state kalau no data

**Reference**: `docs/v2/menus/penjualan/pos_dashboard.md`

**Branch**: `devin/P1-03-dashboard-page`
**Estimasi**: 2-3 hari

---

### P1-04: Produk Master + 5-tab wizard `[done]`

> PR: [#18](https://github.com/alviarts/VIPOS/pull/18) (merged 2026-05-03), session: https://app.devin.ai/sessions/8546e9f2afa1429f8a23153a782e872a

**Goal**: Halaman Produk + form Tambah/Edit Produk dengan 5 tab (Detail / Kategori / Stok / Varian / Resep). Saat ini sudah ada di PR #1 tapi tab Varian/Resep/Order locked — buka.

**Dependencies**: P1-01

**Outputs**:

- `apps/web/src/pages/penjualan/ProductsPage.jsx` (refresh)
- `apps/web/src/components/products/ProductForm/{TabDetail,TabCategory,TabStock,TabVariant,TabRecipe,TabMajooOrder}.jsx`
- Backend: endpoint `/api/v1/product-variant`, `/api/v1/product-recipe`, `/api/v1/product-online`
- DB schema: tabel `product_variants`, `product_recipe_items`

**Acceptance criteria**:

- [ ] List produk dengan filter (kategori, status, search), pagination
- [ ] Tambah produk wizard 5 tab semua working
- [ ] Tab Varian: tambah opsi (Ukuran/Warna/dll) + price modifier per opsi
- [ ] Tab Resep: pilih bahan baku + qty per produksi 1 unit
- [ ] Tab majoo Order: harga online (markup), aktif/non-aktif di e-menu
- [ ] Edit + Delete produk
- [ ] Bulk import CSV (placeholder, full di P1-15)
- [ ] Image upload (max 4 foto, drag-reorder)
- [ ] Validation per field (Zod schema)

**Reference**: `docs/v2/menus/penjualan/produk_master.md`

**Branch**: `devin/P1-04-products-page`
**Estimasi**: 4-5 hari

---

### P1-05: Kategori + Departemen master `[done]`

> PR: [#20](https://github.com/alviarts/VIPOS/pull/20) (merged 2026-05-03), session: https://app.devin.ai/sessions/87cd360ce1084f07897d809585523a61

**Goal**: Halaman Kategori (existing) + Departemen master (group of category). Drag-reorder.

**Dependencies**: P1-01

**Outputs**:

- `apps/web/src/pages/penjualan/CategoriesPage.jsx` (refresh, sudah ada)
- `apps/web/src/pages/penjualan/DepartmentsPage.jsx` (baru)
- Backend: tambah endpoint untuk reorder

**Acceptance criteria**:

- [x] List kategori per departemen
- [x] CRUD kategori (already sebagian di PR #1, lengkapi)
- [x] CRUD departemen
- [x] Drag-reorder kategori dalam departemen + cross-dept move
- [x] Image/icon + warna per kategori

**Reference**: `docs/v2/menus/penjualan/produk_master.md` (section kategori)

**Branch**: `devin/P1-05-categories-departments`
**Estimasi**: 1-2 hari

---

### P1-06: Pelanggan (Customer) + grouping + tag `[done]`

> PR: [#21](https://github.com/alviarts/VIPOS/pull/21) (merged 2026-05-03), session: https://app.devin.ai/sessions/87cd360ce1084f07897d809585523a61

**Goal**: Halaman Pelanggan dengan list + form + grouping + tag + import.

**Dependencies**: P1-01

**Outputs**:

- `apps/web/src/pages/penjualan/CustomersPage.jsx` (refresh)
- `apps/web/src/pages/penjualan/CustomerDetailPage.jsx`
- `apps/web/src/components/customers/CustomerForm.jsx`
- `apps/web/src/components/customers/CustomerImportDialog.jsx`
- Backend: tambah `customer_groups`, `customer_tags`

**Acceptance criteria**:

- [x] List pelanggan dengan filter (group, tag, status), search by nama/phone/email
- [x] CRUD pelanggan (already sebagian, lengkapi)
- [x] Group pelanggan (Member, VIP, Reseller)
- [x] Tag pelanggan (multi-tag)
- [x] Detail page: history transaksi, total spent, point loyalty, deposit balance
- [x] Import CSV (mapping kolom)
- [x] Export CSV

**Reference**: `docs/v2/menus/penjualan/pelanggan.md`

**Branch**: `devin/P1-06-customers-page`
**Estimasi**: 3-4 hari

---

### P1-07: Inventory (Daftar Stok + opname + mutasi) `[done]`

> PR: [#22](https://github.com/alviarts/VIPOS/pull/22) (merged 2026-05-03), session: https://app.devin.ai/sessions/87cd360ce1084f07897d809585523a61
>
> Hotfix DB migration order: PR [#23](https://github.com/alviarts/VIPOS/pull/23) (merged 2026-05-03)

**Goal**: Halaman Inventory: daftar stok per outlet + stok opname + mutasi antar outlet.

**Dependencies**: P1-01, P1-04

**Outputs**:

- `apps/web/src/pages/penjualan/InventoryPage.jsx` (refresh)
- `apps/web/src/pages/penjualan/StockOpnamePage.jsx`
- `apps/web/src/pages/penjualan/StockMutationPage.jsx`
- `apps/web/src/components/inventory/StockMovementDialog.jsx`
- Backend: `/api/v1/stock-opname`, `/api/v1/stock-mutation`

**Acceptance criteria**:

- [x] Daftar stok per outlet (qty, reorder point, last in/out)
- [x] Stock opname: input fisik vs sistem, hitung selisih, posting jurnal
- [-] ~~Stock mutation: kirim dari outlet A ke outlet B~~ — **deferred** ke phase outlet management (multi-outlet model belum ada di MVP single-outlet)
- [x] Filter rendah stok (qty < reorder point)
- [x] Pencarian by SKU/name/barcode
- [x] Stock movement history per produk
- [x] Bonus: COGS weighted-average pada stok_in dengan unit_cost
- [x] Bonus: reason taxonomy pada stok_out (damaged/expired/shrinkage/...)

**Reference**: `docs/v2/menus/penjualan/inventori_flows.md`, `docs/v2/15_INVENTORY_FLOWS.md`

**Branch**: `devin/P1-07-inventory-page`
**Estimasi**: 4-5 hari

---

### P1-08: Promo + Kupon + Loyalty `[done]`

**Goal**: Halaman Promo dengan 8 jenis (diskon flat, persentase, BXGY, bundle, dst) + Kupon + Poin Loyalty.

**Dependencies**: P1-01, P1-04

**Outputs**:

- `apps/web/src/pages/penjualan/PromosPage.jsx`
- `apps/web/src/pages/penjualan/CouponsPage.jsx`
- `apps/web/src/pages/penjualan/LoyaltyPage.jsx`
- `apps/web/src/components/promo/PromoBuilder.jsx`
- Backend: `/api/promo`, `/api/coupon`, `/api/loyalty-rule`, `/api/loyalty/transactions`, `/api/loyalty/adjust`

**Acceptance criteria**:

- [x] Builder promo support 8 jenis (lihat reference)
- [x] Kondisi: time, day of week, customer group, min purchase, product/category
- [x] Bulk generate kupon (random/custom code)
- [x] Kupon validate at checkout
- [x] Loyalty: earn rate (Rp X = 1 point), redeem rate (1 point = Rp Y), expiry
- [x] Tier customer (Bronze/Silver/Gold) dengan benefit berbeda

**Reference**: `docs/v2/menus/penjualan/promo_kupon.md`, `docs/v2/13_PROMO_AND_LOYALTY.md`

**Branch**: `devin/P1-08-promo-coupon-loyalty`
**Estimasi**: 5-7 hari

**PR**: [#25](https://github.com/alviarts/VIPOS/pull/25) (merged 2026-05-03), session: https://app.devin.ai/sessions/34d9c20054044336bdbcd099e7581d90

---

### P1-09: Komisi `[done]`

**Goal**: Halaman Komisi: setup grup komisi (fixed % atau tiered) + tag per transaksi.

**Dependencies**: P1-01, P1-04

**Outputs**:

- `apps/web/src/pages/CommissionsPage.jsx`
- `apps/web/src/components/commissions/CommissionGroupForm.jsx`
- Backend: `/api/commission-group`, `/api/commission-assignment`, `/api/commission-report`

**Acceptance criteria**:

- [x] Grup komisi: fixed % atau tiered (per range qty/nominal)
- [x] Assign produk → grup komisi
- [x] Per transaksi tag karyawan yang dapat komisi
- [x] Report komisi per karyawan per period

**Reference**: `docs/v2/menus/penjualan/komisi.md`

**Branch**: `devin/P1-09-commissions`
**Estimasi**: 2-3 hari

**PR**: [#26](https://github.com/alviarts/VIPOS/pull/26) (merged 2026-05-03), session: https://app.devin.ai/sessions/34d9c20054044336bdbcd099e7581d90

---

### P1-10: Invoice B2B (5-stage flow) `[done]`

**Goal**: Halaman Invoice B2B: Quotation → Sales Order → Delivery Order → Invoice → Receipt.

**Dependencies**: P1-01, P1-04, P1-06

**Outputs**:

- `apps/web/src/pages/QuotationsPage.jsx`
- `apps/web/src/pages/SalesOrdersPage.jsx`
- `apps/web/src/pages/DeliveryOrdersPage.jsx`
- `apps/web/src/pages/InvoicesPage.jsx`
- `apps/web/src/pages/ReceiptsPage.jsx`
- `apps/web/src/pages/AgingReportPage.jsx`
- `apps/web/src/components/b2b/B2BDocumentBuilder.jsx` (form modal reusable)
- Backend: `/api/quotation`, `/api/sales-order`, `/api/delivery-order`, `/api/invoice`, `/api/receipt`, `/api/aging-report`

**Acceptance criteria**:

- [x] Buat Quotation → convert ke SO
- [x] SO → DO (partial allowed) → Invoice (partial allowed) → Receipt
- [x] Status flow per stage: DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED (Quotation), NEW/PARTIAL/FULFILLED/CANCELLED (SO), PREPARING/IN_TRANSIT/DELIVERED/RETURNED (DO), ISSUED/PARTIAL/PAID/OVERDUE/VOID (Invoice)
- [unknown] Email/WA send PDF — deferred (no email/WA integration yet)
- [x] Track outstanding amount (down_payment + paid_amount + auto-recalc)
- [x] Aging report (0-30 / 31-60 / 61-90 / >90 buckets + CSV export)
- [x] DO `DELIVERED` posts inventory_movements (stok_out) + decrements product stock
- [x] Soft-void invoice yang sudah punya receipt; hard-delete kalau belum

**Reference**: `docs/v2/menus/penjualan/invoice_b2b.md`

**Branch**: `devin/P1-10-invoice-b2b`
**Estimasi**: 5-6 hari
**Implementation note**: Pages live di `apps/web/src/pages/` (top-level), bukan subfolder `penjualan/`, mengikuti konvensi P1-01..09. Receipt PDF + email/WA dijadikan stretch goal — backend siap (number generator + audit trail) tapi UI/integration belum ada.

**PR**: [#27](https://github.com/alviarts/VIPOS/pull/27) (merged 2026-05-03), session: https://app.devin.ai/sessions/34d9c20054044336bdbcd099e7581d90

---

### P1-11: Marketing (WA Blast + SMS + Email + IG) `[pending]`

**Goal**: Halaman Marketing: WA Blast, SMS Broadcast, Email Blast, IG Feed scheduler.

**Dependencies**: P1-01, P1-06

**Outputs**:

- `apps/web/src/pages/penjualan/MarketingPage.jsx`
- `apps/web/src/components/marketing/CampaignBuilder.jsx`
- Backend: `/api/v1/campaign`, integrasi WhatsApp Business API, SMS gateway, SendGrid

**Acceptance criteria**:

- [ ] Pilih channel (WA/SMS/Email/IG)
- [ ] Pilih audience (semua pelanggan, group, tag, custom segment)
- [ ] Template message dengan variable substitution ({{nama}}, {{outlet}}, dll)
- [ ] Schedule: kirim sekarang / nanti
- [ ] Track delivered/opened/clicked
- [ ] Cost tracking (per WA/SMS rate)

**Reference**: `docs/v2/menus/penjualan/marketing.md`

**Branch**: `devin/P1-11-marketing`
**Estimasi**: 4-5 hari

---

### P1-12: Order Online + Marketplace + Consumer App config `[pending]`

**Goal**: Halaman Order Online: pesanan masuk, majoo Order config, marketplace integration, consumer app config.

**Dependencies**: P1-01, P1-04

**Outputs**:

- `apps/web/src/pages/order_online/OrdersPage.jsx`
- `apps/web/src/pages/order_online/MajooOrderPage.jsx` (storefront config)
- `apps/web/src/pages/order_online/MarketplacePage.jsx` (GoFood/GrabFood/Shopee oauth)
- `apps/web/src/pages/order_online/ConsumerAppPage.jsx`
- Backend: `/api/v1/online-order`, `/api/v1/marketplace/{provider}`

**Acceptance criteria**:

- [ ] Queue pesanan online (NEW → PREPARING → READY → COMPLETED)
- [ ] Storefront config: domain custom, branding, payment methods, delivery zone, ongkir
- [ ] Marketplace OAuth flow per provider
- [ ] Sync produk ke marketplace (price markup)
- [ ] Order webhook handler
- [ ] Settlement report

**Reference**: `docs/v2/menus/order_online/*.md`

**Branch**: `devin/P1-12-order-online`
**Estimasi**: 6-8 hari

---

### P1-13: Appointment / Reservasi `[pending]`

**Goal**: Halaman Appointment: list, calendar view, add/edit form.

**Dependencies**: P1-01, P1-04, P1-06

**Outputs**:

- `apps/web/src/pages/appointment/AppointmentListPage.jsx`
- `apps/web/src/pages/appointment/CalendarPage.jsx`
- `apps/web/src/components/appointment/AppointmentForm.jsx`
- Backend: `/api/v1/appointment`

**Acceptance criteria**:

- [ ] List view dengan filter (status, staff, tanggal)
- [ ] Calendar view (day/week/month) dengan drag-reschedule
- [ ] Form: customer, staff, services (multi), waktu, durasi
- [ ] Reminder via WA/SMS otomatis
- [ ] Convert appointment → transaction

**Reference**: `docs/v2/menus/appointment/*.md`

**Branch**: `devin/P1-13-appointment`
**Estimasi**: 4-5 hari

---

### P1-14: Karyawan + Payroll + Absensi `[pending]`

**Goal**: Halaman Karyawan: master data, payroll, hak akses, absensi, jadwal.

**Dependencies**: P1-01, P1-02

**Outputs**:

- `apps/web/src/pages/karyawan/EmployeesPage.jsx`
- `apps/web/src/pages/karyawan/PayrollPage.jsx`
- `apps/web/src/pages/karyawan/PermissionsPage.jsx`
- `apps/web/src/pages/karyawan/AttendancePage.jsx`
- `apps/web/src/pages/karyawan/SchedulePage.jsx`
- `apps/web/src/pages/karyawan/ApprovalWorkflowPage.jsx`
- Backend: `/api/v1/employee`, `/api/v1/payroll`, `/api/v1/attendance`, `/api/v1/schedule`

**Acceptance criteria**:

- [ ] Master karyawan: form lengkap (KTP, NPWP, dst), dokumen, foto
- [ ] Payroll: setup struktur, hitung otomatis, generate payslip, bank transfer file
- [ ] Permissions: assign role + per-employee override
- [ ] Attendance: lihat log, manual entry, geofence config
- [ ] Schedule: shift template, assign per karyawan, swap workflow
- [ ] Approval workflow: setup chain (purchase, finance) Prime+ only

**Reference**: `docs/v2/menus/karyawan/*.md`

**Branch**: `devin/P1-14-karyawan`
**Estimasi**: 7-9 hari

---

### P1-15: Keuangan (Buku Kas + Penerimaan + Pengeluaran + Aset + Laporan) `[pending]`

**Goal**: Halaman Keuangan lengkap.

**Dependencies**: P1-01, P1-02

**Outputs**:

- `apps/web/src/pages/keuangan/CashBookPage.jsx`
- `apps/web/src/pages/keuangan/IncomePage.jsx`
- `apps/web/src/pages/keuangan/ExpensesPage.jsx`
- `apps/web/src/pages/keuangan/FixedAssetsPage.jsx`
- `apps/web/src/pages/keuangan/FinancialReportsPage.jsx` (jurnal, neraca, laba-rugi, buku besar, arus kas, hutang, piutang)
- `apps/web/src/pages/keuangan/ChartOfAccountsPage.jsx`
- Backend: `/api/v1/cash-account`, `/api/v1/income`, `/api/v1/expense`, `/api/v1/fixed-asset`, `/api/v1/journal`, `/api/v1/account`

**Acceptance criteria**:

- [ ] Buku kas: list + transfer + ledger per akun
- [ ] Penerimaan: manual + reconciliation POS sales
- [ ] Pengeluaran: list + kategori biaya + recurring bill + vendor master
- [ ] Aset Tetap: list + depresiasi + disposal + report
- [ ] Laporan: 7 jenis (jurnal, neraca, laba-rugi, buku besar, arus kas, hutang, piutang)
- [ ] Chart of Accounts + jurnal umum + saldo awal

**Reference**: `docs/v2/menus/keuangan/*.md`

**Branch**: `devin/P1-15-keuangan`
**Estimasi**: 8-10 hari

---

### P1-16: Pengaturan (Settings) `[pending]`

**Goal**: Halaman Pengaturan lengkap.

**Dependencies**: P1-01, P1-02

**Outputs**:

- `apps/web/src/pages/pengaturan/AccountProfilePage.jsx`
- `apps/web/src/pages/pengaturan/OutletsPage.jsx` + `FloorPlanPage.jsx`
- `apps/web/src/pages/pengaturan/NotificationsPage.jsx`
- `apps/web/src/pages/pengaturan/SubscriptionPage.jsx`
- `apps/web/src/pages/pengaturan/PaymentSettingsPage.jsx` (struk, biaya, pajak, non-cash, satuan)
- `apps/web/src/pages/pengaturan/PrintSettingsPage.jsx`
- `apps/web/src/pages/pengaturan/CashierSettingsPage.jsx`
- `apps/web/src/pages/pengaturan/TerminalsPage.jsx`
- `apps/web/src/pages/pengaturan/SupportAccessPage.jsx`
- `apps/web/src/pages/pengaturan/ImportExportPage.jsx`

**Acceptance criteria**:

- [ ] Account profile: foto, nama, password, 2FA
- [ ] Outlet: CRUD, floor plan editor (drag table)
- [ ] Notifications: per-channel preference (push/WA/SMS/email)
- [ ] Subscription: lihat plan, upgrade, ticket support, klaim voucher
- [ ] Payment settings: receipt template, service charge, pajak (multi), non-cash methods, UOM
- [ ] Print: PDF templates
- [ ] Cashier: list cashier + kategori kas
- [ ] Terminal: list device + soundbox
- [ ] Support access: time-bounded grant
- [ ] Import/Export: bulk operation per entity

**Reference**: `docs/v2/menus/pengaturan/*.md`

**Branch**: `devin/P1-16-pengaturan`
**Estimasi**: 8-10 hari

---

### P1-17: Reports (Laporan) `[pending]`

**Goal**: Halaman Laporan: 30+ report dengan filter + export.

**Dependencies**: P1-01

**Outputs**:

- `apps/web/src/pages/reports/{various}.jsx` per kategori report
- `apps/web/src/components/reports/ReportTemplate.jsx` (reusable filter + table + export)
- Backend: `/api/v1/report/{report-name}`

**Acceptance criteria**:

- [ ] 30+ report sesuai catalog di `docs/v2/16_REPORTS_CATALOG.md`
- [ ] Setiap report: filter standard (date range, outlet, kategori), kolom configurable
- [ ] Export: CSV, Excel, PDF
- [ ] Schedule report (Prime+): auto-email per period

**Reference**: `docs/v2/16_REPORTS_CATALOG.md`, `docs/v2/menus/penjualan/kitchen_reports.md`, `docs/v2/menus/penjualan/tutup_toko.md`, `docs/v2/menus/penjualan/settlement.md`

**Branch**: `devin/P1-17-reports`
**Estimasi**: 8-10 hari

---

### P1-18: LAINNYA (Bantuan, LAYANAN, INSPIRASI, Capital, SUPPLIES) `[pending]`

**Goal**: Halaman ancillary group.

**Dependencies**: P1-01

**Outputs**:

- `apps/web/src/pages/lainnya/HelpPage.jsx`
- `apps/web/src/pages/lainnya/ServicesPage.jsx`
- `apps/web/src/pages/lainnya/InspirationPage.jsx`
- `apps/web/src/pages/lainnya/CapitalPage.jsx`
- `apps/web/src/pages/lainnya/SuppliesPage.jsx`

**Acceptance criteria**:

- [ ] Help: panduan + feedback form
- [ ] Services: Majoopay/QRIS, EDC, Satu Sehat, Aura placeholder
- [ ] Inspiration: blog (mock), event, magazine
- [ ] Capital: loan application form (placeholder, integrate later)
- [ ] Supplies: B2B procurement marketplace (placeholder)

**Reference**: `docs/v2/menus/lainnya/*.md`

**Branch**: `devin/P1-18-lainnya`
**Estimasi**: 4-5 hari

---

## Definition of Done — Phase 1

- [ ] Semua 11 menu group ada di web dashboard
- [ ] Auth lengkap (login, refresh, 2FA, password reset)
- [ ] Layout shell mature (responsive, role-aware)
- [ ] Owner bisa kelola seluruh bisnis dari laptop tanpa fitur missing critical

Setelah Phase 1 done, Phase 3 (Android Kasir) bisa start dengan confidence backend & data model sudah validated di web.
