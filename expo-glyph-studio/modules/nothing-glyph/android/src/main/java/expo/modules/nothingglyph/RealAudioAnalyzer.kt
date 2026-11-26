package expo.modules.nothingglyph

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.Visualizer
import android.os.Process
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.PI
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Real-time Android audio capture & Radix-2 Cooley-Tukey FFT analyzer.
 * Supports two genuine hardware/OS audio sources:
 * 1) System Audio Output Mix via android.media.audiofx.Visualizer(0) (non-DRM playback)
 * 2) Microphone 16-bit PCM via AudioRecord + Hann-windowed 1024-pt Radix-2 FFT
 *
 * Strictly zero synthetic waveform/sine fallbacks: silence produces exact 0.0 outputs.
 */
class RealAudioAnalyzer {
  companion object {
    private const val TAG = "RealAudioAnalyzer"
    const val FFT_SIZE = 1024
    const val NUM_BANDS = 16
    private const val SAMPLE_RATE = 44100
    private const val MIX_SIGNAL_HOLD_MS = 900L
    private const val WAVEFORM_STALE_MS = 250L
  }

  data class StartResult(
    val started: Boolean,
    val activeSource: String,
    val hasPermission: Boolean,
    val mixSupported: Boolean,
    val error: String?
  ) {
    fun toMap(): Map<String, Any?> = mapOf(
      "started" to started,
      "activeSource" to activeSource,
      "hasPermission" to hasPermission,
      "mixSupported" to mixSupported,
      "error" to error
    )
  }

  private class ChannelMetrics {
    var bass: Double = 0.0
    var mid: Double = 0.0
    var treble: Double = 0.0
    var rms: Double = 0.0
    var flux: Double = 0.0
    var peakDb: Double = -96.0
    var signalDetected: Boolean = false
    var updatedAtMs: Long = 0L
    val bands: DoubleArray = DoubleArray(NUM_BANDS)

    fun reset() {
      bass = 0.0
      mid = 0.0
      treble = 0.0
      rms = 0.0
      flux = 0.0
      peakDb = -96.0
      signalDetected = false
      updatedAtMs = 0L
      bands.fill(0.0)
    }
  }

  // Precomputed Hann window and twiddle tables for 1024-pt Radix-2 FFT
  private val hannWindow = DoubleArray(FFT_SIZE) { i ->
    0.5 * (1.0 - cos(2.0 * PI * i / (FFT_SIZE - 1)))
  }
  private val cosTable = DoubleArray(FFT_SIZE / 2) { i ->
    cos(2.0 * PI * i / FFT_SIZE)
  }
  private val sinTable = DoubleArray(FFT_SIZE / 2) { i ->
    -sin(2.0 * PI * i / FFT_SIZE)
  }
  private val bandEdgesHz = DoubleArray(NUM_BANDS + 1) { i ->
    30.0 * (12000.0 / 30.0).pow(i.toDouble() / NUM_BANDS.toDouble())
  }

  private val lifecycleLock = Any()
  private val metricsLock = Any()
  private val mixCaptureLock = Any()

  private val isRunning = AtomicBoolean(false)
  private val generation = AtomicLong(0L)

  @Volatile private var requestedMode: String = "auto"
  @Volatile private var mixSupported: Boolean = false
  @Volatile private var micSupported: Boolean = false
  @Volatile private var lastError: String? = null
  @Volatile private var cachedHasPermission: Boolean = false

  private var visualizer: Visualizer? = null
  private var audioRecord: AudioRecord? = null
  private var micThread: Thread? = null
  private var audioManager: AudioManager? = null

  private val mixMetrics = ChannelMetrics()
  private val micMetrics = ChannelMetrics()

  @Volatile private var lastMixSignalTimeMs: Long = 0L
  @Volatile private var lastMixWaveformTimeMs: Long = 0L

  // Per-source DSP scratch buffers & previous log-magnitude spectra for spectral flux
  private val mixScratch = DspScratch()
  private val micScratch = DspScratch()

  private class DspScratch {
    val samples = DoubleArray(FFT_SIZE)
    val real = DoubleArray(FFT_SIZE)
    val imag = DoubleArray(FFT_SIZE)
    val magnitudes = DoubleArray(FFT_SIZE / 2)
    val prevLogMag = DoubleArray(FFT_SIZE / 2)
    val prevFftByteLogMag = DoubleArray(FFT_SIZE / 2)
    var hasPrevSpectrum = false
    var hasPrevByteSpectrum = false

