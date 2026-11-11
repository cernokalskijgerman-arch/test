package com.nothing.glyphstudio.glyph

import com.google.gson.Gson
import com.google.gson.GsonBuilder

/**
 * A snapshot state of all glyph segments at a point in time.
 * Brightness ranges from 0 (off) to 255 (maximum brightness).
 */
data class GlyphFrame(
    val timestampMs: Long = System.currentTimeMillis(),
    val segmentBrightness: IntArray = IntArray(36)
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as GlyphFrame
        return timestampMs == other.timestampMs && segmentBrightness.contentEquals(other.segmentBrightness)
    }

    override fun hashCode(): Int {
        var result = timestampMs.hashCode()
        result = 31 * result + segmentBrightness.contentHashCode()
        return result
    }
}

/**
 * A track in the Step Sequencer assigned to one or more glyph segments.
 */
data class StepTrack(
    val channelId: Int,
    val name: String,
    val steps: MutableList<Int> = MutableList(16) { 0 }
)

/**
 * Full animation project structure exported / imported as .glyph (JSON).
 */
data class GlyphSequence(
    val id: String = java.util.UUID.randomUUID().toString(),
    val name: String = "Untitled Beat",
    val author: String = "Creator",
    val bpm: Int = 120,
    val stepCount: Int = 16,
    val device: String = NothingDevice.PHONE_3A_PRO.name,
    val tracks: List<StepTrack> = emptyList(),
    val loop: Boolean = true,
    val version: Int = 2
) {
    fun toJson(): String {
        return gson.toJson(this)
    }

    companion object {
        private val gson: Gson = GsonBuilder().setPrettyPrinting().create()

        fun fromJson(json: String): GlyphSequence? {
            return try {
                gson.fromJson(json, GlyphSequence::class.java)
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }
}
