package com.nothing.glyphstudio.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.ripple.rememberRipple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.theme.liquidGlass

@Composable
fun LiquidGlassCard(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(22.dp),
    elevation: Dp = 8.dp,
    isActive: Boolean = false,
    isBoosted: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit
) {
    val clickableModifier = if (onClick != null) {
        Modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = rememberRipple(color = GlyphColors.NeonRed),
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
                isActive = isActive,
                isBoosted = isBoosted
            )
            .then(clickableModifier)
            .padding(16.dp),
        content = content
    )
}
