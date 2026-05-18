package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape for one row from `GET /api/v1/products/:id/variants`
 * (P3-07 first slice — variant data layer).
 *
 * The backend route in `apps/backend/src/routes/product-variants.js`
 * returns a flat array of variant rows, one row per option, where
 * options that share a `group_name` form a logical group (e.g.
 * `group_name="Ukuran"` with three rows for Reguler / Large / Jumbo).
 * Re-shaping the flat array into a list of [ProductVariantGroup]s
 * happens in [PosRepository.loadVariants]; this DTO mirrors the wire
 * row exactly so the parser stays simple.
 *
 * Fields use `@SerialName` to match the backend's snake_case JSON.
 * Nullable / defaulted fields cover historical rows that pre-date a
 * column being added (e.g. `sku_suffix`, `stock`) — the parser must
 * never refuse a variant row over a missing optional column.
 *
 * The `is_default` and `stock` columns are stored as integers in
 * Postgres (0/1 booleans, count). They're mapped to a domain
 * [Boolean] / [Int] in [ProductVariantOption] rather than carried
 * as raw ints into the UI layer.
 */
@Serializable
data class ProductVariantDto(
    @SerialName("id") val id: Long,
    @SerialName("product_id") val productId: Long,
    @SerialName("group_name") val groupName: String? = null,
    @SerialName("option_label") val optionLabel: String? = null,
    /**
     * Price uplift in IDR added to the product base price when this
     * option is selected. Stored as a numeric column on the backend
     * (kept as [Double] in the wire shape because Postgres'
     * `numeric` type round-trips through JS `JSON.stringify` as a
     * decimal). Whole-rupiah math in the domain layer rounds to
     * [Long] before any subtotal arithmetic — see
     * [ProductVariantOption.priceModifierIdr].
     */
    @SerialName("price_modifier") val priceModifier: Double? = null,
    @SerialName("sku_suffix") val skuSuffix: String? = null,
    /**
     * Per-option stock count (whole units, no decimals — variants
     * are sold by the unit). `null` is the historical no-tracking
     * value; the domain mapper preserves that distinction so a "stock
     * not tracked" option doesn't get confused with a "0 in stock"
     * option.
     */
    @SerialName("stock") val stock: Int? = null,
    /**
     * Marker for the backend's auto-pick option when the kasir hasn't
     * touched the variant sheet yet. Postgres stores this as 0/1.
     */
    @SerialName("is_default") val isDefault: Int? = null,
    @SerialName("sort_order") val sortOrder: Int? = null,
)
