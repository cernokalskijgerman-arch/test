import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import { GlyphColors } from '../theme/colors';

/**
 * 3 Continuous Glyph Arcs:
 * Index 0: Top-Left Arc
 * Index 1: Bottom-Left Arc
 * Index 2: Right Arc
 */
export const ARC_INDICES = {
  TOP_LEFT: 0,
  BOTTOM_LEFT: 1,
  RIGHT: 2,
};

export default function GlyphCameraSilhouette({
  brightness = [255, 255, 255], // [TL, BL, R] values 0..255
  onArcPress,
  size = 280,
}) {
  const cx = 150;
  const cy = 150;
  const camR = 100;
  const glyphR = 116;

  // Exact arc path generators (continuous smooth light tubes without pixel division)
  const rad = (deg) => (deg * Math.PI) / 180;

  // 1. Top-Left Arc: 198° to 239°
  const pathTL = useMemo(() => {
    const x1 = cx + glyphR * Math.cos(rad(198));
    const y1 = cy + glyphR * Math.sin(rad(198));
    const x2 = cx + glyphR * Math.cos(rad(239));
    const y2 = cy + glyphR * Math.sin(rad(239));
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${glyphR} ${glyphR} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }, []);

  // 2. Bottom-Left Arc: 134° to 155°
  const pathBL = useMemo(() => {
    const x1 = cx + glyphR * Math.cos(rad(134));
    const y1 = cy + glyphR * Math.sin(rad(134));
    const x2 = cx + glyphR * Math.cos(rad(155));
    const y2 = cy + glyphR * Math.sin(rad(155));
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${glyphR} ${glyphR} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }, []);

  // 3. Right Arc: -16° to 32°
  const pathR = useMemo(() => {
    const x1 = cx + glyphR * Math.cos(rad(-16));
    const y1 = cy + glyphR * Math.sin(rad(-16));
    const x2 = cx + glyphR * Math.cos(rad(32));
    const y2 = cy + glyphR * Math.sin(rad(32));
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${glyphR} ${glyphR} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }, []);

  // Top organic island contour from sketch wrapping top lenses
  const islandPath = `M 82 85 C 80 106, 92 116, 105 116 C 117 116, 122 96, 134 96 C 142 96, 158 96, 158 75 C 158 60, 152 54, 154 50`;

  // Brightness values normalized (0..1)
  const bTL = Math.min(1, Math.max(0, (brightness[0] ?? 255) / 255));
  const bBL = Math.min(1, Math.max(0, (brightness[1] ?? 255) / 255));
  const bR = Math.min(1, Math.max(0, (brightness[2] ?? 255) / 255));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 300 300"
      >
        {/* ============================================================ */}
        {/* CAMERA BLOCK ONLY (NO PHONE BODY CHASSIS)                    */}
        {/* Strictly matching media_1794341195679_c8252fc1.jpg           */}
        {/* ============================================================ */}

        {/* 1. Main Circular Camera Bezel */}
        <Circle
          cx={cx}
          cy={cy}
          r={camR}
          fill="#050508"
          stroke="#2A2A33"
          strokeWidth="1.8"
        />

        {/* 2. Top Organic Island Outline */}
        <Path
          d={islandPath}
          fill="none"
          stroke="#383844"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Upper Lens (Dual concentric circles: flash/sensor) */}
        <Circle
          cx="144"
          cy="75"
          r="14"
          fill="#0A0A0E"
          stroke="#383844"
          strokeWidth="1.5"
        />
        <Circle
          cx="144"
          cy="75"
          r="7"
          fill="#050508"
          stroke="#4D4D5C"
          strokeWidth="1.2"
        />

        {/* Secondary Upper Lens (Circle below/left of flash) */}
        <Circle
          cx="106"
          cy="92"
          r="14"
          fill="#08080C"
          stroke="#383844"
          strokeWidth="1.5"
        />

        {/* 3. Standalone Middle-Left Lens */}
        <Circle
          cx="104"
          cy="150"
          r="18"
          fill="#050508"
          stroke="#383844"
          strokeWidth="1.8"
        />
        <Circle
          cx="104"
          cy="150"
          r="10"
          fill="#08080C"
          stroke="#282833"
          strokeWidth="1.2"
        />

        {/* 4. Horizontal Periscope Plate on Right */}
        <Rect
          x="134"
          y="126"
          width="100"
          height="52"
          rx="12"
          ry="12"
          fill="#08080D"
          stroke="#33333E"
          strokeWidth="1.6"
        />

        {/* Periscope Stadium/Pill Aperture Cutout */}
        <Rect
          x="142"
          y="134"
          width="36"
          height="36"
          rx="12"
          ry="12"
          fill="#020204"
          stroke="#444452"
          strokeWidth="1.4"
        />

        {/* ============================================================ */}
        {/* CONTINUOUS WHITE GLYPH ARCS (SMOOTH TUBE, NO PIXEL GAPS)    */}
        {/* ============================================================ */}

        {/* --- ARC 1: TOP-LEFT --- */}
        {/* Inactive Base Track */}
        <Path
          d={pathTL}
          fill="none"
          stroke="rgba(55, 55, 68, 0.45)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Active Glowing White Tube */}
        {bTL > 0.02 && (
          <G>
            {/* Outer soft bloom */}
            <Path
              d={pathTL}
              fill="none"
              stroke={`rgba(255, 255, 255, ${(bTL * 0.32).toFixed(2)})`}
              strokeWidth="22"
              strokeLinecap="round"
            />
            {/* Mid neon glow */}
            <Path
              d={pathTL}
              fill="none"
              stroke={`rgba(230, 245, 255, ${(bTL * 0.7).toFixed(2)})`}
              strokeWidth="13"
              strokeLinecap="round"
            />
            {/* Solid pure white core */}
            <Path
              d={pathTL}
              fill="none"
              stroke={`rgba(255, 255, 255, ${bTL.toFixed(2)})`}
              strokeWidth="7.5"
              strokeLinecap="round"
            />
          </G>
        )}
        {/* Invisible Wide Hit Area for Tap */}
        <Path
          d={pathTL}
          fill="none"
          stroke="rgba(0,0,0,0.001)"
          strokeWidth="42"
          strokeLinecap="round"
          onPress={() => onArcPress && onArcPress(ARC_INDICES.TOP_LEFT)}
        />

        {/* --- ARC 2: BOTTOM-LEFT --- */}
        {/* Inactive Base Track */}
        <Path
          d={pathBL}
          fill="none"
          stroke="rgba(55, 55, 68, 0.45)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Active Glowing White Tube */}
        {bBL > 0.02 && (
          <G>
            <Path
              d={pathBL}
              fill="none"
              stroke={`rgba(255, 255, 255, ${(bBL * 0.32).toFixed(2)})`}
              strokeWidth="22"
              strokeLinecap="round"
            />
            <Path
              d={pathBL}
              fill="none"
              stroke={`rgba(230, 245, 255, ${(bBL * 0.7).toFixed(2)})`}
              strokeWidth="13"
              strokeLinecap="round"
            />
            <Path
              d={pathBL}
              fill="none"
              stroke={`rgba(255, 255, 255, ${bBL.toFixed(2)})`}
              strokeWidth="7.5"
              strokeLinecap="round"
            />
          </G>
        )}
        {/* Invisible Wide Hit Area for Tap */}
        <Path
          d={pathBL}
          fill="none"
          stroke="rgba(0,0,0,0.001)"
          strokeWidth="42"
          strokeLinecap="round"
          onPress={() => onArcPress && onArcPress(ARC_INDICES.BOTTOM_LEFT)}
        />

        {/* --- ARC 3: RIGHT --- */}
        {/* Inactive Base Track */}
        <Path
          d={pathR}
          fill="none"
          stroke="rgba(55, 55, 68, 0.45)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Active Glowing White Tube */}
        {bR > 0.02 && (
          <G>
            <Path
              d={pathR}
              fill="none"
              stroke={`rgba(255, 255, 255, ${(bR * 0.32).toFixed(2)})`}
              strokeWidth="22"
              strokeLinecap="round"
            />
            <Path
              d={pathR}
              fill="none"
              stroke={`rgba(230, 245, 255, ${(bR * 0.7).toFixed(2)})`}
              strokeWidth="13"
              strokeLinecap="round"
            />
            <Path
              d={pathR}
              fill="none"
              stroke={`rgba(255, 255, 255, ${bR.toFixed(2)})`}
              strokeWidth="7.5"
              strokeLinecap="round"
            />
          </G>
        )}
        {/* Invisible Wide Hit Area for Tap */}
        <Path
          d={pathR}
          fill="none"
          stroke="rgba(0,0,0,0.001)"
          strokeWidth="42"
          strokeLinecap="round"
          onPress={() => onArcPress && onArcPress(ARC_INDICES.RIGHT)}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
