package id.alviarts.vipos.feature.pos.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.core.database.dao.KeyValueCacheDao
import id.alviarts.vipos.core.database.dao.OutboxDao
import id.alviarts.vipos.core.database.entity.KeyValueCacheEntity
import id.alviarts.vipos.core.network.ConnectivityObserver
import id.alviarts.vipos.feature.pos.data.CustomerDto
import id.alviarts.vipos.feature.pos.data.CustomerRepository
import id.alviarts.vipos.feature.pos.data.PosRepository
import id.alviarts.vipos.feature.pos.domain.CartItem
import id.alviarts.vipos.feature.pos.domain.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Drives the POS catalogue + cart screen (P3-06).
 *
 * Responsibilities:
 *  - Trigger an authenticated `GET /api/v1/products` on screen
 *    entry. The OkHttp [id.alviarts.vipos.core.network.AuthInterceptor]
 *    decorates this request with `Authorization: Bearer …`
 *    using whatever the persisted [TokenStorage] currently
 *    holds, so the ViewModel itself never touches tokens.
 *  - Maintain the running cart in [PosCatalogueUiState.cart].
 *    [addToCart], [increment], [decrement], and [removeFromCart]
 *    are pure transforms over the current state.
 *
 * Errors from the catalogue fetch land in [LoadStatus.Failed]
 * with a human-readable Indonesian message; the ViewModel does
 * NOT distinguish 401 here. The 401-on-authenticated-endpoint
 * path is owned by the OkHttp Authenticator that lands in
 * P3-03f, which clears [TokenStorage] and lets `SessionGate`
 * route back to login on the next composition.
 */
