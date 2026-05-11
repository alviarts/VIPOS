package id.alviarts.vipos.core.designsystem.component

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Empty state component with icon, title, description, and optional action.
 * 
 * Usage:
 * ```
 * EmptyState(
 *     icon = Icons.Default.ShoppingCart,
 *     title = "No items in cart",
 *     description = "Add some products to get started",
 *     actionLabel = "Browse Products",
 *     onActionClick = { /* navigate */ }
 * )
 * ```
 */
@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
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
            modifier = Modifier.size(120.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f),
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        if (actionLabel != null && onActionClick != null) {
            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = onActionClick,
                modifier = Modifier.widthIn(min = 200.dp),
            ) {
                Text(text = actionLabel)
            }
        }
    }
}

/**
 * Empty state for lists.
 */
@Composable
fun EmptyListState(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onActionClick: (() -> Unit)? = null,
) {
    EmptyState(
        icon = Icons.Default.Info,
        title = title,
        description = description,
        modifier = modifier,
        actionLabel = actionLabel,
        onActionClick = onActionClick,
    )
}

/**
 * Empty state for search results.
 */
@Composable
fun EmptySearchState(
    searchQuery: String,
    modifier: Modifier = Modifier,
    onClearSearch: (() -> Unit)? = null,
) {
    EmptyState(
        icon = Icons.Default.Search,
        title = "No results found",
        description = "No results for \"$searchQuery\". Try different keywords.",
        modifier = modifier,
        actionLabel = if (onClearSearch != null) "Clear Search" else null,
        onActionClick = onClearSearch,
    )
}

/**
 * Empty state for cart.
 */
@Composable
fun EmptyCartState(
    modifier: Modifier = Modifier,
    onBrowseProducts: () -> Unit,
) {
    EmptyState(
        icon = Icons.Default.ShoppingCart,
        title = "Cart is empty",
        description = "Add some products to your cart to get started",
        modifier = modifier,
        actionLabel = "Browse Products",
        onActionClick = onBrowseProducts,
    )
}

/**
 * Empty state for no data.
 */
@Composable
fun NoDataState(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
) {
    EmptyState(
        icon = Icons.Default.Info,
        title = title,
        description = description,
        modifier = modifier,
    )
}

/**
 * Empty state for no internet.
 */
@Composable
fun NoInternetState(
    modifier: Modifier = Modifier,
    onRetry: () -> Unit,
) {
    EmptyState(
        icon = Icons.Default.Warning,
        title = "No internet connection",
        description = "Please check your internet connection and try again",
        modifier = modifier,
        actionLabel = "Retry",
        onActionClick = onRetry,
    )
}
