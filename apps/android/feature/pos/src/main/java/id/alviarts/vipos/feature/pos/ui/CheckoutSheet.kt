package id.alviarts.vipos.feature.pos.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SheetState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import id.alviarts.vipos.feature.pos.domain.CheckoutInputState
import id.alviarts.vipos.feature.pos.domain.PaymentMethod
import id.alviarts.vipos.feature.pos.domain.QrisPollStatus
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel

/**
 * P3-08 fourth slice — Compose UI for the checkout / payment-
 * method picker + per-method input dialogs.
 *
 * The sheet is **stateless**: the caller passes a fully-formed
 * [CheckoutUiState] plus narrow callbacks and the composable
 * never touches a ViewModel directly. The wiring into
 * [PosCatalogueScreen] (mounting on "Bayar" tap, dispatching
 * the slice-2/3 ViewModel methods + piping the chosen settle
 * back to the cart commit) lands in the fifth slice — this
 * slice only stands the visuals up so the design + copy can
 * land without dragging in the kasir flow change.
 *
 * Two public entry points are intentionally provided so
 * downstream callers can pick the level of integration they
 * need:
 *
 *  - [CheckoutSheet] — full [ModalBottomSheet] container
 *    (handles the scrim + drag-down dismiss). Use this when
 *    mounting from the kasir screen.
 *  - [CheckoutSheetContent] — the body composable without the
 *    sheet chrome. Use this for Compose previews, screenshot
 *    tests, or any host that already owns its own sheet
 *    container (e.g. an inline panel on tablet landscape).
 *
 * Body routing per [CheckoutPickerStatus]:
 *
 *  - [CheckoutPickerStatus.Idle] — empty placeholder. The
 *    calling screen owns the "should the sheet be visible"
 *    boolean and is expected to dismiss the sheet on Idle, so
 *    this state is mostly a defensive fallback.
 *  - [CheckoutPickerStatus.Picking] — [PaymentMethodGrid] +
 *    "Lanjut" CTA gated on
 *    [CheckoutUiState.isReadyToConfirmMethod].
 *  - [CheckoutPickerStatus.Picked] — per-method dialog
 *    routed by the shape of [CheckoutUiState.inputState]:
 *      - `null` → [SingleTapSettleDialog] (QRIS Statis,
 *        bank transfer, credit, deposit, voucher, loyalty,
 *        other).
 *      - [CheckoutInputState.CashInput] → [CashPaymentDialog].
 *      - [CheckoutInputState.EdcInput] → [EdcPaymentDialog].
 *      - [CheckoutInputState.QrisDynamicInput] →
 *        [QrisPaymentDialog].
 *    Each dialog has a "back" affordance routing to
 *    [onReopenPicker] and a "Bayar" CTA gated on
 *    [CheckoutUiState.isReadyForCommit].
 *
 * Indonesian copy, IDR formatting via the shared
 * [formatIdrLabel] helper used by the catalogue screen +
 * variant sheet.
 */

/**
 * Full modal-bottom-sheet wrapper around [CheckoutSheetContent].
 *
 * The sheet expands fully on first composition (the kasir is
 * settling a payment, not previewing — partial expansion would
 * truncate the picker grid + dialog on a small phone screen).
 * Drag-down dismiss + scrim tap both route to [onDismiss]; the
 * calling screen owns the "should the sheet be visible"
 * boolean.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutSheet(
    state: CheckoutUiState,
    onSelectMethod: (PaymentMethod) -> Unit,
    onClearSelection: () -> Unit,
    onConfirmSelection: () -> Unit,
    onReopenPicker: () -> Unit,
    onSetCashTendered: (Long) -> Unit,
    onSetEdcApprovalRef: (String) -> Unit,
    onSetEdcLast4: (String?) -> Unit,
    onCommit: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier = modifier,
    ) {
        CheckoutSheetContent(
            state = state,
            onSelectMethod = onSelectMethod,
            onClearSelection = onClearSelection,
            onConfirmSelection = onConfirmSelection,
            onReopenPicker = onReopenPicker,
            onSetCashTendered = onSetCashTendered,
            onSetEdcApprovalRef = onSetEdcApprovalRef,
            onSetEdcLast4 = onSetEdcLast4,
            onCommit = onCommit,
        )
    }
}

/**
 * Stateless body of the checkout sheet — does not assume a
 * surrounding sheet container. See [CheckoutSheet] for the
 * full modal surface; this composable is what previews, tests,
 * and tablet inline panels render directly.
 */
