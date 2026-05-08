package id.alviarts.vipos.feature.pos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.alviarts.vipos.core.designsystem.format.formatIdrLabel
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import id.alviarts.vipos.feature.pos.data.CashierShiftSummaryDto
import id.alviarts.vipos.feature.pos.data.PaymentBreakdownDto
import kotlin.math.abs

/**
 * Screen for closing a cashier shift (P3-14).
 *
 * Shows the shift summary (opening cash, sales breakdown,
 * expected cash) and lets the kasir enter the counted cash.
 * If variance exceeds the threshold, a warning is shown and
 * the kasir must provide a reason.
 */
@Composable
fun CloseShiftScreen(
    summary: CashierShiftSummaryDto?,
    isLoading: Boolean,
    isSubmitting: Boolean,
    onClose: (closingCashCounted: Long, varianceReason: String?) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var countedCashText by remember { mutableStateOf("") }
    var varianceReason by remember { mutableStateOf("") }
    val countedCash = countedCashText.toLongOrNull() ?: 0L

    Scaffold(modifier = modifier) { padding ->
        if (isLoading || summary == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator()
                Spacer(Modifier.height(8.dp))
                Text("Memuat ringkasan shift…")
            }
            return@Scaffold
        }

        val variance = countedCash - summary.expectedCash
        val varianceExceedsThreshold = abs(variance) > summary.varianceWarningThreshold

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
        ) {
            item {
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Tutup Kasir",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(16.dp))
            }

            // Shift summary card
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Ringkasan Shift",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Medium,
                        )
                        Spacer(Modifier.height(12.dp))
                        SummaryRow("Modal kas awal", formatIdrLabel(summary.openingCash))
                        SummaryRow("Penjualan tunai", formatIdrLabel(summary.cashSales))
                        SummaryRow("Kas keluar", formatIdrLabel(-summary.cashDrops))
                        SummaryRow("Kas masuk", formatIdrLabel(summary.cashPickups))
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        SummaryRow(
                            "Kas yang diharapkan",
                            formatIdrLabel(summary.expectedCash),
                            bold = true,
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
            }

            // Payment breakdown
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Rincian Pembayaran",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Medium,
                        )
                        Spacer(Modifier.height(8.dp))
                        SummaryRow("Total transaksi", "${summary.totalTransactions}")
                        SummaryRow("Total pendapatan", formatIdrLabel(summary.totalRevenue))
                    }
                }
                Spacer(Modifier.height(4.dp))
            }

            items(summary.paymentBreakdown) { breakdown ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "${breakdown.method} (${breakdown.count}x)",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        text = formatIdrLabel(breakdown.total),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }

            // Cash count input
            item {
                Spacer(Modifier.height(16.dp))
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Hitung Kas",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Medium,
                        )
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = countedCashText,
                            onValueChange = { raw ->
                                countedCashText = raw.filter { it.isDigit() }
                            },
                            label = { Text("Kas fisik yang dihitung (Rp)") },
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Number,
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )

                        if (countedCashText.isNotEmpty()) {
                            Spacer(Modifier.height(8.dp))
                            val varianceColor = when {
                                variance == 0L -> Color(0xFF2E7D32)
                                varianceExceedsThreshold -> MaterialTheme.colorScheme.error
                                else -> MaterialTheme.colorScheme.onSurfaceVariant
                            }
                            Text(
                                text = "Selisih: ${formatIdrLabel(variance)}",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold,
                                color = varianceColor,
                            )

                            if (varianceExceedsThreshold) {
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    text = "⚠ Selisih melebihi Rp ${summary.varianceWarningThreshold / 1000}rb. Harap berikan alasan.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.error,
                                )
                                Spacer(Modifier.height(8.dp))
                                OutlinedTextField(
                                    value = varianceReason,
                                    onValueChange = { varianceReason = it },
                                    label = { Text("Alasan selisih") },
                                    singleLine = false,
                                    maxLines = 3,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // Action buttons
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedButton(
                        onClick = onCancel,
                        modifier = Modifier.weight(1f),
                        enabled = !isSubmitting,
                    ) {
                        Text("Batal")
                    }
                    Button(
                        onClick = {
                            onClose(
                                countedCash,
                                if (varianceExceedsThreshold) varianceReason.ifBlank { null } else null,
                            )
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !isSubmitting && countedCashText.isNotEmpty() &&
                            (!varianceExceedsThreshold || varianceReason.isNotBlank()),
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.height(20.dp),
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Text("Tutup Kasir")
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun SummaryRow(
    label: String,
    value: String,
    bold: Boolean = false,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun CloseShiftScreenPreview() {
    VIPOSTheme {
        CloseShiftScreen(
            summary = CashierShiftSummaryDto(
                shiftId = 1,
                userId = 1,
                status = "open",
                openedAt = "2026-05-08T08:00:00Z",
                openingCash = 500_000,
                cashSales = 1_200_000,
                cashDrops = 100_000,
                cashPickups = 50_000,
                expectedCash = 1_650_000,
                totalRevenue = 2_500_000,
                totalTransactions = 45,
                paymentBreakdown = listOf(
                    PaymentBreakdownDto("CASH", 30, 1_200_000),
                    PaymentBreakdownDto("QRIS_DYNAMIC", 10, 800_000),
                    PaymentBreakdownDto("EDC", 5, 500_000),
                ),
                varianceWarningThreshold = 10_000,
            ),
            isLoading = false,
            isSubmitting = false,
            onClose = { _, _ -> },
            onCancel = {},
        )
    }
}
