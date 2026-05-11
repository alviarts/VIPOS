package id.alviarts.vipos.core.designsystem.component

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * Loading state component with circular progress indicator and optional message.
 * 
 * Usage:
 * ```
 * LoadingState(
 *     message = "Loading products..."
 * )
 * ```
 */
@Composable
fun LoadingState(
    modifier: Modifier = Modifier,
    message: String? = null,
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            CircularProgressIndicator()

            if (message != null) {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * Loading overlay for showing loading on top of content.
 */
@Composable
fun LoadingOverlay(
    isLoading: Boolean,
    modifier: Modifier = Modifier,
    message: String? = null,
) {
    if (isLoading) {
        Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f),
                modifier = Modifier.fillMaxSize(),
            ) {
                LoadingState(message = message)
            }
        }
    }
}

/**
 * Inline loading indicator for buttons or small areas.
 */
@Composable
fun InlineLoading(
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 16.dp,
) {
    CircularProgressIndicator(
        modifier = modifier.size(size),
        strokeWidth = 2.dp,
    )
}

/**
 * Loading button content.
 */
@Composable
fun LoadingButtonContent(
    isLoading: Boolean,
    text: String,
    modifier: Modifier = Modifier,
) {
    if (isLoading) {
        InlineLoading()
    } else {
        Text(text = text, modifier = modifier)
    }
}
