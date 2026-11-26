import React, { useMemo, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect, G } from 'react-native-svg';

/**
 * 3 Continuous Glyph Arcs:
 * Index 0: Top-Left Arc (20 LEDs, #0..19)
 * Index 1: Bottom-Left Arc (5 LEDs, #31..35)
 * Index 2: Right Arc (11 LEDs, #20..30)
 */
export const ARC_INDICES = {
  TOP_LEFT: 0,
  BOTTOM_LEFT: 1,
  RIGHT: 2,
};

const CX = 150;
const CY = 150;
const CAM_R = 100;
const GLYPH_R = 116;

const rad = (deg) => (deg * Math.PI) / 180;

const buildArcPath = (startDeg, endDeg) => {
  const x1 = CX + GLYPH_R * Math.cos(rad(startDeg));
  const y1 = CY + GLYPH_R * Math.sin(rad(startDeg));
  const x2 = CX + GLYPH_R * Math.cos(rad(endDeg));
  const y2 = CY + GLYPH_R * Math.sin(rad(endDeg));
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${GLYPH_R} ${GLYPH_R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const PATH_TL = buildArcPath(198, 239);
const PATH_BL = buildArcPath(134, 155);
const PATH_R = buildArcPath(-16, 32);
const ISLAND_PATH =
  'M 82 85 C 80 106, 92 116, 105 116 C 117 116, 122 96, 134 96 C 142 96, 158 96, 158 75 C 158 60, 152 54, 154 50';

/**
 * Exact spatial coordinates of all 36 physical micro-LEDs on Nothing Phone (3a Pro / 3).
 * Sequence: Top-Left (#0..19) -> Right (#20..30) -> Bottom-Left (#31..35).
 */
export const PIXEL_COORDINATES = (() => {
  const coords = [];

  // Arc 1: Top-Left (20 LEDs, #0..19): 198° to 239°
  for (let i = 0; i < 20; i++) {
    const angle = 198 + (i / 19) * (239 - 198);
    coords.push({
      id: i,
      arc: ARC_INDICES.TOP_LEFT,
      name: `Верх-Лево #${i}`,
      x: CX + GLYPH_R * Math.cos(rad(angle)),
      y: CY + GLYPH_R * Math.sin(rad(angle)),
    });
  }

  // Arc 3: Right (11 LEDs, #20..30): -16° to 32°
  for (let i = 0; i < 11; i++) {
    const angle = -16 + (i / 10) * (32 - -16);
    const id = 20 + i;
    coords.push({
      id,
      arc: ARC_INDICES.RIGHT,
      name: `Справа #${i}`,
      x: CX + GLYPH_R * Math.cos(rad(angle)),
      y: CY + GLYPH_R * Math.sin(rad(angle)),
    });
  }

  // Arc 2: Bottom-Left (5 LEDs, #31..35): 134° to 155°
  for (let i = 0; i < 5; i++) {
    const angle = 134 + (i / 4) * (155 - 134);
    const id = 31 + i;
    coords.push({
      id,
      arc: ARC_INDICES.BOTTOM_LEFT,
      name: `Низ-Лево #${i}`,
      x: CX + GLYPH_R * Math.cos(rad(angle)),
      y: CY + GLYPH_R * Math.sin(rad(angle)),
    });
  }

  return coords;
})();

/**
 * Memoized static camera chassis & inactive arc tracks (renders once).
 */
const CameraStaticLayer = React.memo(function CameraStaticLayer() {
  return (
    <G>
      {/* 1. Main Circular Camera Bezel */}
      <Circle
        cx={CX}
        cy={CY}
        r={CAM_R}
        fill="#050508"
        stroke="#2A2A33"
        strokeWidth="1.8"
      />

      {/* 2. Top Organic Island Outline */}
      <Path
        d={ISLAND_PATH}
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

      {/* Secondary Upper Lens */}
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

      {/* Inactive Base Tracks */}
      <Path
        d={PATH_TL}
        fill="none"
        stroke="rgba(55, 55, 68, 0.45)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Path
        d={PATH_BL}
        fill="none"
        stroke="rgba(55, 55, 68, 0.45)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Path
        d={PATH_R}
        fill="none"
        stroke="rgba(55, 55, 68, 0.45)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </G>
  );
});

const ArcGlowTube = React.memo(function ArcGlowTube({ path, level }) {
  if (level <= 0.02) return null;
  return (
    <G>
      <Path
        d={path}
        fill="none"
        stroke={`rgba(255, 255, 255, ${(level * 0.32).toFixed(2)})`}
        strokeWidth="22"
        strokeLinecap="round"
      />
      <Path
        d={path}
        fill="none"
        stroke={`rgba(230, 245, 255, ${(level * 0.7).toFixed(2)})`}
        strokeWidth="13"
        strokeLinecap="round"
      />
      <Path
        d={path}
        fill="none"
        stroke={`rgba(255, 255, 255, ${level.toFixed(2)})`}
        strokeWidth="7.5"
        strokeLinecap="round"
      />
    </G>
  );
});

const HitTargetsLayer = React.memo(function HitTargetsLayer({ onArcPress }) {
  const [pressedArc, setPressedArc] = useState(null);

  const handlePressTL = useCallback(() => {
    onArcPress && onArcPress(ARC_INDICES.TOP_LEFT);
  }, [onArcPress]);

  const handlePressBL = useCallback(() => {
    onArcPress && onArcPress(ARC_INDICES.BOTTOM_LEFT);
  }, [onArcPress]);

  const handlePressR = useCallback(() => {
    onArcPress && onArcPress(ARC_INDICES.RIGHT);
  }, [onArcPress]);

  const handlePressInTL = useCallback(() => setPressedArc(ARC_INDICES.TOP_LEFT), []);
  const handlePressInBL = useCallback(() => setPressedArc(ARC_INDICES.BOTTOM_LEFT), []);
  const handlePressInR = useCallback(() => setPressedArc(ARC_INDICES.RIGHT), []);
  const handlePressOut = useCallback(() => setPressedArc(null), []);

  if (!onArcPress) {
    return null;
  }

  return (
    <G>
      {pressedArc === ARC_INDICES.TOP_LEFT && (
        <Path
          d={PATH_TL}
          fill="none"
          stroke="rgba(0, 229, 255, 0.38)"
          strokeWidth="18"
          strokeLinecap="round"
        />
      )}
      {pressedArc === ARC_INDICES.BOTTOM_LEFT && (
        <Path
          d={PATH_BL}
          fill="none"
          stroke="rgba(0, 229, 255, 0.38)"
          strokeWidth="18"
          strokeLinecap="round"
        />
      )}
      {pressedArc === ARC_INDICES.RIGHT && (
        <Path
          d={PATH_R}
          fill="none"
          stroke="rgba(0, 229, 255, 0.38)"
          strokeWidth="18"
          strokeLinecap="round"
        />
      )}

      <Path
        d={PATH_TL}
        fill="none"
        stroke="rgba(0,0,0,0.001)"
        strokeWidth="42"
        strokeLinecap="round"
        onPressIn={handlePressInTL}
        onPressOut={handlePressOut}
        onPress={handlePressTL}
      />
      <Path
        d={PATH_BL}
        fill="none"
        stroke="rgba(0,0,0,0.001)"
        strokeWidth="42"
        strokeLinecap="round"
        onPressIn={handlePressInBL}
        onPressOut={handlePressOut}
        onPress={handlePressBL}
      />
      <Path
        d={PATH_R}
        fill="none"
        stroke="rgba(0,0,0,0.001)"
        strokeWidth="42"
        strokeLinecap="round"
        onPressIn={handlePressInR}
        onPressOut={handlePressOut}
        onPress={handlePressR}
      />
    </G>
  );
});

/**
 * Memoized dim base dots for all 36 micro-LEDs so active/level overlays
 * only need to render currently illuminated pixels.
 */
const MicroLedBaseDots = React.memo(function MicroLedBaseDots() {
  return (
    <G>
      {PIXEL_COORDINATES.map((pixel) => (
        <Circle
          key={pixel.id}
          cx={pixel.x}
          cy={pixel.y}
          r="2"
          fill="rgba(255, 255, 255, 0.22)"
        />
      ))}
    </G>
  );
});

const ShimmerPixelDot = React.memo(function ShimmerPixelDot({ x, y, level }) {
  const bloomR = 4 + level * 10;
  const glowR = 3 + level * 5;
  const coreR = 1.8 + level * 2.8;

  return (
    <G>
      <Circle
        cx={x}
        cy={y}
        r={bloomR.toFixed(1)}
        fill={`rgba(255, 255, 255, ${(level * 0.40).toFixed(2)})`}
      />
      <Circle
        cx={x}
        cy={y}
        r={glowR.toFixed(1)}
        fill={`rgba(230, 245, 255, ${(level * 0.85).toFixed(2)})`}
      />
      <Circle
        cx={x}
        cy={y}
        r={coreR.toFixed(1)}
        fill="#FFFFFF"
      />
    </G>
  );
});

const PixelLevelsLayer = React.memo(function PixelLevelsLayer({ pixelLevels }) {
  return (
    <G>
      <MicroLedBaseDots />
      {PIXEL_COORDINATES.map((pixel) => {
        const raw = pixelLevels[pixel.id] ?? 0;
        if (raw <= 0.05) return null;
        const lvl = Math.round(Math.max(0, Math.min(1, raw)) * 50) / 50;
        return (
          <ShimmerPixelDot
            key={pixel.id}
            x={pixel.x}
            y={pixel.y}
            level={lvl}
          />
        );
      })}
    </G>
  );
});

const ActivePixelsLayer = React.memo(function ActivePixelsLayer({ activePixel }) {
  const isArray = Array.isArray(activePixel);
  const activeSet = useMemo(
    () => (isArray ? new Set(activePixel) : null),
    [isArray, activePixel]
  );

  return (
    <G>
      <MicroLedBaseDots />
      {PIXEL_COORDINATES.map((pixel) => {
        const isActive = activeSet
          ? activeSet.has(pixel.id)
          : pixel.id === activePixel;

        const isAdjacent = !isArray && activePixel !== null && (
          pixel.id === (activePixel + 1) % 36 || pixel.id === (activePixel - 1 + 36) % 36
        );

        if (!isActive && !isAdjacent) {
          return null;
        }

        return (
          <G key={pixel.id}>
            {isActive ? (
              <>
                <Circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r="14"
                  fill="rgba(255, 255, 255, 0.35)"
                />
                <Circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r="8"
                  fill="rgba(230, 245, 255, 0.85)"
                />
                <Circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r="4.5"
                  fill="#FFFFFF"
                />
              </>
            ) : (
              <>
                <Circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r="6"
                  fill="rgba(255, 255, 255, 0.20)"
                />
                <Circle
                  cx={pixel.x}
                  cy={pixel.y}
                  r="3"
                  fill="rgba(230, 245, 255, 0.50)"
                />
              </>
            )}
          </G>
        );
      })}
    </G>
  );
});

function GlyphCameraSilhouette({
  brightness = [255, 255, 255], // [TL, BL, R] values 0..255
  activePixel = null, // Optional single active pixel index (0..35) or array of active indices
  pixelLevels = null, // Optional array of 36 normalized float brightness values [0..1]
  onArcPress,
  size = 280,
}) {
  // Brightness values normalized (0..1)
  const bTL = Math.min(1, Math.max(0, (brightness[0] ?? 255) / 255));
  const bBL = Math.min(1, Math.max(0, (brightness[1] ?? 255) / 255));
  const bR = Math.min(1, Math.max(0, (brightness[2] ?? 255) / 255));

  const showContinuousArcs = activePixel === null && pixelLevels === null;
  const showPixelLevels = pixelLevels !== null && Array.isArray(pixelLevels);
  const showActivePixels = !showPixelLevels && activePixel !== null && activePixel !== undefined;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 300 300"
      >
        <CameraStaticLayer />

        {showContinuousArcs && (
          <G>
            <ArcGlowTube path={PATH_TL} level={bTL} />
            <ArcGlowTube path={PATH_BL} level={bBL} />
            <ArcGlowTube path={PATH_R} level={bR} />
          </G>
        )}

        <HitTargetsLayer onArcPress={onArcPress} />

        {showPixelLevels && (
          <PixelLevelsLayer pixelLevels={pixelLevels} />
        )}

        {showActivePixels && (
          <ActivePixelsLayer activePixel={activePixel} />
        )}
      </Svg>
    </View>
  );
}

const arePropsEqual = (prev, next) => {
  if (prev.size !== next.size) return false;
  if (prev.onArcPress !== next.onArcPress) return false;
  if (prev.pixelLevels !== next.pixelLevels) return false;

  if (prev.activePixel !== next.activePixel) {
    if (Array.isArray(prev.activePixel) && Array.isArray(next.activePixel)) {
      if (prev.activePixel.length !== next.activePixel.length) return false;
      for (let i = 0; i < prev.activePixel.length; i++) {
        if (prev.activePixel[i] !== next.activePixel[i]) return false;
      }
    } else {
      return false;
    }
  }

  if (
    prev.brightness?.[0] !== next.brightness?.[0] ||
    prev.brightness?.[1] !== next.brightness?.[1] ||
    prev.brightness?.[2] !== next.brightness?.[2]
  ) {
    return false;
  }

  return true;
};

export default React.memo(GlyphCameraSilhouette, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
