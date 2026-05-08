package id.alviarts.vipos.feature.pos.ui

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
) {
    /** Sum of every cart line in IDR; `0` when empty. */
    val cartSubtotalIdr: Long get() = cart.sumOf { it.lineTotalIdr }

    /** Total number of physical units in the cart (sum of quantities). */
    val cartItemCount: Int get() = cart.sumOf { it.quantity }

    /** True if the cart has a registered customer (not walk-in). */
    val hasRegisteredCustomer: Boolean get() = selectedCustomer != null
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
