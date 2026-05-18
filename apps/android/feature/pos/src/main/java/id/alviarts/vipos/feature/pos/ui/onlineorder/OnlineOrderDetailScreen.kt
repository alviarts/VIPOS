package id.alviarts.vipos.feature.pos.ui.onlineorder

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
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
 * Online order detail screen (P4-01).
 *
 * Shows full order details with customer info, items, and
 * action buttons based on order status.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnlineOrderDetailScreen(
    onNavigateBack: () -> Unit,
    viewModel: OnlineOrderDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var showRejectDialog by remember { mutableStateOf(false) }
    var showCancelDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detail Pesanan") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
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
            uiState.error != null && uiState.order == null -> {
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
                    Button(onClick = { viewModel.loadOrderDetail() }) {
                        Text("Coba Lagi")
                    }
                }
            }
            uiState.order != null -> {
                OrderDetailContent(
                    order = uiState.order!!,
                    isProcessing = uiState.isProcessing,
                    onAccept = { viewModel.acceptOrder() },
                    onReject = { showRejectDialog = true },
                    onReady = { viewModel.markReady() },
                    onComplete = { viewModel.completeOrder() },
                    onCancel = { showCancelDialog = true },
                    modifier = Modifier.padding(paddingValues),
                )
            }
        }
    }

    // Error snackbar
    uiState.error?.let { error ->
        LaunchedEffect(error) {
            // Show snackbar or toast
            viewModel.clearError()
        }
    }

    // Reject dialog
    if (showRejectDialog) {
        ReasonDialog(
            title = "Tolak Pesanan",
            onDismiss = { showRejectDialog = false },
            onConfirm = { reason ->
                viewModel.rejectOrder(reason)
                showRejectDialog = false
            },
        )
    }

    // Cancel dialog
    if (showCancelDialog) {
        ReasonDialog(
            title = "Batalkan Pesanan",
            onDismiss = { showCancelDialog = false },
            onConfirm = { reason ->
                viewModel.cancelOrder(reason)
                showCancelDialog = false
            },
        )
    }
}

@Composable
private fun OrderDetailContent(
    order: OnlineOrderDto,
    isProcessing: Boolean,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onReady: () -> Unit,
    onComplete: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Header card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
            ),
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
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        order.channel?.let {
                            Text(
                                text = it.uppercase(),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                            )
                        }
                    }
                    StatusChip(status = order.status)
                }
                Spacer(modifier = Modifier.height(8.dp))
                order.createdAt?.let {
                    Text(
                        text = formatDateTime(it),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
        }

        // Customer info
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            ) {
                Text(
                    text = "Informasi Pelanggan",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(12.dp))
                
                order.customerName?.let {
                    DetailRow(label = "Nama", value = it)
                    Spacer(modifier = Modifier.height(8.dp))
                }
                order.customerPhone?.let {
                    DetailRow(label = "Telepon", value = it)
                    Spacer(modifier = Modifier.height(8.dp))
                }
                order.customerAddress?.let {
                    DetailRow(label = "Alamat", value = it)
                    Spacer(modifier = Modifier.height(8.dp))
                }
                DetailRow(
                    label = "Tipe Pesanan",
                    value = when (order.orderType) {
                        "delivery" -> "Delivery"
                        "pickup" -> "Pickup"
                        "dinein" -> "Dine In"
                        else -> order.orderType ?: "-"
                    },
                )
                order.tableNo?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    DetailRow(label = "Nomor Meja", value = it)
                }
            }
        }

        // Items
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            ) {
                Text(
                    text = "Item Pesanan",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(12.dp))
                
                order.items.forEach { item ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.productName,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium,
                            )
                            Text(
                                text = "${item.qty} x ${formatIdrLabel(item.price)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            item.notes?.let {
                                Text(
                                    text = "Catatan: $it",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Text(
                            text = formatIdrLabel(item.price * item.qty),
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                    if (item != order.items.last()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Divider()
                        Spacer(modifier = Modifier.height(12.dp))
                    }
                }
            }
        }

        // Payment summary
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer,
            ),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            ) {
                Text(
                    text = "Ringkasan Pembayaran",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                )
                Spacer(modifier = Modifier.height(12.dp))
                
                DetailRow(
                    label = "Subtotal",
                    value = formatIdrLabel(order.subtotal),
                )
                if (order.discount > 0) {
                    Spacer(modifier = Modifier.height(8.dp))
                    DetailRow(
                        label = "Diskon",
                        value = "- ${formatIdrLabel(order.discount)}",
                    )
                }
                if (order.serviceCharge > 0) {
                    Spacer(modifier = Modifier.height(8.dp))
                    DetailRow(
                        label = "Biaya Layanan",
                        value = formatIdrLabel(order.serviceCharge),
                    )
                }
                if (order.tax > 0) {
                    Spacer(modifier = Modifier.height(8.dp))
                    DetailRow(
                        label = "Pajak",
                        value = formatIdrLabel(order.tax),
                    )
                }
                if (order.deliveryFee > 0) {
                    Spacer(modifier = Modifier.height(8.dp))
                    DetailRow(
                        label = "Biaya Pengiriman",
                        value = formatIdrLabel(order.deliveryFee),
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Divider()
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "Total",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                    Text(
                        text = formatIdrLabel(order.total),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                DetailRow(
                    label = "Metode Pembayaran",
                    value = order.paymentMethod ?: "-",
                )
                DetailRow(
                    label = "Status Pembayaran",
                    value = when (order.paymentStatus) {
                        "paid" -> "Lunas"
                        "pending" -> "Pending"
                        "unpaid" -> "Belum Bayar"
                        else -> order.paymentStatus ?: "-"
                    },
                )
            }
        }

        // Notes
        order.notes?.let { notes ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    Text(
                        text = "Catatan",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = notes,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }

        // Action buttons
        if (!isProcessing) {
            OrderActionButtons(
                status = order.status,
                onAccept = onAccept,
                onReject = onReject,
                onReady = onReady,
                onComplete = onComplete,
                onCancel = onCancel,
            )
        } else {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
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
private fun DetailRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
        )
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
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelMedium,
            color = color,
            fontWeight = FontWeight.Bold,
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
        val outputFormat = SimpleDateFormat("dd MMMM yyyy, HH:mm", Locale("id", "ID"))
        outputFormat.format(date ?: Date())
    } catch (e: Exception) {
        isoString
    }
}
