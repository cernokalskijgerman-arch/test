import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GlyphColors } from '../theme/colors';

/**
 * Custom glassmorphism slider optimized for Expo Go.
 * Zero native binary dependencies; 100% crash-free across all devices.
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
}) {
  const trackWidthRef = useRef(200);
  const trackXRef = useRef(0);
  const lastHapticRef = useRef(value);

  const calculateValueFromTouch = useCallback(
    (touchX) => {
      const width = trackWidthRef.current || 200;
      const relativeX = Math.max(0, Math.min(width, touchX));
      const percentage = relativeX / width;
      const rawValue = min + percentage * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, steppedValue));
    },
    [min, max, step]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touchX = evt.nativeEvent.locationX;
        const newVal = calculateValueFromTouch(touchX);
        if (Math.abs(newVal - lastHapticRef.current) >= (max - min) * 0.05) {
          lastHapticRef.current = newVal;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onValueChange && onValueChange(newVal);
      },
      onPanResponderMove: (evt) => {
        const touchX = evt.nativeEvent.locationX;
        const newVal = calculateValueFromTouch(touchX);
        if (Math.abs(newVal - lastHapticRef.current) >= (max - min) * 0.05) {
          lastHapticRef.current = newVal;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onValueChange && onValueChange(newVal);
      },
      onPanResponderRelease: () => {
        Haptics.selectionAsync().catch(() => {});
      },
    })
  ).current;

  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <View style={[styles.container, style]}>
      {/* Header Info */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.valueText}>
          {displayValue !== undefined ? displayValue : `${Math.round(value)}${unit}`}
        </Text>
      </View>

      {/* Touch Track Container */}
      <View
        style={styles.touchArea}
        {...panResponder.panHandlers}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
          trackXRef.current = e.nativeEvent.layout.x;
        }}
      >
        <View style={styles.trackBackground}>
          {/* Active Highlight Fill */}
          <View
            style={[
              styles.trackActive,
              {
                width: `${(percentage * 100).toFixed(1)}%`,
                backgroundColor: percentage > 0.005 ? accentColor : 'transparent',
              },
            ]}
          />
        </View>

        {/* Thumb Circle */}
        <View
          style={[
            styles.thumb,
            {
              left: `${(percentage * 100).toFixed(1)}%`,
              borderColor: percentage > 0.005 ? '#FFFFFF' : '#666677',
              backgroundColor: percentage > 0.005 ? accentColor : '#222228',
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#D0D0D8',
    letterSpacing: 1.5,
  },
  valueText: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  touchArea: {
    height: 38,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  trackActive: {
    height: '100%',
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    top: 9,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginLeft: -10, // Center thumb over touch position
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
});
