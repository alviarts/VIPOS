# Phase 3: Android Kasir MVP

> Build VIPOS Mobile Android app — POS core + offline-first + hardware integration + payment + push.
> Goal: kasir di outlet bisa pakai tablet 10" untuk transaksi penuh, bahkan offline 7 hari, dengan thermal printer + barcode scanner.

**Estimasi total**: 12-14 minggu (22 tasks, banyak paralel setelah bootstrap done)

## Tech stack

- **Bahasa**: Kotlin
- **UI**: Jetpack Compose + Material 3
- **DI**: Hilt
- **DB lokal**: Room
- **Network**: Retrofit + OkHttp + Moshi (atau Kotlinx Serialization)
- **Sync**: WorkManager + custom outbox
- **Adaptive layout**: WindowSizeClass API
- **Hardware**: Bluetooth Classic (ESC/POS), Camera2 + ML Kit (barcode), USB Host (scanner HID), CashDrawer via printer
- **Push**: Firebase Cloud Messaging
- **Crash**: Firebase Crashlytics
- **Analytics**: Firebase Analytics
- **Min SDK**: 21 (Android 5.0) — match Majoo Lite spec
- **Target SDK**: 34 (Android 14)

## Tasks

---

### P3-01: Android project bootstrap  `[pending]`

**Goal**: Project Android baru di `apps/android/` dengan stack lengkap, modular Gradle, build config.

**Dependencies**: P0-01

**Outputs**:
- `apps/android/` dengan Gradle 8 + AGP 8.x + Kotlin 1.9+
- Modul: `:app`, `:core:designsystem`, `:core:network`, `:core:database`, `:core:common`
- Build flavors: `dev` (point ke localhost), `staging` (VPS), `prod` (vipos.id)
- Build types: `debug`, `release`
- Hilt setup
- Compose setup dengan Material 3
- Navigation (compose-navigation)
- Crashlytics + Analytics
- App icon + splash screen
- README.md untuk dev setup

**Acceptance criteria**:
- [ ] `./gradlew assembleDebug` build sukses
- [ ] App install di emulator + tablet, splash screen muncul, blank Compose screen "VIPOS"
- [ ] Hilt + Compose runtime terpasang
- [ ] CI: tambah workflow build Android di GitHub Actions (P0-02 extend)

**Branch**: `devin/P3-01-android-bootstrap`
**Estimasi**: 3-4 hari

---

### P3-02: Theme + design system + adaptive layout primitives  `[pending]`

**Goal**: Set up theme (color, typography, dimens), reusable component (Button, Card, Input, Dialog), WindowSizeClass utility.

**Dependencies**: P3-01

