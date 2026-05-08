package id.alviarts.vipos.feature.pos.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.CashierShiftDto
import id.alviarts.vipos.feature.pos.data.CashierShiftRepository
import id.alviarts.vipos.feature.pos.data.CashierShiftSummaryDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Drives the cashier shift lifecycle (P3-14).
 *
 * Responsibilities:
 *  - Check for an active shift on screen entry.
 *  - Open a new shift with opening cash amount.
 *  - Load shift summary for the close screen.
 *  - Close a shift with cash reconciliation.
 *
 * The ViewModel exposes a [CashierShiftUiState] that the
 * composable layer observes to decide which screen to show:
 *  - No active shift → OpenShiftScreen
 *  - Active shift → POS catalogue (normal flow)
 *  - Closing shift → CloseShiftScreen
 */
@HiltViewModel
class CashierShiftViewModel @Inject constructor(
    private val repository: CashierShiftRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CashierShiftUiState())
    val uiState: StateFlow<CashierShiftUiState> = _uiState.asStateFlow()

    init {
        checkActiveShift()
    }

    /**
     * Check if the user has an active (open) shift.
     */
    fun checkActiveShift() {
        _uiState.update { it.copy(loadStatus = ShiftLoadStatus.Loading) }
        viewModelScope.launch {
            repository.getActiveShift().fold(
                onSuccess = { shift ->
                    _uiState.update {
                        it.copy(
                            loadStatus = ShiftLoadStatus.Loaded,
                            activeShift = shift,
                        )
                    }
                },
                onFailure = { throwable ->
                    _uiState.update {
                        it.copy(
                            loadStatus = ShiftLoadStatus.Failed(
                                throwable.localizedMessage
                                    ?: "Gagal mengecek shift aktif",
                            ),
                        )
                    }
                },
            )
        }
    }

    /**
     * Open a new cashier shift.
     */
    fun openShift(openingCash: Long, notes: String? = null) {
        _uiState.update { it.copy(actionStatus = ShiftActionStatus.Submitting) }
        viewModelScope.launch {
            repository.openShift(openingCash, notes).fold(
                onSuccess = { shift ->
                    _uiState.update {
                        it.copy(
                            activeShift = shift,
                            actionStatus = ShiftActionStatus.Idle,
                        )
                    }
                },
                onFailure = { throwable ->
                    _uiState.update {
                        it.copy(
                            actionStatus = ShiftActionStatus.Failed(
                                throwable.localizedMessage
                                    ?: "Gagal membuka shift",
                            ),
                        )
                    }
                },
            )
        }
    }

    /**
     * Load shift summary for the close screen.
     */
    fun loadSummary() {
        val shiftId = _uiState.value.activeShift?.id ?: return
        _uiState.update { it.copy(summaryStatus = ShiftLoadStatus.Loading) }
        viewModelScope.launch {
            repository.getShiftSummary(shiftId).fold(
                onSuccess = { summary ->
                    _uiState.update {
                        it.copy(
                            summaryStatus = ShiftLoadStatus.Loaded,
                            summary = summary,
                        )
                    }
                },
                onFailure = { throwable ->
                    _uiState.update {
                        it.copy(
                            summaryStatus = ShiftLoadStatus.Failed(
                                throwable.localizedMessage
                                    ?: "Gagal memuat ringkasan shift",
                            ),
                        )
                    }
                },
            )
        }
    }

    /**
     * Close the active shift with cash reconciliation.
     */
    fun closeShift(
        closingCashCounted: Long,
        varianceReason: String? = null,
        notes: String? = null,
    ) {
        val shiftId = _uiState.value.activeShift?.id ?: return
        _uiState.update { it.copy(actionStatus = ShiftActionStatus.Submitting) }
        viewModelScope.launch {
            repository.closeShift(shiftId, closingCashCounted, varianceReason, notes).fold(
                onSuccess = { result ->
                    _uiState.update {
                        it.copy(
                            activeShift = null,
                            summary = null,
                            actionStatus = ShiftActionStatus.CloseSucceeded(
                                varianceExceedsThreshold = result.varianceExceedsThreshold,
                                variance = result.shift.variance ?: 0L,
                            ),
                        )
                    }
                },
                onFailure = { throwable ->
                    _uiState.update {
                        it.copy(
                            actionStatus = ShiftActionStatus.Failed(
                                throwable.localizedMessage
                                    ?: "Gagal menutup shift",
                            ),
                        )
                    }
                },
            )
        }
    }

    /**
     * Reset action status back to Idle (after showing error toast).
     */
    fun acknowledgeActionResult() {
        _uiState.update { it.copy(actionStatus = ShiftActionStatus.Idle) }
    }
}

// -- UI State -------------------------------------------------

data class CashierShiftUiState(
    val loadStatus: ShiftLoadStatus = ShiftLoadStatus.Idle,
    val activeShift: CashierShiftDto? = null,
    val summaryStatus: ShiftLoadStatus = ShiftLoadStatus.Idle,
    val summary: CashierShiftSummaryDto? = null,
    val actionStatus: ShiftActionStatus = ShiftActionStatus.Idle,
) {
    val hasActiveShift: Boolean get() = activeShift != null
    val isLoading: Boolean get() = loadStatus is ShiftLoadStatus.Loading
}

sealed interface ShiftLoadStatus {
    data object Idle : ShiftLoadStatus
    data object Loading : ShiftLoadStatus
    data object Loaded : ShiftLoadStatus
    data class Failed(val message: String) : ShiftLoadStatus
}

sealed interface ShiftActionStatus {
    data object Idle : ShiftActionStatus
    data object Submitting : ShiftActionStatus
    data class CloseSucceeded(
        val varianceExceedsThreshold: Boolean,
        val variance: Long,
    ) : ShiftActionStatus
    data class Failed(val message: String) : ShiftActionStatus
}
