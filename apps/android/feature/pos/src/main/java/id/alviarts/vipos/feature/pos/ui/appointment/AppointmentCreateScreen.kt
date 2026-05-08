package id.alviarts.vipos.feature.pos.ui.appointment

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
import id.alviarts.vipos.feature.pos.data.AppointmentCreateRequestDto
import id.alviarts.vipos.feature.pos.data.AppointmentServiceRequestDto
import java.text.SimpleDateFormat
import java.util.*

/**
 * Appointment create screen (P4-02).
 *
 * Form to create new appointment with:
 * - Customer info
 * - Date & time selection
 * - Service selection
 * - Staff assignment (optional)
 * - Deposit amount (optional)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppointmentCreateScreen(
    onNavigateBack: () -> Unit,
    onSuccess: (Long) -> Unit,
    viewModel: AppointmentViewModel = hiltViewModel(),
) {
    var customerName by remember { mutableStateOf("") }
    var customerPhone by remember { mutableStateOf("") }
    var customerEmail by remember { mutableStateOf("") }
    var serviceName by remember { mutableStateOf("") }
    var servicePrice by remember { mutableStateOf("") }
    var serviceDuration by remember { mutableStateOf("") }
    var depositAmount by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var internalNotes by remember { mutableStateOf("") }

    // For simplicity, using current date + 1 day as default
    val defaultDateTime = remember {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_MONTH, 1)
        cal.set(Calendar.HOUR_OF_DAY, 10)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.time
    }
    var selectedDateTime by remember { mutableStateOf(defaultDateTime) }

    val detailState by viewModel.detailState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Buat Janji Temu") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
            )
        },
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Customer info section
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

                    OutlinedTextField(
                        value = customerName,
                        onValueChange = { customerName = it },
                        label = { Text("Nama Pelanggan *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = customerPhone,
                        onValueChange = { customerPhone = it },
                        label = { Text("No. Telepon") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = customerEmail,
                        onValueChange = { customerEmail = it },
                        label = { Text("Email") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                }
            }

            // Date & time section
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    Text(
                        text = "Waktu Janji Temu",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    // Simplified: just show current selection
                    // In production, would use DatePicker and TimePicker
                    OutlinedTextField(
                        value = formatDateTimeForDisplay(selectedDateTime),
                        onValueChange = { },
                        label = { Text("Tanggal & Waktu *") },
                        modifier = Modifier.fillMaxWidth(),
                        readOnly = true,
                        trailingIcon = {
                            Text(
                                text = "📅",
                                modifier = Modifier.padding(end = 8.dp),
                            )
                        },
                    )
                    Text(
                        text = "Note: Gunakan default (besok jam 10:00) atau edit manual di backend",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }

            // Service section
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

                    OutlinedTextField(
                        value = serviceName,
                        onValueChange = { serviceName = it },
                        label = { Text("Nama Layanan *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedTextField(
                            value = servicePrice,
                            onValueChange = { servicePrice = it.filter { c -> c.isDigit() } },
                            label = { Text("Harga (Rp) *") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                        OutlinedTextField(
                            value = serviceDuration,
                            onValueChange = { serviceDuration = it.filter { c -> c.isDigit() } },
                            label = { Text("Durasi (menit)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                        )
                    }
                }
            }

            // Payment section
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

                    OutlinedTextField(
                        value = depositAmount,
                        onValueChange = { depositAmount = it.filter { c -> c.isDigit() } },
                        label = { Text("Deposit (Rp)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        placeholder = { Text("0") },
                    )
                    Text(
                        text = "Deposit yang harus dibayar pelanggan untuk konfirmasi",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }

            // Notes section
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

                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Catatan Pelanggan") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        maxLines = 4,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = internalNotes,
                        onValueChange = { internalNotes = it },
                        label = { Text("Catatan Internal") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        maxLines = 4,
                    )
                }
            }

            // Error message
            detailState.error?.let { error ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer,
                    ),
                ) {
                    Text(
                        text = error,
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
            }

            // Submit button
            Button(
                onClick = {
                    val price = servicePrice.toLongOrNull() ?: 0
                    val duration = serviceDuration.toIntOrNull()
                    val deposit = depositAmount.toLongOrNull() ?: 0

                    val request = AppointmentCreateRequestDto(
                        customerName = customerName,
                        customerPhone = customerPhone.ifBlank { null },
                        customerEmail = customerEmail.ifBlank { null },
                        startAt = formatDateTimeForApi(selectedDateTime),
                        durationMinutes = duration,
                        services = listOf(
                            AppointmentServiceRequestDto(
                                serviceName = serviceName,
                                qty = 1,
                                price = price,
                                durationMinutes = duration,
                            )
                        ),
                        depositAmount = deposit,
                        notes = notes.ifBlank { null },
                        internalNotes = internalNotes.ifBlank { null },
                    )

                    viewModel.createAppointment(request) { appointment ->
                        onSuccess(appointment.id)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !detailState.isLoading &&
                        customerName.isNotBlank() &&
                        serviceName.isNotBlank() &&
                        servicePrice.isNotBlank(),
            ) {
                if (detailState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Buat Janji Temu")
            }

            Text(
                text = "* Wajib diisi",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private fun formatDateTimeForDisplay(date: Date): String {
    val format = SimpleDateFormat("EEEE, dd MMMM yyyy, HH:mm", Locale("id", "ID"))
    return format.format(date)
}

private fun formatDateTimeForApi(date: Date): String {
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
    format.timeZone = TimeZone.getTimeZone("UTC")
    return format.format(date)
}
