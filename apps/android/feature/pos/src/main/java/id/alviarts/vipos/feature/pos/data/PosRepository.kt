package id.alviarts.vipos.feature.pos.data

import id.alviarts.vipos.feature.pos.domain.Product
import id.alviarts.vipos.feature.pos.domain.ProductVariantGroup
import id.alviarts.vipos.feature.pos.domain.ProductVariantOption
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToLong

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

    /**
     * Fetch the variant option groups for a single product (P3-07
     * first slice).
     *
     * The backend route returns a flat array; this method folds it
     * into [ProductVariantGroup]s keyed by `group_name` so the UI
     * never has to group-by at render time. Returns
     * [Result.success] with an empty list when:
     *  - the backend returned `[]` (no variants for this product), or
     *  - every row had a missing / blank `group_name` or
     *    `option_label` (data-quality drop, same defensive posture
     *    as [ProductDto.toDomainOrNull]).
     *
     * Returns [Result.failure] with the underlying exception on
     * network IO, HTTP non-2xx, or JSON parsing.
     *
     * Order within each group: `sort_order ASC, id ASC` — same as
     * the SQL on the backend so client + server agree on display
     * order. Groups themselves are ordered by their first option's
     * `sort_order` (and then by group name) so a natural left-to-
     * right reading order on the variant sheet falls out for free.
     */
    suspend fun loadVariants(productId: Long): Result<List<ProductVariantGroup>> =
        runCatching {
            api.listVariants(productId).toDomainGroups()
        }

    private fun List<ProductVariantDto>.toDomainGroups(): List<ProductVariantGroup> {
        // Fold the flat array into groups; preserve the index of the
        // first option in each group so we can order groups left-to-
        // right by their first option's sort_order. `sortOrder` is
        // nullable on the wire — we treat null as `Int.MAX_VALUE` so
        // historically-unlabelled rows fall to the end deterministically.
        data class Acc(val firstSort: Int, val firstId: Long, val options: MutableList<ProductVariantOption>)

        val acc = LinkedHashMap<String, Acc>()
        for (row in this) {
            val groupName = row.groupName?.trim().orEmpty()
            val optionLabel = row.optionLabel?.trim().orEmpty()
            if (groupName.isEmpty() || optionLabel.isEmpty()) continue
            val option = ProductVariantOption(
                id = row.id,
                label = optionLabel,
                priceModifierIdr = (row.priceModifier ?: 0.0).roundToLong(),
                skuSuffix = row.skuSuffix?.trim()?.takeIf { it.isNotEmpty() },
                stockOrNull = row.stock,
                isDefault = (row.isDefault ?: 0) != 0,
            )
            val rowSort = row.sortOrder ?: Int.MAX_VALUE
            val existing = acc[groupName]
            if (existing == null) {
                acc[groupName] = Acc(rowSort, row.id, mutableListOf(option))
            } else {
                existing.options.add(option)
            }
        }
        return acc
            .map { (name, bucket) ->
                bucket to ProductVariantGroup(
                    name = name,
                    options = bucket.options.sortedWith(
                        compareBy({ it.id }), // id ASC tie-break, group order is decided by Acc.firstSort
                    ),
                )
            }
            // Stable sort by (group's first sortOrder, group's first id).
            .sortedWith(compareBy({ it.first.firstSort }, { it.first.firstId }))
            .map { it.second }
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
