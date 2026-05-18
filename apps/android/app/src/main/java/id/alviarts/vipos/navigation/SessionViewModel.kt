package id.alviarts.vipos.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.auth.domain.AuthSession
import id.alviarts.vipos.feature.auth.domain.TokenStorage
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * Drives both the cold-start session-restoration flow (P3-03d)
 * and the runtime session-invalidation flow (P3-03f).
 *
 * Observes [TokenStorage.sessions] reactively — on the first
 * emission the gate renders [SessionRestoration.Restored] (when
 * the persisted access token is still in its validity window)
 * or [SessionRestoration.NotRestored] (no session, or the token
 * already expired past the safety margin). Subsequent emissions
 * drive the same translation: when the SessionInvalidationInterceptor
 * (P3-03f) detects a 401 and clears the persisted session, the
 * Flow emits `null`, the gate transitions to `NotRestored`, and
 * [SessionGate] rebuilds the nav graph rooted at `Login` —
 * bouncing the user mid-session without any explicit nav code
 * at the call site.
 *
 * The same wiring also handles the explicit logout flow: when
 * `AuthRepository.logout()` clears `TokenStorage`, the same
 * Flow emission drives the same bounce. This means the
 * `HomeViewModel.onLogout` callback's `navigate(Login)` becomes
 * a no-op once the gate rebuild lands — but it's left in place
 * for defense-in-depth (and because reverting it would expand
 * this PR's blast radius into the home feature).
 *
 * Process-scoped — `@HiltViewModel` resolves to one instance
 * per Activity. A process restart re-collects the Flow so
 * persisted state is re-checked from disk.
 */
@HiltViewModel
class SessionViewModel @Inject constructor(
    tokenStorage: TokenStorage,
) : ViewModel() {

    val state: StateFlow<SessionRestoration> = tokenStorage.sessions
        .map { session -> session.toRestoration() }
        .stateIn(
            scope = viewModelScope,
            // WhileSubscribed keeps the upstream DataStore Flow alive
            // while SessionGate is collecting (i.e. always, while the
            // process is in the foreground). The 5-second timeout
            // smooths over configuration changes — the Flow stays
            // hot through a rotation rather than re-reading from disk.
            started = SharingStarted.WhileSubscribed(stopTimeoutMillis = 5_000L),
            initialValue = SessionRestoration.Loading,
        )

    private fun AuthSession?.toRestoration(): SessionRestoration {
        if (this == null) return SessionRestoration.NotRestored
        val nowSec = System.currentTimeMillis() / 1000
        val expiresAt = tokens.accessExpiresAtEpochSec
        // Mirrors the safety margin in
        // `AuthRepository.ACCESS_TOKEN_RESTORE_MARGIN_SEC`. Kept
        // as a local constant rather than imported from
        // `:feature:auth` because that companion is `private` —
        // promoting it to `public` would touch the auth feature
        // for a value used only here. The two constants must
        // stay in sync; if you bump one, bump the other.
        val marginSec = 10L
        return if (expiresAt - nowSec >= marginSec) {
            SessionRestoration.Restored(displayName = user.name)
        } else {
            SessionRestoration.NotRestored
        }
    }
}

/**
 * Result of the cold-start restoration check (P3-03d) and the
 * runtime invalidation observer (P3-03f).
 *
 * - [Loading] — the persisted bundle is still being read off
 *   disk. SessionGate shows a spinner.
 * - [NotRestored] — no session, expired token, partial bundle,
 *   or runtime invalidation triggered by a 401. The user must
 *   (re-)enter credentials.
 * - [Restored] — a non-expired session is currently persisted;
 *   the gate navigates straight to home with the persisted
 *   [displayName].
 */
sealed interface SessionRestoration {
    data object Loading : SessionRestoration
    data object NotRestored : SessionRestoration
    data class Restored(val displayName: String) : SessionRestoration
}
