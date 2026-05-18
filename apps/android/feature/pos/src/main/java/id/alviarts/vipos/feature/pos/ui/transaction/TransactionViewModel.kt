package id.alviarts.vipos.feature.pos.ui.transaction

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.data.TransactionHistoryItemDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for Transaction History (P4-05).
 */
@HiltViewModel
class TransactionViewModel @Inject constructor(
    private val api: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TransactionUiState())
    val uiState: StateFlow<TransactionUiState> = _uiState.asStateFlow()

    init {
        loadTransactions()
    }

    fun loadTransactions() {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            try {
                val response = api.getTransactionHistory(
                    page = _uiState.value.currentPage,
                    limit = 20,
                    startDate = _uiState.value.startDate,
                    endDate = _uiState.value.endDate,
                    status = _uiState.value.statusFilter,
                )
                _uiState.update {
                    it.copy(
                        transactions = response.data,
                        totalPages = response.pagination.totalPages,
                        totalItems = response.pagination.total.toInt(),
                        isLoading = false,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load transactions",
                    )
                }
            }
        }
    }

    fun setDateFilter(startDate: String?, endDate: String?) {
        _uiState.update {
            it.copy(
                startDate = startDate,
                endDate = endDate,
                currentPage = 1,
            )
        }
        loadTransactions()
    }

    fun setPaymentMethodFilter(paymentMethod: String?) {
        _uiState.update {
            it.copy(
                paymentMethodFilter = paymentMethod,
                currentPage = 1,
            )
        }
        loadTransactions()
    }

    fun setStatusFilter(status: String?) {
        _uiState.update {
            it.copy(
                statusFilter = status,
                currentPage = 1,
            )
        }
        loadTransactions()
    }

    fun nextPage() {
        if (_uiState.value.currentPage < _uiState.value.totalPages) {
            _uiState.update { it.copy(currentPage = it.currentPage + 1) }
            loadTransactions()
        }
    }

    fun previousPage() {
        if (_uiState.value.currentPage > 1) {
            _uiState.update { it.copy(currentPage = it.currentPage - 1) }
            loadTransactions()
        }
    }

    fun clearFilters() {
        _uiState.update {
            it.copy(
                startDate = null,
                endDate = null,
                paymentMethodFilter = null,
                statusFilter = null,
                currentPage = 1,
            )
        }
        loadTransactions()
    }
}

data class TransactionUiState(
    val transactions: List<TransactionHistoryItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val currentPage: Int = 1,
    val totalPages: Int = 1,
    val totalItems: Int = 0,
    val startDate: String? = null,
    val endDate: String? = null,
    val paymentMethodFilter: String? = null,
    val statusFilter: String? = null,
)
