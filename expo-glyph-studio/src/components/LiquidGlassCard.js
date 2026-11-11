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
import { GlyphColors } from '../theme/colors';

/**
 * iOS / visionOS authentic Liquid Glass Card.
 * Multi-layer optical refraction with specular rim highlights,
 * ambient depth shadow, and tactile fluid spring press deformation.
 */
export default function LiquidGlassCard({
  children,
  style,
  onPress,
  isActive = false,
  intensity = 45,
  variant = 'default', // 'default' | 'pill' | 'elevated' | 'subtle'
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sheenAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.982,
        tension: 180,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(sheenAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 160,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(sheenAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isPill = variant === 'pill';
  const borderRadius = isPill ? 30 : 24;

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
      {/* 1. Frosted Blur Background */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={intensity}
          tint="dark"
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.androidBlurFallback,
            { borderRadius },
          ]}
        />
      )}

      {/* 2. Deep optical glass refraction base gradient */}
      <LinearGradient
        colors={
          isActive
            ? ['rgba(255, 255, 255, 0.16)', 'rgba(25, 28, 40, 0.40)', 'rgba(10, 12, 18, 0.82)']
            : ['rgba(255, 255, 255, 0.08)', 'rgba(20, 22, 32, 0.35)', 'rgba(8, 10, 14, 0.78)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {/* 3. Diagonal specular light reflection sheen */}
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.14)',
          'rgba(255, 255, 255, 0.04)',
          'transparent',
          'rgba(255, 255, 255, 0.02)',
        ]}
        locations={[0, 0.28, 0.65, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.8 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {/* 4. Interactive touch light ripple sheen */}
      {onPress && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              opacity: sheenAnim,
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
            },
          ]}
        />
      )}

      {/* 5. Top Specular Glass Edge Highlight (Simulating 1px chamfered prism refraction) */}
      <View
        pointerEvents="none"
        style={[
          styles.topRimHighlight,
          {
            borderTopLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
          },
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.85)',
            'rgba(255, 255, 255, 0.40)',
            'rgba(255, 255, 255, 0.05)',
          ]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 0 }}
          style={styles.topRimGradient}
        />
      </View>

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
    borderWidth: 1.2,
    borderTopColor: GlyphColors.glassSpecularTop,
    borderLeftColor: GlyphColors.glassSpecularLeft,
    borderRightColor: GlyphColors.glassSpecularRight,
    borderBottomColor: GlyphColors.glassSpecularBottom,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(18, 20, 28, 0.35)' : 'rgba(16, 18, 24, 0.85)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  activeOuter: {
    borderTopColor: '#FFFFFF',
    borderLeftColor: 'rgba(255, 255, 255, 0.85)',
    borderRightColor: 'rgba(255, 255, 255, 0.45)',
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.25,
        shadowRadius: 22,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  androidBlurFallback: {
    backgroundColor: 'rgba(18, 20, 28, 0.88)',
  },
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    overflow: 'hidden',
  },
  topRimGradient: {
    flex: 1,
  },
  innerContent: {
    padding: 16,
  },
  pillInner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
