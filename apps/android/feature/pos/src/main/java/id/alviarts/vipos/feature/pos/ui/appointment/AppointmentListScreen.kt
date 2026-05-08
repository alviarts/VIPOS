package id.alviarts.vipos.feature.pos.ui.appointment

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
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
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import id.alviarts.vipos.feature.pos.data.AppointmentDto
import java.text.SimpleDateFormat
import java.util.*

/**
 * Appointment list screen (P4-02).
 *
 * Displays list of appointments/reservations with filters:
 * - Status (PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW)
 * - Date range
 * - Staff
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppointmentListScreen(
    onNavigateBack: () -> Unit,
    onAppointmentClick: (Long) -> Unit,
    onCreateClick: () -> Unit,
    viewModel: AppointmentViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    // Infinite scroll
    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
            .collect { lastVisibleIndex ->
                if (lastVisibleIndex != null &&
                    lastVisibleIndex >= uiState.appointments.size - 3 &&
                    !uiState.isLoading &&
                    uiState.hasMore
                ) {
                    viewModel.loadMore()
                }
            }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Janji Temu") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadAppointments() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onCreateClick) {
                Icon(Icons.Default.Add, contentDescription = "Buat Janji Temu")
            }
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
                onStatusSelected = { viewModel.filterByStatus(it) },
            )

            // Active filters summary
            if (uiState.selectedStatus != null || uiState.dateFrom != null || uiState.dateTo != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${uiState.total} janji temu",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TextButton(onClick = { viewModel.clearFilters() }) {
                        Text("Hapus Filter")
                    }
                }
            }

            when {
                uiState.isLoading && uiState.appointments.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.error != null && uiState.appointments.isEmpty() -> {
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
                        Button(onClick = { viewModel.loadAppointments() }) {
                            Text("Coba Lagi")
                        }
                    }
                }
                uiState.appointments.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                text = "Belum ada janji temu",
                                style = MaterialTheme.typography.bodyLarge,
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = onCreateClick) {
                                Icon(Icons.Default.Add, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Buat Janji Temu")
                            }
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        state = listState,
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(uiState.appointments, key = { it.id }) { appointment ->
                            AppointmentCard(
                                appointment = appointment,
                                onClick = { onAppointmentClick(appointment.id) },
                            )
                        }

                        // Loading indicator at bottom
                        if (uiState.isLoading) {
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
                }
            }
        }
    }
}

@Composable
private fun StatusFilterRow(
    selectedStatus: String?,
    onStatusSelected: (String?) -> Unit,
) {
    val statuses = listOf(
        null to "Semua",
        "PENDING" to "Menunggu",
        "CONFIRMED" to "Dikonfirmasi",
        "IN_PROGRESS" to "Berlangsung",
        "COMPLETED" to "Selesai",
        "CANCELLED" to "Dibatalkan",
        "NO_SHOW" to "Tidak Hadir",
    )

    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(statuses) { (status, label) ->
            FilterChip(
                selected = selectedStatus == status,
                onClick = { onStatusSelected(status) },
                label = { Text(label) },
            )
        }
    }
}

@Composable
private fun AppointmentCard(
    appointment: AppointmentDto,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            // Header: ref_no + status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = appointment.refNo,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                StatusBadge(status = appointment.status)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Customer info
            Row(
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = appointment.customerName ?: "Tanpa Nama",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Date & time
            Row(
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Default.DateRange,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = formatDateTime(appointment.startAt),
                    style = MaterialTheme.typography.bodyMedium,
                )
                appointment.durationMinutes?.let { duration ->
                    Text(
                        text = " • $duration menit",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Staff (if assigned)
            appointment.staffName?.let { staffName ->
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "Staff: $staffName",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Services summary
            if (appointment.services.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = appointment.services.joinToString(", ") { it.serviceName },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }

            // Total amount
            if (appointment.totalAmount > 0) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = formatIdrLabel(appointment.totalAmount),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (color, label) = when (status) {
        "PENDING" -> MaterialTheme.colorScheme.tertiary to "Menunggu"
        "CONFIRMED" -> MaterialTheme.colorScheme.primary to "Dikonfirmasi"
        "IN_PROGRESS" -> MaterialTheme.colorScheme.secondary to "Berlangsung"
        "COMPLETED" -> MaterialTheme.colorScheme.primaryContainer to "Selesai"
        "CANCELLED" -> MaterialTheme.colorScheme.error to "Dibatalkan"
        "NO_SHOW" -> MaterialTheme.colorScheme.errorContainer to "Tidak Hadir"
        else -> MaterialTheme.colorScheme.surfaceVariant to status
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color)
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimary,
        )
    }
}

private fun formatDateTime(isoString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
        inputFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = inputFormat.parse(isoString) ?: return isoString

        val outputFormat = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))
        outputFormat.format(date)
    } catch (e: Exception) {
        isoString
    }
}
