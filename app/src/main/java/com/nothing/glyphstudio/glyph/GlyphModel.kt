package com.nothing.glyphstudio.glyph

/**
 * Supported Nothing Phone models and their Glyph matrix architecture.
 */
enum class NothingDevice(
    val displayName: String,
    val zoneCount: Int,
    val totalSegments: Int,
    val description: String
) {
    PHONE_3A_PRO(
        displayName = "Nothing Phone (3a Pro / 3)",
        zoneCount = 3,
        totalSegments = 33,
        description = "3 curved arcs around circular camera: Top-Left (12 LEDs), Bottom-Left (6 LEDs), Right (15 LEDs)"
    ),
    PHONE_2(
        displayName = "Nothing Phone (2)",
        zoneCount = 11,
        totalSegments = 33,
        description = "11 zones with 16-segment center progress ring"
    ),
    PHONE_1(
        displayName = "Nothing Phone (1)",
        zoneCount = 5,
        totalSegments = 16,
        description = "Classic 5-zone glyph architecture"
    )
}

/**
 * Layout mapping for Nothing Phone (3a Pro / 3) circular camera module.
 */
object Phone3aProLayout {
    const val ZONE_TOP_LEFT = 0     // Indices 0..11 (12 individual micro-LEDs)
    const val ZONE_BOTTOM_LEFT = 1  // Indices 12..17 (6 individual micro-LEDs)
    const val ZONE_RIGHT = 2        // Indices 18..32 (15 individual micro-LEDs)

    const val COUNT_TOP_LEFT = 12
    const val COUNT_BOTTOM_LEFT = 6
    const val COUNT_RIGHT = 15
    const val TOTAL_LEDS = 33

    val CHANNELS: List<GlyphChannel> = buildList {
        for (i in 0 until COUNT_TOP_LEFT) {
            add(GlyphChannel(id = i, zoneName = "Top-Left Arc #$i", segmentIndex = i))
        }
        for (i in 0 until COUNT_BOTTOM_LEFT) {
            val idx = COUNT_TOP_LEFT + i
            add(GlyphChannel(id = idx, zoneName = "Bottom-Left Arc #$i", segmentIndex = idx))
        }
        for (i in 0 until COUNT_RIGHT) {
            val idx = COUNT_TOP_LEFT + COUNT_BOTTOM_LEFT + i
            add(GlyphChannel(id = idx, zoneName = "Right Arc #$i", segmentIndex = idx))
        }
    }
}
