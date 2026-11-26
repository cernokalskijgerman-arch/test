import 'react-native-reanimated';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
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
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlyphColors } from './src/theme/colors';
import NothingGlyph from './modules/nothing-glyph';

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
  { id: 4, label: 'УТИЛИТЫ', subtitle: 'Таймер, батарея, аркада' },
];

const TURBO_FRAME_MS = 16;

const getMonotonicNow = () => {
  if (typeof global !== 'undefined' && global.performance && typeof global.performance.now === 'function') {
    return global.performance.now();
  }
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

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

// Unrounded normalized step duration for sub-16ms phase accumulator
const calculateExactNormalizedStepMs = (pixelIndex, baseDelayMs) => {
  const meanDegPerLed = 110.0 / 33.0;
  let degPerLed = meanDegPerLed;
  if (pixelIndex >= 0 && pixelIndex <= 19) {
    degPerLed = 41.0 / 19.0;
  } else if (pixelIndex >= 20 && pixelIndex <= 30) {
    degPerLed = 48.0 / 10.0;
  } else if (pixelIndex >= 31 && pixelIndex <= 35) {
    degPerLed = 21.0 / 4.0;
  }
  const scale = degPerLed / meanDegPerLed;
  return Math.max(0.25, baseDelayMs * scale);
};

// Pure single-step cursor advancement around the 36 micro-LED circle
const advanceWalkCursor = (current, mode, dir) => {
  if (mode === 'forward' || mode === 'comet') {
    const next = current < 0 ? 0 : (current + 1) % 36;
    return { nextPixel: next, nextDir: 1 };
  }
  if (mode === 'reverse') {
    const next = current <= 0 ? 35 : current - 1;
    return { nextPixel: next, nextDir: -1 };
  }
  if (mode === 'pingpong') {
    if (current < 0) return { nextPixel: 0, nextDir: 1 };
    let nextDir = dir;
    if (current >= 35) nextDir = -1;
    else if (current <= 0) nextDir = 1;
    const next = Math.max(0, Math.min(35, current + nextDir));
    return { nextPixel: next, nextDir };
  }
  if (mode === 'random') {
    return { nextPixel: Math.floor(Math.random() * 36), nextDir: dir };
  }
  return { nextPixel: 0, nextDir: 1 };
};

function StudioApp() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({
    'NDOT57': require('./assets/fonts/Ndot57.otf'),
  });

  const [currentTab, setCurrentTab] = useState(0);
  const [isCategorySwitcherOpen, setIsCategorySwitcherOpen] = useState(false);

  // User's persistent Control tab setpoints [Top-Left, Bottom-Left, Right] (0..255)
  const [brightness, setBrightness] = useState([255, 255, 255]);
  // Temporary output override for active effect tabs (Sequencer / Music / Utilities / Auto-Walk); null = use Control brightness
  const [effectBrightness, setEffectBrightness] = useState(null);
  const [masterBrightness, setMasterBrightness] = useState(255);
  const [activePixel, setActivePixel] = useState(null);
  const [pixelLevels, setPixelLevels] = useState(null);
  const [sequencerState, setSequencerState] = useState(null);

  // Auto-walk engine state
  const [isAutoWalk, setIsAutoWalk] = useState(false);
  const [autoWalkSpeed, setAutoWalkSpeed] = useState(80);
  const [autoWalkMode, setAutoWalkMode] = useState('forward'); // 'forward' | 'comet' | 'reverse' | 'pingpong' | 'random' | 'shimmer'

  // Screen transition & status pulse animations
  const screenFadeAnim = useRef(new Animated.Value(1)).current;
  const screenTranslateX = useRef(new Animated.Value(0)).current;
  const screenScaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Refs for real-time reactivity without re-render loop tearing
  const currentTabRef = useRef(currentTab);
  currentTabRef.current = currentTab;

  const autoWalkSpeedRef = useRef(autoWalkSpeed);
  autoWalkSpeedRef.current = autoWalkSpeed;

  const isAutoWalkRef = useRef(isAutoWalk);
  isAutoWalkRef.current = isAutoWalk;

  const autoWalkModeRef = useRef(autoWalkMode);
  autoWalkModeRef.current = autoWalkMode;

  const masterBrightnessRef = useRef(masterBrightness);
  masterBrightnessRef.current = masterBrightness;

  // Isolated animation cursor refs (NEVER overwritten by React activePixel state on render)
  const walkPositionRef = useRef(-1);
  const walkDirectionRef = useRef(1); // 1 = forward, -1 = reverse for pingpong
  const walkPhaseAccRef = useRef(0);
  const lastTickTimeRef = useRef(0);
  const lastScheduledDelayRef = useRef(0);
  const walkRenderTypeRef = useRef(null); // 'pixel' | 'levels' | null
  const trailHistoryRef = useRef([]);
  const stepTimerRef = useRef(null);
  const shimmerTimeRef = useRef(0);

  // Live header pulse dot reflecting master power state
  useEffect(() => {
    if (masterBrightness > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(0.35);
    return undefined;
  }, [masterBrightness, pulseAnim]);

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
    setPixelLevels(null);
    setEffectBrightness(null);
    NothingGlyph.turnOff();
    if (isAutoWalkRef.current) {
      isAutoWalkRef.current = false;
      setIsAutoWalk(false);
    }
  }, []);

  // Auto-revive master brightness to 255 ONLY when explicitly starting an effect while master is 0
  const ensurePowerOnIfZero = useCallback(() => {
    if (masterBrightnessRef.current === 0) {
      masterBrightnessRef.current = 255;
      setMasterBrightness(255);
    }
  }, []);

  // Non-destructive effect brightness controller (never overwrites ControlScreen's brightness)
  const handleEffectBrightnessChange = useCallback((nextVal) => {
    if (currentTabRef.current === 0) {
      setEffectBrightness(null);
      return;
    }
    if (nextVal === null || nextVal === undefined) {
      setEffectBrightness(null);
    } else if (Array.isArray(nextVal)) {
      setEffectBrightness([
        Math.max(0, Math.min(255, Math.round(nextVal[0] ?? 0))),
        Math.max(0, Math.min(255, Math.round(nextVal[1] ?? 0))),
        Math.max(0, Math.min(255, Math.round(nextVal[2] ?? 0))),
      ]);
    }
  }, []);

  // Step-by-step / discrete micro-LED navigation
  const handleActivePixelChange = useCallback((pixelId) => {
    if (currentTabRef.current === 0) {
      setActivePixel(null);
      setEffectBrightness(null);
      return;
    }
    if (pixelId === null || pixelId === undefined) {
      // Only null returns control back to normal arc brightness
      setActivePixel(null);
      setEffectBrightness(null);
    } else if (Array.isArray(pixelId)) {
      // Empty [] turns LEDs off ([0,0,0] + setVirtualPixels([], ...)); non-empty lights discrete pixels
      setPixelLevels(null);
      setActivePixel(pixelId);
      setEffectBrightness([0, 0, 0]);
    } else {
      setPixelLevels(null);
      setActivePixel(pixelId);
      setEffectBrightness([0, 0, 0]);
    }
  }, []);

  // Direct pixel levels controller (for games, visualizers, and animations)
  const handlePixelLevelsChange = useCallback((levels) => {
    if (currentTabRef.current === 0) {
      setPixelLevels(null);
      return;
    }
    setPixelLevels(levels);
    if (levels !== null) {
      setActivePixel(null);
    }
  }, []);

  // Auto-walk step executor with monotonic clock, angular normalization, and 60fps phase-accumulated stream
  const triggerWalkStep = useCallback(() => {
    if (!isAutoWalkRef.current) return;

    const mode = autoWalkModeRef.current;
    const baseSpeed = Math.max(1, Math.min(200, autoWalkSpeedRef.current || 60));
    const now = getMonotonicNow();
    const isFirstTick = lastTickTimeRef.current <= 0;
    const rawDt = isFirstTick ? TURBO_FRAME_MS : Math.max(0, now - lastTickTimeRef.current);
    lastTickTimeRef.current = now;
    const elapsed = Math.min(rawDt, 48);

    // MODE: SHIMMER (Smooth 60fps multi-harmonic diamond sparkle, strictly monotonic across 1..200ms)
    if (mode === 'shimmer') {
      const spdFactor = 0.25 + ((200 - baseSpeed) / 199) * 4.75;
      shimmerTimeRef.current += (elapsed / 1000) * 1.8 * spdFactor;
      const t = shimmerTimeRef.current;
      const levels = new Array(36);
      for (let i = 0; i < 36; i++) {
        const phase = (i * 0.44) + (i % 7) * 0.95;
        const w1 = Math.sin(t * 3.0 + phase);
        const w2 = Math.cos(t * 1.5 + phase * 0.6);
        const raw = (w1 * 0.6 + w2 * 0.4 + 1) / 2;
        const sparkle = Math.pow(raw, 2.2);
        levels[i] = Math.max(0.08, Math.min(1, sparkle));
      }
      if (walkRenderTypeRef.current !== 'levels') {
        setActivePixel(null);
        walkRenderTypeRef.current = 'levels';
      }
      setPixelLevels(levels);
      lastScheduledDelayRef.current = TURBO_FRAME_MS;
      stepTimerRef.current = setTimeout(triggerWalkStep, TURBO_FRAME_MS);
      return;
    }

    // HIGH-SPEED / TURBO STREAM (< 16ms): 60fps phase accumulator with smooth motion-blur trail
    if (baseSpeed < 16) {
      const deltaStep = baseSpeed < 16 ? Math.max(1, Math.round(elapsed / baseSpeed)) : 1;
      const visited = [];
      let pos = walkPositionRef.current;
      let dir = walkDirectionRef.current;

      if (isFirstTick || pos < 0) {
        const initial = advanceWalkCursor(pos, mode, dir);
        pos = initial.nextPixel;
        dir = initial.nextDir;
        visited.push(pos);
        walkPhaseAccRef.current = 0;
      } else {
        walkPhaseAccRef.current += elapsed;
        const maxSteps = Math.min(36, Math.max(deltaStep + 4, 16));
        let count = 0;
        while (count < maxSteps) {
          const stepMs = calculateExactNormalizedStepMs(pos < 0 ? 0 : pos, baseSpeed);
          if (walkPhaseAccRef.current < stepMs) break;
          walkPhaseAccRef.current -= stepMs;
          const stepped = advanceWalkCursor(pos, mode, dir);
          pos = stepped.nextPixel;
          dir = stepped.nextDir;
          visited.push(pos);
          count++;
        }
        if (walkPhaseAccRef.current > 48) {
          walkPhaseAccRef.current = 0;
        }
      }

      if (visited.length > 0) {
        walkPositionRef.current = pos;
        walkDirectionRef.current = dir;
        const nextPixel = pos;

        // Arc boundary resolution across all 3 physical segments
        let activeArc = 0;
        if (nextPixel >= 0 && nextPixel <= 19) activeArc = 0;
        else if (nextPixel >= 20 && nextPixel <= 30) activeArc = 2;
        else if (nextPixel >= 31 && nextPixel <= 35) activeArc = 1;
        void activeArc;

        const levels = new Array(36).fill(0);

        if (mode === 'random') {
          const sparkCount = Math.min(visited.length, 6);
          const startIdx = visited.length - sparkCount;
          for (let i = startIdx; i < visited.length; i++) {
            const p = visited[i];
            const weight = 0.4 + 0.6 * ((i - startIdx + 1) / sparkCount);
            if (weight > levels[p]) levels[p] = weight;
          }
        } else {
          const history = trailHistoryRef.current;
          for (let i = 0; i < visited.length; i++) {
            history.push(visited[i]);
          }
          const targetLen =
            mode === 'comet'
              ? Math.max(5, Math.min(18, visited.length + 4))
              : Math.max(3, Math.min(18, visited.length + 2));
          if (history.length > targetLen) {
            history.splice(0, history.length - targetLen);
          }
          const len = history.length;
          for (let i = 0; i < len; i++) {
            const p = history[i];
            const frac = (i + 1) / len;
            const glow = i === len - 1 ? 1.0 : Math.max(0.08, Math.pow(frac, 1.55) * 0.92);
            if (glow > levels[p]) levels[p] = glow;
          }
        }

        if (walkRenderTypeRef.current !== 'levels') {
          setActivePixel(null);
          walkRenderTypeRef.current = 'levels';
        }
        setPixelLevels(levels);
      }

      lastScheduledDelayRef.current = TURBO_FRAME_MS;
      stepTimerRef.current = setTimeout(triggerWalkStep, TURBO_FRAME_MS);
      return;
    }

    // STANDARD PRECISION MODE (>= 16ms): exact 1-LED discrete steps with normalized angular delay
    walkPhaseAccRef.current = 0;
    trailHistoryRef.current = [];

    const stepped = advanceWalkCursor(walkPositionRef.current, mode, walkDirectionRef.current);
    const nextPixel = stepped.nextPixel;
    walkPositionRef.current = nextPixel;
    walkDirectionRef.current = stepped.nextDir;

    // Arc boundary mapping across Top-Left (0..19), Right (20..30), Bottom-Left (31..35)
    let activeArc = 0;
    if (nextPixel >= 0 && nextPixel <= 19) activeArc = 0;
    else if (nextPixel >= 20 && nextPixel <= 30) activeArc = 2;
    else if (nextPixel >= 31 && nextPixel <= 35) activeArc = 1;
    void activeArc;

    if (mode === 'comet') {
      const levels = new Array(36).fill(0);
      levels[nextPixel] = 1.0;
      levels[(nextPixel - 1 + 36) % 36] = 0.70;
      levels[(nextPixel - 2 + 36) % 36] = 0.42;
      levels[(nextPixel - 3 + 36) % 36] = 0.20;
      levels[(nextPixel - 4 + 36) % 36] = 0.07;

      if (walkRenderTypeRef.current !== 'levels') {
        setActivePixel(null);
        walkRenderTypeRef.current = 'levels';
      }
      setPixelLevels(levels);
    } else {
      if (walkRenderTypeRef.current !== 'pixel') {
        setPixelLevels(null);
        walkRenderTypeRef.current = 'pixel';
      }
      setActivePixel(nextPixel);
    }

    const nextDelay = calculateNormalizedStepDelay(nextPixel, baseSpeed);
    lastScheduledDelayRef.current = nextDelay;
    stepTimerRef.current = setTimeout(triggerWalkStep, nextDelay);
  }, []);

  // Auto-walk toggle
  const handleToggleAutoWalk = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const next = !isAutoWalkRef.current;
    isAutoWalkRef.current = next;
    setIsAutoWalk(next);
    if (next) {
      ensurePowerOnIfZero();
      setEffectBrightness([0, 0, 0]);
    } else {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      walkPositionRef.current = -1;
      walkDirectionRef.current = 1;
      walkPhaseAccRef.current = 0;
      lastTickTimeRef.current = 0;
      lastScheduledDelayRef.current = 0;
      walkRenderTypeRef.current = null;
      trailHistoryRef.current = [];
      setActivePixel(null);
      setPixelLevels(null);
      setEffectBrightness(null);
    }
  }, [ensurePowerOnIfZero]);

  // Smooth auto-walk speed update without jumping cursor or forcing synchronous steps mid-drag
  const handleAutoWalkSpeedChange = useCallback((newSpeed) => {
    const clampedSpeed = isNaN(newSpeed) ? 60 : Math.max(1, Math.min(200, Math.round(newSpeed)));
    autoWalkSpeedRef.current = clampedSpeed;
    setAutoWalkSpeed(clampedSpeed);

    // If running and user dramatically sped up while waiting on a long timeout, wake up earlier cleanly
    if (isAutoWalkRef.current && stepTimerRef.current && lastTickTimeRef.current > 0) {
      const elapsedSinceTick = Math.max(0, getMonotonicNow() - lastTickTimeRef.current);
      const desiredDelay =
        clampedSpeed < 16
          ? TURBO_FRAME_MS
          : calculateNormalizedStepDelay(Math.max(0, walkPositionRef.current), clampedSpeed);
      const remainingOld = Math.max(0, lastScheduledDelayRef.current - elapsedSinceTick);
      const remainingNew = Math.max(0, desiredDelay - elapsedSinceTick);

      if (remainingNew + 4 < remainingOld) {
        clearTimeout(stepTimerRef.current);
        lastScheduledDelayRef.current = remainingNew;
        stepTimerRef.current = setTimeout(triggerWalkStep, remainingNew);
      }
    }
  }, [triggerWalkStep]);

  const handleAutoWalkModeChange = useCallback((mode) => {
    autoWalkModeRef.current = mode;
    setAutoWalkMode(mode);
    walkPhaseAccRef.current = 0;
    lastTickTimeRef.current = 0;
    walkRenderTypeRef.current = null;
    trailHistoryRef.current = [];
    if (isAutoWalkRef.current) {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      lastScheduledDelayRef.current = 0;
      stepTimerRef.current = setTimeout(triggerWalkStep, 0);
    }
  }, [triggerWalkStep]);

  // Real-time animation loop lifecycle
  useEffect(() => {
    if (!isAutoWalk) {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      walkPositionRef.current = -1;
      walkDirectionRef.current = 1;
      walkPhaseAccRef.current = 0;
      lastTickTimeRef.current = 0;
      lastScheduledDelayRef.current = 0;
      walkRenderTypeRef.current = null;
      trailHistoryRef.current = [];
      return;
    }

    lastTickTimeRef.current = 0;
    walkPhaseAccRef.current = 0;
    triggerWalkStep();

    return () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    };
  }, [isAutoWalk, triggerWalkStep]);

  // Tab switch with smooth directional slide, scale pop, and clean state isolation
  const handleTabSwitch = useCallback((tabIndex) => {
    setIsCategorySwitcherOpen(false);
    const cur = currentTabRef.current;
    if (tabIndex === cur) return;
    Haptics.selectionAsync().catch(() => {});

    // Synchronously update tab ref BEFORE unmounting effect screens so cleanup cannot clobber Tab 0
    currentTabRef.current = tabIndex;

    // Clean up auto-walk & active effect states on tab exit
    if (cur === 1 && tabIndex !== 1) {
      isAutoWalkRef.current = false;
      setIsAutoWalk(false);
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      walkPositionRef.current = -1;
      walkDirectionRef.current = 1;
      walkPhaseAccRef.current = 0;
      lastTickTimeRef.current = 0;
      lastScheduledDelayRef.current = 0;
      walkRenderTypeRef.current = null;
      trailHistoryRef.current = [];
    }

    setActivePixel(null);
    setPixelLevels(null);
    setEffectBrightness(null);

    const direction = tabIndex > cur ? 1 : -1;
    screenTranslateX.setValue(direction * 36);
    screenFadeAnim.setValue(0.35);
    screenScaleAnim.setValue(0.96);

    setCurrentTab(tabIndex);

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

  // Horizontal swipe between tabs (never captures touches away from GlyphSlider or FloatingTabBar)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 40 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2.2
        );
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_, gestureState) => {
        const cur = currentTabRef.current;
        if (gestureState.dx < -45) {
          if (cur < TABS.length - 1) {
            handleTabSwitch(cur + 1);
          }
        } else if (gestureState.dx > 45) {
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
    const source = effectBrightness !== null ? effectBrightness : brightness;
    const scale = masterBrightness / 255;
    return source.map((b) => Math.round(b * scale));
  }, [brightness, effectBrightness, masterBrightness]);

  const effectivePixelLevels = useMemo(() => {
    if (!pixelLevels || masterBrightness === 0) return null;
    if (masterBrightness >= 255) return pixelLevels;
    const scale = masterBrightness / 255;
    return pixelLevels.map((l) => l * scale);
  }, [pixelLevels, masterBrightness]);

  // Live status previews for Category Switcher
  const categoryStats = useMemo(() => ({
    0: masterBrightness > 0 ? `${Math.round((masterBrightness / 255) * 100)}% ЯРКОСТЬ` : 'ВЫКЛ',
    1: isAutoWalk ? `АВТО ${autoWalkSpeed}МС` : 'ГОТОВ',
    2: sequencerState && sequencerState.bpm ? `${sequencerState.bpm} BPM` : '8 ШАГОВ',
    3: 'FFT СПЕКТР',
    4: 'ИНСТРУМЕНТЫ',
  }), [masterBrightness, isAutoWalk, autoWalkSpeed, sequencerState]);

  const handleOpenCategorySwitcher = useCallback(() => {
    setIsCategorySwitcherOpen(true);
  }, []);

  const handleCloseCategorySwitcher = useCallback(() => {
    setIsCategorySwitcherOpen(false);
  }, []);

  // Hardware initialization on mount
  useEffect(() => {
    NothingGlyph.initHardware();
  }, []);

  // Hardware synchronization: streams all UI updates directly to physical Nothing Phone Glyphs
  useEffect(() => {
    if (masterBrightness === 0) {
      NothingGlyph.turnOff();
      return;
    }

    if (effectivePixelLevels !== null && Array.isArray(effectivePixelLevels)) {
      NothingGlyph.setPixelLevels(effectivePixelLevels);
    } else if (activePixel !== null) {
      if (Array.isArray(activePixel)) {
        NothingGlyph.setVirtualPixels(activePixel, masterBrightness);
      } else {
        NothingGlyph.setVirtualPixel(activePixel, masterBrightness);
      }
    } else {
      NothingGlyph.setArcsBrightness(
        effectiveBrightness[0],
        effectiveBrightness[1],
        effectiveBrightness[2]
      );
    }
  }, [effectiveBrightness, activePixel, effectivePixelLevels, masterBrightness]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  const topSafePadding = Platform.OS === 'android'
    ? Math.max(insets.top || 0, 24)
    : (insets.top || 0);
  const silhouetteActivePixel = masterBrightness === 0 ? null : activePixel;

  return (
    <View style={[styles.safeArea, { paddingTop: topSafePadding }]}>
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
          <Animated.View
            style={[
              styles.pulseDot,
              masterBrightness === 0 && styles.pulseDotOff,
              { opacity: pulseAnim },
            ]}
          />
          <Text style={styles.headerTitle}>GLYPH (STUDIO)</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBadge}
          onPress={handleOpenCategorySwitcher}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          activePixel={silhouetteActivePixel}
          pixelLevels={effectivePixelLevels}
          onArcPress={currentTab === 0 ? handleArcPress : undefined}
          size={215}
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
            onAutoWalkModeChange={handleAutoWalkModeChange}
          />
        )}
        {currentTab === 2 && (
          <SequencerScreen
            brightness={brightness}
            onBrightnessChange={handleEffectBrightnessChange}
            onPixelLevelsChange={handlePixelLevelsChange}
            onEnsurePowerOn={ensurePowerOnIfZero}
            savedState={sequencerState}
            onSaveState={setSequencerState}
          />
        )}
        {currentTab === 3 && (
          <VisualizerScreen
            brightness={brightness}
            onBrightnessChange={handleEffectBrightnessChange}
            onActivePixelChange={handleActivePixelChange}
            onPixelLevelsChange={handlePixelLevelsChange}
            onEnsurePowerOn={ensurePowerOnIfZero}
          />
        )}
        {currentTab === 4 && (
          <UtilitiesScreen
            brightness={brightness}
            onBrightnessChange={handleEffectBrightnessChange}
            onActivePixelChange={handleActivePixelChange}
            onPixelLevelsChange={handlePixelLevelsChange}
            onEnsurePowerOn={ensurePowerOnIfZero}
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
        onClose={handleCloseCategorySwitcher}
        stats={categoryStats}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StudioApp />
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
  pulseDotOff: {
    backgroundColor: '#4A4A58',
    shadowOpacity: 0,
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
