import React, { useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GlyphColors } from '../theme/colors';

const calculateSteppedValue = (raw, min, max, step) => {
  const safeStep = step > 0 ? step : 1;
  const clamped = Math.max(min, Math.min(max, raw));
  const stepped = Math.round((clamped - min) / safeStep) * safeStep + min;
  // Avoid floating-point drift on fractional steps while keeping integer steps exact
  const decimals = safeStep < 1 ? Math.max(0, Math.ceil(-Math.log10(safeStep))) : 0;
  const rounded = decimals > 0 ? Number(stepped.toFixed(decimals)) : Math.round(stepped);
  return Math.max(min, Math.min(max, rounded));
};

/**
 * iOS-style Liquid Glass Slider optimized for Expo Go & Android/iOS.
 * Features ref-synchronized props (zero stale closures), valid locationX tap seek
 * even mid-screen-transition, vertical ScrollView disambiguation, zero boundary
 * hysteresis (instant reverse from min/max), and NaN/undefined safety.
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
  compact = false,
}) {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const rawMax = Number(max);
  const safeMax = Number.isFinite(rawMax) && rawMax > safeMin ? rawMax : safeMin + 1;
  const rawStep = Number(step);
  const safeStep = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 1;
  const rawVal = Number(value);
  const safeValue = Number.isFinite(rawVal)
    ? Math.max(safeMin, Math.min(safeMax, rawVal))
    : safeMin;

  const trackRef = useRef(null);
  const trackWidthRef = useRef(200);
  const trackWindowXRef = useRef(null);
  const grantPageXRef = useRef(null);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalLockedRef = useRef(false);
  const lastReportedValRef = useRef(safeValue);
  const lastHapticValRef = useRef(safeValue);

  // Always keep latest props in a ref so PanResponder never captures stale closures
  const propsRef = useRef({
    value: safeValue,
    min: safeMin,
    max: safeMax,
    step: safeStep,
    disabled: Boolean(disabled),
    onValueChange,
  });
  propsRef.current = {
    value: safeValue,
    min: safeMin,
    max: safeMax,
    step: safeStep,
    disabled: Boolean(disabled),
    onValueChange,
  };

  if (!isDraggingRef.current) {
    lastReportedValRef.current = safeValue;
    lastHapticValRef.current = safeValue;
  }

  const measureTrackWindow = () => {
    const node = trackRef.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((wx, _wy, ww) => {
        if (typeof wx === 'number' && !Number.isNaN(wx)) {
          trackWindowXRef.current = wx;
        }
        if (typeof ww === 'number' && ww > 0) {
          trackWidthRef.current = ww;
        }
      });
    }
  };

  const triggerHapticIfThreshold = (newVal, minVal, maxVal, stepVal) => {
    const range = maxVal - minVal;
    const threshold = Math.max(stepVal, range * 0.05);
    if (Math.abs(newVal - lastHapticValRef.current) >= threshold) {
      lastHapticValRef.current = newVal;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          !propsRef.current.disabled &&
          (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2)
        );
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return (
          !propsRef.current.disabled &&
          Math.abs(gestureState.dx) > 4 &&
          Math.abs(gestureState.dx) >= Math.abs(gestureState.dy)
        );
      },
      // Yield to ScrollView during vertical scroll before horizontal lock; lock permanently once dragging horizontally
      onPanResponderTerminationRequest: (_, gestureState) => {
        if (isHorizontalLockedRef.current) return false;
        const absDx = Math.abs(gestureState?.dx || 0);
        const absDy = Math.abs(gestureState?.dy || 0);
        if (absDx > 4 && absDx >= absDy) {
          isHorizontalLockedRef.current = true;
          return false;
        }
        if (absDy > 8 && absDy > absDx * 1.4) {
          return true;
        }
        return false;
      },
      onShouldBlockNativeResponder: () => isHorizontalLockedRef.current,
      onPanResponderGrant: (evt) => {
        const {
          value: curVal,
          min: curMin,
          max: curMax,
          step: curStep,
          disabled: isDisabled,
          onValueChange: curOnChange,
        } = propsRef.current;
        if (isDisabled) return;

        isDraggingRef.current = true;
        isHorizontalLockedRef.current = false;
        measureTrackWindow();

        const width = trackWidthRef.current > 0 ? trackWidthRef.current : 200;
        const pageX = evt?.nativeEvent?.pageX;
        const locationX = evt?.nativeEvent?.locationX;
        grantPageXRef.current = typeof pageX === 'number' && !Number.isNaN(pageX) ? pageX : null;

        const currentFraction = Math.max(0, Math.min(1, (curVal - curMin) / (curMax - curMin || 1)));
        const currentThumbX = currentFraction * width;

        let rawTouchX;
        // Child layers have pointerEvents="none", so valid locationX is exact even during tab slide animation
        if (
          typeof locationX === 'number' &&
          !Number.isNaN(locationX) &&
          locationX >= 0 &&
          locationX <= width
        ) {
          rawTouchX = locationX;
        } else if (trackWindowXRef.current !== null && grantPageXRef.current !== null) {
          rawTouchX = grantPageXRef.current - trackWindowXRef.current;
        } else {
          rawTouchX = currentThumbX;
        }

        const touchX = Math.max(0, Math.min(width, rawTouchX));

        // If touched near existing thumb puck (within 24px), anchor to thumb position
        // If touched on the track to seek, seek directly to touch point
        const initialX = Math.abs(touchX - currentThumbX) <= 24 ? currentThumbX : touchX;
        startXRef.current = initialX;

        const fraction = initialX / width;
        const rawVal = curMin + fraction * (curMax - curMin);
        const newVal = calculateSteppedValue(rawVal, curMin, curMax, curStep);

        lastReportedValRef.current = newVal;
        lastHapticValRef.current = newVal;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (newVal !== curVal && curOnChange) {
          curOnChange(newVal);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const {
          min: curMin,
          max: curMax,
          step: curStep,
          disabled: isDisabled,
          onValueChange: curOnChange,
        } = propsRef.current;
        if (isDisabled) return;

        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);

        if (!isHorizontalLockedRef.current) {
          if (absDy > 8 && absDy > absDx * 1.4) {
            return;
          }
          if (absDx > 4 && absDx >= absDy) {
            isHorizontalLockedRef.current = true;
          }
        }

        const width = trackWidthRef.current > 0 ? trackWidthRef.current : 200;
        const pageX = evt?.nativeEvent?.pageX;
        const delta =
          typeof pageX === 'number' && !Number.isNaN(pageX) && grantPageXRef.current !== null
            ? pageX - grantPageXRef.current
            : gestureState.dx;

        let currentX = startXRef.current + delta;

        // Prevent boundary hysteresis / dead zone:
        // When finger overshoots beyond track edges, dynamically adjust startX
        // so reverse dragging instantly responds on the very first pixel
        if (currentX > width) {
          startXRef.current = width - delta;
          currentX = width;
        } else if (currentX < 0) {
          startXRef.current = -delta;
          currentX = 0;
        }

        const fraction = Math.max(0, Math.min(1, currentX / width));
        const rawVal = curMin + fraction * (curMax - curMin);
        const newVal = calculateSteppedValue(rawVal, curMin, curMax, curStep);

        if (newVal !== lastReportedValRef.current) {
          const wasBoundary =
            (newVal === curMin && lastReportedValRef.current !== curMin) ||
            (newVal === curMax && lastReportedValRef.current !== curMax);

          lastReportedValRef.current = newVal;

          if (wasBoundary) {
            // Tactile bump at limit (0% or 100%)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          } else {
            triggerHapticIfThreshold(newVal, curMin, curMax, curStep);
          }

          if (curOnChange) {
            curOnChange(newVal);
          }
        }
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        isHorizontalLockedRef.current = false;
        grantPageXRef.current = null;
        if (propsRef.current.disabled) return;
        Haptics.selectionAsync().catch(() => {});
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        isHorizontalLockedRef.current = false;
        grantPageXRef.current = null;
      },
    })
  ).current;

  const fraction = Math.max(0, Math.min(1, (safeValue - safeMin) / (safeMax - safeMin || 1)));
  const percentageStr = `${(fraction * 100).toFixed(1)}%`;

  return (
    <View style={[styles.container, compact && styles.containerCompact, disabled && styles.containerDisabled, style]}>
      {/* Label and Value Row */}
      {Boolean(label && `${label}`.trim().length > 0) && (
        <View style={[styles.labelRow, compact && styles.labelRowCompact]}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.valueText, fraction > 0 && { color: '#FFFFFF' }]}>
            {displayValue !== undefined ? displayValue : `${Math.round(safeValue)}${unit}`}
          </Text>
        </View>
      )}

      {/* Touch Interaction Container */}
      <View
        ref={trackRef}
        collapsable={false}
        style={[styles.touchArea, compact && styles.touchAreaCompact]}
        {...panResponder.panHandlers}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) trackWidthRef.current = w;
          measureTrackWindow();
        }}
      >
        {/* Liquid Glass Track Trough */}
        <View pointerEvents="none" style={[styles.trackBackground, compact && styles.trackBackgroundCompact]}>
          {/* Top specular reflection strip inside track */}
          <View pointerEvents="none" style={styles.trackTopRim} />

          {/* Glowing Active Track Bar */}
          <LinearGradient
            pointerEvents="none"
            colors={[accentColor, '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.trackActive,
              compact && styles.trackActiveCompact,
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
            compact && styles.thumbCompact,
            {
              left: percentageStr,
              borderColor: fraction > 0.005 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.45)',
              backgroundColor: fraction > 0.005 ? '#FFFFFF' : '#1C1C24',
            },
          ]}
        >
          {/* Internal reflective puck core */}
          <View
            pointerEvents="none"
            style={[
              styles.thumbCore,
              compact && styles.thumbCoreCompact,
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
    marginVertical: 3,
    width: '100%',
  },
  containerCompact: {
    marginVertical: 1,
  },
  containerDisabled: {
    opacity: 0.45,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  labelRowCompact: {
    marginBottom: 2,
  },
  label: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#D0D0DC',
    letterSpacing: 1.2,
  },
  valueText: {
    fontFamily: 'NDOT57',
    fontSize: 10.5,
    color: '#A4A4B6',
    letterSpacing: 0.8,
  },
  touchArea: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  touchAreaCompact: {
    height: 24,
  },
  trackBackground: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
    position: 'relative',
  },
  trackBackgroundCompact: {
    height: 5,
    borderRadius: 2.5,
  },
  trackTopRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  trackActive: {
    height: '100%',
    borderRadius: 3.5,
  },
  trackActiveCompact: {
    borderRadius: 2.5,
  },
  thumb: {
    position: 'absolute',
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    marginLeft: -10, // Center puck over finger
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  thumbCompact: {
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  thumbCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  thumbCoreCompact: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
