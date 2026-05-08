package id.alviarts.vipos.feature.pos.ui.appointment

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import id.alviarts.vipos.feature.pos.data.AppointmentDto
import java.text.SimpleDateFormat
import java.util.*

/**
 * Appointment detail screen (P4-02).
 *
 * Shows full appointment details with customer info, services, and
 * action buttons based on appointment status.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppointmentDetailScreen(
    appointmentId: Long,
    onNavigateBack: () -> Unit,
    viewModel: AppointmentViewModel = hiltViewModel(),
) {
    val detailState by viewModel.detailState.collectAsState()
    var showCancelDialog by remember { mutableStateOf(false) }
    var showNoShowDialog by remember { mutableStateOf(false) }
    var showRescheduleDialog by remember { mutableStateOf(false) }

    LaunchedEffect(appointmentId) {
        viewModel.loadAppointmentDetail(appointmentId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detail Janji Temu") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
            )
        },
    ) { paddingValues ->
        when {
            detailState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
            detailState.error != null && detailState.appointment == null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = detailState.error ?: "Terjadi kesalahan",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.error,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadAppointmentDetail(appointmentId) }) {
                        Text("Coba Lagi")
                    }
                }
            }
            detailState.appointment != null -> {
                AppointmentDetailContent(
                    appointment = detailState.appointment!!,
                    isProcessing = detailState.isLoading,
                    onConfirm = { viewModel.confirmAppointment(appointmentId) },
                    onStart = { viewModel.startAppointment(appointmentId) },
                    onComplete = { viewModel.completeAppointment(appointmentId) },
                    onCancel = { showCancelDialog = true },
                    onNoShow = { showNoShowDialog = true },
                    onReschedule = { showRescheduleDialog = true },
                    modifier = Modifier.padding(paddingValues),
                )
            }
        }
    }

    // Error snackbar
    detailState.error?.let { error ->
        LaunchedEffect(error) {
            viewModel.clearDetailError()
        }
    }

    // Cancel dialog
    if (showCancelDialog) {
        ReasonDialog(
            title = "Batalkan Janji Temu",
            onDismiss = { showCancelDialog = false },
            onConfirm = { reason ->
                viewModel.cancelAppointment(appointmentId, reason)
                showCancelDialog = false
            },
        )
    }

    // No-show dialog
    if (showNoShowDialog) {
        ReasonDialog(
            title = "Tandai Tidak Hadir",
            onDismiss = { showNoShowDialog = false },
            onConfirm = { reason ->
                viewModel.markNoShow(appointmentId, reason)
                showNoShowDialog = false
            },
        )
    }

    // Reschedule dialog (simplified - in production would have date/time picker)
    if (showRescheduleDialog) {
        AlertDialog(
            onDismissRequest = { showRescheduleDialog = false },
            title = { Text("Reschedule") },
            text = { Text("Fitur reschedule akan segera tersedia") },
            confirmButton = {
                TextButton(onClick = { showRescheduleDialog = false }) {
                    Text("OK")
                }
            },
        )
    }
}

@Composable
private fun AppointmentDetailContent(
    appointment: AppointmentDto,
    isProcessing: Boolean,
    onConfirm: () -> Unit,
    onStart: () -> Unit,
    onComplete: () -> Unit,
    onCancel: () -> Unit,
    onNoShow: () -> Unit,
    onReschedule: () -> Unit,
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
                            text = appointment.refNo,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                    StatusChip(status = appointment.status)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = formatDateTime(appointment.startAt),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                appointment.durationMinutes?.let { duration ->
                    Text(
                        text = "Durasi: $duration menit",
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
                Spacer(modifier = Modifier.height(8.dp))
                InfoRow(label = "Nama", value = appointment.customerName ?: "-")
                appointment.customerPhone?.let {
                    InfoRow(label = "Telepon", value = it)
                }
                appointment.customerEmail?.let {
                    InfoRow(label = "Email", value = it)
                }
            }
        }

        // Staff & Resource info
        if (appointment.staffName != null || appointment.resourceName != null) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    Text(
                        text = "Penugasan",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    appointment.staffName?.let {
                        InfoRow(label = "Staff", value = it)
                    }
                    appointment.resourceName?.let {
                        InfoRow(label = "Resource", value = it)
                    }
                }
            }
        }

        // Services
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            ) {
                Text(
                    text = "Layanan",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(8.dp))

                if (appointment.services.isEmpty()) {
                    Text(
                        text = "Tidak ada layanan",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    appointment.services.forEach { service ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = service.serviceName,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                service.durationMinutes?.let { duration ->
                                    Text(
                                        text = "$duration menit",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "${service.qty}x ${formatIdrLabel(service.price)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                                Text(
                                    text = formatIdrLabel(service.subtotal),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                        if (service != appointment.services.last()) {
                            Divider(modifier = Modifier.padding(vertical = 4.dp))
                        }
                    }
                }
            }
        }

        // Payment info
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
            ) {
                Text(
                    text = "Pembayaran",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "Total",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = formatIdrLabel(appointment.totalAmount),
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }

                if (appointment.depositAmount > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = "Deposit",
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            text = formatIdrLabel(appointment.depositAmount) +
                                    if (appointment.depositPaid) " (Lunas)" else " (Belum Bayar)",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (appointment.depositPaid)
                                MaterialTheme.colorScheme.primary
                            else
                                MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
        }

        // Notes
        if (appointment.notes != null || appointment.internalNotes != null) {
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
                    appointment.notes?.let {
                        Text(
                            text = "Catatan Pelanggan:",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    appointment.internalNotes?.let {
                        Text(
                            text = "Catatan Internal:",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }

        // Action buttons
        ActionButtons(
            status = appointment.status,
            isProcessing = isProcessing,
            onConfirm = onConfirm,
            onStart = onStart,
            onComplete = onComplete,
            onCancel = onCancel,
            onNoShow = onNoShow,
            onReschedule = onReschedule,
        )
    }
}

@Composable
private fun ActionButtons(
    status: String,
    isProcessing: Boolean,
    onConfirm: () -> Unit,
    onStart: () -> Unit,
    onComplete: () -> Unit,
    onCancel: () -> Unit,
    onNoShow: () -> Unit,
    onReschedule: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when (status) {
            "PENDING" -> {
                Button(
                    onClick = onConfirm,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    } else {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Konfirmasi")
                    }
                }
                OutlinedButton(
                    onClick = onReschedule,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                ) {
                    Icon(Icons.Default.DateRange, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Reschedule")
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = onCancel,
                        modifier = Modifier.weight(1f),
                        enabled = !isProcessing,
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error,
                        ),
                    ) {
                        Text("Batalkan")
                    }
                    OutlinedButton(
                        onClick = onNoShow,
                        modifier = Modifier.weight(1f),
                        enabled = !isProcessing,
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error,
                        ),
                    ) {
                        Text("No Show")
                    }
                }
            }
            "CONFIRMED" -> {
                Button(
                    onClick = onStart,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    } else {
                        Icon(Icons.Default.PlayArrow, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Mulai")
                    }
                }
                OutlinedButton(
                    onClick = onReschedule,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                ) {
                    Icon(Icons.Default.DateRange, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Reschedule")
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(
                        onClick = onCancel,
                        modifier = Modifier.weight(1f),
                        enabled = !isProcessing,
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error,
                        ),
                    ) {
                        Text("Batalkan")
                    }
                    OutlinedButton(
                        onClick = onNoShow,
                        modifier = Modifier.weight(1f),
                        enabled = !isProcessing,
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error,
                        ),
                    ) {
                        Text("No Show")
                    }
                }
            }
            "IN_PROGRESS" -> {
                Button(
                    onClick = onComplete,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                ) {
                    if (isProcessing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    } else {
                        Icon(Icons.Default.CheckCircle, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Selesai")
                    }
                }
                OutlinedButton(
                    onClick = onCancel,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text("Batalkan")
                }
            }
            "COMPLETED", "CANCELLED", "NO_SHOW" -> {
                // No actions available for terminal states
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Text(
                        text = when (status) {
                            "COMPLETED" -> "Janji temu telah selesai"
                            "CANCELLED" -> "Janji temu telah dibatalkan"
                            "NO_SHOW" -> "Pelanggan tidak hadir"
                            else -> ""
                        },
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val (color, label) = when (status) {
        "PENDING" -> MaterialTheme.colorScheme.tertiary to "Menunggu"
        "CONFIRMED" -> MaterialTheme.colorScheme.primary to "Dikonfirmasi"
        "IN_PROGRESS" -> MaterialTheme.colorScheme.secondary to "Berlangsung"
        "COMPLETED" -> MaterialTheme.colorScheme.primaryContainer to "Selesai"
        "CANCELLED" -> MaterialTheme.colorScheme.error to "Dibatalkan"
        "NO_SHOW" -> MaterialTheme.colorScheme.errorContainer to "Tidak Hadir"
        else -> MaterialTheme.colorScheme.surfaceVariant to status
    }

    AssistChip(
        onClick = { },
        label = { Text(label) },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = color,
            labelColor = MaterialTheme.colorScheme.onPrimary,
        ),
    )
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
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
        )
    }
}

@Composable
fun ReasonDialog(
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
                Text("Masukkan alasan (opsional):")
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Alasan...") },
                    maxLines = 3,
                )
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(reason.ifBlank { null } ?: "") }) {
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
        val date = inputFormat.parse(isoString) ?: return isoString

        val outputFormat = SimpleDateFormat("EEEE, dd MMMM yyyy, HH:mm", Locale("id", "ID"))
        outputFormat.format(date)
    } catch (e: Exception) {
        isoString
    }
}
