package id.alviarts.vipos.feature.pos.ui.transaction

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import id.alviarts.vipos.feature.pos.data.TransactionHistoryItemDto
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

/**
 * Transaction History List Screen (P4-05).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionListScreen(
    onNavigateBack: () -> Unit,
    onTransactionClick: (Long) -> Unit,
    viewModel: TransactionViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Riwayat Transaksi") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadTransactions() }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            // Filters
            FilterSection(
                startDate = uiState.startDate,
                endDate = uiState.endDate,
                paymentMethod = uiState.paymentMethodFilter,
                status = uiState.statusFilter,
                onDateFilterChange = { start, end ->
                    viewModel.setDateFilter(start, end)
                },
                onPaymentMethodChange = { viewModel.setPaymentMethodFilter(it) },
                onStatusChange = { viewModel.setStatusFilter(it) },
                onClearFilters = { viewModel.clearFilters() },
            )

            Divider()

            // Content
            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.error != null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = uiState.error ?: "Error",
                                color = MaterialTheme.colorScheme.error,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(onClick = { viewModel.loadTransactions() }) {
                                Text("Retry")
                            }
                        }
                    }
                }
                uiState.transactions.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("Tidak ada transaksi")
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(uiState.transactions) { transaction ->
                            TransactionItem(
                                transaction = transaction,
                                onClick = { onTransactionClick(transaction.id) },
                            )
                        }
                    }

                    // Pagination
                    if (uiState.totalPages > 1) {
                        PaginationBar(
                            currentPage = uiState.currentPage,
                            totalPages = uiState.totalPages,
                            onPreviousPage = { viewModel.previousPage() },
                            onNextPage = { viewModel.nextPage() },
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterSection(
    startDate: String?,
    endDate: String?,
    paymentMethod: String?,
    status: String?,
    onDateFilterChange: (String?, String?) -> Unit,
    onPaymentMethodChange: (String?) -> Unit,
    onStatusChange: (String?) -> Unit,
    onClearFilters: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = "Filter",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Payment Method Filter
            var paymentExpanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = paymentExpanded,
                onExpandedChange = { paymentExpanded = it },
                modifier = Modifier.weight(1f),
            ) {
                OutlinedTextField(
                    value = paymentMethod ?: "Semua Metode",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Metode Bayar") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(paymentExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth(),
                )
                ExposedDropdownMenu(
                    expanded = paymentExpanded,
                    onDismissRequest = { paymentExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text("Semua Metode") },
                        onClick = {
                            onPaymentMethodChange(null)
                            paymentExpanded = false
                        },
                    )
                    listOf("cash", "qris", "debit", "credit", "ewallet").forEach { method ->
                        DropdownMenuItem(
                            text = { Text(method.uppercase()) },
                            onClick = {
                                onPaymentMethodChange(method)
                                paymentExpanded = false
                            },
                        )
                    }
                }
            }

            // Status Filter
            var statusExpanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(
                expanded = statusExpanded,
                onExpandedChange = { statusExpanded = it },
                modifier = Modifier.weight(1f),
            ) {
                OutlinedTextField(
                    value = status ?: "Semua Status",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Status") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(statusExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth(),
                )
                ExposedDropdownMenu(
                    expanded = statusExpanded,
                    onDismissRequest = { statusExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text("Semua Status") },
                        onClick = {
                            onStatusChange(null)
                            statusExpanded = false
                        },
                    )
                    listOf("completed", "pending", "cancelled").forEach { s ->
                        DropdownMenuItem(
                            text = { Text(s.uppercase()) },
                            onClick = {
                                onStatusChange(s)
                                statusExpanded = false
                            },
                        )
                    }
                }
            }
        }

        if (startDate != null || endDate != null || paymentMethod != null || status != null) {
            TextButton(onClick = onClearFilters) {
                Text("Clear Filters")
            }
        }
    }
}

@Composable
private fun TransactionItem(
    transaction: TransactionHistoryItemDto,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = transaction.invoiceNumber,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                StatusChip(status = transaction.status ?: "unknown")
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = formatDate(transaction.createdAt),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = transaction.paymentMethod?.uppercase() ?: "UNKNOWN",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(
                    text = "Kasir: ${transaction.cashierName ?: "Unknown"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = formatCurrency(transaction.totalAmount),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val color = when (status.lowercase()) {
        "completed" -> MaterialTheme.colorScheme.primary
        "pending" -> MaterialTheme.colorScheme.tertiary
        "cancelled" -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.secondary
    }

    Surface(
        color = color.copy(alpha = 0.1f),
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            text = status.uppercase(),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
        )
    }
}

@Composable
private fun PaginationBar(
    currentPage: Int,
    totalPages: Int,
    onPreviousPage: () -> Unit,
    onNextPage: () -> Unit,
) {
    Surface(
        tonalElevation = 3.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(
                onClick = onPreviousPage,
                enabled = currentPage > 1,
            ) {
                Text("Previous")
            }

            Text(
                text = "Page $currentPage of $totalPages",
                style = MaterialTheme.typography.bodyMedium,
            )

            TextButton(
                onClick = onNextPage,
                enabled = currentPage < totalPages,
            ) {
                Text("Next")
            }
        }
    }
}

private fun formatDate(dateString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(dateString)
        val outputFormat = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))
        outputFormat.format(date ?: Date())
    } catch (e: Exception) {
        dateString
    }
}

private fun formatCurrency(amount: Long): String {
    val formatter = NumberFormat.getCurrencyInstance(Locale("id", "ID"))
    return formatter.format(amount)
}
