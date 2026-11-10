package com.nothing.glyphstudio.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

object GlyphColors {
    // Nothing Signature Reds & Boost Overdrive
    val NothingRed = Color(0xFFD71920)
    val NeonRed = Color(0xFFFF2E3B)
    val BrightRedGlow = Color(0xFFFF4D5A)
    val DeepRedWine = Color(0xFF38080E)
    val DarkCrimson = Color(0xFF1E0407)
    val BoostPlasma = Color(0xFFFF1A2B)

    // Authentic Nothing Ice-White (As seen in Nothing Phone 3 / 3a photo)
    val LedIceWhite = Color(0xFFE8F6FF)
    val LedIceWhiteGlow = Color(0x80C2EAFF)
    val LedIceWhiteCore = Color(0xFFFFFFFF)

    // AMOLED & Industrial Tech Materials
    val AmoledBlack = Color(0xFF020204)
    val PureBlack = Color(0xFF000000)
    val SurfaceDark = Color(0xFF0A0B0E)
    val SurfaceElevated = Color(0xFF12141A)
    val TitaniumBezel = Color(0xFF22252C)
    val PeriscopePlate = Color(0xFF2D3038)
    val RibbonCable = Color(0xFF181A20)
    val RibbonTrace = Color(0xFF262933)

    // Unified Monochromatic Typography & Precision Badges
    val TextWhite = Color(0xFFF5F6FA)
    val TextMuted = Color(0xFF8E919E)
    val TextDim = Color(0xFF4C4F5C)
    val BorderSubtle = Color(0x1FFFFFFF)
    val GlassBorder = Color(0x40FF2E3B)

    // Unified Badge & Pill Palette (Authentic Nothing Design)
    val BadgeSurface = Color(0x1F20222A)
    val BadgeSurfaceActive = Color(0x38350A10)
    val BadgeBorder = Color(0x2EFFFFFF)
    val BadgeBorderActive = Color(0x80FF2E3B)
    val BadgeText = Color(0xFFE2E4EE)
    val BadgeTextMuted = Color(0xFF9093A2)

    // Photorealistic Liquid Glass Tints & Caustics
    val LiquidGlassSurface = Color(0x28160B0E)
    val LiquidGlassActive = Color(0x483D0D15)
    val LiquidGlassSpecular = Color(0x40FFFFFF)
    val LiquidGlassInnerGlow = Color(0x18FFFFFF)

    // Gradients for Liquid Glass realism
    val GlassSpecularBorder = Brush.linearGradient(
        colors = listOf(
            Color(0x80FFFFFF), // Bright top-left specular reflection
            Color(0x33FF2E3B), // Red caustic refraction
            Color(0x14FFFFFF), // Subtle edge
            Color(0x59FF2E3B)  // Ambient bottom glow
        )
    )

    val GlassSurfaceGradient = Brush.verticalGradient(
        colors = listOf(
            Color(0x332A1016), // Top frosted refraction
            Color(0x1A14080A), // Translucent body
            Color(0x240A0C10)  // Dark foundation
        )
    )

    val GlassSurfaceActiveGradient = Brush.verticalGradient(
        colors = listOf(
            Color(0x5E4A0F1A),
            Color(0x362C0A10),
            Color(0x2B180508)
        )
    )

    val RedLiquidGradient = Brush.verticalGradient(
        colors = listOf(
            Color(0x38FF2E3B),
            Color(0x0FFF2E3B),
            Color(0x03020204)
        )
    )

    val RedBorderGradient = GlassSpecularBorder

    val NeonGlowBrush = Brush.radialGradient(
        colors = listOf(
            Color(0x99FF2E3B),
            Color(0x26FF2E3B),
            Color(0x00000000)
        )
    )
}
