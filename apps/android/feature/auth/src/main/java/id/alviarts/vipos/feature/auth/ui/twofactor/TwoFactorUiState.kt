package id.alviarts.vipos.feature.auth.ui.twofactor

import id.alviarts.vipos.feature.auth.domain.AuthUser

/**
 * UI-facing state for the 2FA challenge screen (P3-03c).
 *
 * The ViewModel owns a single [TwoFactorUiState] flow; the
 * screen collects it and renders accordingly. The 6-digit TOTP
 * code lives in [code] and is bounded to numeric characters
 * with length ≤ 6 (the ViewModel filters input).
 */
data class TwoFactorUiState(
    val code: String = "",
    val rememberMe: Boolean = false,
    val status: TwoFactorStatus = TwoFactorStatus.Idle,
    val errorMessage: String? = null,
) {
    val isSubmitEnabled: Boolean
        get() = code.length == TOTP_CODE_LENGTH &&
            status !is TwoFactorStatus.Submitting

    companion object {
        /** Standard TOTP draft RFC 6238 default; backend verifies
         *  6-digit codes only. */
        const val TOTP_CODE_LENGTH: Int = 6
    }
}

/**
 * High-level state machine for the 2FA challenge.
 *
 *  - [Idle] — awaiting the user's TOTP code.
 *  - [Submitting] — POST /api/v1/auth/login/2fa is in flight.
 *  - [Authenticated] — verification succeeded; the host
 *    navigates to home.
 */
sealed interface TwoFactorStatus {
    data object Idle : TwoFactorStatus
    data object Submitting : TwoFactorStatus
    data class Authenticated(val user: AuthUser) : TwoFactorStatus
}
