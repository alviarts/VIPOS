package id.alviarts.vipos.feature.pos.ui.loyalty

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.CustomerLoyaltyDto
import id.alviarts.vipos.feature.pos.data.LoyaltyAdjustRequestDto
import id.alviarts.vipos.feature.pos.data.LoyaltyTransactionDto
import id.alviarts.vipos.feature.pos.data.PosApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for customer loyalty (P4-09).
 * 
 * Features:
 * - View customer points balance
 * - View loyalty transaction history
 * - Manual point adjustment (admin)
 */
@HiltViewModel
class LoyaltyViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoyaltyUiState())
    val uiState: StateFlow<LoyaltyUiState> = _uiState.asStateFlow()

    fun loadCustomerLoyalty(customerId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingCustomer = true, error = null) }

            try {
                val loyalty = posApi.getCustomerLoyalty(customerId)

                _uiState.update {
                    it.copy(
                        isLoadingCustomer = false,
                        customerLoyalty = loyalty,
                    )
                }

                // Auto-load transactions for this customer
                loadTransactions(customerId = customerId)
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingCustomer = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun loadTransactions(
        customerId: Long? = null,
        type: String? = null,
        fromDate: String? = null,
        toDate: String? = null,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingTransactions = true, error = null) }

            try {
                val transactions = posApi.getLoyaltyTransactions(
                    customerId = customerId,
                    type = type,
                    fromDate = fromDate,
                    toDate = toDate,
                )

                _uiState.update {
                    it.copy(
                        isLoadingTransactions = false,
                        transactions = transactions,
                        selectedType = type,
                        selectedFromDate = fromDate,
                        selectedToDate = toDate,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingTransactions = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun adjustPoints(
        customerId: Long,
        points: Int,
        notes: String?,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isAdjusting = true, error = null) }

            try {
                val request = LoyaltyAdjustRequestDto(
                    customerId = customerId,
                    points = points,
                    notes = notes,
                )

                posApi.adjustLoyaltyPoints(request)

                _uiState.update { it.copy(isAdjusting = false) }

                // Refresh customer loyalty and transactions
                loadCustomerLoyalty(customerId)
                onSuccess()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isAdjusting = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun filterByType(type: String?) {
        val customerId = _uiState.value.customerLoyalty?.customerId
        loadTransactions(
            customerId = customerId,
            type = type,
            fromDate = _uiState.value.selectedFromDate,
            toDate = _uiState.value.selectedToDate,
        )
    }

    fun filterByDateRange(fromDate: String?, toDate: String?) {
        val customerId = _uiState.value.customerLoyalty?.customerId
        loadTransactions(
            customerId = customerId,
            type = _uiState.value.selectedType,
            fromDate = fromDate,
            toDate = toDate,
        )
    }

    fun clearFilters() {
        val customerId = _uiState.value.customerLoyalty?.customerId
        loadTransactions(customerId = customerId)
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearCustomer() {
        _uiState.update {
            it.copy(
                customerLoyalty = null,
                transactions = emptyList(),
            )
        }
    }
}

data class LoyaltyUiState(
    val isLoadingCustomer: Boolean = false,
    val isLoadingTransactions: Boolean = false,
    val isAdjusting: Boolean = false,
    val customerLoyalty: CustomerLoyaltyDto? = null,
    val transactions: List<LoyaltyTransactionDto> = emptyList(),
    val selectedType: String? = null,
    val selectedFromDate: String? = null,
    val selectedToDate: String? = null,
    val error: String? = null,
)
