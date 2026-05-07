package id.alviarts.vipos.feature.auth.ui.twofactor

import androidx.lifecycle.SavedStateHandle
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
 * ViewModel for the 2FA challenge screen (P3-03c).
 *
 * The `login_token` from the initial /login response is passed
 * via [SavedStateHandle] (the nav-compose host stuffs route
 * arguments into the SavedStateHandle automatically), so the
 * ViewModel survives configuration changes without losing the
 * challenge context.
 *
 * Submission delegates to [AuthRepository.verify2fa], which
 * persists the access + refresh tokens on success and folds
 * errors into [LoginResult]. The ViewModel re-classifies that
 * into UI-facing [TwoFactorStatus] / [TwoFactorUiState.errorMessage].
 */
@HiltViewModel
class TwoFactorViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val loginToken: String = savedStateHandle.get<String>(ARG_LOGIN_TOKEN)
        ?: error("TwoFactorViewModel requires a `$ARG_LOGIN_TOKEN` nav argument")

    private val _uiState = MutableStateFlow(TwoFactorUiState())
    val uiState: StateFlow<TwoFactorUiState> = _uiState.asStateFlow()

    fun onCodeChange(value: String) {
        // Accept only digits, cap at the TOTP length so the field
        // stops growing once the user has typed enough.
        val sanitized = value.filter { it.isDigit() }
            .take(TwoFactorUiState.TOTP_CODE_LENGTH)
        _uiState.update { it.copy(code = sanitized) }
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
            it.copy(status = TwoFactorStatus.Submitting, errorMessage = null)
        }
        viewModelScope.launch {
            val result = authRepository.verify2fa(
                loginToken = loginToken,
                code = snapshot.code,
                rememberMe = snapshot.rememberMe,
            )
            _uiState.update { current ->
                when (result) {
                    is LoginResult.Success -> current.copy(
                        status = TwoFactorStatus.Authenticated(result.user),
                        code = "",
                    )
                    is LoginResult.Requires2FA -> current.copy(
                        // Backend contract says this should not
                        // happen on the /login/2fa endpoint, but
                        // surface it as a generic failure rather
                        // than crashing if it ever does.
                        status = TwoFactorStatus.Idle,
                        errorMessage = "Sesi 2FA tidak valid, silakan login ulang",
                    )
                    is LoginResult.Failure -> current.copy(
                        status = TwoFactorStatus.Idle,
                        errorMessage = result.message,
                    )
                }
            }
        }
    }

    companion object {
        /** Nav-arg key for the `login_token` issued by /login when
         *  it returned `requires_2fa`. The nav graph passes this
         *  through the destination route. */
        const val ARG_LOGIN_TOKEN: String = "loginToken"
    }
}
