package id.alviarts.vipos.feature.pos.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.DashboardSummaryDto
import id.alviarts.vipos.feature.pos.data.PosApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for owner dashboard screen (P4-07).
 *
 * Displays today's KPIs: revenue, transactions, average basket,
 * MTD stats, low stock alerts, and pending approvals.
 */
@HiltViewModel
class OwnerDashboardViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(OwnerDashboardUiState())
    val uiState: StateFlow<OwnerDashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboard()
    }

    fun loadDashboard(refresh: Boolean = false) {
        viewModelScope.launch {
            if (refresh) {
                _uiState.update { it.copy(isRefreshing = true) }
            } else {
                _uiState.update { it.copy(isLoading = true) }
            }

            try {
                val summary = posApi.getDashboardSummary()
                _uiState.update {
                    it.copy(
                        summary = summary,
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
                        error = e.message ?: "Gagal memuat dashboard",
                    )
                }
            }
        }
    }

    fun refresh() {
        loadDashboard(refresh = true)
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class OwnerDashboardUiState(
    val summary: DashboardSummaryDto? = null,
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
)
