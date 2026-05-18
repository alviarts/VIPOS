# POS / Kasir Screen

> **The most-used screen in the entire app.** Cashier spends 90 % of their time here. Must be: fast, offline-tolerant, error-resistant, hardware-aware.

## §1 Top-level layout (tablet landscape)

```
+------------------------------------------------------+
| 🏪 Toko Pusat ▼  | Outlet ▼ | Kasir Andi ▼ | 🔔 ✉ |
+--------+---------+--------+----+-------------+------+
| Search [_____________🔍]   | Cart                  |
|---------------------+------|--------------------- |
| [Cat1][Cat2][Cat3]  | item1   x1 …   25.000 ✕ |
|                     | item2   x2 …   16.000 ✕ |
| [P] [P] [P] [P]     |                          |
| [P] [P] [P] [P]     |                          |
| [P] [P] [P] [P]     |                          |
| [P] [P] [P] [P]     | --- promos & discounts ---|
|                     | + Promo HappyHour -5.000  |
| 1 2 3 4 5 (page)   | + Kupon ABC123 -10.000   |
|                     |---------------------------|
|                     | Subtotal      66.000      |
|                     | Diskon        -15.000     |
|                     | Pajak 11%      5.611      |
|                     | Service 5%     2.551      |
|                     | TOTAL          59.162     |
+--------+---------+--+------------------------- +
| 📷 Scan | 👥 Pelanggan |  ✕ Hapus  |  💾 Simpan  |
| 🍽️ Meja | 🧮 Kalkulator|  📝 Catatan|  💳 Bayar  |
+------------------------------------------------------+
```

## §2 Mobile (phone portrait)

Phone version condenses to:
1. Top bar: outlet/cashier
2. Tab: Catalogue | Cart (badge with count)
3. Bottom: action buttons

Catalogue = grid of product tiles, scrollable, search above.
Cart = list of line items, totals at bottom, payment button sticky.

## §3 Catalogue browsing

### Layout
- Grid: 4 cols × 4 rows on tablet; 2 cols × 4 rows on phone.
- Each tile: product image (square), name (1-2 lines), price.
- "Stok 0" overlay on out-of-stock items.
- Coloured background per category (configurable hex).
- Pagination at bottom.

### Filtering / search
- Search bar (debounced 300 ms): matches name, SKU, barcode.
- Category strip horizontal: all, food, beverage, etc.
- Department dropdown (optional).
- Favourite tab (user-configurable).

### Tile tap
- Simple product (no variant, no extra) → adds 1 to cart.
- Has variant or extra → opens modifier sheet.
- Pressed within 500 ms → "+1" haptic feedback.

### Long-press
- Opens product detail (price, description, stock per outlet).

## §4 Modifier sheet (for products with variants/extras)

Bottom sheet (60 % screen):
```
[Nasi Goreng Spesial — Rp 25.000]
+----------------------+
| Size  *required      |
| ◯ Reguler  +0        |
| ⦿ Jumbo    +5.000   |
+----------------------+
| Topping (max 3)      |
| ☑ Telur     +3.000  |
| ☐ Sosis     +5.000  |
| ☐ Keju      +4.000  |
+----------------------+
| Saus                 |
| ⦿ Sambal             |
| ◯ Tomat              |
+----------------------+
| Catatan: [pedas...]  |
| Qty: [-] 1 [+]       |
+----------------------+
| Subtotal: Rp 33.000  |
| [Batal]   [Tambah]  |
+----------------------+
```

Validation:
- Required groups must have selection.
- Min/max selection enforced.
- Save → adds to cart with full snapshot.

## §5 Cart line item

Each line shows:
- Product name + variants/extras (truncated)
- Qty controls [-] N [+]
- Line total
- Notes icon (if note)
- Discount icon (if discount)
- Manager-PIN icon (if special action applied)

Tap line:
- Opens edit sheet (re-modify variants, change qty, add note, apply line discount).

Long-press:
- Quick: void from cart (with manager PIN if line was already sent to kitchen).

## §6 Cart actions (bottom buttons)

