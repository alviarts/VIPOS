package id.alviarts.vipos.feature.pos.ui.history

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.PosApi
import id.alviarts.vipos.feature.pos.data.TransactionDetailDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for transaction detail screen (P4-05).
 *
 * Loads and displays full transaction details including items.
 */
@HiltViewModel
class TransactionDetailViewModel @Inject constructor(
    private val posApi: PosApi,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val transactionId: Long = savedStateHandle.get<String>("transactionId")?.toLongOrNull() ?: 0L

    private val _uiState = MutableStateFlow(TransactionDetailUiState())
    val uiState: StateFlow<TransactionDetailUiState> = _uiState.asStateFlow()

    init {
        loadTransactionDetail()
    }

    fun loadTransactionDetail() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            try {
                val transaction = posApi.getTransactionDetail(transactionId)
                _uiState.update {
                    it.copy(
                        transaction = transaction,
                        isLoading = false,
                        error = null,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Gagal memuat detail transaksi",
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class TransactionDetailUiState(
    val transaction: TransactionDetailDto? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)
