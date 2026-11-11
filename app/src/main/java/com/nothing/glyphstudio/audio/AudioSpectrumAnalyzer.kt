package com.nothing.glyphstudio.audio

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.nothing.glyphstudio.glyph.GlyphController
import com.nothing.glyphstudio.glyph.GlyphFrame
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

enum class AudioSourceType {
    MICROPHONE,
    SIMULATED_BEAT
}

class AudioSpectrumAnalyzer {
    private val scope = CoroutineScope(Dispatchers.Default)
    private var recordingJob: Job? = null

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _bassLevel = MutableStateFlow(0f)
    val bassLevel: StateFlow<Float> = _bassLevel.asStateFlow()

    private val _midLevel = MutableStateFlow(0f)
    val midLevel: StateFlow<Float> = _midLevel.asStateFlow()

    private val _trebleLevel = MutableStateFlow(0f)
    val trebleLevel: StateFlow<Float> = _trebleLevel.asStateFlow()

    var sensitivity: Float = 1.2f

    @SuppressLint("MissingPermission")
    fun startListening(source: AudioSourceType = AudioSourceType.MICROPHONE) {
        if (_isListening.value) return
        _isListening.value = true

        recordingJob = scope.launch {
            if (source == AudioSourceType.MICROPHONE) {
                runMicrophoneCapture()
            } else {
                runSimulatedVisualizer()
            }
        }
    }

    private suspend fun runMicrophoneCapture() {
        val sampleRate = 44100
        val bufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(1024)

        var audioRecord: AudioRecord? = null
        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            )

            if (audioRecord.state == AudioRecord.STATE_INITIALIZED) {
                audioRecord.startRecording()
                val audioBuffer = ShortArray(bufferSize)

                while (scope.isActive && _isListening.value) {
                    val read = audioRecord.read(audioBuffer, 0, bufferSize)
                    if (read > 0) {
                        // Compute RMS energy and quick frequency band estimation
                        var sum = 0.0
                        var zeroCrossings = 0
                        for (i in 0 until read) {
                            sum += audioBuffer[i] * audioBuffer[i]
                            if (i > 0 && ((audioBuffer[i] >= 0 && audioBuffer[i - 1] < 0) || (audioBuffer[i] < 0 && audioBuffer[i - 1] >= 0))) {
                                zeroCrossings++
                            }
                        }
                        val rms = sqrt(sum / read).toFloat()
                        val normalized = (rms / 32768f * 12f * sensitivity).coerceIn(0f, 1f)

                        // Zero-crossing rate gives frequency bias
                        val freqBias = zeroCrossings.toFloat() / read.toFloat()

                        val bass = (normalized * (1f - freqBias * 2f).coerceIn(0.2f, 1f)).coerceIn(0f, 1f)
                        val mid = (normalized * 0.8f).coerceIn(0f, 1f)
                        val treble = (normalized * (freqBias * 3f).coerceIn(0f, 1f)).coerceIn(0f, 1f)

                        _bassLevel.value = bass
                        _midLevel.value = mid
                        _trebleLevel.value = treble

                        // Map directly to Nothing Phone (2a / 3a) segments
                        applyToGlyphs(bass, mid, treble)
                    }
                }
            } else {
                // Fallback to simulated if permission not granted
                runSimulatedVisualizer()
            }
        } catch (e: Exception) {
            runSimulatedVisualizer()
        } finally {
            try {
                audioRecord?.stop()
                audioRecord?.release()
            } catch (ignored: Exception) {}
        }
    }

    private suspend fun runSimulatedVisualizer() {
        var tick = 0f
        while (scope.isActive && _isListening.value) {
            tick += 0.15f
            val bass = ((sin(tick.toDouble()) + 1.0) * 0.5 * sensitivity).toFloat().coerceIn(0f, 1f)
            val mid = ((cos(tick * 1.5) + 1.0) * 0.5 * sensitivity).toFloat().coerceIn(0f, 1f)
            val treble = ((sin(tick * 3.0) + 1.0) * 0.5 * sensitivity).toFloat().coerceIn(0f, 1f)

            _bassLevel.value = bass
            _midLevel.value = mid
            _trebleLevel.value = treble

            applyToGlyphs(bass, mid, treble)
            kotlinx.coroutines.delay(30)
        }
    }

    private fun applyToGlyphs(bass: Float, mid: Float, treble: Float) {
        val device = GlyphController.activeDevice.value
        val total = device.totalSegments
        val array = IntArray(total)

        // 1. Zone 0: Top-Left Arc (20 LEDs on Phone 3a Pro, #0..19) reacts to Mids (vocals/synth)
        val zone0 = GlyphController.getZoneChannels(device, 0)
        val midCount = (mid * zone0.size).toInt().coerceIn(0, zone0.size)
        val midVal = (255 * mid).toInt().coerceIn(0, 255)
        for (i in 0 until midCount) {
            val ch = zone0[i]
            if (ch < total) array[ch] = midVal
        }

        // 2. Zone 1: Bottom-Left Arc (5 LEDs on Phone 3a Pro, #31..35) reacts to Treble (high-hats/cymbals)
        val zone1 = GlyphController.getZoneChannels(device, 1)
        val trebleCount = (treble * zone1.size).toInt().coerceIn(0, zone1.size)
        val trebleVal = (255 * treble).toInt().coerceIn(0, 255)
        for (i in 0 until trebleCount) {
            val ch = zone1[i]
            if (ch < total) array[ch] = trebleVal
        }

        // 3. Zone 2: Right Arc (11 LEDs on Phone 3a Pro, #20..30) reacts to Bass (kick/sub-bass)
        val zone2 = GlyphController.getZoneChannels(device, 2)
        val bassCount = (bass * zone2.size).toInt().coerceIn(0, zone2.size)
        val bassVal = (255 * bass).toInt().coerceIn(0, 255)
        for (i in 0 until bassCount) {
            val ch = zone2[i]
            if (ch < total) array[ch] = bassVal
        }

        GlyphController.updateFrame(GlyphFrame(segmentBrightness = array))
    }

    fun stop() {
        _isListening.value = false
        recordingJob?.cancel()
        GlyphController.clear()
    }
}
