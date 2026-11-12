import 'react-native-reanimated';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
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
  { id: 1, label: 'АВТО-ОБХОД', subtitle: 'Бегущий свет 36 LED' },
  { id: 2, label: 'СЕКВЕНСОР', subtitle: '8-шаговые ритмы' },
  { id: 3, label: 'МУЗЫКА', subtitle: 'FFT визуализатор частот' },
  { id: 4, label: 'УТИЛИТЫ', subtitle: 'Фонарик, таймер, аркада' },
];

// Calculate step delay normalized to physical arc angular span
const calculateNormalizedStepDelay = (pixelIndex, baseDelayMs) => {
  const meanDegPerLed = 110.0 / 33.0; // ~3.333 deg
  let degPerLed = 3.333;
  if (pixelIndex >= 0 && pixelIndex <= 19) {
    degPerLed = 41.0 / 19.0; // Top-Left: ~2.158 deg (scale ~0.647)
  } else if (pixelIndex >= 20 && pixelIndex <= 30) {
    degPerLed = 48.0 / 10.0; // Right: 4.800 deg (scale ~1.440)
  } else if (pixelIndex >= 31 && pixelIndex <= 35) {
    degPerLed = 21.0 / 4.0;  // Bottom-Left: 5.250 deg (scale ~1.575)
  }
  const scale = degPerLed / meanDegPerLed;
  return Math.max(1, Math.round(baseDelayMs * scale));
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'NDOT57': require('./assets/fonts/Ndot57.otf'),
  });

  const [currentTab, setCurrentTab] = useState(0);
  const [isCategorySwitcherOpen, setIsCategorySwitcherOpen] = useState(false);

  // 3 Continuous White Glyph Arcs: [Top-Left, Bottom-Left, Right] (0..255)
  const [brightness, setBrightness] = useState([255, 255, 255]);
  const [masterBrightness, setMasterBrightness] = useState(255);
  const [activePixel, setActivePixel] = useState(null);
  const [pixelLevels, setPixelLevels] = useState(null); // Array of 36 independent float levels for smooth pixel shimmer

  // Auto-walk engine state
  const [isAutoWalk, setIsAutoWalk] = useState(false);
  const [autoWalkSpeed, setAutoWalkSpeed] = useState(80);
  const [autoWalkMode, setAutoWalkMode] = useState('forward'); // 'forward' | 'reverse' | 'pingpong' | 'random' | 'shimmer'

  // Screen transition animations
  const screenFadeAnim = useRef(new Animated.Value(1)).current;
  const screenTranslateX = useRef(new Animated.Value(0)).current;
  const screenScaleAnim = useRef(new Animated.Value(1)).current;

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
  const shimmerTimeRef = useRef(0);

  // Toggle individual arc
  const handleArcPress = useCallback((arcIndex) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBrightness((prev) => {
      const next = [...prev];
      next[arcIndex] = next[arcIndex] > 0 ? 0 : 255;
      return next;
    });
  }, []);

  // Individual arc brightness regulation
  const handleArcBrightnessChange = useCallback((arcIndex, newVal) => {
    setBrightness((prev) => {
      const next = [...prev];
      next[arcIndex] = newVal;
      return next;
    });
  }, []);

  // Master brightness handler: instant 0-cutoff, instant revival > 0, never freezes
  const handleMasterBrightnessChange = useCallback((newVal) => {
    setMasterBrightness(newVal);
    masterBrightnessRef.current = newVal;
  }, []);

  const handleAllOn = useCallback((val = 255) => {
    const target = val > 0 ? val : 255;
    setMasterBrightness(target);
    masterBrightnessRef.current = target;
    // Revive arcs only if all are currently 0; preserve custom balance otherwise
    setBrightness((prev) => {
      if (prev.every((b) => b === 0)) {
        return [255, 255, 255];
      }
      return prev;
    });
  }, []);

  const handleAllOff = useCallback(() => {
    setMasterBrightness(0);
    masterBrightnessRef.current = 0;
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
    } else if (Array.isArray(pixelId)) {
      // Array of discrete active micro-LEDs (e.g. sequential battery indicator)
      setBrightness([0, 0, 0]);
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

  // Direct pixel levels controller (for games and animations with variable LED brightness)
  const handlePixelLevelsChange = useCallback((levels) => {
    setPixelLevels(levels);
    if (levels !== null) {
      setActivePixel(null);
      activePixelRef.current = null;
    }
  }, []);

  // Auto-walk step executor with angular normalization, turbo multi-stepping, and smooth 36-pixel shimmer
  const triggerWalkStep = useCallback(() => {
    if (!isAutoWalkRef.current) return;

    const mode = autoWalkModeRef.current;
    const baseSpeed = Math.max(1, autoWalkSpeedRef.current || 60);

    // MODE: SHIMMER (Плавное независимое мерцание/блестение каждого пикселя отдельно, 120Hz refresh)
    if (mode === 'shimmer') {
      const spdFactor = Math.max(0.4, (205 - baseSpeed) / 45);
      shimmerTimeRef.current += 0.015 * spdFactor;
      const t = shimmerTimeRef.current;
      const levels = [];
      for (let i = 0; i < 36; i++) {
        // Multi-harmonic natural twinkle with distinct phase per LED
        const phase = (i * 0.44) + (i % 7) * 0.95;
        const w1 = Math.sin(t * 3.0 + phase);
        const w2 = Math.cos(t * 1.5 + phase * 0.6);
        const raw = (w1 * 0.6 + w2 * 0.4 + 1) / 2;
        const sparkle = Math.pow(raw, 2.2); // Crisp diamond glisten curve
        levels.push(Math.max(0.08, Math.min(1, sparkle)));
      }
      setPixelLevels(levels);
      setActivePixel(null);
      // Native 120Hz tick interval (8.33ms)
      stepTimerRef.current = setTimeout(triggerWalkStep, 8);
      return;
    }

    // MODE: COMET (Метеор со светящимся неоновым хвостом из 5 микро-LED, 120Hz refresh)
    if (mode === 'comet') {
      const now = Date.now();
      const elapsed = stepStartTimeRef.current > 0 ? now - stepStartTimeRef.current : 0;
      stepStartTimeRef.current = now;

      const current = activePixelRef.current !== null ? activePixelRef.current : -1;
      const deltaStep = baseSpeed < 8
        ? Math.max(1, Math.round((elapsed > 0 ? elapsed : 8.33) / baseSpeed))
        : 1;

      const nextPixel = current < 0 ? 0 : (current + deltaStep) % 36;
      activePixelRef.current = nextPixel;
      setActivePixel(null);

      const levels = new Array(36).fill(0);
      levels[nextPixel] = 1.0;
      levels[(nextPixel - 1 + 36) % 36] = 0.70;
      levels[(nextPixel - 2 + 36) % 36] = 0.42;
      levels[(nextPixel - 3 + 36) % 36] = 0.20;
      levels[(nextPixel - 4 + 36) % 36] = 0.07;
      setPixelLevels(levels);
      setBrightness([0, 0, 0]);

      const nextDelay = baseSpeed < 8
        ? 8
        : calculateNormalizedStepDelay(nextPixel, baseSpeed);

      stepTimerRef.current = setTimeout(triggerWalkStep, nextDelay);
      return;
    }

    setPixelLevels(null);

    const now = Date.now();
    const elapsed = stepStartTimeRef.current > 0 ? now - stepStartTimeRef.current : 0;
    stepStartTimeRef.current = now;

    const current = activePixelRef.current !== null ? activePixelRef.current : -1;

    // For turbo speeds (< 8ms), advance multiple steps per 120Hz frame (8.33ms)
    const deltaStep = baseSpeed < 8
      ? Math.max(1, Math.round((elapsed > 0 ? elapsed : 8.33) / baseSpeed))
      : 1;

    let nextPixel = 0;
    if (mode === 'forward') {
      nextPixel = current < 0 ? 0 : (current + deltaStep) % 36;
    } else if (mode === 'reverse') {
      const startPos = current < 0 ? 36 : current;
      nextPixel = ((startPos - deltaStep) % 36 + 36) % 36;
    } else if (mode === 'pingpong') {
      let tempPixel = current < 0 ? 0 : current;
      let tempDir = walkDirectionRef.current;
      for (let s = 0; s < deltaStep; s++) {
        if (tempPixel >= 35) tempDir = -1;
        else if (tempPixel <= 0) tempDir = 1;
        tempPixel = Math.max(0, Math.min(35, tempPixel + tempDir));
      }
      walkDirectionRef.current = tempDir;
      nextPixel = tempPixel;
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

    // Schedule next tick with 120Hz minimum ceiling (8ms)
    const nextDelay = baseSpeed < 8
      ? 8
      : calculateNormalizedStepDelay(nextPixel, baseSpeed);

    stepTimerRef.current = setTimeout(triggerWalkStep, nextDelay);
  }, []);

  // Auto-walk toggle
  const handleToggleAutoWalk = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsAutoWalk((prev) => !prev);
  }, []);

  // Instant auto-walk speed adjustment with dynamic timer rescheduling
  const handleAutoWalkSpeedChange = useCallback((newSpeed) => {
    const clampedSpeed = isNaN(newSpeed) ? 60 : Math.max(1, Math.min(200, Math.round(newSpeed)));
    setAutoWalkSpeed(clampedSpeed);
    autoWalkSpeedRef.current = clampedSpeed;

    // Real-time recalculation of active step timer
    if (isAutoWalkRef.current && stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      triggerWalkStep();
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

  // Tab switch with smooth directional slide, scale pop, and opacity transition
  const handleTabSwitch = useCallback((tabIndex) => {
    setIsCategorySwitcherOpen(false);
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
      setPixelLevels(null);
      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      setBrightness([b, b, b]);
    }

    if (cur === 4 && tabIndex !== 4) {
      setActivePixel(null);
      activePixelRef.current = null;
      setPixelLevels(null);
      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      setBrightness([b, b, b]);
    }

    // When returning to Control tab, restore normal arc brightness according to master
    if (tabIndex === 0 && cur !== 0) {
      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      setBrightness([b, b, b]);
    }

    const direction = tabIndex > cur ? 1 : -1;
    screenTranslateX.setValue(direction * 36);
    screenFadeAnim.setValue(0.35);
    screenScaleAnim.setValue(0.96);

    setCurrentTab(tabIndex);
    currentTabRef.current = tabIndex;

    Animated.parallel([
      Animated.spring(screenTranslateX, {
        toValue: 0,
        tension: 140,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.spring(screenScaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 15,
        useNativeDriver: true,
      }),
      Animated.timing(screenFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [screenFadeAnim, screenScaleAnim, screenTranslateX]);

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

  // Effective brightness delivered to GlyphCameraSilhouette (Master Dimmer non-destructive scaling)
  // IMPORTANT: useMemo MUST be called before any early return to satisfy React's Rules of Hooks
  const effectiveBrightness = useMemo(() => {
    const scale = masterBrightness / 255;
    return brightness.map((b) => Math.round(b * scale));
  }, [brightness, masterBrightness]);

  // Live status previews for Category Switcher
  const categoryStats = useMemo(() => ({
    0: masterBrightness > 0 ? `${Math.round((masterBrightness / 255) * 100)}% ЯРКОСТЬ` : 'ВЫКЛ',
    1: isAutoWalk ? `АВТО ${autoWalkSpeed}МС` : 'ГОТОВ',
    2: '8 ШАГОВ',
    3: 'FFT СПЕКТР',
    4: 'ИНСТРУМЕНТЫ',
  }), [masterBrightness, isAutoWalk, autoWalkSpeed]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  const isAnyOn = brightness.some((b) => b > 10);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <ExpoStatusBar style="light" />

        {/* Ambient background depth for authentic Liquid Glass refraction */}
        <LinearGradient
          colors={['#080a14', '#020306', '#050710']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

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
            {/* Top specular highlight edge for glass badge */}
            <View style={styles.badgeTopRim} pointerEvents="none" />
            <Text style={styles.deviceTag}>РАЗДЕЛЫ ▾</Text>
          </TouchableOpacity>
        </View>

      {/* Prominent Glowing Camera Module with Glyph Arcs */}
      <View style={styles.simulatorContainer}>
        <GlyphCameraSilhouette
          brightness={effectiveBrightness}
          activePixel={activePixel}
          pixelLevels={pixelLevels}
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
            transform: [
              { translateX: screenTranslateX },
              { scale: screenScaleAnim },
            ],
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
            onActivePixelChange={handleActivePixelChange}
            onPixelLevelsChange={handlePixelLevelsChange}
          />
        )}
      </Animated.View>

      {/* Floating Glassmorphic Tab Bar (Liquid Glass) positioned at the bottom */}
      <LiquidGlassTabBar
        tabs={TABS}
        currentTab={currentTab}
        onSelectTab={handleTabSwitch}
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
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: 'rgba(14, 16, 26, 0.45)',
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
    shadowColor: GlyphColors.neonRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
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
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderTopColor: 'rgba(255, 255, 255, 0.40)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  badgeTopRim: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
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
    paddingTop: 2,
    paddingBottom: 0,
  },
  screenContainer: {
    flex: 1,
  },
});
