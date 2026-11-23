package com.nothing.glyphstudio.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.glyph.NothingDevice
import com.nothing.glyphstudio.glyph.Phone3aProLayout
import com.nothing.glyphstudio.theme.GlyphColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun GlyphSimulatorView(
    modifier: Modifier = Modifier,
    isBoosted: Boolean = false,
    onSegmentClick: ((Int) -> Unit)? = null
) {
    val activeDevice by GlyphController.activeDevice.collectAsState()
    val currentFrame by GlyphController.currentFrame.collectAsState()

    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(0.82f)
            .padding(6.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(activeDevice) {
                    detectTapGestures { offset ->
                        onSegmentClick?.invoke(0)
                    }
                }
        ) {
            val w = size.width
            val h = size.height

            // 1. Phone Body with Industrial Nothing Transparent Back
            drawPhoneBackplate(w, h)

            // 2. Large Circular Camera Module (Original Nothing 3a Pro / 3 Silhouette)
            drawCircularCameraSilhouette(w, h)

            // 3. Draw Glyphs
            when (activeDevice) {
                NothingDevice.PHONE_3A_PRO -> {
                    drawPhone3aProGlyphs(w, h, currentFrame.segmentBrightness)
                }
                NothingDevice.PHONE_2A -> {
                    drawPhone2aGlyphs(w, h, currentFrame.segmentBrightness)
                }
                NothingDevice.PHONE_2 -> {
                    drawPhone2Glyphs(w, h, currentFrame.segmentBrightness)
                }
                NothingDevice.PHONE_1 -> {
                    drawPhone1Glyphs(w, h, currentFrame.segmentBrightness)
                }
            }
        }
    }
}

private fun DrawScope.drawPhoneBackplate(w: Float, h: Float) {
    val corner = 34.dp.toPx()

    // Frosted Minimalist AMOLED Back Plate
    drawRoundRect(
        color = Color(0xF406070A),
        size = Size(w, h),
        cornerRadius = CornerRadius(corner, corner)
    )

    // Specular Glass Border
    drawRoundRect(
        brush = Brush.verticalGradient(
            colors = listOf(
                Color(0x4DFFFFFF),
                Color(0x1AFFFFFF),
                Color(0x0AFFFFFF),
                Color(0x26FFFFFF)
            )
        ),
        size = Size(w, h),
        cornerRadius = CornerRadius(corner, corner),
        style = Stroke(width = 1.4.dp.toPx())
    )
}

/**
 * Minimalist Camera Module Silhouette strictly matching the user's vector outline.
 */
