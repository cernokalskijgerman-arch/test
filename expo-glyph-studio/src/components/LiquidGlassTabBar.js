import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GlyphColors } from '../theme/colors';

/**
 * iOS-style Floating Liquid Glass Tab Bar.
 * Supports tap to switch, and re-tap to trigger Category Switcher mode.
 */
export default function LiquidGlassTabBar({
  tabs = [],
  currentTab = 0,
  onSelectTab,
  onOpenCategorySwitcher,
}) {
  const handleTabPress = (tabIndex) => {
    if (tabIndex === currentTab) {
      // Re-tap on currently active tab -> activate Category Switcher mode!
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onOpenCategorySwitcher && onOpenCategorySwitcher();
    } else {
      Haptics.selectionAsync().catch(() => {});
      onSelectTab && onSelectTab(tabIndex);
    }
  };

  return (
    <View style={styles.dockContainer}>
      <View style={styles.glassCapsule}>
        {/* Frosted glass background */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidFallback]} />
        )}

        {/* Specular gradient sheen */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.14)', 'rgba(20, 22, 32, 0.65)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top rim specular highlight line */}
        <View pointerEvents="none" style={styles.topRimHighlight} />

        {/* Tab Buttons */}
        <View style={styles.buttonsRow}>
          {tabs.map((tab) => {
            const isSelected = currentTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabButton,
                  isSelected && styles.tabButtonActive,
                ]}
                onPress={() => handleTabPress(tab.id)}
                activeOpacity={0.7}
              >
                {/* Active indicator dot above text */}
                {isSelected && <View style={styles.activeDot} />}
                <Text
                  style={[
                    styles.tabText,
                    isSelected && styles.tabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  glassCapsule: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.2,
    borderTopColor: GlyphColors.glassSpecularTop,
    borderLeftColor: GlyphColors.glassSpecularLeft,
    borderRightColor: GlyphColors.glassSpecularRight,
    borderBottomColor: GlyphColors.glassSpecularBottom,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(18, 20, 28, 0.40)' : 'rgba(16, 18, 24, 0.88)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  androidFallback: {
    backgroundColor: 'rgba(18, 20, 28, 0.90)',
  },
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 4,
    shadowColor: '#FFFFFF',
    shadowRadius: 4,
    shadowOpacity: 1,
  },
  tabText: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#8E8E98',
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
