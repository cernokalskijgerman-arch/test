package com.nothing.glyphstudio.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nothing.glyphstudio.audio.AudioSourceType
import com.nothing.glyphstudio.audio.AudioSpectrumAnalyzer
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.ui.components.GlyphSimulatorView
import com.nothing.glyphstudio.ui.components.LiquidGlassCard

import com.nothing.glyphstudio.ui.components.NothingBadge

@Composable
fun VisualizerScreen(
    isBoosted: Boolean = false,
    onBack: () -> Unit
) {
    val analyzer = remember { AudioSpectrumAnalyzer() }
    val isListening by analyzer.isListening.collectAsState()
    val bass by analyzer.bassLevel.collectAsState()
    val mid by analyzer.midLevel.collectAsState()
    val treble by analyzer.trebleLevel.collectAsState()

    var sourceType by remember { mutableStateOf(AudioSourceType.MICROPHONE) }
    var sensitivity by remember { mutableFloatStateOf(1.2f) }

    DisposableEffect(Unit) {
        onDispose {
            analyzer.stop()
            GlyphController.clear()
        }
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
            IconButton(onClick = {
                analyzer.stop()
                onBack()
            }) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "AUDIO VISUALIZER",
                    color = GlyphColors.TextWhite,
                    fontSize = 18.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (isListening) "SPECTRUM ACTIVE (FFT)" else "IDLE",
                    color = if (isListening) {
                        if (isBoosted) GlyphColors.BoostPlasma else GlyphColors.NeonRed
                    } else Color.Gray,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            NothingBadge(
                text = if (isListening) "FFT RUNNING" else "STANDBY",
                isActive = isListening,
                isBoosted = isBoosted
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Simulator View
        GlyphSimulatorView(
            modifier = Modifier
                .fillMaxWidth()
                .height(240.dp),
            isBoosted = isBoosted
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Live Audio Spectrum Meters (Bass, Mid, Treble)
        LiquidGlassCard(
            modifier = Modifier.fillMaxWidth(),
            isBoosted = isBoosted
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "FREQUENCY BANDS",
                        color = GlyphColors.TextWhite,
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    NothingBadge(text = "3-WAY CAM MATRIX", isBoosted = isBoosted)
                }
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(110.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.Bottom
                ) {
                    SpectrumBar(name = "BASS (RIGHT 16)", level = bass, color = GlyphColors.NeonRed)
                    SpectrumBar(name = "MIDS (TOP 12)", level = mid, color = GlyphColors.BrightRedGlow)
                    SpectrumBar(name = "HIGHS (BOT 6)", level = treble, color = Color(0xFFFF8A94))
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Controls (Source & Sensitivity)
        LiquidGlassCard(
            modifier = Modifier.fillMaxWidth(),
            isBoosted = isBoosted
        ) {
            Column {
                // Source Selector
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = {
                            if (isListening) {
                                analyzer.stop()
                            } else {
                                analyzer.sensitivity = sensitivity
                                analyzer.startListening(sourceType)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isListening) GlyphColors.NeonRed else Color(0x33FF2E3B)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(
                            imageVector = if (isListening) Icons.Default.Stop else Icons.Default.GraphicEq,
                            contentDescription = "Toggle",
                            tint = Color.White
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isListening) "STOP" else "START VISUALIZER",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    // Source Mode Switch
                    Row {
                        SourceButton(
                            title = "MIC",
                            isSelected = sourceType == AudioSourceType.MICROPHONE
                        ) {
                            sourceType = AudioSourceType.MICROPHONE
                            if (isListening) {
                                analyzer.stop()
                                analyzer.startListening(sourceType)
                            }
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                        SourceButton(
                            title = "BEAT",
                            isSelected = sourceType == AudioSourceType.SIMULATED_BEAT
                        ) {
                            sourceType = AudioSourceType.SIMULATED_BEAT
                            if (isListening) {
                                analyzer.stop()
                                analyzer.startListening(sourceType)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Sensitivity
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("SENSITIVITY", color = Color.Gray, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Text("${(sensitivity * 100).toInt()}%", color = GlyphColors.NeonRed, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }

                Slider(
                    value = sensitivity,
                    onValueChange = {
                        sensitivity = it
                        analyzer.sensitivity = it
                    },
                    valueRange = 0.5f..3.0f,
                    colors = SliderDefaults.colors(
                        thumbColor = GlyphColors.NeonRed,
                        activeTrackColor = GlyphColors.NeonRed,
                        inactiveTrackColor = Color(0x33FFFFFF)
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(30.dp))
    }
}

@Composable
private fun SpectrumBar(
    name: String,
    level: Float,
    color: Color
) {
    val animatedHeight by animateFloatAsState(targetValue = level.coerceIn(0f, 1f), label = "bar")

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(90.dp)
    ) {
        Box(
            modifier = Modifier
                .width(44.dp)
                .height(80.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0x22111116)),
            contentAlignment = Alignment.BottomCenter
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(animatedHeight)
                    .clip(RoundedCornerShape(8.dp))
                    .background(color)
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = name,
            color = GlyphColors.TextMuted,
            fontSize = 9.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun SourceButton(
    title: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (isSelected) GlyphColors.NeonRed else Color(0x22FFFFFF))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = title,
            color = if (isSelected) Color.White else Color.Gray,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold
        )
    }
}
