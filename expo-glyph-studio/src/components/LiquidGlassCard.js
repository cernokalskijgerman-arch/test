import React from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export default function LiquidGlassCard({
  children,
  style,
  onPress,
  isActive = false,
  intensity = 50,
}) {
  const CardContainer = onPress ? TouchableOpacity : View;

  return (
    <CardContainer
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        styles.outerContainer,
        isActive && styles.activeOuter,
        style,
      ]}
    >
      {/* Native frosted backdrop */}
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />

      {/* iOS Liquid Glass specular refraction sheen */}
      <LinearGradient
        colors={
          isActive
            ? ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.04)', 'rgba(15, 15, 22, 0.72)']
            : ['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.02)', 'rgba(14, 14, 18, 0.65)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.innerContent,
          isActive && styles.activeInner,
        ]}
      >
        {children}
      </View>
    </CardContainer>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderTopColor: 'rgba(255, 255, 255, 0.42)',
    borderLeftColor: 'rgba(255, 255, 255, 0.28)',
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(20, 20, 26, 0.35)' : 'rgba(16, 16, 22, 0.82)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  activeOuter: {
    borderColor: 'rgba(255, 255, 255, 0.55)',
    borderTopColor: 'rgba(255, 255, 255, 0.9)',
    borderLeftColor: 'rgba(255, 255, 255, 0.7)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOpacity: 0.3,
        shadowRadius: 22,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  innerContent: {
    padding: 18,
  },
  activeInner: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
});

