package id.alviarts.vipos.feature.pos.domain

/**
 * Stripped-down cart-line snapshot held by [CheckoutViewModel]
 * for the duration of an in-flight checkout (P3-08 slice 5b).
 *
 * The full [CartItem] carries display-side fields ([CartItem.name],
 * [CartItem.selectedOptionLabels]) that the kasir's catalogue UI
 * needs but the transaction commit doesn't — the backend
 * `POST /api/v1/transactions` only consumes
 * `(product_id, price, quantity)` tuples (per the route at
 * `apps/backend/src/routes/transactions.js`). Snapshotting just the
 * three fields the wire requires keeps the checkout state focused
 * on what's needed to commit and avoids accidentally coupling
 * future commit work to display fields the kasir can mutate after
 * the picker opens.
 *
 * The snapshot is captured at [CheckoutViewModel.start] time, so
 * the kasir adding/removing items in the catalogue while the
 * checkout sheet is open does NOT mutate the in-flight checkout —
 * same stability contract as `cartSubtotalIdr` and `availableMethods`.
 *
 * @param productId  Backend product id; matches `CartItem.productId`.
 * @param effectiveUnitPriceIdr  Per-unit price as charged on the
 *   wire (base + variant uplift). Mirrors
 *   [CartItem.effectiveUnitPriceIdr]. Whole-rupiah math only.
 * @param quantity  Units in this line.
 */
data class CheckoutCartLine(
    val productId: Long,
    val effectiveUnitPriceIdr: Long,
    val quantity: Int,
) {
    companion object {
        /**
         * Snapshot a [CartItem] into the commit-only projection.
         * Equivalent to manual `(productId, effectiveUnitPriceIdr,
         * quantity)` extraction; provided as a one-liner so call
         * sites at the catalogue route stay terse.
         */
        fun fromCartItem(item: CartItem): CheckoutCartLine = CheckoutCartLine(
            productId = item.productId,
            effectiveUnitPriceIdr = item.effectiveUnitPriceIdr,
            quantity = item.quantity,
        )
    }
}
