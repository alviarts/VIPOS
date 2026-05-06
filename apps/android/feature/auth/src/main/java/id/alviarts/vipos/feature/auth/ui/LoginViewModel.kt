package id.alviarts.vipos.feature.auth.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.auth.domain.AuthRepository
import id.alviarts.vipos.feature.auth.domain.LoginResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for the login screen (P3-03b).
 *
 * Holds a single [LoginUiState] and exposes the only mutations
 * the UI needs:
 *  - field updates (`onUsernameChange`, `onPasswordChange`,
 *    `onRememberMeToggle`)
 *  - submission (`submit`)
 *  - error dismissal (`dismissError`)
 *
 * Submission delegates to [AuthRepository.login], which already
 * persists tokens on success and folds errors into a sealed
 * `LoginResult`. The ViewModel only re-classifies that into
 * UI-facing [AuthStatus] / [LoginUiState.errorMessage].
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onUsernameChange(value: String) {
        _uiState.update { it.copy(username = value) }
    }

    fun onPasswordChange(value: String) {
        _uiState.update { it.copy(password = value) }
    }

    fun onRememberMeToggle(value: Boolean) {
        _uiState.update { it.copy(rememberMe = value) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun submit() {
        val snapshot = _uiState.value
        if (!snapshot.isSubmitEnabled) return
        _uiState.update {
            it.copy(authStatus = AuthStatus.Submitting, errorMessage = null)
        }
        viewModelScope.launch {
            val result = authRepository.login(
                username = snapshot.username.trim(),
                password = snapshot.password,
                rememberMe = snapshot.rememberMe,
            )
            _uiState.update { current ->
                when (result) {
                    is LoginResult.Success -> current.copy(
                        authStatus = AuthStatus.Authenticated(result.user),
                        password = "",
                    )
                    is LoginResult.Requires2FA -> current.copy(
                        authStatus = AuthStatus.Requires2FA(result.loginToken),
                    )
                    is LoginResult.Failure -> current.copy(
                        authStatus = AuthStatus.Idle,
                        errorMessage = result.message,
                    )
                }
            }
        }
    }
}
