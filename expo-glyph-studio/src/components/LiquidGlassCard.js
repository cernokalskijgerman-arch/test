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
 * Authentic Liquid Glass Card matching Floating Glassmorphic Tab Bar.
 * Incorporates hardware-accelerated blur, physical specular sheen gradient,
 * chamfered top rim highlight, and tactile spring micro-compression.
 */
export default function LiquidGlassCard({
  children,
  style,
  onPress,
  isActive = false,
  intensity = 40,
  variant = 'default', // 'default' | 'pill' | 'compact'
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sheenAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.985,
        tension: 200,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(sheenAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 180,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(sheenAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isPill = variant === 'pill';
  const borderRadius = isPill ? 24 : 18;

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
        intensity={Platform.OS === 'ios' ? 25 : 18}
        tint="dark"
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {/* 2. Liquid Glass physical specular sheen gradient (99% transparent glass) */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.08)',
          'rgba(255, 255, 255, 0.01)',
          'rgba(0, 0, 0, 0.02)',
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        pointerEvents="none"
      />

      {/* 3. Diagonal secondary prism sheen */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.04)',
          'transparent',
          'rgba(255, 255, 255, 0.01)',
        ]}
        locations={[0, 0.4, 1]}
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
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          ]}
        />
      )}

      {/* 5. Top Specular Glass Edge Highlight */}
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
      <View style={[styles.innerContent, isPill && styles.pillInner]}>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: 'rgba(255, 255, 255, 0.015)', // ~99% transparent Liquid Glass
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  activeOuter: {
    borderColor: 'rgba(255, 255, 255, 0.32)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  activeHaloRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  innerContent: {
    padding: 12,
  },
  pillInner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
