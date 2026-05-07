package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.domain.ProductVariantGroup

/**
 * UI state for the variant / modifier sheet (P3-07 second slice).
 *
 * The sheet is opened per-product (the kasir taps a catalogue
 * card and the bottom-sheet animates up); the ViewModel that
 * owns this state is [PosVariantViewModel] and survives
 * configuration change but not the sheet being dismissed.
 *
 * The state holds three orthogonal axes:
 *
 *  - [productId] — the product the sheet was opened for. `null`
 *    in the [VariantLoadStatus.Idle] state because the ViewModel
 *    is constructed before the kasir has tapped a card; once
 *    [PosVariantViewModel.loadFor] runs this is pinned and
 *    doesn't change for the life of this state instance.
 *  - [groups] — the latest non-empty grouped variants (kept
 *    populated even while a retry is in flight so the sheet
 *    doesn't blank out on transient errors).
 *  - [loadStatus] — the lifecycle of the variant fetch.
 *
 * Group + option selection (which option is active inside each
 * group) is intentionally NOT modelled here yet — that lands in
 * the third slice once the cart-line wiring is in scope. This
 * slice only owns the fetch + parse + grouped-display data.
 */
data class PosVariantUiState(
    val productId: Long? = null,
    val groups: List<ProductVariantGroup> = emptyList(),
    val loadStatus: VariantLoadStatus = VariantLoadStatus.Idle,
)

/**
 * Sealed lifecycle for the per-product variant fetch.
 *
 *  - [Idle]    — ViewModel was constructed but no product has
 *                been opened yet.
 *  - [Loading] — fetch in flight; [PosVariantUiState.groups] may
 *                already be populated from a previous load
 *                (cross-product reuse is not currently supported,
 *                but the cleared transition lives in
 *                [PosVariantViewModel.loadFor]).
 *  - [Loaded]  — last fetch completed cleanly (possibly empty —
 *                a product without any variants is a valid
 *                terminal state, not an error).
 *  - [Failed]  — last fetch threw; carries a user-facing message
 *                for the error banner inside the sheet.
 */
sealed interface VariantLoadStatus {
    data object Idle : VariantLoadStatus
    data object Loading : VariantLoadStatus
    data object Loaded : VariantLoadStatus
    data class Failed(val message: String) : VariantLoadStatus
}