**Outputs**:
- `core/designsystem/` module dengan `VIPOSTheme.kt`, color palette (teal #04C99E primary), typography, shapes
- Reusable composable: `VIPOSButton`, `VIPOSTextField`, `VIPOSCard`, `VIPOSBottomSheet`, `VIPOSDialog`, `VIPOSEmptyState`, `VIPOSLoadingIndicator`
- `WindowSizeUtil.kt` dengan extension untuk detect Compact/Medium/Expanded
- Adaptive scaffold helper: `VIPOSAdaptiveScaffold(phoneContent, tabletContent)`
- Sample preview untuk semua composable (Compose Preview)

**Acceptance criteria**:
- [ ] Semua theme color/typo dari brand teal
- [ ] WindowSizeUtil return correct class di phone vs tablet
- [ ] Adaptive scaffold render beda di phone (bottom nav) vs tablet (navigation rail)
- [ ] Storybook-style sample app di-launch untuk preview

**Branch**: `devin/P3-02-design-system`
**Estimasi**: 3-4 hari

---

### P3-03: Auth flow (login, refresh, biometric)  `[pending]`

**Goal**: Login screen + JWT lifecycle + biometric unlock + employee PIN entry.

**Dependencies**: P3-01, P3-02, P1-02 (backend auth done)

**Outputs**:
- `feature-auth` module
- `LoginScreen.kt` (email + password + outlet picker)
- `OutletPickerScreen.kt` (kalau user punya > 1 outlet)
- `BiometricUnlockScreen.kt` (saat resume app)
- `EmployeePinEntryScreen.kt` (per-shift cashier PIN)
- `TokenStore` (DataStore encrypted)
- `AuthInterceptor` (auto-attach Bearer + 401 → refresh)
- `RefreshTokenManager` (background refresh sebelum expiry)

**Acceptance criteria**:
- [ ] Login berhasil → token tersimpan encrypted
- [ ] Token expiry → auto refresh tanpa user intervention
- [ ] Biometric prompt jika available, fallback ke password
- [ ] Employee PIN screen muncul saat shift dimulai
- [ ] Logout clear semua token + redirect ke login

**Reference**: `docs/v2/04_AUTH_AND_SESSION.md`

**Branch**: `devin/P3-03-auth-flow`
**Estimasi**: 4-5 hari

---

### P3-04: Local DB schema + migrations (Room)  `[pending]`

**Goal**: Room schema lengkap untuk semua entity yang perlu offline (Product, Category, Customer, Transaction, Stock, Outlet, Employee, Promo, Settings, Outbox).

**Dependencies**: P3-01

**Outputs**:
- `core/database/` module
- Entities: `ProductEntity`, `CategoryEntity`, `CustomerEntity`, `TransactionEntity`, `TransactionItemEntity`, `StockEntity`, `OutletEntity`, `EmployeeEntity`, `PromoEntity`, `SettingsEntity`, `OutboxEntity`
- DAOs untuk setiap entity
- Migrations strategy (Room AutoMigration + manual fallback)
- Type converters (Date, JSON)
- Schema export ke `apps/android/schemas/` untuk version control

**Acceptance criteria**:
- [ ] Database created di first run
- [ ] Insert/query/update/delete tested untuk setiap entity
- [ ] Migration test (versi 1 → 2 dengan data preserved)
- [ ] Schema JSON exported di-commit ke repo

**Reference**: `docs/v2/02_DATA_MODELS.md`

**Branch**: `devin/P3-04-local-db`
**Estimasi**: 4-5 hari

---

### P3-05: Master data sync (initial pull)  `[pending]`

**Goal**: Saat first login, pull semua master data (products, categories, customers, settings, outlets, employees) ke local DB.

**Dependencies**: P3-03, P3-04

**Outputs**:
- `feature-sync` module
- `SyncWorker` (WorkManager periodic + on-demand)
- `MasterDataSyncUseCase` (pull endpoint paginated)
- Progress UI (loading screen dengan progress bar per entity)
- Resume support (kalau interrupt, lanjut dari last cursor)

**Acceptance criteria**:
- [ ] First login → "Syncing data..." progress muncul
- [ ] Semua master data tersimpan di Room
- [ ] Sync resume kalau network drop tengah jalan
- [ ] Subsequent login: incremental sync (delta sejak last sync)
- [ ] Periodic background sync setiap 15 menit

**Reference**: `docs/v2/09_OFFLINE_AND_SYNC.md`

**Branch**: `devin/P3-05-master-data-sync`
**Estimasi**: 5-6 hari

---

### P3-06: POS catalogue UI (grid, search, kategori filter)  `[pending]`

**Goal**: Layar utama kasir — grid produk dengan search, kategori filter, favorite.

**Dependencies**: P3-04, P3-05

**Outputs**:
- `feature-pos/CatalogueScreen.kt`
- `feature-pos/CatalogueViewModel.kt`
- Adaptive grid: phone 2 col, tablet 4 col, tablet landscape 6 col
- Search bar dengan debounce
- Kategori filter chip
- Favorite tab (top-selling auto + manual pin)
- Empty state, loading state

**Acceptance criteria**:
- [ ] Grid render 500 produk smooth (LazyVerticalGrid)
- [ ] Search filter realtime
- [ ] Kategori filter switch instant
- [ ] Tap produk → emit "addToCart" event
- [ ] Adaptive layout berfungsi

**Reference**: `docs/v2/menus/penjualan/pos_kasir.md`

**Branch**: `devin/P3-06-pos-catalogue`
**Estimasi**: 4-5 hari

---

### P3-07: POS cart UI + modifier sheet  `[pending]`

**Goal**: Cart panel dengan add/remove/quantity, modifier picker (varian + ekstra) lewat bottom sheet.

**Dependencies**: P3-06

**Outputs**:
- `feature-pos/CartPanel.kt` (right panel di tablet, bottom sheet di phone)
- `feature-pos/ModifierBottomSheet.kt`
- `feature-pos/CartViewModel.kt`
- `feature-pos/CartCalculator.kt` (subtotal, discount, tax, service charge, total)

**Acceptance criteria**:
- [ ] Tap produk dengan varian → modifier sheet muncul, pilih varian + tambahan
- [ ] Cart update real-time
- [ ] Quantity stepper (- 1 +)
- [ ] Remove item
- [ ] Edit catatan per item
- [ ] Tax/service charge auto-calculate sesuai outlet config
- [ ] Empty state (cart kosong)
- [ ] Adaptive: tablet = side panel, phone = bottom sheet expandable

**Reference**: `docs/v2/menus/penjualan/pos_kasir.md`, `docs/v2/12_TAX_AND_FEES.md`

**Branch**: `devin/P3-07-pos-cart`
**Estimasi**: 4-5 hari

---

### P3-08: POS checkout — payment method picker  `[pending]`

**Goal**: Layar bayar — pilih metode (cash, EDC, QRIS, e-wallet, deposit, voucher), input pembayaran, hitung kembalian.

**Dependencies**: P3-07

**Outputs**:
- `feature-pos/CheckoutScreen.kt`
- `feature-pos/PaymentMethodGrid.kt`
- `feature-pos/CashPaymentDialog.kt` (input nominal + suggest pecahan)
- `feature-pos/QRISPaymentDialog.kt` (display QR + polling status)
- `feature-pos/EDCPaymentDialog.kt`
- `feature-pos/SplitBillScreen.kt`

**Acceptance criteria**:
- [ ] Pilih metode pembayaran
- [ ] Cash: input nominal, suggest pecahan (Rp 50k, 100k, dst), hitung kembalian
- [ ] QRIS: generate QR dynamic (call backend), polling status sampai paid
- [ ] EDC: trigger ECR (P3-12) atau manual entry
- [ ] Split bill: bagi total ke beberapa metode
- [ ] Setelah paid → trigger transaction commit

**Reference**: `docs/v2/14_PAYMENT_METHODS.md`

**Branch**: `devin/P3-08-pos-checkout`
**Estimasi**: 6-7 hari

---

### P3-09: Outbox pattern + WorkManager sync  `[pending]`

**Goal**: Setiap mutation (transaction commit, void, refund, master data edit) ditulis ke `outbox` Room table dulu, di-drain oleh WorkManager saat online.

**Dependencies**: P3-04, P3-05

**Outputs**:
- `core/sync/OutboxManager.kt`
- `core/sync/OutboxWorker.kt`
- Conflict resolution strategy (last-write-wins default; idempotency key per entry)
- Retry dengan exponential backoff
- DLQ (kalau gagal > 5 kali, mark "failed", notify user)

**Acceptance criteria**:
- [ ] Transaksi offline → masuk outbox + immediately reflected di local DB
- [ ] Online → outbox di-drain, server confirm, local update
- [ ] Conflict (e.g. produk dihapus di server) → resolve via strategy + show toast
- [ ] DLQ entries muncul di "Sync Issues" screen untuk manual review

**Reference**: `docs/v2/09_OFFLINE_AND_SYNC.md`

**Branch**: `devin/P3-09-outbox-sync`
**Estimasi**: 5-7 hari

---

### P3-10: Bluetooth thermal printer integration  `[pending]`

**Goal**: Pair printer (BT Classic), drive ESC/POS, print test page, struk transaksi.

**Dependencies**: P3-08

**Outputs**:
- `core/hardware/printer/` module
- `BluetoothPrinterManager.kt` (scan, pair, connect, disconnect)
- `EscPosBuilder.kt` (helper untuk bangun byte stream: text, alignment, font, image, barcode, qrcode, line cut, cash drawer kick)
- `ReceiptRenderer.kt` (render Transaction → ESC/POS bytes 58mm/80mm)
- Settings screen: pilih printer, set paper width, test print

**Acceptance criteria**:
- [ ] Scan & pair printer thermal Indonesian populer (Bluestar, Munbyn, Xprinter, EPSON)
- [ ] Test print "VIPOS Test Print"
- [ ] Print struk asli dari transaksi sample
- [ ] 58mm + 80mm both tested
- [ ] Auto-cut + cash drawer kick
- [ ] Reconnect handling (drop → auto-reconnect on next print)
- [ ] Print queue (retry kalau printer offline)

**Reference**: `docs/v2/08_HARDWARE_INTEGRATION.md`, `docs/v2/11_RECEIPT_TEMPLATES.md`

**Branch**: `devin/P3-10-bt-printer`
**Estimasi**: 7-9 hari

---

### P3-11: Barcode scanner integration (Camera + USB HID)  `[pending]`

**Goal**: Scan barcode via camera (ML Kit) + USB HID scanner.

**Dependencies**: P3-06

**Outputs**:
- `core/hardware/scanner/` module
- `CameraScannerActivity.kt` dengan ML Kit BarcodeScanning
- `UsbHidScannerListener.kt` (listen keystroke dari HID device, parse buffer)
- Trigger di POS catalogue screen (icon scanner)
- Settings screen: pilih scanner mode

**Acceptance criteria**:
- [ ] Camera scan EAN13/EAN8/Code128/QR di < 0.5 detik
- [ ] USB HID scanner emit barcode ke search field
- [ ] Auto-add to cart kalau barcode match produk
- [ ] Suara beep saat scan success
- [ ] Vibration feedback

**Reference**: `docs/v2/08_HARDWARE_INTEGRATION.md`

**Branch**: `devin/P3-11-barcode-scanner`
**Estimasi**: 4-5 hari

---

### P3-12: EDC integration (BCA/Mandiri/BRI ECR)  `[pending]`

**Goal**: Integrate Electronic Cash Register (ECR) protocol untuk EDC bank populer.

**Dependencies**: P3-08, P3-10

**Outputs**:
- `core/hardware/edc/` module
- ECR protocol implementation (BCA pertama, lainnya optional)
- Cable/USB connection
- Trigger sale → ECR send transaction → wait for response → handle approve/decline

**Acceptance criteria**:
- [ ] BCA EDC connected via cable
- [ ] Send sale amount → EDC display amount → customer swipe/tap → approve/decline returned ke app
- [ ] Approval ID tersimpan di transaction record
- [ ] Decline handled gracefully (cashier bisa pilih method lain)

**Reference**: `docs/v2/08_HARDWARE_INTEGRATION.md`

**Branch**: `devin/P3-12-edc-integration`
**Estimasi**: 7-10 hari (test hardware butuh waktu)

---

### P3-13: Receipt rendering (58/80mm + email/WA)  `[pending]`

**Goal**: Render struk dari transaction → bytes ESC/POS untuk thermal, atau PDF untuk email/WA.

**Dependencies**: P3-10

**Outputs**:
- `core/receipt/` module
- `ThermalReceiptRenderer.kt` (58mm + 80mm)
- `PDFReceiptRenderer.kt` (A4 untuk invoice B2B + email)
- `EmailReceiptSender.kt` + `WhatsAppReceiptSender.kt` (lewat Intent share)
- Template configurable (header, footer, logo)

**Acceptance criteria**:
- [ ] Print struk thermal 58mm + 80mm sesuai template
- [ ] Generate PDF struk untuk email
- [ ] Share via WhatsApp Intent
- [ ] Logo + custom footer support

**Reference**: `docs/v2/11_RECEIPT_TEMPLATES.md`

**Branch**: `devin/P3-13-receipt-rendering`
**Estimasi**: 4-5 hari

---

### P3-14: Open shift / close shift  `[pending]`

**Goal**: Cashier shift workflow — buka shift (modal awal kas), tutup shift (rekonsiliasi cash, EDC, QRIS).

**Dependencies**: P3-08

**Outputs**:
- `feature-pos/OpenShiftScreen.kt`
- `feature-pos/CloseShiftScreen.kt`
- Shift state stored di Room
- Print laporan tutup shift

**Acceptance criteria**:
- [ ] Cashier login → buka shift dengan input modal kas awal
- [ ] Selama shift, semua transaksi linked ke shift_id
- [ ] Tutup shift: input fisik kas vs sistem, hitung selisih
- [ ] Print laporan: total transaksi, breakdown per metode, EDC settlement, QRIS settlement
- [ ] Selisih > Rp 10k = warning + butuh manager PIN

**Reference**: `docs/v2/menus/penjualan/tutup_toko.md`

**Branch**: `devin/P3-14-shift-management`
**Estimasi**: 4-5 hari

---

### P3-15: Promo + discount UI di POS  `[pending]`

**Goal**: Apply promo otomatis + manual coupon di cart.

**Dependencies**: P3-07, P3-09

**Outputs**:
- `feature-pos/PromoEngine.kt` (evaluate semua active promo, pilih yang applicable)
- `feature-pos/CouponInputDialog.kt`
- `feature-pos/AppliedPromoChip.kt` (visual chip di cart)

**Acceptance criteria**:
- [ ] Auto-promo apply saat kondisi terpenuhi (e.g. min purchase)
- [ ] Manual coupon: input code → validate → apply
- [ ] Conflict resolution (kalau 2 promo applicable, pilih yang paling menguntungkan customer)
- [ ] Visual feedback: discount line di cart
- [ ] Manager override: cashier minta manager PIN untuk apply discount manual

**Reference**: `docs/v2/13_PROMO_AND_LOYALTY.md`

**Branch**: `devin/P3-15-promo-discount`
**Estimasi**: 5-6 hari

---

### P3-16: Customer add/select + loyalty point  `[pending]`

**Goal**: Pilih customer di cart, earn point loyalty saat checkout.

**Dependencies**: P3-07

**Outputs**:
- `feature-pos/CustomerPickerSheet.kt` (search + add new)
- `feature-pos/QuickAddCustomerDialog.kt`
- Earn point logic di checkout
- Redeem point sebagai discount option

**Acceptance criteria**:
- [ ] Search customer by name/phone
- [ ] Quick add (nama + nomor) dari POS
- [ ] Earn point auto saat transaksi committed
- [ ] Redeem point: convert to discount sesuai rule
- [ ] Point balance visible di cart

**Reference**: `docs/v2/menus/penjualan/pelanggan.md`, `docs/v2/13_PROMO_AND_LOYALTY.md`

**Branch**: `devin/P3-16-customer-loyalty`
**Estimasi**: 3-4 hari

---

### P3-17: Multi-form layout polish (HP + Tablet)  `[pending]`

**Goal**: Final pass adaptive layout — POS optimal di tablet 10" landscape, monitoring functional di HP.

**Dependencies**: P3-06, P3-07, P3-08

**Outputs**:
- Layout audit untuk semua POS screens
- Phone mode: simplified POS (atau redirect ke "monitoring" home)
- Tablet portrait: 2 column
- Tablet landscape: 3 column (catalogue + cart + customer panel)

**Acceptance criteria**:
- [ ] Compose Preview render benar untuk 5 screen size
- [ ] Test di emulator: Pixel 4 (phone), Pixel Tablet (tablet), Pixel C (large tablet)
- [ ] Test di device fisik (kalau ada)
- [ ] Smooth orientation change (state preserved)

**Reference**: `docs/v2/menus/penjualan/pos_kasir.md` adaptive section

**Branch**: `devin/P3-17-adaptive-layout`
**Estimasi**: 4-5 hari

---

### P3-18: Push notification (FCM)  `[pending]`

**Goal**: Receive push untuk: order online, low stock, approval, system alert.

**Dependencies**: P3-03

**Outputs**:
- `core/push/` module
- Firebase Messaging Service
- Notification channel per kategori
- Deep link routing (tap notif → buka screen relevan)
- Topic subscription per outlet/role

**Acceptance criteria**:
- [ ] Receive notif saat app foreground/background/killed
- [ ] Tap notif buka screen yang sesuai
- [ ] Notification channel terpisah (order, stock, approval, system)
- [ ] Sound + vibration custom per channel
- [ ] Badge count update

**Reference**: `docs/v2/10_PUSH_AND_DEEPLINK.md`

**Branch**: `devin/P3-18-push-notification`
**Estimasi**: 3-4 hari

---

### P3-19: Quick search + favorites + recent  `[pending]`

**Goal**: Catalog quick search dengan voice + recent items + favorites pinning.

**Dependencies**: P3-06

**Outputs**:
- Voice search via Android speech-to-text
- Recent items (last 20)
- Pinned favorites (manual)
- Top sellers auto (last 7 days)

**Acceptance criteria**:
- [ ] Voice search dengan hasil < 1 detik
- [ ] Recent items section di catalog top
- [ ] Pin/unpin favorite via long-press
- [ ] Top seller auto-update daily

**Branch**: `devin/P3-19-quick-search`
**Estimasi**: 3 hari

---

### P3-20: Settings + outlet switcher  `[pending]`

**Goal**: Settings screen + outlet switcher (kalau cashier kerja di multi outlet).

**Dependencies**: P3-03

**Outputs**:
- `feature-settings/SettingsScreen.kt`
- Sub-screens: profile, printer, scanner, EDC, sound, language, sync status
- `feature-pos/OutletSwitcher.kt`

**Acceptance criteria**:
- [ ] Settings akses semua hardware config
- [ ] Outlet switcher tersedia kalau cashier multi-outlet
- [ ] Sync status visible (last sync, pending outbox)
- [ ] Reset DB (debug only)

**Branch**: `devin/P3-20-settings`
**Estimasi**: 3 hari

---

### P3-21: Crash reporting + analytics  `[pending]`

**Goal**: Crashlytics + Firebase Analytics integrated; track key user events.

**Dependencies**: P3-01

**Outputs**:
- Crashlytics SDK
- Custom events: login, transaction_commit, payment_method_used, sync_failed, dst
- Performance Monitoring untuk slow operation (> 500ms)

**Acceptance criteria**:
- [ ] Force-crash terkirim ke Crashlytics
- [ ] Key events tracked (test di Firebase console)
- [ ] User properties: tenant_id, role, tier, app_version

**Branch**: `devin/P3-21-crash-analytics`
**Estimasi**: 2 hari

---

### P3-22: Beta release + Play Store internal track  `[pending]`

**Goal**: Submit beta APK ke Play Store internal testing track. Onboard 5 beta merchant.

**Dependencies**: All previous P3 tasks

**Outputs**:
- Sign release APK (dengan keystore)
- Play Store listing (icon, screenshot, description, video)
- Internal testing track aktif
- Beta merchant onboarding doc
- Feedback collection (in-app form + Telegram group)

**Acceptance criteria**:
- [ ] APK signed dan upload ke internal testing
- [ ] 5 beta merchant terdaftar dan punya akses
- [ ] In-app feedback form berfungsi
- [ ] Telegram beta group aktif

**Branch**: `devin/P3-22-beta-release`
**Estimasi**: 5-7 hari

---

## Definition of Done — Phase 3

- [ ] Cashier bisa buka shift, transaksi (cash + EDC + QRIS), tutup shift di tablet
- [ ] Offline 24-72 jam berfungsi, sync saat online
- [ ] Thermal printer + barcode scanner mulus
- [ ] Push notif untuk order online + approval bekerja
- [ ] 5 beta merchant pakai produktif > 1 minggu tanpa critical bug
- [ ] Crashlytics crash-free rate > 99%

Setelah Phase 3 done, VIPOS punya **MVP yang produksi-ready** untuk segmen merchant simple. Phase 4 menambahkan fitur advanced.
