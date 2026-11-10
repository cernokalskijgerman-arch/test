package com.nothing.glyphstudio.ui.screens

import android.content.Intent
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.FlashlightOn
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.service.GlyphForegroundService
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.ui.components.GlyphSimulatorView
import com.nothing.glyphstudio.ui.components.LiquidGlassCard

import com.nothing.glyphstudio.ui.components.NothingBadge

enum class ActiveUtility {
    NONE,
    TIMER,
    BATTERY,
    SOFTLIGHT,
    STROBE
}

@Composable
fun UtilitiesScreen(
    isBoosted: Boolean = false,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var activeUtil by remember { mutableStateOf(ActiveUtility.NONE) }

    var timerDurationSec by remember { mutableIntStateOf(60) }
    var softlightBrightness by remember { mutableIntStateOf(200) }
    var strobeHz by remember { mutableIntStateOf(10) }

    fun stopAllService() {
        activeUtil = ActiveUtility.NONE
        val intent = Intent(context, GlyphForegroundService::class.java).apply {
            action = GlyphForegroundService.ACTION_STOP
        }
        context.startService(intent)
        GlyphController.clear()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GlyphColors.AmoledBlack)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Top Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "GLYPH UTILITIES",
                    color = GlyphColors.TextWhite,
                    fontSize = 18.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (activeUtil != ActiveUtility.NONE) "FOREGROUND ACTIVE" else "STANDBY",
                    color = if (activeUtil != ActiveUtility.NONE) {
                        if (isBoosted) GlyphColors.BoostPlasma else GlyphColors.NeonRed
                    } else Color.Gray,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            NothingBadge(
                text = if (activeUtil != ActiveUtility.NONE) "SYSTEM ON" else "READY",
                isActive = activeUtil != ActiveUtility.NONE,
                isBoosted = isBoosted
            )
            if (activeUtil != ActiveUtility.NONE) {
                Spacer(modifier = Modifier.width(6.dp))
                IconButton(onClick = { stopAllService() }) {
                    Icon(Icons.Default.Stop, contentDescription = "Stop", tint = GlyphColors.NeonRed)
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Simulator
        GlyphSimulatorView(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp),
            isBoosted = isBoosted
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Utility 1: Glyph Timer / Pomodoro
        LiquidGlassCard(
            modifier = Modifier.fillMaxWidth(),
            isActive = activeUtil == ActiveUtility.TIMER,
            isBoosted = isBoosted
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.HourglassTop, contentDescription = null, tint = GlyphColors.NeonRed)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "GLYPH TIMER",
                            color = GlyphColors.TextWhite,
                            fontSize = 14.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Button(
                        onClick = {
                            if (activeUtil == ActiveUtility.TIMER) {
                                stopAllService()
                            } else {
                                stopAllService()
                                activeUtil = ActiveUtility.TIMER
                                val intent = Intent(context, GlyphForegroundService::class.java).apply {
                                    action = GlyphForegroundService.ACTION_START_TIMER
                                    putExtra(GlyphForegroundService.EXTRA_DURATION_SEC, timerDurationSec)
                                }
                                context.startForegroundService(intent)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (activeUtil == ActiveUtility.TIMER) GlyphColors.NeonRed else Color(0x33FF2E3B)
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = if (activeUtil == ActiveUtility.TIMER) "STOP" else "START",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Time Presets
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    listOf(30, 60, 180, 300, 900, 1500).forEach { sec ->
                        val label = if (sec < 60) "${sec}s" else "${sec / 60}m"
                        val isSel = timerDurationSec == sec
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSel) GlyphColors.NeonRed else Color(0x1FFFFFFF))
                                .clickable { timerDurationSec = sec }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = label,
                                color = if (isSel) Color.White else Color.Gray,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Utility 2: Battery Gauge
        LiquidGlassCard(
            modifier = Modifier.fillMaxWidth(),
            isActive = activeUtil == ActiveUtility.BATTERY,
            isBoosted = isBoosted
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.BatteryChargingFull, contentDescription = null, tint = GlyphColors.NeonRed)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "BATTERY GAUGE",
                            color = GlyphColors.TextWhite,
                            fontSize = 14.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Mirrors battery % to arc LEDs",
                            color = Color.Gray,
                            fontSize = 11.sp
                        )
                    }
                }

                Button(
                    onClick = {
                        if (activeUtil == ActiveUtility.BATTERY) {
                            stopAllService()
                        } else {
                            stopAllService()
                            activeUtil = ActiveUtility.BATTERY
                            val intent = Intent(context, GlyphForegroundService::class.java).apply {
                                action = GlyphForegroundService.ACTION_START_BATTERY
                            }
                            context.startForegroundService(intent)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (activeUtil == ActiveUtility.BATTERY) GlyphColors.NeonRed else Color(0x33FF2E3B)
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = if (activeUtil == ActiveUtility.BATTERY) "OFF" else "ENABLE",
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Utility 3: Pro Softlight & Strobe
        LiquidGlassCard(
            modifier = Modifier.fillMaxWidth(),
            isBoosted = isBoosted
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.FlashlightOn, contentDescription = null, tint = GlyphColors.NeonRed)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "LIGHT & STROBE",
                        color = GlyphColors.TextWhite,
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Brightness Slider
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("SOFTLIGHT BRIGHTNESS", color = Color.Gray, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Text("${(softlightBrightness / 255f * 100).toInt()}%", color = GlyphColors.NeonRed, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
                Slider(
                    value = softlightBrightness.toFloat(),
                    onValueChange = {
                        softlightBrightness = it.toInt()
                        if (activeUtil == ActiveUtility.SOFTLIGHT) {
                            val intent = Intent(context, GlyphForegroundService::class.java).apply {
                                action = GlyphForegroundService.ACTION_START_SOFTLIGHT
                                putExtra(GlyphForegroundService.EXTRA_BRIGHTNESS, softlightBrightness)
                            }
                            context.startForegroundService(intent)
                        }
                    },
                    valueRange = 10f..255f,
                    colors = SliderDefaults.colors(
                        thumbColor = GlyphColors.NeonRed,
                        activeTrackColor = GlyphColors.NeonRed,
                        inactiveTrackColor = Color(0x33FFFFFF)
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Button(
                        onClick = {
                            if (activeUtil == ActiveUtility.SOFTLIGHT) {
                                stopAllService()
                            } else {
                                stopAllService()
                                activeUtil = ActiveUtility.SOFTLIGHT
                                val intent = Intent(context, GlyphForegroundService::class.java).apply {
                                    action = GlyphForegroundService.ACTION_START_SOFTLIGHT
                                    putExtra(GlyphForegroundService.EXTRA_BRIGHTNESS, softlightBrightness)
                                }
                                context.startForegroundService(intent)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (activeUtil == ActiveUtility.SOFTLIGHT) GlyphColors.NeonRed else Color(0x33FF2E3B)
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(if (activeUtil == ActiveUtility.SOFTLIGHT) "TURN OFF" else "SOFTLIGHT ON", fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                    }

                    Button(
                        onClick = {
                            if (activeUtil == ActiveUtility.STROBE) {
                                stopAllService()
                            } else {
                                stopAllService()
                                activeUtil = ActiveUtility.STROBE
                                val intent = Intent(context, GlyphForegroundService::class.java).apply {
                                    action = GlyphForegroundService.ACTION_START_STROBE
                                    putExtra(GlyphForegroundService.EXTRA_STROBE_HZ, strobeHz)
                                }
                                context.startForegroundService(intent)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (activeUtil == ActiveUtility.STROBE) GlyphColors.NeonRed else Color(0x33FF2E3B)
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(if (activeUtil == ActiveUtility.STROBE) "STOP STROBE" else "STROBE ($strobeHz Hz)", fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(30.dp))
    }
}
