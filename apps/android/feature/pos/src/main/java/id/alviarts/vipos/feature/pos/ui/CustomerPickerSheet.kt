package id.alviarts.vipos.feature.pos.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import id.alviarts.vipos.feature.pos.data.CustomerDto

/**
 * Bottom sheet for searching and selecting a customer in the
 * POS flow (P3-16).
 *
 * Features:
 *  - Search by name/phone with debounced query
 *  - Quick-add new customer (name + phone)
 *  - Shows point balance + deposit for each customer
 *  - "Pelanggan Umum" option to clear selection (walk-in)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerPickerSheet(
    customers: List<CustomerDto>,
    isSearching: Boolean,
    selectedCustomerId: Long?,
    onSearch: (String) -> Unit,
    onSelect: (CustomerDto?) -> Unit,
    onQuickAdd: (name: String, phone: String?) -> Unit,
    onDismiss: () -> Unit,
    sheetState: SheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
    ) {
        CustomerPickerContent(
            customers = customers,
            isSearching = isSearching,
            selectedCustomerId = selectedCustomerId,
            onSearch = onSearch,
            onSelect = onSelect,
            onQuickAdd = onQuickAdd,
        )
    }
}

@Composable
fun CustomerPickerContent(
    customers: List<CustomerDto>,
    isSearching: Boolean,
    selectedCustomerId: Long?,
    onSearch: (String) -> Unit,
    onSelect: (CustomerDto?) -> Unit,
    onQuickAdd: (name: String, phone: String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var searchQuery by remember { mutableStateOf("") }
    var showQuickAdd by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(bottom = 24.dp),
    ) {
        Text(
            text = "Pilih Pelanggan",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(12.dp))

        // Search field
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { query ->
                searchQuery = query
                onSearch(query)
            },
            label = { Text("Cari nama / nomor HP") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))

        // Walk-in option
        TextButton(
            onClick = { onSelect(null) },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                text = if (selectedCustomerId == null) "✓ Pelanggan Umum (Walk-in)" else "Pelanggan Umum (Walk-in)",
                fontWeight = if (selectedCustomerId == null) FontWeight.Bold else FontWeight.Normal,
            )
        }

        HorizontalDivider()

        if (isSearching) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator()
            }
        } else {
            // Customer list
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 300.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(customers, key = { it.id }) { customer ->
                    val isSelected = customer.id == selectedCustomerId
                    CustomerRow(
                        customer = customer,
                        isSelected = isSelected,
                        onClick = { onSelect(customer) },
                    )
                }
            }

            if (customers.isEmpty() && searchQuery.isNotBlank()) {
                Text(
                    text = "Tidak ditemukan. Tambah pelanggan baru?",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        // Quick add section
        if (showQuickAdd) {
            QuickAddCustomerForm(
                onAdd = { name, phone ->
                    onQuickAdd(name, phone)
                    showQuickAdd = false
                },
                onCancel = { showQuickAdd = false },
            )
        } else {
            OutlinedButton(
                onClick = { showQuickAdd = true },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("+ Tambah Pelanggan Baru")
            }
        }
    }
}

@Composable
private fun CustomerRow(
    customer: CustomerDto,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = (if (isSelected) "✓ " else "") + customer.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                )
                if (customer.phone != null) {
                    Text(
                        text = customer.phone,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                if (customer.points > 0) {
                    Text(
                        text = "${customer.points} poin",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                if (customer.deposit > 0) {
                    Text(
                        text = "Deposit: ${formatIdrLabel(customer.deposit.toLong())}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickAddCustomerForm(
    onAdd: (name: String, phone: String?) -> Unit,
    onCancel: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Tambah Pelanggan Baru",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium,
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nama *") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("Nomor HP (opsional)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = onCancel) {
                    Text("Batal")
                }
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = { onAdd(name, phone.ifBlank { null }) },
                    enabled = name.isNotBlank(),
                ) {
                    Text("Simpan")
                }
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 412)
@Composable
private fun CustomerPickerContentPreview() {
    VIPOSTheme {
        CustomerPickerContent(
            customers = listOf(
                CustomerDto(id = 1, name = "Budi Santoso", phone = "081234567890", points = 150, deposit = 50000.0),
                CustomerDto(id = 2, name = "Siti Rahayu", phone = "082345678901", points = 0),
                CustomerDto(id = 3, name = "Ahmad Wijaya", phone = "083456789012", points = 500, deposit = 200000.0),
            ),
            isSearching = false,
            selectedCustomerId = 1,
            onSearch = {},
            onSelect = {},
            onQuickAdd = { _, _ -> },
        )
    }
}
