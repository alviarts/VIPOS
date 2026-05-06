package id.alviarts.vipos.core.designsystem.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

/**
 * VIPOS Material 3 theme entry point (P3-01c).
 *
 * Replaces the inline `VIPOSPlaceholderTheme` that lived inside
 * `MainActivity` during P3-01a/b/e — anything that wants the
 * branded teal palette now wraps its content in [VIPOSTheme].
 *
 * Only a light scheme is supplied at this stage; P3-02 will add the
 * dark counterpart, dynamic-color opt-in for Android 12+, and the
 * full Material 3 typography scale.
 */
private val LightColors = lightColorScheme(
    primary = VIPOSTeal,
    onPrimary = VIPOSOnTeal,
    primaryContainer = VIPOSTealContainer,
    onPrimaryContainer = VIPOSOnTealContainer,
    secondary = VIPOSTealDark,
    onSecondary = VIPOSOnTeal,
    background = VIPOSBackground,
    onBackground = VIPOSOnBackground,
    surface = VIPOSSurface,
    onSurface = VIPOSOnSurface,
)

@Composable
fun VIPOSTheme(
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = LightColors,
        content = content,
    )
}
