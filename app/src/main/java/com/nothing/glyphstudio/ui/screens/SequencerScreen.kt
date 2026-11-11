package com.nothing.glyphstudio.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
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
import com.nothing.glyphstudio.data.PresetRepository
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.glyph.GlyphFrame
import com.nothing.glyphstudio.glyph.GlyphSequence
import com.nothing.glyphstudio.glyph.Phone3aProLayout
import com.nothing.glyphstudio.glyph.StepTrack
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.ui.components.GlyphSimulatorView
import com.nothing.glyphstudio.ui.components.LiquidGlassCard
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
fun SequencerScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var isPlaying by remember { mutableStateOf(false) }
    var currentStep by remember { mutableIntStateOf(0) }
    var bpm by remember { mutableIntStateOf(128) }
    var sequenceName by remember { mutableStateOf("Nothing 3a Beat") }

    // 3 main tracks for Nothing 3a Pro / 3:
    // Track 0: Top-Left Arc (0..11)
    // Track 1: Bottom-Left Arc (12..17)
    // Track 2: Right Arc (18..32)
    val trackTopLeft = remember { mutableStateListOf(*Array(16) { if (it % 4 == 0) 255 else 0 }) }
    val trackBottomLeft = remember { mutableStateListOf(*Array(16) { if (it % 4 == 2) 220 else 0 }) }
    val trackRight = remember { mutableStateListOf(*Array(16) { if (it % 2 == 0) 255 else 0 }) }

    LaunchedEffect(isPlaying, bpm) {
        if (!isPlaying) {
            GlyphController.clear()
            return@LaunchedEffect
        }
        val stepDurationMs = (60000L / bpm) / 4L

        while (isActive && isPlaying) {
            val total = GlyphController.activeDevice.value.totalSegments
            val array = IntArray(total)

            val bTL = trackTopLeft[currentStep]
            val bBL = trackBottomLeft[currentStep]
            val bR = trackRight[currentStep]

            val dev = GlyphController.activeDevice.value
            // Zone 0: Top-Left Arc
            for (ch in GlyphController.getZoneChannels(dev, 0)) {
                if (ch < total) array[ch] = bTL
            }
            // Zone 1: Bottom-Left Arc
            for (ch in GlyphController.getZoneChannels(dev, 1)) {
                if (ch < total) array[ch] = bBL
            }
            // Zone 2: Right Arc
            for (ch in GlyphController.getZoneChannels(dev, 2)) {
                if (ch < total) array[ch] = bR
            }

            GlyphController.updateFrame(GlyphFrame(segmentBrightness = array))
            delay(stepDurationMs)
            currentStep = (currentStep + 1) % 16
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
                isPlaying = false
                GlyphController.clear()
                onBack()
            }) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    text = "STEP SEQUENCER",
                    color = GlyphColors.TextWhite,
                    fontSize = 17.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = sequenceName,
                    color = GlyphColors.NeonRed,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            Spacer(modifier = Modifier.weight(1f))

            IconButton(onClick = {
                val p = PresetRepository.builtInPresets.random()
                sequenceName = p.name
                bpm = p.bpm
                Toast.makeText(context, "Loaded: ${p.name}", Toast.LENGTH_SHORT).show()
            }) {
                Icon(Icons.Default.FolderOpen, contentDescription = "Preset", tint = GlyphColors.TextWhite)
            }

            IconButton(onClick = {
                val seq = GlyphSequence(
                    name = sequenceName,
                    bpm = bpm,
                    tracks = listOf(
                        StepTrack(0, "TopLeft", trackTopLeft.toMutableList()),
                        StepTrack(1, "BottomLeft", trackBottomLeft.toMutableList()),
                        StepTrack(2, "Right", trackRight.toMutableList())
                    )
                )
                PresetRepository.saveToFile(context, seq, sequenceName)
                Toast.makeText(context, "Saved: $sequenceName.glyph", Toast.LENGTH_SHORT).show()
            }) {
                Icon(Icons.Default.Save, contentDescription = "Save", tint = GlyphColors.NeonRed)
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Live Simulator
        GlyphSimulatorView(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Transport Controls
        LiquidGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = { isPlaying = !isPlaying },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPlaying) GlyphColors.NeonRed else Color(0x33FF2E3B)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Stop else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "Stop" else "Play",
                            tint = Color.White
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (isPlaying) "STOP" else "PLAY",
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Text(
                        text = "$bpm BPM",
                        color = GlyphColors.TextWhite,
                        fontSize = 15.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )

                    IconButton(onClick = {
                        for (i in 0 until 16) {
                            trackTopLeft[i] = 0
                            trackBottomLeft[i] = 0
                            trackRight[i] = 0
                        }
                    }) {
                        Icon(Icons.Default.Delete, contentDescription = "Clear", tint = GlyphColors.TextMuted)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Slider(
                    value = bpm.toFloat(),
                    onValueChange = { bpm = it.toInt() },
                    valueRange = 60f..220f,
                    colors = SliderDefaults.colors(
                        thumbColor = GlyphColors.NeonRed,
                        activeTrackColor = GlyphColors.NeonRed,
                        inactiveTrackColor = Color(0x22FFFFFF)
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Step Grid
        LiquidGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.horizontalScroll(rememberScrollState())
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.width(82.dp)) {
                        Text("STEP", color = GlyphColors.TextDim, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    }
                    for (step in 0 until 16) {
                        val isHead = isPlaying && currentStep == step
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .padding(2.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (isHead) GlyphColors.NeonRed else Color(0x15FFFFFF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "${step + 1}",
                                color = if (isHead) Color.White else GlyphColors.TextDim,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                SequencerRow("ВЕРХ-ЛЕВО", trackTopLeft, if (isPlaying) currentStep else -1) {
                    trackTopLeft[it] = if (trackTopLeft[it] > 0) 0 else 255
                }
                Spacer(modifier = Modifier.height(6.dp))

                SequencerRow("НИЗ-ЛЕВО", trackBottomLeft, if (isPlaying) currentStep else -1) {
                    trackBottomLeft[it] = if (trackBottomLeft[it] > 0) 0 else 255
                }
                Spacer(modifier = Modifier.height(6.dp))

                SequencerRow("ПРАВАЯ ДУГА", trackRight, if (isPlaying) currentStep else -1) {
                    trackRight[it] = if (trackRight[it] > 0) 0 else 255
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun SequencerRow(
    label: String,
    steps: List<Int>,
    activePlayhead: Int,
    onStepToggle: (Int) -> Unit
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.width(82.dp)) {
            Text(
                text = label,
                color = GlyphColors.TextWhite,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold
            )
        }

        for (i in steps.indices) {
            val isOn = steps[i] > 0
            val isHead = activePlayhead == i

            Box(
                modifier = Modifier
                    .size(34.dp)
                    .padding(2.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(
                        when {
                            isOn && isHead -> Color(0xFFFF6975)
                            isOn -> GlyphColors.NeonRed
                            isHead -> Color(0x33FF2E3B)
                            else -> Color(0x22111116)
                        }
                    )
                    .border(
                        width = 1.dp,
                        color = if (isOn) GlyphColors.NeonRed else Color(0x22FFFFFF),
                        shape = RoundedCornerShape(6.dp)
                    )
                    .clickable { onStepToggle(i) }
            )
        }
    }
}
