package id.alviarts.vipos.feature.pos.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.data.TransactionHistoryItemDto
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for transaction history screen (P4-05).
 *
 * Manages paginated transaction list with filtering by date range,
 * status, and search query. Supports pull-to-refresh and infinite scroll.
 */
@OptIn(FlowPreview::class)
@HiltViewModel
class TransactionHistoryViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TransactionHistoryUiState())
    val uiState: StateFlow<TransactionHistoryUiState> = _uiState.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    init {
        loadTransactions()
        
        // Setup search debouncing
        viewModelScope.launch {
            _searchQuery
                .debounce(500) // Wait 500ms after user stops typing
                .distinctUntilChanged()
                .collect { query ->
                    if (query != _uiState.value.appliedSearchQuery) {
                        _uiState.update { it.copy(appliedSearchQuery = query) }
                        loadTransactions(refresh = true)
                    }
                }
        }
    }

    fun loadTransactions(refresh: Boolean = false) {
        viewModelScope.launch {
            if (refresh) {
                _uiState.update { it.copy(isRefreshing = true, currentPage = 1) }
            } else if (_uiState.value.isLoading) {
                return@launch // Prevent duplicate loads
            } else {
                _uiState.update { it.copy(isLoading = true) }
            }

            try {
                val page = if (refresh) 1 else _uiState.value.currentPage
                val response = posApi.getTransactionHistory(
                    date = _uiState.value.selectedDate,
                    startDate = _uiState.value.startDate,
                    endDate = _uiState.value.endDate,
                    status = _uiState.value.selectedStatus,
                    page = page,
                    limit = 20,
                )

                // Filter by search query locally (since backend doesn't support search yet)
                val filteredData = if (_uiState.value.appliedSearchQuery.isNotBlank()) {
                    response.data.filter { transaction ->
                        transaction.invoiceNumber.contains(_uiState.value.appliedSearchQuery, ignoreCase = true) ||
                        transaction.cashierName?.contains(_uiState.value.appliedSearchQuery, ignoreCase = true) == true
                    }
                } else {
                    response.data
                }

                _uiState.update {
                    it.copy(
                        transactions = if (refresh) filteredData else it.transactions + filteredData,
                        currentPage = page,
                        totalPages = response.pagination.totalPages,
                        hasMore = page < response.pagination.totalPages,
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
                        error = e.message ?: "Gagal memuat riwayat transaksi",
                    )
                }
            }
        }
    }

    fun loadNextPage() {
        if (_uiState.value.hasMore && !_uiState.value.isLoading) {
            _uiState.update { it.copy(currentPage = it.currentPage + 1) }
            loadTransactions()
        }
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun clearSearch() {
        _searchQuery.value = ""
    }

    fun setDateFilter(date: String?) {
        _uiState.update {
            it.copy(
                selectedDate = date,
                startDate = null,
                endDate = null,
            )
        }
        loadTransactions(refresh = true)
    }

    fun setDateRangeFilter(startDate: String?, endDate: String?) {
        _uiState.update {
            it.copy(
                selectedDate = null,
                startDate = startDate,
                endDate = endDate,
            )
        }
        loadTransactions(refresh = true)
    }

    fun setStatusFilter(status: String?) {
        _uiState.update { it.copy(selectedStatus = status) }
        loadTransactions(refresh = true)
    }

    fun clearFilters() {
        _uiState.update {
            it.copy(
                selectedDate = null,
                startDate = null,
                endDate = null,
                selectedStatus = null,
            )
        }
        loadTransactions(refresh = true)
    }

    fun refresh() {
        loadTransactions(refresh = true)
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class TransactionHistoryUiState(
    val transactions: List<TransactionHistoryItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val currentPage: Int = 1,
    val totalPages: Int = 1,
    val hasMore: Boolean = false,
    val selectedDate: String? = null,
    val startDate: String? = null,
    val endDate: String? = null,
    val selectedStatus: String? = null,
    val appliedSearchQuery: String = "",
)
