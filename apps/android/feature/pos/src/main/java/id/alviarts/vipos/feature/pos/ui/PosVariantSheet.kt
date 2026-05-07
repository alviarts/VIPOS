package id.alviarts.vipos.feature.pos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SheetState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import id.alviarts.vipos.feature.pos.domain.ProductVariantGroup
import id.alviarts.vipos.feature.pos.domain.ProductVariantOption
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel

/**
 * P3-07 fourth slice — Compose UI for the variant / modifier
 * sheet.
 *
 * The sheet is **stateless**: the caller passes a fully-formed
 * [PosVariantUiState] plus three callbacks and the composable
 * never touches a ViewModel directly. The wiring into
 * [PosCatalogueScreen] (mounting on product-card tap, dispatching
 * the auto-fetched [PosVariantViewModel.loadFor] / piping the
 * `selectedPriceUpliftIdr` back into the cart line) lands in the
 * fifth slice — this slice only stands the visuals up so the
 * design + copy can land without dragging in the kasir flow
 * change.
 *
 * Two public entry points are intentionally provided so
 * downstream callers can pick the level of integration they
 * need:
 *
 *  - [PosVariantSheet] — full [ModalBottomSheet] container
 *    (handles the scrim + drag-down dismiss). Use this when
 *    mounting from the kasir screen.
 *  - [PosVariantSheetContent] — the body composable without the
 *    sheet chrome. Use this for Compose previews, screenshot
 *    tests, or any host that already owns its own sheet
 *    container (e.g. an inline panel on tablet landscape).
 *
 * Both are pure functions of [PosVariantUiState] — re-rendering
 * with the same state produces the same UI (modulo the
 * Material 3 ripple / animation state, which the framework
 * owns).
 *
 * Layout per [VariantLoadStatus]:
 *
 *  - [VariantLoadStatus.Idle] / [VariantLoadStatus.Loading]
 *    while [PosVariantUiState.groups] is empty — centred
 *    [CircularProgressIndicator] inside the sheet.
 *  - [VariantLoadStatus.Loaded] with a non-empty `groups` —
 *    one [Card] per group, each card holds a wrap-row of
 *    [FilterChip]s (one per option). Selected option chip is
 *    filled-in with the brand teal; the option's
 *    `priceModifierIdr` is rendered next to its label as a
 *    `+ Rp 4.000` / `- Rp 2.000` suffix (omitted for zero-uplift
 *    options to keep the chip compact). The bottom of the sheet
 *    holds a "Tambah ke pesanan" CTA gated on
 *    [PosVariantUiState.isReadyToAddToCart] with a running
 *    "+ Rp X" uplift readout next to it.
 *  - [VariantLoadStatus.Loaded] with an empty `groups` — a
 *    "Produk ini belum punya varian" placeholder + a still-
 *    enabled CTA (since the kasir can add the bare product to
 *    the cart with zero uplift).
 *  - [VariantLoadStatus.Failed] — error card with the message
 *    + a retry button. The CTA is hidden in this state.
 *
 * Indonesian copy is consistent with the existing
 * [PosCatalogueScreen] surface ("Tambah ke pesanan",
 * "Coba lagi", IDR formatting via the shared
 * [formatIdrLabel] helper).
 */

/**
 * Full modal-bottom-sheet wrapper around [PosVariantSheetContent].
 *
 * The sheet expands fully on first composition (the kasir is
 * picking modifiers, not previewing — partial expansion would
 * truncate option chips on a small phone screen). Drag-down
 * dismiss + scrim tap both route to [onDismiss]; the calling
 * screen owns the "should the sheet be visible" boolean.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PosVariantSheet(
    state: PosVariantUiState,
    onSelectOption: (groupName: String, optionId: Long) -> Unit,
    onAddToCart: () -> Unit,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        modifier = modifier,
    ) {
        PosVariantSheetContent(
            state = state,
            onSelectOption = onSelectOption,
            onAddToCart = onAddToCart,
            onRetry = onRetry,
        )
    }
}

/**
 * Stateless body of the variant sheet — does not assume a
 * surrounding sheet container. See [PosVariantSheet] for the
 * full modal surface; this composable is what previews, tests,
 * and tablet inline panels render directly.
 */
@Composable
fun PosVariantSheetContent(
    state: PosVariantUiState,
    onSelectOption: (groupName: String, optionId: Long) -> Unit,
    onAddToCart: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Text(
                text = "Pilih varian",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(12.dp))
            VariantSheetBody(
                state = state,
                onSelectOption = onSelectOption,
                onRetry = onRetry,
            )
            // CTA row is hidden in the Failed state so the kasir
            // is forced through the retry button instead of
            // adding a half-loaded product to the cart.
            if (state.loadStatus !is VariantLoadStatus.Failed) {
                Spacer(Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(Modifier.height(12.dp))
                AddToCartRow(
                    upliftIdr = state.selectedPriceUpliftIdr,
                    enabled = state.isReadyToAddToCart,
                    onAddToCart = onAddToCart,
                )
            }
        }
    }
}