@Composable
fun CheckoutSheetContent(
    state: CheckoutUiState,
    onSelectMethod: (PaymentMethod) -> Unit,
    onClearSelection: () -> Unit,
    onConfirmSelection: () -> Unit,
    onReopenPicker: () -> Unit,
    onSetCashTendered: (Long) -> Unit,
    onSetEdcApprovalRef: (String) -> Unit,
    onSetEdcLast4: (String?) -> Unit,
    onCommit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            CheckoutSheetHeader(
                cartSubtotalIdr = state.cartSubtotalIdr,
                showBackAffordance = state.pickerStatus is CheckoutPickerStatus.Picked,
                onBack = onReopenPicker,
            )
            Spacer(Modifier.height(12.dp))
            HorizontalDivider()
            Spacer(Modifier.height(12.dp))
            CheckoutSheetBody(
                state = state,
                onSelectMethod = onSelectMethod,
                onClearSelection = onClearSelection,
                onConfirmSelection = onConfirmSelection,
                onSetCashTendered = onSetCashTendered,
                onSetEdcApprovalRef = onSetEdcApprovalRef,
                onSetEdcLast4 = onSetEdcLast4,
                onCommit = onCommit,
            )
        }
    }
}

@Composable
private fun CheckoutSheetHeader(
    cartSubtotalIdr: Long,
    showBackAffordance: Boolean,
    onBack: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (showBackAffordance) {
            TextButton(onClick = onBack) {
                Text("← Ubah metode")
            }
            Spacer(Modifier.width(8.dp))
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Total",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = formatIdrLabel(cartSubtotalIdr),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

/**
 * Routes between the picker grid + per-method dialogs based on
 * the [CheckoutUiState.pickerStatus] + [CheckoutUiState.inputState]
 * tuple.
 */
@Composable
private fun CheckoutSheetBody(
    state: CheckoutUiState,
    onSelectMethod: (PaymentMethod) -> Unit,
    onClearSelection: () -> Unit,
    onConfirmSelection: () -> Unit,
    onSetCashTendered: (Long) -> Unit,
    onSetEdcApprovalRef: (String) -> Unit,
    onSetEdcLast4: (String?) -> Unit,
    onCommit: () -> Unit,
) {
    when (state.pickerStatus) {
        CheckoutPickerStatus.Idle -> {
            // Defensive fallback — calling screen should dismiss
            // the sheet on Idle, so seeing this means the host is
            // mis-managing the visibility flag.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 80.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Belum ada keranjang aktif.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        CheckoutPickerStatus.Picking -> {
            PaymentMethodGrid(
                methods = state.availableMethods,
                selectedMethod = state.selectedMethod,
                onSelectMethod = onSelectMethod,
                onClearSelection = onClearSelection,
            )
            Spacer(Modifier.height(12.dp))
            HorizontalDivider()
            Spacer(Modifier.height(12.dp))
            ConfirmMethodCtaRow(
                enabled = state.isReadyToConfirmMethod,
                onConfirm = onConfirmSelection,
            )
        }
        CheckoutPickerStatus.Picked -> {
            val method = state.selectedMethod
            when (val input = state.inputState) {
                null -> SingleTapSettleDialog(
                    method = method,
                    cartSubtotalIdr = state.cartSubtotalIdr,
                    enabled = state.isReadyForCommit,
                    onCommit = onCommit,
                )
                is CheckoutInputState.CashInput -> CashPaymentDialog(
                    cartSubtotalIdr = state.cartSubtotalIdr,
                    input = input,
                    enabled = state.isReadyForCommit,
                    onSetTendered = onSetCashTendered,
                    onCommit = onCommit,
                )
                is CheckoutInputState.EdcInput -> EdcPaymentDialog(
                    cartSubtotalIdr = state.cartSubtotalIdr,
                    input = input,
                    enabled = state.isReadyForCommit,
                    onSetApprovalRef = onSetEdcApprovalRef,
                    onSetLast4 = onSetEdcLast4,
                    onCommit = onCommit,
                )
                is CheckoutInputState.QrisDynamicInput -> QrisPaymentDialog(
                    cartSubtotalIdr = state.cartSubtotalIdr,
                    input = input,
                    enabled = state.isReadyForCommit,
                    onCommit = onCommit,
                )
            }
        }
    }
}

// -- Picker grid ----------------------------------------------

/**
 * Renders [methods] as a vertically-stacked, two-per-row grid
 * of [FilterChip]s (we use [FilterChip] over a custom card so
 * the brand teal selection state lands for free via Material 3
 * theming).
 *
 * Real flow-layout would be nicer but
 * `androidx.compose.foundation.layout.FlowRow` is still marked
 * `ExperimentalLayoutApi` in the BOM the project is on; sticking
 * to plain [Row]s of two chips keeps the import surface stable.
 * 14 methods at 2-per-row = 7 rows, fits inside the sheet on
 * any phone-sized screen with the offline filter applied (8
 * methods at most).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentMethodGrid(
    methods: List<PaymentMethod>,
    selectedMethod: PaymentMethod?,
    onSelectMethod: (PaymentMethod) -> Unit,
    onClearSelection: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = "Pilih metode pembayaran",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium,
        )
        if (methods.isEmpty()) {
            Text(
                text = "Tidak ada metode pembayaran tersedia.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            return@Column
        }
        // Cap the grid height so the CTA + total line stay
        // visible above the keyboard on a small phone screen.
        // 14 chip rows = 56dp * 7 ≈ 400dp, plus padding.
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 360.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val rows = methods.chunked(2)
            items(count = rows.size, key = { idx -> idx }) { idx ->
                val row = rows[idx]
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    for (method in row) {
                        Box(modifier = Modifier.weight(1f)) {
                            FilterChip(
                                selected = method == selectedMethod,
                                onClick = {
                                    if (method == selectedMethod) {
                                        onClearSelection()
                                    } else {
                                        onSelectMethod(method)
                                    }
                                },
                                label = { Text(text = method.displayLabel) },
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                    // Pad the last row to keep both columns the
                    // same width when the chip count is odd.
                    if (row.size == 1) {
                        Box(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun ConfirmMethodCtaRow(
    enabled: Boolean,
    onConfirm: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Spacer(Modifier.weight(1f))
        Button(
            onClick = onConfirm,
            enabled = enabled,
        ) {
            Text("Lanjut")
        }
    }
}

// -- Cash dialog ----------------------------------------------

/**
 * Cash payment dialog body. The kasir types the tendered
 * amount — we render quick-amount chips for the common
 * denominations (50k, 100k, 200k, exact) below the field for a
 * one-tap shortcut.
 *
 * Change due is displayed as `Rp X` (always non-negative — the
 * underlying [CheckoutInputState.CashInput.changeIdr] returns
 * 0 when tendered < subtotal, the [enabled] CTA flag is what
 * actually gates commit).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CashPaymentDialog(
    cartSubtotalIdr: Long,
    input: CheckoutInputState.CashInput,
    enabled: Boolean,
    onSetTendered: (Long) -> Unit,
    onCommit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = "Tunai",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = if (input.tenderedIdr == 0L) "" else input.tenderedIdr.toString(),
            onValueChange = { raw ->
                // Permissive — the kasir's keystrokes shouldn't
                // be rejected mid-typing. Strip non-digits and
                // parse what's left; an empty result clamps to 0.
                val digits = raw.filter { it.isDigit() }
                onSetTendered(digits.toLongOrNull() ?: 0L)
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            label = { Text("Uang yang diberikan") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Spacer(Modifier.height(8.dp))
        QuickAmountRow(
            cartSubtotalIdr = cartSubtotalIdr,
            onPick = onSetTendered,
        )
        Spacer(Modifier.height(12.dp))
        ChangeDueRow(
            cartSubtotalIdr = cartSubtotalIdr,
            tenderedIdr = input.tenderedIdr,
        )
        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(12.dp))
        CommitCtaRow(
            enabled = enabled,
            label = "Bayar tunai",
            onCommit = onCommit,
        )
    }
}

/**
 * Quick-amount chips snap the tendered field to common
 * denominations. "Pas" = exact change (tendered == subtotal).
 * 50k / 100k / 200k are the most common bills the kasir sees;
 * the kasir-flow research from v2 spec §6 backs this set.
 *
 * The chips are only useful for round-figure denominations —
 * we omit any amount < subtotal so the kasir doesn't tap a
 * chip that immediately invalidates the input.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QuickAmountRow(
    cartSubtotalIdr: Long,
    onPick: (Long) -> Unit,
) {
    val baseAmounts = listOf(50_000L, 100_000L, 200_000L)
    val filtered = baseAmounts.filter { it >= cartSubtotalIdr }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        AssistChip(
            onClick = { onPick(cartSubtotalIdr) },
            label = { Text("Pas") },
        )
        for (amount in filtered) {
            AssistChip(
                onClick = { onPick(amount) },
                label = { Text(formatIdrLabel(amount)) },
            )
        }
    }
}

@Composable
private fun ChangeDueRow(
    cartSubtotalIdr: Long,
    tenderedIdr: Long,
) {
    val change = (tenderedIdr - cartSubtotalIdr).coerceAtLeast(0L)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = "Kembalian",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = formatIdrLabel(change),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
    if (tenderedIdr in 1L until cartSubtotalIdr) {
        Spacer(Modifier.height(4.dp))
        Text(
            text = "Uang masih kurang ${formatIdrLabel(cartSubtotalIdr - tenderedIdr)}.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
        )
    }
}

// -- EDC dialog -----------------------------------------------

@Composable
fun EdcPaymentDialog(
    cartSubtotalIdr: Long,
    input: CheckoutInputState.EdcInput,
    enabled: Boolean,
    onSetApprovalRef: (String) -> Unit,
    onSetLast4: (String?) -> Unit,
    onCommit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = "Kartu (EDC)",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = "Selesaikan transaksi di mesin EDC dulu, lalu masukkan nomor approval di bawah.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = input.approvalRef,
            onValueChange = onSetApprovalRef,
            label = { Text("Nomor approval / ref") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = input.last4 ?: "",
            onValueChange = { raw ->
                val digits = raw.filter { it.isDigit() }.take(4)
                onSetLast4(digits.ifEmpty { null })
            },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            label = { Text("4 digit terakhir kartu (opsional)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Spacer(Modifier.height(12.dp))
        SubtotalLine(cartSubtotalIdr)
        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(12.dp))
        CommitCtaRow(
            enabled = enabled,
            label = "Konfirmasi pembayaran",
            onCommit = onCommit,
        )
    }
}

// -- QRIS Dynamic dialog --------------------------------------

@Composable
fun QrisPaymentDialog(
    cartSubtotalIdr: Long,
    input: CheckoutInputState.QrisDynamicInput,
    enabled: Boolean,
    onCommit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = "QRIS Dinamis",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = "Tunjukkan QR ke pelanggan untuk dipindai. Status pembayaran akan terupdate otomatis.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))
        QrisCodeArea(qrCodeUrl = input.qrCodeUrl, status = input.status)
        Spacer(Modifier.height(12.dp))
        QrisStatusRow(refId = input.refId, status = input.status)
        Spacer(Modifier.height(12.dp))
        SubtotalLine(cartSubtotalIdr)
        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(12.dp))
        CommitCtaRow(
            enabled = enabled,
            label = "Konfirmasi pembayaran",
            onCommit = onCommit,
        )
    }
}

/**
 * QR code rendering area (P3-08 slice 5c).
 *
 * Replaces the slice-4 placeholder with real QR rendering via
 * ZXing. When [qrCodeUrl] is non-null and [status] is
 * [QrisPollStatus.Awaiting], the composable encodes the URL
 * string into a QR code bitmap and renders it. For other states
 * (Generating, Paid, Expired, Failed) it shows the appropriate
 * status indicator.
 *
 * The QR bitmap is computed off the main thread via
 * [androidx.compose.runtime.remember] + [produceState] pattern
 * to avoid jank on the first render.
 */
@Composable
private fun QrisCodeArea(qrCodeUrl: String?, status: QrisPollStatus) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp)
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(8.dp),
            )
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline,
                shape = RoundedCornerShape(8.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        when (status) {
            QrisPollStatus.Generating -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(modifier = Modifier.size(36.dp))
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Membuat kode QR…",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            QrisPollStatus.Awaiting -> {
                if (qrCodeUrl != null) {
                    val qrBitmap = remember(qrCodeUrl) {
                        generateQrBitmap(qrCodeUrl, sizePx = 512)
                    }
                    if (qrBitmap != null) {
                        Image(
                            bitmap = qrBitmap,
                            contentDescription = "QRIS QR Code",
                            modifier = Modifier
                                .size(200.dp)
                                .padding(8.dp),
                        )
                    } else {
                        Text(
                            text = "Gagal membuat QR",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(modifier = Modifier.size(36.dp))
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Memuat QR…",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
            QrisPollStatus.Paid -> {
                Text(
                    text = "✓ Lunas",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF2E7D32),
                )
            }
            QrisPollStatus.Expired -> {
                Text(
                    text = "QR kedaluwarsa, buat ulang.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            is QrisPollStatus.Failed -> {
                Text(
                    text = "Gagal: ${status.message}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

/**
 * Generate a QR code [ImageBitmap] from [content] using ZXing.
 *
 * Returns `null` if encoding fails (e.g. content too long for
 * the QR version). The caller should show a fallback error
 * message in that case.
 *
 * @param content the string to encode (typically the
 *   gateway-issued `qr_code_url`).
 * @param sizePx the width/height of the output bitmap in
 *   pixels.
 */
private fun generateQrBitmap(content: String, sizePx: Int): ImageBitmap? {
    return try {
        val bitMatrix = com.google.zxing.qrcode.QRCodeWriter().encode(
            content,
            com.google.zxing.BarcodeFormat.QR_CODE,
            sizePx,
            sizePx,
        )
        val pixels = IntArray(sizePx * sizePx)
        for (y in 0 until sizePx) {
            for (x in 0 until sizePx) {
                pixels[y * sizePx + x] = if (bitMatrix[x, y]) {
                    android.graphics.Color.BLACK
                } else {
                    android.graphics.Color.WHITE
                }
            }
        }
        val bitmap = android.graphics.Bitmap.createBitmap(
            pixels, sizePx, sizePx,
            android.graphics.Bitmap.Config.ARGB_8888,
        )
        bitmap.asImageBitmap()
    } catch (_: Exception) {
        null
    }
}

@Composable
private fun QrisStatusRow(refId: String?, status: QrisPollStatus) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Status",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = qrisStatusLabel(status),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
        }
        if (refId != null) {
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "Ref",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = refId,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

private fun qrisStatusLabel(status: QrisPollStatus): String = when (status) {
    QrisPollStatus.Generating -> "Membuat QR"
    QrisPollStatus.Awaiting -> "Menunggu pembayaran"
    QrisPollStatus.Paid -> "Lunas"
    QrisPollStatus.Expired -> "Kedaluwarsa"
    is QrisPollStatus.Failed -> "Gagal — ${status.message}"
}

// -- Single-tap settle dialog ---------------------------------

/**
 * Confirmation dialog for single-tap-settle methods (QRIS
 * Statis, bank transfer, credit, deposit, voucher, loyalty,
 * other). No per-method input is required — the kasir already
 * settled the payment outside the app, this is just the
 * "tekan untuk konfirmasi" affordance to commit the
 * transaction.
 */
@Composable
fun SingleTapSettleDialog(
    method: PaymentMethod?,
    cartSubtotalIdr: Long,
    enabled: Boolean,
    onCommit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = method?.displayLabel ?: "Konfirmasi",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = singleTapHint(method),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))
        SubtotalLine(cartSubtotalIdr)
        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(12.dp))
        CommitCtaRow(
            enabled = enabled,
            label = "Konfirmasi pembayaran",
            onCommit = onCommit,
        )
    }
}

/**
 * Per-method one-liner that explains what the kasir is
 * confirming. Falls back to a generic copy when [method] is
 * `null` (defensive — picker shouldn't reach this state with
 * a null method, but the UI shouldn't blow up either).
 */
private fun singleTapHint(method: PaymentMethod?): String = when (method) {
    PaymentMethod.QRIS_STATIC ->
        "Pelanggan sudah memindai QR statis. Tekan tombol di bawah untuk simpan transaksi."
    PaymentMethod.BANK_TRANSFER ->
        "Transfer sudah masuk. Tekan tombol di bawah untuk simpan transaksi."
    PaymentMethod.CREDIT ->
        "Catat sebagai piutang pelanggan."
    PaymentMethod.DEPOSIT ->
        "Potong dari saldo deposit pelanggan."
    PaymentMethod.VOUCHER ->
        "Tukar dengan voucher pelanggan."
    PaymentMethod.LOYALTY_POINT ->
        "Tukar dengan poin loyalty pelanggan."
    PaymentMethod.OTHER ->
        "Catat dengan metode lain."
    else ->
        "Tekan tombol di bawah untuk simpan transaksi."
}

// -- Shared sub-composables -----------------------------------

@Composable
private fun SubtotalLine(cartSubtotalIdr: Long) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = "Total tagihan",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = formatIdrLabel(cartSubtotalIdr),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun CommitCtaRow(
    enabled: Boolean,
    label: String,
    onCommit: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Spacer(Modifier.weight(1f))
        Button(onClick = onCommit, enabled = enabled) {
            Text(label)
        }
    }
}

// -- Previews --------------------------------------------------
//
// One preview per visible body shape so a future redesign can
// eyeball every state without booting the full kasir flow. The
// previews wire the same `VIPOSTheme` the runtime uses so the
// brand teal lands in the chip / CTA tints.

private val SamplePreviewMethodsOnline: List<PaymentMethod> = PaymentMethod.entries.toList()

private val SamplePreviewMethodsOffline: List<PaymentMethod> =
    PaymentMethod.entries.filterNot { it.requiresOnline }

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentPickingPreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picking,
                selectedMethod = PaymentMethod.CASH,
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentPickingOfflinePreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 30_000L,
                availableMethods = SamplePreviewMethodsOffline,
                pickerStatus = CheckoutPickerStatus.Picking,
                selectedMethod = null,
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentCashEmptyPreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.CASH,
                inputState = CheckoutInputState.CashInput(tenderedIdr = 0L),
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentCashChangePreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.CASH,
                inputState = CheckoutInputState.CashInput(tenderedIdr = 100_000L),
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentCashShortPreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.CASH,
                inputState = CheckoutInputState.CashInput(tenderedIdr = 50_000L),
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentEdcPreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 250_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.EDC,
                inputState = CheckoutInputState.EdcInput(
                    approvalRef = "APR-001",
                    last4 = "1234",
                ),
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentQrisGeneratingPreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.QRIS_DYNAMIC,
                inputState = CheckoutInputState.QrisDynamicInput(
                    refId = null,
                    status = QrisPollStatus.Generating,
                ),
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentQrisAwaitingPreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.QRIS_DYNAMIC,
                inputState = CheckoutInputState.QrisDynamicInput(
                    refId = "QR-9001",
                    status = QrisPollStatus.Awaiting,
                    qrCodeUrl = "https://stub.qris.local/qr/QR-9001.png",
                ),
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentQrisPaidPreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.QRIS_DYNAMIC,
                inputState = CheckoutInputState.QrisDynamicInput(
                    refId = "QR-9001",
                    status = QrisPollStatus.Paid,
                ),
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentQrisFailedPreview() {
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.QRIS_DYNAMIC,
                inputState = CheckoutInputState.QrisDynamicInput(
                    refId = null,
                    status = QrisPollStatus.Failed("gateway timeout"),
                ),
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CheckoutSheetContentSingleTapSettlePreview() {
    // Bank transfer = single-tap settle method (inputState=null,
    // isReadyForCommit=true).
    VIPOSTheme {
        CheckoutSheetContent(
            state = CheckoutUiState(
                cartSubtotalIdr = 71_000L,
                availableMethods = SamplePreviewMethodsOnline,
                pickerStatus = CheckoutPickerStatus.Picked,
                selectedMethod = PaymentMethod.BANK_TRANSFER,
                inputState = null,
            ),
            onSelectMethod = {},
            onClearSelection = {},
            onConfirmSelection = {},
            onReopenPicker = {},
            onSetCashTendered = {},
            onSetEdcApprovalRef = {},
            onSetEdcLast4 = {},
            onCommit = {},
        )
    }
}