    fun reset() {
      samples.fill(0.0)
      real.fill(0.0)
      imag.fill(0.0)
      magnitudes.fill(0.0)
      prevLogMag.fill(0.0)
      prevFftByteLogMag.fill(0.0)
      hasPrevSpectrum = false
      hasPrevByteSpectrum = false
    }
  }

  fun hasAudioPermission(context: Context?): Boolean {
    if (context == null) return false
    val granted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.RECORD_AUDIO
    ) == PackageManager.PERMISSION_GRANTED
    cachedHasPermission = granted
    return granted
  }

  fun startCapture(context: Context?, sourceMode: String): StartResult {
    val normalizedMode = when (sourceMode.lowercase().trim()) {
      "mix" -> "mix"
      "mic" -> "mic"
      else -> "auto"
    }

    if (context == null) {
      return StartResult(
        started = false,
        activeSource = "none",
        hasPermission = false,
        mixSupported = false,
        error = "React context unavailable"
      )
    }

    val granted = hasAudioPermission(context)
    if (!granted) {
      stopCapture()
      lastError = "RECORD_AUDIO permission not granted"
      return StartResult(
        started = false,
        activeSource = "none",
        hasPermission = false,
        mixSupported = false,
        error = lastError
      )
    }

    synchronized(lifecycleLock) {
      stopCaptureLocked()

      requestedMode = normalizedMode
      lastError = null
      mixSupported = false
      micSupported = false
      lastMixSignalTimeMs = 0L
      lastMixWaveformTimeMs = 0L
      audioManager = context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

      val myGen = generation.incrementAndGet()
      isRunning.set(true)

      var mixOk = false
      var micOk = false
      var mixErr: String? = null
      var micErr: String? = null

      if (normalizedMode == "auto" || normalizedMode == "mix") {
        val (ok, err) = startSystemMixVisualizer(myGen)
        mixOk = ok
        mixSupported = ok
        mixErr = err
      }

      if (normalizedMode == "mic" || normalizedMode == "auto") {
        val (ok, err) = startMicrophonePcmCapture(myGen)
        micOk = ok
        micSupported = ok
        micErr = err
      }

      val started = when (normalizedMode) {
        "mix" -> mixOk
        "mic" -> micOk
        else -> mixOk || micOk
      }

      if (!started) {
        isRunning.set(false)
        lastError = when (normalizedMode) {
          "mix" -> mixErr ?: "System audio mix Visualizer(0) unavailable"
          "mic" -> micErr ?: "Microphone AudioRecord unavailable"
          else -> mixErr ?: micErr ?: "Unable to start audio capture"
        }
        stopCaptureLocked()
        return StartResult(
          started = false,
          activeSource = "none",
          hasPermission = true,
          mixSupported = mixOk,
          error = lastError
        )
      }

      val initialSource = when (normalizedMode) {
        "mix" -> "mix"
        "mic" -> "mic"
        else -> if (mixOk && (audioManager?.isMusicActive == true)) "mix" else if (micOk) "mic" else "mix"
      }

      if (normalizedMode == "auto" && !mixOk && mixErr != null) {
        lastError = mixErr
      }

      return StartResult(
        started = true,
        activeSource = initialSource,
        hasPermission = true,
        mixSupported = mixOk,
        error = lastError
      )
    }
  }

  fun stopCapture() {
    synchronized(lifecycleLock) {
      stopCaptureLocked()
    }
  }

  private fun stopCaptureLocked() {
    isRunning.set(false)
    generation.incrementAndGet()

    try {
      visualizer?.let { viz ->
        try {
          viz.enabled = false
        } catch (_: Throwable) {}
        try {
          viz.setDataCaptureListener(null, 0, false, false)
        } catch (_: Throwable) {}
        try {
          viz.release()
        } catch (_: Throwable) {}
      }
    } catch (_: Throwable) {}
    visualizer = null

    val recordToStop = audioRecord
    audioRecord = null
    if (recordToStop != null) {
      try {
        if (recordToStop.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
          recordToStop.stop()
        }
      } catch (_: Throwable) {}
      try {
        recordToStop.release()
      } catch (_: Throwable) {}
    }

    val threadToJoin = micThread
    micThread = null
    if (threadToJoin != null && threadToJoin !== Thread.currentThread()) {
      try {
        threadToJoin.interrupt()
        threadToJoin.join(250)
      } catch (_: Throwable) {}
    }

    synchronized(metricsLock) {
      mixMetrics.reset()
      micMetrics.reset()
    }
    synchronized(mixCaptureLock) {
      mixScratch.reset()
    }
    micScratch.reset()
    lastMixSignalTimeMs = 0L
    lastMixWaveformTimeMs = 0L
  }

  fun getMetrics(context: Context?): Map<String, Any?> {
    val hasPerm = if (context != null) hasAudioPermission(context) else cachedHasPermission
    val active = isRunning.get() && hasPerm

    if (!active) {
      return mapOf(
        "active" to false,
        "hasPermission" to hasPerm,
        "source" to "none",
        "mixActive" to false,
        "signalDetected" to false,
        "bass" to 0.0,
        "mid" to 0.0,
        "treble" to 0.0,
        "rms" to 0.0,
        "flux" to 0.0,
        "peakDb" to -96.0,
        "bands" to List(NUM_BANDS) { 0.0 }
      )
    }

    val now = System.currentTimeMillis()
    val musicActive = try {
      audioManager?.isMusicActive == true
    } catch (_: Throwable) {
      false
    }

    synchronized(metricsLock) {
      val useMix = when (requestedMode) {
        "mix" -> true
        "mic" -> false
        else -> {
          if (!micSupported && mixSupported) {
            true
          } else {
            val mixFresh = mixSupported && (now - mixMetrics.updatedAtMs) < 1200L
            val mixRecentSignal = (now - lastMixSignalTimeMs) <= MIX_SIGNAL_HOLD_MS
            mixFresh && (mixMetrics.signalDetected || (musicActive && mixRecentSignal))
          }
        }
      }

      val selected = if (useMix) mixMetrics else micMetrics
      val activeSource = if (useMix) "mix" else "mic"

      return mapOf(
        "active" to true,
        "hasPermission" to hasPerm,
        "source" to activeSource,
        "mixActive" to (useMix && mixMetrics.signalDetected),
        "signalDetected" to selected.signalDetected,
        "bass" to selected.bass,
        "mid" to selected.mid,
        "treble" to selected.treble,
        "rms" to selected.rms,
        "flux" to selected.flux,
        "peakDb" to selected.peakDb,
        "bands" to selected.bands.toList()
      )
    }
  }

  private fun startSystemMixVisualizer(myGen: Long): Pair<Boolean, String?> {
    var viz: Visualizer? = null
    return try {
      viz = Visualizer(0)
      val sizeRange = Visualizer.getCaptureSizeRange()
      val minSize = if (sizeRange.isNotEmpty()) sizeRange[0] else 128
      val maxSize = if (sizeRange.size > 1) sizeRange[1] else 1024
      val targetSize = FFT_SIZE.coerceIn(minSize, maxSize)

      viz.enabled = false
      viz.captureSize = targetSize
      try {
        viz.scalingMode = Visualizer.SCALING_MODE_AS_PLAYED
      } catch (_: Throwable) {}

      val maxRate = try {
        Visualizer.getMaxCaptureRate()
      } catch (_: Throwable) {
        20000
      }.coerceAtLeast(10000)

      val status = viz.setDataCaptureListener(
        object : Visualizer.OnDataCaptureListener {
          override fun onWaveFormDataCapture(
            visualizer: Visualizer?,
            waveform: ByteArray?,
            samplingRate: Int
          ) {
            if (!isRunning.get() || generation.get() != myGen || waveform == null || waveform.isEmpty()) {
              return
            }
            synchronized(mixCaptureLock) {
              if (!isRunning.get() || generation.get() != myGen) {
                return@synchronized
              }
              val now = System.currentTimeMillis()
              lastMixWaveformTimeMs = now
              val sampleRateHz = if (samplingRate > 0) samplingRate / 1000.0 else 48000.0
              val count = min(waveform.size, FFT_SIZE)
              var mean = 0.0
              for (i in 0 until count) {
                val s = ((waveform[i].toInt() and 0xFF) - 128) / 128.0
                mixScratch.samples[i] = s
                mean += s
              }
              mean /= count.toDouble()
              for (i in 0 until count) {
                mixScratch.samples[i] -= mean
              }
              analyzeTimeDomainFrame(
                scratch = mixScratch,
                sampleCount = count,
                sampleRateHz = sampleRateHz,
                noiseGateRms = 0.002,
                targetMetrics = mixMetrics,
                timestampMs = now,
                isMix = true
              )
            }
          }

          override fun onFftDataCapture(
            visualizer: Visualizer?,
            fft: ByteArray?,
            samplingRate: Int
          ) {
            if (!isRunning.get() || generation.get() != myGen || fft == null || fft.size < 4) {
              return
            }
            synchronized(mixCaptureLock) {
              if (!isRunning.get() || generation.get() != myGen) {
                return@synchronized
              }
              val now = System.currentTimeMillis()
              // Only use native FFT byte fallback if waveform callback hasn't fired recently
              if ((now - lastMixWaveformTimeMs) < WAVEFORM_STALE_MS) {
                return@synchronized
              }
              val sampleRateHz = if (samplingRate > 0) samplingRate / 1000.0 else 48000.0
              analyzeVisualizerFftBytes(
                fft = fft,
                sampleRateHz = sampleRateHz,
                scratch = mixScratch,
                targetMetrics = mixMetrics,
                timestampMs = now
              )
            }
          }
        },
        maxRate,
        true,
        true
      )

      if (status != Visualizer.SUCCESS) {
        try {
          viz.release()
        } catch (_: Throwable) {}
        return false to "Visualizer.setDataCaptureListener failed (code=$status)"
      }

      viz.enabled = true
      visualizer = viz
      Log.i(TAG, "System mix Visualizer(0) started (captureSize=$targetSize, rate=${maxRate}mHz)")
      true to null
    } catch (e: Throwable) {
      Log.w(TAG, "System mix Visualizer(0) unavailable: ${e.message}")
      try {
        viz?.release()
      } catch (_: Throwable) {}
      false to (e.message ?: e.javaClass.simpleName)
    }
  }

  @SuppressLint("MissingPermission")
  private fun startMicrophonePcmCapture(myGen: Long): Pair<Boolean, String?> {
    val minBufferBytes = AudioRecord.getMinBufferSize(
      SAMPLE_RATE,
      AudioFormat.CHANNEL_IN_MONO,
      AudioFormat.ENCODING_PCM_16BIT
    )
    if (minBufferBytes <= 0) {
      return false to "AudioRecord.getMinBufferSize returned $minBufferBytes"
    }

    val bufferBytes = max(minBufferBytes, FFT_SIZE * 2 * 2)
    val sources = intArrayOf(
      MediaRecorder.AudioSource.VOICE_RECOGNITION,
      MediaRecorder.AudioSource.MIC
    )

    var createdRecord: AudioRecord? = null
    for (src in sources) {
      try {
        val rec = AudioRecord(
          src,
          SAMPLE_RATE,
          AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_16BIT,
          bufferBytes
        )
        if (rec.state == AudioRecord.STATE_INITIALIZED) {
          createdRecord = rec
          break
        } else {
          rec.release()
        }
      } catch (e: Throwable) {
        Log.w(TAG, "AudioRecord source=$src init failed: ${e.message}")
      }
    }

    val record = createdRecord ?: return false to "Failed to initialize AudioRecord"

    return try {
      record.startRecording()
      if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
        record.release()
        return false to "AudioRecord failed to enter recording state"
      }

      audioRecord = record
      val thread = Thread({
        try {
          Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
        } catch (_: Throwable) {}

        val readBuffer = ShortArray(FFT_SIZE)
        val frameBuffer = ShortArray(FFT_SIZE)
        var filled = 0

        while (isRunning.get() && generation.get() == myGen) {
          val readCount = try {
            record.read(readBuffer, 0, FFT_SIZE - filled)
          } catch (_: Throwable) {
            -1
          }

          if (readCount <= 0) {
            if (!isRunning.get() || generation.get() != myGen) break
            if (readCount < 0) {
              Log.w(TAG, "AudioRecord.read error=$readCount")
              break
            }
            try {
              Thread.sleep(5)
            } catch (_: InterruptedException) {
              break
            }
            continue
          }

          System.arraycopy(readBuffer, 0, frameBuffer, filled, readCount)
          filled += readCount

          if (filled >= FFT_SIZE) {
            var mean = 0.0
            for (i in 0 until FFT_SIZE) {
              val s = frameBuffer[i].toDouble() / 32768.0
              micScratch.samples[i] = s
              mean += s
            }
            mean /= FFT_SIZE.toDouble()
            for (i in 0 until FFT_SIZE) {
              micScratch.samples[i] -= mean
            }

            analyzeTimeDomainFrame(
              scratch = micScratch,
              sampleCount = FFT_SIZE,
              sampleRateHz = SAMPLE_RATE.toDouble(),
              noiseGateRms = 0.0012,
              targetMetrics = micMetrics,
              timestampMs = System.currentTimeMillis(),
              isMix = false
            )
            filled = 0
          }
        }
      }, "GlyphRealAudioDSP-$myGen")

      thread.isDaemon = true
      micThread = thread
      thread.start()
      Log.i(TAG, "Microphone AudioRecord PCM Radix-2 FFT started (${SAMPLE_RATE}Hz)")
      true to null
    } catch (e: Throwable) {
      Log.e(TAG, "startMicrophonePcmCapture error: ${e.message}")
      try {
        record.release()
      } catch (_: Throwable) {}
      false to (e.message ?: e.javaClass.simpleName)
    }
  }

  /**
   * Applies Hann window, runs in-place 1024-pt Radix-2 Cooley-Tukey FFT,
   * and extracts Bass/Mid/Treble, 16 log-spaced bands, RMS, peakDb, and Spectral Flux.
   */
  private fun analyzeTimeDomainFrame(
    scratch: DspScratch,
    sampleCount: Int,
    sampleRateHz: Double,
    noiseGateRms: Double,
    targetMetrics: ChannelMetrics,
    timestampMs: Long,
    isMix: Boolean
  ) {
    val n = min(sampleCount, FFT_SIZE)
    if (n <= 0) return

    var sumSq = 0.0
    var peakAbs = 0.0

    for (i in 0 until n) {
      val s = scratch.samples[i]
      sumSq += s * s
      val absS = if (s < 0.0) -s else s
      if (absS > peakAbs) peakAbs = absS

      val w = if (n == FFT_SIZE) {
        hannWindow[i]
      } else {
        0.5 * (1.0 - cos(2.0 * PI * i / max(1, n - 1)))
      }
      scratch.real[i] = s * w
      scratch.imag[i] = 0.0
    }
    for (i in n until FFT_SIZE) {
      scratch.real[i] = 0.0
      scratch.imag[i] = 0.0
    }

    val rms = sqrt(sumSq / n.toDouble()).coerceIn(0.0, 1.0)
    val peakDb = if (peakAbs <= 1e-6) -96.0 else (20.0 * log10(peakAbs)).coerceIn(-96.0, 0.0)

    if (rms < noiseGateRms || peakAbs < 1e-5) {
      scratch.hasPrevSpectrum = false
      scratch.prevLogMag.fill(0.0)
      synchronized(metricsLock) {
        targetMetrics.bass = 0.0
        targetMetrics.mid = 0.0
        targetMetrics.treble = 0.0
        targetMetrics.rms = 0.0
        targetMetrics.flux = 0.0
        targetMetrics.peakDb = peakDb
        targetMetrics.signalDetected = false
        targetMetrics.updatedAtMs = timestampMs
        targetMetrics.bands.fill(0.0)
      }
      return
    }

    if (isMix) {
      lastMixSignalTimeMs = timestampMs
    }

    runRadix2Fft(scratch.real, scratch.imag)

    val halfN = FFT_SIZE / 2
    val normScale = 4.0 / n.toDouble() // Unity gain for Hann-windowed single-sided spectrum
    var rawFlux = 0.0

    for (k in 1 until halfN) {
      val mag = hypot(scratch.real[k], scratch.imag[k]) * normScale
      scratch.magnitudes[k] = mag
      val logMag = ln(1.0 + 100.0 * mag)
      if (scratch.hasPrevSpectrum) {
        val diff = logMag - scratch.prevLogMag[k]
        if (diff > 0.0) rawFlux += diff
      }
      scratch.prevLogMag[k] = logMag
    }
    scratch.magnitudes[0] = 0.0
    scratch.hasPrevSpectrum = true

    val hzPerBin = sampleRateHz / FFT_SIZE.toDouble()

    val bassEnergy = computeBandParsevalRms(scratch.magnitudes, 20.0, 250.0, hzPerBin, halfN)
    val midEnergy = computeBandParsevalRms(scratch.magnitudes, 250.0, 2500.0, hzPerBin, halfN)
    val trebleEnergy = computeBandParsevalRms(scratch.magnitudes, 2500.0, 12000.0, hzPerBin, halfN)

    val bassNorm = if (isMix) {
      energyToNormalized(bassEnergy, -56.0, -6.0)
    } else {
      energyToNormalized(bassEnergy, -62.0, -14.0)
    }
    val midNorm = if (isMix) {
      energyToNormalized(midEnergy, -58.0, -8.0)
    } else {
      energyToNormalized(midEnergy, -64.0, -16.0)
    }
    val trebleNorm = if (isMix) {
      energyToNormalized(trebleEnergy, -62.0, -14.0)
    } else {
      energyToNormalized(trebleEnergy, -68.0, -22.0)
    }
    val rmsNorm = if (isMix) {
      energyToNormalized(rms, -56.0, -4.0)
    } else {
      energyToNormalized(rms, -60.0, -12.0)
    }
    val fluxNorm = if (rawFlux < 0.04) 0.0 else (rawFlux / (if (isMix) 14.0 else 10.0)).coerceIn(0.0, 1.0)

    val bandValues = DoubleArray(NUM_BANDS)
    for (b in 0 until NUM_BANDS) {
      val fLow = bandEdgesHz[b]
      val fHigh = bandEdgesHz[b + 1]
      val bandRms = computeBandParsevalRms(scratch.magnitudes, fLow, fHigh, hzPerBin, halfN)
      // Compensate narrow-band energy split & natural -3dB/octave pink roll-off
      val frac = b.toDouble() / (NUM_BANDS - 1)
      val floorDb = (if (isMix) -60.0 else -66.0) - frac * 6.0
      val ceilDb = (if (isMix) -10.0 else -18.0) - frac * 6.0
      bandValues[b] = energyToNormalized(bandRms, floorDb, ceilDb)
    }

    synchronized(metricsLock) {
      targetMetrics.bass = bassNorm
      targetMetrics.mid = midNorm
      targetMetrics.treble = trebleNorm
      targetMetrics.rms = rmsNorm
      targetMetrics.flux = fluxNorm
      targetMetrics.peakDb = peakDb
      targetMetrics.signalDetected = true
      targetMetrics.updatedAtMs = timestampMs
      System.arraycopy(bandValues, 0, targetMetrics.bands, 0, NUM_BANDS)
    }
  }

  /**
   * Fallback analyzer if a device only delivers Visualizer FFT bytes without waveform bytes.
   */
  private fun analyzeVisualizerFftBytes(
    fft: ByteArray,
    sampleRateHz: Double,
    scratch: DspScratch,
    targetMetrics: ChannelMetrics,
    timestampMs: Long
  ) {
    val binCount = min(fft.size / 2, FFT_SIZE / 2)
    if (binCount <= 1) return

    var sumSq = 0.0
    var peakMag = 0.0
    var rawFlux = 0.0

    for (k in 1 until binCount) {
      val re = fft[2 * k].toDouble() / 128.0
      val im = fft[2 * k + 1].toDouble() / 128.0
      val mag = hypot(re, im)
      scratch.magnitudes[k] = mag
      sumSq += 0.5 * mag * mag
      if (mag > peakMag) peakMag = mag

      val logMag = ln(1.0 + 100.0 * mag)
      if (scratch.hasPrevByteSpectrum) {
        val diff = logMag - scratch.prevFftByteLogMag[k]
        if (diff > 0.0) rawFlux += diff
      }
      scratch.prevFftByteLogMag[k] = logMag
    }
    scratch.magnitudes[0] = 0.0
    scratch.hasPrevByteSpectrum = true

    val totalRms = sqrt(sumSq).coerceIn(0.0, 1.0)
    val peakDb = if (peakMag <= 1e-6) -96.0 else (20.0 * log10(peakMag.coerceAtMost(1.0))).coerceIn(-96.0, 0.0)

    if (totalRms < 0.002) {
      scratch.hasPrevByteSpectrum = false
      synchronized(metricsLock) {
        targetMetrics.bass = 0.0
        targetMetrics.mid = 0.0
        targetMetrics.treble = 0.0
        targetMetrics.rms = 0.0
        targetMetrics.flux = 0.0
        targetMetrics.peakDb = peakDb
        targetMetrics.signalDetected = false
        targetMetrics.updatedAtMs = timestampMs
        targetMetrics.bands.fill(0.0)
      }
      return
    }

    lastMixSignalTimeMs = timestampMs
    val hzPerBin = sampleRateHz / (binCount * 2).toDouble()

    val bassEnergy = computeBandParsevalRms(scratch.magnitudes, 20.0, 250.0, hzPerBin, binCount)
    val midEnergy = computeBandParsevalRms(scratch.magnitudes, 250.0, 2500.0, hzPerBin, binCount)
    val trebleEnergy = computeBandParsevalRms(scratch.magnitudes, 2500.0, 12000.0, hzPerBin, binCount)

    val bassNorm = energyToNormalized(bassEnergy, -56.0, -6.0)
    val midNorm = energyToNormalized(midEnergy, -58.0, -8.0)
    val trebleNorm = energyToNormalized(trebleEnergy, -62.0, -14.0)
    val rmsNorm = energyToNormalized(totalRms, -56.0, -4.0)
    val fluxNorm = if (rawFlux < 0.04) 0.0 else (rawFlux / 14.0).coerceIn(0.0, 1.0)

    val bandValues = DoubleArray(NUM_BANDS)
    for (b in 0 until NUM_BANDS) {
      val bandRms = computeBandParsevalRms(scratch.magnitudes, bandEdgesHz[b], bandEdgesHz[b + 1], hzPerBin, binCount)
      val frac = b.toDouble() / (NUM_BANDS - 1)
      val floorDb = -60.0 - frac * 6.0
      val ceilDb = -10.0 - frac * 6.0
      bandValues[b] = energyToNormalized(bandRms, floorDb, ceilDb)
    }

    synchronized(metricsLock) {
      targetMetrics.bass = bassNorm
      targetMetrics.mid = midNorm
      targetMetrics.treble = trebleNorm
      targetMetrics.rms = rmsNorm
      targetMetrics.flux = fluxNorm
      targetMetrics.peakDb = peakDb
      targetMetrics.signalDetected = true
      targetMetrics.updatedAtMs = timestampMs
      System.arraycopy(bandValues, 0, targetMetrics.bands, 0, NUM_BANDS)
    }
  }

  private fun runRadix2Fft(real: DoubleArray, imag: DoubleArray) {
    val n = FFT_SIZE
    var j = 0
    for (i in 1 until n) {
      var bit = n shr 1
      while ((j and bit) != 0) {
        j = j xor bit
        bit = bit shr 1
      }
      j = j xor bit
      if (i < j) {
        val tr = real[i]
        real[i] = real[j]
        real[j] = tr
        val ti = imag[i]
        imag[i] = imag[j]
        imag[j] = ti
      }
    }

    var len = 2
    while (len <= n) {
      val halfLen = len shr 1
      val step = n / len
      var i = 0
      while (i < n) {
        var twIdx = 0
        for (k in 0 until halfLen) {
          val wr = cosTable[twIdx]
          val wi = sinTable[twIdx]
          val evenIdx = i + k
          val oddIdx = evenIdx + halfLen
          val oddR = real[oddIdx]
          val oddI = imag[oddIdx]
          val tr = oddR * wr - oddI * wi
          val ti = oddR * wi + oddI * wr
          real[oddIdx] = real[evenIdx] - tr
          imag[oddIdx] = imag[evenIdx] - ti
          real[evenIdx] += tr
          imag[evenIdx] += ti
          twIdx += step
        }
        i += len
      }
      len = len shl 1
    }
  }

  private fun computeBandParsevalRms(
    magnitudes: DoubleArray,
    freqLowHz: Double,
    freqHighHz: Double,
    hzPerBin: Double,
    halfN: Int
  ): Double {
    var startBin = floor(freqLowHz / hzPerBin).toInt().coerceIn(1, halfN - 1)
    var endBin = ceil(freqHighHz / hzPerBin).toInt().coerceIn(1, halfN - 1)
    if (endBin < startBin) {
      val centerBin = (((freqLowHz + freqHighHz) * 0.5) / hzPerBin).roundToInt().coerceIn(1, halfN - 1)
      startBin = centerBin
      endBin = centerBin
    }

    var powerSum = 0.0
    for (k in startBin..endBin) {
      val m = magnitudes[k]
      powerSum += 0.5 * m * m
    }
    return sqrt(powerSum)
  }

  private fun energyToNormalized(energy: Double, floorDb: Double, ceilDb: Double): Double {
    if (energy <= 1e-5) return 0.0
    val db = 20.0 * log10(energy)
    if (db <= floorDb) return 0.0
    if (db >= ceilDb) return 1.0
    return ((db - floorDb) / (ceilDb - floorDb)).coerceIn(0.0, 1.0)
  }
}
