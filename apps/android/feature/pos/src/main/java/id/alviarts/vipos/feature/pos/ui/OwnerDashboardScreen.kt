package id.alviarts.vipos.feature.pos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import id.alviarts.vipos.feature.pos.data.DashboardSummaryDto

/**
 * Owner dashboard screen with KPI cards (P4-07).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerDashboardScreen(
    summary: DashboardSummaryDto?,
    isLoading: Boolean,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(title = { Text("Dashboard") })
        },
    ) { padding ->
        if (isLoading || summary == null) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item { Spacer(Modifier.height(4.dp)) }

                // Today KPIs
                item {
                    Text(
                        "Hari Ini",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        KpiCard(
                            label = "Pendapatan",
                            value = formatIdrLabel(summary.todayRevenue),
                            modifier = Modifier.weight(1f),
                        )
                        KpiCard(
                            label = "Transaksi",
                            value = "${summary.todayTransactions}",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                item {
                    KpiCard(
                        label = "Rata-rata Keranjang",
                        value = formatIdrLabel(summary.todayAvgBasket),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                // MTD KPIs
                item {
                    Text(
                        "Bulan Ini",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        KpiCard(
                            label = "Pendapatan MTD",
                            value = formatIdrLabel(summary.mtdRevenue),
                            modifier = Modifier.weight(1f),
                        )
                        KpiCard(
                            label = "Transaksi MTD",
                            value = "${summary.mtdTransactions}",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                // Alerts
                item {
                    Text(
                        "Peringatan",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        KpiCard(
                            label = "Stok Rendah",
                            value = "${summary.lowStockCount} produk",
                            modifier = Modifier.weight(1f),
                            isAlert = summary.lowStockCount > 0,
                        )
                        KpiCard(
                            label = "Persetujuan",
                            value = "${summary.pendingApprovals} pending",
                            modifier = Modifier.weight(1f),
                            isAlert = summary.pendingApprovals > 0,
                        )
                    }
                }

                item { Spacer(Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun KpiCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    isAlert: Boolean = false,
) {
    Card(
        modifier = modifier,
        colors = if (isAlert) {
            CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
        } else {
            CardDefaults.cardColors()
        },
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = if (isAlert) {
                    MaterialTheme.colorScheme.onErrorContainer
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = if (isAlert) {
                    MaterialTheme.colorScheme.onErrorContainer
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun OwnerDashboardScreenPreview() {
    VIPOSTheme {
        OwnerDashboardScreen(
            summary = DashboardSummaryDto(
                todayRevenue = 2_500_000,
                todayTransactions = 45,
                todayAvgBasket = 55_000,
                mtdRevenue = 35_000_000,
                mtdTransactions = 620,
                lowStockCount = 3,
                pendingApprovals = 1,
            ),
            isLoading = false,
        )
    }
}
