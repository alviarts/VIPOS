package id.alviarts.vipos.feature.pos.ui.employee

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import id.alviarts.vipos.feature.pos.data.EmployeeUpdateRequestDto

/**
 * Employee edit screen (P4-08).
 *
 * Form to edit existing employee with all fields.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmployeeEditScreen(
    employeeId: Long,
    onNavigateBack: () -> Unit,
    viewModel: EmployeeViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var position by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("active") }
    var hireDate by remember { mutableStateOf("") }
    var terminationDate by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var emergencyContactName by remember { mutableStateOf("") }
    var emergencyContactPhone by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    var nameError by remember { mutableStateOf(false) }
    var isInitialized by remember { mutableStateOf(false) }

    LaunchedEffect(employeeId) {
        viewModel.loadEmployeeDetail(employeeId)
    }

    LaunchedEffect(uiState.currentEmployee) {
        if (uiState.currentEmployee != null && !isInitialized) {
            val employee = uiState.currentEmployee!!
            name = employee.name
            email = employee.email ?: ""
            phone = employee.phone ?: ""
            position = employee.position ?: ""
            status = employee.status
            hireDate = employee.hireDate ?: ""
            terminationDate = employee.terminationDate ?: ""
            address = employee.address ?: ""
            emergencyContactName = employee.emergencyContactName ?: ""
            emergencyContactPhone = employee.emergencyContactPhone ?: ""
            notes = employee.notes ?: ""
            isInitialized = true
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Edit Karyawan") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
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

            uiState.error != null && !isInitialized -> {
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

            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Basic information
                    Text(
                        text = "Informasi Dasar",
                        style = MaterialTheme.typography.titleMedium,
                    )

                    OutlinedTextField(
                        value = name,
                        onValueChange = {
                            name = it
                            nameError = false
                        },
                        label = { Text("Nama *") },
                        isError = nameError,
                        supportingText = if (nameError) {
                            { Text("Nama wajib diisi") }
                        } else null,
                        modifier = Modifier.fillMaxWidth(),
                    )

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        label = { Text("Telepon") },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    OutlinedTextField(
                        value = position,
                        onValueChange = { position = it },
                        label = { Text("Posisi") },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    // Status dropdown
                    var statusExpanded by remember { mutableStateOf(false) }
                    ExposedDropdownMenuBox(
                        expanded = statusExpanded,
                        onExpandedChange = { statusExpanded = it },
                    ) {
                        OutlinedTextField(
                            value = when (status) {
                                "active" -> "Aktif"
                                "inactive" -> "Tidak Aktif"
                                "terminated" -> "Berhenti"
                                else -> status
                            },
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Status") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = statusExpanded) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor(),
                        )
                        ExposedDropdownMenu(
                            expanded = statusExpanded,
                            onDismissRequest = { statusExpanded = false },
                        ) {
                            DropdownMenuItem(
                                text = { Text("Aktif") },
                                onClick = {
                                    status = "active"
                                    statusExpanded = false
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Tidak Aktif") },
                                onClick = {
                                    status = "inactive"
                                    statusExpanded = false
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Berhenti") },
                                onClick = {
                                    status = "terminated"
                                    statusExpanded = false
                                },
                            )
                        }
                    }

                    OutlinedTextField(
                        value = hireDate,
                        onValueChange = { hireDate = it },
                        label = { Text("Tanggal Masuk (YYYY-MM-DD)") },
                        placeholder = { Text("2024-01-01") },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (status == "terminated") {
                        OutlinedTextField(
                            value = terminationDate,
                            onValueChange = { terminationDate = it },
                            label = { Text("Tanggal Keluar (YYYY-MM-DD)") },
                            placeholder = { Text("2024-12-31") },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    Divider()

                    // Contact information
                    Text(
                        text = "Informasi Kontak",
                        style = MaterialTheme.typography.titleMedium,
                    )

                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it },
                        label = { Text("Alamat") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Divider()

                    // Emergency contact
                    Text(
                        text = "Kontak Darurat",
                        style = MaterialTheme.typography.titleMedium,
                    )

                    OutlinedTextField(
                        value = emergencyContactName,
                        onValueChange = { emergencyContactName = it },
                        label = { Text("Nama Kontak Darurat") },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    OutlinedTextField(
                        value = emergencyContactPhone,
                        onValueChange = { emergencyContactPhone = it },
                        label = { Text("Telepon Kontak Darurat") },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    Divider()

                    // Notes
                    Text(
                        text = "Catatan",
                        style = MaterialTheme.typography.titleMedium,
                    )

                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        label = { Text("Catatan") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth(),
                    )

                    // Error message
                    if (uiState.error != null) {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.errorContainer,
                            ),
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Icon(
                                    Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.error,
                                )
                                Text(
                                    text = uiState.error ?: "Terjadi kesalahan",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.error,
                                )
                            }
                        }
                    }

                    // Submit button
                    Button(
                        onClick = {
                            if (name.isBlank()) {
                                nameError = true
                                return@Button
                            }

                            val request = EmployeeUpdateRequestDto(
                                name = name,
                                email = email.ifBlank { null },
                                phone = phone.ifBlank { null },
                                position = position.ifBlank { null },
                                status = status,
                                hireDate = hireDate.ifBlank { null },
                                terminationDate = if (status == "terminated") terminationDate.ifBlank { null } else null,
                                address = address.ifBlank { null },
                                emergencyContactName = emergencyContactName.ifBlank { null },
                                emergencyContactPhone = emergencyContactPhone.ifBlank { null },
                                notes = notes.ifBlank { null },
                            )

                            viewModel.updateEmployee(employeeId, request) {
                                onNavigateBack()
                            }
                        },
                        enabled = !uiState.isUpdating,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (uiState.isUpdating) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                        } else {
                            Text("Simpan")
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}
