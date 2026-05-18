package id.alviarts.vipos.feature.pos.ui.inventory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.InventoryMovementCreateRequestDto
import id.alviarts.vipos.feature.pos.data.InventoryMovementDto
import id.alviarts.vipos.feature.pos.data.PosApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for inventory stock movements (P4-03).
 * 
 * Features:
 * - List stock movements with filters
 * - Create stock in/out movements
 * - View movement history per product
 */
@HiltViewModel
class InventoryViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(InventoryUiState())
    val uiState: StateFlow<InventoryUiState> = _uiState.asStateFlow()

    init {
        loadMovements()
    }

    fun loadMovements(
        productId: Long? = null,
        tipe: String? = null,
        from: String? = null,
        to: String? = null,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val movements = posApi.getInventoryMovements(
                    productId = productId,
                    tipe = tipe,
                    from = from,
                    to = to,
                    limit = 100,
                )

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        movements = movements,
                        selectedProductId = productId,
                        selectedTipe = tipe,
                        dateFrom = from,
                        dateTo = to,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun filterByTipe(tipe: String?) {
        loadMovements(
            productId = _uiState.value.selectedProductId,
            tipe = tipe,
            from = _uiState.value.dateFrom,
            to = _uiState.value.dateTo,
        )
    }

    fun filterByProduct(productId: Long?) {
        loadMovements(
            productId = productId,
            tipe = _uiState.value.selectedTipe,
            from = _uiState.value.dateFrom,
            to = _uiState.value.dateTo,
        )
    }

    fun filterByDateRange(from: String?, to: String?) {
        loadMovements(
            productId = _uiState.value.selectedProductId,
            tipe = _uiState.value.selectedTipe,
            from = from,
            to = to,
        )
    }

    fun clearFilters() {
        loadMovements()
    }

    fun createMovement(
        request: InventoryMovementCreateRequestDto,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isCreating = true, error = null) }

            try {
                posApi.createInventoryMovement(request)
                _uiState.update { it.copy(isCreating = false) }
                // Refresh list
                loadMovements()
                onSuccess()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isCreating = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class InventoryUiState(
    val isLoading: Boolean = false,
    val isCreating: Boolean = false,
    val movements: List<InventoryMovementDto> = emptyList(),
    val selectedProductId: Long? = null,
    val selectedTipe: String? = null,
    val dateFrom: String? = null,
    val dateTo: String? = null,
    val error: String? = null,
)
