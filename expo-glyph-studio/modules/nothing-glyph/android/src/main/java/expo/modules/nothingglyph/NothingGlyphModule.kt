package expo.modules.nothingglyph

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.nothing.ketchum.Common
import com.nothing.ketchum.Glyph
import com.nothing.ketchum.GlyphFrame
import com.nothing.ketchum.GlyphManager
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NothingGlyphModule : Module() {
  companion object {
    private const val TAG = "NothingGlyphModule"
    private const val AUDIO_PERMISSION_REQUEST_CODE = 4201
  }

  private val frameLock = Any()
  private val permissionLock = Any()
  private val audioAnalyzer = RealAudioAnalyzer()

  @Volatile private var pendingPermissionPromise: Promise? = null
  @Volatile private var glyphManager: GlyphManager? = null
  @Volatile private var isConnected = false
  @Volatile private var isConnecting = false
  @Volatile private var lastInitAttemptMs = 0L
  @Volatile private var isRegistered = false
  @Volatile private var registeredCode: String? = null
  @Volatile private var lastError: String? = null
  @Volatile private var activeDeviceCode = Glyph.DEVICE_24111
  @Volatile private var totalSegments = 36
  private var currentFrameBrightness = IntArray(36)

  override fun definition() = ModuleDefinition {
    Name("NothingGlyph")

    OnCreate {
      initHardware()
    }

    OnActivityEntersForeground {
      resolvePendingPermissionOnResume()
      if (!isConnected && !isConnecting) {
        Log.i(TAG, "Activity entered foreground while Glyph disconnected; reconnecting...")
        initHardware()
      }
    }

    OnDestroy {
      val pending = synchronized(permissionLock) {
        val p = pendingPermissionPromise
        pendingPermissionPromise = null
        p
      }
      pending?.resolve(
        mapOf(
          "status" to "denied",
          "granted" to false,
          "canAskAgain" to false,
          "expires" to "never"
        )
      )
      audioAnalyzer.stopCapture()
      try {
        glyphManager?.turnOff()
        glyphManager?.closeSession()
        glyphManager?.unInit()
      } catch (ignored: Throwable) {}
      glyphManager = null
      isConnected = false
      isConnecting = false
      isRegistered = false
      registeredCode = null
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

    Function("getHardwareStatus") {
      val context = appContext.reactContext
      mapOf(
        "isConnected" to isConnected,
        "isRegistered" to isRegistered,
        "registeredCode" to registeredCode,
        "debugSetting" to getDebugSettingValue(context),
        "model" to Build.MODEL,
        "deviceCode" to activeDeviceCode,
        "totalSegments" to totalSegments,
        "lastError" to lastError
      )
    }

    Function("getBatteryInfo") {
      val context = appContext.reactContext
      if (context == null) {
        return@Function mapOf(
          "level" to -1,
          "scale" to 100,
          "percent" to -1,
          "status" to -1,
          "isCharging" to false
        )
      }
      val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
      val rawLevel = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
      val rawScale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
      val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
      val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
        status == BatteryManager.BATTERY_STATUS_FULL
      val percent = if (rawLevel >= 0 && rawScale > 0) {
        ((rawLevel * 100f) / rawScale).toInt().coerceIn(0, 100)
      } else {
        -1
      }
      mapOf(
        "level" to rawLevel,
        "scale" to rawScale,
        "percent" to percent,
        "status" to status,
        "isCharging" to isCharging
      )
    }

    Function("hasAudioPermission") {
      audioAnalyzer.hasAudioPermission(appContext.reactContext)
    }

    AsyncFunction("requestAudioPermission") { promise: Promise ->
      val context = appContext.reactContext
      if (context != null &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
      ) {
        promise.resolve(
          mapOf(
            "status" to "granted",
            "granted" to true,
            "canAskAgain" to true,
            "expires" to "never"
          )
        )
        return@AsyncFunction
      }

      val permissionsManager = appContext.permissions
      if (permissionsManager != null) {
        Permissions.askForPermissionsWithPermissionsManager(
          permissionsManager,
          promise,
          Manifest.permission.RECORD_AUDIO
        )
      } else {
        val activity = appContext.currentActivity
        if (activity != null) {
          val previous = synchronized(permissionLock) {
            val prev = pendingPermissionPromise
            pendingPermissionPromise = promise
            prev
          }
          previous?.resolve(
            mapOf(
              "status" to "undetermined",
              "granted" to false,
              "canAskAgain" to true,
              "expires" to "never"
            )
          )
          activity.runOnUiThread {
            try {
              ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                AUDIO_PERMISSION_REQUEST_CODE
              )
            } catch (e: Throwable) {
              val pending = synchronized(permissionLock) {
                if (pendingPermissionPromise === promise) {
                  pendingPermissionPromise = null
                  promise
                } else {
                  null
                }
              }
              pending?.resolve(
                mapOf(
                  "status" to "denied",
                  "granted" to false,
                  "canAskAgain" to false,
                  "expires" to "never"
                )
              )
            }
          }
        } else {
          promise.resolve(
            mapOf(
              "status" to "denied",
              "granted" to false,
              "canAskAgain" to false,
              "expires" to "never"
            )
          )
        }
      }
    }

    Function("startAudioCapture") { sourceMode: String ->
      audioAnalyzer.startCapture(appContext.reactContext, sourceMode).toMap()
    }

    Function("stopAudioCapture") {
      audioAnalyzer.stopCapture()
    }

    Function("getAudioMetrics") {
      audioAnalyzer.getMetrics(appContext.reactContext)
    }

    Function("turnOff") {
      synchronized(frameLock) {
        try {
          currentFrameBrightness.fill(0)
          glyphManager?.turnOff()
        } catch (e: Throwable) {
          lastError = e.message ?: e.javaClass.simpleName
          Log.e(TAG, "turnOff error: ${e.message}")
        }
      }
    }

    Function("setBrightness") { brightness: Int ->
      synchronized(frameLock) {
        val b = brightness.coerceIn(0, 255)
        for (i in 0 until totalSegments.coerceAtMost(currentFrameBrightness.size)) {
          currentFrameBrightness[i] = b
        }
        sendFrameToHardware()
      }
    }

    Function("setChannel") { channel: Int, brightness: Int ->
      synchronized(frameLock) {
        val safeCh = channel.coerceIn(0, (totalSegments - 1).coerceAtLeast(0))
        if (safeCh in currentFrameBrightness.indices) {
          currentFrameBrightness[safeCh] = brightness.coerceIn(0, 255)
        }
        sendFrameToHardware()
      }
    }

    Function("setChannels") { channels: List<Int> ->
      synchronized(frameLock) {
        currentFrameBrightness.fill(0)
        val activeCount = totalSegments.coerceIn(1, currentFrameBrightness.size)
        val len = minOf(channels.size, activeCount)
        for (i in 0 until len) {
          currentFrameBrightness[i] = channels[i].coerceIn(0, 255)
        }
        sendFrameToHardware()
      }
    }

    Function("setArcBrightness") { arcIndex: Int, brightness: Int ->
      synchronized(frameLock) {
        val b = brightness.coerceIn(0, 255)
        val chs = getArcChannels(arcIndex)
        for (ch in chs) {
          if (ch in currentFrameBrightness.indices) {
            currentFrameBrightness[ch] = b
          }
        }
        sendFrameToHardware()
      }
    }

    Function("setArcsBrightness") { arc0: Int, arc1: Int, arc2: Int ->
      synchronized(frameLock) {
        currentFrameBrightness.fill(0)
        val ch0 = getArcChannels(0)
        val ch1 = getArcChannels(1)
        val ch2 = getArcChannels(2)

        for (ch in ch0) if (ch in currentFrameBrightness.indices) currentFrameBrightness[ch] = arc0.coerceIn(0, 255)
        for (ch in ch1) if (ch in currentFrameBrightness.indices) currentFrameBrightness[ch] = arc1.coerceIn(0, 255)
        for (ch in ch2) if (ch in currentFrameBrightness.indices) currentFrameBrightness[ch] = arc2.coerceIn(0, 255)

        sendFrameToHardware()
      }
    }

    Function("setVirtualPixel") { pixelIndex: Int, brightness: Int ->
      synchronized(frameLock) {
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
    }

    Function("setVirtualPixels") { pixels: List<Int>, brightness: Int ->
      synchronized(frameLock) {
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
    }

    Function("setPixelLevels") { levels: List<Double> ->
      synchronized(frameLock) {
        currentFrameBrightness.fill(0)
        if (levels.isEmpty()) {
          sendFrameToHardware()
          return@synchronized
        }

        when (activeDeviceCode) {
          "A059", Glyph.DEVICE_24111, "24111" -> {
            // Phone (3a Pro): 36 channels (Arc 0: 0..19, Arc 1: 31..35, Arc 2: 20..30)
            for (i in 0 until minOf(36, levels.size)) {
              currentFrameBrightness[i] = (levels[i] * 255).toInt().coerceIn(0, 255)
            }
          }
          "23111", "23113", "A142", "A142P" -> {
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
            val segCount = totalSegments.coerceIn(1, currentFrameBrightness.size)
            for (i in 0 until segCount) {
              val virtIdx = if (levels.isNotEmpty()) (i * levels.size / segCount).coerceIn(0, levels.size - 1) else 0
              val lvl = levels[virtIdx]
              currentFrameBrightness[i] = (lvl * 255).toInt().coerceIn(0, 255)
            }
          }
        }
        sendFrameToHardware()
      }
    }
  }

  private fun mapVirtualPixelToChannels(virtualPixel: Int): IntArray {
    val p = virtualPixel.coerceIn(0, 35)
    return when (activeDeviceCode) {
      "A059", Glyph.DEVICE_24111, "24111" -> intArrayOf(p.coerceIn(0, 35))
      "23111", "23113", "A142", "A142P" -> when {
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
      "22111", "A065", "AIN065" -> {
        val ch = (p * 33 / 36).coerceIn(0, 32)
        intArrayOf(ch)
      }
      "20111", "A063" -> {
        val ch = (p * 15 / 36).coerceIn(0, 14)
        intArrayOf(ch)
      }
      else -> {
        val ch = (p * totalSegments / 36).coerceIn(0, totalSegments - 1)
        intArrayOf(ch)
      }
    }
  }

  private fun getDebugSettingValue(context: Context?): Int {
    if (context == null) return 0
    return try {
      Settings.Global.getInt(context.contentResolver, "nt_glyph_interface_debug_enable", 0)
    } catch (_: Throwable) {
      0
    }
  }

  private fun initHardware() {
    val context = appContext.reactContext ?: run {
      lastError = "React context unavailable"
      return
    }
    detectDevice()

    val now = System.currentTimeMillis()
    if (isConnected && glyphManager != null) {
      return
    }
    if (isConnecting && (now - lastInitAttemptMs) < 1500L) {
      return
    }

    lastInitAttemptMs = now
    isConnecting = true

    try {
      glyphManager?.let { existing ->
        try {
          existing.closeSession()
          existing.unInit()
        } catch (_: Throwable) {}
      }
      isConnected = false
      isRegistered = false
      registeredCode = null

      val debugEnabled = getDebugSettingValue(context)
      Log.i(TAG, "nt_glyph_interface_debug_enable: $debugEnabled")

      val manager = GlyphManager.getInstance(context.applicationContext)
      if (manager == null) {
        isConnecting = false
        val err = "GlyphManager.getInstance() returned null"
        lastError = err
        Log.e(TAG, err)
        return
      }
      glyphManager = manager

      val callback = object : GlyphManager.Callback {
        override fun onServiceConnected(componentName: ComponentName?) {
          Log.i(TAG, "Glyph Service connected: ${componentName?.flattenToShortString()}")
          isConnecting = false
          registerAndOpenSession()
        }

        override fun onServiceDisconnected(componentName: ComponentName?) {
          Log.w(TAG, "Glyph Service disconnected")
          isConnecting = false
          isConnected = false
          isRegistered = false
          lastError = "Glyph Service disconnected"
        }
      }

      manager.init(callback)
    } catch (e: Throwable) {
      isConnecting = false
      lastError = e.message ?: e.javaClass.simpleName
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
      is24111 || model.contains("059") || model.contains("3a") || model.contains("phone (3)") -> {
        activeDeviceCode = Glyph.DEVICE_24111
        totalSegments = 36
      }
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
        totalSegments = 15
      }
      else -> {
        activeDeviceCode = Glyph.DEVICE_24111
        totalSegments = 36
      }
    }
    Log.i(TAG, "Detected Nothing device: $activeDeviceCode ($totalSegments segments)")
  }

  private fun registerAndOpenSession() {
    val manager = glyphManager ?: return
    val candidates = listOf(
      activeDeviceCode,
      Glyph.DEVICE_24111,
      "A059",
      "24111",
      "A142",
      "A142P",
      "A065",
      "AIN065",
      "A063",
      "A069",
      "23111",
      "23113",
      "22111",
      "20111",
      "25111",
      Build.MODEL,
      Build.DEVICE
    ).distinct()

    var registered = false
    var matchedCode: String? = null
    for (code in candidates) {
      try {
        registered = manager.register(code)
        if (registered) {
          matchedCode = code
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
        if (registered) {
          matchedCode = "default"
        }
      } catch (ignored: Throwable) {}
    }

    isRegistered = registered
    registeredCode = matchedCode
    if (matchedCode != null) {
      syncDeviceProfileForRegisteredCode(matchedCode)
    }

    try {
      manager.openSession()
      isConnected = true
      lastError = null
      Log.i(TAG, "Glyph session opened successfully!")
      synchronized(frameLock) {
        if (currentFrameBrightness.any { it > 0 }) {
          sendFrameToHardware()
        }
      }
    } catch (e: Throwable) {
      if (e.message?.contains("already", ignoreCase = true) == true) {
        isConnected = true
        lastError = null
        synchronized(frameLock) {
          if (currentFrameBrightness.any { it > 0 }) {
            sendFrameToHardware()
          }
        }
      } else {
        isConnected = false
        lastError = e.message ?: e.javaClass.simpleName
        Log.e(TAG, "openSession error: ${e.message}")
      }
    }
  }

  private fun resolvePendingPermissionOnResume() {
    val pending = synchronized(permissionLock) {
      val p = pendingPermissionPromise
      pendingPermissionPromise = null
      p
    } ?: return

    val context = appContext.reactContext ?: appContext.currentActivity
    val granted = context != null &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    val activity = appContext.currentActivity
    val canAskAgain = if (granted) {
      true
    } else if (activity != null) {
      ActivityCompat.shouldShowRequestPermissionRationale(activity, Manifest.permission.RECORD_AUDIO)
    } else {
      false
    }
    pending.resolve(
      mapOf(
        "status" to if (granted) "granted" else "denied",
        "granted" to granted,
        "canAskAgain" to canAskAgain,
        "expires" to "never"
      )
    )
  }

  private fun syncDeviceProfileForRegisteredCode(code: String) {
    when (code) {
      "A059", Glyph.DEVICE_24111, "24111" -> {
        activeDeviceCode = Glyph.DEVICE_24111
        totalSegments = 36
      }
      "23111", "23113", "A142", "A142P" -> {
        activeDeviceCode = "23111"
        totalSegments = 26
      }
      "22111", "A065", "AIN065" -> {
        activeDeviceCode = "22111"
        totalSegments = 33
      }
      "20111", "A063" -> {
        activeDeviceCode = "20111"
        totalSegments = 15
      }
    }
  }

  private fun getArcChannels(arcIndex: Int): IntArray {
    return when (activeDeviceCode) {
      "A059", Glyph.DEVICE_24111, "24111" -> when (arcIndex) {
        0 -> (0..19).toList().toIntArray()   // Top-Left (20 LEDs)
        1 -> (31..35).toList().toIntArray()  // Bottom-Left (5 LEDs)
        2 -> (20..30).toList().toIntArray()  // Right Arc (11 LEDs)
        else -> intArrayOf()
      }
      "23111", "23113", "A142", "A142P" -> when (arcIndex) {
        0 -> intArrayOf(25)                 // Top-Left Arc (Channel 25)
        1 -> intArrayOf(24)                 // Bottom-Left Arc (Channel 24)
        2 -> (0..23).toList().toIntArray()  // Right Arc (Channels 0..23)
        else -> intArrayOf()
      }
      "22111", "A065", "AIN065" -> when (arcIndex) {
        0 -> (0..15).toList().toIntArray()
        1 -> (16..24).toList().toIntArray()
        2 -> (25..32).toList().toIntArray()
        else -> intArrayOf()
      }
      "20111", "A063" -> when (arcIndex) {
        0 -> intArrayOf(0, 1, 2)
        1 -> intArrayOf(3, 4)
        2 -> (5 until 15).toList().toIntArray()
        else -> intArrayOf()
      }
      else -> when (arcIndex) {
        0 -> (0..19).toList().toIntArray()
        1 -> (31..35).toList().toIntArray()
        2 -> (20..30).toList().toIntArray()
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

    synchronized(frameLock) {
      try {
        val activeCount = totalSegments.coerceIn(1, currentFrameBrightness.size)
        var isAllOff = true
        for (i in 0 until activeCount) {
          if (currentFrameBrightness[i] > 0) {
            isAllOff = false
            break
          }
        }
        if (isAllOff) {
          manager.turnOff()
          return
        }

        val builder = manager.getGlyphFrameBuilder() ?: GlyphFrame.Builder()

        // Defensive reflection expansion: ensure internal channel list supports all segments
        try {
          val f = builder.javaClass.getDeclaredField("channel").apply { isAccessible = true }
          @Suppress("UNCHECKED_CAST")
          val channelList = f.get(builder) as? java.util.ArrayList<Int?>
          if (channelList != null && channelList.size < activeCount) {
            while (channelList.size < activeCount) {
              channelList.add(0)
            }
          }
        } catch (ignored: Throwable) {}

        for (i in 0 until activeCount) {
          val hwVal = toHardwareBrightness(currentFrameBrightness[i])
          try {
            builder.buildChannel(i, hwVal)
          } catch (ignored: Throwable) {}
        }

        val frame = builder.build()
        manager.toggle(frame)
      } catch (e: Throwable) {
        lastError = e.message ?: e.javaClass.simpleName
        Log.e(TAG, "sendFrameToHardware error: ${e.message}")
      }
    }
  }
}
