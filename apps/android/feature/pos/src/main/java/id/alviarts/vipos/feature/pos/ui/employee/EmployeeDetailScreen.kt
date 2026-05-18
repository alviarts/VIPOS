package id.alviarts.vipos.feature.pos.ui.employee

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
import id.alviarts.vipos.feature.pos.data.EmployeeDto

/**
 * Employee detail screen (P4-08).
 *
 * Displays full employee information with actions:
 * - Edit employee
 * - Delete employee
 * - View attendance history
 * - View payroll history
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmployeeDetailScreen(
    employeeId: Long,
    onNavigateBack: () -> Unit,
    onEditClick: (Long) -> Unit,
    viewModel: EmployeeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDeleteDialog by remember { mutableStateOf(false) }

    LaunchedEffect(employeeId) {
        viewModel.loadEmployeeDetail(employeeId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detail Karyawan") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    IconButton(onClick = { onEditClick(employeeId) }) {
                        Icon(Icons.Default.Edit, contentDescription = "Edit")
                    }
                    IconButton(onClick = { showDeleteDialog = true }) {
                        Icon(Icons.Default.Delete, contentDescription = "Hapus")
                    }
                },
            )
        },
    ) { paddingValues ->
        when {
            uiState.isLoadingDetail -> {
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
                        Button(onClick = { viewModel.loadEmployeeDetail(employeeId) }) {
                            Text("Coba Lagi")
                        }
                    }
                }
            }

            uiState.currentEmployee != null -> {
                EmployeeDetailContent(
                    employee = uiState.currentEmployee!!,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                )
            }
        }
    }

    // Delete confirmation dialog
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Hapus Karyawan") },
            text = { Text("Apakah Anda yakin ingin menghapus karyawan ini?") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteEmployee(employeeId) {
                            showDeleteDialog = false
                            onNavigateBack()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text("Hapus")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Batal")
                }
            },
        )
    }
}

@Composable
private fun EmployeeDetailContent(
    employee: EmployeeDto,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Header card
        Card(
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = employee.name,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    StatusBadge(employee.status)
                }

                Text(
                    text = "No. Karyawan: ${employee.employeeNo}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                if (!employee.position.isNullOrBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            text = employee.position,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }

                if (!employee.departmentName.isNullOrBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Icon(
                            Icons.Default.Home,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            text = employee.departmentName,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }

        // Contact information
        SectionCard(title = "Informasi Kontak") {
            if (!employee.phone.isNullOrBlank()) {
                InfoRow(
                    icon = Icons.Default.Phone,
                    label = "Telepon",
                    value = employee.phone,
                )
            }

            if (!employee.email.isNullOrBlank()) {
                InfoRow(
                    icon = Icons.Default.Email,
                    label = "Email",
                    value = employee.email,
                )
            }

            if (!employee.address.isNullOrBlank()) {
                InfoRow(
                    icon = Icons.Default.LocationOn,
                    label = "Alamat",
                    value = employee.address,
                )
            }
        }

        // Employment information
        SectionCard(title = "Informasi Kepegawaian") {
            if (!employee.hireDate.isNullOrBlank()) {
                InfoRow(
                    icon = Icons.Default.DateRange,
                    label = "Tanggal Masuk",
                    value = employee.hireDate,
                )
            }

            if (!employee.terminationDate.isNullOrBlank()) {
                InfoRow(
                    icon = Icons.Default.DateRange,
                    label = "Tanggal Keluar",
                    value = employee.terminationDate,
                )
            }

            if (!employee.payrollStructureName.isNullOrBlank()) {
                InfoRow(
                    icon = Icons.Default.Info,
                    label = "Struktur Gaji",
                    value = employee.payrollStructureName,
                )
            }
        }

        // Emergency contact
        if (!employee.emergencyContactName.isNullOrBlank() || !employee.emergencyContactPhone.isNullOrBlank()) {
            SectionCard(title = "Kontak Darurat") {
                if (!employee.emergencyContactName.isNullOrBlank()) {
                    InfoRow(
                        icon = Icons.Default.Person,
                        label = "Nama",
                        value = employee.emergencyContactName,
                    )
                }

                if (!employee.emergencyContactPhone.isNullOrBlank()) {
                    InfoRow(
                        icon = Icons.Default.Phone,
                        label = "Telepon",
                        value = employee.emergencyContactPhone,
                    )
                }
            }
        }

        // Notes
        if (!employee.notes.isNullOrBlank()) {
            SectionCard(title = "Catatan") {
                Text(
                    text = employee.notes,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        // Attendance methods
        if (!employee.attendanceMethods.isNullOrEmpty()) {
            SectionCard(title = "Metode Absensi") {
                Text(
                    text = employee.attendanceMethods.joinToString(", "),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            content()
        }
    }
}

@Composable
private fun InfoRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.primary,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (color, text) = when (status) {
        "active" -> MaterialTheme.colorScheme.primary to "Aktif"
        "inactive" -> MaterialTheme.colorScheme.secondary to "Tidak Aktif"
        "terminated" -> MaterialTheme.colorScheme.error to "Berhenti"
        else -> MaterialTheme.colorScheme.surfaceVariant to status
    }

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Medium,
        )
    }
}
