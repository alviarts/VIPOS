package id.alviarts.vipos.feature.home.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme

/**
 * Composable entry point for the home destination (P3-08).
 *
 * Today this is a placeholder welcome surface with a logout
 * button. The kasir UI lands in P3-06 (cart + checkout) and
 * P3-07 (settings + profile).
 */
@Composable
fun HomeRoute(
    displayName: String,
    onLogout: () -> Unit,
    onOpenPos: () -> Unit,
    onOpenTransactionHistory: () -> Unit = {},
    onOpenOnlineOrderQueue: () -> Unit = {},
    onOpenOwnerDashboard: () -> Unit = {},
    onOpenAppointmentList: () -> Unit = {},
    onOpenStockMovementList: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState.didLogout) {
        if (uiState.didLogout) {
            viewModel.consumeLogoutEvent()
            onLogout()
        }
    }

    HomeScreen(
        displayName = displayName,
        isLoggingOut = uiState.isLoggingOut,
        onLogoutClick = viewModel::logout,
        onOpenPosClick = onOpenPos,
        onOpenTransactionHistoryClick = onOpenTransactionHistory,
        onOpenOnlineOrderQueueClick = onOpenOnlineOrderQueue,
        onOpenOwnerDashboardClick = onOpenOwnerDashboard,
        onOpenAppointmentListClick = onOpenAppointmentList,
        onOpenStockMovementListClick = onOpenStockMovementList,
    )
}

@Composable
internal fun HomeScreen(
    displayName: String,
    isLoggingOut: Boolean,
    onLogoutClick: () -> Unit,
    onOpenPosClick: () -> Unit,
    onOpenTransactionHistoryClick: () -> Unit = {},
    onOpenOnlineOrderQueueClick: () -> Unit = {},
    onOpenOwnerDashboardClick: () -> Unit = {},
    onOpenAppointmentListClick: () -> Unit = {},
    onOpenStockMovementListClick: () -> Unit = {},
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
                text = "Selamat datang,",
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                text = displayName,
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(16.dp))
            Text(
                text = "Pilih menu untuk mulai bertransaksi.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(32.dp))
            
            // Main menu buttons
            Button(
                onClick = onOpenPosClick,
                enabled = !isLoggingOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                Text("Buka Kasir")
            }
            Spacer(Modifier.height(8.dp))
            
            OutlinedButton(
                onClick = onOpenTransactionHistoryClick,
                enabled = !isLoggingOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                Text("Riwayat Transaksi")
            }
            Spacer(Modifier.height(8.dp))
            
            OutlinedButton(
                onClick = onOpenOnlineOrderQueueClick,
                enabled = !isLoggingOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                Text("Pesanan Online")
            }
            Spacer(Modifier.height(8.dp))
            
            OutlinedButton(
                onClick = onOpenOwnerDashboardClick,
                enabled = !isLoggingOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                Text("Dashboard")
            }
            Spacer(Modifier.height(8.dp))
            
            OutlinedButton(
                onClick = onOpenAppointmentListClick,
                enabled = !isLoggingOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                Text("Janji Temu")
            }
            Spacer(Modifier.height(8.dp))
            
            OutlinedButton(
                onClick = onOpenStockMovementListClick,
                enabled = !isLoggingOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                Text("Pergerakan Stok")
            }
            Spacer(Modifier.height(24.dp))
            
            OutlinedButton(
                onClick = onLogoutClick,
                enabled = !isLoggingOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 360.dp),
            ) {
                if (isLoggingOut) {
                    CircularProgressIndicator(
                        strokeWidth = 2.dp,
                        modifier = Modifier.height(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text("Keluar")
                }
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 412, heightDp = 892)
@Composable
private fun HomeScreenPreview() {
    VIPOSTheme {
        HomeScreen(
            displayName = "Kasir Satu",
            isLoggingOut = false,
            onLogoutClick = {},
            onOpenPosClick = {},
        )
    }
}
