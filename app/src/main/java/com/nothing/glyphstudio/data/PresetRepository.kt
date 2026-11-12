package com.nothing.glyphstudio.data

import android.content.Context
import com.nothing.glyphstudio.glyph.GlyphSequence
import com.nothing.glyphstudio.glyph.StepTrack
import java.io.File

object PresetRepository {

    /**
     * Factory presets shipped with the app.
     */
    val builtInPresets: List<GlyphSequence> = listOf(
        // 1. Cyber Metro
        GlyphSequence(
            id = "preset_cyber_metro",
            name = "Cyber Metro",
            author = "Nothing Studio",
            bpm = 128,
            stepCount = 8,
            tracks = listOf(
                StepTrack(0, "Top-Left Arc (20 LEDs)", mutableListOf(255, 0, 0, 0, 255, 0, 0, 0)),
                StepTrack(1, "Bottom-Left Arc (5 LEDs)", mutableListOf(0, 0, 200, 0, 0, 0, 200, 0)),
                StepTrack(2, "Right Arc (11 LEDs)", mutableListOf(255, 0, 0, 0, 0, 0, 0, 0))
            )
        ),
        // 2. Neon Heartbeat
        GlyphSequence(
            id = "preset_heartbeat",
            name = "Neon Heartbeat",
            author = "Nothing Studio",
            bpm = 75,
            stepCount = 8,
            tracks = listOf(
                StepTrack(0, "Top-Left Arc (20 LEDs)", mutableListOf(255, 120, 255, 40, 0, 0, 0, 0)),
                StepTrack(1, "Bottom-Left Arc (5 LEDs)", mutableListOf(0, 200, 80, 0, 0, 0, 0, 0)),
                StepTrack(2, "Right Arc (11 LEDs)", mutableListOf(255, 180, 0, 0, 0, 0, 0, 0))
            )
        ),
        // 3. Strobe Sweep
        GlyphSequence(
            id = "preset_strobe_sweep",
            name = "Strobe Sweep",
            author = "Nothing Studio",
            bpm = 140,
            stepCount = 8,
            tracks = listOf(
                StepTrack(0, "Top-Left Arc (20 LEDs)", mutableListOf(255, 255, 0, 255, 255, 0, 255, 0)),
                StepTrack(1, "Bottom-Left Arc (5 LEDs)", mutableListOf(0, 255, 0, 255, 0, 255, 0, 255)),
                StepTrack(2, "Right Arc (11 LEDs)", mutableListOf(255, 0, 255, 0, 255, 0, 255, 0))
            )
        )
    )

    /**
     * Saves animation sequence as a local .glyph file (JSON).
     */
    fun saveToFile(context: Context, sequence: GlyphSequence, filename: String): File {
        val dir = File(context.filesDir, "presets")
        if (!dir.exists()) dir.mkdirs()
        val safeName = if (filename.endsWith(".glyph")) filename else "$filename.glyph"
        val file = File(dir, safeName)
        file.writeText(sequence.toJson())
        return file
    }

    /**
     * Loads an animation sequence from a .glyph file.
     */
    fun loadFromFile(file: File): GlyphSequence? {
        return try {
            val content = file.readText()
            GlyphSequence.fromJson(content)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Returns all saved custom presets on device.
     */
    fun listSavedPresets(context: Context): List<GlyphSequence> {
        val dir = File(context.filesDir, "presets")
        if (!dir.exists()) return emptyList()
        return dir.listFiles { _, name -> name.endsWith(".glyph") }
            ?.mapNotNull { loadFromFile(it) }
            ?: emptyList()
    }
}
