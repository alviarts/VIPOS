package id.alviarts.vipos.core.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Empty state component for lists with no data.
 * 
 * Features:
 * - Icon
 * - Title and description
 * - Optional action button
 * - Centered layout
 */
@Composable
fun EmptyState(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Default.Inbox,
    actionText: String? = null,
    onActionClick: (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
        )
        
        Spacer(Modifier.height(16.dp))
        
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )
        
        Spacer(Modifier.height(8.dp))
        
        Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        
        if (actionText != null && onActionClick != null) {
            Spacer(Modifier.height(16.dp))
            
            TextButton(onClick = onActionClick) {
                Text(actionText)
            }
        }
    }
}

/**
 * Empty search results state.
 * Pre-configured for search with no results.
 */
@Composable
fun EmptySearchState(
    query: String,
    modifier: Modifier = Modifier,
    onClearSearch: (() -> Unit)? = null,
) {
    EmptyState(
        title = "Tidak ada hasil",
        description = "Tidak ditemukan hasil untuk \"$query\".\nCoba kata kunci lain.",
        icon = MenuIcons.Search,
        actionText = if (onClearSearch != null) "Hapus Pencarian" else null,
        onActionClick = onClearSearch,
        modifier = modifier,
    )
}
