package id.alviarts.vipos.feature.pos.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import id.alviarts.vipos.feature.pos.data.DailyTrendDto
import id.alviarts.vipos.feature.pos.data.PaymentBreakdownDto
import id.alviarts.vipos.feature.pos.data.TopProductDto
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

/**
 * Sales report screen (P4-06).
 *
 * Displays sales summary with:
 * - KPIs (revenue, transactions, avg ticket)
 * - Daily trend chart
 * - Top products
 * - Payment method breakdown
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SalesReportScreen(
    onNavigateBack: () -> Unit,
    viewModel: SalesReportViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val currencyFormat = remember { NumberFormat.getCurrencyInstance(Locale("id", "ID")) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Laporan Penjualan") },
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
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            uiState.error != null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(48.dp),
                        )
                        Text(
                            text = uiState.error ?: "Terjadi kesalahan",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.error,
                        )
                        Button(onClick = { viewModel.refresh() }) {
                            Text("Coba Lagi")
                        }
                    }
                }
            }

            uiState.report != null -> {
                val report = uiState.report!!
                
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Period header
                    item {
                        PeriodCard(
                            from = report.period.from,
                            to = report.period.to,
                        )
                    }

                    // KPI Cards
                    item {
                        Text(
                            text = "Ringkasan",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            KpiCard(
                                label = "Pendapatan",
                                value = currencyFormat.format(report.kpi.grossRevenue),
                                icon = Icons.Default.Star,
                                modifier = Modifier.weight(1f),
                            )
                            KpiCard(
                                label = "Transaksi",
                                value = report.kpi.transactionCount.toString(),
                                icon = Icons.Default.ShoppingCart,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            KpiCard(
                                label = "Rata-rata",
                                value = currencyFormat.format(report.kpi.avgTicket),
                                icon = Icons.Default.Info,
                                modifier = Modifier.weight(1f),
                            )
                            KpiCard(
                                label = "Pelanggan",
                                value = report.kpi.uniqueCustomers.toString(),
                                icon = Icons.Default.Person,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }

                    // Top Products
                    if (report.topProducts.isNotEmpty()) {
                        item {
                            Text(
                                text = "Produk Terlaris",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                        }

                        items(report.topProducts) { product ->
                            TopProductCard(
                                product = product,
                                currencyFormat = currencyFormat,
                            )
                        }
                    }

                    // Payment Breakdown
                    if (report.paymentBreakdown.isNotEmpty()) {
                        item {
                            Text(
                                text = "Metode Pembayaran",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                        }

                        items(report.paymentBreakdown) { payment ->
                            PaymentBreakdownCard(
                                payment = payment,
                                currencyFormat = currencyFormat,
                            )
                        }
                    }

                    // Daily Trend
                    if (report.dailyTrend.isNotEmpty()) {
                        item {
                            Text(
                                text = "Tren Harian",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                        }

                        items(report.dailyTrend) { trend ->
                            DailyTrendCard(
                                trend = trend,
                                currencyFormat = currencyFormat,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PeriodCard(from: String, to: String) {
    val dateFormat = remember { SimpleDateFormat("dd MMM yyyy", Locale("id", "ID")) }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.DateRange,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Column {
                Text(
                    text = "Periode Laporan",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    text = try {
                        val fromDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(from)!!
                        val toDate = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(to)!!
                        "${dateFormat.format(fromDate)} - ${dateFormat.format(toDate)}"
                    } catch (e: Exception) {
                        "$from - $to"
                    },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
    }
}

@Composable
private fun KpiCard(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp),
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun TopProductCard(
    product: TopProductDto,
    currencyFormat: NumberFormat,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = product.productName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "${product.qty} terjual",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = currencyFormat.format(product.revenue),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun PaymentBreakdownCard(
    payment: PaymentBreakdownDto,
    currencyFormat: NumberFormat,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = payment.method,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "${payment.count} transaksi",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = currencyFormat.format(payment.total.toDouble()),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun DailyTrendCard(
    trend: DailyTrendDto,
    currencyFormat: NumberFormat,
) {
    val dateFormat = remember { SimpleDateFormat("dd MMM", Locale("id", "ID")) }
    
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = try {
                        val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(trend.date)!!
                        dateFormat.format(date)
                    } catch (e: Exception) {
                        trend.date
                    },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "${trend.transactions} transaksi",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = currencyFormat.format(trend.revenue),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
