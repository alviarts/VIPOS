package id.alviarts.vipos.feature.pos.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.data.SalesSummaryReportDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

/**
 * ViewModel for sales reports (P4-06).
 * 
 * Features:
 * - Load sales summary report
 * - Filter by date range
 * - Filter by cashier
 * - Filter by payment method
 * - Export data (CSV/Excel)
 */
@HiltViewModel
class SalesReportViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SalesReportUiState())
    val uiState: StateFlow<SalesReportUiState> = _uiState.asStateFlow()

    init {
        // Load last 30 days by default
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_MONTH, -29)
        val from = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
        
        loadSalesSummary(from = from, to = today)
    }

    fun loadSalesSummary(
        from: String? = null,
        to: String? = null,
        cashierId: Long? = null,
        paymentMethod: String? = null,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val report = posApi.getSalesSummaryReport(
                    from = from,
                    to = to,
                    cashierId = cashierId,
                    paymentMethod = paymentMethod,
                )

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        report = report,
                        selectedFrom = from,
                        selectedTo = to,
                        selectedCashierId = cashierId,
                        selectedPaymentMethod = paymentMethod,
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

    fun filterByDateRange(from: String, to: String) {
        loadSalesSummary(
            from = from,
            to = to,
            cashierId = _uiState.value.selectedCashierId,
            paymentMethod = _uiState.value.selectedPaymentMethod,
        )
    }

    fun filterByCashier(cashierId: Long?) {
        loadSalesSummary(
            from = _uiState.value.selectedFrom,
            to = _uiState.value.selectedTo,
            cashierId = cashierId,
            paymentMethod = _uiState.value.selectedPaymentMethod,
        )
    }

    fun filterByPaymentMethod(paymentMethod: String?) {
        loadSalesSummary(
            from = _uiState.value.selectedFrom,
            to = _uiState.value.selectedTo,
            cashierId = _uiState.value.selectedCashierId,
            paymentMethod = paymentMethod,
        )
    }

    fun clearFilters() {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_MONTH, -29)
        val from = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
        
        loadSalesSummary(from = from, to = today)
    }

    fun refresh() {
        loadSalesSummary(
            from = _uiState.value.selectedFrom,
            to = _uiState.value.selectedTo,
            cashierId = _uiState.value.selectedCashierId,
            paymentMethod = _uiState.value.selectedPaymentMethod,
        )
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class SalesReportUiState(
    val isLoading: Boolean = false,
    val report: SalesSummaryReportDto? = null,
    val selectedFrom: String? = null,
    val selectedTo: String? = null,
    val selectedCashierId: Long? = null,
    val selectedPaymentMethod: String? = null,
    val error: String? = null,
)
