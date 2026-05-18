package id.alviarts.vipos.core.designsystem.theme

import androidx.compose.ui.graphics.Color

/**
 * VIPOS Material 3 color tokens (P3-02).
 *
 * Sourced from the brand teal `#04C99E` (Majoo primary). The
 * tonal partners below were derived by feeding the brand teal
 * through the Material 3 HCT tonal palette generator
 * (https://m3.material.io/theme-builder) and locking the result
 * so the palette stays stable across releases — independent of
 * any Android-version-specific dynamic-color sampling.
 *
 * Two named groups follow:
 *   - `VIPOSLight*` — Material 3 light scheme tokens.
 *   - `VIPOSDark*`  — Material 3 dark scheme tokens.
 *
 * `Theme.kt` composes these into the `lightColorScheme()` /
 * `darkColorScheme()` factories. Anything that wants on-brand
 * surfaces wraps content in [VIPOSTheme]; anything that wants the
 * raw tokens should still go through `MaterialTheme.colorScheme`
 * to stay forward-compatible with dynamic-color opt-in.
 */

// --- Brand seed ----------------------------------------------------
// Kept public-internal so :core:designsystem internals + the
// preview harness can read them directly. Production callers should
// always go through MaterialTheme.colorScheme.
internal val VIPOSBrandTeal = Color(0xFF04C99E)

// --- Light scheme tokens -------------------------------------------

internal val VIPOSLightPrimary = Color(0xFF04C99E)
internal val VIPOSLightOnPrimary = Color(0xFFFFFFFF)
internal val VIPOSLightPrimaryContainer = Color(0xFFB2F5E5)
internal val VIPOSLightOnPrimaryContainer = Color(0xFF002019)

internal val VIPOSLightSecondary = Color(0xFF4B635B)
internal val VIPOSLightOnSecondary = Color(0xFFFFFFFF)
internal val VIPOSLightSecondaryContainer = Color(0xFFCDE9DE)
internal val VIPOSLightOnSecondaryContainer = Color(0xFF072019)

internal val VIPOSLightTertiary = Color(0xFF406376)
internal val VIPOSLightOnTertiary = Color(0xFFFFFFFF)
internal val VIPOSLightTertiaryContainer = Color(0xFFC4E7FE)
internal val VIPOSLightOnTertiaryContainer = Color(0xFF001E2C)

internal val VIPOSLightError = Color(0xFFBA1A1A)
internal val VIPOSLightOnError = Color(0xFFFFFFFF)
internal val VIPOSLightErrorContainer = Color(0xFFFFDAD6)
internal val VIPOSLightOnErrorContainer = Color(0xFF410002)

internal val VIPOSLightBackground = Color(0xFFFAFDFA)
internal val VIPOSLightOnBackground = Color(0xFF191C1B)
internal val VIPOSLightSurface = Color(0xFFFAFDFA)
internal val VIPOSLightOnSurface = Color(0xFF191C1B)
internal val VIPOSLightSurfaceVariant = Color(0xFFDBE5DF)
internal val VIPOSLightOnSurfaceVariant = Color(0xFF3F4945)
internal val VIPOSLightOutline = Color(0xFF6F7975)
internal val VIPOSLightOutlineVariant = Color(0xFFBFC9C3)
internal val VIPOSLightInverseSurface = Color(0xFF2D3130)
internal val VIPOSLightInverseOnSurface = Color(0xFFEFF1EE)
internal val VIPOSLightInversePrimary = Color(0xFF60DCB6)
internal val VIPOSLightSurfaceTint = VIPOSLightPrimary
internal val VIPOSLightScrim = Color(0xFF000000)

// --- Dark scheme tokens --------------------------------------------

internal val VIPOSDarkPrimary = Color(0xFF60DCB6)
internal val VIPOSDarkOnPrimary = Color(0xFF003828)
internal val VIPOSDarkPrimaryContainer = Color(0xFF00513B)
internal val VIPOSDarkOnPrimaryContainer = Color(0xFFB2F5E5)

internal val VIPOSDarkSecondary = Color(0xFFB1CCC2)
internal val VIPOSDarkOnSecondary = Color(0xFF1D352D)
internal val VIPOSDarkSecondaryContainer = Color(0xFF334C43)
internal val VIPOSDarkOnSecondaryContainer = Color(0xFFCDE9DE)

internal val VIPOSDarkTertiary = Color(0xFFA8CBE2)
internal val VIPOSDarkOnTertiary = Color(0xFF0E3447)
internal val VIPOSDarkTertiaryContainer = Color(0xFF274B5E)
internal val VIPOSDarkOnTertiaryContainer = Color(0xFFC4E7FE)

internal val VIPOSDarkError = Color(0xFFFFB4AB)
internal val VIPOSDarkOnError = Color(0xFF690005)
internal val VIPOSDarkErrorContainer = Color(0xFF93000A)
internal val VIPOSDarkOnErrorContainer = Color(0xFFFFDAD6)

internal val VIPOSDarkBackground = Color(0xFF101413)
internal val VIPOSDarkOnBackground = Color(0xFFE0E3E0)
internal val VIPOSDarkSurface = Color(0xFF101413)
internal val VIPOSDarkOnSurface = Color(0xFFE0E3E0)
internal val VIPOSDarkSurfaceVariant = Color(0xFF3F4945)
internal val VIPOSDarkOnSurfaceVariant = Color(0xFFBFC9C3)
internal val VIPOSDarkOutline = Color(0xFF89938E)
internal val VIPOSDarkOutlineVariant = Color(0xFF3F4945)
internal val VIPOSDarkInverseSurface = Color(0xFFE0E3E0)
internal val VIPOSDarkInverseOnSurface = Color(0xFF2D3130)
internal val VIPOSDarkInversePrimary = VIPOSLightPrimary
internal val VIPOSDarkSurfaceTint = VIPOSDarkPrimary
internal val VIPOSDarkScrim = Color(0xFF000000)