| Action | Behaviour |
|---|---|
| 📷 Scan | Open camera barcode scanner; on scan, add to cart. |
| 👥 Pelanggan | Open customer picker; assign to cart for points/promos/deposit. |
| 🍽️ Meja | Pick table (Dine-In). |
| 🧮 Kalkulator | In-app calculator for cashier mental math. |
| ✕ Hapus Semua | Clear cart (with confirm). |
| 💾 Simpan | Save as "Hold" (recall later by # / customer). Server stores as DRAFT. |
| 📝 Catatan | Cart-level note (e.g. "Ulang tahun"). |
| 💳 Bayar | Proceed to payment screen. |

## §7 Order types

Shown as a dropdown / segmented control near the cart total:
- Quick Service (default for retail/F&B walk-up)
- Dine In (requires table)
- Takeaway
- Delivery (requires address)
- Ojek Online (GoFood/GrabFood/etc — has commission deducted)
- Reservasi (linked to a reservation)
- Marketplace (incoming from online channel; auto-set)

Switching order type:
- Re-evaluates promo applicability (some promos restrict by order type).
- May add/remove service charge (e.g. dine-in only).
- Triggers UI updates (e.g. address field, table picker).

## §8 Send to kitchen

For Dine-In: cashier may send order to kitchen before payment.
- Tap "Kirim ke Dapur" → KDS gets ticket; line items marked `SENT_TO_KITCHEN`.
- Cart still editable (add more items → re-send incremental tickets).
- Once any item is sent, voiding line requires manager PIN.

## §9 Hold / recall

Hold:
- Tap "Simpan" → enters cart name (e.g. "Meja 5", "Pak Andi") → saved.
- Cart cleared; cashier can take a new order.

Recall:
- Tap "Order Tersimpan" → list → tap one → restored to cart.
- Multiple holds simultaneously supported.

Server behaviour: hold creates `Transaction` with status `DRAFT`. Recall fetches and edits.

## §10 Payment screen

After "Bayar":
```
+----------------------------+
| TOTAL: Rp 59.162           |
+----------------------------+
| Tendered: Rp [60000  ]     |
| [Exact] [+1k] [+10k] [50k]|
| [+100k]                    |
+----------------------------+
| Methods:                   |
| [💵 Tunai]  [💳 EDC]       |
| [📱 QRIS Statis] [📱 QRIS Dinamis] |
| [🛍 GoPay] [🛒 OVO] [DANA] [Voucher]|
| [Transfer] [Deposit] [Piutang]|
+----------------------------+
| Lines:                     |
|  Tunai  60.000             |
|  Kembalian   838           |
+----------------------------+
| [Batal]      [💾 Bayar]    |
+----------------------------+
```

For split payment, multi-method allowed.

After "Bayar" success:
- Cash drawer opens.
- Receipt prints (auto).
- Snackbar "Transaksi #001/05 berhasil disimpan."
- Cart clears.
- Returns to catalogue.

## §11 Optimistic UI + offline behaviour

When offline:
- All actions work locally.
- Each transaction stored with `clientId` (UUID).
- Outbox queues `POST /transaction` for sync.
- UI shows "Belum sync" badge on history screen.

When the network returns:
- Outbox drains; transactions get server `id`.
- Optimistic UI doesn't show any change to cashier.

If sync fails permanently (e.g. invalid promo, customer already deleted):
- Show "Sinkronisasi Gagal" banner.
- Cashier can inspect failed payload + retry / discard.

## §12 Hardware integration during POS

| Hardware | Trigger | Behaviour |
|---|---|---|
| Barcode scanner (USB-HID) | Always listening | Scanned → match SKU/barcode → add to cart |
| Barcode scanner (camera) | Tap 📷 | Open scanner → scan → add to cart |
| Cash drawer | After cash payment | Auto-open via printer pulse |
| Thermal printer | After payment | Auto-print receipt |
| Customer display | Cart updates | Shows running subtotal + total |
| QRIS sound box | After QRIS settle | Voice "Pembayaran QRIS Rp X berhasil" |
| Weighing scale | "Ambil berat" button on by-weight items | Read kg via serial → multiply by price |
| Kitchen printer | "Kirim ke Dapur" | Print kitchen ticket |

## §13 Error handling

| Error | UI |
|---|---|
| Stock insufficient | Modal "Stok tidak cukup. Tersedia: 5" + force qty correction |
| Promo no longer valid | Inline strike-through promo + "Promo tidak berlaku" |
| Customer locked | "Akun pelanggan dinonaktifkan" |
| Tax recalculation error | Snackbar "Gagal hitung pajak. Hubungi support." (dev path) |
| Offline + new customer | Allow; queue customer creation; cart references local id |
| Offline + manager PIN required | Cache PIN from last 24 hr; allow; sync re-validates server |
| Printer offline | Don't block transaction; queue print |
| Cash drawer doesn't open | Toast "Buka laci secara manual" — don't block |

## §14 Performance budget

- Catalogue scroll 60 fps.
- Search debounce 300 ms; filter result < 100 ms.
- Add-to-cart latency < 50 ms.
- Payment screen open < 200 ms.
- Receipt print latency < 1.5 s.
- Cold start to POS-ready < 2.5 s.

## §15 Accessibility

- Touch target ≥ 48 dp.
- Text contrast ≥ AA (WCAG 4.5:1 for body).
- Voice annunciation of total on payment (optional, for visually impaired cashiers).
- Right-handed and left-handed mode (mirror UI for left-thumb access).

## §16 Data flow (mobile)

```
User taps tile
  ↓
Cart Repo (Room) updates LocalCart row
  ↓
ViewModel emits state via StateFlow
  ↓
Compose UI recomposes (cart updates, total recomputes)
  ↓
On "Bayar" → finalize cart → submit to ApiService
  ↓
ApiService writes outbox row, returns optimistically
  ↓
Worker eventually syncs; updates Transaction status to SYNCED
```

## §17 State management

```kotlin
data class PosUiState(
  val catalogue: List<Product>,
  val activeCategory: Long?,
  val searchQuery: String,
  val cart: Cart,
  val customer: Customer?,
  val orderType: OrderType,
  val table: Table?,
  val applicablePromos: List<Promo>,
  val activeCoupons: List<Coupon>,
  val activeShift: Shift?,
  val isLoading: Boolean,
  val errorMessage: String?,
)

data class Cart(
  val clientId: String,
  val items: List<CartItem>,
  val notes: String?,
  val subtotal: BigDecimal,
  val discount: BigDecimal,
  val tax: BigDecimal,
  val service: BigDecimal,
  val rounding: BigDecimal,
  val total: BigDecimal,
)
```

## §18 Acceptance criteria

- [ ] Tap product without variants → adds to cart in <50 ms.
- [ ] Tap product with variants → opens modifier sheet within 100 ms.
- [ ] Search "ayam" → matches all products containing "ayam".
- [ ] Scan barcode (camera) → matches & adds.
- [ ] Cart empty + tap Bayar → button disabled.
- [ ] Cart total > 0 + tap Bayar → opens payment screen.
- [ ] Payment cash, tendered = total → 0 change, drawer opens, receipt prints.
- [ ] Payment cash, tendered < total → blocked.
- [ ] Payment QRIS dynamic → QR shown, polls until paid, auto-prints.
- [ ] Promo applies automatically when conditions met.
- [ ] Coupon code "ABC123" → applies discount.
- [ ] Customer assigned → loyalty points earned at settle.
- [ ] Order type Dine-In + table 5 → table marked occupied.
- [ ] "Kirim ke Dapur" → KDS receives ticket within 5 s.
- [ ] Hold cart → recall → cart restored.
- [ ] Offline → all of above still work.
- [ ] Reconnect → outbox drains, transactions sync.

## §19 Open questions

- Does Majoo's `transaction` POST support partial sync (sending items separately)? `[unknown]`
- Is there a server-side promo applicator API that returns the applicable promos for a cart? `[unknown]` — VIPOS could implement client-side and revalidate on submit.
- What's the exact endpoint to mark a transaction as `SENT_TO_KITCHEN` (separate from `PAID`)? `[unknown]`
- Does QRIS dynamic API auto-cancel on timeout, or does the client need to cancel? `[unknown]`
