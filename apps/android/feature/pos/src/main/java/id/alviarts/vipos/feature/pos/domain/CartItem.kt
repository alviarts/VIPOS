package id.alviarts.vipos.feature.pos.domain

/**
 * One line item in the in-memory cart (P3-06).
 *
 * The full cart UI in P3-07 introduces modifier picks, per-item
 * notes, and per-item discount lines — none of those land here;
 * P3-06 only ships the minimum surface that exercises the
 * authenticated catalogue fetch and gives the kasir a
 * reviewable subtotal. Later sub-PRs extend this data class
 * additively.
 *
 * The product snapshot ([productId], [name], [unitPriceIdr]) is
 * captured at the moment the kasir taps "tambah" so a price
 * change midway through a session doesn't retroactively rewrite
 * the running cart.
 */
data class CartItem(
    val productId: Long,
    val name: String,
    /** Selling price in IDR per single unit, captured at add-to-cart time. */
    val unitPriceIdr: Long,
    val quantity: Int,
) {
    /** Pre-computed line total in IDR (whole-rupiah math, no float drift). */
    val lineTotalIdr: Long get() = unitPriceIdr * quantity
}
