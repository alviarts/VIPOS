package id.alviarts.vipos.feature.pos.ui.outlet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.OutletCreateRequestDto
import id.alviarts.vipos.feature.pos.data.OutletDto
import id.alviarts.vipos.feature.pos.data.OutletSwitchRequestDto
import id.alviarts.vipos.feature.pos.data.OutletUpdateRequestDto
import id.alviarts.vipos.feature.pos.data.PosApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for outlet management (P4-11).
 * 
 * Features:
 * - List outlets with filters
 * - View outlet detail
 * - Create/update/delete outlet (admin)
 * - Switch active outlet
 */
@HiltViewModel
class OutletViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(OutletUiState())
    val uiState: StateFlow<OutletUiState> = _uiState.asStateFlow()

    init {
        loadOutlets()
    }

    fun loadOutlets(isActive: Boolean? = null) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val outlets = posApi.getOutlets(isActive = isActive)

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        outlets = outlets,
                        selectedIsActive = isActive,
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

    fun loadOutletDetail(outletId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingDetail = true, error = null) }

            try {
                val outlet = posApi.getOutletDetail(outletId = outletId)

                _uiState.update {
                    it.copy(
                        isLoadingDetail = false,
                        currentOutlet = outlet,
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

    fun createOutlet(
        request: OutletCreateRequestDto,
        onSuccess: (Long) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isCreating = true, error = null) }

            try {
                val created = posApi.createOutlet(request)
                _uiState.update { it.copy(isCreating = false) }
                loadOutlets()
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

    fun updateOutlet(
        outletId: Long,
        request: OutletUpdateRequestDto,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isUpdating = true, error = null) }

            try {
                val updated = posApi.updateOutlet(outletId = outletId, request = request)
                _uiState.update {
                    it.copy(
                        isUpdating = false,
                        currentOutlet = updated,
                    )
                }
                loadOutlets()
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

    fun deleteOutlet(
        outletId: Long,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isDeleting = true, error = null) }

            try {
                posApi.deleteOutlet(outletId = outletId)
                _uiState.update { it.copy(isDeleting = false) }
                loadOutlets()
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

    fun switchOutlet(
        outletId: Long,
        onSuccess: (String) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSwitching = true, error = null) }

            try {
                val response = posApi.switchOutlet(OutletSwitchRequestDto(outletId = outletId))
                _uiState.update {
                    it.copy(
                        isSwitching = false,
                        activeOutletId = response.outletId,
                    )
                }
                onSuccess(response.outletName)
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSwitching = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun filterByActive(isActive: Boolean?) {
        loadOutlets(isActive = isActive)
    }

    fun clearFilters() {
        loadOutlets()
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearCurrentOutlet() {
        _uiState.update { it.copy(currentOutlet = null) }
    }
}

data class OutletUiState(
    val isLoading: Boolean = false,
    val isLoadingDetail: Boolean = false,
    val isCreating: Boolean = false,
    val isUpdating: Boolean = false,
    val isDeleting: Boolean = false,
    val isSwitching: Boolean = false,
    val outlets: List<OutletDto> = emptyList(),
    val currentOutlet: OutletDto? = null,
    val activeOutletId: Long? = null,
    val selectedIsActive: Boolean? = null,
    val error: String? = null,
)
