package id.alviarts.vipos.feature.pos.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme

/**
 * POS settings screen (P3-20).
 *
 * Provides access to:
 *  - Hardware config (printer, scanner, EDC)
 *  - Outlet switcher (for multi-outlet cashiers)
 *  - Sync status (pending outbox, last sync time)
 *  - Debug: reset local DB
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PosSettingsScreen(
    isOnline: Boolean,
    pendingSyncCount: Int,
    failedSyncCount: Int,
    onBack: () -> Unit,
    onSyncIssues: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Pengaturan Kasir") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        @Suppress("DEPRECATION")
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Sync status section
            item {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Sinkronisasi",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(4.dp))
            }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SettingsRow(
                            label = "Status jaringan",
                            value = if (isOnline) "Online" else "Offline",
                        )
                        SettingsRow(
                            label = "Antrian sinkronisasi",
                            value = if (pendingSyncCount > 0) "$pendingSyncCount menunggu" else "Semua tersinkronisasi",
                        )
                        if (failedSyncCount > 0) {
                            SettingsRow(
                                label = "Gagal sinkronisasi",
                                value = "$failedSyncCount masalah",
                            )
                            Spacer(Modifier.height(8.dp))
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(onClick = onSyncIssues),
                            ) {
                                Text(
                                    text = "Lihat masalah sinkronisasi →",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.padding(12.dp),
                                )
                            }
                        }
                    }
                }
            }

            // Hardware section
            item {
                Text(
                    text = "Perangkat Keras",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(4.dp))
            }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SettingsRow(
                            label = "Printer thermal",
                            value = "Belum terhubung",
                        )
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        SettingsRow(
                            label = "Barcode scanner",
                            value = "Belum terhubung",
                        )
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        SettingsRow(
                            label = "EDC",
                            value = "Belum terhubung",
                        )
                    }
                }
            }

            // Outlet section
            item {
                Text(
                    text = "Outlet",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(4.dp))
            }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SettingsRow(
                            label = "Outlet aktif",
                            value = "Outlet Utama",
                        )
                        Text(
                            text = "Fitur multi-outlet akan tersedia di versi mendatang.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            // App info
            item {
                Text(
                    text = "Aplikasi",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(4.dp))
            }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SettingsRow(label = "Versi", value = "0.0.1")
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                        SettingsRow(label = "Database lokal", value = "vipos.db v2")
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun SettingsRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun PosSettingsScreenPreview() {
    VIPOSTheme {
        PosSettingsScreen(
            isOnline = true,
            pendingSyncCount = 3,
            failedSyncCount = 1,
            onBack = {},
            onSyncIssues = {},
        )
    }
}