@HiltViewModel
class PosCatalogueViewModel @Inject constructor(
    private val repository: PosRepository,
    private val customerRepository: CustomerRepository,
    private val kvCache: KeyValueCacheDao,
    connectivityObserver: ConnectivityObserver,
    outboxDao: OutboxDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PosCatalogueUiState())
    val uiState: StateFlow<PosCatalogueUiState> = _uiState.asStateFlow()

    /**
     * Reactive network connectivity state. Emits `true` when the
     * device has internet, `false` when it doesn't. Collected by
     * [PosCatalogueRoute] and passed to
     * [CheckoutViewModel.start] so the payment-method picker
     * filters online-only methods (QRIS Dynamic, e-wallets) when
     * the device is offline.
     *
     * Starts with `true` (optimistic default) and stays alive as
     * long as the ViewModel is alive (WhileSubscribed with a 5s
     * stop timeout to survive config changes).
     */
    val isOnline: StateFlow<Boolean> = connectivityObserver.observe()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000L),
            initialValue = true,
        )

    /**
     * Number of pending outbox entries waiting to sync (P3-09).
     * Drives the sync badge in the TopAppBar.
     */
    val pendingSyncCount: StateFlow<Int> = outboxDao.countPending()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000L),
            initialValue = 0,
        )

    /**
     * Number of failed outbox entries (DLQ) that need manual
     * review (P3-09). Drives the error badge.
     */
    val failedSyncCount: StateFlow<Int> = outboxDao.countFailed()
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000L),
            initialValue = 0,
        )

    init {
        refresh()
        loadFavoritesAndRecent()
    }

    fun refresh() {
        if (_uiState.value.loadStatus is LoadStatus.Loading) return
        _uiState.update { it.copy(loadStatus = LoadStatus.Loading) }

        viewModelScope.launch {
            val result = repository.loadCatalogue()
            _uiState.update { current ->
                result.fold(
                    onSuccess = { products ->
                        current.copy(
                            loadStatus = LoadStatus.Loaded,
                            products = products,
                        )
                    },
                    onFailure = { throwable ->
                        current.copy(
                            loadStatus = LoadStatus.Failed(
                                message = throwable.localizedMessage
                                    ?: throwable.message
                                    ?: DEFAULT_ERROR_MESSAGE,
                            ),
                        )
                    },
                )
            }
        }
    }

    /**
     * Append (or merge) a configured cart line for [product].
     *
     * Cart-line identity keys on (`productId`,
     * `unitPriceUpliftIdr`) — adding the same product twice with
     * the SAME modifier-uplift collapses into a single line with
     * incremented quantity (the typical "kasir taps Tambah twice
     * for two iced lattes" flow). Adding with a DIFFERENT
     * uplift (e.g. once Large, once Small) creates a separate
     * line so the cart can carry both configurations side by
     * side without losing modifier picks.
     *
     * Defaults preserve P3-06 callers (no-variant products) —
     * they pass just `product` and get the legacy zero-uplift,
     * empty-labels semantics for free.
     */
    fun addToCart(
        product: Product,
        unitPriceUpliftIdr: Long = 0,
        selectedOptionLabels: List<String> = emptyList(),
    ) {
        trackRecent(product.id)
        _uiState.update { state ->
            val existingIndex = state.cart.indexOfFirst {
                it.productId == product.id && it.unitPriceUpliftIdr == unitPriceUpliftIdr
            }
            val newCart = if (existingIndex >= 0) {
                state.cart.mapIndexed { index, item ->
                    if (index == existingIndex) item.copy(quantity = item.quantity + 1) else item
                }
            } else {
                state.cart + CartItem(
                    productId = product.id,
                    name = product.name,
                    unitPriceIdr = product.priceIdr,
                    quantity = 1,
                    unitPriceUpliftIdr = unitPriceUpliftIdr,
                    selectedOptionLabels = selectedOptionLabels,
                )
            }
            state.copy(cart = newCart)
        }
    }

    /**
     * Increment the cart line keyed by ([productId],
     * [unitPriceUpliftIdr]). Silently no-ops if no line matches
     * — same defensive contract as [decrement] and
     * [removeFromCart].
     */
    fun increment(productId: Long, unitPriceUpliftIdr: Long = 0) {
        _uiState.update { state ->
            state.copy(
                cart = state.cart.map { item ->
                    if (item.productId == productId && item.unitPriceUpliftIdr == unitPriceUpliftIdr) {
                        item.copy(quantity = item.quantity + 1)
                    } else {
                        item
                    }
                },
            )
        }
    }

    /**
     * Decrement the cart line keyed by ([productId],
     * [unitPriceUpliftIdr]) by one. Removes the line when
     * quantity would drop to zero so the cart never carries
     * phantom zero-quantity rows.
     */
    fun decrement(productId: Long, unitPriceUpliftIdr: Long = 0) {
        _uiState.update { state ->
            state.copy(
                cart = state.cart.mapNotNull { item ->
                    if (item.productId != productId || item.unitPriceUpliftIdr != unitPriceUpliftIdr) {
                        item
                    } else if (item.quantity <= 1) {
                        null
                    } else {
                        item.copy(quantity = item.quantity - 1)
                    }
                },
            )
        }
    }

    fun removeFromCart(productId: Long, unitPriceUpliftIdr: Long = 0) {
        _uiState.update { state ->
            state.copy(
                cart = state.cart.filterNot {
                    it.productId == productId && it.unitPriceUpliftIdr == unitPriceUpliftIdr
                },
            )
        }
    }

    fun clearCart() {
        _uiState.update { it.copy(cart = emptyList()) }
    }

    // -- Customer management (P3-16) --------------------------

    /** Search customers by name/phone. */
    fun searchCustomers(query: String) {
        _uiState.update { it.copy(customerSearching = true) }
        viewModelScope.launch {
            customerRepository.search(query).fold(
                onSuccess = { customers ->
                    _uiState.update {
                        it.copy(
                            customerSearching = false,
                            customerSearchResults = customers,
                        )
                    }
                },
                onFailure = {
                    _uiState.update { it.copy(customerSearching = false) }
                },
            )
        }
    }

    /** Select a customer for the current cart. Pass null for walk-in. */
    fun selectCustomer(customer: CustomerDto?) {
        _uiState.update { it.copy(selectedCustomer = customer) }
    }

    /** Quick-add a new customer and select them. */
    fun quickAddCustomer(name: String, phone: String?) {
        viewModelScope.launch {
            customerRepository.quickAdd(name, phone).fold(
                onSuccess = { customer ->
                    _uiState.update {
                        it.copy(
                            selectedCustomer = customer,
                            customerSearchResults = listOf(customer) + it.customerSearchResults,
                        )
                    }
                },
                onFailure = { /* Toast handled by caller */ },
            )
        }
    }

    // -- Search + favorites + recent (P3-19) --------------------

    /** Update the search query for client-side product filtering. */
    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    /** Toggle a product as favorite (pin/unpin). */
    fun toggleFavorite(productId: Long) {
        _uiState.update { state ->
            val newFavorites = if (productId in state.favoriteProductIds) {
                state.favoriteProductIds - productId
            } else {
                state.favoriteProductIds + productId
            }
            state.copy(favoriteProductIds = newFavorites)
        }
        saveFavorites()
    }

    /** Track a product as recently used (called on addToCart). */
    private fun trackRecent(productId: Long) {
        _uiState.update { state ->
            val updated = (listOf(productId) + state.recentProductIds.filter { it != productId })
                .take(MAX_RECENT_ITEMS)
            state.copy(recentProductIds = updated)
        }
        saveRecent()
    }

    private fun loadFavoritesAndRecent() {
        viewModelScope.launch {
            val favEntry = kvCache.get(KEY_FAVORITES)
            if (favEntry != null) {
                val ids = favEntry.value.split(",").mapNotNull { it.toLongOrNull() }.toSet()
                _uiState.update { it.copy(favoriteProductIds = ids) }
            }
            val recentEntry = kvCache.get(KEY_RECENT)
            if (recentEntry != null) {
                val ids = recentEntry.value.split(",").mapNotNull { it.toLongOrNull() }
                _uiState.update { it.copy(recentProductIds = ids) }
            }
        }
    }

    private fun saveFavorites() {
        viewModelScope.launch {
            val value = _uiState.value.favoriteProductIds.joinToString(",")
            kvCache.upsert(KeyValueCacheEntity(KEY_FAVORITES, value, System.currentTimeMillis()))
        }
    }

    private fun saveRecent() {
        viewModelScope.launch {
            val value = _uiState.value.recentProductIds.joinToString(",")
            kvCache.upsert(KeyValueCacheEntity(KEY_RECENT, value, System.currentTimeMillis()))
        }
    }

    private companion object {
        private const val DEFAULT_ERROR_MESSAGE: String =
            "Tidak bisa memuat katalog produk. Coba lagi."
        private const val KEY_FAVORITES = "pos_favorite_products"
        private const val KEY_RECENT = "pos_recent_products"
        private const val MAX_RECENT_ITEMS = 20
    }
}
