package id.alviarts.vipos.feature.home.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.auth.domain.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for the post-auth home surface (P3-08).
 *
 * Today the home screen is a placeholder; the kasir UI lands in
 * P3-06. The only real responsibility wired here is logout — it
 * drives [AuthRepository.logout] and signals the host once the
 * tokens are cleared so the nav graph can pop back to the login
 * destination.
 */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    fun logout() {
        if (_uiState.value.isLoggingOut) return
        _uiState.update { it.copy(isLoggingOut = true) }
        viewModelScope.launch {
            authRepository.logout()
            _uiState.update { it.copy(isLoggingOut = false, didLogout = true) }
        }
    }

    fun consumeLogoutEvent() {
        _uiState.update { it.copy(didLogout = false) }
    }
}

/**
 * UI state for the home placeholder.
 *
 * - [isLoggingOut] — disables the logout button while the network
 *   round-trip + token clear is in flight.
 * - [didLogout] — one-shot signal consumed by the host to
 *   navigate back to the login destination. The host calls
 *   [HomeViewModel.consumeLogoutEvent] after handling.
 */
data class HomeUiState(
    val isLoggingOut: Boolean = false,
    val didLogout: Boolean = false,
)