/**
 * Routes between the four visible body shapes (loading, error,
 * empty-after-loaded, populated). Extracted so the surrounding
 * scaffolding (title + divider + CTA) only renders once.
 */
@Composable
private fun VariantSheetBody(
    state: PosVariantUiState,
    onSelectOption: (groupName: String, optionId: Long) -> Unit,
    onRetry: () -> Unit,
) {
    val failure = state.loadStatus as? VariantLoadStatus.Failed
    when {
        failure != null -> {
            ErrorCard(
                message = failure.message,
                onRetry = onRetry,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
            )
        }
        state.loadStatus is VariantLoadStatus.Loaded && state.groups.isEmpty() -> {
            // Successful fetch with zero variants — the sheet
            // still surfaces a clear copy line so the kasir
            // knows the empty body isn't a render bug.
            Text(
                text = "Produk ini belum punya varian.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 8.dp),
            )
        }
        state.groups.isNotEmpty() -> {
            // Cap the list height so the CTA + uplift readout
            // remain visible above the keyboard / nav bar even
            // on a very tall variant list. The lazy column
            // scrolls within the cap rather than expanding the
            // whole sheet off-screen.
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(
                    items = state.groups,
                    key = { group -> group.name },
                ) { group ->
                    VariantGroupCard(
                        group = group,
                        selectedOptionId = state.selectedOptionIdsByGroup[group.name],
                        onSelectOption = { optionId ->
                            onSelectOption(group.name, optionId)
                        },
                    )
                }
            }
        }
        else -> {
            // Idle / Loading with no cached groups — centred
            // spinner. The sheet keeps a non-trivial min height
            // so the spinner doesn't sit flush against the
            // title.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
        }
    }
}

@Composable
private fun VariantGroupCard(
    group: ProductVariantGroup,
    selectedOptionId: Long?,
    onSelectOption: (optionId: Long) -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 12.dp),
        ) {
            Text(
                text = group.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Medium,
            )
            Spacer(Modifier.height(8.dp))
            // Chips wrap onto a new row when a single row would
            // overflow the card width. `Arrangement.spacedBy` on
            // both axes keeps the inter-chip gap consistent.
            // (FilterChip + a Row that wraps via FlowRow would be
            // cleaner once we depend on `compose-foundation`'s
            // FlowRow — until then a vertical stack of horizontal
            // rows is good enough; option counts per group are
            // 2-6 in practice, never long enough to need real
            // flow.)
            ChipFlowRow(
                options = group.options,
                selectedOptionId = selectedOptionId,
                onSelectOption = onSelectOption,
            )
        }
    }
}

/**
 * Renders [options] as a column of rows, each row holding up to
 * [chipsPerRow] chips. Real flow-layout would be nicer but
 * `androidx.compose.foundation.layout.FlowRow` is still marked
 * `ExperimentalLayoutApi` in the BOM we're on; sticking to plain
 * [Row] keeps the import surface stable. Variant groups have
 * 2-6 options in practice (Ukuran S/M/L, Suhu Panas/Dingin,
 * Topping Keju/Cokelat/Susu/Coklat), so the static [chipsPerRow]
 * cap is fine — wider screens still see the same wrap point but
 * the chip widths grow to fill the row.
 */
@Composable
private fun ChipFlowRow(
    options: List<ProductVariantOption>,
    selectedOptionId: Long?,
    onSelectOption: (optionId: Long) -> Unit,
    chipsPerRow: Int = 3,
) {
    val rows = options.chunked(chipsPerRow)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (row in rows) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                for (option in row) {
                    OptionChip(
                        option = option,
                        selected = option.id == selectedOptionId,
                        onClick = { onSelectOption(option.id) },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OptionChip(
    option: ProductVariantOption,
    selected: Boolean,
    onClick: () -> Unit,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(text = chipLabel(option)) },
    )
}

/**
 * Composes the chip label as `<option label>` plus, when the
 * option's price modifier is non-zero, a `+ Rp 4.000` /
 * `- Rp 2.000` suffix. Zero-uplift options stay compact (just
 * the label) — the dominant case where a "Reguler" or "Hangat"
 * default modifier is the zero-rupiah baseline.
 */
private fun chipLabel(option: ProductVariantOption): String {
    val uplift = option.priceModifierIdr
    if (uplift == 0L) return option.label
    val sign = if (uplift > 0L) "+" else "-"
    return "${option.label}  $sign ${formatIdrLabel(kotlin.math.abs(uplift))}"
}

@Composable
private fun ErrorCard(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "Gagal memuat varian",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onRetry) {
                Text("Coba lagi")
            }
        }
    }
}

