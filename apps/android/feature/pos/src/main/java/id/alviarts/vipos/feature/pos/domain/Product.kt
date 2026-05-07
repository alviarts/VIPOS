package id.alviarts.vipos.feature.pos.domain

/**
 * UI-shape product (P3-06).
 *
 * Carved out of [id.alviarts.vipos.feature.pos.data.ProductDto] so
 * the catalogue ViewModel can carry a non-nullable price, a
 * stable display name (no leading whitespace, no empty string),
 * and a stable category label without forcing the screen to
 * defensively unwrap optionals on every recomposition.
 *
 * The repository is responsible for filtering DTOs that don't
 * have enough information to render (no name, no price); those
 * are silently dropped instead of being represented as a
 * partial UI row.
 */
data class Product(
    val id: Long,
    val name: String,
    /** Selling price in IDR (whole-rupiah; see [ProductDto.price]). */
    val priceIdr: Long,
    val categoryName: String?,
    val sku: String?,
)
