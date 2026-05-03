# Phase 5: Specialized Apps

> Build VIPOS KDS, VIPOS Self Order, VIPOS Customer Display sebagai APK terpisah.
> Goal: ekosistem lengkap untuk F&B mid-market.

**Estimasi total**: 6-8 minggu (11 tasks; ketiga app bisa paralel)

## Apps overview

### 1. VIPOS KDS (Kitchen Display System)

- Tablet di dapur menampilkan ticket pesanan
- Status flow: NEW → COOKING → READY → SERVED
- Bump bar (touch buttons) atau bluetooth bump
- Multi-station (drink, hot food, dessert)

### 2. VIPOS Self Order

- Tablet kiosk di meja, customer pilih menu sendiri
- QR code per meja (scan di HP customer juga support, mengarah ke web e-menu di Phase 1)
- Payment terminal terintegrasi (QRIS dynamic)

### 3. VIPOS Customer Display

- Second screen di samping kasir, customer-facing
- Display cart real-time, total, struk QR
- Promo banner saat idle

## Tasks

---

### P5-01: KDS — bootstrap project `[pending]`

**Goal**: Project Android baru (atau modul tambahan di monorepo) untuk VIPOS KDS.

**Dependencies**: P3-01 (design system reuse)

**Outputs**:

- `apps/android-kds/` separate Gradle module/project
- Reuse `core/designsystem`, `core/network`
- Tablet-only orientation (landscape)
- Always-on display flag
- Min SDK 21, target SDK 34

**Acceptance criteria**:

- [ ] App build & install di tablet
- [ ] Splash screen → blank "VIPOS KDS"
- [ ] Always-on (screen tidak sleep)

**Branch**: `devin/P5-01-kds-bootstrap`
**Estimasi**: 2 hari

---

### P5-02: KDS — login + station picker `[pending]`

**Goal**: Login pakai akun outlet + pilih station (drink, hot food, dst).

**Dependencies**: P5-01, P3-03 (auth API)

**Outputs**:

- Login screen + station picker
- TokenStore reuse pattern dari Kasir

**Acceptance criteria**:

- [ ] Login berhasil
- [ ] Station picker dengan opsi multi-select
- [ ] Persist station setting

**Branch**: `devin/P5-02-kds-login-station`
**Estimasi**: 2-3 hari

---

### P5-03: KDS — ticket grid + status flow `[pending]`

**Goal**: Grid ticket aktif, swipe untuk update status, bump bar buttons.

**Dependencies**: P5-02

**Outputs**:

- `KdsHomeScreen.kt` dengan grid 2-3 kolom
- Ticket card: order ID, table, items, time, station
- Status badge color: NEW (red), COOKING (yellow), READY (green)
- Bump button per ticket
- Audio alert saat ticket baru

**Acceptance criteria**:

- [ ] Real-time ticket muncul (FCM + polling)
- [ ] Bump = update status di backend
- [ ] Color visual jelas
- [ ] Auto-archive saat SERVED

**Reference**: `docs/v2/menus/penjualan/pos_kasir.md` (KDS section)

**Branch**: `devin/P5-03-kds-ticket-grid`
**Estimasi**: 5-6 hari

---

### P5-04: KDS — release `[pending]`

**Goal**: KDS APK ke Play Store internal → production.

**Dependencies**: P5-03

**Outputs**:

- Sign release APK
- Play Store listing terpisah
- Onboarding doc

**Acceptance criteria**:

- [ ] APK di Play Store
- [ ] 3 beta merchant restoran pakai

**Branch**: `devin/P5-04-kds-release`
**Estimasi**: 2-3 hari

---

### P5-05: Self Order — bootstrap `[pending]`

**Goal**: Project Android baru untuk Self Order kiosk.

**Dependencies**: P3-01

**Outputs**:

- `apps/android-self-order/`
- Reuse design system
- Kiosk mode setup (lock task)

**Acceptance criteria**:

- [ ] Build & install di tablet
- [ ] Kiosk mode aktif (user tidak bisa keluar app tanpa admin PIN)

**Branch**: `devin/P5-05-self-order-bootstrap`
**Estimasi**: 2-3 hari

---