@Composable
private fun AddToCartRow(
    upliftIdr: Long,
    enabled: Boolean,
    onAddToCart: () -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Tambahan harga",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                // `+` for non-negative uplift even when zero, so the
                // kasir-facing readout stays consistent ("+ Rp 0"
                // is more obviously a "no extra charge" line than
                // an unprefixed "Rp 0"). Negative uplifts (discount
                // modifier) flip the sign.
                text = formatUplift(upliftIdr),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
        Spacer(Modifier.width(12.dp))
        Button(
            onClick = onAddToCart,
            enabled = enabled,
        ) {
            Text("Tambah ke pesanan")
        }
    }
}

private fun formatUplift(amount: Long): String {
    val sign = if (amount < 0L) "-" else "+"
    return "$sign ${formatIdrLabel(kotlin.math.abs(amount))}"
}

// -- Previews --------------------------------------------------
//
// One preview per visible body shape so a future redesign can
// eyeball every state without booting the full kasir flow. The
// previews wire the same `VIPOSTheme` the runtime uses so the
// brand teal lands in the chip / CTA tints.

private val SamplePreviewGroups: List<ProductVariantGroup> = listOf(
    ProductVariantGroup(
        name = "Ukuran",
        options = listOf(
            ProductVariantOption(
                id = 11,
                label = "Reguler",
                priceModifierIdr = 0,
                skuSuffix = null,
                stockOrNull = null,
                isDefault = true,
            ),
            ProductVariantOption(
                id = 12,
                label = "Large",
                priceModifierIdr = 4_000,
                skuSuffix = "L",
                stockOrNull = null,
                isDefault = false,
            ),
        ),
    ),
    ProductVariantGroup(
        name = "Topping",
        options = listOf(
            ProductVariantOption(
                id = 21,
                label = "Tanpa topping",
                priceModifierIdr = 0,
                skuSuffix = null,
                stockOrNull = null,
                isDefault = true,
            ),
            ProductVariantOption(
                id = 22,
                label = "Keju",
                priceModifierIdr = 5_000,
                skuSuffix = "KJ",
                stockOrNull = 18,
                isDefault = false,
            ),
            ProductVariantOption(
                id = 23,
                label = "Cokelat",
                priceModifierIdr = 6_000,
                skuSuffix = "CK",
                stockOrNull = 12,
                isDefault = false,
            ),
        ),
    ),
)

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun PosVariantSheetContentLoadedPreview() {
    VIPOSTheme {
        PosVariantSheetContent(
            state = PosVariantUiState(
                productId = 7,
                groups = SamplePreviewGroups,
                loadStatus = VariantLoadStatus.Loaded,
                selectedOptionIdsByGroup = mapOf(
                    "Ukuran" to 12L, // kasir picked Large
                    "Topping" to 22L, // and Keju
                ),
            ),
            onSelectOption = { _, _ -> },
            onAddToCart = {},
            onRetry = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun PosVariantSheetContentLoadedDefaultsPreview() {
    // Auto-default-pick state: Reguler + Tanpa topping → both
    // zero-uplift options, so the readout shows "+ Rp 0" and
    // the CTA is enabled (every group has a selection).
    VIPOSTheme {
        PosVariantSheetContent(
            state = PosVariantUiState(
                productId = 7,
                groups = SamplePreviewGroups,
                loadStatus = VariantLoadStatus.Loaded,
                selectedOptionIdsByGroup = mapOf(
                    "Ukuran" to 11L,
                    "Topping" to 21L,
                ),
            ),
            onSelectOption = { _, _ -> },
            onAddToCart = {},
            onRetry = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun PosVariantSheetContentLoadingPreview() {
    VIPOSTheme {
        PosVariantSheetContent(
            state = PosVariantUiState(
                productId = 7,
                groups = emptyList(),
                loadStatus = VariantLoadStatus.Loading,
                selectedOptionIdsByGroup = emptyMap(),
            ),
            onSelectOption = { _, _ -> },
            onAddToCart = {},
            onRetry = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun PosVariantSheetContentEmptyLoadedPreview() {
    // A product with zero variants reaches Loaded with empty
    // groups. The CTA is enabled (no per-group selection
    // gate to satisfy) so the kasir can still add the bare
    // product to the cart.
    VIPOSTheme {
        PosVariantSheetContent(
            state = PosVariantUiState(
                productId = 9,
                groups = emptyList(),
                loadStatus = VariantLoadStatus.Loaded,
                selectedOptionIdsByGroup = emptyMap(),
            ),
            onSelectOption = { _, _ -> },
            onAddToCart = {},
            onRetry = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun PosVariantSheetContentFailedPreview() {
    VIPOSTheme {
        PosVariantSheetContent(
            state = PosVariantUiState(
                productId = 7,
                groups = emptyList(),
                loadStatus = VariantLoadStatus.Failed(
                    message = "Tidak bisa memuat varian produk. Coba lagi.",
                ),
                selectedOptionIdsByGroup = emptyMap(),
            ),
            onSelectOption = { _, _ -> },
            onAddToCart = {},
            onRetry = {},
        )
    }
}
