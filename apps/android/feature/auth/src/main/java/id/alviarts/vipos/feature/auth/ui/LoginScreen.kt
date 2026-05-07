package id.alviarts.vipos.feature.auth.ui

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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme

/**
 * Composable entry point for the login feature (P3-03b).
 *
 * The host (the nav graph in [id.alviarts.vipos.navigation.VIPOSNavHost]
 * since P3-08) calls this to mount the login flow. On successful
 * authentication, [onAuthenticated] is fired exactly once with
 * the user's display name so the host can navigate to the home
 * destination; [LaunchedEffect] keyed on the authStatus instance
 * guarantees it isn't re-entered on every recomposition.
 */
@Composable
fun AuthRoute(
    onAuthenticated: (displayName: String) -> Unit = {},
    onRequires2FA: (loginToken: String) -> Unit = {},
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val status = uiState.authStatus

    LaunchedEffect(status) {
        when (status) {
            is AuthStatus.Authenticated -> onAuthenticated(status.user.name)
            is AuthStatus.Requires2FA -> onRequires2FA(status.loginToken)
            else -> Unit
        }
    }

    LoginScreen(
        state = uiState,
        onUsernameChange = viewModel::onUsernameChange,
        onPasswordChange = viewModel::onPasswordChange,
        onRememberMeToggle = viewModel::onRememberMeToggle,
        onSubmit = viewModel::submit,
        onDismissError = viewModel::dismissError,
    )
}

@Composable
internal fun LoginScreen(
    state: LoginUiState,
    onUsernameChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onRememberMeToggle: (Boolean) -> Unit,
    onSubmit: () -> Unit,
    onDismissError: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "VIPOS",
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Masuk untuk memulai sesi kasir",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(32.dp))
            HorizontalDivider(
                modifier = Modifier.widthIn(max = 360.dp),
                color = MaterialTheme.colorScheme.outlineVariant,
            )
            Spacer(Modifier.height(32.dp))

            OutlinedTextField(
                value = state.username,
                onValueChange = onUsernameChange,
                label = { Text("Username") },
                singleLine = true,
                enabled = state.authStatus !is AuthStatus.Submitting,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Next,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = state.password,
                onValueChange = onPasswordChange,
                label = { Text("Password") },
                singleLine = true,
                enabled = state.authStatus !is AuthStatus.Submitting,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { onSubmit() }),
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            )
            Spacer(Modifier.height(8.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Start,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                Checkbox(
                    checked = state.rememberMe,
                    onCheckedChange = onRememberMeToggle,
                    enabled = state.authStatus !is AuthStatus.Submitting,
                )
                Text("Ingat saya di perangkat ini")
            }
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = onSubmit,
                enabled = state.isSubmitEnabled,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                if (state.authStatus is AuthStatus.Submitting) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        modifier = Modifier.height(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text("Masuk")
                }
            }
            if (state.errorMessage != null) {
                Spacer(Modifier.height(16.dp))
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer,
                    shape = MaterialTheme.shapes.small,
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                    ) {
                        Text(
                            text = state.errorMessage,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "Tap untuk menutup",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                        )
                    }
                }
                // Dismiss-on-next-input is handled by the
                // ViewModel's submit() which clears errorMessage
                // before each new attempt; the explicit
                // onDismissError above is reserved for a future
                // explicit-dismiss tap interaction.
            }
        }
    }
    // Suppress unused-parameter warning for onDismissError until
    // P3-03c wires the explicit-dismiss tap.
    @Suppress("UNUSED_EXPRESSION")
    onDismissError
}

// Note: P3-08 moved the post-auth + 2FA placeholder surfaces out
// of this file. The post-auth landing is now `:feature:home`'s
// HomeScreen, reached via the nav graph in
// id.alviarts.vipos.navigation.VIPOSNavHost. The 2FA challenge UI
// lands in P3-03c as its own screen + ViewModel.

@Preview(showBackground = true, widthDp = 412, heightDp = 892)
@Composable
private fun LoginScreenPreview() {
    VIPOSTheme {
        LoginScreen(
            state = LoginUiState(
                username = "kasir1",
                password = "supersecret",
            ),
            onUsernameChange = {},
            onPasswordChange = {},
            onRememberMeToggle = {},
            onSubmit = {},
            onDismissError = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 412, heightDp = 892)
@Composable
private fun LoginScreenErrorPreview() {
    VIPOSTheme {
        LoginScreen(
            state = LoginUiState(
                username = "kasir1",
                password = "wrongsecret",
                errorMessage = "Login gagal (HTTP 401)",
            ),
            onUsernameChange = {},
            onPasswordChange = {},
            onRememberMeToggle = {},
            onSubmit = {},
            onDismissError = {},
        )
    }
}
