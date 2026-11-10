package com.nothing.glyphstudio.ui.screens

import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.ui.components.GlyphSimulatorView
import com.nothing.glyphstudio.ui.components.LiquidGlassCard
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.random.Random

import com.nothing.glyphstudio.ui.components.NothingBadge

enum class ArcadeGameMode {
    SPIN_THE_BOTTLE,
    REFLEX_TEST
}

enum class ReflexState {
    READY,
    WAITING_RANDOM,
    FLASH_NOW,
    RESULT,
    TOO_EARLY
}

@Composable
fun ArcadeScreen(
    isBoosted: Boolean = false,
    onBack: () -> Unit
) {
    var selectedGame by remember { mutableStateOf(ArcadeGameMode.SPIN_THE_BOTTLE) }

    DisposableEffect(Unit) {
        onDispose {
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
                GlyphController.clear()
                onBack()
            }) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "GLYPH ARCADE",
                    color = GlyphColors.TextWhite,
                    fontSize = 18.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "34 LED HARDWARE MINI-GAMES",
                    color = if (isBoosted) GlyphColors.BoostPlasma else GlyphColors.NeonRed,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            NothingBadge(
                text = if (selectedGame == ArcadeGameMode.SPIN_THE_BOTTLE) "ROULETTE" else "REFLEX",
                isActive = true,
                isBoosted = isBoosted
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Game Mode Tab Switcher
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            GameTabPill(
                title = "БУТЫЛОЧКА / РУЛЕТКА",
                isSelected = selectedGame == ArcadeGameMode.SPIN_THE_BOTTLE,
                isBoosted = isBoosted
            ) {
                GlyphController.clear()
                selectedGame = ArcadeGameMode.SPIN_THE_BOTTLE
            }
            Spacer(modifier = Modifier.width(8.dp))
            GameTabPill(
                title = "GLYPH REFLEX",
                isSelected = selectedGame == ArcadeGameMode.REFLEX_TEST,
                isBoosted = isBoosted
            ) {
                GlyphController.clear()
                selectedGame = ArcadeGameMode.REFLEX_TEST
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Simulator
        GlyphSimulatorView(
            modifier = Modifier
                .fillMaxWidth()
                .height(210.dp),
            isBoosted = isBoosted
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Selected Game View
        when (selectedGame) {
            ArcadeGameMode.SPIN_THE_BOTTLE -> SpinTheBottleGame(isBoosted = isBoosted)
            ArcadeGameMode.REFLEX_TEST -> ReflexGame(isBoosted = isBoosted)
        }

        Spacer(modifier = Modifier.height(30.dp))
    }
}

/**
 * Game 1: Glyph Spin the Bottle / Roulette (Световая бутылочка).
 * One single LED pixel spins around all glyph segments with physics deceleration friction.
 */
@Composable
private fun SpinTheBottleGame(isBoosted: Boolean = false) {
    val coroutineScope = rememberCoroutineScope()
    var spinJob by remember { mutableStateOf<Job?>(null) }
    var isSpinning by remember { mutableStateOf(false) }
    var winnerSegment by remember { mutableIntStateOf(-1) }
    var statusText by remember { mutableStateOf("Нажмите «КРУТИТЬ», чтобы запустить световой пиксель") }

    fun startSpin() {
        if (isSpinning) return
        isSpinning = true
        winnerSegment = -1
        statusText = "Пиксель вращается... Замедление!"

        spinJob?.cancel()
        spinJob = coroutineScope.launch {
            val totalSegments = GlyphController.activeDevice.value.totalSegments
            var currentPos = Random.nextInt(totalSegments)

            // Random initial rotation duration & step count
            val totalSteps = 45 + Random.nextInt(25)
            var currentDelayMs = 25L // initial high speed

            for (step in 0 until totalSteps) {
                currentPos = (currentPos + 1) % totalSegments
                GlyphController.setSinglePixel(currentPos, brightness = 255, trailFade = true)

                // Physics friction / deceleration: delay grows gradually
                val progress = step.toFloat() / totalSteps.toFloat()
                if (progress > 0.5f) {
                    currentDelayMs = (25L + (progress * progress * 320L)).toLong()
                }

                delay(currentDelayMs)
            }

            // Landed!
            winnerSegment = currentPos
            isSpinning = false
            statusText = "Остановка! Сегмент #$winnerSegment"

            // Victory pulse on the winning segment
            for (p in 0 until 4) {
                GlyphController.setSinglePixel(winnerSegment, brightness = 255, trailFade = false)
                delay(160)
                GlyphController.clear()
                delay(120)
            }
            GlyphController.setSinglePixel(winnerSegment, brightness = 255, trailFade = false)
        }
    }

    LiquidGlassCard(
        modifier = Modifier.fillMaxWidth(),
        isBoosted = isBoosted
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "СВЕТОВАЯ БУТЫЛОЧКА",
                color = GlyphColors.TextWhite,
                fontSize = 16.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Один световой пиксель вращается по кругу всех глифов и постепенно останавливается по законам физики трения, указывая на игрока.",
                color = GlyphColors.TextMuted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Big Spin Action Button
            Button(
                onClick = { startSpin() },
                enabled = !isSpinning,
                colors = ButtonDefaults.buttonColors(
                    containerColor = GlyphColors.NeonRed,
                    disabledContainerColor = Color(0x33FF2E3B)
                ),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth(0.75f)
                    .height(52.dp)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, tint = Color.White)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isSpinning) "ВРАЩЕНИЕ..." else "КРУТИТЬ БУТЫЛОЧКУ",
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Status Badge
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0x331A080A))
                    .border(1.dp, Color(0x33FF2E3B), RoundedCornerShape(8.dp))
                .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text(
                    text = statusText,
                    color = if (winnerSegment >= 0) GlyphColors.NeonRed else GlyphColors.TextWhite,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

/**
 * Game 2: Glyph Reflex (Reaction time test with millisecond precision).
 */
@Composable
private fun ReflexGame(isBoosted: Boolean = false) {
    val coroutineScope = rememberCoroutineScope()
    var reflexState by remember { mutableStateOf(ReflexState.READY) }
    var flashStartTime by remember { mutableLongStateOf(0L) }
    var reactionTimeMs by remember { mutableLongStateOf(0L) }
    var bestTimeMs by remember { mutableLongStateOf(0L) }
    var waitJob by remember { mutableStateOf<Job?>(null) }

    fun startTest() {
        reflexState = ReflexState.WAITING_RANDOM
        GlyphController.clear()

        waitJob?.cancel()
        waitJob = coroutineScope.launch {
            // Random wait between 1.5 and 4.2 seconds
            val delayMs = 1500L + Random.nextLong(2700L)
            delay(delayMs)

            // Flash Glyphs + Screen!
            flashStartTime = System.currentTimeMillis()
            reflexState = ReflexState.FLASH_NOW
            GlyphController.setAll(255)
        }
    }

    fun onUserTap() {
        when (reflexState) {
            ReflexState.READY -> {
                startTest()
            }
            ReflexState.WAITING_RANDOM -> {
                // Tapped too early!
                waitJob?.cancel()
                reflexState = ReflexState.TOO_EARLY
                GlyphController.clear()
            }
            ReflexState.FLASH_NOW -> {
                // Success!
                val elapsed = System.currentTimeMillis() - flashStartTime
                reactionTimeMs = elapsed
                if (bestTimeMs == 0L || elapsed < bestTimeMs) {
                    bestTimeMs = elapsed
                }
                reflexState = ReflexState.RESULT
                GlyphController.clear()
            }
            ReflexState.RESULT, ReflexState.TOO_EARLY -> {
                startTest()
            }
        }
    }

    LiquidGlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onUserTap() },
        isActive = reflexState == ReflexState.FLASH_NOW,
        isBoosted = isBoosted
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "GLYPH REFLEX TEST",
                color = GlyphColors.TextWhite,
                fontSize = 16.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Big Interactive Touch Box
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(130.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        when (reflexState) {
                            ReflexState.READY -> Color(0x22111116)
                            ReflexState.WAITING_RANDOM -> Color(0xFF140507)
                            ReflexState.FLASH_NOW -> GlyphColors.NeonRed
                            ReflexState.RESULT -> Color(0x33FF2E3B)
                            ReflexState.TOO_EARLY -> Color(0x33440000)
                        }
                    )
                    .border(
                        2.dp,
                        if (reflexState == ReflexState.FLASH_NOW) Color.White else Color(0x44FF2E3B),
                        RoundedCornerShape(16.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = when (reflexState) {
                            ReflexState.READY -> "НАЖМИТЕ ДЛЯ СТАРТА"
                            ReflexState.WAITING_RANDOM -> "ЖДИТЕ ВСПЫШКИ ГЛИФОВ..."
                            ReflexState.FLASH_NOW -> "ЖМИ СЕЙЧАС!"
                            ReflexState.RESULT -> "$reactionTimeMs МС"
                            ReflexState.TOO_EARLY -> "СЛИШКОМ РАНО!"
                        },
                        color = Color.White,
                        fontSize = if (reflexState == ReflexState.RESULT) 32.sp else 16.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )

                    if (reflexState == ReflexState.RESULT) {
                        Text(
                            text = when {
                                reactionTimeMs < 200 -> "Ранг: Кибер-Ниндзя!"
                                reactionTimeMs < 260 -> "Ранг: Отличная реакция"
                                reactionTimeMs < 340 -> "Ранг: Нормально"
                                else -> "Ранг: Сонная муха :)"
                            },
                            color = GlyphColors.BrightRedGlow,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Best Score
            if (bestTimeMs > 0L) {
                Text(
                    text = "ЛУЧШИЙ РЕКОРД: $bestTimeMs МС",
                    color = GlyphColors.NeonRed,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun GameTabPill(
    title: String,
    isSelected: Boolean,
    isBoosted: Boolean = false,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(
                if (isSelected) {
                    if (isBoosted) GlyphColors.BoostPlasma else GlyphColors.NeonRed
                } else {
                    Color(0x1F222530)
                }
            )
            .border(
                1.dp,
                if (isSelected) Color.Transparent else Color(0x22FFFFFF),
                RoundedCornerShape(10.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
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
