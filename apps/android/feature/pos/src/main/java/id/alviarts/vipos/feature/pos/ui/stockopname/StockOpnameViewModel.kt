package id.alviarts.vipos.feature.pos.ui.stockopname

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.data.StockOpnameCreateRequestDto
import id.alviarts.vipos.feature.pos.data.StockOpnameDto
import id.alviarts.vipos.feature.pos.data.StockOpnameFinalizeRequestDto
import id.alviarts.vipos.feature.pos.data.StockOpnameUpdateItemRequestDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for stock opname (physical inventory count) - P4-04.
 * 
 * Features:
 * - List stock opname sessions (draft/final)
 * - Create new opname session
 * - Update physical counts
 * - Finalize opname (apply adjustments)
 * - Delete draft opname
 */
@HiltViewModel
class StockOpnameViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(StockOpnameUiState())
    val uiState: StateFlow<StockOpnameUiState> = _uiState.asStateFlow()

    init {
        loadOpnameList()
    }

    fun loadOpnameList(status: String? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val list = posApi.getStockOpnameList(status = status)

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        opnameList = list,
                        selectedStatus = status,
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

    fun loadOpnameDetail(opnameId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingDetail = true, error = null) }

            try {
                val detail = posApi.getStockOpnameDetail(opnameId = opnameId)

                _uiState.update {
                    it.copy(
                        isLoadingDetail = false,
                        currentOpname = detail,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingDetail = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun createOpname(
        request: StockOpnameCreateRequestDto,
        onSuccess: (Long) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isCreating = true, error = null) }

            try {
                val created = posApi.createStockOpname(request)
                _uiState.update { it.copy(isCreating = false) }
                // Refresh list
                loadOpnameList()
                onSuccess(created.id)
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

    fun updateItem(
        opnameId: Long,
        productId: Long,
        qtyFisik: Int,
        keterangan: String? = null,
        onSuccess: () -> Unit = {},
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isUpdating = true, error = null) }

            try {
                val request = StockOpnameUpdateItemRequestDto(
                    productId = productId,
                    qtyFisik = qtyFisik,
                    keterangan = keterangan,
                )
                val updated = posApi.updateStockOpnameItem(
                    opnameId = opnameId,
                    productId = productId,
                    body = request,
                )
                
                _uiState.update {
                    it.copy(
                        isUpdating = false,
                        currentOpname = updated,
                    )
                }
                onSuccess()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isUpdating = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun finalizeOpname(
        opnameId: Long,
        applyAdjustments: Boolean = true,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isFinalizing = true, error = null) }

            try {
                val request = StockOpnameFinalizeRequestDto(applyAdjustments = applyAdjustments)
                val finalized = posApi.finalizeStockOpname(
                    opnameId = opnameId,
                    body = request,
                )
                
                _uiState.update {
                    it.copy(
                        isFinalizing = false,
                        currentOpname = finalized,
                    )
                }
                // Refresh list
                loadOpnameList()
                onSuccess()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isFinalizing = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun deleteOpname(
        opnameId: Long,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isDeleting = true, error = null) }

            try {
                posApi.deleteStockOpname(opnameId = opnameId)
                _uiState.update { it.copy(isDeleting = false) }
                // Refresh list
                loadOpnameList()
                onSuccess()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isDeleting = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun filterByStatus(status: String?) {
        loadOpnameList(status = status)
    }

    fun clearFilters() {
        loadOpnameList()
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearCurrentOpname() {
        _uiState.update { it.copy(currentOpname = null) }
    }
}

data class StockOpnameUiState(
    val isLoading: Boolean = false,
    val isLoadingDetail: Boolean = false,
    val isCreating: Boolean = false,
    val isUpdating: Boolean = false,
    val isFinalizing: Boolean = false,
    val isDeleting: Boolean = false,
    val opnameList: List<StockOpnameDto> = emptyList(),
    val currentOpname: StockOpnameDto? = null,
    val selectedStatus: String? = null,
    val error: String? = null,
)
