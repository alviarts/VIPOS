package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.domain.ProductVariantGroup
import id.alviarts.vipos.feature.pos.domain.ProductVariantOption

/**
 * UI state for the variant / modifier sheet (P3-07).
 *
 * The sheet is opened per-product (the kasir taps a catalogue
 * card and the bottom-sheet animates up); the ViewModel that
 * owns this state is [PosVariantViewModel] and survives
 * configuration change but not the sheet being dismissed.
 *
 * The state holds four orthogonal axes:
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
 *  - [selectedOptionIdsByGroup] — which option is currently
 *    selected within each group (added in the P3-07 third
 *    slice). Keyed by group name; value is the option id from
 *    the same group. On the [VariantLoadStatus.Loaded]
 *    transition the ViewModel auto-picks the option marked
 *    `is_default=true` per group (or the first option if no
 *    row is flagged) so the sheet always opens with a valid
 *    pick — the kasir can override but never has to start
 *    from a blank slate.
 *
 * The price-modifier total + add-to-cart readiness are derived
 * properties on this state class so the Compose layer that
 * lands in the next slice has a single source of truth.
 */
data class PosVariantUiState(
    val productId: Long? = null,
    val groups: List<ProductVariantGroup> = emptyList(),
    val loadStatus: VariantLoadStatus = VariantLoadStatus.Idle,
    val selectedOptionIdsByGroup: Map<String, Long> = emptyMap(),
) {
    /**
     * The currently-selected option in each group, in the same
     * order as [groups]. A group whose selection key isn't (yet)
     * present in [selectedOptionIdsByGroup] is omitted — callers
     * use [isReadyToAddToCart] to gate "any group missing a
     * selection" before calling.
     */
    val selectedOptions: List<ProductVariantOption>
        get() = groups.mapNotNull { group ->
            val pickedId = selectedOptionIdsByGroup[group.name] ?: return@mapNotNull null
            group.options.firstOrNull { it.id == pickedId }
        }

    /**
     * Sum of `priceModifierIdr` across every currently-selected
     * option. Equals 0 when the sheet hasn't auto-defaulted yet
     * (e.g. still in [VariantLoadStatus.Loading]) or when every
     * selected option is the zero-uplift default.
     */
    val selectedPriceUpliftIdr: Long
        get() = selectedOptions.sumOf { it.priceModifierIdr }

    /**
     * `true` when the variants finished loading successfully and
     * every group in [groups] has a selection. Required for the
     * "Tambah ke pesanan" CTA — gated on [VariantLoadStatus.Loaded]
     * so the predicate is `false` while a fetch is in flight even
     * if [groups] hasn't been populated yet (would otherwise be
     * vacuously `true` for the `all { }` predicate over an empty
     * list). A product with zero variants reaches Loaded with an
     * empty [groups] and is trivially ready.
     */
    val isReadyToAddToCart: Boolean
        get() = loadStatus is VariantLoadStatus.Loaded &&
            groups.all { it.name in selectedOptionIdsByGroup }
}

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
