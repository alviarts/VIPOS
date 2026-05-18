package id.alviarts.vipos.feature.pos.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import id.alviarts.vipos.core.database.entity.OutboxEntry
import id.alviarts.vipos.core.designsystem.theme.VIPOSTheme
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * "Sinkronisasi Gagal" screen (P3-09 DLQ).
 *
 * Shows all permanently failed outbox entries with their error
 * messages. The kasir can retry individual entries or discard
 * them (with a warning that discarding means data loss).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncIssuesScreen(
    state: SyncIssuesUiState,
    onBack: () -> Unit,
    onRetry: (Long) -> Unit,
    onDiscard: (Long) -> Unit,
    onRetryAll: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Sinkronisasi Gagal") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        @Suppress("DEPRECATION")
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    if (state.entries.isNotEmpty()) {
                        TextButton(onClick = onRetryAll) {
                            Text("Coba Ulang Semua")
                        }
                    }
                },
            )
        },
    ) { padding ->
        when {
            state.isLoading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator()
                }
            }
            state.isEmpty -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "Tidak ada masalah sinkronisasi",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "Semua data sudah tersinkronisasi.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                ) {
                    items(state.entries, key = { it.id }) { entry ->
                        FailedEntryCard(
                            entry = entry,
                            onRetry = { onRetry(entry.id) },
                            onDiscard = { onDiscard(entry.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FailedEntryCard(
    entry: OutboxEntry,
    onRetry: () -> Unit,
    onDiscard: () -> Unit,
) {
    val dateFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("id"))
    val createdDate = dateFormat.format(Date(entry.createdAt))

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "${entry.method} ${entry.path}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = createdDate,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(4.dp))
            if (entry.lastError != null) {
                Text(
                    text = "Error: ${entry.lastError}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
            }
            Text(
                text = "Percobaan: ${entry.retryCount}/${OutboxEntry.MAX_RETRIES}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                OutlinedButton(onClick = onDiscard) {
                    Text("Buang")
                }
                Spacer(Modifier.width(8.dp))
                Button(onClick = onRetry) {
                    Text("Coba Ulang")
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun SyncIssuesScreenEmptyPreview() {
    VIPOSTheme {
        SyncIssuesScreen(
            state = SyncIssuesUiState(entries = emptyList()),
            onBack = {},
            onRetry = {},
            onDiscard = {},
            onRetryAll = {},
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun SyncIssuesScreenWithEntriesPreview() {
    VIPOSTheme {
        SyncIssuesScreen(
            state = SyncIssuesUiState(
                entries = listOf(
                    OutboxEntry(
                        id = 1,
                        method = "POST",
                        path = "api/v1/transactions",
                        body = "{}",
                        idempotencyKey = "abc-123",
                        status = OutboxEntry.STATUS_FAILED,
                        retryCount = 5,
                        lastError = "Connection refused",
                        createdAt = System.currentTimeMillis() - 3600_000,
                    ),
                    OutboxEntry(
                        id = 2,
                        method = "POST",
                        path = "api/v1/transactions",
                        body = "{}",
                        idempotencyKey = "def-456",
                        status = OutboxEntry.STATUS_FAILED,
                        retryCount = 5,
                        lastError = "500 Internal Server Error",
                        createdAt = System.currentTimeMillis() - 7200_000,
                    ),
                ),
            ),
            onBack = {},
            onRetry = {},
            onDiscard = {},
            onRetryAll = {},
        )
    }
}
