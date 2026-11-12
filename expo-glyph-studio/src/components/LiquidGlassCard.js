import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Animated,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Authentic Liquid Glass Card matching modern iOS 17/18 Control Center & Widgets.
 * Incorporates hardware-accelerated blur, physical specular sheen gradient,
 * chamfered top rim highlight, and tactile spring micro-compression.
 */
export default function LiquidGlassCard({
  children,
  style,
  onPress,
  isActive = false,
  intensity,
  variant = 'default', // 'default' | 'pill' | 'compact'
  compact = false,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sheenAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.985,
        tension: 220,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(sheenAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 200,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(sheenAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isPill = variant === 'pill';
  const isCompact = variant === 'compact' || compact;
  const borderRadius = isPill ? 24 : isCompact ? 14 : 18;

  const defaultIntensity = Platform.OS === 'ios' ? 45 : 30;
  const blurIntensity = intensity !== undefined ? intensity : defaultIntensity;

  const cardContent = (
    <Animated.View
      style={[
        styles.outerContainer,
        { borderRadius },
        isActive && styles.activeOuter,
        onPress && { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      {/* 1. Frosted Blur Background (Hardware accelerated on iOS and Android) */}
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {/* 2. Liquid Glass physical specular sheen gradient */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.16)',
          'rgba(255, 255, 255, 0.03)',
          'rgba(0, 0, 0, 0.22)',
        ]}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* 3. Diagonal secondary prism sheen */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.09)',
          'transparent',
          'rgba(255, 255, 255, 0.02)',
        ]}
        locations={[0, 0.38, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* 4. Interactive touch ripple sheen */}
      {onPress && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              opacity: sheenAnim,
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
            },
          ]}
        />
      )}

      {/* 5. Top Specular Glass Chamfer Edge Highlight */}
      <View
        pointerEvents="none"
        style={[
          styles.topRimHighlight,
          {
            borderTopLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
          },
        ]}
      />

      {/* 6. Active Halo Ambient Rim */}
      {isActive && (
        <View
          pointerEvents="none"
          style={[styles.activeHaloRim, { borderRadius }]}
        />
      )}

      {/* Card Content Body */}
      <View style={[styles.innerContent, isPill && styles.pillInner, isCompact && styles.compactInner]}>
        {children}
      </View>
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableWithoutFeedback
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {cardContent}
      </TouchableWithoutFeedback>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  outerContainer: {
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.30)',
    backgroundColor: 'rgba(18, 20, 30, 0.62)', // Frosted Liquid Glass
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  activeOuter: {
    borderColor: 'rgba(255, 255, 255, 0.50)',
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.20,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  activeHaloRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  innerContent: {
    padding: 12,
  },
  compactInner: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pillInner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
