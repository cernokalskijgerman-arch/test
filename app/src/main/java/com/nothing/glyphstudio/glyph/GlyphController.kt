package com.nothing.glyphstudio.glyph

import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log
import com.nothing.ketchum.Common
import com.nothing.ketchum.Glyph
import com.nothing.ketchum.GlyphFrame as KetchumHardwareFrame
import com.nothing.ketchum.GlyphManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.sin
import kotlin.random.Random

/**
 * Diagnostic log item displayed in real-time on the device screen.
 */
data class DiagnosticEntry(
    val timestamp: String,
    val level: String, // "INFO", "SUCCESS", "WARN", "ERROR", "CMD"
    val message: String
)

enum class HardwareConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR
}

/**
 * Central controller bridging the UI simulator with physical Nothing Glyph hardware
 * using the official Nothing Ketchum SDK 2.0.
 */
object GlyphController {
    private const val TAG = "GlyphController"
    private val timeFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault())

    private val _connectionState = MutableStateFlow(HardwareConnectionState.DISCONNECTED)
    val connectionState: StateFlow<HardwareConnectionState> = _connectionState.asStateFlow()

    private val _isHardwareConnected = MutableStateFlow(false)
    val isHardwareConnected: StateFlow<Boolean> = _isHardwareConnected.asStateFlow()

    private val _detectedModel = MutableStateFlow("Определение устройства...")
    val detectedModel: StateFlow<String> = _detectedModel.asStateFlow()

    private val _activeDevice = MutableStateFlow(NothingDevice.PHONE_3A_PRO)
    val activeDevice: StateFlow<NothingDevice> = _activeDevice.asStateFlow()

    private val _currentFrame = MutableStateFlow(GlyphFrame())
    val currentFrame: StateFlow<GlyphFrame> = _currentFrame.asStateFlow()

    private val _statusMessage = MutableStateFlow("Инициализация Glyph SDK...")
    val statusMessage: StateFlow<String> = _statusMessage.asStateFlow()

    private val _activeAnimation = MutableStateFlow<String?>(null)
    val activeAnimation: StateFlow<String?> = _activeAnimation.asStateFlow()

    private val _diagnosticLogs = MutableStateFlow<List<DiagnosticEntry>>(emptyList())
    val diagnosticLogs: StateFlow<List<DiagnosticEntry>> = _diagnosticLogs.asStateFlow()

    private var glyphManager: GlyphManager? = null
    private var animationJob: Job? = null
    private var appContext: Context? = null

    fun log(level: String, message: String) {
        val entry = DiagnosticEntry(
            timestamp = timeFormat.format(Date()),
            level = level,
            message = message
        )
        Log.d(TAG, "[$level] $message")
        val current = _diagnosticLogs.value.toMutableList()
        current.add(0, entry) // Newest at top
        if (current.size > 200) {
            current.removeAt(current.size - 1)
        }
        _diagnosticLogs.value = current
    }

    fun clearLogs() {
        _diagnosticLogs.value = emptyList()
    }

    fun init(context: Context) {
        appContext = context.applicationContext
        _connectionState.value = HardwareConnectionState.CONNECTING
        val model = Build.MODEL
        val brand = Build.BRAND
        log("INFO", "Инициализация контроллера. Устройство: $brand $model")

        // 1. Detect target device model
        detectDeviceModel(context)

        // 2. Initialize official Ketchum GlyphManager
        initKetchumHardware(context.applicationContext)
    }

    private fun detectDeviceModel(context: Context) {
        val model = Build.MODEL.lowercase()
        val is24111 = try { Common.is24111() } catch (e: Throwable) { false }
        val is23111 = try { Common.is23111() } catch (e: Throwable) { false }
        val is22111 = try { Common.is22111() } catch (e: Throwable) { false }
        val is20111 = try { Common.is20111() } catch (e: Throwable) { false }
        val is25111 = try { Common.is25111() } catch (e: Throwable) { false }

        val detectedTarget = when {
            is24111 || model.contains("3a") || model.contains("a059") -> NothingDevice.PHONE_3A_PRO
            is23111 || model.contains("2a") || model.contains("a142") -> NothingDevice.PHONE_2A
            is22111 || model.contains("pong") || model.contains("phone (2)") || model.contains("a065") -> NothingDevice.PHONE_2
            is20111 || model.contains("spacewar") || model.contains("phone (1)") || model.contains("a063") -> NothingDevice.PHONE_1
            else -> NothingDevice.PHONE_3A_PRO
        }

        _activeDevice.value = detectedTarget
        _detectedModel.value = "${detectedTarget.displayName} [${detectedTarget.deviceCode}]"
        log("INFO", "Определена модель: ${detectedTarget.displayName} (код: ${detectedTarget.deviceCode}, светодиодов: ${detectedTarget.totalSegments})")

        val sdkAvailable = try { Common.isSDKAvaliable(context) } catch (e: Throwable) { false }
        val sdkVersion = try { Common.getSDKVersion() } catch (e: Throwable) { 0 }
        log("INFO", "SDK доступен: $sdkAvailable, версия SDK: $sdkVersion")
    }

    private fun initKetchumHardware(context: Context) {
        try {
            log("INFO", "Создание экземпляра GlyphManager.getInstance()...")
            val manager = GlyphManager.getInstance(context)
            if (manager == null) {
                log("ERROR", "GlyphManager.getInstance() вернул null!")
                _connectionState.value = HardwareConnectionState.ERROR
                _statusMessage.value = "Ошибка: GlyphManager недоступен"
                return
            }
            glyphManager = manager

            val callback = object : GlyphManager.Callback {
                override fun onServiceConnected(componentName: ComponentName?) {
                    log("SUCCESS", "onServiceConnected: Glyph Service подключен (${componentName?.flattenToShortString()})")
                    registerAndOpenSession()
                }

                override fun onServiceDisconnected(componentName: ComponentName?) {
                    log("WARN", "onServiceDisconnected: Glyph Service отключен")
                    _connectionState.value = HardwareConnectionState.DISCONNECTED
                    _isHardwareConnected.value = false
                    _statusMessage.value = "Glyph Service отключен"
                    try {
                        glyphManager?.closeSession()
                    } catch (ignored: Throwable) {}
                }
            }

            log("INFO", "Вызов GlyphManager.init(callback)...")
            manager.init(callback)
            _statusMessage.value = "Ожидание подключения Nothing Glyph Service..."
        } catch (e: Throwable) {
            log("ERROR", "Исключение при GlyphManager.init: ${e.javaClass.simpleName} - ${e.message}")
            _connectionState.value = HardwareConnectionState.ERROR
            _isHardwareConnected.value = false
            _statusMessage.value = "Режим симулятора: ${e.message}"
        }
    }

    private fun registerAndOpenSession() {
        val manager = glyphManager ?: return
        val targetCode = _activeDevice.value.deviceCode

        try {
            log("INFO", "Вызов mGM.register('$targetCode')...")
            var registered = false
            try {
                registered = manager.register(targetCode)
                log("INFO", "Результат mGM.register('$targetCode'): $registered")
            } catch (e: Throwable) {
                log("WARN", "mGM.register('$targetCode') выбросил: ${e.message}")
            }

            if (!registered) {
                log("WARN", "Попытка register() без параметров...")
                try {
                    registered = manager.register()
                    log("INFO", "Результат mGM.register(): $registered")
                } catch (e: Throwable) {
                    log("WARN", "mGM.register() выбросил: ${e.message}")
                }
            }

            // Open Session
            log("INFO", "Вызов mGM.openSession()...")
            manager.openSession()
            log("SUCCESS", "mGM.openSession() выполнен успешно!")

            _connectionState.value = HardwareConnectionState.CONNECTED
            _isHardwareConnected.value = true
            _statusMessage.value = "Подключено к Glyph Service (${_activeDevice.value.displayName})"
            log("SUCCESS", "Физические глифы готовы к управлению!")

            // Pulse victory confirmation
            turnAllOn(brightness = 180)
            CoroutineScope(Dispatchers.Default).launch {
                delay(200)
                turnAllOff()
            }
        } catch (e: Throwable) {
            log("ERROR", "Ошибка регистрации Glyph сессии: ${e.javaClass.simpleName} - ${e.message}")
            _connectionState.value = HardwareConnectionState.ERROR
            _isHardwareConnected.value = false
            _statusMessage.value = "Ошибка сессии: ${e.message}"
        }
    }

    fun reconnect(context: Context) {
        log("CMD", "Переподключение Glyph SDK...")
        stopAllAnimations()
        try {
            glyphManager?.closeSession()
            glyphManager?.unInit()
        } catch (ignored: Throwable) {}
        glyphManager = null
        init(context)
    }

    fun updateFrame(frame: GlyphFrame) {
        _currentFrame.value = frame

        val manager = glyphManager ?: return
        if (_connectionState.value != HardwareConnectionState.CONNECTED) return

        try {
            val isAllOff = frame.segmentBrightness.all { it <= 0 }
            if (isAllOff) {
                try {
                    manager.turnOff()
                } catch (e: Throwable) {
                    log("ERROR", "mGM.turnOff error: ${e.message}")
                }
                return
            }

            val builder = manager.glyphFrameBuilder
            for (i in frame.segmentBrightness.indices) {
                val b = frame.segmentBrightness[i]
                if (b > 0) {
                    builder.buildChannel(i, b)
                }
            }
            val hwFrame = builder.build()
            manager.toggle(hwFrame)
        } catch (e: Throwable) {
            log("ERROR", "Ошибка отправки фрейма на глифы: ${e.message}")
        }
    }

    fun turnAllOn(brightness: Int = 255) {
        stopAllAnimations()
        val total = _activeDevice.value.totalSegments
        val array = IntArray(total) { brightness.coerceIn(0, 255) }
        updateFrame(GlyphFrame(segmentBrightness = array))
        log("CMD", "ВКЛ ВСЕ (яркость: $brightness)")
    }

    fun turnAllOff() {
        stopAllAnimations()
        clear()
        log("CMD", "ВЫКЛ ВСЕ")
    }

    fun setZoneState(zoneIndex: Int, enabled: Boolean, brightness: Int = 255) {
        stopAllAnimations()
        val current = _currentFrame.value.segmentBrightness.copyOf()
        val channels: IntRange = when (zoneIndex) {
            0 -> Phone3aProLayout.ZONE_A_CHANNELS // Top-Left (20..30)
            1 -> Phone3aProLayout.ZONE_B_CHANNELS // Bottom-Left (31..35)
            2 -> Phone3aProLayout.ZONE_C_CHANNELS // Right Arc (0..19)
            else -> return
        }
        val b = if (enabled) brightness.coerceIn(0, 255) else 0
        for (ch in channels) {
            if (ch in current.indices) {
                current[ch] = b
            }
        }
        updateFrame(GlyphFrame(segmentBrightness = current))
        val zoneName = when (zoneIndex) {
            0 -> "Дуга 1 (Верх-Лево, 11 LEDs)"
            1 -> "Дуга 2 (Низ-Лево, 5 LEDs)"
            2 -> "Дуга 3 (Справа, 20 LEDs)"
            else -> "Зона $zoneIndex"
        }
        log("CMD", "$zoneName -> ${if (enabled) "ВКЛ" else "ВЫКЛ"} (яркость $b)")
    }

    fun setSingleChannel(channelIndex: Int, brightness: Int = 255) {
        stopAllAnimations()
        val total = _activeDevice.value.totalSegments
        val array = IntArray(total)
        if (channelIndex in 0 until total) {
            array[channelIndex] = brightness.coerceIn(0, 255)
        }
        updateFrame(GlyphFrame(segmentBrightness = array))
        log("CMD", "Одиночный канал #$channelIndex (яркость $brightness)")
    }

    fun setSinglePixel(pixelIndex: Int, brightness: Int = 255, trailFade: Boolean = true) {
        val total = _activeDevice.value.totalSegments
        val norm = ((pixelIndex % total) + total) % total
        val array = IntArray(total)
        array[norm] = brightness.coerceIn(0, 255)

        if (trailFade) {
            val prev1 = ((norm - 1) % total + total) % total
            val prev2 = ((norm - 2) % total + total) % total
            array[prev1] = (brightness * 0.40f).toInt()
            array[prev2] = (brightness * 0.12f).toInt()
        }

        updateFrame(GlyphFrame(segmentBrightness = array))
    }

    fun setBrightness(segmentIndex: Int, brightness: Int) {
        val current = _currentFrame.value.segmentBrightness.copyOf()
        if (segmentIndex in current.indices) {
            current[segmentIndex] = brightness.coerceIn(0, 255)
            updateFrame(GlyphFrame(segmentBrightness = current))
        }
    }

    fun clear() {
        val total = _activeDevice.value.totalSegments
        _currentFrame.value = GlyphFrame(segmentBrightness = IntArray(total))
        try {
            glyphManager?.turnOff()
        } catch (ignored: Throwable) {}
    }

    fun setDevice(device: NothingDevice) {
        _activeDevice.value = device
        clear()
    }

    fun setAll(brightness: Int) {
        turnAllOn(brightness)
    }

    fun setProgress(progress: Float) {
        val total = _activeDevice.value.totalSegments
        val litCount = (progress.coerceIn(0f, 1f) * total).toInt()
        val array = IntArray(total)

        for (i in 0 until total) {
            if (i < litCount) {
                array[i] = 255
            } else if (i == litCount) {
                val remainder = (progress * total) - litCount
                array[i] = (remainder * 255).toInt()
            }
        }
        updateFrame(GlyphFrame(segmentBrightness = array))
    }

    // ==========================================
    // TEST ANIMATIONS (ТЕСТОВЫЕ АНИМАЦИИ)
    // ==========================================

    fun startStrobe(scope: CoroutineScope, frequencyHz: Int = 10) {
        stopAllAnimations()
        _activeAnimation.value = "STROBE"
        val halfPeriodMs = (1000L / (frequencyHz * 2)).coerceAtLeast(25L)
        log("CMD", "⚡ Старт стробоскопа: $frequencyHz Гц (пульсация каждые ${halfPeriodMs}мс)")

        animationJob = scope.launch(Dispatchers.Default) {
            var on = false
            val total = _activeDevice.value.totalSegments
            while (isActive) {
                on = !on
                val b = if (on) 255 else 0
                val array = IntArray(total) { b }
                updateFrame(GlyphFrame(segmentBrightness = array))
                delay(halfPeriodMs)
            }
        }
    }

    fun stopStrobe() {
        if (_activeAnimation.value == "STROBE") {
            stopAllAnimations()
            log("CMD", "⚡ Стробоскоп остановлен")
        }
    }

    fun startSmoothBreathing(scope: CoroutineScope) {
        stopAllAnimations()
        _activeAnimation.value = "BREATHING"
        log("CMD", "🌊 Старт плавного дыхания (синусоидальное свечение)")

        animationJob = scope.launch(Dispatchers.Default) {
            val total = _activeDevice.value.totalSegments
            var angle = 0.0
            while (isActive) {
                val norm = (sin(angle) + 1.0) / 2.0 // 0.0 .. 1.0
                val brightness = (norm * 255).toInt().coerceIn(0, 255)
                val array = IntArray(total) { brightness }
                updateFrame(GlyphFrame(segmentBrightness = array))
                angle += 0.08
                delay(20L)
            }
        }
    }

    fun stopSmoothBreathing() {
        if (_activeAnimation.value == "BREATHING") {
            stopAllAnimations()
            log("CMD", "🌊 Плавное дыхание остановлено")
        }
    }

    fun startBottleRoulette(scope: CoroutineScope, onStop: ((Int) -> Unit)? = null) {
        stopAllAnimations()
        _activeAnimation.value = "BOTTLE"
        log("CMD", "🍾 Старт «Световой бутылочки» (круговое вращение с физикой трения)")

        animationJob = scope.launch(Dispatchers.Default) {
            val total = _activeDevice.value.totalSegments
            var currentPos = Random.nextInt(total)
            val totalSteps = 45 + Random.nextInt(25)
            var currentDelayMs = 25L

            for (step in 0 until totalSteps) {
                if (!isActive) break
                currentPos = (currentPos + 1) % total
                setSinglePixel(currentPos, brightness = 255, trailFade = true)

                val progress = step.toFloat() / totalSteps.toFloat()
                if (progress > 0.45f) {
                    // Physics friction deceleration
                    currentDelayMs = (25L + (progress * progress * 320L)).toLong()
                }
                delay(currentDelayMs)
            }

            val winner = currentPos
            log("SUCCESS", "🍾 Световая бутылочка остановилась: сегмент #$winner")

            // Victory pulse
            for (i in 0 until 4) {
                if (!isActive) break
                setSinglePixel(winner, brightness = 255, trailFade = false)
                delay(150L)
                clear()
                delay(120L)
            }
            setSinglePixel(winner, brightness = 255, trailFade = false)
            _activeAnimation.value = null
            onStop?.invoke(winner)
        }
    }

    fun stopBottleRoulette() {
        if (_activeAnimation.value == "BOTTLE") {
            stopAllAnimations()
            log("CMD", "🍾 Световая бутылочка остановлена")
        }
    }

    fun startAutoWalk(scope: CoroutineScope, intervalMs: Long = 100L) {
        stopAllAnimations()
        _activeAnimation.value = "AUTO_WALK"
        log("CMD", "▶ Старт авто-обхода (бегущий свет по всем 36 светодиодам)")

        animationJob = scope.launch(Dispatchers.Default) {
            val total = _activeDevice.value.totalSegments
            var pos = 0
            while (isActive) {
                setSinglePixel(pos, brightness = 255, trailFade = false)
                pos = (pos + 1) % total
                delay(intervalMs)
            }
        }
    }

    fun stopAutoWalk() {
        if (_activeAnimation.value == "AUTO_WALK") {
            stopAllAnimations()
            log("CMD", "▶ Авто-обход остановлен")
        }
    }

    fun stopAllAnimations() {
        animationJob?.cancel()
        animationJob = null
        _activeAnimation.value = null
        clear()
    }
}
