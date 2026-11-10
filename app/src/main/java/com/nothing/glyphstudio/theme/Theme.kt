package com.nothing.glyphstudio.theme

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = GlyphColors.NeonRed,
    onPrimary = GlyphColors.TextWhite,
    primaryContainer = GlyphColors.DeepRedWine,
    onPrimaryContainer = GlyphColors.BrightRedGlow,
    secondary = GlyphColors.NothingRed,
    onSecondary = GlyphColors.TextWhite,
    background = GlyphColors.AmoledBlack,
    onBackground = GlyphColors.TextWhite,
    surface = GlyphColors.SurfaceDark,
    onSurface = GlyphColors.TextWhite,
    surfaceVariant = GlyphColors.SurfaceElevated,
    onSurfaceVariant = GlyphColors.TextMuted,
    outline = GlyphColors.GlassBorder
)

@Composable
fun GlyphStudioTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = GlyphColors.AmoledBlack.toArgb()
            window.navigationBarColor = GlyphColors.AmoledBlack.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

/**
 * Ultra-realistic Liquid Glass modifier with authentic glassmorphism:
 * - Top specular highlight (reflecting white light on the upper bevel)
 * - Translucent tinted glass body with inner depth
 * - Subtle red refraction border
 * - Diffuse colored glass drop-shadow
 */
fun Modifier.liquidGlass(
    shape: Shape = RoundedCornerShape(22.dp),
    elevation: Dp = 10.dp,
    borderWidth: Dp = 1.2.dp,
    isActive: Boolean = false
): Modifier {
    val glassBorderBrush = if (isActive) {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xCCFFFFFF),
                Color(0xFFFF2E3B),
                Color(0x99FF2E3B)
            )
        )
    } else {
        Brush.verticalGradient(
            colors = listOf(
                Color(0x4DFFFFFF),  // Specular top reflection
                Color(0x1AFFFFFF),
                Color(0x26FF2E3B),  // Red ambient refraction
                Color(0x40FF2E3B)
            )
        )
    }

    val glassBackground = if (isActive) {
        Brush.verticalGradient(
            colors = listOf(
                Color(0x663D0A12),
                Color(0x3325060B),
                Color(0x1F11080A)
            )
        )
    } else {
        Brush.verticalGradient(
            colors = listOf(
                Color(0x2E241216),
                Color(0x1C140A0D),
                Color(0x140B0B0E)
            )
        )
    }

    return this
        .shadow(
            elevation = elevation,
            shape = shape,
            spotColor = if (isActive) GlyphColors.NeonRed else Color(0x40FF2E3B),
            ambientColor = Color(0x80000000)
        )
        .clip(shape)
        .background(glassBackground)
        .border(
            width = borderWidth,
            brush = glassBorderBrush,
            shape = shape
        )
}
