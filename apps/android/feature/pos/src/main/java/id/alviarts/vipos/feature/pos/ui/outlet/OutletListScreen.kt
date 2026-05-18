package id.alviarts.vipos.feature.pos.ui.outlet

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import id.alviarts.vipos.feature.pos.data.OutletDto

/**
 * Outlet list screen (P4-11).
 *
 * Shows list of outlets with:
 * - Active/inactive filter
 * - Main outlet badge
 * - Switch outlet action
 * - Navigate to detail
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OutletListScreen(
    onNavigateBack: () -> Unit,
    onOutletClick: (Long) -> Unit,
    viewModel: OutletViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    var showSwitchDialog by remember { mutableStateOf(false) }
    var selectedOutlet by remember { mutableStateOf<OutletDto?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Outlet") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadOutlets() }) {
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
            // Active filter chips
            ActiveFilterRow(
                selectedIsActive = uiState.selectedIsActive,
                onFilterSelected = { viewModel.filterByActive(it) },
            )

            // Active filters summary
            if (uiState.selectedIsActive != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${uiState.outlets.size} outlet",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TextButton(onClick = { viewModel.clearFilters() }) {
                        Text("Hapus Filter")
                    }
                }
            }

            when {
                uiState.isLoading -> {
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
                            Button(onClick = { viewModel.loadOutlets() }) {
                                Text("Coba Lagi")
                            }
                        }
                    }
                }

                uiState.outlets.isEmpty() -> {
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
                                text = "Belum ada outlet",
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
                        items(uiState.outlets) { outlet ->
                            OutletCard(
                                outlet = outlet,
                                isActive = outlet.id == uiState.activeOutletId,
                                onClick = { onOutletClick(outlet.id) },
                                onSwitchClick = {
                                    selectedOutlet = outlet
                                    showSwitchDialog = true
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    // Switch outlet dialog
    if (showSwitchDialog && selectedOutlet != null) {
        AlertDialog(
            onDismissRequest = { showSwitchDialog = false },
            title = { Text("Ganti Outlet") },
            text = {
                Text("Apakah Anda yakin ingin mengganti outlet aktif ke ${selectedOutlet?.name}?")
            },
            confirmButton = {
                Button(
                    onClick = {
                        selectedOutlet?.let { outlet ->
                            viewModel.switchOutlet(outlet.id) { outletName ->
                                showSwitchDialog = false
                            }
                        }
                    },
                    enabled = !uiState.isSwitching,
                ) {
                    if (uiState.isSwitching) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    } else {
                        Text("Ganti")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showSwitchDialog = false },
                    enabled = !uiState.isSwitching,
                ) {
                    Text("Batal")
                }
            },
        )
    }
}

@Composable
private fun ActiveFilterRow(
    selectedIsActive: Boolean?,
    onFilterSelected: (Boolean?) -> Unit,
) {
    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            FilterChip(
                selected = selectedIsActive == null,
                onClick = { onFilterSelected(null) },
                label = { Text("Semua") },
            )
        }
        item {
            FilterChip(
                selected = selectedIsActive == true,
                onClick = { onFilterSelected(true) },
                label = { Text("Aktif") },
            )
        }
        item {
            FilterChip(
                selected = selectedIsActive == false,
                onClick = { onFilterSelected(false) },
                label = { Text("Tidak Aktif") },
            )
        }
    }
}

@Composable
private fun OutletCard(
    outlet: OutletDto,
    isActive: Boolean,
    onClick: () -> Unit,
    onSwitchClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = outlet.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        if (outlet.isMain) {
                            MainBadge()
                        }
                        if (isActive) {
                            ActiveBadge()
                        }
                    }

                    if (!outlet.code.isNullOrBlank()) {
                        Text(
                            text = "Kode: ${outlet.code}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                StatusBadge(isActive = outlet.isActive)
            }

            if (!outlet.address.isNullOrBlank()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = outlet.address,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (!outlet.phone.isNullOrBlank()) {
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
                        text = outlet.phone,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (outlet.isActive && !isActive) {
                OutlinedButton(
                    onClick = onSwitchClick,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Icon(
                        Icons.Default.Star,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Ganti ke Outlet Ini")
                }
            }
        }
    }
}

@Composable
private fun MainBadge() {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text = "Utama",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun ActiveBadge() {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.tertiary.copy(alpha = 0.1f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text = "Aktif Sekarang",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.tertiary,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun StatusBadge(isActive: Boolean) {
    val (color, text) = if (isActive) {
        MaterialTheme.colorScheme.primary to "Aktif"
    } else {
        MaterialTheme.colorScheme.error to "Tidak Aktif"
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