private fun DrawScope.drawCircularCameraSilhouette(w: Float, h: Float) {
    val cx = w * 0.5f
    val cy = h * 0.35f
    val r = w * 0.30f

    // 1. Dark Camera Interior Base
    drawCircle(
        color = Color(0xFF040406),
        radius = r,
        center = Offset(cx, cy)
    )

    // Main Outer Circle Outline
    drawCircle(
        color = Color(0xFF33333C),
        radius = r,
        center = Offset(cx, cy),
        style = Stroke(width = 1.8.dp.toPx())
    )

    val strokeCol = Color(0xFF33333C)
    val strokeWidth = 1.6.dp.toPx()

    // 2. Top Organic Contour Island (holding 2 lenses, loops deg 224° to deg 274°)
    val aStart = 224f * (PI / 180f).toFloat()
    val aEnd = 274f * (PI / 180f).toFloat()
    val xStart = cx + r * cos(aStart)
    val yStart = cy + r * sin(aStart)
    val xEnd = cx + r * cos(aEnd)
    val yEnd = cy + r * sin(aEnd)

    val islandPath = Path().apply {
        moveTo(xStart, yStart)
        cubicTo(
            cx - r * 0.70f, cy - r * 0.40f,
            cx - r * 0.50f, cy - r * 0.22f,
            cx - r * 0.38f, cy - r * 0.22f
        )
        cubicTo(
            cx - r * 0.24f, cy - r * 0.22f,
            cx - r * 0.22f, cy - r * 0.45f,
            cx - r * 0.12f, cy - r * 0.45f
        )
        cubicTo(
            cx - r * 0.04f, cy - r * 0.45f,
            cx + r * 0.08f, cy - r * 0.52f,
            cx + r * 0.08f, cy - r * 0.70f
        )
        cubicTo(
            cx + r * 0.08f, cy - r * 0.88f,
            cx + r * 0.06f, yEnd,
            xEnd, yEnd
        )
    }
    drawPath(islandPath, color = strokeCol, style = Stroke(width = strokeWidth))

    // Lens 1 (Top-Left of Island): Single clean circle
    val l1Center = Offset(cx - r * 0.50f, cy - r * 0.61f)
    val l1R = r * 0.16f
    drawCircle(color = strokeCol, radius = l1R, center = l1Center, style = Stroke(width = strokeWidth))

    // Lens 2 (Top-Right of Island): Concentric double circle
    val l2Center = Offset(cx - r * 0.05f, cy - r * 0.77f)
    val l2ROuter = r * 0.16f
    val l2RInner = r * 0.08f
    drawCircle(color = strokeCol, radius = l2ROuter, center = l2Center, style = Stroke(width = strokeWidth))
    drawCircle(color = strokeCol, radius = l2RInner, center = l2Center, style = Stroke(width = strokeWidth))

    // 3. Standalone Middle-Left Camera Lens (clean circle cleanly framed between TL and BL arcs)
    val l3Center = Offset(cx - r * 0.515f, cy)
    val l3R = r * 0.19f
    drawCircle(color = strokeCol, radius = l3R, center = l3Center, style = Stroke(width = strokeWidth))

    // 4. Middle-Right Periscope Horizontal Rounded Block
    val periLeft = cx - r * 0.19f
    val periTop = cy - r * 0.36f
    val periWidth = r * 1.19f
    val periHeight = r * 0.72f
    val periCorner = r * 0.14f

    val periPath = Path().apply {
        moveTo(periLeft + periCorner, periTop)
        lineTo(periLeft + periWidth, periTop)
        lineTo(periLeft + periWidth, periTop + periHeight)
        lineTo(periLeft + periCorner, periTop + periHeight)
        quadraticTo(periLeft, periTop + periHeight, periLeft, periTop + periHeight - periCorner)
        lineTo(periLeft, periTop + periCorner)
        quadraticTo(periLeft, periTop, periLeft + periCorner, periTop)
        close()
    }
    drawPath(periPath, color = strokeCol, style = Stroke(width = strokeWidth))

    // Inside Periscope: vertical stadium pill lens
    val pLensX = cx + r * 0.12f
    val pLensY = cy
    val pLensW = r * 0.38f
    val pLensH = r * 0.54f
    val pLensCorner = r * 0.19f

    drawRoundRect(
        color = strokeCol,
        topLeft = Offset(pLensX - pLensW / 2, pLensY - pLensH / 2),
        size = Size(pLensW, pLensH),
        cornerRadius = CornerRadius(pLensCorner, pLensCorner),
        style = Stroke(width = strokeWidth)
    )
}

/**
 * Draws the 3 distinct Glyph arcs broken down into individual discrete LED lights,
 * strictly matching the uploaded photo.
 */
