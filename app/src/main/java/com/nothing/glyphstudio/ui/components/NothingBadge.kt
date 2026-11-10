package com.nothing.glyphstudio.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nothing.glyphstudio.theme.GlyphColors

/**
 * Unified Nothing-style micro-pill badge for tags, status indicators, and labels.
 * Enforces a singular, cohesive aesthetic: Monochrome + Signature Neon Red accents.
 */
@Composable
fun NothingBadge(
    text: String,
    modifier: Modifier = Modifier,
    isActive: Boolean = false,
    isBoosted: Boolean = false
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (isBoosted || isActive) GlyphColors.BadgeSurfaceActive else GlyphColors.BadgeSurface)
            .border(
                width = 1.dp,
                color = if (isBoosted || isActive) GlyphColors.BadgeBorderActive else GlyphColors.BadgeBorder,
                shape = RoundedCornerShape(6.dp)
            )
            .padding(horizontal = 7.dp, vertical = 3.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(5.dp)
                    .clip(CircleShape)
                    .background(if (isBoosted || isActive) GlyphColors.NeonRed else Color(0x66FFFFFF))
            )
            Spacer(modifier = Modifier.width(5.dp))
            Text(
                text = text.uppercase(),
                color = if (isBoosted || isActive) GlyphColors.NeonRed else GlyphColors.BadgeText,
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp
            )
        }
    }
}
