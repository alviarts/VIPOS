package id.alviarts.vipos.feature.pos.ui.loyalty

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import id.alviarts.vipos.feature.pos.data.LoyaltyTransactionDto

/**
 * Loyalty transaction list screen (P4-09).
 *
 * Shows history of loyalty transactions with filters:
 * - Type (earn, redeem, adjust, expire)
 * - Date range
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoyaltyTransactionListScreen(
    customerId: Long,
    onNavigateBack: () -> Unit,
    viewModel: LoyaltyViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(customerId) {
        viewModel.loadTransactions(customerId = customerId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Riwayat Loyalty") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadTransactions(customerId = customerId) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
            )
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            // Type filter chips
            TypeFilterRow(
                selectedType = uiState.selectedType,
                onTypeSelected = { viewModel.filterByType(it) },
            )

            // Active filters summary
            if (uiState.selectedType != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${uiState.transactions.size} transaksi",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TextButton(onClick = { viewModel.clearFilters() }) {
                        Text("Hapus Filter")
                    }
                }
            }

            when {
                uiState.isLoadingTransactions -> {
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
                            Button(onClick = { viewModel.loadTransactions(customerId = customerId) }) {
                                Text("Coba Lagi")
                            }
                        }
                    }
                }

                uiState.transactions.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Icon(
                                Icons.Default.Info,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(48.dp),
                            )
                            Text(
                                text = "Belum ada transaksi loyalty",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(uiState.transactions) { transaction ->
                            TransactionCard(transaction = transaction)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TypeFilterRow(
    selectedType: String?,
    onTypeSelected: (String?) -> Unit,
) {
    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            FilterChip(
                selected = selectedType == null,
                onClick = { onTypeSelected(null) },
                label = { Text("Semua") },
            )
        }
        item {
            FilterChip(
                selected = selectedType == "earn",
                onClick = { onTypeSelected("earn") },
                label = { Text("Earn") },
                leadingIcon = {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                },
            )
        }
        item {
            FilterChip(
                selected = selectedType == "redeem",
                onClick = { onTypeSelected("redeem") },
                label = { Text("Redeem") },
                leadingIcon = {
                    Icon(
                        Icons.Default.ShoppingCart,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                },
            )
        }
        item {
            FilterChip(
                selected = selectedType == "adjust",
                onClick = { onTypeSelected("adjust") },
                label = { Text("Adjust") },
                leadingIcon = {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                },
            )
        }
        item {
            FilterChip(
                selected = selectedType == "expire",
                onClick = { onTypeSelected("expire") },
                label = { Text("Expire") },
                leadingIcon = {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                },
            )
        }
    }
}

@Composable
private fun TransactionCard(
    transaction: LoyaltyTransactionDto,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    TypeBadge(type = transaction.type)

                    if (!transaction.ruleName.isNullOrBlank()) {
                        Text(
                            text = transaction.ruleName,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                if (!transaction.notes.isNullOrBlank()) {
                    Text(
                        text = transaction.notes,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(
                        Icons.Default.DateRange,
                        contentDescription = null,
                        modifier = Modifier.size(12.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = transaction.createdAt ?: "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Text(
                    text = "Saldo setelah: ${transaction.balanceAfter}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                val (color, sign) = when (transaction.type) {
                    "earn", "adjust" -> if (transaction.points >= 0) {
                        MaterialTheme.colorScheme.tertiary to "+"
                    } else {
                        MaterialTheme.colorScheme.error to ""
                    }
                    "redeem", "expire" -> MaterialTheme.colorScheme.error to "-"
                    else -> MaterialTheme.colorScheme.onSurface to ""
                }

                Text(
                    text = "$sign${kotlin.math.abs(transaction.points)}",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = color,
                )
                Text(
                    text = "poin",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun TypeBadge(type: String) {
    val (color, text, icon) = when (type) {
        "earn" -> Triple(
            MaterialTheme.colorScheme.tertiary,
            "Earn",
            Icons.Default.Add
        )
        "redeem" -> Triple(
            MaterialTheme.colorScheme.secondary,
            "Redeem",
            Icons.Default.ShoppingCart
        )
        "adjust" -> Triple(
            MaterialTheme.colorScheme.primary,
            "Adjust",
            Icons.Default.Edit
        )
        "expire" -> Triple(
            MaterialTheme.colorScheme.error,
            "Expire",
            Icons.Default.Close
        )
        else -> Triple(
            MaterialTheme.colorScheme.surfaceVariant,
            type,
            Icons.Default.Info
        )
    }

    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier.size(12.dp),
            tint = color,
        )
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Medium,
        )
    }
}
