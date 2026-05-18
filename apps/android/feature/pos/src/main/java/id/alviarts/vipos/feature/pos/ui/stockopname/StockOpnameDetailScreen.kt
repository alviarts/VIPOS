package id.alviarts.vipos.feature.pos.ui.stockopname

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import id.alviarts.vipos.feature.pos.data.StockOpnameItemDto
import java.text.SimpleDateFormat
import java.util.*

/**
 * Stock opname detail screen (P4-04).
 *
 * Shows opname details with:
 * - List of items with qty_sistem vs qty_fisik
 * - Input physical count for each item
 * - Finalize opname (apply adjustments)
 * - Delete draft opname
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockOpnameDetailScreen(
    opnameId: Long,
    onNavigateBack: () -> Unit,
    viewModel: StockOpnameViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val opname = uiState.currentOpname

    var showFinalizeDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    LaunchedEffect(opnameId) {
        viewModel.loadOpnameDetail(opnameId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(opname?.kode ?: "Stock Opname") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    if (opname?.status == "draft") {
                        IconButton(onClick = { showDeleteDialog = true }) {
                            Icon(Icons.Default.Delete, contentDescription = "Hapus")
                        }
                    }
                    IconButton(onClick = { viewModel.loadOpnameDetail(opnameId) }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
            )
        },
        floatingActionButton = {
            if (opname?.status == "draft") {
                FloatingActionButton(
                    onClick = { showFinalizeDialog = true },
                    containerColor = MaterialTheme.colorScheme.primary,
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = "Finalisasi")
                }
            }
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
                        Button(onClick = { viewModel.loadOpnameDetail(opnameId) }) {
                            Text("Coba Lagi")
                        }
                    }
                }
            }

            opname != null -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    // Header info
                    item {
                        OpnameHeaderCard(opname = opname)
                    }

                    // Stats summary
                    item {
                        OpnameStatsCard(opname = opname)
                    }

                    // Items list
                    item {
                        Text(
                            text = "Daftar Produk",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                    }

                    items(opname.items) { item ->
                        OpnameItemCard(
                            item = item,
                            isDraft = opname.status == "draft",
                            onUpdateQty = { qty, keterangan ->
                                viewModel.updateItem(
                                    opnameId = opnameId,
                                    productId = item.productId,
                                    qtyFisik = qty,
                                    keterangan = keterangan,
                                )
                            },
                            isUpdating = uiState.isUpdating,
                        )
                    }
                }
            }
        }
    }

    // Finalize dialog
    if (showFinalizeDialog && opname != null) {
        AlertDialog(
            onDismissRequest = { showFinalizeDialog = false },
            icon = { Icon(Icons.Default.CheckCircle, contentDescription = null) },
            title = { Text("Finalisasi Stock Opname?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Setelah difinalisasi:")
                    Text("• Stok sistem akan disesuaikan dengan qty fisik")
                    Text("• Pergerakan stok akan dicatat")
                    Text("• Opname tidak bisa diubah lagi")
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Total ${opname.varianceCount} produk dengan selisih",
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.finalizeOpname(
                            opnameId = opnameId,
                            applyAdjustments = true,
                            onSuccess = {
                                showFinalizeDialog = false
                            },
                        )
                    },
                    enabled = !uiState.isFinalizing,
                ) {
                    if (uiState.isFinalizing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("Finalisasi")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showFinalizeDialog = false },
                    enabled = !uiState.isFinalizing,
                ) {
                    Text("Batal")
                }
            },
        )
    }

    // Delete dialog
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            icon = { Icon(Icons.Default.Delete, contentDescription = null) },
            title = { Text("Hapus Stock Opname?") },
            text = { Text("Opname draft akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteOpname(
                            opnameId = opnameId,
                            onSuccess = {
                                showDeleteDialog = false
                                onNavigateBack()
                            },
                        )
                    },
                    enabled = !uiState.isDeleting,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    if (uiState.isDeleting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("Hapus")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showDeleteDialog = false },
                    enabled = !uiState.isDeleting,
                ) {
                    Text("Batal")
                }
            },
        )
    }
}

@Composable
private fun OpnameHeaderCard(opname: id.alviarts.vipos.feature.pos.data.StockOpnameDto) {
    val dateFormat = remember { SimpleDateFormat("dd MMMM yyyy", Locale("id", "ID")) }

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
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = opname.kode,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
                StatusBadge(status = opname.status)
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(
                    Icons.Default.DateRange,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    text = try {
                        dateFormat.format(SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(opname.tanggal.take(10))!!)
                    } catch (e: Exception) {
                        opname.tanggal.take(10)
                    },
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            if (!opname.keterangan.isNullOrBlank()) {
                Text(
                    text = opname.keterangan,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            if (!opname.createdByName.isNullOrBlank()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                    Text(
                        text = "Dibuat oleh ${opname.createdByName}",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }

            if (opname.status == "final" && !opname.finalizedByName.isNullOrBlank()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                    Text(
                        text = "Difinalisasi oleh ${opname.finalizedByName}",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun OpnameStatsCard(opname: id.alviarts.vipos.feature.pos.data.StockOpnameDto) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            StatColumn(
                label = "Total Item",
                value = opname.itemCount.toString(),
                icon = Icons.Default.ShoppingCart,
            )
            StatColumn(
                label = "Dihitung",
                value = opname.countedCount.toString(),
                icon = Icons.Default.CheckCircle,
                valueColor = MaterialTheme.colorScheme.primary,
            )
            StatColumn(
                label = "Selisih",
                value = opname.varianceCount.toString(),
                icon = Icons.Default.Warning,
                valueColor = if (opname.varianceCount > 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun StatColumn(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    valueColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = valueColor,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun OpnameItemCard(
    item: StockOpnameItemDto,
    isDraft: Boolean,
    onUpdateQty: (Int, String?) -> Unit,
    isUpdating: Boolean,
) {
    var showEditDialog by remember { mutableStateOf(false) }
    val selisih = item.selisih ?: 0
    val hasVariance = selisih != 0

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (hasVariance && item.qtyFisik != null) {
                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
            } else {
                MaterialTheme.colorScheme.surface
            },
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Product name
            Text(
                text = item.productName ?: "Unknown Product",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )

            if (!item.productSku.isNullOrBlank()) {
                Text(
                    text = "SKU: ${item.productSku}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Qty comparison
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Qty Sistem
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Qty Sistem",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = "${item.qtySistem} ${item.productSatuan ?: ""}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                }

                Icon(
                    Icons.Default.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                // Qty Fisik
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Qty Fisik",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = if (item.qtyFisik != null) {
                            "${item.qtyFisik} ${item.productSatuan ?: ""}"
                        } else {
                            "-"
                        },
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (item.qtyFisik != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                // Selisih
                if (item.qtyFisik != null) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Selisih",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = if (selisih > 0) "+$selisih" else selisih.toString(),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = if (hasVariance) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }

            // Keterangan
            if (!item.keterangan.isNullOrBlank()) {
                Text(
                    text = "Catatan: ${item.keterangan}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Edit button (only for draft)
            if (isDraft) {
                Button(
                    onClick = { showEditDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isUpdating,
                ) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (item.qtyFisik != null) "Ubah Qty Fisik" else "Input Qty Fisik")
                }
            }
        }
    }

    // Edit dialog
    if (showEditDialog) {
        EditQtyDialog(
            item = item,
            onDismiss = { showEditDialog = false },
            onConfirm = { qty, keterangan ->
                onUpdateQty(qty, keterangan)
                showEditDialog = false
            },
        )
    }
}

@Composable
private fun EditQtyDialog(
    item: StockOpnameItemDto,
    onDismiss: () -> Unit,
    onConfirm: (Int, String?) -> Unit,
) {
    var qtyText by remember { mutableStateOf(item.qtyFisik?.toString() ?: item.qtySistem.toString()) }
    var keterangan by remember { mutableStateOf(item.keterangan ?: "") }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Edit, contentDescription = null) },
        title = { Text("Input Qty Fisik") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = item.productName ?: "Unknown Product",
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "Qty Sistem: ${item.qtySistem} ${item.productSatuan ?: ""}",
                    style = MaterialTheme.typography.bodyMedium,
                )

                OutlinedTextField(
                    value = qtyText,
                    onValueChange = { qtyText = it },
                    label = { Text("Qty Fisik") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                OutlinedTextField(
                    value = keterangan,
                    onValueChange = { keterangan = it },
                    label = { Text("Catatan (opsional)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val qty = qtyText.toIntOrNull() ?: item.qtySistem
                    onConfirm(qty, keterangan.ifBlank { null })
                },
            ) {
                Text("Simpan")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal")
            }
        },
    )
}

@Composable
private fun StatusBadge(status: String) {
    val (color, text) = when (status) {
        "draft" -> MaterialTheme.colorScheme.secondary to "Draft"
        "final" -> MaterialTheme.colorScheme.primary to "Final"
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
