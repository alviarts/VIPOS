package id.alviarts.vipos.feature.pos.ui.onlineorder

import androidx.lifecycle.SavedStateHandle
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
 * ViewModel for online order detail screen (P4-01).
 *
 * Loads and displays full order details with action buttons.
 */
@HiltViewModel
class OnlineOrderDetailViewModel @Inject constructor(
    private val posApi: PosApi,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val orderId: Long = savedStateHandle.get<String>("orderId")?.toLongOrNull() ?: 0L

    private val _uiState = MutableStateFlow(OnlineOrderDetailUiState())
    val uiState: StateFlow<OnlineOrderDetailUiState> = _uiState.asStateFlow()

    init {
        loadOrderDetail()
    }

    fun loadOrderDetail() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            try {
                val order = posApi.getOnlineOrderDetail(orderId)
                _uiState.update {
                    it.copy(
                        order = order,
                        isLoading = false,
                        error = null,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Gagal memuat detail pesanan",
                    )
                }
            }
        }
    }

    fun acceptOrder() {
        performAction { posApi.acceptOnlineOrder(orderId) }
    }

    fun rejectOrder(reason: String) {
        performAction {
            posApi.rejectOnlineOrder(orderId, OnlineOrderActionRequestDto(reason = reason))
        }
    }

    fun markReady() {
        performAction { posApi.markOnlineOrderReady(orderId) }
    }

    fun completeOrder() {
        performAction { posApi.completeOnlineOrder(orderId) }
    }

    fun cancelOrder(reason: String) {
        performAction {
            posApi.cancelOnlineOrder(orderId, OnlineOrderActionRequestDto(reason = reason))
        }
    }

    private fun performAction(action: suspend () -> OnlineOrderDto) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true) }
            try {
                val updatedOrder = action()
                _uiState.update {
                    it.copy(
                        order = updatedOrder,
                        isProcessing = false,
                        error = null,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isProcessing = false,
                        error = e.message ?: "Gagal memproses pesanan",
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class OnlineOrderDetailUiState(
    val order: OnlineOrderDto? = null,
    val isLoading: Boolean = false,
    val isProcessing: Boolean = false,
    val error: String? = null,
)
