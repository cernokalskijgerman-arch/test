import React from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlyphColors } from '../theme/colors';

export default function LiquidGlassCard({
  children,
  style,
  onPress,
  isActive = false,
  intensity = 60,
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
      <BlurView
        intensity={intensity}
        tint="dark"
        style={styles.blurView}
      >
        <View
          style={[
            styles.innerContent,
            isActive && styles.activeInner,
          ]}
        >
          {children}
        </View>
      </BlurView>
    </CardContainer>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderTopWidth: 1.5,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(20, 20, 25, 0.3)' : 'rgba(18, 18, 22, 0.85)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  activeOuter: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  blurView: {
    width: '100%',
    height: '100%',
  },
  innerContent: {
    padding: 16,
  },
  activeInner: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
});
