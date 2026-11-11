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

        val sdkAvailable = try {
            val m = Common::class.java.getDeclaredMethod("isSDKAvaliable", Context::class.java)
            m.isAccessible = true
            m.invoke(null, context) as? Boolean ?: true
        } catch (e: Throwable) {
            true
        }
        val sdkVersion = try {
            val m = Common::class.java.getDeclaredMethod("getSDKVersion")
            m.isAccessible = true
            m.invoke(null) as? Int ?: 140101
        } catch (e: Throwable) {
            140101
        }
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
                // If specific hardware code failed, try registering with Build.MODEL
                log("WARN", "Попытка register('${Build.MODEL}')...")
                try {
                    registered = manager.register(Build.MODEL)
                    log("INFO", "Результат mGM.register('${Build.MODEL}'): $registered")
                } catch (e: Throwable) {
                    log("WARN", "mGM.register('${Build.MODEL}') выбросил: ${e.message}")
                }
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
            try {
                manager.openSession()
                log("SUCCESS", "mGM.openSession() выполнен успешно!")
            } catch (e: Throwable) {
                if (e.message?.contains("already", ignoreCase = true) == true) {
                    log("INFO", "Сессия уже открыта: ${e.message}")
                } else {
                    throw e
                }
            }

            _connectionState.value = HardwareConnectionState.CONNECTED
            _isHardwareConnected.value = true
            _statusMessage.value = "Подключено к Glyph Service (${_activeDevice.value.displayName})"
            log("SUCCESS", "Физические глифы готовы к управлению!")

            // Gentle connection confirmation flash (150ms) that does not disrupt user state
            val total = _activeDevice.value.totalSegments
            updateFrame(GlyphFrame(segmentBrightness = IntArray(total) { 150 }))
            CoroutineScope(Dispatchers.Default).launch {
                delay(150)
                if (_activeAnimation.value == null && _currentFrame.value.segmentBrightness.all { it == 150 }) {
                    updateFrame(GlyphFrame(segmentBrightness = IntArray(total)))
                }
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
        stopAllAnimations(resetFrame = true)
        try {
            glyphManager?.closeSession()
            glyphManager?.unInit()
        } catch (ignored: Throwable) {}
        glyphManager = null
        init(context)
    }

    /**
     * Scales standard 8-bit UI brightness (0..255) to Nothing Ketchum hardware 12-bit channel brightness (0..4095).
     * In Nothing Ketchum SDK:
     * - DEFAULT_MAX_LIGHT = 4096 / MAX_BRIGHTNESS = 4095
     * - DEFAULT_LIGHT = 4000
     * Raw 0..255 was lighting the LEDs at only ~6% power ("в пол силы").
     * Scaling ensures 255 drives full 4095 brightness on physical hardware.
     */
    fun toHardwareBrightness(brightness: Int): Int {
        if (brightness <= 0) return 0
        if (brightness >= 255) return 4095
        return (brightness * 4095 + 127) / 255
    }

    private fun createHardwareBuilder(targetDeviceCode: String, requiredChannels: Int): KetchumHardwareFrame.Builder {
        val manager = glyphManager
        val builder = try {
            KetchumHardwareFrame.Builder(targetDeviceCode)
        } catch (e: Throwable) {
            manager?.getGlyphFrameBuilder() ?: KetchumHardwareFrame.Builder()
        }

        // Defensive reflection check: verify channel list capacity and dynamically expand if necessary
        try {
            val f = builder.javaClass.getDeclaredField("channel").apply { isAccessible = true }
            @Suppress("UNCHECKED_CAST")
            val channelList = f.get(builder) as? java.util.ArrayList<Int?>
            if (channelList != null && channelList.size < requiredChannels) {
                while (channelList.size < requiredChannels) {
                    channelList.add(0)
                }
            }
        } catch (e: Throwable) {
            log("WARN", "createHardwareBuilder reflection check: ${e.message}")
        }

        return builder
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

            val targetDeviceCode = _activeDevice.value.deviceCode
            val builder = createHardwareBuilder(targetDeviceCode, frame.segmentBrightness.size)

            for (i in frame.segmentBrightness.indices) {
                try {
                    val hwLight = toHardwareBrightness(frame.segmentBrightness[i])
                    builder.buildChannel(i, hwLight)
                } catch (e: Throwable) {
                    log("WARN", "buildChannel($i) failed: ${e.message}")
                }
            }
            val hwFrame = builder.build()
            manager.toggle(hwFrame)
        } catch (e: Throwable) {
            log("ERROR", "Ошибка отправки фрейма на глифы: ${e.message}")
        }
    }

    fun turnAllOn(brightness: Int = 255) {
        stopAllAnimations(resetFrame = false)
        val total = _activeDevice.value.totalSegments
        val array = IntArray(total) { brightness.coerceIn(0, 255) }
        updateFrame(GlyphFrame(segmentBrightness = array))
        log("CMD", "ВКЛ ВСЕ (яркость: $brightness)")
    }

    fun turnAllOff() {
        stopAllAnimations(resetFrame = true)
        log("CMD", "ВЫКЛ ВСЕ")
    }

    fun setZoneState(zoneIndex: Int, enabled: Boolean, brightness: Int = 255) {
        if (_activeAnimation.value != null) {
            stopAllAnimations(resetFrame = false)
        }
        val device = _activeDevice.value
        val current = _currentFrame.value.segmentBrightness.copyOf()
        val channels = getZoneChannels(device, zoneIndex)
        val b = if (enabled) brightness.coerceIn(0, 255) else 0
        for (ch in channels) {
            if (ch in current.indices) {
                current[ch] = b
            }
        }
        updateFrame(GlyphFrame(segmentBrightness = current))
        val zoneName = getZoneName(device, zoneIndex)
        log("CMD", "$zoneName -> ${if (enabled) "ВКЛ" else "ВЫКЛ"} (яркость $b)")
    }

    fun setSingleChannel(channelIndex: Int, brightness: Int = 255) {
        if (_activeAnimation.value != null) {
            stopAllAnimations(resetFrame = false)
        }
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
        switchDevice(device)
    }

    fun switchDevice(device: NothingDevice) {
        stopAllAnimations(resetFrame = true)
        _activeDevice.value = device
        _detectedModel.value = "${device.displayName} [${device.deviceCode}]"
        log("CMD", "Переключение модели устройства: ${device.displayName} (${device.deviceCode})")
        val manager = glyphManager
        if (manager != null) {
            try {
                manager.closeSession()
            } catch (ignored: Throwable) {}
            registerAndOpenSession()
        }
    }

    fun getZoneChannels(device: NothingDevice, zoneIndex: Int): IntArray {
        return when (device) {
            NothingDevice.PHONE_3A_PRO -> when (zoneIndex) {
                0 -> Phone3aProLayout.ZONE_TOP_LEFT_CHANNELS.toList().toIntArray()     // Дуга 1: Верх-Лево (20 LEDs, #0..19)
                1 -> Phone3aProLayout.ZONE_BOTTOM_LEFT_CHANNELS.toList().toIntArray()  // Дуга 2: Низ-Лево (5 LEDs, #31..35)
                2 -> Phone3aProLayout.ZONE_RIGHT_CHANNELS.toList().toIntArray()        // Дуга 3: Справа (11 LEDs, #20..30)
                else -> intArrayOf()
            }
            NothingDevice.PHONE_2A -> when (zoneIndex) {
                0 -> intArrayOf(25)                 // Top-Left (1 LED)
                1 -> intArrayOf(24)                 // Bottom-Left (1 LED)
                2 -> (0..23).toList().toIntArray()  // Right Arc (24 LEDs)
                else -> intArrayOf()
            }
            NothingDevice.PHONE_2 -> when (zoneIndex) {
                0 -> intArrayOf(0, 1)               // Top Arcs
                1 -> intArrayOf(2, 3, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32)
                2 -> (4..19).toList().toIntArray()  // Progress Center Ring (16 LEDs)
                else -> intArrayOf()
            }
            NothingDevice.PHONE_1 -> when (zoneIndex) {
                0 -> (0..4).toList().toIntArray()   // Top Diagonal & Camera ring
                1 -> (5..7).toList().toIntArray()   // Bottom Strip & Dot
                2 -> (8..15).toList().toIntArray()  // Center C Ring
                else -> intArrayOf()
            }
        }
    }

    fun getZoneName(device: NothingDevice, zoneIndex: Int): String {
        return when (device) {
            NothingDevice.PHONE_3A_PRO -> when (zoneIndex) {
                0 -> "Дуга 1: Верх-Лево (20 LEDs, #0..19)"
                1 -> "Дуга 2: Низ-Лево (5 LEDs, #31..35)"
                2 -> "Дуга 3: Справа (11 LEDs, #20..30)"
                else -> "Зона $zoneIndex"
            }
            NothingDevice.PHONE_2A -> when (zoneIndex) {
                0 -> "Зона A: Верх-Лево (1 LED, #25)"
                1 -> "Зона B: Низ-Лево (1 LED, #24)"
                2 -> "Зона C: Справа (24 LEDs, #0..23)"
                else -> "Зона $zoneIndex"
            }
            NothingDevice.PHONE_2 -> when (zoneIndex) {
                0 -> "Верхние дуги (2 LEDs, #0..1)"
                1 -> "Диагональ и низ (15 LEDs)"
                2 -> "Центральное кольцо (16 LEDs, #4..19)"
                else -> "Зона $zoneIndex"
            }
            NothingDevice.PHONE_1 -> when (zoneIndex) {
                0 -> "Верхняя зона (5 LEDs)"
                1 -> "Нижняя зона (3 LEDs)"
                2 -> "Центральный круг (8 LEDs)"
                else -> "Зона $zoneIndex"
            }
        }
    }

    fun getChannelZoneDescription(device: NothingDevice, channel: Int): String {
        return when (device) {
            NothingDevice.PHONE_3A_PRO -> when (channel) {
                in 0..19 -> "Дуга 1 (Верх-Лево) #$channel"
                in 31..35 -> "Дуга 2 (Низ-Лево) #${channel - 31}"
                in 20..30 -> "Дуга 3 (Справа) #${channel - 20}"
                else -> "Канал #$channel"
            }
            NothingDevice.PHONE_2A -> when (channel) {
                25 -> "Зона A (Верх-Лево)"
                24 -> "Зона B (Низ-Лево)"
                in 0..23 -> "Зона C (Справа) #$channel"
                else -> "Канал #$channel"
            }
            NothingDevice.PHONE_2 -> when (channel) {
                in 0..1 -> "Верхняя дуга #$channel"
                in 4..19 -> "Центральное кольцо #${channel - 4}"
                else -> "Нижняя / диагональная зона #$channel"
            }
            NothingDevice.PHONE_1 -> when (channel) {
                in 0..4 -> "Верхняя зона / камера #$channel"
                in 5..7 -> "Нижняя полоса #$channel"
                else -> "Центральный C-круг #$channel"
            }
        }
    }

    fun getCircularSequence(device: NothingDevice): IntArray {
        return when (device) {
            NothingDevice.PHONE_3A_PRO -> (0 until 36).toList().toIntArray()
            NothingDevice.PHONE_2A -> intArrayOf(
                25, // Top-Left
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, // Right Arc
                24 // Bottom-Left
            )
            NothingDevice.PHONE_2 -> intArrayOf(
                0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 2, 3, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
            )
            NothingDevice.PHONE_1 -> (0 until 16).toList().toIntArray()
        }
    }

    fun animateHardwareFrame(frame: GlyphFrame, durationMs: Int = 300) {
        _currentFrame.value = frame

        val manager = glyphManager ?: return
        if (_connectionState.value != HardwareConnectionState.CONNECTED) return

        try {
            val targetDeviceCode = _activeDevice.value.deviceCode
            val builder = createHardwareBuilder(targetDeviceCode, frame.segmentBrightness.size)
            for (i in frame.segmentBrightness.indices) {
                try {
                    val hwLight = toHardwareBrightness(frame.segmentBrightness[i])
                    builder.buildChannel(i, hwLight)
                } catch (e: Throwable) {
                    log("WARN", "animateHardwareFrame buildChannel($i) failed: ${e.message}")
                }
            }
            try {
                builder.buildPeriod(durationMs)
                builder.buildInterval(10)
                builder.buildCycles(1)
            } catch (ignored: Throwable) {}
            val hwFrame = builder.build()

            var animated = false
            try {
                val method = manager.javaClass.methods.firstOrNull { it.name == "animate" && it.parameterTypes.size == 1 }
                if (method != null) {
                    method.invoke(manager, hwFrame)
                    animated = true
                    log("CMD", "mGM.animate (длительность ${durationMs}мс)")
                }
            } catch (ignored: Throwable) {}

            if (!animated) {
                manager.toggle(hwFrame)
            }
        } catch (e: Throwable) {
            log("ERROR", "mGM.animate ошибка: ${e.message}")
        }
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
        stopAllAnimations(resetFrame = false)
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
            stopAllAnimations(resetFrame = true)
            log("CMD", "⚡ Стробоскоп остановлен")
        }
    }

    fun startSmoothBreathing(scope: CoroutineScope) {
        stopAllAnimations(resetFrame = false)
        _activeAnimation.value = "BREATHING"
        log("CMD", "🌊 Старт плавного дыхания (синусоидальное свечение)")

        animationJob = scope.launch(Dispatchers.Default) {
            val total = _activeDevice.value.totalSegments
            var angle = 0.0
            while (isActive) {
                val norm = (sin(angle) + 1.0) / 2.0 // 0.0 .. 1.0
                // Keep minimal floor at 2 to avoid PWM turnOff flickers during breathing
                val brightness = (norm * 253.0 + 2.0).toInt().coerceIn(2, 255)
                val array = IntArray(total) { brightness }
                updateFrame(GlyphFrame(segmentBrightness = array))
                angle += 0.07
                delay(20L)
            }
        }
    }

    fun stopSmoothBreathing() {
        if (_activeAnimation.value == "BREATHING") {
            stopAllAnimations(resetFrame = true)
            log("CMD", "🌊 Плавное дыхание остановлено")
        }
    }

    fun startBottleRoulette(scope: CoroutineScope, onStop: ((Int) -> Unit)? = null) {
        stopAllAnimations(resetFrame = false)
        _activeAnimation.value = "BOTTLE"
        val seq = getCircularSequence(_activeDevice.value)
        log("CMD", "🍾 Старт «Световой бутылочки» (${seq.size} светодиодов, круговое вращение)")

        animationJob = scope.launch(Dispatchers.Default) {
            var seqIdx = Random.nextInt(seq.size)
            val totalSteps = 45 + Random.nextInt(25)
            var currentDelayMs = 25L

            for (step in 0 until totalSteps) {
                if (!isActive) break
                seqIdx = (seqIdx + 1) % seq.size
                val currentChannel = seq[seqIdx]
                val prevChannel1 = seq[(seqIdx - 1 + seq.size) % seq.size]
                val prevChannel2 = seq[(seqIdx - 2 + seq.size) % seq.size]

                val total = _activeDevice.value.totalSegments
                val array = IntArray(total)
                if (currentChannel in array.indices) array[currentChannel] = 255
                if (prevChannel1 in array.indices) array[prevChannel1] = 90
                if (prevChannel2 in array.indices) array[prevChannel2] = 25
                updateFrame(GlyphFrame(segmentBrightness = array))

                val progress = step.toFloat() / totalSteps.toFloat()
                if (progress > 0.40f) {
                    val f = (progress - 0.40f) / 0.60f
                    currentDelayMs = (25L + (f * f * 340L)).toLong()
                }
                delay(currentDelayMs)
            }

            val winner = seq[seqIdx]
            log("SUCCESS", "🍾 Световая бутылочка остановилась: светодиод #$winner")

            // Victory pulse
            val total = _activeDevice.value.totalSegments
            for (i in 0 until 4) {
                if (!isActive) break
                val winArray = IntArray(total)
                if (winner in winArray.indices) winArray[winner] = 255
                updateFrame(GlyphFrame(segmentBrightness = winArray))
                delay(150L)
                updateFrame(GlyphFrame(segmentBrightness = IntArray(total)))
                delay(120L)
            }
            val finalArray = IntArray(total)
            if (winner in finalArray.indices) finalArray[winner] = 255
            updateFrame(GlyphFrame(segmentBrightness = finalArray))
            _activeAnimation.value = null
            onStop?.invoke(winner)
        }
    }

    fun stopBottleRoulette() {
        if (_activeAnimation.value == "BOTTLE") {
            stopAllAnimations(resetFrame = true)
            log("CMD", "🍾 Световая бутылочка остановлена")
        }
    }

    val autoWalkSpeedMs = kotlinx.coroutines.flow.MutableStateFlow(80L)

    fun setAutoWalkSpeed(speedMs: Long) {
        autoWalkSpeedMs.value = speedMs.coerceIn(20L, 500L)
    }

    fun startAutoWalk(scope: CoroutineScope, brightness: Int = 255) {
        stopAllAnimations(resetFrame = false)
        _activeAnimation.value = "AUTO_WALK"
        val seq = getCircularSequence(_activeDevice.value)
        log("CMD", "▶ Старт авто-обхода (${seq.size} светодиодов по кругу)")

        animationJob = scope.launch(Dispatchers.Default) {
            var step = 0
            val total = _activeDevice.value.totalSegments
            while (isActive) {
                val ch = seq[step % seq.size]
                val array = IntArray(total)
                if (ch in array.indices) array[ch] = brightness.coerceIn(1, 255)
                updateFrame(GlyphFrame(segmentBrightness = array))
                step++
                delay(autoWalkSpeedMs.value)
            }
        }
    }

    fun stopAutoWalk() {
        if (_activeAnimation.value == "AUTO_WALK") {
            stopAllAnimations(resetFrame = true)
            log("CMD", "▶ Авто-обход остановлен")
        }
    }

    fun stopAllAnimations(resetFrame: Boolean = true) {
        animationJob?.cancel()
        animationJob = null
        _activeAnimation.value = null
        if (resetFrame) {
            clear()
        }
    }
}
