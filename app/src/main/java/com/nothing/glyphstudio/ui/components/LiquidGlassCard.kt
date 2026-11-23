package com.nothing.glyphstudio.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.theme.liquidGlass

@Composable
fun LiquidGlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(20.dp),
    elevation: Dp = 6.dp,
    borderWidth: Dp = 1.dp,
    isActive: Boolean = false,
    isBoosted: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit
) {
    val clickableModifier = if (onClick != null) {
        Modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = ripple(color = Color.White),
            onClick = onClick
        )
    } else {
        Modifier
    }

    Box(
        modifier = modifier
            .liquidGlass(
                shape = shape,
                elevation = elevation,
                borderWidth = borderWidth,
                isActive = isActive,
                isBoosted = isBoosted
            )
            .then(clickableModifier)
            .padding(16.dp)
    ) {
        // Top Specular Glass Chamfer Rim Highlight
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth(0.92f)
                .height(1.dp)
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            Color.Transparent,
                            if (isActive) Color(0xB3FFFFFF) else Color(0x4DFFFFFF),
                            Color.Transparent
                        )
                    )
                )
        )
        content()
    }
}

