package id.alviarts.vipos.core.designsystem.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/**
 * VIPOS Material 3 theme entry point (P3-01c → P3-02).
 *
 * Anything that wants the branded teal palette wraps its content in
 * [VIPOSTheme]. P3-02 expanded the previous light-only stub into the
 * full Material 3 trio:
 *
 *   - [LightColors] / [DarkColors] — fixed brand-first ColorSchemes
 *     derived from the brand teal (`#04C99E`) via the Material 3 HCT
 *     tonal palette generator. Use these by default — they are the
 *     "VIPOS look" regardless of OS theme.
 *
 *   - Dynamic colour (Material You, Android 12+) — opt-in via
 *     `dynamicColor = true`. When enabled on a supported device, the
 *     OS-derived [dynamicLightColorScheme] / [dynamicDarkColorScheme]
 *     wins over the brand tokens. Useful for showcase / theming
 *     screens; avoid on canonical brand surfaces.
 *
 * Typography + shapes are also wired here. The [VIPOSTypography] type
 * scale and [VIPOSShapes] shape scale are 1:1 mirrors of the M3
 * defaults; replacing the underlying `FontFamily` (currently
 * `FontFamily.Default`, which resolves to Roboto) is the only change
 * needed to swap in a custom font in a future PR.
 */
private val LightColors = lightColorScheme(
    primary = VIPOSLightPrimary,
    onPrimary = VIPOSLightOnPrimary,
    primaryContainer = VIPOSLightPrimaryContainer,
    onPrimaryContainer = VIPOSLightOnPrimaryContainer,
    secondary = VIPOSLightSecondary,
    onSecondary = VIPOSLightOnSecondary,
    secondaryContainer = VIPOSLightSecondaryContainer,
    onSecondaryContainer = VIPOSLightOnSecondaryContainer,
    tertiary = VIPOSLightTertiary,
    onTertiary = VIPOSLightOnTertiary,
    tertiaryContainer = VIPOSLightTertiaryContainer,
    onTertiaryContainer = VIPOSLightOnTertiaryContainer,
    error = VIPOSLightError,
    onError = VIPOSLightOnError,
    errorContainer = VIPOSLightErrorContainer,
    onErrorContainer = VIPOSLightOnErrorContainer,
    background = VIPOSLightBackground,
    onBackground = VIPOSLightOnBackground,
    surface = VIPOSLightSurface,
    onSurface = VIPOSLightOnSurface,
    surfaceVariant = VIPOSLightSurfaceVariant,
    onSurfaceVariant = VIPOSLightOnSurfaceVariant,
    outline = VIPOSLightOutline,
    outlineVariant = VIPOSLightOutlineVariant,
    inverseSurface = VIPOSLightInverseSurface,
    inverseOnSurface = VIPOSLightInverseOnSurface,
    inversePrimary = VIPOSLightInversePrimary,
    surfaceTint = VIPOSLightSurfaceTint,
    scrim = VIPOSLightScrim,
)

private val DarkColors = darkColorScheme(
    primary = VIPOSDarkPrimary,
    onPrimary = VIPOSDarkOnPrimary,
    primaryContainer = VIPOSDarkPrimaryContainer,
    onPrimaryContainer = VIPOSDarkOnPrimaryContainer,
    secondary = VIPOSDarkSecondary,
    onSecondary = VIPOSDarkOnSecondary,
    secondaryContainer = VIPOSDarkSecondaryContainer,
    onSecondaryContainer = VIPOSDarkOnSecondaryContainer,
    tertiary = VIPOSDarkTertiary,
    onTertiary = VIPOSDarkOnTertiary,
    tertiaryContainer = VIPOSDarkTertiaryContainer,
    onTertiaryContainer = VIPOSDarkOnTertiaryContainer,
    error = VIPOSDarkError,
    onError = VIPOSDarkOnError,
    errorContainer = VIPOSDarkErrorContainer,
    onErrorContainer = VIPOSDarkOnErrorContainer,
    background = VIPOSDarkBackground,
    onBackground = VIPOSDarkOnBackground,
    surface = VIPOSDarkSurface,
    onSurface = VIPOSDarkOnSurface,
    surfaceVariant = VIPOSDarkSurfaceVariant,
    onSurfaceVariant = VIPOSDarkOnSurfaceVariant,
    outline = VIPOSDarkOutline,
    outlineVariant = VIPOSDarkOutlineVariant,
    inverseSurface = VIPOSDarkInverseSurface,
    inverseOnSurface = VIPOSDarkInverseOnSurface,
    inversePrimary = VIPOSDarkInversePrimary,
    surfaceTint = VIPOSDarkSurfaceTint,
    scrim = VIPOSDarkScrim,
)

@Composable
fun VIPOSTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    /**
     * When `true` AND running on Android 12+, the OS-derived dynamic
     * Material You palette wins over the brand tokens. Default `false`
     * because canonical VIPOS surfaces should remain on-brand.
     */
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }
    MaterialTheme(
        colorScheme = colorScheme,
        typography = VIPOSTypography,
        shapes = VIPOSShapes,
        content = content,
    )
}
