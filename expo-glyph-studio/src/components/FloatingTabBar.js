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
  Orbit,
  LayoutGrid,
  AudioLines,
  Wrench,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const BAR_HEIGHT = 64;
const BAR_RADIUS = 32;
const PILL_INSET = 6;

const DEFAULT_ICONS = [
  SlidersHorizontal,
  Orbit || SlidersHorizontal,
  LayoutGrid || SlidersHorizontal,
  AudioLines || SlidersHorizontal,
  Wrench,
];

const COMPACT_TAB_LABELS = {
  0: 'КОНТРОЛЬ',
  1: 'ОБХОД',
  2: 'РИТМ',
  3: 'МУЗЫКА',
  4: 'УТИЛИТЫ',
};

const COMPACT_LABEL_BY_RAW = {
  'АВТО-ОБХОД': 'ОБХОД',
  'СЕКВЕНСОР': 'РИТМ',
};

const TAB_HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };
const PILL_SPRING_CONFIG = {
  mass: 0.55,
  damping: 19,
  stiffness: 220,
  overshootClamping: false,
};
const SCRUB_SPRING_CONFIG = {
  mass: 0.35,
  damping: 16,
  stiffness: 280,
};

/**
 * Floating Glassmorphic Tab Bar with Liquid Glass refraction,
 * dynamic sliding indicator pill, smooth 1:1 press-and-drag scrubbing across tabs,
 * always-visible compact tab labels, and non-blocking pointer layers.
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

  const INNER_WIDTH = Math.max(1, containerWidth - 2);
  const TAB_WIDTH = INNER_WIDTH / tabCount;

  // Animated sliding pill position & scrub scale feedback
  const translateX = useSharedValue(activeIndex * TAB_WIDTH);
  const scrubActive = useSharedValue(0);

  // Synchronized refs for live state & props to eliminate stale closures
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const lastActiveIndexRef = useRef(activeIndex);
  const isScrubbingRef = useRef(false);
  const scrubActivatedRef = useRef(false);
  if (!isScrubbingRef.current) {
    lastActiveIndexRef.current = activeIndex;
  }

  const stateRef = useRef(state);
  stateRef.current = state;

  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  const onSelectTabRef = useRef(onSelectTab);
  onSelectTabRef.current = onSelectTab;

  const widthRef = useRef(INNER_WIDTH);
  widthRef.current = INNER_WIDTH;

  const tabWidthRef = useRef(TAB_WIDTH);
  tabWidthRef.current = TAB_WIDTH;

  const tabCountRef = useRef(tabCount);
  tabCountRef.current = tabCount;

  const barRef = useRef(null);
  const barWindowXRef = useRef(null);
  const barWindowWidthRef = useRef(INNER_WIDTH);
  const touchStartTimeRef = useRef(0);

  useEffect(() => {
    if (!isScrubbingRef.current) {
      translateX.value = withSpring(activeIndex * TAB_WIDTH, PILL_SPRING_CONFIG);
    }
  }, [activeIndex, TAB_WIDTH, translateX]);

  const indicatorAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: 1 + scrubActive.value * 0.04 },
    ],
  }));

  const measureBarWindow = useCallback(() => {
    const node = barRef.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((wx, _wy, ww) => {
        if (typeof wx === 'number' && !Number.isNaN(wx)) {
          barWindowXRef.current = wx;
        }
        if (typeof ww === 'number' && ww > 0) {
          barWindowWidthRef.current = ww;
        }
      });
    }
  }, []);

  const dispatchTabSelect = useCallback((index) => {
    const nav = navigationRef.current;
    const st = stateRef.current;
    const onSelect = onSelectTabRef.current;

    if (st && nav) {
      const route = st.routes[index];
      if (route) {
        const event = nav.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!event.defaultPrevented) {
          nav.navigate(route.name);
        }
      }
    } else if (onSelect) {
      onSelect(index);
    }
  }, []);

  const handlePress = useCallback((index) => {
    if (isScrubbingRef.current || scrubActivatedRef.current) {
      return;
    }
    if (activeIndexRef.current === index) {
      return;
    }
    lastActiveIndexRef.current = index;
    const pillTabW = tabWidthRef.current > 0 ? tabWidthRef.current : (widthRef.current / (tabCountRef.current || 5));
    translateX.value = withSpring(index * pillTabW, PILL_SPRING_CONFIG);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    dispatchTabSelect(index);
  }, [dispatchTabSelect, translateX]);

  const processScrubEvent = useCallback((evt) => {
    const fallbackW = widthRef.current > 0 ? widthRef.current : (width - paddingHorizontal * 2 - 2);
    const barW = barWindowWidthRef.current > 0 ? barWindowWidthRef.current : fallbackW;
    const count = tabCountRef.current || 5;
    const tabW = barW / count;
    const pageX = evt?.nativeEvent?.pageX;

    let relX;
    if (barWindowXRef.current !== null && typeof pageX === 'number' && !Number.isNaN(pageX)) {
      relX = pageX - barWindowXRef.current;
    } else if (typeof evt?.nativeEvent?.locationX === 'number') {
      relX = evt.nativeEvent.locationX;
    } else {
      relX = (activeIndexRef.current + 0.5) * tabW;
    }

    const clampedX = Math.max(0, Math.min(barW, relX));
    const target = Math.max(0, Math.min(count - 1, Math.floor(clampedX / tabW)));

    // Direct 1:1 pill tracking with subtle magnetic blend during active scrub (no per-frame spring spawn)
    const pillTabW = tabWidthRef.current > 0 ? tabWidthRef.current : tabW;
    const freeX = Math.max(0, Math.min((count - 1) * pillTabW, clampedX - pillTabW / 2));
    const magnetX = target * pillTabW;
    const targetPillX = freeX * 0.65 + magnetX * 0.35;

    translateX.value = targetPillX;

    if (target !== lastActiveIndexRef.current) {
      lastActiveIndexRef.current = target;
      Haptics.selectionAsync().catch(() => {});
      dispatchTabSelect(target);
    }
  }, [dispatchTabSelect, paddingHorizontal, translateX]);

  const finishScrub = useCallback(() => {
    isScrubbingRef.current = false;
    scrubActive.value = withSpring(0, SCRUB_SPRING_CONFIG);
    const finalIdx = lastActiveIndexRef.current;
    const pillTabW = tabWidthRef.current > 0 ? tabWidthRef.current : (widthRef.current / (tabCountRef.current || 5));
    translateX.value = withSpring(finalIdx * pillTabW, PILL_SPRING_CONFIG);
  }, [scrubActive, translateX]);

  const scrubResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => {
        touchStartTimeRef.current = Date.now();
        scrubActivatedRef.current = false;
        measureBarWindow();
        return false;
      },
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        const heldMs = Date.now() - touchStartTimeRef.current;
        if (absDx > 6 && absDx >= absDy * 0.85) return true;
        if (heldMs > 140 && absDx > 2 && absDx >= absDy * 0.7) return true;
        return false;
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        isScrubbingRef.current = true;
        scrubActivatedRef.current = true;
        scrubActive.value = withSpring(1, SCRUB_SPRING_CONFIG);
        measureBarWindow();
        processScrubEvent(evt);
      },
      onPanResponderMove: (evt) => {
        if (!isScrubbingRef.current) {
          isScrubbingRef.current = true;
          scrubActivatedRef.current = true;
          scrubActive.value = withSpring(1, SCRUB_SPRING_CONFIG);
        }
        processScrubEvent(evt);
      },
      onPanResponderRelease: () => {
        finishScrub();
      },
      onPanResponderTerminate: () => {
        finishScrub();
      },
    })
  ).current;

  const bottomOffset = Platform.OS === 'ios'
    ? Math.max(insets?.bottom || 0, 16) + 4
    : Math.max(insets?.bottom || 0, 12) + 8;

  const inactiveColor = 'rgba(210, 215, 230, 0.72)';

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
      >
        <View
          ref={barRef}
          collapsable={false}
          style={styles.barInner}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) {
              barWindowWidthRef.current = w;
            }
            measureBarWindow();
          }}
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
              pointerEvents="none"
              style={[
                styles.pill,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                  borderColor: 'rgba(255, 255, 255, 0.38)',
                  shadowColor: '#FFFFFF',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.28,
                  shadowRadius: 10,
                },
              ]}
            >
              {/* Specular gradient inside pill */}
              <LinearGradient
                pointerEvents="none"
                colors={[
                  'rgba(255, 255, 255, 0.32)',
                  'rgba(255, 255, 255, 0.08)',
                  'transparent',
                ]}
                style={StyleSheet.absoluteFill}
              />
              {/* Top specular highlight edge */}
              <View pointerEvents="none" style={styles.pillTopRim} />
            </View>
          </Animated.View>

          {/* Tab Item Buttons */}
          {routes.map((route, index) => {
            const isFocused = activeIndex === index;
            const color = isFocused ? activeColor : inactiveColor;
            const rawLabel = route.label || (descriptors && descriptors[route.key]?.options?.title) || route.name;
            const label = COMPACT_TAB_LABELS[index] || COMPACT_LABEL_BY_RAW[rawLabel] || rawLabel;
            const IconComponent = DEFAULT_ICONS[index % DEFAULT_ICONS.length];

            return (
              <Pressable
                key={route.id !== undefined ? route.id : (route.key || index)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={rawLabel || label}
                hitSlop={TAB_HIT_SLOP}
                onPress={() => handlePress(index)}
                style={[styles.tab, { width: TAB_WIDTH }]}
              >
                <TabItem
                  isFocused={isFocused}
                  color={color}
                  label={label}
                  IconComponent={IconComponent}
                />
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const TabItem = React.memo(function TabItem({
  isFocused,
  color,
  label,
  IconComponent,
}) {
  const iconScale = useSharedValue(isFocused ? 1.06 : 0.92);

  useEffect(() => {
    iconScale.value = withSpring(isFocused ? 1.06 : 0.92, {
      mass: 0.45,
      damping: 14,
      stiffness: 240,
    });
  }, [isFocused, iconScale]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <View
      pointerEvents="none"
      style={styles.tabContent}
    >
      <Animated.View style={iconAnimStyle} pointerEvents="none">
        {IconComponent && (
          <IconComponent
            color={color}
            size={19}
            strokeWidth={isFocused ? 2.2 : 1.8}
          />
        )}
      </Animated.View>

      {Boolean(label) && (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[styles.label, { color }]}
        >
          {label}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    zIndex: 100,
  },
  blurBar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
  },
  barInner: {
    flex: 1,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
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
    paddingHorizontal: 2,
    zIndex: 5,
    elevation: 5,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '100%',
  },
  label: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    letterSpacing: 0.4,
    marginTop: 1,
    textAlign: 'center',
  },
});

export default React.memo(FloatingTabBar);
