package com.nothing.glyphstudio.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * Authentic Minimalist Black-and-White & Liquid Glass Design System for Nothing OS.
 * Features AMOLED pure black, ice-white 6500K LED bloom, frosted glass caustics,
 * specular edge reflections, and the iconic Nothing Red accent.
 */
object GlyphColors {
    // Pure AMOLED & Industrial Foundation
    val AmoledBlack = Color(0xFF000000)
    val PureBlack = Color(0xFF000000)
    val SurfaceDark = Color(0xFF07080B)
    val SurfaceElevated = Color(0xFF0E1017)
    val SurfaceCard = Color(0x9910131E)
    val TitaniumBezel = Color(0xFF1E212B)
    val PeriscopePlate = Color(0xFF262935)
    val RibbonCable = Color(0xFF12141C)
    val RibbonTrace = Color(0xFF1F222E)

    // Authentic Nothing Ice-White Glyphs (Physical 6500K White LEDs)
    val GlyphWhite = Color(0xFFFFFFFF)
    val LedIceWhite = Color(0xFFFFFFFF)
    val LedIceWhiteCore = Color(0xFFFFFFFF)
    val LedIceWhiteGlow = Color(0x99D5EEFF)
    val LedIceWhiteBloom = Color(0x38B5E0FF)
    val GlyphTrackOff = Color(0xFF1A1C24)
    val GlyphTrackOffBorder = Color(0x2EFFFFFF)

    // Iconic Nothing Red Accent (Used sparingly as a hallmark dot / tag)
    val NothingRed = Color(0xFFD71920)
    val NeonRed = Color(0xFFFF2E3B)
    val BrightRedGlow = Color(0xFFFF4D5A)
    val SubtleRedDot = Color(0xFFE52028)
    val DeepRedWine = Color(0xFF24060A)
    val DarkCrimson = Color(0xFF140306)
    val BoostPlasma = Color(0xFFFF2E3B)

    // Monochromatic Typography
    val TextWhite = Color(0xFFFFFFFF)
    val TextMuted = Color(0xFF8E919E)
    val TextDim = Color(0xFF4C4F5C)
    val BorderSubtle = Color(0x1FFFFFFF)

    // Authentic Liquid Glass (iOS 18 / Nothing OS Translucent Glassmorphism)
    val GlassSurface = Color(0x8010131D)
    val GlassSurfaceActive = Color(0xB3181C2A)
    val GlassBorder = Color(0x2EFFFFFF)
    val GlassBorderActive = Color(0xB3FFFFFF)
    val GlassSpecularTop = Color(0x80FFFFFF)
    val GlassSpecularLeft = Color(0x40FFFFFF)
    val GlassSpecularBottom = Color(0x14FFFFFF)
    val GlassSpecularRight = Color(0x1FFFFFFF)

    // Unified Badge & Pill Palette
    val BadgeSurface = Color(0x29141722)
    val BadgeSurfaceActive = Color(0x4D202638)
    val BadgeBorder = Color(0x33FFFFFF)
    val BadgeBorderActive = Color(0x99FFFFFF)
    val BadgeText = Color(0xFFFFFFFF)
    val BadgeTextMuted = Color(0xFF8E919E)

    // High-Precision Liquid Glass Gradients
    val GlassSpecularBorder = Brush.verticalGradient(
        colors = listOf(
            Color(0x73FFFFFF), // Specular rim reflection
            Color(0x26FFFFFF), // Mid glass refraction
            Color(0x0FFFFFFF)  // Subtle bottom edge
        )
    )

    val GlassSpecularActiveBorder = Brush.verticalGradient(
        colors = listOf(
            Color(0xFFFFFFFF),
            Color(0x99FFFFFF),
            Color(0x40FFFFFF)
        )
    )

    val GlassSurfaceGradient = Brush.verticalGradient(
        colors = listOf(
            Color(0x8C161926), // Top frosted refraction
            Color(0x660F111B), // Translucent dark body
            Color(0x80080A10)  // Deep black foundation
        )
    )

    val GlassSurfaceActiveGradient = Brush.verticalGradient(
        colors = listOf(
            Color(0xB322273A),
            Color(0x8C181C2B),
            Color(0x990E111A)
        )
    )

    val GlassCardRimBrush = Brush.horizontalGradient(
        colors = listOf(
            Color(0x00FFFFFF),
            Color(0x66FFFFFF),
            Color(0x00FFFFFF)
        )
    )

    val WhiteLedGlowBrush = Brush.radialGradient(
        colors = listOf(
            Color(0xFFFFFFFF),
            Color(0x80D5EEFF),
            Color(0x00000000)
        )
    )
}

