# 08 · Hardware Integration

> Spec for every peripheral the Android app must talk to. Without this doc, the Android dev will spend weeks debugging Bluetooth pairing and ESC/POS encoding.

## §1 Inventory of peripherals (from Majoo marketing + reseller portal)

| Peripheral | Channel | Use | Tier | Mandatory v1 |
|---|---|---|---|:-:|
| Thermal printer 58 mm | Bluetooth (SPP) / USB / LAN | Kasir struk | All | ✓ |
| Thermal printer 80 mm | Bluetooth (SPP) / USB / LAN | Kasir struk + checker | All | ✓ |
| Kitchen / checker printer | Bluetooth / LAN | Tickets to kitchen / bar / dapur | Starter+ | ✓ |
| Label printer | USB / LAN | Address sticker, batch label | Advance+ | – |
| Barcode scanner | USB-HID, Bluetooth-HID, BLE | Inventory + POS | All | ✓ |
| Camera as scanner | Internal cam | Fallback for no scanner | All | ✓ |
| Cash drawer | Through printer's RJ-11 / RJ-12 port | Open on cash payment | All | ✓ |
| Customer display | Second screen via HDMI / Bluetooth | Show running total | Advance+ | – |
| Weighing scale (timbangan) | RS-232 / USB / Bluetooth | Per-kg products | Advance+ | – |
| EDC BCA / BRI | ECR cable to printer / BT | Card payment | Advance+ | – |
| QRIS sound speaker / sound box | BLE | Voice "Pembayaran QRIS Rp..." | All | – |
| Kitchen Display System (KDS) | Separate Android tablet | Show kitchen tickets | Prime+ | – |
| Order Display | Separate Android TV | Show order ready for pickup | Prime+ | – |
| Self Order kiosk | Separate Android tablet | Customer self-checkout | Prime+ | – |
| Warehouse Display | Separate Android tablet | Stock movement display | Prime+ | – |

## §2 Thermal printer (ESC/POS)

### Connection types

1. **Bluetooth Classic SPP** — most common. UUID `00001101-0000-1000-8000-00805F9B34FB`. Pair through Android Settings, then open `BluetoothSocket`.
2. **Bluetooth Low Energy (BLE)** — newer printers. Use `BluetoothGatt`. Need to discover characteristic UUIDs per vendor.
3. **USB** — plug printer to a tablet's OTG port. Use `UsbManager` and `UsbDevice`. Vendor IDs: 0x0FE6 (ICS), 0x0416 (Winbond), 0x04B8 (Epson), 0x067B (Prolific).
4. **Wi-Fi / LAN** — printer has IP, use TCP socket on port 9100.

### Recommended library

```kotlin
implementation("com.dantsu:escposprinter:3.3.0")
```

Or roll your own minimal ESC/POS encoder (preferred for control). Common commands:

| Command | Bytes | Effect |
|---|---|---|
| Initialize | `1B 40` | Reset printer |
| Charset Indonesian | `1B 74 13` | Code page 19 (CP858/CP1252) |
| Cut paper | `1D 56 41 03` | Partial cut after feeding 3 dots |
| Open cash drawer | `1B 70 00 19 FA` | Pulse pin 2 |
| Bold ON | `1B 45 01` | |
| Bold OFF | `1B 45 00` | |
| Font A | `1B 4D 00` | |
| Font B (smaller) | `1B 4D 01` | |
| Align left | `1B 61 00` | |
| Align center | `1B 61 01` | |
| Align right | `1B 61 02` | |
| Double height | `1B 21 10` | |
| Double width | `1B 21 20` | |
| Reset size | `1B 21 00` | |
| Print bitmap | `1D 76 30 ...` | Logo at top |
| QR code | `1D 28 6B ...` (model 2) | Receipt QR |

### 58 mm vs 80 mm geometry

| Width | Chars Font A | Chars Font B | Logo width px | QR module |
|---|:-:|:-:|:-:|:-:|
| 58 mm | 32 | 42 | 384 | up to 6 |
| 80 mm | 48 | 64 | 576 | up to 10 |

The receipt template (`11_RECEIPT_TEMPLATES.md`) must be width-aware.

### Implementation pattern

