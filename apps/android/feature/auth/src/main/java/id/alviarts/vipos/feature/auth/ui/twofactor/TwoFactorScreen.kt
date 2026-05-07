package id.alviarts.vipos.feature.auth.ui.twofactor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme

/**
 * Composable entry point for the 2FA challenge feature (P3-03c).
 *
 * The host (the nav graph in `:app/navigation/VIPOSNavHost`)
 * navigates here with the `login_token` from the initial /login
 * response as a path argument. On successful verification,
 * [onAuthenticated] is fired exactly once with the user's
 * display name so the host can navigate to the home destination
 * with the same back-stack-clearing pattern as the login →
 * home transition.
 *
 * On a verification error the state machine returns to Idle
 * and surfaces the error inline; the user can retry without
 * leaving the screen.
 */
@Composable
fun TwoFactorRoute(
    onAuthenticated: (displayName: String) -> Unit = {},
    onCancel: () -> Unit = {},
    viewModel: TwoFactorViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val status = uiState.status

    LaunchedEffect(status) {
        if (status is TwoFactorStatus.Authenticated) {
            onAuthenticated(status.user.name)
        }
    }

    TwoFactorScreen(
        state = uiState,
        onCodeChange = viewModel::onCodeChange,
        onRememberMeToggle = viewModel::onRememberMeToggle,
        onSubmit = viewModel::submit,
        onDismissError = viewModel::dismissError,
        onCancel = onCancel,
    )
}

@Composable
internal fun TwoFactorScreen(
    state: TwoFactorUiState,
    onCodeChange: (String) -> Unit,
    onRememberMeToggle: (Boolean) -> Unit,
    onSubmit: () -> Unit,
    onDismissError: () -> Unit,
    onCancel: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "Verifikasi 2FA",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Masukkan 6 digit kode dari aplikasi authenticator kamu.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(24.dp))

            OutlinedTextField(
                value = state.code,
                onValueChange = onCodeChange,
                label = { Text("Kode 6 digit") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.NumberPassword,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { onSubmit() }),
                isError = state.errorMessage != null,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            )

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = state.rememberMe,
                    onCheckedChange = onRememberMeToggle,
                )
                Text("Ingat saya")
            }

            if (state.errorMessage != null) {
                Spacer(Modifier.height(8.dp))
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer,
                    shape = MaterialTheme.shapes.small,
                    modifier = Modifier
                        .fillMaxWidth()
                        .widthIn(max = 360.dp),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = state.errorMessage,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(onClick = onDismissError) {
                            Text("Tutup")
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            Button(
                onClick = onSubmit,
                enabled = state.isSubmitEnabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                if (state.status is TwoFactorStatus.Submitting) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        modifier = Modifier.height(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text("Verifikasi")
                }
            }

            Spacer(Modifier.height(8.dp))

            TextButton(
                onClick = onCancel,
                enabled = state.status !is TwoFactorStatus.Submitting,
            ) {
                Text("Batal — kembali ke login")
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 412, heightDp = 892)
@Composable
private fun TwoFactorScreenPreview() {
    VIPOSTheme {
        TwoFactorScreen(
            state = TwoFactorUiState(code = "123"),
            onCodeChange = {},
            onRememberMeToggle = {},
            onSubmit = {},
            onDismissError = {},
            onCancel = {},
        )
    }
}
