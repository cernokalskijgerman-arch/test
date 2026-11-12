import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  Pressable,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SlidersHorizontal,
  Cpu,
  Layers,
  Radio,
  Wrench,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const BAR_HEIGHT = 64;
const BAR_RADIUS = 32;
const PILL_INSET = 6;

const DEFAULT_ICONS = [
  SlidersHorizontal, // Tab 0: КОНТРОЛЬ
  Cpu,               // Tab 1: ПИКСЕЛИ
  Layers,            // Tab 2: СЕКВЕНСОР
  Radio,             // Tab 3: МУЗЫКА
  Wrench,            // Tab 4: УТИЛИТЫ
];

/**
 * Floating Glassmorphic Tab Bar with Liquid Glass refraction,
 * dynamic sliding indicator pill, tactile spring compression,
 * safe area insets, and iOS-style re-tap category switching.
 */
export function FloatingTabBar({
  tabs = [],
  currentTab = 0,
  onSelectTab,
  onOpenCategorySwitcher,
  activeColor = '#FFFFFF',
  paddingHorizontal = 16,
  state,
  descriptors,
  navigation,
}) {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(width - paddingHorizontal * 2);

  // Normalize for both standalone usage (tabs array) and React Navigation / Expo Router
  const routes = state ? state.routes : tabs;
  const activeIndex = state ? state.index : currentTab;
  const tabCount = routes.length || 1;

  const INNER_WIDTH = containerWidth - 2;
  const TAB_WIDTH = INNER_WIDTH / tabCount;

  // Animated sliding pill position using Reanimated spring physics
  const translateX = useSharedValue(activeIndex * TAB_WIDTH);

  useEffect(() => {
    translateX.value = withSpring(activeIndex * TAB_WIDTH, {
      mass: 0.6,
      damping: 18,
      stiffness: 180,
      overshootClamping: false,
    });
  }, [activeIndex, TAB_WIDTH]);

  const indicatorAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handlePress = useCallback((index) => {
    const isFocused = activeIndex === index;

    if (isFocused) {
      // Re-tap on active tab: safely do nothing, never open unwanted popup modals
      return;
    }

    // Light tactile feedback on tab switch
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (state && navigation) {
      const route = state.routes[index];
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    } else if (onSelectTab) {
      onSelectTab(index);
    }
  }, [activeIndex, state, navigation, onSelectTab]);

  // Real-time Scrubbing / Drag-to-Select (Зажатие и наведение на нужный пункт)
  const lastActiveIndexRef = useRef(activeIndex);
  lastActiveIndexRef.current = activeIndex;

  const widthRef = useRef(INNER_WIDTH);
  widthRef.current = INNER_WIDTH;

  const tabCountRef = useRef(tabCount);
  tabCountRef.current = tabCount;

  const isScrubbingRef = useRef(false);

  const calculateIndexFromLocation = useCallback((x) => {
    const w = widthRef.current > 0 ? widthRef.current : (width - paddingHorizontal * 2 - 2);
    const count = tabCountRef.current || 5;
    const tabW = w / count;
    const idx = Math.floor(x / tabW);
    return Math.max(0, Math.min(count - 1, idx));
  }, [paddingHorizontal]);

  const scrubResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: (evt) => {
        isScrubbingRef.current = false;
        const x = evt.nativeEvent.locationX;
        const target = calculateIndexFromLocation(x);
        if (target !== lastActiveIndexRef.current) {
          lastActiveIndexRef.current = target;
          handlePress(target);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        isScrubbingRef.current = true;
        const x = evt.nativeEvent.locationX;
        const target = calculateIndexFromLocation(x);
        if (target !== lastActiveIndexRef.current) {
          lastActiveIndexRef.current = target;
          handlePress(target);
        }
      },
      onPanResponderRelease: () => {
        isScrubbingRef.current = false;
      },
      onPanResponderTerminate: () => {
        isScrubbingRef.current = false;
      },
    })
  ).current;

  const bottomOffset = Platform.OS === 'ios'
    ? Math.max(insets?.bottom || 0, 16) + 4
    : Math.max(insets?.bottom || 0, 12) + 8;

  const inactiveColor = 'rgba(160, 165, 185, 0.65)';

  return (
    <View
      style={[
        styles.outerWrapper,
        {
          bottom: bottomOffset,
          left: paddingHorizontal,
          right: paddingHorizontal,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.45,
          shadowRadius: 24,
          elevation: 16,
        },
      ]}
      pointerEvents="box-none"
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setContainerWidth(w);
      }}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 45 : 30}
        tint="dark"
        style={[
          styles.blurBar,
          {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255, 255, 255, 0.16)',
            backgroundColor: 'rgba(14, 16, 24, 0.68)',
          },
        ]}
        {...scrubResponder.panHandlers}
      >
        {/* Specular physical reflection gradient sheen */}
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.22)',
            'rgba(255, 255, 255, 0.02)',
            'rgba(0, 0, 0, 0.42)',
          ]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Top edge chamfered specular rim highlight */}
        <View pointerEvents="none" style={styles.topRimHighlight} />

        {/* Sliding Liquid Glass Pill Indicator */}
        <Animated.View
          style={[styles.pillWrapper, { width: TAB_WIDTH }, indicatorAnimStyle]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.pill,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.14)',
                borderColor: 'rgba(255, 255, 255, 0.38)',
                shadowColor: '#FFFFFF',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.28,
                shadowRadius: 10,
                elevation: 4,
              },
            ]}
          >
            {/* Specular gradient inside pill */}
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.32)',
                'rgba(255, 255, 255, 0.08)',
                'transparent',
              ]}
              style={StyleSheet.absoluteFill}
            />
            {/* Top specular highlight edge */}
            <View style={styles.pillTopRim} />
          </View>
        </Animated.View>

        {/* Tab Item Buttons */}
        {routes.map((route, index) => {
          const isFocused = activeIndex === index;
          const color = isFocused ? activeColor : inactiveColor;
          const label = route.label || (descriptors && descriptors[route.key]?.options?.title) || route.name;
          const IconComponent = DEFAULT_ICONS[index % DEFAULT_ICONS.length];

          return (
            <TabItem
              key={route.id !== undefined ? route.id : (route.key || index)}
              isFocused={isFocused}
              color={color}
              label={label}
              IconComponent={IconComponent}
              tabWidth={TAB_WIDTH}
            />
          );
        })}
      </BlurView>
    </View>
  );
}

