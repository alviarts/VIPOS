package id.alviarts.vipos.feature.pos.domain

/**
 * One line item in the in-memory cart.
 *
 * Originally shipped in P3-06 with just product snapshot fields;
 * extended in P3-07 fifth slice with [unitPriceUpliftIdr] +
 * [selectedOptionLabels] so cart lines can carry the variant
 * picks the kasir made on the modifier sheet. The new fields
 * default to additive zero so existing P3-06 callers (no-variant
 * products) keep compiling unchanged.
 *
 * The product snapshot ([productId], [name], [unitPriceIdr]) is
 * captured at the moment the kasir taps "tambah" so a price
 * change midway through a session doesn't retroactively rewrite
 * the running cart. The variant snapshot
 * ([unitPriceUpliftIdr], [selectedOptionLabels]) is captured the
 * same way — at add-to-cart time — so the cart total stays
 * deterministic even if the kasir later re-opens the sheet for
 * a fresh add.
 */
data class CartItem(
    val productId: Long,
    val name: String,
    /** Base selling price in IDR per single unit, captured at add-to-cart time. */
    val unitPriceIdr: Long,
    val quantity: Int,
    /**
     * Sum of `priceModifierIdr` across the variant options the
     * kasir picked when adding this line (e.g. +Rp 4.000 for a
     * "Large" size, -Rp 2.000 for an "ambil sendiri" discount).
     * Always whole-rupiah; `0` for products without variants or
     * when every selected option is the zero-uplift default.
     *
     * Cart-line identity in [PosCatalogueViewModel] keys on
     * (`productId`, `unitPriceUpliftIdr`) so two adds of the
     * same product with different modifier picks stay as
     * separate lines instead of collapsing.
     */
    val unitPriceUpliftIdr: Long = 0,
    /**
     * Display labels for the variant options selected on this
     * line, in group order (e.g. `["Large", "Less Sugar"]`).
     * Empty for products without variants. The cart UI renders
     * these as a subtitle under [name] so the kasir can verify
     * what they're charging at a glance.
     */
    val selectedOptionLabels: List<String> = emptyList(),
) {
    /**
     * Effective unit price after applying the variant uplift —
     * i.e. what one unit of this configured line costs.
     */
    val effectiveUnitPriceIdr: Long get() = unitPriceIdr + unitPriceUpliftIdr

    /** Pre-computed line total in IDR (whole-rupiah math, no float drift). */
    val lineTotalIdr: Long get() = effectiveUnitPriceIdr * quantity
}
