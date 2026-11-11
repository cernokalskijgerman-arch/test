package com.nothing.glyphstudio.glyph

import com.nothing.ketchum.Glyph

/**
 * Supported Nothing Phone models and their Glyph matrix architecture according to official Nothing Ketchum SDK.
 * Note: Ketchum SDK device codes match hardware model identifiers ("A059", "A142", "A065", "A063").
 */
enum class NothingDevice(
    val deviceCode: String,
    val displayName: String,
    val zoneCount: Int,
    val totalSegments: Int,
    val description: String
) {
    PHONE_3A_PRO(
        deviceCode = Glyph.DEVICE_24111, // "A059" (Nothing Phone 3a / 3a Pro / 3)
        displayName = "Nothing Phone (3a Pro / 3)",
        zoneCount = 3,
        totalSegments = 36,
        description = "3 curved arcs around camera: Top-Left (20 LEDs), Bottom-Left (5 LEDs), Right (11 LEDs)"
    ),
    PHONE_2A(
        deviceCode = Glyph.DEVICE_23111, // "A142" (Nothing Phone 2a)
        displayName = "Nothing Phone (2a)",
        zoneCount = 3,
        totalSegments = 26,
        description = "3 zones: Top-Left (1 LED), Bottom-Left (1 LED), Right (24 LEDs)"
    ),
    PHONE_2(
        deviceCode = Glyph.DEVICE_22111, // "A065" (Nothing Phone 2)
        displayName = "Nothing Phone (2)",
        zoneCount = 11,
        totalSegments = 33,
        description = "11 zones with 16-segment center progress ring"
    ),
    PHONE_1(
        deviceCode = Glyph.DEVICE_20111, // "A063" (Nothing Phone 1)
        displayName = "Nothing Phone (1)",
        zoneCount = 5,
        totalSegments = 16,
        description = "Classic 5-zone glyph architecture"
    )
}

data class GlyphChannel(
    val id: Int,
    val zoneName: String,
    val segmentIndex: Int
)

/**
 * Layout mapping for Nothing Phone (3a Pro / 3, DEVICE_24111) circular camera module.
 * Physical hardware and Ketchum mapping:
 * - Zone C (Дуга 1: Верх-Лево): channels 0..19 (20 LEDs)
 * - Zone A (Дуга 3: Справа): channels 20..30 (11 LEDs)
 * - Zone B (Дуга 2: Низ-Лево): channels 31..35 (5 LEDs)
 */
object Phone3aProLayout {
    const val COUNT_TOP_LEFT = 20
    const val COUNT_BOTTOM_LEFT = 5
    const val COUNT_RIGHT = 11
    const val TOTAL_LEDS = 36

    val ZONE_TOP_LEFT_CHANNELS = 0..19     // Дуга 1: Верх-Лево (20 LEDs)
    val ZONE_BOTTOM_LEFT_CHANNELS = 31..35 // Дуга 2: Низ-Лево (5 LEDs)
    val ZONE_RIGHT_CHANNELS = 20..30       // Дуга 3: Справа (11 LEDs)

    // Ketchum zone name aliases
    val ZONE_A_CHANNELS = ZONE_RIGHT_CHANNELS
    val ZONE_B_CHANNELS = ZONE_BOTTOM_LEFT_CHANNELS
    val ZONE_C_CHANNELS = ZONE_TOP_LEFT_CHANNELS

    val CHANNELS: List<GlyphChannel> = buildList {
        for (i in 0 until COUNT_TOP_LEFT) {
            add(GlyphChannel(id = i, zoneName = "Верх-Лево #$i (Дуга 1)", segmentIndex = i))
        }
        for (i in 0 until COUNT_RIGHT) {
            val idx = 20 + i
            add(GlyphChannel(id = idx, zoneName = "Справа #$i (Дуга 3)", segmentIndex = idx))
        }
        for (i in 0 until COUNT_BOTTOM_LEFT) {
            val idx = 31 + i
            add(GlyphChannel(id = idx, zoneName = "Низ-Лево #$i (Дуга 2)", segmentIndex = idx))
        }
    }
}
