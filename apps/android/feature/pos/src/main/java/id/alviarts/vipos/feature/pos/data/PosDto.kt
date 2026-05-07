package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire-shape DTOs for the `GET /api/v1/products` endpoint
 * (P3-06).
 *
 * Mirrors the backend handler in `apps/backend/src/routes/products.js`.
 * The endpoint returns either a bare array (legacy / no `page`
 * query param) or a paged envelope; this module always asks for
 * the paged shape so the response type is stable.
 *
 * Fields use `@SerialName` to match the backend's snake_case
 * JSON exactly. Every field is nullable / has a default — the
 * Phase 3 backend's product table is wide and the kasir UI only
 * needs a small subset, so unknown / null columns must not crash
 * the parser. `NetworkClientFactory.json` already enables
 * `ignoreUnknownKeys` and `coerceInputValues`, so columns we
 * don't model here are silently dropped and a `null` for a
 * non-nullable field falls back to its default rather than
 * throwing.
 */
@Serializable
data class ProductDto(
    @SerialName("id") val id: Long,
    @SerialName("name") val name: String,
    @SerialName("sku") val sku: String? = null,
    /**
     * Selling price in IDR. The backend stores rupiah without a
     * decimal scale (Indonesia uses whole-rupiah pricing), so a
     * [Long] is the right type — `Double` would risk float-drift
     * on subtotal calculations and `BigDecimal` is overkill for
     * integer math.
     */
    @SerialName("price") val price: Long? = null,
    @SerialName("category_id") val categoryId: Long? = null,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("image_url") val imageUrl: String? = null,
    @SerialName("is_active") val isActive: Int? = null,
    @SerialName("is_tampil_di_menu") val isTampilDiMenu: Int? = null,
)

/**
 * Paged response envelope returned when the request includes a
 * `page=` query param. The kasir UI always asks for paged so the
 * response type is predictable.
 */
@Serializable
data class ProductsPageDto(
    @SerialName("data") val data: List<ProductDto> = emptyList(),
    @SerialName("total") val total: Long = 0,
    @SerialName("page") val page: Long = 1,
    @SerialName("per_page") val perPage: Long = 0,
    @SerialName("total_pages") val totalPages: Long = 0,
)
