package com.nothing.glyphstudio.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import com.nothing.glyphstudio.glyph.DiagnosticEntry
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.glyph.HardwareConnectionState
import com.nothing.glyphstudio.glyph.Phone3aProLayout
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.ui.components.GlyphSimulatorView
import com.nothing.glyphstudio.ui.components.LiquidGlassCard

@Composable
fun GlyphTestScreen(
    modifier: Modifier = Modifier,
    onNavigateFullApp: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val connectionState by GlyphController.connectionState.collectAsState()
    val statusMessage by GlyphController.statusMessage.collectAsState()
    val detectedModel by GlyphController.detectedModel.collectAsState()
    val activeDevice by GlyphController.activeDevice.collectAsState()
    val currentFrame by GlyphController.currentFrame.collectAsState()
    val activeAnimation by GlyphController.activeAnimation.collectAsState()
    val diagnosticLogs by GlyphController.diagnosticLogs.collectAsState()

    var masterBrightness by remember { mutableFloatStateOf(255f) }
    var selectedChannel by remember { mutableIntStateOf(0) }
    var isLogsExpanded by remember { mutableStateOf(false) }

    // Zone states dynamically synchronized with physical frame & active device model
    val zone0Channels = remember(activeDevice) { GlyphController.getZoneChannels(activeDevice, 0) }
    val zone1Channels = remember(activeDevice) { GlyphController.getZoneChannels(activeDevice, 1) }
    val zone2Channels = remember(activeDevice) { GlyphController.getZoneChannels(activeDevice, 2) }

    val zoneAOn = zone0Channels.isNotEmpty() && zone0Channels.all { ch -> currentFrame.segmentBrightness.getOrNull(ch)?.let { it > 0 } == true }
    val zoneBOn = zone1Channels.isNotEmpty() && zone1Channels.all { ch -> currentFrame.segmentBrightness.getOrNull(ch)?.let { it > 0 } == true }
    val zoneCOn = zone2Channels.isNotEmpty() && zone2Channels.all { ch -> currentFrame.segmentBrightness.getOrNull(ch)?.let { it > 0 } == true }

    val zoneAName = GlyphController.getZoneName(activeDevice, 0)
    val zoneBName = GlyphController.getZoneName(activeDevice, 1)
    val zoneCName = GlyphController.getZoneName(activeDevice, 2)

    val activeCount = currentFrame.segmentBrightness.count { it > 0 }
    val totalSegments = activeDevice.totalSegments
    val safeSelectedChannel = selectedChannel.coerceIn(0, (totalSegments - 1).coerceAtLeast(0))

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(GlyphColors.AmoledBlack)
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "GLYPH TEST BENCH",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Мини-версия проверки совместимости",
                    color = GlyphColors.TextMuted,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            if (onNavigateFullApp != null) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0x22FFFFFF))
                        .clickable { onNavigateFullApp() }
                        .padding(horizontal = 8.dp, vertical = 5.dp)
                ) {
                    Text(
                        text = "ПОЛНЫЙ ХАБ",
                        color = Color.White,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Hardware Status Card
        LiquidGlassCard(
            modifier = Modifier.fillMaxWidth(),
            isActive = connectionState == HardwareConnectionState.CONNECTED
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        val statusDotColor = when (connectionState) {
                            HardwareConnectionState.CONNECTED -> Color(0xFF00FF66) // Green
                            HardwareConnectionState.CONNECTING -> Color(0xFFFFCC00) // Yellow
                            HardwareConnectionState.DISCONNECTED -> Color(0xFF888888) // Gray
                            HardwareConnectionState.ERROR -> Color(0xFFFF3333) // Red
                        }

                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(statusDotColor)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = when (connectionState) {
                                HardwareConnectionState.CONNECTED -> "GLYPH HARDWARE: ПОДКЛЮЧЕНО"
                                HardwareConnectionState.CONNECTING -> "ПОДКЛЮЧЕНИЕ К GLYPH SERVICE..."
                                HardwareConnectionState.DISCONNECTED -> "GLYPH SERVICE: ОТКЛЮЧЕН"
                                HardwareConnectionState.ERROR -> "ОШИБКА ПОДКЛЮЧЕНИЯ GLYPH"
                            },
                            color = statusDotColor,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // Reconnect Button
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0x33FFFFFF))
                            .clickable {
                                GlyphController.reconnect(context)
                            }
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Переподключить",
                                tint = Color.White,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "ПЕРЕПОДКЛЮЧИТЬ",
                                color = Color.White,
                                fontSize = 9.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Статус: $statusMessage",
                    color = if (connectionState == HardwareConnectionState.CONNECTED) Color(0xFF00FF66) else GlyphColors.TextMuted,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Модель: $detectedModel",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "Светятся: $activeCount / $totalSegments",
                        color = if (activeCount > 0) GlyphColors.NeonRed else GlyphColors.TextMuted,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Model Switcher Chips
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(
                        com.nothing.glyphstudio.glyph.NothingDevice.PHONE_3A_PRO to "3a Pro [24111]",
                        com.nothing.glyphstudio.glyph.NothingDevice.PHONE_2A to "2a [23111]",
                        com.nothing.glyphstudio.glyph.NothingDevice.PHONE_2 to "Phone 2",
                        com.nothing.glyphstudio.glyph.NothingDevice.PHONE_1 to "Phone 1"
                    ).forEach { (device, label) ->
                        val isSelected = activeDevice == device
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (isSelected) GlyphColors.NeonRed else Color(0x22FFFFFF))
                                .clickable { GlyphController.switchDevice(device) }
                                .padding(vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                color = Color.White,
                                fontSize = 8.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Live Visualizer
        GlyphSimulatorView(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
        )

        Spacer(modifier = Modifier.height(14.dp))

        // SECTION 1: Master Controls
        LiquidGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "1. МАСТЕР-УПРАВЛЕНИЕ ВСЕМИ ГЛИФАМИ",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            GlyphController.turnAllOn(masterBrightness.toInt())
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = GlyphColors.NeonRed),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = "💡 ВКЛ ВСЕ (MAX)",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Button(
                        onClick = {
                            GlyphController.turnAllOff()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF222228)),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = "⬛ ВЫКЛ ВСЕ",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Яркость: ${((masterBrightness / 255f) * 100).toInt()}% (${masterBrightness.toInt()})",
                        color = GlyphColors.TextMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace
                    )

                    // Quick presets
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(25, 50, 75, 100).forEach { pct ->
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(Color(0x22FFFFFF))
                                    .clickable {
                                        masterBrightness = (pct * 255f / 100f)
                                        if (activeCount > 0) {
                                            GlyphController.turnAllOn(masterBrightness.toInt())
                                        }
                                    }
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "$pct%",
                                    color = Color.White,
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }

                Slider(
                    value = masterBrightness,
                    onValueChange = { newVal ->
                        masterBrightness = newVal
                        if (activeCount > 0) {
                            GlyphController.turnAllOn(newVal.toInt())
                        }
                    },
                    valueRange = 0f..255f,
                    colors = SliderDefaults.colors(
                        thumbColor = GlyphColors.NeonRed,
                        activeTrackColor = GlyphColors.NeonRed,
                        inactiveTrackColor = Color(0xFF33333C)
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // SECTION 2: Individual Zone Controls
        LiquidGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "2. ТЕСТ КАЖДОГО ГЛИФА ПО ОТДЕЛЬНОСТИ",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Проверка 3 непрерывных дуг вокруг блока камер",
                    color = GlyphColors.TextMuted,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Zone A (Top-Left or First Arc)
                ZoneToggleRow(
                    title = zoneAName,
                    subtitle = "Каналы: ${if (zone0Channels.size > 8) "${zone0Channels.first()}..${zone0Channels.last()} (${zone0Channels.size} LEDs)" else zone0Channels.joinToString(", ")}",
                    isOn = zoneAOn,
                    onToggle = {
                        GlyphController.setZoneState(0, !zoneAOn, masterBrightness.toInt())
                    }
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Zone B (Bottom-Left or Second Arc)
                ZoneToggleRow(
                    title = zoneBName,
                    subtitle = "Каналы: ${if (zone1Channels.size > 8) "${zone1Channels.first()}..${zone1Channels.last()} (${zone1Channels.size} LEDs)" else zone1Channels.joinToString(", ")}",
                    isOn = zoneBOn,
                    onToggle = {
                        GlyphController.setZoneState(1, !zoneBOn, masterBrightness.toInt())
                    }
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Zone C (Right Arc or Third Arc)
                ZoneToggleRow(
                    title = zoneCName,
                    subtitle = "Каналы: ${if (zone2Channels.size > 8) "${zone2Channels.first()}..${zone2Channels.last()} (${zone2Channels.size} LEDs)" else zone2Channels.joinToString(", ")}",
                    isOn = zoneCOn,
                    onToggle = {
                        GlyphController.setZoneState(2, !zoneCOn, masterBrightness.toInt())
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // SECTION 3: Single LED Channel Stepper
        LiquidGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "3. ПОКАНАЛЬНЫЙ ТЕСТ СВЕТОДИОДОВ",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Проверка каждого одиночного светодиода в матрице",
                    color = GlyphColors.TextMuted,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF222228))
                            .clickable {
                                val prev = ((safeSelectedChannel - 1) % totalSegments + totalSegments) % totalSegments
                                selectedChannel = prev
                                GlyphController.setSingleChannel(prev, masterBrightness.toInt())
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("◀", color = Color.White, fontSize = 14.sp)
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "КАНАЛ #$safeSelectedChannel",
                            color = GlyphColors.NeonRed,
                            fontSize = 15.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                        val zoneInfo = GlyphController.getChannelZoneDescription(activeDevice, safeSelectedChannel)
                        Text(
                            text = zoneInfo,
                            color = Color.White,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF222228))
                            .clickable {
                                val next = (safeSelectedChannel + 1) % totalSegments
                                selectedChannel = next
                                GlyphController.setSingleChannel(next, masterBrightness.toInt())
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("▶", color = Color.White, fontSize = 14.sp)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Auto walk button
                val isAutoWalk = activeAnimation == "AUTO_WALK"
                Button(
                    onClick = {
                        if (isAutoWalk) {
                            GlyphController.stopAutoWalk()
                        } else {
                            GlyphController.startAutoWalk(coroutineScope)
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isAutoWalk) GlyphColors.NeonRed else Color(0xFF222228)
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(
                        imageVector = if (isAutoWalk) Icons.Default.Stop else Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = if (isAutoWalk) "ОСТАНОВИТЬ АВТО-ОБХОД" else "▶ АВТО-ОБХОД (БЕГУЩИЙ ОГОНЬ)",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // SECTION 4: Test Animations
        LiquidGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "4. ТЕСТОВЫЕ АНИМАЦИИ",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Стробоскоп, круговая рулетка «Световая бутылочка», плавное свечение",
                    color = GlyphColors.TextMuted,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Animation 1: Strobe
                val isStrobe = activeAnimation == "STROBE"
                AnimationCard(
                    title = "⚡ СТРОБОСКОП (STROBE)",
                    description = "Быстрая пульсация всех светодиодов на частоте 10 Гц (50мс)",
                    isActive = isStrobe,
                    onToggle = {
                        if (isStrobe) {
                            GlyphController.stopStrobe()
                        } else {
                            GlyphController.startStrobe(coroutineScope, frequencyHz = 10)
                        }
                    }
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Animation 2: Spin the Bottle
                val isBottle = activeAnimation == "BOTTLE"
                AnimationCard(
                    title = "🍾 СВЕТОВАЯ БУТЫЛОЧКА (ROULETTE)",
                    description = "Круговое вращение светового пикселя с физикой трения и победной вспышкой",
                    isActive = isBottle,
                    onToggle = {
                        if (isBottle) {
                            GlyphController.stopBottleRoulette()
                        } else {
                            GlyphController.startBottleRoulette(coroutineScope) { winner ->
                                Toast.makeText(context, "Остановка на сегменте #$winner!", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Animation 3: Smooth Breathing
                val isBreathing = activeAnimation == "BREATHING"
                AnimationCard(
                    title = "🌊 ПЛАВНОЕ ДЫХАНИЕ (BREATHING)",
                    description = "Плавное синусоидальное затухание и нарастание яркости (0 → 255 → 0)",
                    isActive = isBreathing,
                    onToggle = {
                        if (isBreathing) {
                            GlyphController.stopSmoothBreathing()
                        } else {
                            GlyphController.startSmoothBreathing(coroutineScope)
                        }
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // SECTION 5: Real-time Diagnostics Log Console
        LiquidGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "5. ДИАГНОСТИКА SDK В РЕАЛЬНОМ ВРЕМЕНИ",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Лог вызовов GlyphManager, register, openSession, toggle",
                            color = GlyphColors.TextMuted,
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0x22FFFFFF))
                                .clickable {
                                    val text = diagnosticLogs.joinToString("\n") { "[${it.timestamp}] [${it.level}] ${it.message}" }
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    clipboard.setPrimaryClip(ClipData.newPlainText("GlyphDiagnostics", text))
                                    Toast.makeText(context, "Логи скопированы в буфер!", Toast.LENGTH_SHORT).show()
                                }
                                .padding(horizontal = 6.dp, vertical = 3.dp)
                        ) {
                            Text("КОПИР.", color = Color.White, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0x22FFFFFF))
                                .clickable { GlyphController.clearLogs() }
                                .padding(horizontal = 6.dp, vertical = 3.dp)
                        ) {
                            Text("ОЧИСТ.", color = Color.White, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0x22FFFFFF))
                                .clickable { isLogsExpanded = !isLogsExpanded }
                                .padding(horizontal = 6.dp, vertical = 3.dp)
                        ) {
                            Text(if (isLogsExpanded) "▲" else "▼", color = Color.White, fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Terminal window
                val displayLogs = if (isLogsExpanded) diagnosticLogs else diagnosticLogs.take(4)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF070709))
                        .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    if (displayLogs.isEmpty()) {
                        Text(
                            text = "Логи пока пусты...",
                            color = Color(0x66FFFFFF),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            displayLogs.forEach { entry ->
                                val color = when (entry.level) {
                                    "SUCCESS" -> Color(0xFF00FF66)
                                    "ERROR" -> Color(0xFFFF4444)
                                    "WARN" -> Color(0xFFFFCC00)
                                    "CMD" -> Color(0xFF33CCFF)
                                    else -> Color(0xFFDDDDDD)
                                }
                                Text(
                                    text = "[${entry.timestamp}] [${entry.level}] ${entry.message}",
                                    color = color,
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace,
                                    lineHeight = 12.sp
                                )
                            }
                        }
                    }
                }

                if (!isLogsExpanded && diagnosticLogs.size > 4) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Нажмите стрелку, чтобы показать все ${diagnosticLogs.size} записей...",
                        color = GlyphColors.TextMuted,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier
                            .clickable { isLogsExpanded = true }
                            .padding(vertical = 2.dp)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // SECTION 6: Nothing OS Troubleshooting & Permissions Helper
        LiquidGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "ℹ️ ПАМЯТКА ДЛЯ ПРОВЕРКИ ГЛИФОВ",
                    color = Color.White,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "• Если глифы не светятся на спинке смартфона:\n" +
                            "  1. Откройте «Настройки» -> «Интерфейс Glyph» -> включите Glyph.\n" +
                            "  2. Проверьте «Сторонние приложения» -> включите доступ для Glyph Studio.\n" +
                            "  3. Убедитесь, что телефон не находится в режиме «Время сна» или «Не беспокоить».\n" +
                            "• Для копирования полного лога нажмите «КОПИР.» в окне диагностики выше.",
                    color = GlyphColors.TextMuted,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    lineHeight = 14.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(30.dp))
    }
}

@Composable
private fun ZoneToggleRow(
    title: String,
    subtitle: String,
    isOn: Boolean,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (isOn) Color(0x33FF003C) else Color(0xFF14141A))
            .border(
                width = 1.dp,
                color = if (isOn) GlyphColors.NeonRed else Color(0x22FFFFFF),
                shape = RoundedCornerShape(10.dp)
            )
            .clickable { onToggle() }
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = Color.White,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = subtitle,
                color = GlyphColors.TextMuted,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(if (isOn) GlyphColors.NeonRed else Color(0xFF26262E))
                .padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Text(
                text = if (isOn) "ВКЛ" else "ВЫКЛ",
                color = Color.White,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun AnimationCard(
    title: String,
    description: String,
    isActive: Boolean,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (isActive) Color(0x33FF003C) else Color(0xFF14141A))
            .border(
                width = 1.dp,
                color = if (isActive) GlyphColors.NeonRed else Color(0x22FFFFFF),
                shape = RoundedCornerShape(10.dp)
            )
            .clickable { onToggle() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = if (isActive) GlyphColors.NeonRed else Color.White,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = description,
                color = GlyphColors.TextMuted,
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(if (isActive) GlyphColors.NeonRed else Color(0xFF26262E))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Text(
                text = if (isActive) "СТОП" else "СТАРТ",
                color = Color.White,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
