package com.nothing.glyphstudio.glyph

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GlyphControllerTest {

    @Test
    fun testHardwareBrightnessScaling() {
        assertEquals("0 brightness must scale to 0 hardware light", 0, GlyphController.toHardwareBrightness(0))
        assertEquals("Negative brightness must clamp to 0", 0, GlyphController.toHardwareBrightness(-10))
        assertEquals("255 brightness must scale to full 4095 hardware light", 4095, GlyphController.toHardwareBrightness(255))
        assertEquals("Over-255 brightness must clamp to 4095", 4095, GlyphController.toHardwareBrightness(300))

        // Intermediate scaling check
        val mid = GlyphController.toHardwareBrightness(128)
        assertTrue("128 brightness must scale to ~2055 hardware light (actual: $mid)", mid in 2040..2070)
    }

    @Test
    fun testCircularSequencePhone3aPro() {
        val seq = GlyphController.getCircularSequence(NothingDevice.PHONE_3A_PRO)
        assertEquals("Phone 3a Pro circular sequence must have exactly 36 LEDs", 36, seq.size)
        assertEquals("Phone 3a Pro sequence should start with channel 0", 0, seq.first())
        assertEquals("Phone 3a Pro sequence should end with channel 35", 35, seq.last())

        // Check continuity: all indices 0..35 must be present without duplicates
        val distinct = seq.distinct()
        assertEquals("All 36 channels must be distinct", 36, distinct.size)
    }

    @Test
    fun testCircularSequencePhone2a() {
        val seq = GlyphController.getCircularSequence(NothingDevice.PHONE_2A)
        assertEquals("Phone 2a circular sequence must have exactly 26 LEDs", 26, seq.size)
        assertEquals("Phone 2a sequence must start at Top-Left (channel 25)", 25, seq[0])
        assertEquals("Phone 2a sequence step 1 must be top of right arc (channel 0)", 0, seq[1])
        assertEquals("Phone 2a sequence step 24 must be bottom of right arc (channel 23)", 23, seq[24])
        assertEquals("Phone 2a sequence step 25 must be Bottom-Left (channel 24)", 24, seq[25])

        val distinct = seq.distinct()
        assertEquals("All 26 channels must be distinct", 26, distinct.size)
    }

    @Test
    fun testCircularSequencePhone2() {
        val seq = GlyphController.getCircularSequence(NothingDevice.PHONE_2)
        assertEquals("Phone 2 center ring circular sequence must have 16 LEDs", 16, seq.size)
        assertEquals("First LED in center ring must be channel 4", 4, seq.first())
        assertEquals("Last LED in center ring must be channel 19", 19, seq.last())
    }

    @Test
    fun testSectorNameResolution() {
        // Phone 3a Pro
        val secTopLeft = GlyphController.getSectorName(NothingDevice.PHONE_3A_PRO, 5)
        assertTrue("Channel 5 must be in Top-Left arc", secTopLeft.contains("ВЕРХ-ЛЕВО"))

        val secRight = GlyphController.getSectorName(NothingDevice.PHONE_3A_PRO, 25)
        assertTrue("Channel 25 must be in Right arc", secRight.contains("СПРАВА"))

        val secBottomLeft = GlyphController.getSectorName(NothingDevice.PHONE_3A_PRO, 33)
        assertTrue("Channel 33 must be in Bottom-Left arc", secBottomLeft.contains("НИЗ-ЛЕВО"))

        // Phone 2a
        val sec2aA = GlyphController.getSectorName(NothingDevice.PHONE_2A, 25)
        assertTrue("Channel 25 on 2a must be Zone A", sec2aA.contains("ЗОНА A") && sec2aA.contains("ВЕРХ-ЛЕВО"))

        val sec2aC = GlyphController.getSectorName(NothingDevice.PHONE_2A, 10)
        assertTrue("Channel 10 on 2a must be Zone C", sec2aC.contains("ЗОНА C") && sec2aC.contains("СПРАВА"))

        val sec2aB = GlyphController.getSectorName(NothingDevice.PHONE_2A, 24)
        assertTrue("Channel 24 on 2a must be Zone B", sec2aB.contains("ЗОНА B") && sec2aB.contains("НИЗ-ЛЕВО"))
    }

    @Test
    fun testSectorDirectionResolution() {
        // Channel at start of circular sequence should point North
        val dir0 = GlyphController.getSectorDirection(NothingDevice.PHONE_3A_PRO, 0)
        assertTrue("Direction for LED 0 should point North", dir0.contains("СЕВЕР") || dir0.contains("12:00"))

        // Non-existent channel fallback
        val dirUnknown = GlyphController.getSectorDirection(NothingDevice.PHONE_3A_PRO, 999)
        assertEquals("Unknown channel must return fallback pointer text", "Указывает на игрока", dirUnknown)
    }

    @Test
    fun testPhone3aProLayoutIntegrity() {
        assertEquals("Phone 3a Pro total LEDs must equal 36", 36, Phone3aProLayout.TOTAL_LEDS)
        assertEquals("Arc 1 count must equal 20", 20, Phone3aProLayout.COUNT_TOP_LEFT)
        assertEquals("Arc 2 count must equal 5", 5, Phone3aProLayout.COUNT_BOTTOM_LEFT)
        assertEquals("Arc 3 count must equal 11", 11, Phone3aProLayout.COUNT_RIGHT)

        val allChannels = Phone3aProLayout.ZONE_TOP_LEFT_CHANNELS +
                          Phone3aProLayout.ZONE_RIGHT_CHANNELS +
                          Phone3aProLayout.ZONE_BOTTOM_LEFT_CHANNELS

        assertEquals("Total channels across 3 zones must equal 36", 36, allChannels.size)
        assertEquals("All channels must be unique from 0 to 35", (0..35).toList(), allChannels.sorted())
    }
}