private fun DrawScope.drawPhone3aProGlyphs(w: Float, h: Float, brightness: IntArray) {
    val cx = w * 0.5f
    val cy = h * 0.35f
    val cameraR = w * 0.30f
    val glyphR = cameraR + 13.dp.toPx()

    val trackCol = Color(0xFF26262E)
    val trackWidth = 7.dp.toPx()

    // Base Curved Tracks (matching the thick grey lines in the user's sketch)
    // Arc 1: Top-Left (192° to 244°, sweep 52°, holding 20 micro-LEDs, channels 0..19)
    drawArc(
        color = trackCol,
        startAngle = 192f,
        sweepAngle = 52f,
        useCenter = false,
        topLeft = Offset(cx - glyphR, cy - glyphR),
        size = Size(glyphR * 2, glyphR * 2),
        style = Stroke(width = trackWidth, cap = StrokeCap.Round)
    )

    // Arc 2: Bottom-Left (134° to 155°, sweep 21°, holding 5 micro-LEDs, channels 31..35)
    drawArc(
        color = trackCol,
        startAngle = 134f,
        sweepAngle = 21f,
        useCenter = false,
        topLeft = Offset(cx - glyphR, cy - glyphR),
        size = Size(glyphR * 2, glyphR * 2),
        style = Stroke(width = trackWidth, cap = StrokeCap.Round)
    )

    // Arc 3: Right (-16° to 32°, sweep 48°, holding 11 micro-LEDs, channels 20..30)
    drawArc(
        color = trackCol,
        startAngle = -16f,
        sweepAngle = 48f,
        useCenter = false,
        topLeft = Offset(cx - glyphR, cy - glyphR),
        size = Size(glyphR * 2, glyphR * 2),
        style = Stroke(width = trackWidth, cap = StrokeCap.Round)
    )

    // -------------------------------------------------------------
    // ARC 1: TOP-LEFT ARC (20 micro-LEDs) - channels 0..19 (Дуга 1)
    // Runs along upper-left quadrant from angle 195° to 241°
    // -------------------------------------------------------------
    val arc1Count = Phone3aProLayout.COUNT_TOP_LEFT
    val arc1Start = 195f
    val arc1End = 241f
    val arc1Step = (arc1End - arc1Start) / (arc1Count - 1)

    for (i in 0 until arc1Count) {
        val channelIdx = i // 0..19
        val angleDeg = arc1Start + i * arc1Step
        val rad = angleDeg * (PI / 180.0)
        val ledCenter = Offset(
            (cx + glyphR * cos(rad)).toFloat(),
            (cy + glyphR * sin(rad)).toFloat()
        )
        val b = if (channelIdx < brightness.size) brightness[channelIdx] else 0
        drawDiscreteLedDot(ledCenter, b, radius = 4.0.dp.toPx())
    }

    // -------------------------------------------------------------
    // ARC 2: BOTTOM-LEFT ARC (5 micro-LEDs) - channels 31..35 (Дуга 2)
    // Runs along bottom-left quadrant from angle 136° to 153°
    // -------------------------------------------------------------
    val arc2Count = Phone3aProLayout.COUNT_BOTTOM_LEFT
    val arc2Start = 136f
    val arc2End = 153f
    val arc2Step = (arc2End - arc2Start) / (arc2Count - 1)

    for (i in 0 until arc2Count) {
        val channelIdx = 31 + i // 31..35
        val angleDeg = arc2Start + i * arc2Step
        val rad = angleDeg * (PI / 180.0)
        val ledCenter = Offset(
            (cx + glyphR * cos(rad)).toFloat(),
            (cy + glyphR * sin(rad)).toFloat()
        )
        val b = if (channelIdx < brightness.size) brightness[channelIdx] else 0
        drawDiscreteLedDot(ledCenter, b, radius = 4.2.dp.toPx())
    }

    // -------------------------------------------------------------
    // ARC 3: RIGHT VERTICAL ARC (11 micro-LEDs) - channels 20..30 (Дуга 3)
    // Runs vertically along right side from angle -14° to 30°
    // -------------------------------------------------------------
    val arc3Count = Phone3aProLayout.COUNT_RIGHT
    val arc3Start = -14f
    val arc3End = 30f
    val arc3Step = (arc3End - arc3Start) / (arc3Count - 1)

    for (i in 0 until arc3Count) {
        val channelIdx = 20 + i // 20..30
        val angleDeg = arc3Start + i * arc3Step
        val rad = angleDeg * (PI / 180.0)
        val ledCenter = Offset(
            (cx + glyphR * cos(rad)).toFloat(),
            (cy + glyphR * sin(rad)).toFloat()
        )
        val b = if (channelIdx < brightness.size) brightness[channelIdx] else 0
        drawDiscreteLedDot(ledCenter, b, radius = 4.2.dp.toPx())
    }
}

/**
 * Draws Nothing Phone (2a) Glyphs:
 * - Zone A: Top-Left (1 LED, channel 25)
 * - Zone B: Bottom-Left (1 LED, channel 24)
 * - Zone C: Right Arc (24 LEDs, channels 0..23)
 */
