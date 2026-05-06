package id.alviarts.vipos.feature.auth.ui

import id.alviarts.vipos.feature.auth.domain.AuthUser

/**
 * UI-facing state for the login screen (P3-03b).
 *
 * The ViewModel owns a single [LoginUiState] flow; the screen
 * collects it and renders accordingly. Form fields live in their
 * own state so typing does not invalidate the entire UI tree.
 *
 * - [authStatus] is the high-level state machine: where the user
 *   is in the login flow.
 * - [errorMessage] is a transient banner (snackbar / inline error)
 *   surfaced after a failed attempt; the ViewModel clears it on
 *   the next submission.
 */
data class LoginUiState(
    val username: String = "",
    val password: String = "",
    val rememberMe: Boolean = false,
    val authStatus: AuthStatus = AuthStatus.Idle,
    val errorMessage: String? = null,
) {
    val isSubmitEnabled: Boolean
        get() = username.isNotBlank() && password.isNotBlank() &&
            authStatus !is AuthStatus.Submitting
}

/**
 * High-level state machine for the login flow.
 *
 *  - [Idle] — the form is awaiting input. `authStatus = Idle` is
 *    the initial state and the state after a failed attempt.
 *  - [Submitting] — the network call is in flight. The form
 *    disables submission and the screen shows a progress indicator.
 *  - [Authenticated] — login succeeded. The host (`MainActivity`
 *    in P3-03b; nav graph in P3-08) reacts by swapping the screen.
 *  - [Requires2FA] — backend returned `requires_2fa`. The 2FA
 *    challenge UI lands in P3-03c; for P3-03b the screen surfaces
 *    "2FA required" copy + a placeholder action.
 */
sealed interface AuthStatus {
    data object Idle : AuthStatus
    data object Submitting : AuthStatus
    data class Authenticated(val user: AuthUser) : AuthStatus
    data class Requires2FA(val loginToken: String) : AuthStatus
}
