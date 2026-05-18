package id.alviarts.vipos.feature.pos.ui.history

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import id.alviarts.vipos.feature.pos.data.TransactionHistoryItemDto
import java.text.SimpleDateFormat
import java.util.*

/**
 * Transaction history screen (P4-05).
 *
 * Displays paginated list of transactions with filtering options
 * (date, date range, status). Supports pull-to-refresh and
 * infinite scroll.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionHistoryScreen(
    onNavigateBack: () -> Unit,
    onTransactionClick: (Long) -> Unit,
    viewModel: TransactionHistoryViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    var showFilterDialog by remember { mutableStateOf(false) }
    var showSearchBar by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            if (showSearchBar) {
                SearchBar(
                    query = searchQuery,
                    onQueryChange = { viewModel.setSearchQuery(it) },
                    onClose = {
                        showSearchBar = false
                        viewModel.clearSearch()
                    },
                )
            } else {
                TopAppBar(
                    title = { Text("Riwayat Transaksi") },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                        }
                    },
                    actions = {
                        IconButton(onClick = { showSearchBar = true }) {
                            Icon(Icons.Default.Search, contentDescription = "Cari")
                        }
                        IconButton(onClick = { showFilterDialog = true }) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Filter")
                        }
                    },
                )
            }
        },
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            when {
                uiState.isLoading && uiState.transactions.isEmpty() -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
                uiState.error != null && uiState.transactions.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
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
                uiState.transactions.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(
                            text = "Belum ada transaksi",
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
                else -> {
                    TransactionList(
                        transactions = uiState.transactions,
                        isLoadingMore = uiState.isLoading,
                        hasMore = uiState.hasMore,
                        onTransactionClick = onTransactionClick,
                        onLoadMore = { viewModel.loadNextPage() },
                    )
                }
            }
        }
    }

    if (showFilterDialog) {
        FilterDialog(
            currentDate = uiState.selectedDate,
            currentStartDate = uiState.startDate,
            currentEndDate = uiState.endDate,
            currentStatus = uiState.selectedStatus,
            onDismiss = { showFilterDialog = false },
            onApplyDateFilter = { date ->
                viewModel.setDateFilter(date)
                showFilterDialog = false
            },
            onApplyDateRangeFilter = { start, end ->
                viewModel.setDateRangeFilter(start, end)
                showFilterDialog = false
            },
            onApplyStatusFilter = { status ->
                viewModel.setStatusFilter(status)
                showFilterDialog = false
            },
            onClearFilters = {
                viewModel.clearFilters()
                showFilterDialog = false
            },
        )
    }
}

@Composable
private fun TransactionList(
    transactions: List<TransactionHistoryItemDto>,
    isLoadingMore: Boolean,
    hasMore: Boolean,
    onTransactionClick: (Long) -> Unit,
    onLoadMore: () -> Unit,
) {
    val listState = rememberLazyListState()

    LazyColumn(
        state = listState,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(transactions, key = { it.id }) { transaction ->
            TransactionItem(
                transaction = transaction,
                onClick = { onTransactionClick(transaction.id) },
            )
        }

        if (isLoadingMore) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
        }
    }

    // Infinite scroll trigger
    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
            .collect { lastVisibleIndex ->
                if (lastVisibleIndex != null &&
                    lastVisibleIndex >= transactions.size - 3 &&
                    hasMore &&
                    !isLoadingMore
                ) {
                    onLoadMore()
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
                StatusChip(status = transaction.status ?: "completed")
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text(
                        text = transaction.cashierName ?: "Kasir",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = formatDateTime(transaction.createdAt),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = formatIdrLabel(transaction.totalAmount),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            if (transaction.paymentMethod != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatPaymentMethod(transaction.paymentMethod),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val (text, color) = when (status.lowercase()) {
        "completed" -> "Selesai" to MaterialTheme.colorScheme.primary
        "void" -> "Batal" to MaterialTheme.colorScheme.error
        "pending" -> "Pending" to MaterialTheme.colorScheme.tertiary
        else -> status to MaterialTheme.colorScheme.onSurface
    }

    Surface(
        color = color.copy(alpha = 0.1f),
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = color,
        )
    }
}

@Composable
private fun FilterDialog(
    currentDate: String?,
    currentStartDate: String?,
    currentEndDate: String?,
    currentStatus: String?,
    onDismiss: () -> Unit,
    onApplyDateFilter: (String?) -> Unit,
    onApplyDateRangeFilter: (String?, String?) -> Unit,
    onApplyStatusFilter: (String?) -> Unit,
    onClearFilters: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Filter Transaksi") },
        text = {
            Column {
                Text("Filter berdasarkan:")
                Spacer(modifier = Modifier.height(8.dp))

                // Status filter
                Text("Status:", style = MaterialTheme.typography.labelMedium)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    FilterChip(
                        selected = currentStatus == null,
                        onClick = { onApplyStatusFilter(null) },
                        label = { Text("Semua") },
                    )
                    FilterChip(
                        selected = currentStatus == "completed",
                        onClick = { onApplyStatusFilter("completed") },
                        label = { Text("Selesai") },
                    )
                    FilterChip(
                        selected = currentStatus == "void",
                        onClick = { onApplyStatusFilter("void") },
                        label = { Text("Batal") },
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Quick date filters
                Text("Tanggal:", style = MaterialTheme.typography.labelMedium)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(
                        onClick = {
                            val today = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                                .format(Date())
                            onApplyDateFilter(today)
                        },
                    ) {
                        Text("Hari Ini")
                    }
                    TextButton(
                        onClick = {
                            val cal = Calendar.getInstance()
                            cal.add(Calendar.DAY_OF_MONTH, -7)
                            val start = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                                .format(cal.time)
                            val end = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                                .format(Date())
                            onApplyDateRangeFilter(start, end)
                        },
                    ) {
                        Text("7 Hari Terakhir")
                    }
                    TextButton(
                        onClick = {
                            val cal = Calendar.getInstance()
                            cal.add(Calendar.DAY_OF_MONTH, -30)
                            val start = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                                .format(cal.time)
                            val end = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                                .format(Date())
                            onApplyDateRangeFilter(start, end)
                        },
                    ) {
                        Text("30 Hari Terakhir")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onClearFilters) {
                Text("Hapus Filter")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Tutup")
            }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onClose: () -> Unit,
) {
    TopAppBar(
        title = {
            TextField(
                value = query,
                onValueChange = onQueryChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Cari invoice atau kasir...") },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                    focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                    unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                ),
            )
        },
        navigationIcon = {
            IconButton(onClick = onClose) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Tutup")
            }
        },
    )
}

private fun formatDateTime(isoString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(isoString)
        val outputFormat = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))
        outputFormat.format(date ?: Date())
    } catch (e: Exception) {
        isoString
    }
}

private fun formatPaymentMethod(method: String): String {
    return when (method.lowercase()) {
        "cash" -> "Tunai"
        "qris" -> "QRIS"
        "debit" -> "Kartu Debit"
        "credit" -> "Kartu Kredit"
        "ewallet" -> "E-Wallet"
        else -> method
    }
}