private fun DrawScope.drawPhone2aGlyphs(w: Float, h: Float, brightness: IntArray) {
    val cx = w * 0.5f
    val cy = h * 0.35f
    val cameraR = w * 0.30f
    val glyphR = cameraR + 13.dp.toPx()

    val trackCol = Color(0xFF1E212B)
    val trackWidth = 7.dp.toPx()

    // Base Curved Tracks
    // Top-Left Arc
    drawArc(
        color = trackCol,
        startAngle = 205f,
        sweepAngle = 32f,
        useCenter = false,
        topLeft = Offset(cx - glyphR, cy - glyphR),
        size = Size(glyphR * 2, glyphR * 2),
        style = Stroke(width = trackWidth, cap = StrokeCap.Round)
    )

    // Bottom-Left Arc
    drawArc(
        color = trackCol,
        startAngle = 135f,
        sweepAngle = 22f,
        useCenter = false,
        topLeft = Offset(cx - glyphR, cy - glyphR),
        size = Size(glyphR * 2, glyphR * 2),
        style = Stroke(width = trackWidth, cap = StrokeCap.Round)
    )

    // Right Arc
    drawArc(
        color = trackCol,
        startAngle = -16f,
        sweepAngle = 48f,
        useCenter = false,
        topLeft = Offset(cx - glyphR, cy - glyphR),
        size = Size(glyphR * 2, glyphR * 2),
        style = Stroke(width = trackWidth, cap = StrokeCap.Round)
    )

    // 1. Zone A: Top-Left LED (Channel 25)
    val aAngle = 221f * (PI / 180.0)
    val aCenter = Offset((cx + glyphR * cos(aAngle)).toFloat(), (cy + glyphR * sin(aAngle)).toFloat())
    val bA = if (25 < brightness.size) brightness[25] else 0
    drawDiscreteLedDot(aCenter, bA, radius = 5.0.dp.toPx())

    // 2. Zone B: Bottom-Left LED (Channel 24)
    val bAngle = 146f * (PI / 180.0)
    val bCenter = Offset((cx + glyphR * cos(bAngle)).toFloat(), (cy + glyphR * sin(bAngle)).toFloat())
    val bB = if (24 < brightness.size) brightness[24] else 0
    drawDiscreteLedDot(bCenter, bB, radius = 5.0.dp.toPx())

    // 3. Zone C: Right Arc (24 LEDs, Channels 0..23)
    val arcCount = 24
    val arcStart = -14f
    val arcEnd = 30f
    val arcStep = (arcEnd - arcStart) / (arcCount - 1)
    for (i in 0 until arcCount) {
        val angleDeg = arcStart + i * arcStep
        val rad = angleDeg * (PI / 180.0)
        val ledCenter = Offset((cx + glyphR * cos(rad)).toFloat(), (cy + glyphR * sin(rad)).toFloat())
        val b = if (i < brightness.size) brightness[i] else 0
        drawDiscreteLedDot(ledCenter, b, radius = 3.6.dp.toPx())
    }
}

/**
 * Draws an individual discrete LED dot with authentic 6500K Ice-White bloom,
 * specular glow, and dark graphite off-state bezel.
 */
private fun DrawScope.drawDiscreteLedDot(center: Offset, brightness0to255: Int, radius: Float) {
    val alpha = (brightness0to255 / 255f).coerceIn(0f, 1f)

    // Base off-state LED socket
    drawCircle(
        color = Color(0xFF161822),
        radius = radius,
        center = center
    )
    drawCircle(
        color = Color(0x2EFFFFFF),
        radius = radius,
        center = center,
        style = Stroke(0.8.dp.toPx())
    )

    // Active illuminated state - Ice-White 6500K Nothing Hardware Glow
    if (alpha > 0.03f) {
        // Outer soft light bloom (cyan-tinted cold white)
        drawCircle(
            color = Color(0xFFD6EEFF).copy(alpha = alpha * 0.35f),
            radius = radius * 2.8f,
            center = center
        )
        // Mid brilliant white glow
        drawCircle(
            color = Color(0xFFFFFFFF).copy(alpha = alpha * 0.80f),
            radius = radius * 1.5f,
            center = center
        )
        // Intense bright white core
        drawCircle(
            color = Color(0xFFFFFFFF).copy(alpha = alpha),
            radius = radius * 0.8f,
            center = center
        )
    }
}

private fun DrawScope.drawPhone2Glyphs(w: Float, h: Float, brightness: IntArray) {
    val cx = w * 0.5f
    val cy = h * 0.48f
    val r = w * 0.32f
    val segAngle = 360f / 16f
    for (i in 0 until 16) {
        val ch = 4 + i // Center ring channels 4..19
        val b = if (ch < brightness.size) brightness[ch] / 255f else 0f
        drawArc(
            color = if (b > 0.05f) Color.White.copy(alpha = b) else Color(0x22FFFFFF),
            startAngle = i * segAngle,
            sweepAngle = segAngle - 3f,
            useCenter = false,
            topLeft = Offset(cx - r, cy - r),
            size = Size(r * 2, r * 2),
            style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round)
        )
    }
}

private fun DrawScope.drawPhone1Glyphs(w: Float, h: Float, brightness: IntArray) {
    val cx = w * 0.5f
    val cy = h * 0.46f
    val r = w * 0.33f
    val b0 = if (brightness.isNotEmpty()) brightness[0] / 255f else 0f
    drawArc(
        color = if (b0 > 0.05f) Color.White.copy(alpha = b0) else Color(0x22FFFFFF),
        startAngle = 30f,
        sweepAngle = 300f,
        useCenter = false,
        topLeft = Offset(cx - r, cy - r),
        size = Size(r * 2, r * 2),
        style = Stroke(width = 9.dp.toPx(), cap = StrokeCap.Round)
    )
}

