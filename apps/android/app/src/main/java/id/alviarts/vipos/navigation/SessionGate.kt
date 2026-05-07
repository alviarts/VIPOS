package id.alviarts.vipos.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

/**
 * Cold-start session gate (P3-03d).
 *
 * Sits between [androidx.compose.material3.Surface] and the
 * nav graph: while [SessionViewModel] resolves whether a
 * persisted session can be restored, the gate shows a centered
 * spinner. Once the result lands, the gate mounts
 * [VIPOSNavHost] with the appropriate `startDestination`:
 *
 *  - [SessionRestoration.Restored] → home (with the
 *    persisted display name), so the user skips the login form.
 *  - [SessionRestoration.NotRestored] → login.
 *
 * The gate runs exactly once per process — the
 * SessionViewModel's `init` block fires the
 * `authRepository.restoreSession()` call and stores the result
 * in a StateFlow that survives recomposition.
 */
@Composable
fun SessionGate(
    onRequires2FA: (loginToken: String) -> Unit = {},
    viewModel: SessionViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val snapshot = state) {
        is SessionRestoration.Loading -> RestorationLoading()
        is SessionRestoration.NotRestored -> VIPOSNavHost(
            startRoute = VIPOSDestination.Login.route,
            onRequires2FA = onRequires2FA,
        )
        is SessionRestoration.Restored -> VIPOSNavHost(
            startRoute = VIPOSDestination.Home.routeFor(snapshot.displayName),
            onRequires2FA = onRequires2FA,
        )
    }
}

@Composable
private fun RestorationLoading() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            CircularProgressIndicator()
            Spacer(Modifier.height(16.dp))
            Text(
                text = "Memuat sesi…",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