### P5-06: Self Order — menu browse + cart + checkout `[pending]`

**Goal**: Customer-facing menu dengan UI besar, image-heavy, customizable.

**Dependencies**: P5-05, P3-09 (sync)

**Outputs**:

- `MenuScreen.kt` (kategori + grid produk besar)
- `ProductDetailSheet.kt` (foto + modifier picker)
- `CartReviewScreen.kt`
- `CheckoutScreen.kt` (QRIS payment)
- Idle timeout reset to home

**Acceptance criteria**:

- [ ] Menu render fast (cached image)
- [ ] Tap produk → modifier sheet
- [ ] Cart edit
- [ ] Pay via QRIS dynamic
- [ ] Receipt: print QR ke printer atau show on screen
- [ ] Idle 60 detik → reset ke home

**Reference**: `docs/v2/menus/order_online/*.md`

**Branch**: `devin/P5-06-self-order-menu`
**Estimasi**: 6-7 hari

---

### P5-07: Self Order — table picker + payment + ticket dispatch `[pending]`

**Goal**: Customer pilih meja saat checkout, payment via QRIS, ticket masuk ke KDS.

**Dependencies**: P5-06, P5-03 (KDS)

**Outputs**:

- `TablePickerScreen.kt`
- QRIS payment integration (sama dengan kasir)
- Trigger ticket dispatch ke KDS via backend webhook

**Acceptance criteria**:

- [ ] Customer pilih meja → masuk cart
- [ ] Pay QRIS → success → ticket muncul di KDS
- [ ] Customer terima struk via email (optional)

**Branch**: `devin/P5-07-self-order-table-payment`
**Estimasi**: 5-6 hari

---

### P5-08: Self Order — release `[pending]`

**Goal**: Self Order APK production.

**Dependencies**: P5-07

**Outputs**:

- Sign release APK
- Play Store listing (atau distribute via website kalau kios mode)
- Onboarding doc untuk merchant

**Acceptance criteria**:

- [ ] APK production
- [ ] 2 beta merchant restoran pakai

**Branch**: `devin/P5-08-self-order-release`
**Estimasi**: 2-3 hari

---

### P5-09: Customer Display — bootstrap `[pending]`

**Goal**: Project Android baru untuk Customer Display.

**Dependencies**: P3-01

**Outputs**:

- `apps/android-customer-display/`
- Lightweight (< 5 MB APK)

**Acceptance criteria**:

- [ ] Build & install di tablet/Android TV box

**Branch**: `devin/P5-09-customer-display-bootstrap`
**Estimasi**: 1-2 hari

---

### P5-10: Customer Display — cart sync + display `[pending]`

**Goal**: Pair dengan Kasir app, display cart real-time, total, struk QR.

**Dependencies**: P5-09, P4-12 (kasir-side stream)

**Outputs**:

- `CustomerDisplayScreen.kt`
- Pair via QR code (kasir generate, display scan) atau Wi-Fi Direct
- Idle banner with promo image (configurable)
- Receipt QR display

**Acceptance criteria**:

- [ ] Pair berhasil, kemudian persistent
- [ ] Cart update real-time (latency < 500ms)
- [ ] Idle: tampil promo banner
- [ ] Pasca payment: tampil struk QR (customer scan untuk download)

**Reference**: `docs/v2/08_HARDWARE_INTEGRATION.md`

**Branch**: `devin/P5-10-customer-display-sync`
**Estimasi**: 5-6 hari

---

### P5-11: Customer Display — release `[pending]`

**Goal**: Customer Display APK production.

**Dependencies**: P5-10

**Outputs**:

- Sign release APK
- Play Store listing

**Acceptance criteria**:

- [ ] APK production
- [ ] 2 beta merchant pakai

**Branch**: `devin/P5-11-customer-display-release`
**Estimasi**: 1-2 hari

---

## Definition of Done — Phase 5

- [ ] 3 specialized apps di Play Store production
- [ ] Setiap app paired dengan kasir Indonesia, bekerja end-to-end
- [ ] Beta merchant F&B pakai produk lengkap (Kasir + KDS + Self Order + Customer Display)

Setelah Phase 5, VIPOS = ekosistem POS lengkap untuk F&B mid-market.
