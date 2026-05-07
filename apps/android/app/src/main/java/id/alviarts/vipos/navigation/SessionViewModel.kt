package id.alviarts.vipos.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.auth.domain.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Drives the cold-start session-restoration flow (P3-03d).
 *
 * On `init` this fires a single `restoreSession()` against the
 * persisted DataStore bundle. The exposed [state] starts at
 * [SessionRestoration.Loading]; the gate composable blocks on
 * that value to render a spinner, then swaps to the appropriate
 * nav-graph startDestination once the result lands.
 *
 * The whole flow is process-scoped — `@HiltViewModel` resolves
 * to one instance per Activity, and a process restart re-runs
 * `init` so the persisted state is re-checked. There's
 * deliberately no retry / refresh: a failed read here just
 * means the user re-enters credentials, which is the safe
 * default for any unexpected DataStore state.
 */
@HiltViewModel
class SessionViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _state =
        MutableStateFlow<SessionRestoration>(SessionRestoration.Loading)
    val state: StateFlow<SessionRestoration> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val user = authRepository.restoreSession()
            _state.value = if (user != null) {
                SessionRestoration.Restored(displayName = user.name)
            } else {
                SessionRestoration.NotRestored
            }
        }
    }
}

/**
 * Result of the cold-start restoration check (P3-03d).
 *
 * - [Loading] — the persisted bundle is being read off disk.
 * - [NotRestored] — no session, expired token, or partial
 *   bundle; the user must log in again.
 * - [Restored] — a non-expired session was found; the gate
 *   navigates straight to home with the persisted
 *   [displayName].
 */
sealed interface SessionRestoration {
    data object Loading : SessionRestoration
    data object NotRestored : SessionRestoration
    data class Restored(val displayName: String) : SessionRestoration
}
