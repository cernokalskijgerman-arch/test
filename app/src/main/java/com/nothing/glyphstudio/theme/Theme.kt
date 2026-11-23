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
    primary = GlyphColors.TextWhite,
    onPrimary = GlyphColors.PureBlack,
    primaryContainer = GlyphColors.SurfaceElevated,
    onPrimaryContainer = GlyphColors.TextWhite,
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
 * Authentic Liquid Glass modifier matching Nothing OS & modern iOS glassmorphism:
 * - Top specular rim highlight (reflecting pure light on the upper bevel)
 * - Translucent frosted dark glass body
 * - Specular border gradient
 * - Ambient dark drop shadow
 */
fun Modifier.liquidGlass(
    shape: Shape = RoundedCornerShape(20.dp),
    elevation: Dp = 6.dp,
    borderWidth: Dp = 1.dp,
    isActive: Boolean = false,
    isBoosted: Boolean = false
): Modifier {
    val glassBorderBrush = if (isActive) {
        GlyphColors.GlassSpecularActiveBorder
    } else {
        GlyphColors.GlassSpecularBorder
    }

    val glassBackground = if (isActive) {
        GlyphColors.GlassSurfaceActiveGradient
    } else {
        GlyphColors.GlassSurfaceGradient
    }

    return this
        .shadow(
            elevation = elevation,
            shape = shape,
            spotColor = if (isActive) Color(0x66FFFFFF) else Color(0x33000000),
            ambientColor = Color(0x66000000)
        )
        .clip(shape)
        .background(glassBackground)
        .border(
            width = borderWidth,
            brush = glassBorderBrush,
            shape = shape
        )
}

