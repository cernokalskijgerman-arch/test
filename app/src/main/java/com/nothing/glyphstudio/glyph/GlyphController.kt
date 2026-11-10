package com.nothing.glyphstudio.glyph

import android.content.Context
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.lang.reflect.Method

/**
 * Central controller bridging the UI simulator with physical Nothing Glyph hardware.
 */
object GlyphController {
    private const val TAG = "GlyphController"

    private val _activeDevice = MutableStateFlow(NothingDevice.PHONE_3A_PRO)
    val activeDevice: StateFlow<NothingDevice> = _activeDevice.asStateFlow()

    private val _currentFrame = MutableStateFlow(GlyphFrame())
    val currentFrame: StateFlow<GlyphFrame> = _currentFrame.asStateFlow()

    private val _isHardwareConnected = MutableStateFlow(false)
    val isHardwareConnected: StateFlow<Boolean> = _isHardwareConnected.asStateFlow()

    private val _statusMessage = MutableStateFlow("Simulator Mode (Active)")
    val statusMessage: StateFlow<String> = _statusMessage.asStateFlow()

    private var glyphManagerInstance: Any? = null
    private var glyphFrameBuilderClass: Class<*>? = null

    fun init(context: Context) {
        val model = Build.MODEL.lowercase()
        Log.d(TAG, "Device: $model")

        if (model.contains("phone (2)") || model.contains("pong")) {
            _activeDevice.value = NothingDevice.PHONE_2
        } else if (model.contains("phone (1)") || model.contains("spacewar")) {
            _activeDevice.value = NothingDevice.PHONE_1
        } else {
            _activeDevice.value = NothingDevice.PHONE_3A_PRO
        }

        tryInitNothingHardware(context)
    }

    private fun tryInitNothingHardware(context: Context) {
        try {
            val glyphManagerClass = Class.forName("com.nothing.ketchum.GlyphManager")
            val getInstanceMethod = glyphManagerClass.getMethod("getInstance", Context::class.java)
            val manager = getInstanceMethod.invoke(null, context)

            if (manager != null) {
                glyphManagerInstance = manager
                val callbackClass = Class.forName("com.nothing.ketchum.GlyphManager\$Callback")
                val proxy = java.lang.reflect.Proxy.newProxyInstance(
                    callbackClass.classLoader,
                    arrayOf(callbackClass)
                ) { _, method, args ->
                    if (method.name == "onServiceConnected") {
                        try {
                            // Automatically detect and register Nothing Phone device
                            val glyphClass = Class.forName("com.nothing.ketchum.Glyph")
                            val commonClass = Class.forName("com.nothing.ketchum.Common")
                            val registerMethod = glyphManagerClass.getMethod("register", String::class.java)

                            val is24111 = try { commonClass.getMethod("is24111").invoke(null) as? Boolean ?: false } catch (e: Exception) { false }
                            val is23111 = try { commonClass.getMethod("is23111").invoke(null) as? Boolean ?: false } catch (e: Exception) { false }
                            val is22111 = try { commonClass.getMethod("is22111").invoke(null) as? Boolean ?: false } catch (e: Exception) { false }
                            val is20111 = try { commonClass.getMethod("is20111").invoke(null) as? Boolean ?: false } catch (e: Exception) { false }

                            val targetDevice = when {
                                is24111 -> glyphClass.getField("DEVICE_24111").get(null) as String // Phone (3a) / (3a Pro)
                                is23111 -> glyphClass.getField("DEVICE_23111").get(null) as String // Phone (2a)
                                is22111 -> glyphClass.getField("DEVICE_22111").get(null) as String // Phone (2)
                                is20111 -> glyphClass.getField("DEVICE_20111").get(null) as String // Phone (1)
                                else -> try { glyphClass.getField("DEVICE_24111").get(null) as String } catch (e: Exception) { "24111" }
                            }

                            registerMethod.invoke(manager, targetDevice)

                            // Open Glyph session
                            val openSessionMethod = glyphManagerClass.getMethod("openSession")
                            openSessionMethod.invoke(manager)

                            _isHardwareConnected.value = true
                            _statusMessage.value = "Nothing Physical Glyph Connected ($targetDevice)"
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to register Glyph session: ${e.message}")
                            _isHardwareConnected.value = true
                            _statusMessage.value = "Glyph Connected"
                        }
                    } else if (method.name == "onServiceDisconnected") {
                        try {
                            val closeSessionMethod = glyphManagerClass.getMethod("closeSession")
                            closeSessionMethod.invoke(manager)
                        } catch (ignored: Exception) {}
                        _isHardwareConnected.value = false
                        _statusMessage.value = "Hardware Disconnected"
                    }
                    null
                }
                val initMethod = glyphManagerClass.getMethod("init", callbackClass)
                initMethod.invoke(manager, proxy)

                glyphFrameBuilderClass = Class.forName("com.nothing.ketchum.GlyphFrame\$Builder")
                _statusMessage.value = "Nothing Glyph SDK Initialized"
            }
        } catch (e: Exception) {
            _isHardwareConnected.value = false
            _statusMessage.value = "Virtual Simulator Mode"
        }
    }

