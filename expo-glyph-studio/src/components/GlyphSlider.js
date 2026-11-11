import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GlyphColors } from '../theme/colors';

/**
 * iOS-style Liquid Glass Slider optimized for Expo Go.
 * Zero external binary dependencies; 100% glitch-free gesture tracking.
 * Features zero boundary hysteresis (instant reverse response from 0 and max),
 * non-hijackable responder lock, and authentic specular glass optics.
 */
export default function GlyphSlider({
  label,
  value,
  min = 0,
  max = 255,
  step = 1,
  unit = '',
  displayValue,
  onValueChange,
  style,
  accentColor = GlyphColors.neonRed,
  disabled = false,
}) {
  const trackWidthRef = useRef(200);
  const startXRef = useRef(0);
  const lastReportedValRef = useRef(value);
  const lastHapticValRef = useRef(value);

  const calculateSteppedValue = useCallback(
    (raw) => {
      const clamped = Math.max(min, Math.min(max, raw));
      const stepped = Math.round((clamped - min) / step) * step + min;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step]
  );

  const triggerHapticIfThreshold = (newVal) => {
    const range = max - min;
    const threshold = Math.max(step, range * 0.05);
    if (Math.abs(newVal - lastHapticValRef.current) >= threshold) {
      lastHapticValRef.current = newVal;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return !disabled && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
      },
      // Never yield responder to parent screen swipe or scroll views mid-drag
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        if (disabled) return;
        const width = trackWidthRef.current || 200;
        const touchX = Math.max(0, Math.min(width, evt.nativeEvent.locationX));
        const currentFraction = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
        const currentThumbX = currentFraction * width;

        // If touched near existing thumb puck (within 24px), anchor to thumb position
        // If touched on the track to seek, seek directly to touch point
        const initialX = Math.abs(touchX - currentThumbX) <= 24 ? currentThumbX : touchX;
        startXRef.current = initialX;

        const fraction = initialX / width;
        const rawVal = min + fraction * (max - min);
        const newVal = calculateSteppedValue(rawVal);

        lastReportedValRef.current = newVal;
        lastHapticValRef.current = newVal;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onValueChange && onValueChange(newVal);
      },
      onPanResponderMove: (_, gestureState) => {
        if (disabled) return;
        const width = trackWidthRef.current || 200;
        let currentX = startXRef.current + gestureState.dx;

        // Prevent boundary hysteresis / dead zone:
        // When finger overshoots beyond track edges, dynamically adjust startX
        // so reverse dragging instantly responds on the very first pixel
        if (currentX > width) {
          startXRef.current = width - gestureState.dx;
          currentX = width;
        } else if (currentX < 0) {
          startXRef.current = -gestureState.dx;
          currentX = 0;
        }

        const fraction = Math.max(0, Math.min(1, currentX / width));
        const rawVal = min + fraction * (max - min);
        const newVal = calculateSteppedValue(rawVal);

        if (newVal !== lastReportedValRef.current) {
          const wasBoundary =
            (newVal === min && lastReportedValRef.current !== min) ||
            (newVal === max && lastReportedValRef.current !== max);

          lastReportedValRef.current = newVal;

          if (wasBoundary) {
            // Tactile bump at limit (0% or 100%)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          } else {
            triggerHapticIfThreshold(newVal);
          }

          onValueChange && onValueChange(newVal);
        }
      },
      onPanResponderRelease: () => {
        if (disabled) return;
        Haptics.selectionAsync().catch(() => {});
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const percentageStr = `${(fraction * 100).toFixed(1)}%`;

  return (
    <View style={[styles.container, disabled && styles.containerDisabled, style]}>
      {/* Label and Value Row */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valueText, fraction > 0 && { color: '#FFFFFF' }]}>
          {displayValue !== undefined ? displayValue : `${Math.round(value)}${unit}`}
        </Text>
      </View>

      {/* Touch Interaction Container */}
      <View
        style={styles.touchArea}
        {...panResponder.panHandlers}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
      >
        {/* Liquid Glass Track Trough */}
        <View pointerEvents="none" style={styles.trackBackground}>
          {/* Top specular reflection strip inside track */}
          <View style={styles.trackTopRim} />

          {/* Glowing Active Track Bar */}
          <LinearGradient
            colors={[accentColor, '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.trackActive,
              {
                width: percentageStr,
                opacity: fraction > 0.005 ? 1 : 0,
              },
            ]}
          />
        </View>

        {/* Liquid Glass Thumb Puck */}
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: percentageStr,
              borderColor: fraction > 0.005 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)',
              backgroundColor: fraction > 0.005 ? '#FFFFFF' : '#1C1C24',
            },
          ]}
        >
          {/* Internal reflective puck core */}
          <View
            style={[
              styles.thumbCore,
              {
                backgroundColor: fraction > 0.005 ? accentColor : '#444455',
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: '100%',
  },
  containerDisabled: {
    opacity: 0.45,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#D0D0DC',
    letterSpacing: 1.5,
  },
  valueText: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#9090A0',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  touchArea: {
    height: 42,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
    borderLeftColor: 'rgba(255, 255, 255, 0.18)',
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
    position: 'relative',
  },
  trackTopRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  trackActive: {
    height: '100%',
    borderRadius: 5,
  },
  thumb: {
    position: 'absolute',
    top: 9,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginLeft: -12, // Center puck over finger
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.45,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  thumbCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
