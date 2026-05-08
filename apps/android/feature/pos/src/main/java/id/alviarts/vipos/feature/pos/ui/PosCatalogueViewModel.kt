package id.alviarts.vipos.feature.pos.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.core.database.dao.OutboxDao
import id.alviarts.vipos.core.network.ConnectivityObserver
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

    private companion object {
        private const val DEFAULT_ERROR_MESSAGE: String =
            "Tidak bisa memuat katalog produk. Coba lagi."
    }
}
