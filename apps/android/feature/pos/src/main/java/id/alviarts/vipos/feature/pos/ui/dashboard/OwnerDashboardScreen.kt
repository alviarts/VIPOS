package id.alviarts.vipos.feature.pos.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import id.alviarts.vipos.feature.pos.data.DashboardSummaryDto

/**
 * Owner dashboard screen (P4-07).
 *
 * Displays today's KPIs and business metrics for outlet owners.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerDashboardScreen(
    onNavigateBack: () -> Unit,
    onLowStockClick: () -> Unit,
    onPendingApprovalsClick: () -> Unit,
    viewModel: OwnerDashboardViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Dashboard") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
            )
        },
    ) { paddingValues ->
        when {
            uiState.isLoading && uiState.summary == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            uiState.error != null && uiState.summary == null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = uiState.error ?: "Terjadi kesalahan",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.error,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.refresh() }) {
                        Text("Coba Lagi")
                    }
                }
            }
            uiState.summary != null -> {
                DashboardContent(
                    summary = uiState.summary!!,
                    isRefreshing = uiState.isRefreshing,
                    onLowStockClick = onLowStockClick,
                    onPendingApprovalsClick = onPendingApprovalsClick,
                    modifier = Modifier.padding(paddingValues),
                )
            }
        }
    }
}

@Composable
private fun DashboardContent(
    summary: DashboardSummaryDto,
    isRefreshing: Boolean,
    onLowStockClick: () -> Unit,
    onPendingApprovalsClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (isRefreshing) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }

        // Today's metrics
        Text(
            text = "Hari Ini",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            MetricCard(
                title = "Pendapatan",
                value = formatIdrLabel(summary.todayRevenue),
                modifier = Modifier.weight(1f),
            )
            MetricCard(
                title = "Transaksi",
                value = summary.todayTransactions.toString(),
                modifier = Modifier.weight(1f),
            )
        }

        MetricCard(
            title = "Rata-rata Belanja",
            value = formatIdrLabel(summary.todayAvgBasket),
            modifier = Modifier.fillMaxWidth(),
        )

        Divider()

        // Month-to-date metrics
        Text(
            text = "Bulan Ini",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            MetricCard(
                title = "Pendapatan MTD",
                value = formatIdrLabel(summary.mtdRevenue),
                modifier = Modifier.weight(1f),
            )
            MetricCard(
                title = "Transaksi MTD",
                value = summary.mtdTransactions.toString(),
                modifier = Modifier.weight(1f),
            )
        }

        Divider()

        // Alerts
        Text(
            text = "Peringatan",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )

        if (summary.lowStockCount > 0) {
            AlertCard(
                title = "Stok Menipis",
                count = summary.lowStockCount,
                onClick = onLowStockClick,
            )
        }

        if (summary.pendingApprovals > 0) {
            AlertCard(
                title = "Menunggu Persetujuan",
                count = summary.pendingApprovals,
                onClick = onPendingApprovalsClick,
            )
        }

        if (summary.lowStockCount == 0 && summary.pendingApprovals == 0) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                ),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Tidak ada peringatan",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun MetricCard(
    title: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AlertCard(
    title: String,
    count: Int,
    onClick: () -> Unit,
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
                Text(
                    text = "$count item",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
            Text(
                text = "›",
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
        }
    }
}
