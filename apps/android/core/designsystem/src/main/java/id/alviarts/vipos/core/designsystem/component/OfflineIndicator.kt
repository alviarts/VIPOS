package id.alviarts.vipos.core.designsystem.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Offline mode indicator banner.
 *
 * Displays a banner at the top of the screen when the device is offline
 * or when there are pending sync operations.
 */
@Composable
fun OfflineBanner(
    isOffline: Boolean,
    hasPendingSync: Boolean = false,
    modifier: Modifier = Modifier,
) {
    AnimatedVisibility(
        visible = isOffline || hasPendingSync,
        enter = slideInVertically(initialOffsetY = { -it }),
        exit = slideOutVertically(targetOffsetY = { -it }),
        modifier = modifier,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    if (isOffline) {
                        MaterialTheme.colorScheme.errorContainer
                    } else {
                        MaterialTheme.colorScheme.tertiaryContainer
                    }
                )
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = if (isOffline) Icons.Default.Warning else Icons.Default.Refresh,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = if (isOffline) {
                    MaterialTheme.colorScheme.onErrorContainer
                } else {
                    MaterialTheme.colorScheme.onTertiaryContainer
                },
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = when {
                    isOffline -> "Mode Offline - Data akan disinkronkan saat online"
                    hasPendingSync -> "Menyinkronkan data..."
                    else -> ""
                },
                style = MaterialTheme.typography.bodySmall,
                color = if (isOffline) {
                    MaterialTheme.colorScheme.onErrorContainer
                } else {
                    MaterialTheme.colorScheme.onTertiaryContainer
                },
            )
        }
    }
}

/**
 * Compact offline indicator dot.
 *
 * Small colored dot that can be placed in the app bar or other locations
 * to indicate offline status.
 */
@Composable
fun OfflineIndicatorDot(
    isOffline: Boolean,
    modifier: Modifier = Modifier,
) {
    if (isOffline) {
        Box(
            modifier = modifier
                .size(8.dp)
                .background(
                    color = MaterialTheme.colorScheme.error,
                    shape = MaterialTheme.shapes.small,
                ),
        )
    }
}

/**
 * Sync status badge.
 *
 * Shows the number of pending items to sync.
 */
@Composable
fun SyncStatusBadge(
    pendingCount: Int,
    modifier: Modifier = Modifier,
) {
    if (pendingCount > 0) {
        Box(
            modifier = modifier
                .background(
                    color = MaterialTheme.colorScheme.tertiary,
                    shape = MaterialTheme.shapes.small,
                )
                .padding(horizontal = 6.dp, vertical = 2.dp),
        ) {
            Text(
                text = if (pendingCount > 99) "99+" else pendingCount.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onTertiary,
            )
        }
    }
}