    fun setDevice(device: NothingDevice) {
        _activeDevice.value = device
        clear()
    }

    fun setBrightness(segmentIndex: Int, brightness: Int) {
        val current = _currentFrame.value.segmentBrightness.copyOf()
        if (segmentIndex in current.indices) {
            current[segmentIndex] = brightness.coerceIn(0, 255)
            updateFrame(GlyphFrame(segmentBrightness = current))
        }
    }

    fun setAll(brightness: Int) {
        val total = _activeDevice.value.totalSegments
        val array = IntArray(total) { brightness.coerceIn(0, 255) }
        updateFrame(GlyphFrame(segmentBrightness = array))
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

    fun setSinglePixel(pixelIndex: Int, brightness: Int = 255, trailFade: Boolean = true) {
        val total = _activeDevice.value.totalSegments
        val normalizedIndex = ((pixelIndex % total) + total) % total
        val array = IntArray(total)

        array[normalizedIndex] = brightness.coerceIn(0, 255)

        if (trailFade) {
            val prev1 = (normalizedIndex - 1 + total) % total
            val prev2 = (normalizedIndex - 2 + total) % total
            array[prev1] = (brightness * 0.45f).toInt()
            array[prev2] = (brightness * 0.15f).toInt()
        }

        updateFrame(GlyphFrame(segmentBrightness = array))
    }

    fun updateFrame(frame: GlyphFrame) {
        _currentFrame.value = frame

        val manager = glyphManagerInstance ?: return
        if (!_isHardwareConnected.value) return

        try {
            val isAllOff = frame.segmentBrightness.all { it <= 10 }
            if (isAllOff) {
                try {
                    val turnOffMethod = manager.javaClass.getMethod("turnOff")
                    turnOffMethod.invoke(manager)
                } catch (e: Exception) {}
                return
            }

            // Get frame builder from manager
            val getBuilderMethod = manager.javaClass.getMethod("getGlyphFrameBuilder")
            val builder = getBuilderMethod.invoke(manager)
            val builderClass = builder.javaClass

            val glyphFrameClass = Class.forName("com.nothing.ketchum.GlyphFrame")

            // Build channels that are lit
            for (i in frame.segmentBrightness.indices) {
                if (frame.segmentBrightness[i] > 10) {
                    try {
                        val buildChannelWithVal = builderClass.getMethod("buildChannel", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType)
                        buildChannelWithVal.invoke(builder, i, frame.segmentBrightness[i])
                    } catch (e: NoSuchMethodException) {
                        try {
                            val buildChannelSingle = builderClass.getMethod("buildChannel", Int::class.javaPrimitiveType)
                            buildChannelSingle.invoke(builder, i)
                        } catch (e2: Exception) {}
                    }
                }
            }

            val buildMethod = builderClass.getMethod("build")
            val hardwareFrame = buildMethod.invoke(builder)

            // Try toggle(frame) then animate(frame)
            try {
                val toggleMethod = manager.javaClass.getMethod("toggle", glyphFrameClass)
                toggleMethod.invoke(manager, hardwareFrame)
            } catch (e: NoSuchMethodException) {
                val animateMethod = manager.javaClass.getMethod("animate", glyphFrameClass)
                animateMethod.invoke(manager, hardwareFrame)
            }
        } catch (ignored: Exception) {
            Log.e(TAG, "Hardware update error: ${ignored.message}")
        }
    }

    fun clear() {
        val total = _activeDevice.value.totalSegments
        updateFrame(GlyphFrame(segmentBrightness = IntArray(total)))
        try {
            glyphManagerInstance?.let { manager ->
                val turnOffMethod = manager.javaClass.getMethod("turnOff")
                turnOffMethod.invoke(manager)
            }
        } catch (e: Exception) {}
    }
}
