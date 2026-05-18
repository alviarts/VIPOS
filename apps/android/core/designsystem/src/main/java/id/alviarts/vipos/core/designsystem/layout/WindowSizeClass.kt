package id.alviarts.vipos.core.designsystem.layout

import android.app.Activity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

/**
 * Simplified window size classification (P3-02 / P3-17).
 *
 * Based on Material 3 breakpoints:
 *  - [Compact]  — width < 600dp (phones in portrait)
 *  - [Medium]   — 600dp ≤ width < 840dp (tablets in portrait,
 *    foldables unfolded, phones in landscape)
 *  - [Expanded] — width ≥ 840dp (tablets in landscape)
 *
 * Usage:
 * ```
 * val windowSize = rememberWindowSizeClass()
 * when (windowSize) {
 *     WindowSizeClass.Compact -> PhoneLayout()
 *     WindowSizeClass.Medium -> TabletPortraitLayout()
 *     WindowSizeClass.Expanded -> TabletLandscapeLayout()
 * }
 * ```
 */
enum class WindowSizeClass {
    Compact,
    Medium,
    Expanded,
}

/**
 * Remember the current [WindowSizeClass] based on the screen
 * width. Recomposes on configuration change (orientation,
 * multi-window resize).
 */
@Composable
fun rememberWindowSizeClass(): WindowSizeClass {
    val configuration = LocalConfiguration.current
    val widthDp = configuration.screenWidthDp.dp

    return remember(widthDp) {
        when {
            widthDp < 600.dp -> WindowSizeClass.Compact
            widthDp < 840.dp -> WindowSizeClass.Medium
            else -> WindowSizeClass.Expanded
        }
    }
}
