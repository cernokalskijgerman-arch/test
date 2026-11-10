package com.nothing.glyphstudio.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.nothing.glyphstudio.GlyphStudioApp
import com.nothing.glyphstudio.MainActivity
import com.nothing.glyphstudio.R
import com.nothing.glyphstudio.glyph.GlyphController
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class GlyphForegroundService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.Default)
    private var workerJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_STOP
        when (action) {
            ACTION_START_TIMER -> {
                val durationSec = intent.getIntExtra(EXTRA_DURATION_SEC, 60)
                startTimerMode(durationSec)
            }
            ACTION_START_BATTERY -> {
                startBatteryMode()
            }
            ACTION_START_STROBE -> {
                val hz = intent.getIntExtra(EXTRA_STROBE_HZ, 10)
                startStrobeMode(hz)
            }
            ACTION_START_SOFTLIGHT -> {
                val brightness = intent.getIntExtra(EXTRA_BRIGHTNESS, 200)
                startSoftlightMode(brightness)
            }
            ACTION_STOP -> {
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startTimerMode(totalSeconds: Int) {
        startForeground(NOTIFICATION_ID, buildNotification("Glyph Timer Running", "Tracking $totalSeconds sec..."))
        workerJob?.cancel()
        workerJob = serviceScope.launch {
            val startTime = System.currentTimeMillis()
            val totalMs = totalSeconds * 1000L

            while (isActive) {
                val elapsed = System.currentTimeMillis() - startTime
                val remaining = (totalMs - elapsed).coerceAtLeast(0L)
                val progress = remaining.toFloat() / totalMs.toFloat()

                GlyphController.setProgress(progress)

                if (remaining <= 0) {
                    // Flash all 3 times to signal completion
                    for (i in 0 until 3) {
                        GlyphController.setAll(255)
                        delay(200)
                        GlyphController.clear()
                        delay(200)
                    }
                    stopSelf()
                    break
                }
                delay(50)
            }
        }
    }

    private fun startBatteryMode() {
        startForeground(NOTIFICATION_ID, buildNotification("Glyph Battery Gauge", "Reflecting battery level on arc"))
        workerJob?.cancel()
        workerJob = serviceScope.launch {
            while (isActive) {
                val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
                val batteryPct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                GlyphController.setProgress(batteryPct / 100f)
                delay(2000)
            }
        }
    }

    private fun startStrobeMode(hz: Int) {
        startForeground(NOTIFICATION_ID, buildNotification("Glyph Strobe Active", "$hz Hz Flash"))
        workerJob?.cancel()
        val intervalMs = (1000L / (hz * 2)).coerceAtLeast(10L)
        workerJob = serviceScope.launch {
            while (isActive) {
                GlyphController.setAll(255)
                delay(intervalMs)
                GlyphController.clear()
                delay(intervalMs)
            }
        }
    }

    private fun startSoftlightMode(brightness: Int) {
        startForeground(NOTIFICATION_ID, buildNotification("Glyph Pro Softlight", "Continuous illumination"))
        workerJob?.cancel()
        GlyphController.setAll(brightness)
    }

    private fun buildNotification(title: String, content: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, GlyphForegroundService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, GlyphStudioApp.NOTIFICATION_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_media_pause, "Turn Off", stopIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        workerJob?.cancel()
        GlyphController.clear()
        super.onDestroy()
    }

    companion object {
        private const val NOTIFICATION_ID = 2001
        const val ACTION_START_TIMER = "ACTION_START_TIMER"
        const val ACTION_START_BATTERY = "ACTION_START_BATTERY"
        const val ACTION_START_STROBE = "ACTION_START_STROBE"
        const val ACTION_START_SOFTLIGHT = "ACTION_START_SOFTLIGHT"
        const val ACTION_STOP = "ACTION_STOP"

        const val EXTRA_DURATION_SEC = "EXTRA_DURATION_SEC"
        const val EXTRA_STROBE_HZ = "EXTRA_STROBE_HZ"
        const val EXTRA_BRIGHTNESS = "EXTRA_BRIGHTNESS"
    }
}
