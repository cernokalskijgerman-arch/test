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
                ) { _, method, _ ->
                    if (method.name == "onServiceConnected") {
                        _isHardwareConnected.value = true
                        _statusMessage.value = "Nothing Hardware Connected"
                    } else if (method.name == "onServiceDisconnected") {
                        _isHardwareConnected.value = false
                        _statusMessage.value = "Hardware Disconnected"
                    }
                    null
                }
                val initMethod = glyphManagerClass.getMethod("init", callbackClass)
                initMethod.invoke(manager, proxy)

                glyphFrameBuilderClass = Class.forName("com.nothing.ketchum.GlyphFrame\$Builder")
                _statusMessage.value = "Nothing Glyph SDK Bound"
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

        if (_isHardwareConnected.value && glyphManagerInstance != null) {
            try {
                glyphFrameBuilderClass?.let { builderClass ->
                    val builder = builderClass.getDeclaredConstructor().newInstance()
                    val buildMethod = builderClass.getMethod("build")
                    val buildChannelMethod = builderClass.getMethod("buildChannel", Int::class.javaPrimitiveType, Int::class.javaPrimitiveType)

                    for (i in frame.segmentBrightness.indices) {
                        buildChannelMethod.invoke(builder, i, frame.segmentBrightness[i])
                    }

                    val hardwareFrame = buildMethod.invoke(builder)
                    val displayMethod = glyphManagerInstance?.javaClass?.getMethod("animate", Class.forName("com.nothing.ketchum.GlyphFrame"))
                    displayMethod?.invoke(glyphManagerInstance, hardwareFrame)
                }
            } catch (ignored: Exception) {}
        }
    }

    fun clear() {
        val total = _activeDevice.value.totalSegments
        updateFrame(GlyphFrame(segmentBrightness = IntArray(total)))
    }
}
