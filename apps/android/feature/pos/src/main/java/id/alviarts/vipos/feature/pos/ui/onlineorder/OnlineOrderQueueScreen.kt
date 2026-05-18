package id.alviarts.vipos.feature.pos.ui.onlineorder

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import id.alviarts.vipos.feature.pos.data.OnlineOrderDto
import java.text.SimpleDateFormat
import java.util.*

/**
 * Online order queue screen (P4-01).
 *
 * Displays list of online orders with status filtering and
 * action buttons (accept, reject, ready, complete, cancel).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnlineOrderQueueScreen(
    onNavigateBack: () -> Unit,
    onOrderClick: (Long) -> Unit,
    viewModel: OnlineOrderQueueViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var showRejectDialog by remember { mutableStateOf<Long?>(null) }
    var showCancelDialog by remember { mutableStateOf<Long?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pesanan Online") },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            // Status filter chips
            StatusFilterRow(
                selectedStatus = uiState.selectedStatus,
                onStatusSelected = { viewModel.setStatusFilter(it) },
            )

            when {
                uiState.isLoading && uiState.orders.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.error != null && uiState.orders.isEmpty() -> {
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
                uiState.orders.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Belum ada pesanan online",
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(uiState.orders, key = { it.id }) { order ->
                            OnlineOrderCard(
                                order = order,
                                isProcessing = uiState.processingOrderId == order.id,
                                onAccept = { viewModel.acceptOrder(order.id) },
                                onReject = { showRejectDialog = order.id },
                                onReady = { viewModel.markReady(order.id) },
                                onComplete = { viewModel.completeOrder(order.id) },
                                onCancel = { showCancelDialog = order.id },
                                onClick = { onOrderClick(order.id) },
                            )
                        }
                    }
                }
            }
        }
    }

    // Reject dialog
    showRejectDialog?.let { orderId ->
        ReasonDialog(
            title = "Tolak Pesanan",
            onDismiss = { showRejectDialog = null },
            onConfirm = { reason ->
                viewModel.rejectOrder(orderId, reason)
                showRejectDialog = null
            },
        )
    }

    // Cancel dialog
    showCancelDialog?.let { orderId ->
        ReasonDialog(
            title = "Batalkan Pesanan",
            onDismiss = { showCancelDialog = null },
            onConfirm = { reason ->
                viewModel.cancelOrder(orderId, reason)
                showCancelDialog = null
            },
        )
    }
}

@Composable
private fun StatusFilterRow(
    selectedStatus: String?,
    onStatusSelected: (String?) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FilterChip(
            selected = selectedStatus == null,
            onClick = { onStatusSelected(null) },
            label = { Text("Semua") },
        )
        FilterChip(
            selected = selectedStatus == "NEW",
            onClick = { onStatusSelected("NEW") },
            label = { Text("Baru") },
        )
        FilterChip(
            selected = selectedStatus == "PREPARING",
            onClick = { onStatusSelected("PREPARING") },
            label = { Text("Diproses") },
        )
        FilterChip(
            selected = selectedStatus == "READY",
            onClick = { onStatusSelected("READY") },
            label = { Text("Siap") },
        )
        FilterChip(
            selected = selectedStatus == "COMPLETED",
            onClick = { onStatusSelected("COMPLETED") },
            label = { Text("Selesai") },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun OnlineOrderCard(
    order: OnlineOrderDto,
    isProcessing: Boolean,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onReady: () -> Unit,
    onComplete: () -> Unit,
    onCancel: () -> Unit,
    onClick: () -> Unit,
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text = order.refNo,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    order.channel?.let {
                        Text(
                            text = it.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                StatusChip(status = order.status)
            }

            Spacer(modifier = Modifier.height(8.dp))

            order.customerName?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
            }
            order.customerPhone?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text(
                        text = "${order.itemCount} item",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    order.createdAt?.let {
                        Text(
                            text = formatDateTime(it),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Text(
                    text = formatIdrLabel(order.total),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            // Action buttons based on status
            if (!isProcessing) {
                Spacer(modifier = Modifier.height(12.dp))
                OrderActionButtons(
                    status = order.status,
                    onAccept = onAccept,
                    onReject = onReject,
                    onReady = onReady,
                    onComplete = onComplete,
                    onCancel = onCancel,
                )
            } else {
                Spacer(modifier = Modifier.height(12.dp))
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun OrderActionButtons(
    status: String,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onReady: () -> Unit,
    onComplete: () -> Unit,
    onCancel: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when (status) {
            "NEW" -> {
                Button(
                    onClick = onAccept,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Terima")
                }
                OutlinedButton(
                    onClick = onReject,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Tolak")
                }
            }
            "PREPARING" -> {
                Button(
                    onClick = onReady,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Siap")
                }
                OutlinedButton(
                    onClick = onCancel,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Batal")
                }
            }
            "READY" -> {
                Button(
                    onClick = onComplete,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Selesai")
                }
                OutlinedButton(
                    onClick = onCancel,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Batal")
                }
            }
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val (text, color) = when (status) {
        "NEW" -> "Baru" to MaterialTheme.colorScheme.tertiary
        "PREPARING" -> "Diproses" to MaterialTheme.colorScheme.primary
        "READY" -> "Siap" to MaterialTheme.colorScheme.secondary
        "COMPLETED" -> "Selesai" to MaterialTheme.colorScheme.primary
        "REJECTED" -> "Ditolak" to MaterialTheme.colorScheme.error
        "CANCELLED" -> "Dibatalkan" to MaterialTheme.colorScheme.error
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
private fun ReasonDialog(
    title: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
) {
    var reason by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                Text("Alasan:")
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Masukkan alasan...") },
                    minLines = 3,
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(reason) },
                enabled = reason.isNotBlank(),
            ) {
                Text("Konfirmasi")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal")
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
