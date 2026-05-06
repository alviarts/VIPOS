package id.alviarts.vipos.core.designsystem.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/**
 * VIPOS Material 3 shape scale (P3-02).
 *
 * Aligns with the Material 3 default shape scale
 * (https://m3.material.io/styles/shape/shape-scale-tokens). All
 * five buckets (extraSmall through extraLarge) are pinned to the
 * canonical corner radii so a future global brand re-shape only
 * needs to update this single object.
 */
internal val VIPOSShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(28.dp),
)
