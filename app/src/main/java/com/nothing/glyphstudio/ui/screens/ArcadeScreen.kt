package com.nothing.glyphstudio.ui.screens

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.SoundEffectConstants
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.glyph.GlyphFrame
import com.nothing.glyphstudio.theme.GlyphColors
import com.nothing.glyphstudio.ui.components.GlyphSimulatorView
import com.nothing.glyphstudio.ui.components.LiquidGlassCard
import com.nothing.glyphstudio.ui.components.NothingBadge
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.random.Random

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
    val context = LocalContext.current
    var selectedGame by remember { mutableStateOf(ArcadeGameMode.SPIN_THE_BOTTLE) }
    val activeDevice by GlyphController.activeDevice.collectAsState()

    DisposableEffect(Unit) {
        onDispose {
            GlyphController.stopAllAnimations(resetFrame = true)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GlyphColors.AmoledBlack)
            .padding(horizontal = 16.dp, vertical = 12.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Top Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                GlyphController.stopAllAnimations(resetFrame = true)
                onBack()
            }) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = Color.White)
            }
            Spacer(modifier = Modifier.width(6.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "GLYPH ARCADE",
                    color = GlyphColors.TextWhite,
                    fontSize = 18.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.2.sp
                )
                Text(
                    text = "PHYSICAL HARDWARE GAMES • ${activeDevice.displayName.uppercase()}",
                    color = GlyphColors.TextMuted,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
            NothingBadge(
                text = if (selectedGame == ArcadeGameMode.SPIN_THE_BOTTLE) "ROULETTE" else "REFLEX",
                isActive = true
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Game Mode Tab Switcher in Liquid Glass
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            GameTabPill(
                title = "БУТЫЛОЧКА / РУЛЕТКА",
                isSelected = selectedGame == ArcadeGameMode.SPIN_THE_BOTTLE
            ) {
                GlyphController.stopAllAnimations(resetFrame = true)
                selectedGame = ArcadeGameMode.SPIN_THE_BOTTLE
            }
            Spacer(modifier = Modifier.width(8.dp))
            GameTabPill(
                title = "GLYPH REFLEX",
                isSelected = selectedGame == ArcadeGameMode.REFLEX_TEST
            ) {
                GlyphController.stopAllAnimations(resetFrame = true)
                selectedGame = ArcadeGameMode.REFLEX_TEST
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Live 2D Simulator (Ice-White LEDs)
        GlyphSimulatorView(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Selected Game View
        when (selectedGame) {
            ArcadeGameMode.SPIN_THE_BOTTLE -> SpinTheBottleGame()
            ArcadeGameMode.REFLEX_TEST -> ReflexGame()
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

/**
 * Game 1: "Световая бутылочка" (Spin the bottle / Hardware Glyph Roulette).
 * Features authentic physics friction deceleration, synchronized LED tracking around the camera,
 * tactile haptic and audio clicking on each step, and directional sector winner detection.
 */
@Composable
private fun SpinTheBottleGame() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val activeDevice by GlyphController.activeDevice.collectAsState()

    var isSpinning by remember { mutableStateOf(false) }
    var isTargetMode by remember { mutableStateOf(false) }
    var targetClockAngle by remember { mutableFloatStateOf(0f) } // Default 0° = North
    var currentSector by remember { mutableStateOf("") }
    var currentDirection by remember { mutableStateOf("") }
    var currentChannel by remember { mutableIntStateOf(-1) }
    var winnerChannel by remember { mutableIntStateOf(-1) }
    var winnerSector by remember { mutableStateOf("") }
    var winnerDirection by remember { mutableStateOf("") }
    var spinCount by remember { mutableIntStateOf(0) }
    var isTurboSpeed by remember { mutableStateOf(false) }

    // Haptics & Audio Feedback
    val toneGenerator = remember {
        try {
            ToneGenerator(AudioManager.STREAM_MUSIC, 70)
        } catch (e: Throwable) {
            null
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            try {
                toneGenerator?.release()
            } catch (ignored: Throwable) {}
        }
    }

    val vibrator = remember {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
        } catch (e: Throwable) {
            null
        }
    }

    val audioManager = remember {
        try {
            context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        } catch (e: Throwable) {
            null
        }
    }

    fun playStepTick(delayMs: Long) {
        // Primary crisp mechanical tick via STREAM_MUSIC (always audible)
        try {
            toneGenerator?.startTone(ToneGenerator.TONE_CDMA_KEYPAD_VOLUME_KEY_LITE, 12)
        } catch (ignored: Throwable) {}

        // Fallback to system audio click
        try {
            audioManager?.playSoundEffect(SoundEffectConstants.CLICK, 0.6f)
        } catch (ignored: Throwable) {}

        // Tactile vibration
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                vibrator?.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(6)
            }
        } catch (ignored: Throwable) {}
    }

    fun playVictoryBurst() {
        try {
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_ACK, 220)
        } catch (ignored: Throwable) {}

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val timings = longArrayOf(0, 100, 60, 100, 60, 220)
                val amplitudes = intArrayOf(0, 200, 0, 220, 0, 255)
                vibrator?.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(300)
            }
        } catch (ignored: Throwable) {}
    }

    fun startSpin() {
        if (isSpinning) return
        isSpinning = true
        winnerChannel = -1
        winnerSector = ""
        winnerDirection = ""
        spinCount++

        val seq = GlyphController.getCircularSequence(activeDevice)
        if (seq.isEmpty()) return

        val targetCh = if (isTargetMode) {
            GlyphController.getClosestChannelForAngle(activeDevice, targetClockAngle)
        } else {
            null
        }

        GlyphController.startBottleRoulette(
            scope = coroutineScope,
            targetChannel = targetCh,
            onStep = { ch, delayMs, step, totalSteps ->
                currentChannel = ch
                currentSector = GlyphController.getSectorName(activeDevice, ch)
                currentDirection = GlyphController.getSectorDirection(activeDevice, ch)

                // Only tick audibly when decelerating or at distinct intervals
                if (delayMs > 30L || step % 2 == 0) {
                    playStepTick(delayMs)
                }
            },
            onStop = { winner ->
                winnerChannel = winner
                winnerSector = GlyphController.getSectorName(activeDevice, winner)
                winnerDirection = GlyphController.getSectorDirection(activeDevice, winner)
                isSpinning = false
                playVictoryBurst()
            }
        )
    }

    fun stopSpin() {
        GlyphController.stopBottleRoulette()
        isSpinning = false
    }

    LiquidGlassCard(
        modifier = Modifier.fillMaxWidth(),
        isActive = isSpinning || winnerChannel >= 0
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "СВЕТОВАЯ БУТЫЛОЧКА",
                        color = GlyphColors.TextWhite,
                        fontSize = 15.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "Круговое аппаратное вращение светового луча",
                        color = GlyphColors.TextMuted,
                        fontSize = 11.sp
                    )
                }

                NothingBadge(
                    text = if (isSpinning) "ВРАЩЕНИЕ" else if (winnerChannel >= 0) "СТОП" else "ГОТОВО",
                    isActive = isSpinning || winnerChannel >= 0
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Main Interactive Live Display
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0x800B0D14))
                    .border(1.dp, if (winnerChannel >= 0) Color(0xB3FFFFFF) else Color(0x2EFFFFFF), RoundedCornerShape(16.dp))
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    when {
                        isSpinning -> {
                            Text(
                                text = "ЛУЧ ВРАЩАЕТСЯ...",
                                color = GlyphColors.TextWhite,
                                fontSize = 16.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "LED #$currentChannel • $currentSector",
                                color = Color(0xFFD5EEFF),
                                fontSize = 13.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = currentDirection,
                                color = GlyphColors.TextMuted,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                        winnerChannel >= 0 -> {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(Color.White)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "ВЫБРАН ИГРОК!",
                                    color = Color.White,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = winnerSector,
                                color = Color.White,
                                fontSize = 18.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Указывает: $winnerDirection (LED #$winnerChannel)",
                                color = Color(0xFFD5EEFF),
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        else -> {
                            Text(
                                text = "ПОЛОЖИТЕ СМАРТФОН В ЦЕНТР СТОЛА",
                                color = GlyphColors.TextWhite,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Нажмите «КРУТИТЬ», чтобы запустить световой луч по кругу спинки",
                                color = GlyphColors.TextMuted,
                                fontSize = 11.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Spin Mode Switcher: Random vs Targeted Sector
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (!isTargetMode) Color.White else Color(0x1FFFFFFF))
                        .clickable(enabled = !isSpinning) { isTargetMode = false }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "🎲 СЛУЧАЙНЫЙ СЕКТОР",
                        color = if (!isTargetMode) Color.Black else GlyphColors.TextMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isTargetMode) Color.White else Color(0x1FFFFFFF))
                        .clickable(enabled = !isSpinning) { isTargetMode = true }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "🎯 ВЫБРАННЫЙ СЕКТОР",
                        color = if (isTargetMode) Color.Black else GlyphColors.TextMuted,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Target Direction Chips (Visible when in Target Mode)
            if (isTargetMode) {
                Spacer(modifier = Modifier.height(10.dp))
                val cardinalDirections = listOf(
                    "СЕВЕР ⬆" to 0f,
                    "СВ ↗" to 45f,
                    "ВОСТОК ➡" to 90f,
                    "ЮВ ↘" to 135f,
                    "ЮГ ⬇" to 180f,
                    "ЮЗ ↙" to 225f,
                    "ЗАПАД ⬅" to 270f,
                    "СЗ ↖" to 315f
                )
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        cardinalDirections.take(4).forEach { (dirLabel, angle) ->
                            val isSelected = targetClockAngle == angle
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) Color(0x40FFFFFF) else Color(0x14FFFFFF))
                                    .border(1.dp, if (isSelected) Color.White else Color(0x22FFFFFF), RoundedCornerShape(8.dp))
                                    .clickable(enabled = !isSpinning) {
                                        targetClockAngle = angle
                                        val previewCh = GlyphController.getClosestChannelForAngle(activeDevice, angle)
                                        GlyphController.setSinglePixel(previewCh, 255, trailFade = false)
                                    }
                                    .padding(vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = dirLabel,
                                    color = if (isSelected) Color.White else GlyphColors.TextMuted,
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        cardinalDirections.drop(4).forEach { (dirLabel, angle) ->
                            val isSelected = targetClockAngle == angle
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) Color(0x40FFFFFF) else Color(0x14FFFFFF))
                                    .border(1.dp, if (isSelected) Color.White else Color(0x22FFFFFF), RoundedCornerShape(8.dp))
                                    .clickable(enabled = !isSpinning) {
                                        targetClockAngle = angle
                                        val previewCh = GlyphController.getClosestChannelForAngle(activeDevice, angle)
                                        GlyphController.setSinglePixel(previewCh, 255, trailFade = false)
                                    }
                                    .padding(vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = dirLabel,
                                    color = if (isSelected) Color.White else GlyphColors.TextMuted,
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Action Buttons Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Primary Spin Button
                Button(
                    onClick = { startSpin() },
                    enabled = !isSpinning,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.White,
                        contentColor = Color.Black,
                        disabledContainerColor = Color(0x33FFFFFF),
                        disabledContentColor = Color(0x66FFFFFF)
                    ),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (isSpinning) "ВРАЩАЕТСЯ..." else "КРУТИТЬ БУТЫЛОЧКУ",
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Stop Button (visible while spinning)
                if (isSpinning) {
                    Button(
                        onClick = { stopSpin() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0x26FFFFFF),
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.height(50.dp)
                    ) {
                        Icon(Icons.Default.Stop, contentDescription = "Стоп", modifier = Modifier.size(18.dp))
                    }
                }
            }

            if (spinCount > 0) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "РАУНД #$spinCount • ГЛИФЫ ПОДТВЕРЖДЕНЫ",
                    color = GlyphColors.TextDim,
                    fontSize = 9.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

/**
 * Game 2: Glyph Reflex (Reaction time test with millisecond precision).
 * Minimalist Black-and-White Liquid Glass with full hardware flash.
 */
@Composable
private fun ReflexGame() {
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
            // Random wait between 1.6 and 4.0 seconds
            val delayMs = 1600L + Random.nextLong(2400L)
            delay(delayMs)

            // Flash Glyphs + Screen simultaneously!
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
        isActive = reflexState == ReflexState.FLASH_NOW
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "GLYPH REFLEX TEST",
                    color = GlyphColors.TextWhite,
                    fontSize = 15.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                if (bestTimeMs > 0L) {
                    NothingBadge(text = "РЕКОРД: $bestTimeMs МС", isActive = true)
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Big Interactive Touch Box
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(130.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        when (reflexState) {
                            ReflexState.READY -> Color(0x6610131E)
                            ReflexState.WAITING_RANDOM -> Color(0x990A0B10)
                            ReflexState.FLASH_NOW -> Color.White
                            ReflexState.RESULT -> Color(0x4D1B2233)
                            ReflexState.TOO_EARLY -> Color(0x4D2A1215)
                        }
                    )
                    .border(
                        1.5.dp,
                        if (reflexState == ReflexState.FLASH_NOW) Color.White else Color(0x33FFFFFF),
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
                        color = if (reflexState == ReflexState.FLASH_NOW) Color.Black else Color.White,
                        fontSize = if (reflexState == ReflexState.RESULT) 32.sp else 15.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )

                    if (reflexState == ReflexState.RESULT) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = when {
                                reactionTimeMs < 200 -> "Ранг: Кибер-Ниндзя (Невероятно!)"
                                reactionTimeMs < 260 -> "Ранг: Отличная реакция"
                                reactionTimeMs < 340 -> "Ранг: Хорошо"
                                else -> "Ранг: Спокойный темп"
                            },
                            color = Color(0xFFD5EEFF),
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "Коснитесь экрана в любой момент для повторного старта",
                color = GlyphColors.TextDim,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}

@Composable
private fun GameTabPill(
    title: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(
                if (isSelected) Color.White else Color(0x1F222530)
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
            color = if (isSelected) Color.Black else Color.Gray,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold
        )
    }
}
