package id.alviarts.vipos.feature.pos.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.core.database.dao.OutboxDao
import id.alviarts.vipos.core.database.entity.OutboxEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Drives the "Sinkronisasi Gagal" screen (P3-09 DLQ).
 *
 * Shows all outbox entries that have permanently failed after
 * [OutboxEntry.MAX_RETRIES] attempts. The kasir can:
 *  - **Retry** an entry (resets to PENDING, worker picks it up)
 *  - **Discard** an entry (deletes from outbox — data loss!)
 */
@HiltViewModel
class SyncIssuesViewModel @Inject constructor(
    private val outboxDao: OutboxDao,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SyncIssuesUiState())
    val uiState: StateFlow<SyncIssuesUiState> = _uiState.asStateFlow()

    init {
        loadFailedEntries()
    }

    fun loadFailedEntries() {
        _uiState.update { it.copy(isLoading = true) }
        viewModelScope.launch {
            val entries = outboxDao.allFailed()
            _uiState.update {
                it.copy(
                    isLoading = false,
                    entries = entries,
                )
            }
        }
    }

    fun retryEntry(id: Long) {
        viewModelScope.launch {
            outboxDao.retryFailed(id)
            loadFailedEntries()
        }
    }

    fun discardEntry(id: Long) {
        viewModelScope.launch {
            outboxDao.deleteFailed(id)
            loadFailedEntries()
        }
    }

    fun retryAll() {
        viewModelScope.launch {
            val entries = outboxDao.allFailed()
            for (entry in entries) {
                outboxDao.retryFailed(entry.id)
            }
            loadFailedEntries()
        }
    }
}

data class SyncIssuesUiState(
    val isLoading: Boolean = false,
    val entries: List<OutboxEntry> = emptyList(),
) {
    val isEmpty: Boolean get() = entries.isEmpty() && !isLoading
}