function TabItem({
  isFocused,
  color,
  label,
  IconComponent,
  tabWidth,
}) {
  const iconScale = useSharedValue(isFocused ? 1.0 : 0.85);

  useEffect(() => {
    iconScale.value = withSpring(isFocused ? 1.0 : 0.85, {
      mass: 0.5,
      damping: 12,
      stiffness: 200,
    });
  }, [isFocused]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <View
      pointerEvents="none"
      style={[styles.tab, { width: tabWidth }]}
    >
      <View style={styles.tabContent}>
        <Animated.View style={iconAnimStyle}>
          {IconComponent && (
            <IconComponent
              color={color}
              size={isFocused ? 20 : 18}
              strokeWidth={isFocused ? 2.4 : 1.8}
            />
          )}
        </Animated.View>

        {isFocused && label && (
          <Text numberOfLines={1} style={[styles.label, { color }]}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    zIndex: 100,
  },
  blurBar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  pillWrapper: {
    position: 'absolute',
    left: 0,
    top: PILL_INSET,
    bottom: PILL_INSET,
    zIndex: 1,
    elevation: 1,
    paddingHorizontal: PILL_INSET,
  },
  pill: {
    flex: 1,
    borderRadius: BAR_RADIUS - PILL_INSET,
    overflow: 'hidden',
    borderWidth: 1,
  },
  pillTopRim: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  tab: {
    height: BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    elevation: 2,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    letterSpacing: 0.6,
    marginTop: 1,
    color: '#FFFFFF',
  },
});

export default FloatingTabBar;
