import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  PanResponder,
  Animated,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlyphColors } from './src/theme/colors';

import GlyphCameraSilhouette from './src/components/GlyphCameraSilhouette';
import LiquidGlassTabBar from './src/components/LiquidGlassTabBar';
import CategorySwitcherModal from './src/components/CategorySwitcherModal';

import ControlScreen from './src/screens/ControlScreen';
import PixelsScreen from './src/screens/PixelsScreen';
import SequencerScreen from './src/screens/SequencerScreen';
import VisualizerScreen from './src/screens/VisualizerScreen';
import UtilitiesScreen from './src/screens/UtilitiesScreen';

const TABS = [
  { id: 0, label: 'КОНТРОЛЬ', subtitle: 'Питание, яркость и 3 дуги' },
  { id: 1, label: 'ПИКСЕЛИ', subtitle: '36 LED и авто-обход' },
  { id: 2, label: 'СЕКВЕНСОР', subtitle: '16-шаговые ритмы' },
  { id: 3, label: 'МУЗЫКА', subtitle: 'FFT визуализатор частот' },
  { id: 4, label: 'УТИЛИТЫ', subtitle: 'Фонарик, таймер, аркада' },
];

export default function App() {
  const [fontsLoaded] = useFonts({
    'NDOT57': require('./assets/fonts/Ndot57.otf'),
  });

  const [currentTab, setCurrentTab] = useState(0);
  const [isCategorySwitcherOpen, setIsCategorySwitcherOpen] = useState(false);

  // 3 Continuous White Glyph Arcs: [Top-Left, Bottom-Left, Right] (0..255)
  const [brightness, setBrightness] = useState([255, 255, 255]);
  const [masterBrightness, setMasterBrightness] = useState(255);
  const [activePixel, setActivePixel] = useState(null);

  // Auto-walk engine state
  const [isAutoWalk, setIsAutoWalk] = useState(false);
  const [autoWalkSpeed, setAutoWalkSpeed] = useState(80);
  const [autoWalkMode, setAutoWalkMode] = useState('forward'); // 'forward' | 'reverse' | 'pingpong' | 'random'

  // Screen transition animations
  const screenFadeAnim = useRef(new Animated.Value(1)).current;
  const screenTranslateX = useRef(new Animated.Value(0)).current;

  // Refs for real-time reactivity without re-render loop tearing
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;

  const autoWalkSpeedRef = useRef(autoWalkSpeed);
  autoWalkSpeedRef.current = autoWalkSpeed;

  const isAutoWalkRef = useRef(isAutoWalk);
  isAutoWalkRef.current = isAutoWalk;

  const autoWalkModeRef = useRef(autoWalkMode);
  autoWalkModeRef.current = autoWalkMode;

  const activePixelRef = useRef(activePixel);
  activePixelRef.current = activePixel;

  const masterBrightnessRef = useRef(masterBrightness);
  masterBrightnessRef.current = masterBrightness;

  const walkDirectionRef = useRef(1); // 1 = forward, -1 = reverse for pingpong
  const stepTimerRef = useRef(null);
  const stepStartTimeRef = useRef(0);

  // Toggle individual arc
  const handleArcPress = useCallback((arcIndex) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBrightness((prev) => {
      const next = [...prev];
      const targetB = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      next[arcIndex] = next[arcIndex] > 0 ? 0 : targetB;

      // Update master brightness to match max of active arcs
      const maxB = Math.max(...next);
      setMasterBrightness(maxB);
      masterBrightnessRef.current = maxB;
      return next;
    });
  }, []);

  // Individual arc brightness regulation
  const handleArcBrightnessChange = useCallback((arcIndex, newVal) => {
    setBrightness((prev) => {
      const next = [...prev];
      next[arcIndex] = newVal;
      const maxB = Math.max(...next);
      setMasterBrightness(maxB);
      masterBrightnessRef.current = maxB;
      return next;
    });
  }, []);

  // Master brightness handler: instant 0-cutoff, instant revival > 0, never freezes
  const handleMasterBrightnessChange = useCallback((newVal) => {
    setMasterBrightness(newVal);
    masterBrightnessRef.current = newVal;
    if (newVal <= 0) {
      setBrightness([0, 0, 0]);
      setActivePixel(null);
      if (isAutoWalkRef.current) {
        setIsAutoWalk(false);
      }
    } else {
      setBrightness((prev) => {
        const isUniform = prev.every((b) => b === prev[0]);
        if (isUniform) {
          return [newVal, newVal, newVal];
        }
        const maxPrev = Math.max(...prev, 1);
        return prev.map((b) => Math.round((b / maxPrev) * newVal));
      });
    }
  }, []);

  const handleAllOn = useCallback((val = 255) => {
    const target = val > 0 ? val : (masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255);
    setMasterBrightness(target);
    masterBrightnessRef.current = target;
    setBrightness([target, target, target]);
  }, []);

  const handleAllOff = useCallback(() => {
    setMasterBrightness(0);
    masterBrightnessRef.current = 0;
    setBrightness([0, 0, 0]);
    setActivePixel(null);
    if (isAutoWalkRef.current) {
      setIsAutoWalk(false);
    }
  }, []);

  // Step-by-step pixel navigation
  const handleActivePixelChange = useCallback((pixelId) => {
    setActivePixel(pixelId);
    activePixelRef.current = pixelId;
    if (pixelId === null) {
      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      setBrightness([b, b, b]);
    } else {
      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      let arc = 0;
      if (pixelId >= 0 && pixelId <= 19) arc = 0; // Top-Left
      else if (pixelId >= 20 && pixelId <= 30) arc = 2; // Right
      else if (pixelId >= 31 && pixelId <= 35) arc = 1; // Bottom-Left
      const nextB = [0, 0, 0];
      nextB[arc] = b;
      setBrightness(nextB);
    }
  }, []);

  // Auto-walk single step executor
  const triggerWalkStep = useCallback(() => {
    if (!isAutoWalkRef.current) return;

    stepStartTimeRef.current = Date.now();
    const current = activePixelRef.current !== null ? activePixelRef.current : -1;
    const mode = autoWalkModeRef.current;
    let nextPixel = 0;

    if (mode === 'forward') {
      nextPixel = (current + 1) % 36;
    } else if (mode === 'reverse') {
      nextPixel = current <= 0 ? 35 : current - 1;
    } else if (mode === 'pingpong') {
      if (current >= 35) walkDirectionRef.current = -1;
      else if (current <= 0) walkDirectionRef.current = 1;
      nextPixel = Math.max(0, Math.min(35, current + walkDirectionRef.current));
    } else if (mode === 'random') {
      nextPixel = Math.floor(Math.random() * 36);
    }

    activePixelRef.current = nextPixel;
    setActivePixel(nextPixel);

    const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
    let arc = 0;
    if (nextPixel >= 0 && nextPixel <= 19) arc = 0; // Top-Left
    else if (nextPixel >= 20 && nextPixel <= 30) arc = 2; // Right
    else if (nextPixel >= 31 && nextPixel <= 35) arc = 1; // Bottom-Left
    const nextB = [0, 0, 0];
    nextB[arc] = b;
    setBrightness(nextB);

    const speed = Math.max(20, autoWalkSpeedRef.current || 80);
    stepTimerRef.current = setTimeout(triggerWalkStep, speed);
  }, []);

  // Auto-walk toggle
  const handleToggleAutoWalk = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsAutoWalk((prev) => !prev);
  }, []);

  // Instant auto-walk speed adjustment with dynamic timer rescheduling
  const handleAutoWalkSpeedChange = useCallback((newSpeed) => {
    setAutoWalkSpeed(newSpeed);
    autoWalkSpeedRef.current = newSpeed;

    // Real-time recalculation of active step timer
    if (isAutoWalkRef.current && stepTimerRef.current) {
      const elapsed = Date.now() - stepStartTimeRef.current;
      const remaining = newSpeed - elapsed;
      clearTimeout(stepTimerRef.current);
      if (remaining <= 0) {
        // Interval already elapsed -> step immediately
        triggerWalkStep();
      } else {
        // Reschedule pending step for remaining adjusted interval
        stepTimerRef.current = setTimeout(triggerWalkStep, remaining);
      }
    }
  }, [triggerWalkStep]);

  // Real-time animation loop lifecycle
  useEffect(() => {
    if (!isAutoWalk) {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      return;
    }

    triggerWalkStep();

    return () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    };
  }, [isAutoWalk, triggerWalkStep]);

  // Tab switch with smooth directional slide and opacity transition
  const handleTabSwitch = useCallback((tabIndex) => {
    const cur = currentTabRef.current;
    if (tabIndex === cur) return;
    Haptics.selectionAsync().catch(() => {});

    // Clean up active pixel and auto-walk when switching tabs to eliminate stuck pixels
    if (cur === 1 && tabIndex !== 1) {
      setIsAutoWalk(false);
      isAutoWalkRef.current = false;
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      setActivePixel(null);
      activePixelRef.current = null;
      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      setBrightness([b, b, b]);
    }

    const direction = tabIndex > cur ? 1 : -1;
    screenTranslateX.setValue(direction * 35);
    screenFadeAnim.setValue(0.5);

    setCurrentTab(tabIndex);
    currentTabRef.current = tabIndex;

    Animated.parallel([
      Animated.spring(screenTranslateX, {
        toValue: 0,
        tension: 130,
        friction: 13,
        useNativeDriver: true,
      }),
      Animated.timing(screenFadeAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenFadeAnim, screenTranslateX]);

  // Horizontal swipe between tabs (dynamic currentTabRef lookup avoids stale closure)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 35 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2.2
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        const cur = currentTabRef.current;
        if (gestureState.dx < -45) {
          // Swipe Left -> Next Tab
          if (cur < TABS.length - 1) {
            handleTabSwitch(cur + 1);
          }
        } else if (gestureState.dx > 45) {
          // Swipe Right -> Prev Tab
          if (cur > 0) {
            handleTabSwitch(cur - 1);
          }
        }
      },
    })
  ).current;

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  const isAnyOn = brightness.some((b) => b > 10);

  // Live status previews for Category Switcher
  const categoryStats = {
    0: masterBrightness > 0 ? `${Math.round((masterBrightness / 255) * 100)}% ЯРКОСТЬ` : 'ВЫКЛ',
    1: isAutoWalk ? `АВТО ${autoWalkSpeed}МС` : (activePixel !== null ? `LED #${activePixel}` : '36 LED'),
    2: '16 ШАГОВ',
    3: 'FFT СПЕКТР',
    4: 'ИНСТРУМЕНТЫ',
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <ExpoStatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.headerTitle}>GLYPH (STUDIO)</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBadge}
          onPress={() => setIsCategorySwitcherOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.deviceTag}>РАЗДЕЛЫ ▾</Text>
        </TouchableOpacity>
      </View>

      {/* Prominent Glowing Camera Module with Glyph Arcs */}
      <View style={styles.simulatorContainer}>
        <GlyphCameraSilhouette
          brightness={brightness}
          activePixel={activePixel}
          onArcPress={handleArcPress}
          size={265}
        />
      </View>

      {/* Active Screen View with Swipe Gestures & Smooth Spring Transition Animation */}
      <Animated.View
        style={[
          styles.screenContainer,
          {
            opacity: screenFadeAnim,
            transform: [{ translateX: screenTranslateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {currentTab === 0 && (
          <ControlScreen
            brightness={brightness}
            masterBrightness={masterBrightness}
            onMasterBrightnessChange={handleMasterBrightnessChange}
            onArcBrightnessChange={handleArcBrightnessChange}
            onArcToggle={handleArcPress}
            onAllOn={handleAllOn}
            onAllOff={handleAllOff}
          />
        )}
        {currentTab === 1 && (
          <PixelsScreen
            activePixel={activePixel}
            onActivePixelChange={handleActivePixelChange}
            isAutoWalk={isAutoWalk}
            onToggleAutoWalk={handleToggleAutoWalk}
            autoWalkSpeed={autoWalkSpeed}
            onAutoWalkSpeedChange={handleAutoWalkSpeedChange}
            autoWalkMode={autoWalkMode}
            onAutoWalkModeChange={setAutoWalkMode}
          />
        )}
        {currentTab === 2 && (
          <SequencerScreen
            brightness={brightness}
            onBrightnessChange={setBrightness}
          />
        )}
        {currentTab === 3 && (
          <VisualizerScreen
            brightness={brightness}
            onBrightnessChange={setBrightness}
          />
        )}
        {currentTab === 4 && (
          <UtilitiesScreen
            brightness={brightness}
            onBrightnessChange={setBrightness}
          />
        )}
      </Animated.View>

      {/* Floating Glassmorphic Tab Bar (Liquid Glass) positioned at the bottom */}
      <LiquidGlassTabBar
        tabs={TABS}
        currentTab={currentTab}
        onSelectTab={handleTabSwitch}
        onOpenCategorySwitcher={() => setIsCategorySwitcherOpen(true)}
      />

      {/* iOS Liquid Glass Category Switcher Sheet Modal */}
      <CategorySwitcherModal
        visible={isCategorySwitcherOpen}
        categories={TABS}
        currentTab={currentTab}
        onSelectTab={handleTabSwitch}
        onClose={() => setIsCategorySwitcherOpen(false)}
        stats={categoryStats}
      />
    </SafeAreaView>
  </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'android' ? 32 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GlyphColors.neonRed,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: 'NDOT57',
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deviceTag: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  simulatorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
  },
  screenContainer: {
    flex: 1,
  },
});
