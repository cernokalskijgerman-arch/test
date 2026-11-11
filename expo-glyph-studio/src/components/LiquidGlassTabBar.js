import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GlyphColors } from '../theme/colors';

/**
 * iOS-style Floating Liquid Glass Tab Bar.
 * Features a dynamic sliding liquid glass indicator pill that glides smoothly
 * between tabs, tap-to-switch, re-tap to trigger Category Switcher mode,
 * and direct horizontal swipe gestures along the dock.
 */
export default function LiquidGlassTabBar({
  tabs = [],
  currentTab = 0,
  onSelectTab,
  onOpenCategorySwitcher,
}) {
  const [barWidth, setBarWidth] = useState(0);
  const pillAnim = useRef(new Animated.Value(currentTab)).current;
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;

  useEffect(() => {
    Animated.spring(pillAnim, {
      toValue: currentTab,
      tension: 140,
      friction: 14,
      useNativeDriver: false,
    }).start();
  }, [currentTab]);

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

  // Direct swipe gesture along the tab bar dock
  const tabPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const cur = currentTabRef.current;
        if (gestureState.dx < -30 && cur < tabs.length - 1) {
          handleTabPress(cur + 1);
        } else if (gestureState.dx > 30 && cur > 0) {
          handleTabPress(cur - 1);
        }
      },
    })
  ).current;

  const tabCount = tabs.length || 1;
  const tabWidth = barWidth > 0 ? (barWidth - 8) / tabCount : 0;

  const pillLeft = tabWidth > 0
    ? pillAnim.interpolate({
        inputRange: tabs.map((_, i) => i),
        outputRange: tabs.map((_, i) => 4 + i * tabWidth),
      })
    : 4;

  return (
    <View style={styles.dockContainer} {...tabPanResponder.panHandlers}>
      <View
        style={styles.glassCapsule}
        onLayout={(e) => {
          setBarWidth(e.nativeEvent.layout.width);
        }}
      >
        {/* Frosted glass background (hardware accelerated on iOS and Android) */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 55 : 40}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

        {/* Specular gradient sheen */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.12)', 'rgba(18, 20, 30, 0.55)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top rim specular highlight line */}
        <View pointerEvents="none" style={styles.topRimHighlight} />

        {/* Sliding Liquid Glass Indicator Pill */}
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.slidingPill,
              {
                width: tabWidth,
                left: pillLeft,
              },
            ]}
          >
            {/* Pill Specular Highlight */}
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.28)',
                'rgba(255, 255, 255, 0.12)',
                'rgba(255, 255, 255, 0.05)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Pill top specular line */}
            <View style={styles.pillTopRim} />
          </Animated.View>
        )}

        {/* Tab Buttons */}
        <View style={styles.buttonsRow}>
          {tabs.map((tab) => {
            const isSelected = currentTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.tabButton}
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
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  glassCapsule: {
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.2,
    borderTopColor: GlyphColors.glassSpecularTop,
    borderLeftColor: GlyphColors.glassSpecularLeft,
    borderRightColor: GlyphColors.glassSpecularRight,
    borderBottomColor: GlyphColors.glassSpecularBottom,
    backgroundColor: 'rgba(16, 18, 26, 0.50)',
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
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
  },
  slidingPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.40)',
    borderRightColor: 'rgba(255, 255, 255, 0.25)',
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  pillTopRim: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    position: 'relative',
    zIndex: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 3,
    shadowColor: '#FFFFFF',
    shadowRadius: 5,
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
