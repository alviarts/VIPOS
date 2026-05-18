package id.alviarts.vipos.core.designsystem.component

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Shimmer loading effect for skeleton screens.
 * 
 * Usage:
 * ```
 * ShimmerBox(
 *     modifier = Modifier
 *         .fillMaxWidth()
 *         .height(100.dp)
 * )
 * ```
 */
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1200,
                easing = FastOutSlowInEasing,
            ),
            repeatMode = RepeatMode.Restart,
        ),
        label = "shimmer_translate",
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - 1000f, translateAnim - 1000f),
        end = Offset(translateAnim, translateAnim),
    )

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(brush),
    )
}

/**
 * Shimmer loading for list items.
 */
@Composable
fun ShimmerListItem(
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Avatar/Icon
        ShimmerBox(
            modifier = Modifier.size(48.dp),
        )

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Title
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.7f)
                    .height(16.dp),
            )

            // Subtitle
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .height(14.dp),
            )
        }

        // Trailing icon/badge
        ShimmerBox(
            modifier = Modifier.size(24.dp),
        )
    }
}

/**
 * Shimmer loading for card items.
 */
@Composable
fun ShimmerCard(
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ShimmerBox(
                modifier = Modifier
                    .weight(1f)
                    .height(20.dp),
            )
            ShimmerBox(
                modifier = Modifier
                    .width(60.dp)
                    .height(20.dp),
            )
        }

        // Content lines
        repeat(3) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(14.dp),
            )
        }

        // Footer
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ShimmerBox(
                modifier = Modifier
                    .weight(1f)
                    .height(36.dp),
            )
            ShimmerBox(
                modifier = Modifier
                    .weight(1f)
                    .height(36.dp),
            )
        }
    }
}

/**
 * Shimmer loading for full screen.
 */
@Composable
fun ShimmerLoadingScreen(
    itemCount: Int = 5,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        repeat(itemCount) {
            ShimmerListItem()
        }
    }
}
