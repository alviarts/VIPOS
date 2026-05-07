package id.alviarts.vipos.feature.pos.domain

/**
 * One selectable option inside a [ProductVariantGroup]
 * (P3-07 first slice — variant data layer).
 *
 * `priceModifierIdr` is whole-rupiah and rounded from the wire's
 * decimal `price_modifier` so subtotal math stays integer (matches
 * the convention in [Product.priceIdr] and [CartItem.unitPriceIdr]).
 * Negative values are valid — the backend allows discount-style
 * modifiers (e.g. an "ambil sendiri" option that takes Rp -2.000
 * off the takeaway price).
 *
 * `stockOrNull` is intentionally nullable: a `null` reflects the
 * backend's "not-tracked" sentinel (column is nullable on the
 * Postgres side). The UI surfaces "stok tidak dilacak" rather than
 * confusing "0 in stock" / "out of stock" copy when this is null.
 */
data class ProductVariantOption(
    val id: Long,
    val label: String,
    val priceModifierIdr: Long,
    val skuSuffix: String?,
    val stockOrNull: Int?,
    val isDefault: Boolean,
)

/**
 * One option group attached to a product (P3-07 first slice).
 *
 * The backend stores variants as a flat array of rows where rows
 * sharing a `group_name` form a logical group; the repository
 * folds the flat array into this shape so the UI never has to
 * group-by at render time. Within each group, options are ordered
 * by `sort_order` ascending then `id` ascending — matching the
 * SQL `ORDER BY group_name, sort_order, id` on the backend so the
 * client and server agree on display order even if a row's
 * sort_order is null.
 *
 * `name` is preserved exactly as the backend stored it (after
 * `.trim()`); the UI is responsible for any locale-aware
 * capitalisation.
 */
data class ProductVariantGroup(
    val name: String,
    val options: List<ProductVariantOption>,
)
