package id.alviarts.vipos.feature.pos.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.PosRepository
import id.alviarts.vipos.feature.pos.domain.CartItem
import id.alviarts.vipos.feature.pos.domain.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
) : ViewModel() {

    private val _uiState = MutableStateFlow(PosCatalogueUiState())
    val uiState: StateFlow<PosCatalogueUiState> = _uiState.asStateFlow()

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

    fun addToCart(product: Product) {
        _uiState.update { state ->
            val existingIndex = state.cart.indexOfFirst { it.productId == product.id }
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
                )
            }
            state.copy(cart = newCart)
        }
    }

    fun increment(productId: Long) {
        _uiState.update { state ->
            state.copy(
                cart = state.cart.map { item ->
                    if (item.productId == productId) item.copy(quantity = item.quantity + 1) else item
                },
            )
        }
    }

    /**
     * Decrement the quantity of [productId] by one. Removes the
     * line when quantity would drop to zero so the cart never
     * carries phantom zero-quantity rows.
     */
    fun decrement(productId: Long) {
        _uiState.update { state ->
            state.copy(
                cart = state.cart.mapNotNull { item ->
                    if (item.productId != productId) {
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

    fun removeFromCart(productId: Long) {
        _uiState.update { state ->
            state.copy(cart = state.cart.filterNot { it.productId == productId })
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
