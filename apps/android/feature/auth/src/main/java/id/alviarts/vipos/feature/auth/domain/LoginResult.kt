package id.alviarts.vipos.feature.auth.domain

/**
 * Sealed result of an authentication attempt (P3-03a).
 *
 * `AuthRepository.login()` returns this instead of throwing so
 * call-sites can render distinct UI states without try/catch
 * scaffolding. Each variant carries exactly the data the UI
 * needs to react.
 *
 *  - [Success] — fully authenticated; access + refresh tokens
 *    have been persisted to [TokenStorage] and the user object
 *    is exposed for greeting / navigation gating.
 *  - [Requires2FA] — backend indicated `requires_2fa: true`.
 *    `loginToken` is the short-lived intermediate token to send
 *    to `POST /api/v1/auth/login/2fa` (wired in P3-03c).
 *  - [Failure] — credentials rejected, network failure, or any
 *    other non-success outcome. `message` is suitable for
 *    surfacing directly in a Snackbar; [throwable] (when
 *    present) is for diagnostic logging only.
 */
sealed interface LoginResult {

    data class Success(
        val user: AuthUser,
        val accessToken: String,
    ) : LoginResult

    data class Requires2FA(
        val loginToken: String,
    ) : LoginResult

    data class Failure(
        val message: String,
        val throwable: Throwable? = null,
    ) : LoginResult
}
