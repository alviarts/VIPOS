package id.alviarts.vipos.feature.pos.ui

import id.alviarts.vipos.feature.pos.data.ActivePromoDto
import id.alviarts.vipos.feature.pos.data.CustomerDto
import id.alviarts.vipos.feature.pos.domain.CartItem
import id.alviarts.vipos.feature.pos.domain.Product

/**
 * Single immutable UI state for the POS catalogue screen
 * (P3-06).
 *
 * Combines the catalogue load state with the running cart so
 * the screen has one [androidx.compose.runtime.State] to
 * `collectAsState` and the LazyColumn item heights stay stable
 * across recompositions. P3-07 will likely split the cart into
 * its own ViewModel once modifier sheets + multi-line discounts
 * land; until then everything lives here.
 *
 * @property loadStatus the lifecycle of the catalogue request.
 * @property products the latest non-empty catalogue snapshot;
 *   stays populated even while a refresh is in flight so the
 *   UI doesn't blank out on pull-to-refresh.
 * @property cart the running line-items, in insertion order.
 */
data class PosCatalogueUiState(
    val loadStatus: LoadStatus = LoadStatus.Idle,
    val products: List<Product> = emptyList(),
    val cart: List<CartItem> = emptyList(),
    /** Currently selected customer, or null for walk-in (P3-16). */
    val selectedCustomer: CustomerDto? = null,
    /** Customer search results for the picker sheet (P3-16). */
    val customerSearchResults: List<CustomerDto> = emptyList(),
    /** True while a customer search is in flight (P3-16). */
    val customerSearching: Boolean = false,
    /** Applied coupon code and discount amount (P3-15). */
    val appliedCouponCode: String? = null,
    val appliedDiscountAmount: Long = 0,
    val appliedPromoName: String? = null,
    /** Active auto-apply promos from the server (P3-15). */
    val activePromos: List<ActivePromoDto> = emptyList(),
    /** Current search/filter query for the product catalogue (P3-19). */
    val searchQuery: String = "",
    /** Product IDs pinned as favorites by the kasir (P3-19). */
    val favoriteProductIds: Set<Long> = emptySet(),
    /** Recently added product IDs, most recent first (P3-19). */
    val recentProductIds: List<Long> = emptyList(),
) {
    /** Sum of every cart line in IDR; `0` when empty. */
    val cartSubtotalIdr: Long get() = cart.sumOf { it.lineTotalIdr }

    /** Total number of physical units in the cart (sum of quantities). */
    val cartItemCount: Int get() = cart.sumOf { it.quantity }

    /** True if the cart has a registered customer (not walk-in). */
    val hasRegisteredCustomer: Boolean get() = selectedCustomer != null

    /** Cart total after applying discount (P3-15). */
    val cartTotalAfterDiscount: Long
        get() = (cartSubtotalIdr - appliedDiscountAmount).coerceAtLeast(0)

    /** True if a coupon/promo discount is applied. */
    val hasDiscount: Boolean get() = appliedDiscountAmount > 0

    /**
     * Products filtered by [searchQuery] (P3-19). Matches against
     * name, SKU, and category name (case-insensitive).
     */
    val filteredProducts: List<Product>
        get() {
            if (searchQuery.isBlank()) return products
            val q = searchQuery.lowercase()
            return products.filter { product ->
                product.name.lowercase().contains(q) ||
                    (product.sku?.lowercase()?.contains(q) == true) ||
                    (product.categoryName?.lowercase()?.contains(q) == true)
            }
        }

    /** Favorite products (subset of loaded products). */
    val favoriteProducts: List<Product>
        get() = products.filter { it.id in favoriteProductIds }

    /** Recently used products (subset of loaded products, ordered). */
    val recentProducts: List<Product>
        get() {
            val productMap = products.associateBy { it.id }
            return recentProductIds.mapNotNull { productMap[it] }
        }
}

/**
 * Sealed lifecycle for the catalogue request.
 *
 *  - [Idle]       — never asked the backend yet (initial state).
 *  - [Loading]    — request in flight; `products` may already be
 *                   populated from a previous successful load.
 *  - [Loaded]     — last fetch returned cleanly (possibly empty).
 *  - [Failed]     — last fetch threw; carries a user-facing
 *                   `message` for the error banner.
 */
sealed interface LoadStatus {
    data object Idle : LoadStatus
    data object Loading : LoadStatus
    data object Loaded : LoadStatus
    data class Failed(val message: String) : LoadStatus
}
