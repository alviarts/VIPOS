package id.alviarts.vipos.feature.pos.ui.inventory

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import id.alviarts.vipos.feature.pos.data.InventoryMovementCreateRequestDto
import java.text.SimpleDateFormat
import java.util.*

/**
 * Stock movement create screen (P4-03).
 *
 * Form to create new stock movement:
 * - Type (stok_in, stok_out)
 * - Product selection
 * - Quantity
 * - Date
 * - Notes
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StockMovementCreateScreen(
    onNavigateBack: () -> Unit,
    onSuccess: () -> Unit,
    viewModel: InventoryViewModel = hiltViewModel(),
) {
    var selectedTipe by remember { mutableStateOf("stok_in") }
    var productId by remember { mutableStateOf("") }
    var qty by remember { mutableStateOf("") }
    var keterangan by remember { mutableStateOf("") }
    var unitCost by remember { mutableStateOf("") }

    val today = remember {
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    }

    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tambah Pergerakan Stok") },
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
            // Type selection
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    Text(
                        text = "Tipe Pergerakan",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        FilterChip(
                            selected = selectedTipe == "stok_in",
                            onClick = { selectedTipe = "stok_in" },
                            label = { Text("Stok Masuk") },
                            modifier = Modifier.weight(1f),
                        )
                        FilterChip(
                            selected = selectedTipe == "stok_out",
                            onClick = { selectedTipe = "stok_out" },
                            label = { Text("Stok Keluar") },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            // Product & quantity
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    Text(
                        text = "Detail Produk",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = productId,
                        onValueChange = { productId = it.filter { c -> c.isDigit() } },
                        label = { Text("ID Produk *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        placeholder = { Text("Contoh: 1") },
                    )
                    Text(
                        text = "Note: Gunakan ID produk dari database",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = qty,
                        onValueChange = { qty = it.filter { c -> c.isDigit() } },
                        label = { Text("Jumlah *") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        placeholder = { Text("0") },
                    )

                    if (selectedTipe == "stok_in") {
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = unitCost,
                            onValueChange = { unitCost = it.filter { c -> c.isDigit() } },
                            label = { Text("Harga Modal per Unit (Rp)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            placeholder = { Text("0") },
                        )
                        Text(
                            text = "Untuk menghitung rata-rata harga modal",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }

            // Notes
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    Text(
                        text = "Keterangan",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = keterangan,
                        onValueChange = { keterangan = it },
                        label = { Text("Keterangan") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        maxLines = 5,
                        placeholder = { Text("Contoh: Pembelian dari supplier X") },
                    )
                }
            }

            // Error message
            uiState.error?.let { error ->
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
                    val request = InventoryMovementCreateRequestDto(
                        productId = productId.toLongOrNull() ?: 0,
                        tipe = selectedTipe,
                        qty = qty.toIntOrNull() ?: 0,
                        tanggal = today,
                        keterangan = keterangan.ifBlank { null },
                        unitCost = if (selectedTipe == "stok_in") {
                            unitCost.toLongOrNull()
                        } else null,
                    )

                    viewModel.createMovement(request) {
                        onSuccess()
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isCreating &&
                        productId.isNotBlank() &&
                        qty.isNotBlank() &&
                        (qty.toIntOrNull() ?: 0) > 0,
            ) {
                if (uiState.isCreating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Simpan Pergerakan")
            }

            Text(
                text = "* Wajib diisi",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
