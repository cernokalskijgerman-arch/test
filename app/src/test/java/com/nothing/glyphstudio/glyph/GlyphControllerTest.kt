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
        assertEquals("All 16 channels must be distinct", 16, seq.distinct().size)
    }

    @Test
    fun testCircularSequencePhone1() {
        val seq = GlyphController.getCircularSequence(NothingDevice.PHONE_1)
        assertEquals("Phone 1 center circle circular sequence must have 8 LEDs", 8, seq.size)
        assertEquals("First LED in center circle must be channel 8", 8, seq.first())
        assertEquals("Last LED in center circle must be channel 15", 15, seq.last())
        assertEquals("All 8 channels must be distinct", 8, seq.distinct().size)
    }

    @Test
    fun testPhysicalAngleAndDirectionPhone2a() {
        // Channel 25 is Zone A: Top-Left (~10:30, clock angle 315°) -> СЕВЕРО-ЗАПАД ↖
        val angle25 = GlyphController.getLedPhysicalAngle(NothingDevice.PHONE_2A, 25)
        assertEquals(315f, angle25, 0.1f)
        val dir25 = GlyphController.getSectorDirection(NothingDevice.PHONE_2A, 25)
        assertTrue("Channel 25 (Zone A) must point North-West: $dir25", dir25.contains("СЕВЕРО-ЗАПАД") || dir25.contains("10:30"))

        // Channel 0 is Zone C Top (~1:30, clock angle 45°) -> СЕВЕРО-ВОСТОК ↗
        val angle0 = GlyphController.getLedPhysicalAngle(NothingDevice.PHONE_2A, 0)
        assertEquals(45f, angle0, 0.1f)
        val dir0 = GlyphController.getSectorDirection(NothingDevice.PHONE_2A, 0)
        assertTrue("Channel 0 (Zone C top) must point North-East: $dir0", dir0.contains("СЕВЕРО-ВОСТОК") || dir0.contains("1:30"))

        // Channel 11 is Zone C Mid (~3:00, clock angle ~88°) -> ВОСТОК ➡
        val dir11 = GlyphController.getSectorDirection(NothingDevice.PHONE_2A, 11)
        assertTrue("Channel 11 (Zone C mid) must point East: $dir11", dir11.contains("ВОСТОК") || dir11.contains("3:00"))

        // Channel 23 is Zone C Bottom (~4:30, clock angle 135°) -> ЮГО-ВОСТОК ↘
        val angle23 = GlyphController.getLedPhysicalAngle(NothingDevice.PHONE_2A, 23)
        assertEquals(135f, angle23, 0.1f)
        val dir23 = GlyphController.getSectorDirection(NothingDevice.PHONE_2A, 23)
        assertTrue("Channel 23 (Zone C bottom) must point South-East: $dir23", dir23.contains("ЮГО-ВОСТОК") || dir23.contains("4:30"))

        // Channel 24 is Zone B: Bottom-Left (~7:30, clock angle 225°) -> ЮГО-ЗАПАД ↙
        val angle24 = GlyphController.getLedPhysicalAngle(NothingDevice.PHONE_2A, 24)
        assertEquals(225f, angle24, 0.1f)
        val dir24 = GlyphController.getSectorDirection(NothingDevice.PHONE_2A, 24)
        assertTrue("Channel 24 (Zone B) must point South-West: $dir24", dir24.contains("ЮГО-ЗАПАД") || dir24.contains("7:30"))
    }

    @Test
    fun testPhysicalAngleAndDirectionPhone3aPro() {
        // Channel 0 is start of Arc 1 (~9:30, clock angle 285°) -> ЗАПАД / СЕВЕРО-ЗАПАД
        val angle0 = GlyphController.getLedPhysicalAngle(NothingDevice.PHONE_3A_PRO, 0)
        assertEquals(285f, angle0, 0.1f)
        val dir0 = GlyphController.getSectorDirection(NothingDevice.PHONE_3A_PRO, 0)
        assertTrue("Channel 0 must point West/North-West: $dir0", dir0.contains("ЗАПАД") || dir0.contains("9:00"))

        // Channel 19 is end of Arc 1 (~11:00, clock angle 330°) -> СЕВЕРО-ЗАПАД
        val angle19 = GlyphController.getLedPhysicalAngle(NothingDevice.PHONE_3A_PRO, 19)
        assertEquals(330f, angle19, 0.1f)
        val dir19 = GlyphController.getSectorDirection(NothingDevice.PHONE_3A_PRO, 19)
        assertTrue("Channel 19 must point North-West: $dir19", dir19.contains("СЕВЕРО-ЗАПАД") || dir19.contains("10:30"))

        // Channel 20 is start of Arc 3 (~2:30, clock angle 75°) -> ВОСТОК / СЕВЕРО-ВОСТОК
        val dir20 = GlyphController.getSectorDirection(NothingDevice.PHONE_3A_PRO, 20)
        assertTrue("Channel 20 must point East/North-East: $dir20", dir20.contains("ВОСТОК") || dir20.contains("СЕВЕРО-ВОСТОК"))

        // Channel 31 is start of Arc 2 (~7:30, clock angle 225°) -> ЮГО-ЗАПАД
        val angle31 = GlyphController.getLedPhysicalAngle(NothingDevice.PHONE_3A_PRO, 31)
        assertEquals(225f, angle31, 0.1f)
        val dir31 = GlyphController.getSectorDirection(NothingDevice.PHONE_3A_PRO, 31)
        assertTrue("Channel 31 must point South-West: $dir31", dir31.contains("ЮГО-ЗАПАД") || dir31.contains("7:30"))

        // Invalid channel fallback
        val dirUnknown = GlyphController.getSectorDirection(NothingDevice.PHONE_3A_PRO, 999)
        assertEquals("Unknown channel must return fallback text", "Указывает на игрока", dirUnknown)
    }

    @Test
    fun testClosestChannelResolution() {
        // Target angle 45° (North-East) on Phone 2a should resolve to channel 0
        val closestNE = GlyphController.getClosestChannelForAngle(NothingDevice.PHONE_2A, 45f)
        assertEquals("Closest channel for 45° (NE) on Phone 2a must be 0", 0, closestNE)

        // Target angle 315° (North-West) on Phone 2a should resolve to channel 25
        val closestNW = GlyphController.getClosestChannelForAngle(NothingDevice.PHONE_2A, 315f)
        assertEquals("Closest channel for 315° (NW) on Phone 2a must be 25", 25, closestNW)

        // Target angle 225° (South-West) on Phone 2a should resolve to channel 24
        val closestSW = GlyphController.getClosestChannelForAngle(NothingDevice.PHONE_2A, 225f)
        assertEquals("Closest channel for 225° (SW) on Phone 2a must be 24", 24, closestSW)
    }

    @Test
    fun testTargetedRouletteMath() {
        val seq = GlyphController.getCircularSequence(NothingDevice.PHONE_2A)

        // For any starting index and any target channel in sequence,
        // verify the step formula lands precisely on targetIdx.
        for (startIdx in seq.indices) {
            for (targetIdx in seq.indices) {
                val fullRevs = 3
                val stepsToTarget = ((targetIdx - startIdx) % seq.size + seq.size) % seq.size
                val totalSteps = fullRevs * seq.size + stepsToTarget
                val finalIdx = (startIdx + totalSteps) % seq.size
                assertEquals("Final index must match target index", targetIdx, finalIdx)
            }
        }
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

    @Test
    fun testClosestChannelAllDevicesCardinalDirections() {
        val angles = listOf(0f, 45f, 90f, 135f, 180f, 225f, 270f, 315f)
        for (device in NothingDevice.values()) {
            val seq = GlyphController.getCircularSequence(device)
            for (angle in angles) {
                val ch = GlyphController.getClosestChannelForAngle(device, angle)
                assertTrue("Resolved channel $ch must be within circular sequence for ${device.displayName}", ch in seq)
                assertTrue("Resolved channel $ch must be within total segments bounds [0..${device.totalSegments})", ch in 0 until device.totalSegments)
                val physAngle = GlyphController.getLedPhysicalAngle(device, ch)
                assertTrue("Resolved channel $ch must have valid physical angle on ${device.displayName} (got $physAngle)", physAngle >= 0f)
            }
        }
    }

    @Test
    fun testSetSingleChannelAndPreviewAngle() {
        GlyphController.setDevice(NothingDevice.PHONE_2A)
        GlyphController.setSingleChannel(25, 255)
        val frame25 = GlyphController.currentFrame.value
        assertEquals("Channel 25 brightness must be 255", 255, frame25.segmentBrightness[25])
        assertEquals("Other channels must be 0", 0, frame25.segmentBrightness[0])

        val chNW = GlyphController.previewAngle(315f, 200)
        assertEquals("Preview 315° on Phone 2a must select channel 25", 25, chNW)
        val framePreview = GlyphController.currentFrame.value
        assertEquals("Channel 25 must be set to 200", 200, framePreview.segmentBrightness[25])
    }

    @Test
    fun testTargetedRouletteFormulaAllDevices() {
        for (device in NothingDevice.values()) {
            val seq = GlyphController.getCircularSequence(device)
            for (startIdx in seq.indices) {
                for (targetIdx in seq.indices) {
                    val fullRevs = 3
                    val stepsToTarget = ((targetIdx - startIdx) % seq.size + seq.size) % seq.size
                    val totalSteps = fullRevs * seq.size + stepsToTarget
                    val finalIdx = (startIdx + totalSteps) % seq.size
                    assertEquals("Final index must match target index on ${device.displayName}", targetIdx, finalIdx)
                    assertEquals("Target channel must match", seq[targetIdx], seq[finalIdx])
                }
            }
        }
    }
}
