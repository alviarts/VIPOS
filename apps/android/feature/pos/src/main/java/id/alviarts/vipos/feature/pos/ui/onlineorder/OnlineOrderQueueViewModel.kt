package id.alviarts.vipos.feature.pos.ui.onlineorder

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.OnlineOrderActionRequestDto
import id.alviarts.vipos.feature.pos.data.OnlineOrderDto
import id.alviarts.vipos.feature.pos.data.PosApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for online order queue screen (P4-01).
 *
 * Manages list of online orders with status filtering and
 * action handling (accept, reject, ready, complete, cancel).
 */
@HiltViewModel
class OnlineOrderQueueViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(OnlineOrderQueueUiState())
    val uiState: StateFlow<OnlineOrderQueueUiState> = _uiState.asStateFlow()

    init {
        loadOrders()
    }

    fun loadOrders(refresh: Boolean = false) {
        viewModelScope.launch {
            if (refresh) {
                _uiState.update { it.copy(isRefreshing = true) }
            } else {
                _uiState.update { it.copy(isLoading = true) }
            }

            try {
                val response = posApi.listOnlineOrders(
                    status = _uiState.value.selectedStatus,
                    channel = _uiState.value.selectedChannel,
                    limit = 100,
                    offset = 0,
                )

                _uiState.update {
                    it.copy(
                        orders = response.items,
                        isLoading = false,
                        isRefreshing = false,
                        error = null,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        error = e.message ?: "Gagal memuat pesanan online",
                    )
                }
            }
        }
    }

    fun setStatusFilter(status: String?) {
        _uiState.update { it.copy(selectedStatus = status) }
        loadOrders(refresh = true)
    }

    fun setChannelFilter(channel: String?) {
        _uiState.update { it.copy(selectedChannel = channel) }
        loadOrders(refresh = true)
    }

    fun acceptOrder(orderId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(processingOrderId = orderId) }
            try {
                val updatedOrder = posApi.acceptOnlineOrder(orderId)
                updateOrderInList(updatedOrder)
                _uiState.update { it.copy(processingOrderId = null, error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        processingOrderId = null,
                        error = e.message ?: "Gagal menerima pesanan",
                    )
                }
            }
        }
    }

    fun rejectOrder(orderId: Long, reason: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(processingOrderId = orderId) }
            try {
                val updatedOrder = posApi.rejectOnlineOrder(
                    orderId,
                    OnlineOrderActionRequestDto(reason = reason),
                )
                updateOrderInList(updatedOrder)
                _uiState.update { it.copy(processingOrderId = null, error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        processingOrderId = null,
                        error = e.message ?: "Gagal menolak pesanan",
                    )
                }
            }
        }
    }

    fun markReady(orderId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(processingOrderId = orderId) }
            try {
                val updatedOrder = posApi.markOnlineOrderReady(orderId)
                updateOrderInList(updatedOrder)
                _uiState.update { it.copy(processingOrderId = null, error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        processingOrderId = null,
                        error = e.message ?: "Gagal menandai pesanan siap",
                    )
                }
            }
        }
    }

    fun completeOrder(orderId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(processingOrderId = orderId) }
            try {
                val updatedOrder = posApi.completeOnlineOrder(orderId)
                updateOrderInList(updatedOrder)
                _uiState.update { it.copy(processingOrderId = null, error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        processingOrderId = null,
                        error = e.message ?: "Gagal menyelesaikan pesanan",
                    )
                }
            }
        }
    }

    fun cancelOrder(orderId: Long, reason: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(processingOrderId = orderId) }
            try {
                val updatedOrder = posApi.cancelOnlineOrder(
                    orderId,
                    OnlineOrderActionRequestDto(reason = reason),
                )
                updateOrderInList(updatedOrder)
                _uiState.update { it.copy(processingOrderId = null, error = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        processingOrderId = null,
                        error = e.message ?: "Gagal membatalkan pesanan",
                    )
                }
            }
        }
    }

    private fun updateOrderInList(updatedOrder: OnlineOrderDto) {
        _uiState.update { state ->
            state.copy(
                orders = state.orders.map { order ->
                    if (order.id == updatedOrder.id) updatedOrder else order
                },
            )
        }
    }

    fun refresh() {
        loadOrders(refresh = true)
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class OnlineOrderQueueUiState(
    val orders: List<OnlineOrderDto> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val selectedStatus: String? = null,
    val selectedChannel: String? = null,
    val processingOrderId: Long? = null,
)
