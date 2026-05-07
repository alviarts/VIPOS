package id.alviarts.vipos.feature.pos.data

import id.alviarts.vipos.feature.pos.domain.Product
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Bridges the wire-shape [PosApi] and the UI-shape [Product]
 * domain object (P3-06).
 *
 * Two responsibilities:
 *  - Drop products that don't have enough information to render
 *    (missing name, missing price, soft-deleted via `is_active=0`).
 *    The catalogue UI never sees a half-rendered row.
 *  - Sort the result by name (ascending) so the LazyColumn order
 *    is stable across requests; the backend currently returns
 *    rows in `id ASC` order, which is meaningless to a kasir.
 *
 * Wraps every API call in [Result] so the ViewModel can branch
 * on success / failure without catching at the call-site.
 *
 * Kept extremely thin in P3-06; richer caching (Room-backed
 * offline catalogue, last-modified hint, etc.) lands in P3-13.
 */
@Singleton
class PosRepository @Inject constructor(
    private val api: PosApi,
) {

    /**
     * Fetch the first [perPage] active products that are visible
     * on the kasir menu. Returns [Result.success] with a possibly-empty
     * list, or [Result.failure] with the underlying exception
     * (network IO, HTTP non-2xx, JSON parsing).
     */
    suspend fun loadCatalogue(perPage: Long = DEFAULT_PAGE_SIZE): Result<List<Product>> =
        runCatching {
            val page = api.listProducts(
                page = 1,
                perPage = perPage,
                activeOnly = "true",
                tampilDiMenu = "true",
            )
            page.data
                .mapNotNull { it.toDomainOrNull() }
                .sortedBy { it.name.lowercase() }
        }

    private fun ProductDto.toDomainOrNull(): Product? {
        val cleanName = name.trim()
        if (cleanName.isEmpty()) return null
        val price = price ?: return null
        if (price < 0) return null
        return Product(
            id = id,
            name = cleanName,
            priceIdr = price,
            categoryName = categoryName?.trim()?.takeIf { it.isNotEmpty() },
            sku = sku?.trim()?.takeIf { it.isNotEmpty() },
        )
    }

    private companion object {
        // 100 rows comfortably fits the median Phase 3 outlet's
        // catalogue (anecdotal: most outlets ship < 250 SKUs).
        // Pagination scrolling lands in a follow-up; for the
        // P3-06 first-cut the kasir gets the first 100 in
        // alphabetical order which is enough to demo the
        // authenticated fetch end-to-end.
        private const val DEFAULT_PAGE_SIZE: Long = 100
    }
}
