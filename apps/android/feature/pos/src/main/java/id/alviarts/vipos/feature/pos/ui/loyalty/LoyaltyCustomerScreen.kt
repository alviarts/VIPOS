package id.alviarts.vipos.feature.pos.ui.loyalty

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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

/**
 * Loyalty customer screen (P4-09).
 *
 * Shows customer loyalty summary:
 * - Points balance
 * - Total earned/redeemed
 * - Member since
 * - Quick actions (adjust points, view history)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoyaltyCustomerScreen(
    customerId: Long,
    onNavigateBack: () -> Unit,
    onViewHistory: (Long) -> Unit,
    viewModel: LoyaltyViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var showAdjustDialog by remember { mutableStateOf(false) }

    LaunchedEffect(customerId) {
        viewModel.loadCustomerLoyalty(customerId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Loyalty Pelanggan") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadCustomerLoyalty(customerId) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
            )
        },
    ) { paddingValues ->
        when {
            uiState.isLoadingCustomer -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            uiState.error != null && uiState.customerLoyalty == null -> {
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
                        Button(onClick = { viewModel.loadCustomerLoyalty(customerId) }) {
                            Text("Coba Lagi")
                        }
                    }
                }
            }

            uiState.customerLoyalty != null -> {
                LoyaltyCustomerContent(
                    loyalty = uiState.customerLoyalty!!,
                    onAdjustClick = { showAdjustDialog = true },
                    onViewHistoryClick = { onViewHistory(customerId) },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                )
            }
        }
    }

    // Adjust points dialog
    if (showAdjustDialog) {
        LoyaltyAdjustDialog(
            currentBalance = uiState.customerLoyalty?.pointsBalance ?: 0,
            isAdjusting = uiState.isAdjusting,
            error = uiState.error,
            onDismiss = { showAdjustDialog = false },
            onConfirm = { points, notes ->
                viewModel.adjustPoints(
                    customerId = customerId,
                    points = points,
                    notes = notes,
                ) {
                    showAdjustDialog = false
                }
            },
            onClearError = { viewModel.clearError() },
        )
    }
}

@Composable
private fun LoyaltyCustomerContent(
    loyalty: id.alviarts.vipos.feature.pos.data.CustomerLoyaltyDto,
    onAdjustClick: () -> Unit,
    onViewHistoryClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Customer info card
        Card(
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = loyalty.customerName,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )

                if (!loyalty.customerPhone.isNullOrBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            Icons.Default.Phone,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = loyalty.customerPhone,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                if (!loyalty.memberSince.isNullOrBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            Icons.Default.DateRange,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = "Member sejak ${loyalty.memberSince}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        // Points balance card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
            ),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "Saldo Poin",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    text = "${loyalty.pointsBalance}",
                    style = MaterialTheme.typography.displayLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = "poin",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }

        // Statistics cards
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            StatCard(
                title = "Total Earned",
                value = "${loyalty.totalEarned}",
                icon = Icons.Default.Add,
                color = MaterialTheme.colorScheme.tertiary,
                modifier = Modifier.weight(1f),
            )
            StatCard(
                title = "Total Redeemed",
                value = "${loyalty.totalRedeemed}",
                icon = Icons.Default.ShoppingCart,
                color = MaterialTheme.colorScheme.secondary,
                modifier = Modifier.weight(1f),
            )
        }

        if (loyalty.totalAdjusted != 0) {
            StatCard(
                title = "Total Adjusted",
                value = "${loyalty.totalAdjusted}",
                icon = Icons.Default.Edit,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        // Action buttons
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                onClick = onViewHistoryClick,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Default.List, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Lihat Riwayat Transaksi")
            }

            OutlinedButton(
                onClick = onAdjustClick,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Default.Edit, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Sesuaikan Poin Manual")
            }
        }
    }
}

@Composable
private fun StatCard(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = color,
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = color,
            )
        }
    }
}

@Composable
private fun LoyaltyAdjustDialog(
    currentBalance: Int,
    isAdjusting: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onConfirm: (points: Int, notes: String?) -> Unit,
    onClearError: () -> Unit,
) {
    var points by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var pointsError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Sesuaikan Poin") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = "Saldo saat ini: $currentBalance poin",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                OutlinedTextField(
                    value = points,
                    onValueChange = {
                        points = it
                        pointsError = false
                        onClearError()
                    },
                    label = { Text("Jumlah Poin") },
                    placeholder = { Text("Contoh: 100 atau -50") },
                    isError = pointsError,
                    supportingText = if (pointsError) {
                        { Text("Jumlah poin harus berupa angka") }
                    } else {
                        { Text("Gunakan angka negatif untuk mengurangi poin") }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Catatan") },
                    placeholder = { Text("Alasan penyesuaian") },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                )

                if (error != null) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                        ),
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Default.Warning,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                            )
                            Text(
                                text = error,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val pointsInt = points.toIntOrNull()
                    if (pointsInt == null) {
                        pointsError = true
                        return@Button
                    }

                    onConfirm(pointsInt, notes.ifBlank { null })
                },
                enabled = !isAdjusting,
            ) {
                if (isAdjusting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text("Simpan")
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isAdjusting,
            ) {
                Text("Batal")
            }
        },
    )
}
