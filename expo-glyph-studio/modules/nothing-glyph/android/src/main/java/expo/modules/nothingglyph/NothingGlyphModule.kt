package expo.modules.nothingglyph

import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log
import com.nothing.ketchum.Common
import com.nothing.ketchum.Glyph
import com.nothing.ketchum.GlyphFrame
import com.nothing.ketchum.GlyphManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NothingGlyphModule : Module() {
  companion object {
    private const val TAG = "NothingGlyphModule"
  }

  private var glyphManager: GlyphManager? = null
  private var isConnected = false
  private var activeDeviceCode = "23111"
  private var totalSegments = 26
  private var currentFrameBrightness = IntArray(36)

  override fun definition() = ModuleDefinition {
    Name("NothingGlyph")

    OnCreate {
      initHardware()
    }

    OnDestroy {
      try {
        glyphManager?.closeSession()
        glyphManager?.unInit()
      } catch (ignored: Throwable) {}
      isConnected = false
    }

    Function("initHardware") {
      initHardware()
      isConnected
    }

    Function("isConnected") {
      isConnected
    }

    Function("getDeviceModel") {
      mapOf(
        "deviceCode" to activeDeviceCode,
        "totalSegments" to totalSegments,
        "isConnected" to isConnected,
        "model" to Build.MODEL
      )
    }

    Function("turnOff") {
      try {
        glyphManager?.turnOff()
        currentFrameBrightness.fill(0)
      } catch (e: Throwable) {
        Log.e(TAG, "turnOff error: ${e.message}")
      }
    }

    Function("setBrightness") { brightness: Int ->
      val b = brightness.coerceIn(0, 255)
      for (i in 0 until totalSegments) {
        currentFrameBrightness[i] = b
      }
      sendFrameToHardware()
    }

    Function("setChannel") { channel: Int, brightness: Int ->
      val safeCh = channel.coerceIn(0, (totalSegments - 1).coerceAtLeast(0))
      currentFrameBrightness[safeCh] = brightness.coerceIn(0, 255)
      sendFrameToHardware()
    }

    Function("setChannels") { channels: List<Int> ->
      val len = minOf(channels.size, currentFrameBrightness.size)
      for (i in 0 until len) {
        currentFrameBrightness[i] = channels[i].coerceIn(0, 255)
      }
      sendFrameToHardware()
    }

    Function("setArcBrightness") { arcIndex: Int, brightness: Int ->
      val b = brightness.coerceIn(0, 255)
      val chs = getArcChannels(arcIndex)
      for (ch in chs) {
        if (ch in currentFrameBrightness.indices) {
          currentFrameBrightness[ch] = b
        }
      }
      sendFrameToHardware()
    }

    Function("setArcsBrightness") { arc0: Int, arc1: Int, arc2: Int ->
      currentFrameBrightness.fill(0)
      val ch0 = getArcChannels(0)
      val ch1 = getArcChannels(1)
      val ch2 = getArcChannels(2)

      for (ch in ch0) if (ch in currentFrameBrightness.indices) currentFrameBrightness[ch] = arc0.coerceIn(0, 255)
      for (ch in ch1) if (ch in currentFrameBrightness.indices) currentFrameBrightness[ch] = arc1.coerceIn(0, 255)
      for (ch in ch2) if (ch in currentFrameBrightness.indices) currentFrameBrightness[ch] = arc2.coerceIn(0, 255)

      sendFrameToHardware()
    }

    Function("setVirtualPixel") { pixelIndex: Int, brightness: Int ->
      currentFrameBrightness.fill(0)
      val b = brightness.coerceIn(0, 255)
      val chs = mapVirtualPixelToChannels(pixelIndex)
      for (ch in chs) {
        if (ch in currentFrameBrightness.indices) {
          currentFrameBrightness[ch] = b
        }
      }
      sendFrameToHardware()
    }

    Function("setVirtualPixels") { pixels: List<Int>, brightness: Int ->
      currentFrameBrightness.fill(0)
      val b = brightness.coerceIn(0, 255)
      for (p in pixels) {
        val chs = mapVirtualPixelToChannels(p)
        for (ch in chs) {
          if (ch in currentFrameBrightness.indices) {
            currentFrameBrightness[ch] = b
          }
        }
      }
      sendFrameToHardware()
    }

    Function("setPixelLevels") { levels: List<Double> ->
      currentFrameBrightness.fill(0)
      if (levels.isEmpty()) {
        sendFrameToHardware()
        return@Function
      }

      when (activeDeviceCode) {
        "23111", "23113" -> {
          // Phone 2a: 24 LEDs on right (0..23), 24 bottom-left, 25 top-left
          // Top-Left (virtual 0..19)
          var maxTop = 0.0
          for (i in 0 until minOf(20, levels.size)) {
            if (levels[i] > maxTop) maxTop = levels[i]
          }
          currentFrameBrightness[25] = (maxTop * 255).toInt().coerceIn(0, 255)

          // Bottom-Left (virtual 31..35)
          var maxBot = 0.0
          for (i in 31 until minOf(36, levels.size)) {
            if (levels[i] > maxBot) maxBot = levels[i]
          }
          currentFrameBrightness[24] = (maxBot * 255).toInt().coerceIn(0, 255)

          // Right Arc 24 LEDs (virtual 20..30)
          val rightCount = 24
          for (i in 0 until rightCount) {
            val virtIdx = 20 + (i * 11 / rightCount).coerceIn(0, 10)
            val lvl = if (virtIdx < levels.size) levels[virtIdx] else 0.0
            currentFrameBrightness[i] = (lvl * 255).toInt().coerceIn(0, 255)
          }
        }
        else -> {
          // Direct 1-to-1 or proportional
          for (i in 0 until totalSegments) {
            val virtIdx = if (levels.size > 0) (i * levels.size / totalSegments).coerceIn(0, levels.size - 1) else 0
            val lvl = levels[virtIdx]
            currentFrameBrightness[i] = (lvl * 255).toInt().coerceIn(0, 255)
          }
        }
      }
      sendFrameToHardware()
    }
  }

  private fun mapVirtualPixelToChannels(virtualPixel: Int): IntArray {
    val p = virtualPixel.coerceIn(0, 35)
    return when (activeDeviceCode) {
      "23111", "23113" -> when {
        // Top-Left (0..19)
        p in 0..19 -> intArrayOf(25)
        // Right Arc (20..30): 11 virtual positions mapped across 24 channels (0..23)
        p in 20..30 -> {
          val rel = p - 20
          val startCh = (rel * 24 / 11).coerceIn(0, 23)
          val endCh = ((rel + 1) * 24 / 11).coerceIn(0, 23)
          if (startCh == endCh) intArrayOf(startCh) else (startCh..endCh).toList().toIntArray()
        }
        // Bottom-Left (31..35)
        p in 31..35 -> intArrayOf(24)
        else -> intArrayOf(0)
      }
      "24111" -> intArrayOf(p.coerceIn(0, 35))
      "22111" -> {
        val ch = (p * 33 / 36).coerceIn(0, 32)
        intArrayOf(ch)
      }
      "20111" -> {
        val ch = (p * 16 / 36).coerceIn(0, 15)
        intArrayOf(ch)
      }
      else -> {
        val ch = (p * totalSegments / 36).coerceIn(0, totalSegments - 1)
        intArrayOf(ch)
      }
    }
  }

  private fun initHardware() {
    val context = appContext.reactContext ?: return
    detectDevice()

    try {
      val manager = GlyphManager.getInstance(context.applicationContext)
      if (manager == null) {
        Log.e(TAG, "GlyphManager.getInstance() returned null")
        return
      }
      glyphManager = manager

      val callback = object : GlyphManager.Callback {
        override fun onServiceConnected(componentName: ComponentName?) {
          Log.i(TAG, "Glyph Service connected: ${componentName?.flattenToShortString()}")
          registerAndOpenSession()
        }

        override fun onServiceDisconnected(componentName: ComponentName?) {
          Log.w(TAG, "Glyph Service disconnected")
          isConnected = false
        }
      }

      manager.init(callback)
    } catch (e: Throwable) {
      Log.e(TAG, "initHardware error: ${e.message}")
    }
  }

  private fun detectDevice() {
    val model = Build.MODEL.lowercase()
    val is23111 = try { Common.is23111() } catch (e: Throwable) { false }
    val is22111 = try { Common.is22111() } catch (e: Throwable) { false }
    val is20111 = try { Common.is20111() } catch (e: Throwable) { false }
    val is24111 = try { Common.is24111() } catch (e: Throwable) { false }

    when {
      is23111 || model.contains("2a") || model.contains("a142") || model.contains("pacman") -> {
        activeDeviceCode = "23111"
        totalSegments = 26
      }
      is22111 || model.contains("065") || model.contains("pong") || model.contains("phone (2)") -> {
        activeDeviceCode = "22111"
        totalSegments = 33
      }
      is20111 || model.contains("063") || model.contains("spacewar") || model.contains("phone (1)") -> {
        activeDeviceCode = "20111"
        totalSegments = 16
      }
      is24111 || model.contains("059") || model.contains("3a") || model.contains("phone (3)") -> {
        activeDeviceCode = "24111"
        totalSegments = 36
      }
      else -> {
        activeDeviceCode = "23111"
        totalSegments = 26
      }
    }
    Log.i(TAG, "Detected Nothing device: $activeDeviceCode ($totalSegments segments)")
  }

  private fun registerAndOpenSession() {
    val manager = glyphManager ?: return
    val candidates = listOf(
      activeDeviceCode,
      "A142",
      "A142P",
      "A059",
      "A065",
      "AIN065",
      "A063",
      "A069",
      "23111",
      "23113",
      "24111",
      "22111",
      "20111",
      "25111",
      Build.MODEL,
      Build.DEVICE
    ).distinct()

    var registered = false
    for (code in candidates) {
      try {
        registered = manager.register(code)
        if (registered) {
          Log.i(TAG, "Registered successfully with code: $code")
          break
        }
      } catch (e: Throwable) {
        Log.w(TAG, "register($code) error: ${e.message}")
      }
    }

    if (!registered) {
      try {
        registered = manager.register()
      } catch (ignored: Throwable) {}
    }

    try {
      manager.openSession()
      isConnected = true
      Log.i(TAG, "Glyph session opened successfully!")
    } catch (e: Throwable) {
      if (e.message?.contains("already", ignoreCase = true) == true) {
        isConnected = true
      } else {
        Log.e(TAG, "openSession error: ${e.message}")
      }
    }
  }

  private fun getArcChannels(arcIndex: Int): IntArray {
    return when (activeDeviceCode) {
      "23111", "23113" -> when (arcIndex) {
        0 -> intArrayOf(25)                 // Top-Left Arc (Channel 25)
        1 -> intArrayOf(24)                 // Bottom-Left Arc (Channel 24)
        2 -> (0..23).toList().toIntArray()  // Right Arc (Channels 0..23)
        else -> intArrayOf()
      }
      "24111" -> when (arcIndex) {
        0 -> (0..19).toList().toIntArray()   // Top-Left (20 LEDs)
        1 -> (31..35).toList().toIntArray()  // Bottom-Left (5 LEDs)
        2 -> (20..30).toList().toIntArray()  // Right Arc (11 LEDs)
        else -> intArrayOf()
      }
      "22111" -> when (arcIndex) {
        0 -> (0..15).toList().toIntArray()
        1 -> (16..24).toList().toIntArray()
        2 -> (25..32).toList().toIntArray()
        else -> intArrayOf()
      }
      else -> when (arcIndex) {
        0 -> intArrayOf(0, 1, 2)
        1 -> intArrayOf(3, 4)
        2 -> (5 until totalSegments).toList().toIntArray()
        else -> intArrayOf()
      }
    }
  }

  private fun toHardwareBrightness(val255: Int): Int {
    if (val255 <= 0) return 0
    if (val255 >= 255) return 4095
    return (val255 * 4095 + 127) / 255
  }

  private fun sendFrameToHardware() {
    val manager = glyphManager ?: return
    if (!isConnected) return

    try {
      val isAllOff = currentFrameBrightness.all { it <= 0 }
      if (isAllOff) {
        manager.turnOff()
        return
      }

      val builder = manager.getGlyphFrameBuilder() ?: GlyphFrame.Builder()
      for (i in 0 until totalSegments) {
        val hwVal = toHardwareBrightness(currentFrameBrightness[i])
        try {
          builder.buildChannel(i, hwVal)
        } catch (ignored: Throwable) {}
      }

      val frame = builder.build()
      manager.toggle(frame)
    } catch (e: Throwable) {
      Log.e(TAG, "sendFrameToHardware error: ${e.message}")
    }
  }
}
