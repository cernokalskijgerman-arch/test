package com.nothing.glyphstudio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.glyph.NothingDevice
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.ui.components.GlyphSimulatorView
import com.nothing.glyphstudio.ui.components.LiquidGlassCard

enum class ScreenDestination {
    DASHBOARD,
    SEQUENCER,
    VISUALIZER,
    UTILITIES,
    ARCADE
}

@Composable
fun DashboardScreen(
    onNavigate: (ScreenDestination) -> Unit
) {
    val activeDevice by GlyphController.activeDevice.collectAsState()
    val isHardwareConnected by GlyphController.isHardwareConnected.collectAsState()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(GlyphColors.AmoledBlack)
            .padding(horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // App Title & Brand
        item {
            Spacer(modifier = Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "GLYPH (STUDIO)",
                        color = GlyphColors.TextWhite,
                        fontSize = 22.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                    Text(
                        text = "PHONE (3) MATRIX",
                        color = GlyphColors.NeonRed,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 1.sp
                    )
                }

                // Unified Status Badge
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isHardwareConnected) GlyphColors.DeepRedWine else Color(0x331C080B))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(if (isHardwareConnected) GlyphColors.NeonRed else Color(0xFF888888))
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isHardwareConnected) "HARDWARE" else "SIMULATOR",
                        color = GlyphColors.TextWhite,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
        }

        // Live 2D Simulator Hero
        item {
            GlyphSimulatorView(
                modifier = Modifier.fillMaxWidth()
            )
        }

        // Device Switcher Bar (Monochrome + Nothing Red)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                NothingDevice.values().forEach { device ->
                    val isSelected = device == activeDevice
                    Box(
                        modifier = Modifier
                            .padding(horizontal = 4.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isSelected) GlyphColors.NeonRed else Color(0x1AFFFFFF))
                            .clickable { GlyphController.setDevice(device) }
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Text(
                            text = when (device) {
                                NothingDevice.PHONE_3A_PRO -> "3A PRO / 3"
                                NothingDevice.PHONE_2A -> "PHONE (2A)"
                                NothingDevice.PHONE_2 -> "PHONE (2)"
                                NothingDevice.PHONE_1 -> "PHONE (1)"
                            },
                            color = if (isSelected) Color.White else GlyphColors.TextMuted,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
        }

        // Hub Cards in Unified Palette
        item {
            HubCard(
                title = "СТЕП-СЕКВЕНСОР",
                subtitle = "16-тактовая сетка дуг камеры, BPM & экспорт .glyph",
                icon = Icons.Default.MusicNote,
                tag = "EDITOR",
                onClick = { onNavigate(ScreenDestination.SEQUENCER) }
            )
            Spacer(modifier = Modifier.height(10.dp))
        }

        item {
            HubCard(
                title = "МУЗЫКАЛЬНЫЙ ЭКВАЛАЙЗЕР",
                subtitle = "Реакция на бас и частоты (микрофон / плеер)",
                icon = Icons.Default.GraphicEq,
                tag = "AUDIO FFT",
                onClick = { onNavigate(ScreenDestination.VISUALIZER) }
            )
            Spacer(modifier = Modifier.height(10.dp))
        }

        item {
            HubCard(
                title = "УТИЛИТЫ И СВЕТ",
                subtitle = "Глиф-таймер, индикатор заряда, стробоскоп & фонарик",
                icon = Icons.Default.FlashOn,
                tag = "FOREGROUND",
                onClick = { onNavigate(ScreenDestination.UTILITIES) }
            )
            Spacer(modifier = Modifier.height(10.dp))
        }

        item {
            HubCard(
                title = "АРКАДНЫЕ ИГРЫ",
                subtitle = "«Световая бутылочка» (рулетка) и «Glyph Reflex»",
                icon = Icons.Default.SportsEsports,
                tag = "MINI-GAMES",
                onClick = { onNavigate(ScreenDestination.ARCADE) }
            )
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun HubCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    tag: String,
    onClick: () -> Unit
) {
    LiquidGlassCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(GlyphColors.DeepRedWine),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = GlyphColors.NeonRed,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = title,
                        color = GlyphColors.TextWhite,
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0x33FF2E3B))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = tag,
                            color = GlyphColors.NeonRed,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = subtitle,
                    color = GlyphColors.TextMuted,
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )
            }
        }
    }
}