```kotlin
class ThermalPrinter(private val width: Int) {
  fun connect(macAddress: String): Result<Unit> {...}
  fun printBitmap(bitmap: Bitmap) {...}
  fun printLine(text: String, alignment: Align = Align.LEFT, bold: Boolean = false) {...}
  fun printQR(content: String) {...}
  fun cut() {...}
  fun openDrawer() {...}
  fun disconnect() {...}
}
```

### Indonesian char encoding

Code page 19 (CP858) handles `é à ñ ü` but is inconsistent for Indonesian — use code page 0 (CP437) and ASCII-fold non-ASCII chars (`á → a`). Or use raster image rendering for non-Latin glyphs.

For Bahasa Indonesia, ASCII-only output is acceptable since the language uses Latin script without diacritics. Just make sure `Rp` symbol prints (it's ASCII).

### Permissions

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" /> <!-- for SDK ≤30 BLE -->
```

Runtime request flow on Android 12+ (API 31+):
1. Request `BLUETOOTH_SCAN` → user grants.
2. Request `BLUETOOTH_CONNECT` → user grants.
3. Open Bluetooth chooser if not enabled.

## §3 Cash drawer

Almost always wired to the thermal printer's RJ-11/RJ-12 (DK port).
- After payment success, send drawer-open command via the printer connection.
- Some standalone USB cash drawers exist (rare in Indonesia).
- If printer is offline, show "Buka laci secara manual." instead of failing the transaction.

## §4 Barcode scanner

### USB-HID

The scanner appears as a keyboard. Just listen for keypresses on the focused input.
- Detect "fast typing followed by Enter" pattern (e.g. >10 chars in <500 ms ending with `\n`).
- Distinguish from human typing in case the cashier is searching by name.

```kotlin
@Composable
fun BarcodeListener(onScan: (String) -> Unit) {
  val buffer = remember { StringBuilder() }
  val lastKeyTime = remember { mutableLongStateOf(0L) }
  Box(modifier = Modifier
    .focusRequester(focusRequester)
    .onKeyEvent { evt ->
      val now = SystemClock.elapsedRealtime()
      if (now - lastKeyTime.longValue > 100) buffer.clear() // gap → reset
      lastKeyTime.longValue = now
      if (evt.key == Key.Enter) {
        if (buffer.length > 6) onScan(buffer.toString())
        buffer.clear()
      } else {
        buffer.append(evt.utf16CodePoint.toChar())
      }
      true
    }
  )
}
```

### Bluetooth-HID

Same as USB but paired via Bluetooth. App treats it identically to USB-HID.

### Camera scanner (fallback)

Use **CameraX + ML Kit Barcode Scanning**:
```kotlin
implementation("androidx.camera:camera-camera2:1.3.0")
implementation("androidx.camera:camera-lifecycle:1.3.0")
implementation("androidx.camera:camera-view:1.3.0")
implementation("com.google.mlkit:barcode-scanning:17.2.0")
```

Supports EAN-8, EAN-13, UPC-A, UPC-E, CODE-128, CODE-39, QR.

UX:
- Tap "Scan" icon → opens full-screen scanner with viewfinder rectangle.
- Vibrate + beep on detect.
- Auto-search product by barcode field.
- If not found → "Barcode tidak ditemukan. Tambah produk baru?"

## §5 Customer display

Two architectures:
1. **HDMI second screen** — Use `Presentation` API to render on display 1 (`DisplayManager.getDisplays`).
2. **Bluetooth display device** (e.g. small VFD-style) — Send formatted text via SPP; vendor-specific protocol.

For v1, prefer HDMI presentation (Compose `@Composable PresentationContent` rendered on second display).

## §6 Weighing scale

Common protocols:
- **CAS / Mettler Toledo / Acom** — RS-232 ASCII frames "ST,GS,+0.500 kg\r\n"
- **Brand-specific binary** — varies

For Android, use a USB-Serial library:
```kotlin
implementation("com.github.mik3y:usb-serial-for-android:3.6.0")
```

Workflow:
1. User selects a "by-weight" product (e.g. "Pisang per kg").
2. Place item on scale.
3. Tap "Ambil berat" → reads serial → parses to BigDecimal.
4. Compute price = `weight * pricePerKg`.

Always show a manual-override field for human verification.

## §7 EDC integration (BCA, BRI)

Two modes:
1. **Standalone EDC** — cashier types amount manually; reads card; prints. POS app gets nothing back. Cashier types ref number into the app.
2. **ECR (Electronic Cash Register) integration** — POS sends amount to EDC over RS-232 / Bluetooth; EDC processes; sends ack with ref number / approval code back.

ECR is preferred because:
- No human typo on amount
- Auto-fills ref number
- Auto-prints settlement matching POS data

Flow:
```
POS → (amount, transaction_id) → EDC
EDC → (status, approval_code, ref_no, card_last4, card_type) → POS
POS → save TransactionPayment with method=EDC, refNumber, etc
```

Each bank has its own ECR protocol; need their integration docs (BCA EDC ECR, BRI EDC ECR). For v1, start with **manual mode** and ECR as v2.

## §8 QRIS (sound box)

QRIS sound box is a small BLE device that announces "Pembayaran QRIS sebesar Rp X berhasil" when a transaction settles.

Integration:
- Pair via BLE.
- After QRIS callback returns success, send `(amount, ref)` to sound box; it speaks Indonesian.
- Useful for cashiers who can't watch the screen continuously (e.g. F&B kitchen).

## §9 Kitchen Display System (KDS)

KDS is a **separate Android binary**. Architecture:

```
POS app          → Server → KDS app
(send order)               (receive order)

KDS app          → Server → POS app
(mark ready)               (notify cashier)
```

Communication options:
- HTTP polling every 2 s (simple, drains battery)
- WebSocket (better UX, more complex)
- FCM data message (best for push, requires GMS)

For VIPOS, recommend **HTTP polling for v1**, switch to WebSocket for v2 if needed.

KDS app screen layout:
- Grid of order cards (3-6 columns)
- Each card: order number, table, items + modifiers, time elapsed (color-coded: green<5 min, yellow 5-10, red >10)
- Tap "READY" → marks done, removes from KDS
- Tap "BUMP" → moves to "served" state

## §10 Order Display

Order Display is a customer-facing screen (e.g. wall-mounted Android TV) showing:
- "Sedang Dimasak" list of order numbers
- "Siap Diambil" list of order numbers (highlighted, with sound notification)

Architecture identical to KDS but read-only and customer-facing.

## §11 Self Order

Self Order kiosk is a customer-facing tablet for self-checkout.
- Replicates POS catalogue + cart UI
- Payment limited to QRIS (no cash drawer)
- Outputs receipt to a connected thermal printer
- Optional: collect customer phone for loyalty

## §12 Warehouse Display

Wall-mounted Android tablet showing:
- Today's incoming PO/GR
- Today's outgoing mutation
- Low-stock alerts
- Workflow: warehouseman scans incoming items → updates display

## §13 Hardware preference defaults

The app stores per-terminal hardware config:

```json
{
  "primary_printer": { "type": "BLUETOOTH", "address": "AA:BB:CC:DD:EE:FF", "width": 80 },
  "kitchen_printer": { "type": "LAN", "ip": "192.168.1.50", "port": 9100, "width": 80 },
  "barcode_input": "USB_HID",
  "camera_scanner_enabled": true,
  "cash_drawer_via_printer": true,
  "customer_display": { "type": "HDMI", "display_id": 1 },
  "scale": null,
  "edc": null
}
```

Stored in `EncryptedSharedPreferences`. Reset on logout-and-forget-device.

## §14 Test plan per peripheral

| Peripheral | Test |
|---|---|
| Thermal 58 mm | Print sample receipt with all align/style codes, cut paper, open drawer |
| Thermal 80 mm | Same + larger font verification |
| Kitchen printer | Send dummy ticket, confirm cuts/feeds |
| Barcode (USB) | Scan EAN-13 → product matches |
| Barcode (camera) | Scan EAN-13 → same |
| Cash drawer | Open via printer pulse, verify drawer opens |
| Customer display | Show subtotal as cart updates |
| Scale | Read 0.5 kg, verify price calc |
| EDC manual | Process payment, type ref no into form |
| QRIS sound box | After QRIS settle, hear voice |

## §15 Open items

- ESC/POS code page for `Rp` symbol — verify on each printer brand (some print as `?` or `R$`).
- Bluetooth-HID barcode scanners on Android 13+ require user to enable "Use as keyboard" in BT settings; document this in user-facing setup guide.
- USB OTG cable quality — many cheap cables are charge-only, not data; recommend Anker/Ugreen.
- BCA EDC ECR cable is proprietary; user must request from BCA Merchant Service.
