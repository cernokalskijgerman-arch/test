import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Heart,
  Target,
  Zap,
  Play,
  Pause,
  Square,
  Timer,
  BatteryCharging,
  Wind,
  Radio,
  RotateCcw,
  AlertTriangle,
  Award,
} from 'lucide-react-native';
import LiquidGlassCard from '../components/LiquidGlassCard';
import GlyphSlider from '../components/GlyphSlider';
import { GlyphColors } from '../theme/colors';
import NothingGlyph from '../../modules/nothing-glyph';

const TOTAL_LEDS = 36;

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const clampInt = (val, min, max, fallback) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
};

const mapBatteryStatus = (status, isCharging) => {
  switch (status) {
    case 2:
      return 'ЗАРЯДКА';
    case 3:
      return 'РАЗРЯД';
    case 4:
      return 'ПАУЗА';
    case 5:
      return 'ЗАРЯЖЕН 100%';
    default:
      return isCharging ? 'ЗАРЯДКА' : 'АКТИВНА';
  }
};

const ITU_MORSE_MAP = {
  S: '...',
  O: '---',
  H: '....',
  E: '.',
  L: '.-..',
  P: '.--.',
  N: '-.',
  T: '-',
  I: '..',
  G: '--.',
  K: '-.-',
};

const MORSE_WORDS = ['SOS', 'HELP', 'NOTHING', 'OK'];

const buildMorseData = (word) => {
  const steps = [];
  const letterGroups = [];
  const chars = String(word || 'SOS').toUpperCase().split('');

  chars.forEach((ch, charIdx) => {
    const code = ITU_MORSE_MAP[ch];
    if (!code) return;
    const symbols = [];
    const codeArr = code.split('');

    codeArr.forEach((sym, symIdx) => {
      const seqIndex = steps.length;
      const glyph = sym === '-' ? '—' : '•';
      steps.push({
        on: true,
        units: sym === '-' ? 3 : 1,
        char: ch,
        symbol: glyph,
      });
      symbols.push({ symbol: glyph, seqIndex });

      if (symIdx < codeArr.length - 1) {
        steps.push({ on: false, units: 1, char: ch, symbol: null });
      }
    });

    letterGroups.push({ char: ch, symbols });

    const isLastChar = charIdx === chars.length - 1;
    steps.push({
      on: false,
      units: isLastChar ? 7 : 3,
      char: ch,
      symbol: null,
    });
  });

  return { steps, letterGroups };
};

const formatTimerClock = (ms) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const getPixelZoneName = (p) => {
  if (p === null || p === undefined) return '';
  if (p >= 0 && p <= 19) return 'ВЕРХ-ЛЕВО';
  if (p >= 20 && p <= 30) return 'ПРАВЫЙ';
  return 'НИЗ-ЛЕВО';
};

/**
 * Screen 5: «УТИЛИТЫ»
 * Strobe beacon, Visual Countdown Timer, Battery HUD (real + test),
 * Zen 4-7-8 Breathing, ITU-R Morse Beacon, Precision Arcade, Roulette & Reflex Test.
 */
function UtilitiesScreen({
  brightness,
  onBrightnessChange,
  onActivePixelChange,
  onPixelLevelsChange,
  onEnsurePowerOn,
}) {
  const [sectionFilter, setSectionFilter] = useState('all'); // 'all' | 'utilities' | 'arcades'
  const [activeMode, setActiveMode] = useState(null); // 'strobe' | 'timer' | 'battery' | 'breath' | 'morse' | 'roulette' | 'reflex' | 'precision'

  // 1. Strobe State
  const [strobeHz, setStrobeHz] = useState(10);
  const [strobeDuty, setStrobeDuty] = useState(50);
  const [strobeLit, setStrobeLit] = useState(false);

  // 2. Timer State
  const [timerDuration, setTimerDuration] = useState(30);
  const [timerRemainingMs, setTimerRemainingMs] = useState(30000);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [timerDisplayMode, setTimerDisplayMode] = useState('pixels'); // 'pixels' | 'arcs'

  // 3. Battery State
  const [batteryMode, setBatteryMode] = useState('real'); // 'real' | 'test'
  const [realBatteryInfo, setRealBatteryInfo] = useState(null); // { level, isCharging, statusText } | null
  const [testBatteryLevel, setTestBatteryLevel] = useState(75);

  // 4. Breathing Zen 4-7-8 State
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState('INHALE'); // 'INHALE' | 'HOLD' | 'EXHALE'
  const [breathSeconds, setBreathSeconds] = useState(4);
  const [breathCycle, setBreathCycle] = useState(0);

  // 5. Morse Code Beacon State
  const [isMorseRunning, setIsMorseRunning] = useState(false);
  const [morsePreset, setMorsePreset] = useState('SOS');
  const [morseSpeed, setMorseSpeed] = useState(1); // 1 | 2
  const [currentMorseIndex, setCurrentMorseIndex] = useState(-1);

  // 6. Precision Timing Arcade Game State («МЕТКИЙ ГЛИФ»)
  const [isPrecisionRunning, setIsPrecisionRunning] = useState(false);
  const [precisionScore, setPrecisionScore] = useState(0);
  const [precisionStreak, setPrecisionStreak] = useState(1);
  const [precisionLives, setPrecisionLives] = useState(3);
  const [precisionBestScore, setPrecisionBestScore] = useState(0);
  const [precisionGameOver, setPrecisionGameOver] = useState(false);
  const [precisionTarget, setPrecisionTarget] = useState(12);
  const [precisionRunner, setPrecisionRunner] = useState(0);
  const [precisionFeedback, setPrecisionFeedback] = useState(null);

  // 7. Bottle Spin (Roulette) State
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerPixel, setWinnerPixel] = useState(null);

  // 8. Reflex State
  const [reflexState, setReflexState] = useState('IDLE'); // 'IDLE' | 'WAITING' | 'FLASH' | 'RESULT' | 'EARLY'
  const [reactionTime, setReactionTime] = useState(0);
  const [bestTime, setBestTime] = useState(0);

  const isMountedRef = useRef(true);

  // Always-fresh callback refs
  const onBrightnessChangeRef = useRef(onBrightnessChange);
  onBrightnessChangeRef.current = onBrightnessChange;
  const onActivePixelChangeRef = useRef(onActivePixelChange);
  onActivePixelChangeRef.current = onActivePixelChange;
  const onPixelLevelsChangeRef = useRef(onPixelLevelsChange);
  onPixelLevelsChangeRef.current = onPixelLevelsChange;
  const onEnsurePowerOnRef = useRef(onEnsurePowerOn);
  onEnsurePowerOnRef.current = onEnsurePowerOn;

  // Authoritative mode & parameter refs (eliminates stale closures)
  const activeModeRef = useRef(activeMode);
  const strobeHzRef = useRef(strobeHz);
  const strobeDutyRef = useRef(strobeDuty);
  const strobeStateRef = useRef(false);
  const strobePhaseStartRef = useRef(0);

  const batteryModeRef = useRef(batteryMode);
  const testBatteryLevelRef = useRef(testBatteryLevel);

  const timerDurationRef = useRef(timerDuration);
  const timerDisplayModeRef = useRef(timerDisplayMode);
  const timerEndTimeRef = useRef(0);
  const timerPausedRemainingRef = useRef(0);

  const morseSpeedRef = useRef(morseSpeed);
  const morsePresetRef = useRef(morsePreset);

  const reflexStateRef = useRef(reflexState);
  const bestTimeRef = useRef(bestTime);
  bestTimeRef.current = bestTime;

  // Tracked timer refs (100% cleanup guaranteed)
  const strobeTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const timerFlashRef = useRef(null);
  const batteryPollTimerRef = useRef(null);
  const breathTimerRef = useRef(null);
  const morseTimerRef = useRef(null);
  const spinTimerRef = useRef(null);
  const victoryTimerRef = useRef(null);
  const reflexTimerRef = useRef(null);
  const precisionTimerRef = useRef(null);
  const precisionFlashTimerRef = useRef(null);

  // Utility runtime refs
  const breathStartTimeRef = useRef(0);
  const lastBreathPhaseRef = useRef('');
  const lastBreathSecondsRef = useRef(-1);
  const lastBreathCycleRef = useRef(-1);

  const reflexStartTimeRef = useRef(0);
  const spinStepRef = useRef(0);

  const precisionRunnerRef = useRef(0);
  const precisionTargetRef = useRef(12);
  const precisionSpeedRef = useRef(80);
  const precisionStreakRef = useRef(1);
  const precisionScoreRef = useRef(0);
  const precisionLivesRef = useRef(3);
  const precisionBestScoreRef = useRef(0);
  const precisionFlashingRef = useRef(false);

  const morseDataMap = useMemo(() => {
    const map = {};
    MORSE_WORDS.forEach((word) => {
      map[word] = buildMorseData(word);
    });
    return map;
  }, []);

  const clearAllTimers = useCallback(() => {
    if (strobeTimerRef.current) {
      clearTimeout(strobeTimerRef.current);
      strobeTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (timerFlashRef.current) {
      clearInterval(timerFlashRef.current);
      timerFlashRef.current = null;
    }
    if (batteryPollTimerRef.current) {
      clearInterval(batteryPollTimerRef.current);
      batteryPollTimerRef.current = null;
    }
    if (breathTimerRef.current) {
      clearInterval(breathTimerRef.current);
      breathTimerRef.current = null;
    }
    if (morseTimerRef.current) {
      clearTimeout(morseTimerRef.current);
      morseTimerRef.current = null;
    }
    if (spinTimerRef.current) {
      clearTimeout(spinTimerRef.current);
      spinTimerRef.current = null;
    }
    if (victoryTimerRef.current) {
      clearInterval(victoryTimerRef.current);
      victoryTimerRef.current = null;
    }
    if (reflexTimerRef.current) {
      clearTimeout(reflexTimerRef.current);
      reflexTimerRef.current = null;
    }
    if (precisionTimerRef.current) {
      clearTimeout(precisionTimerRef.current);
      precisionTimerRef.current = null;
    }
    if (precisionFlashTimerRef.current) {
      clearTimeout(precisionFlashTimerRef.current);
      precisionFlashTimerRef.current = null;
    }
    precisionFlashingRef.current = false;
  }, []);

  // Clear pixelLevels and activePixel BEFORE setting brightness to [0,0,0],
  // because App.js's handleActivePixelChange(null) restores full brightness.
  const extinguishAll = useCallback(() => {
    onPixelLevelsChangeRef.current?.(null);
    onActivePixelChangeRef.current?.(null);
    onBrightnessChangeRef.current?.([0, 0, 0]);
  }, []);

  const stopAll = useCallback(() => {
    clearAllTimers();
    activeModeRef.current = null;
    setActiveMode(null);

    strobeStateRef.current = false;
    setStrobeLit(false);

    setIsTimerRunning(false);
    setIsTimerPaused(false);

    setIsBreathing(false);

    setIsMorseRunning(false);
    setCurrentMorseIndex(-1);

    setIsSpinning(false);

    setIsPrecisionRunning(false);
    setPrecisionFeedback(null);

    if (reflexStateRef.current === 'WAITING' || reflexStateRef.current === 'FLASH') {
      reflexStateRef.current = 'IDLE';
      setReflexState('IDLE');
    }

    extinguishAll();
  }, [clearAllTimers, extinguishAll]);

  // ========================================================================
  // 1. STROBE BEACON (Phase-accurate monotonic setTimeout, zero stall on drag)
  // ========================================================================
  const getStrobePhaseDurationMs = (isLit, hz, dutyPct) => {
    const safeHz = Math.max(1, Math.min(25, hz || 10));
    const periodMs = 1000 / safeHz;
    const duty = Math.max(20, Math.min(80, dutyPct || 50)) / 100;
    return isLit ? periodMs * duty : periodMs * (1 - duty);
  };

  const tickStrobe = useCallback(() => {
    if (activeModeRef.current !== 'strobe') return;
    const nextLit = !strobeStateRef.current;
    strobeStateRef.current = nextLit;
    strobePhaseStartRef.current = nowMs();
    setStrobeLit(nextLit);

    const b = nextLit ? 255 : 0;
    onBrightnessChangeRef.current?.([b, b, b]);

    const dur = getStrobePhaseDurationMs(nextLit, strobeHzRef.current, strobeDutyRef.current);
    strobeTimerRef.current = setTimeout(tickStrobe, Math.max(8, Math.round(dur)));
  }, []);

  const rescheduleStrobeLive = useCallback((hz, dutyPct) => {
    if (activeModeRef.current !== 'strobe') return;
    if (strobeTimerRef.current) {
      clearTimeout(strobeTimerRef.current);
      strobeTimerRef.current = null;
    }
    const targetDur = getStrobePhaseDurationMs(strobeStateRef.current, hz, dutyPct);
    const elapsed = Math.max(0, nowMs() - strobePhaseStartRef.current);
    if (elapsed >= targetDur) {
      tickStrobe();
    } else {
      strobeTimerRef.current = setTimeout(tickStrobe, Math.max(8, Math.round(targetDur - elapsed)));
    }
  }, [tickStrobe]);

  const handleToggleStrobe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeModeRef.current === 'strobe') {
      stopAll();
      return;
    }
    stopAll();
    onEnsurePowerOnRef.current?.();
    onPixelLevelsChangeRef.current?.(null);
    onActivePixelChangeRef.current?.(null);

    activeModeRef.current = 'strobe';
    setActiveMode('strobe');
    strobeStateRef.current = false;
    tickStrobe();
  };

  const handleStrobeHzChange = useCallback((newHz) => {
    const clamped = clampInt(newHz, 1, 25, 10);
    strobeHzRef.current = clamped;
    setStrobeHz(clamped);
    rescheduleStrobeLive(clamped, strobeDutyRef.current);
  }, [rescheduleStrobeLive]);

  const handleStrobeDutyChange = (newDuty) => {
    Haptics.selectionAsync().catch(() => {});
    strobeDutyRef.current = newDuty;
    setStrobeDuty(newDuty);
    rescheduleStrobeLive(strobeHzRef.current, newDuty);
  };

  // ========================================================================
  // 2. VISUAL TIMER (Timestamp-locked, Pause/Resume, 36 LED or Arcs, zero leaks)
  // ========================================================================
  const renderTimerGlyphs = useCallback((remainingMs, totalMs) => {
    const safeTotal = Math.max(1000, totalMs);
    const frac = Math.max(0, Math.min(1, remainingMs / safeTotal));

    if (timerDisplayModeRef.current === 'pixels') {
      const exactLeds = frac * TOTAL_LEDS;
      const fullCount = Math.floor(exactLeds);
      const partial = exactLeds - fullCount;
      const levels = new Array(TOTAL_LEDS).fill(0);
      for (let i = 0; i < TOTAL_LEDS; i++) {
        if (i < fullCount) levels[i] = 1.0;
        else if (i === fullCount && partial > 0.05) levels[i] = partial;
      }
      onPixelLevelsChangeRef.current?.(levels);
    } else {
      onPixelLevelsChangeRef.current?.(null);
      onActivePixelChangeRef.current?.(null);
      const b = Math.round(frac * 255);
      onBrightnessChangeRef.current?.([b, b, b]);
    }
  }, []);

  const triggerTimerCompletion = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setIsTimerRunning(false);
    setIsTimerPaused(false);
    setTimerFinished(true);
    setTimerRemainingMs(0);

    onPixelLevelsChangeRef.current?.(null);
    onActivePixelChangeRef.current?.(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    let flash = 0;
    if (timerFlashRef.current) clearInterval(timerFlashRef.current);
    timerFlashRef.current = setInterval(() => {
      if (activeModeRef.current !== 'timer') {
        clearInterval(timerFlashRef.current);
        timerFlashRef.current = null;
        return;
      }
      flash++;
      const fb = flash % 2 === 1 ? 255 : 0;
      onBrightnessChangeRef.current?.([fb, fb, fb]);
      if (flash >= 6) {
        clearInterval(timerFlashRef.current);
        timerFlashRef.current = null;
        stopAll();
      }
    }, 140);
  }, [stopAll]);

  const startTimerLoop = useCallback((runMs, totalMs) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    onEnsurePowerOnRef.current?.();
    activeModeRef.current = 'timer';
    setActiveMode('timer');
    setIsTimerRunning(true);
    setIsTimerPaused(false);
    setTimerFinished(false);

    timerEndTimeRef.current = nowMs() + runMs;
    renderTimerGlyphs(runMs, totalMs);

    countdownTimerRef.current = setInterval(() => {
      if (activeModeRef.current !== 'timer') return;
      const rem = Math.max(0, timerEndTimeRef.current - nowMs());
      setTimerRemainingMs(rem);
      renderTimerGlyphs(rem, totalMs);
      if (rem <= 0) {
        triggerTimerCompletion();
      }
    }, 80);
  }, [renderTimerGlyphs, triggerTimerCompletion]);

  const handleTimerStartOrPause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeModeRef.current === 'timer' && isTimerRunning) {
      const rem = Math.max(0, timerEndTimeRef.current - nowMs());
      timerPausedRemainingRef.current = rem;
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setIsTimerRunning(false);
      setIsTimerPaused(true);
      setTimerRemainingMs(rem);
      return;
    }

    if (activeModeRef.current === 'timer' && isTimerPaused) {
      const resumeMs = Math.max(100, timerPausedRemainingRef.current);
      startTimerLoop(resumeMs, timerDurationRef.current * 1000);
      return;
    }

    stopAll();
    const totalMs = timerDurationRef.current * 1000;
    setTimerRemainingMs(totalMs);
    startTimerLoop(totalMs, totalMs);
  };

  const handleSelectTimerDuration = (secs) => {
    Haptics.selectionAsync().catch(() => {});
    const clamped = clampInt(secs, 5, 600, 30);
    if (activeModeRef.current === 'timer') {
      stopAll();
    }
    timerDurationRef.current = clamped;
    setTimerDuration(clamped);
    setTimerRemainingMs(clamped * 1000);
    setTimerFinished(false);
  };

  const handleAdjustTimerDuration = (delta) => {
    handleSelectTimerDuration(timerDurationRef.current + delta);
  };

  const handleTimerDisplayModeChange = (mode) => {
    Haptics.selectionAsync().catch(() => {});
    timerDisplayModeRef.current = mode;
    setTimerDisplayMode(mode);
    if (activeModeRef.current === 'timer') {
      const rem = isTimerRunning
        ? Math.max(0, timerEndTimeRef.current - nowMs())
        : timerPausedRemainingRef.current;
      renderTimerGlyphs(rem, timerDurationRef.current * 1000);
    }
  };

  // ========================================================================
  // 3. BATTERY HUD (Real OS battery via NothingGlyph.getBatteryInfo + Test)
  // ========================================================================
  const applyBatteryGlyphs = useCallback((level) => {
    const safeLevel = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
    const count = Math.round((safeLevel / 100) * TOTAL_LEDS);
    onPixelLevelsChangeRef.current?.(null);

    if (count <= 0) {
      onActivePixelChangeRef.current?.([]);
      onBrightnessChangeRef.current?.([0, 0, 0]);
      return;
    }
    const activePixels = [];
    for (let i = 0; i < count; i++) {
      activePixels.push(i);
    }
    onActivePixelChangeRef.current?.(activePixels);
  }, []);

  const readBatteryOnce = useCallback((applyToGlyphs = false) => {
    try {
      const result = NothingGlyph?.getBatteryInfo?.();
      const handleInfo = (info) => {
        if (!isMountedRef.current) return;
        const pct = typeof info?.percent === 'number' ? info.percent : info?.level;
        if (!info || typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0) {
          setRealBatteryInfo(null);
          if (applyToGlyphs && activeModeRef.current === 'battery' && batteryModeRef.current === 'real') {
            applyBatteryGlyphs(0);
          }
          return;
        }

        const isCharging = Boolean(info.isCharging);
        const clean = {
          level: clampInt(pct, 0, 100, 0),
          isCharging,
          statusText: mapBatteryStatus(info.status, isCharging),
        };
        setRealBatteryInfo(clean);
        if (applyToGlyphs && activeModeRef.current === 'battery' && batteryModeRef.current === 'real') {
          applyBatteryGlyphs(clean.level);
        }
      };

      if (result && typeof result.then === 'function') {
        result.then(handleInfo).catch(() => handleInfo(null));
      } else {
        handleInfo(result ?? null);
      }
    } catch (e) {
      if (isMountedRef.current) {
        setRealBatteryInfo(null);
      }
    }
  }, [applyBatteryGlyphs]);

  useEffect(() => {
    isMountedRef.current = true;
    readBatteryOnce(false);
    return () => {
      isMountedRef.current = false;
    };
  }, [readBatteryOnce]);

  const startBatteryPolling = useCallback(() => {
    if (batteryPollTimerRef.current) {
      clearInterval(batteryPollTimerRef.current);
      batteryPollTimerRef.current = null;
    }
    readBatteryOnce(true);
    batteryPollTimerRef.current = setInterval(() => {
      if (activeModeRef.current === 'battery' && batteryModeRef.current === 'real') {
        readBatteryOnce(true);
      }
    }, 2000);
  }, [readBatteryOnce]);

  const handleToggleBattery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeModeRef.current === 'battery') {
      stopAll();
      return;
    }
    stopAll();
    onEnsurePowerOnRef.current?.();
    activeModeRef.current = 'battery';
    setActiveMode('battery');

    if (batteryModeRef.current === 'real') {
      startBatteryPolling();
    } else {
      applyBatteryGlyphs(testBatteryLevelRef.current);
    }
  };

  const handleBatteryModeSwitch = (mode) => {
    Haptics.selectionAsync().catch(() => {});
    batteryModeRef.current = mode;
    setBatteryMode(mode);

    if (batteryPollTimerRef.current) {
      clearInterval(batteryPollTimerRef.current);
      batteryPollTimerRef.current = null;
    }

    if (activeModeRef.current === 'battery') {
      if (mode === 'real') {
        startBatteryPolling();
      } else {
        applyBatteryGlyphs(testBatteryLevelRef.current);
      }
    } else if (mode === 'real') {
      readBatteryOnce(false);
    }
  };

  const handleTestBatteryChange = useCallback((newLevel) => {
    const clamped = clampInt(newLevel, 0, 100, 75);
    testBatteryLevelRef.current = clamped;
    setTestBatteryLevel(clamped);
    if (activeModeRef.current === 'battery' && batteryModeRef.current === 'test') {
      applyBatteryGlyphs(clamped);
    }
  }, [applyBatteryGlyphs]);

  // ========================================================================
  // 4. ZEN BREATHING 4-7-8 (60fps LED curve, <=1Hz React state updates!)
  // ========================================================================
  const startBreathingCycle = useCallback(() => {
    if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    breathStartTimeRef.current = nowMs();
    lastBreathPhaseRef.current = '';
    lastBreathSecondsRef.current = -1;
    lastBreathCycleRef.current = -1;

    breathTimerRef.current = setInterval(() => {
      if (activeModeRef.current !== 'breath') return;
      const elapsedTotal = (nowMs() - breathStartTimeRef.current) / 1000;
      const cycleTime = elapsedTotal % 19; // 4s inhale + 7s hold + 8s exhale
      const currentCycle = Math.floor(elapsedTotal / 19) + 1;

      let currentB = 0;
      let phaseName = 'INHALE';
      let secsLeft = 4;

      if (cycleTime < 4) {
        phaseName = 'INHALE';
        secsLeft = Math.max(1, Math.ceil(4 - cycleTime));
        const p = cycleTime / 4;
        currentB = Math.round(18 + 237 * (1 - Math.cos(p * Math.PI)) / 2);
      } else if (cycleTime < 11) {
        phaseName = 'HOLD';
        secsLeft = Math.max(1, Math.ceil(11 - cycleTime));
        const holdP = (cycleTime - 4) / 7;
        currentB = Math.round(250 + 5 * Math.sin(holdP * Math.PI * 4));
      } else {
        phaseName = 'EXHALE';
        secsLeft = Math.max(1, Math.ceil(19 - cycleTime));
        const p = (cycleTime - 11) / 8;
        currentB = Math.round(18 + 237 * (1 + Math.cos(p * Math.PI)) / 2);
      }

      if (currentCycle !== lastBreathCycleRef.current) {
        lastBreathCycleRef.current = currentCycle;
        setBreathCycle(currentCycle);
      }
      if (secsLeft !== lastBreathSecondsRef.current) {
        lastBreathSecondsRef.current = secsLeft;
        setBreathSeconds(secsLeft);
      }
      if (phaseName !== lastBreathPhaseRef.current) {
        lastBreathPhaseRef.current = phaseName;
        setBreathPhase(phaseName);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      onBrightnessChangeRef.current?.([currentB, currentB, currentB]);
    }, 16);
  }, []);

  const handleToggleBreath = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeModeRef.current === 'breath') {
      stopAll();
      return;
    }
    stopAll();
    onEnsurePowerOnRef.current?.();
    onPixelLevelsChangeRef.current?.(null);
    onActivePixelChangeRef.current?.(null);

    activeModeRef.current = 'breath';
    setActiveMode('breath');
    setIsBreathing(true);
    startBreathingCycle();
  };

  // ========================================================================
  // 5. TACTICAL MORSE BEACON (ITU-R verified, live symbol tracker, 1x/2x)
  // ========================================================================
  const startMorsePlayback = useCallback((presetKey) => {
    if (morseTimerRef.current) {
      clearTimeout(morseTimerRef.current);
      morseTimerRef.current = null;
    }
    const data = morseDataMap[presetKey] || morseDataMap.SOS;
    const pattern = data.steps;
    let stepIdx = 0;

    const playStep = () => {
      if (activeModeRef.current !== 'morse') return;
      if (stepIdx >= pattern.length) {
        stepIdx = 0;
      }
      const item = pattern[stepIdx];
      setCurrentMorseIndex(stepIdx);

      if (item.on) {
        onBrightnessChangeRef.current?.([255, 255, 255]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } else {
        onBrightnessChangeRef.current?.([0, 0, 0]);
      }

      const unitMs = morseSpeedRef.current === 2 ? 80 : 160;
      const durMs = Math.max(40, item.units * unitMs);
      stepIdx++;
      morseTimerRef.current = setTimeout(playStep, durMs);
    };

    playStep();
  }, [morseDataMap]);

  const handleToggleMorse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeModeRef.current === 'morse') {
      stopAll();
      return;
    }
    stopAll();
    onEnsurePowerOnRef.current?.();
    onPixelLevelsChangeRef.current?.(null);
    onActivePixelChangeRef.current?.(null);

    activeModeRef.current = 'morse';
    setActiveMode('morse');
    setIsMorseRunning(true);
    startMorsePlayback(morsePresetRef.current);
  };

  const handleSelectMorsePreset = (key) => {
    Haptics.selectionAsync().catch(() => {});
    morsePresetRef.current = key;
    setMorsePreset(key);
    setCurrentMorseIndex(-1);
    if (activeModeRef.current === 'morse') {
      startMorsePlayback(key);
    }
  };

  const handleToggleMorseSpeed = (spd) => {
    Haptics.selectionAsync().catch(() => {});
    morseSpeedRef.current = spd;
    setMorseSpeed(spd);
  };

  // ========================================================================
  // 6. PRECISION TIMING ARCADE («МЕТКИЙ ГЛИФ» via 36-LED pixelLevels)
  // ========================================================================
  const renderPrecisionFrame = useCallback((target, runner) => {
    const levels = new Array(TOTAL_LEDS).fill(0);
    levels[target] = 0.30;
    levels[(runner - 2 + TOTAL_LEDS) % TOTAL_LEDS] = Math.max(
      levels[(runner - 2 + TOTAL_LEDS) % TOTAL_LEDS],
      0.20
    );
    levels[(runner - 1 + TOTAL_LEDS) % TOTAL_LEDS] = Math.max(
      levels[(runner - 1 + TOTAL_LEDS) % TOTAL_LEDS],
      0.50
    );
    levels[runner] = 1.0;
    onPixelLevelsChangeRef.current?.(levels);
  }, []);

  const runPrecisionLoop = useCallback(() => {
    if (activeModeRef.current !== 'precision') return;

    precisionRunnerRef.current = (precisionRunnerRef.current + 1) % TOTAL_LEDS;
    setPrecisionRunner(precisionRunnerRef.current);

    if (!precisionFlashingRef.current) {
      renderPrecisionFrame(precisionTargetRef.current, precisionRunnerRef.current);
    }

    precisionTimerRef.current = setTimeout(runPrecisionLoop, precisionSpeedRef.current);
  }, [renderPrecisionFrame]);

  const startPrecisionGame = () => {
    stopAll();
    onEnsurePowerOnRef.current?.();
    activeModeRef.current = 'precision';
    setActiveMode('precision');
    setIsPrecisionRunning(true);
    setPrecisionScore(0);
    setPrecisionStreak(1);
    setPrecisionLives(3);
    setPrecisionGameOver(false);
    setPrecisionFeedback(null);

    precisionScoreRef.current = 0;
    precisionStreakRef.current = 1;
    precisionLivesRef.current = 3;
    precisionSpeedRef.current = 80;
    precisionFlashingRef.current = false;

    const newTarget = Math.floor(Math.random() * TOTAL_LEDS);
    precisionTargetRef.current = newTarget;
    setPrecisionTarget(newTarget);

    precisionRunnerRef.current = (newTarget + 18) % TOTAL_LEDS;
    setPrecisionRunner(precisionRunnerRef.current);
    renderPrecisionFrame(newTarget, precisionRunnerRef.current);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    precisionTimerRef.current = setTimeout(runPrecisionLoop, precisionSpeedRef.current);
  };

  const triggerPrecisionHitFlash = () => {
    if (precisionFlashTimerRef.current) {
      clearTimeout(precisionFlashTimerRef.current);
      precisionFlashTimerRef.current = null;
    }
    precisionFlashingRef.current = true;
    onPixelLevelsChangeRef.current?.(new Array(TOTAL_LEDS).fill(1.0));
    precisionFlashTimerRef.current = setTimeout(() => {
      precisionFlashTimerRef.current = null;
      precisionFlashingRef.current = false;
      if (activeModeRef.current === 'precision') {
        renderPrecisionFrame(precisionTargetRef.current, precisionRunnerRef.current);
      }
    }, 95);
  };

  const pickNextPrecisionTarget = (runner) => {
    let nextTarget = Math.floor(Math.random() * TOTAL_LEDS);
    while (Math.min(Math.abs(nextTarget - runner), TOTAL_LEDS - Math.abs(nextTarget - runner)) < 6) {
      nextTarget = Math.floor(Math.random() * TOTAL_LEDS);
    }
    precisionTargetRef.current = nextTarget;
    setPrecisionTarget(nextTarget);
  };

  const handlePrecisionCatch = () => {
    if (activeModeRef.current !== 'precision' || !isPrecisionRunning) {
      startPrecisionGame();
      return;
    }

    const runner = precisionRunnerRef.current;
    const target = precisionTargetRef.current;
    const diff = Math.min(Math.abs(runner - target), TOTAL_LEDS - Math.abs(runner - target));

    if (diff === 0) {
      const bonus = 100 * precisionStreakRef.current;
      precisionScoreRef.current += bonus;
      setPrecisionScore(precisionScoreRef.current);
      setPrecisionFeedback(`ТОЧНО! +${bonus}`);

      precisionStreakRef.current = Math.min(5, precisionStreakRef.current + 1);
      setPrecisionStreak(precisionStreakRef.current);
      precisionSpeedRef.current = Math.max(24, precisionSpeedRef.current - 4);

      if (precisionScoreRef.current > precisionBestScoreRef.current) {
        precisionBestScoreRef.current = precisionScoreRef.current;
        setPrecisionBestScore(precisionScoreRef.current);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      triggerPrecisionHitFlash();
      pickNextPrecisionTarget(runner);
    } else if (diff <= 1) {
      const bonus = 40;
      precisionScoreRef.current += bonus;
      setPrecisionScore(precisionScoreRef.current);
      setPrecisionFeedback('БЛИЗКО! +40');

      if (precisionScoreRef.current > precisionBestScoreRef.current) {
        precisionBestScoreRef.current = precisionScoreRef.current;
        setPrecisionBestScore(precisionScoreRef.current);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      triggerPrecisionHitFlash();
      pickNextPrecisionTarget(runner);
    } else {
      precisionLivesRef.current -= 1;
      setPrecisionLives(precisionLivesRef.current);
      precisionStreakRef.current = 1;
      setPrecisionStreak(1);
      setPrecisionFeedback('МИМО! -1 ЖИЗНЬ');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

      if (precisionLivesRef.current <= 0) {
        if (precisionTimerRef.current) {
          clearTimeout(precisionTimerRef.current);
          precisionTimerRef.current = null;
        }
        if (precisionFlashTimerRef.current) {
          clearTimeout(precisionFlashTimerRef.current);
          precisionFlashTimerRef.current = null;
        }
        precisionFlashingRef.current = false;
        activeModeRef.current = null;
        setActiveMode(null);
        setIsPrecisionRunning(false);
        setPrecisionGameOver(true);
        extinguishAll();
      }
    }
  };

  // ========================================================================
  // 7. SPIN THE BOTTLE («СВЕТОВАЯ БУТЫЛОЧКА») — uses [] on blink off, tracked ref
  // ========================================================================
  const handleStartBottleSpin = () => {
    if (isSpinning) return;
    stopAll();
    onEnsurePowerOnRef.current?.();
    onPixelLevelsChangeRef.current?.(null);

    activeModeRef.current = 'roulette';
    setActiveMode('roulette');
    setIsSpinning(true);
    setWinnerPixel(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const fullRevolutions = 3 + Math.floor(Math.random() * 3);
    const landingPixel = Math.floor(Math.random() * TOTAL_LEDS);
    const startPixel = Math.floor(Math.random() * TOTAL_LEDS);
    const totalSteps = fullRevolutions * TOTAL_LEDS + ((landingPixel - startPixel + TOTAL_LEDS) % TOTAL_LEDS);

    let currentPixel = startPixel;
    let step = 0;
    spinStepRef.current = 0;

    const runStep = () => {
      if (activeModeRef.current !== 'roulette') return;

      currentPixel = (currentPixel + 1) % TOTAL_LEDS;
      onActivePixelChangeRef.current?.(currentPixel);

      step++;
      spinStepRef.current = step;

      if (step < totalSteps) {
        const progress = step / totalSteps;
        let delayMs = 8;
        if (progress > 0.45) {
          const decelFactor = (progress - 0.45) / 0.55;
          delayMs = 8 + Math.floor(Math.pow(decelFactor, 2.4) * 218);
        }
        spinTimerRef.current = setTimeout(runStep, delayMs);
      } else {
        const finalPixel = currentPixel;
        setWinnerPixel(finalPixel);
        setIsSpinning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        let flash = 0;
        if (victoryTimerRef.current) clearInterval(victoryTimerRef.current);
        victoryTimerRef.current = setInterval(() => {
          if (activeModeRef.current !== 'roulette') {
            clearInterval(victoryTimerRef.current);
            victoryTimerRef.current = null;
            return;
          }
          flash++;
          // Pass [] (not null!) on odd steps so all 3 arcs don't light up
          if (flash % 2 === 1) {
            onActivePixelChangeRef.current?.([]);
          } else {
            onActivePixelChangeRef.current?.(finalPixel);
          }
          if (flash >= 6) {
            clearInterval(victoryTimerRef.current);
            victoryTimerRef.current = null;
            onActivePixelChangeRef.current?.(finalPixel);
          }
        }, 120);
      }
    };

    runStep();
  };

  const handleResetRoulette = () => {
    Haptics.selectionAsync().catch(() => {});
    setWinnerPixel(null);
    if (activeModeRef.current === 'roulette') {
      stopAll();
    }
  };

  // ========================================================================
  // 8. REFLEX TEST (Clean blackout before flash, instant full-arc flash)
  // ========================================================================
  const handleReflexTap = () => {
    const curState = reflexStateRef.current;

    if (curState === 'IDLE' || curState === 'RESULT' || curState === 'EARLY') {
      stopAll();
      onEnsurePowerOnRef.current?.();
      extinguishAll();

      activeModeRef.current = 'reflex';
      setActiveMode('reflex');
      reflexStateRef.current = 'WAITING';
      setReflexState('WAITING');
      Haptics.selectionAsync().catch(() => {});

      const randDelay = 1400 + Math.random() * 2400;
      reflexTimerRef.current = setTimeout(() => {
        if (activeModeRef.current !== 'reflex') return;
        reflexStateRef.current = 'FLASH';
        setReflexState('FLASH');
        reflexStartTimeRef.current = nowMs();
        onPixelLevelsChangeRef.current?.(null);
        onActivePixelChangeRef.current?.(null);
        onBrightnessChangeRef.current?.([255, 255, 255]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, randDelay);
    } else if (curState === 'WAITING') {
      if (reflexTimerRef.current) {
        clearTimeout(reflexTimerRef.current);
        reflexTimerRef.current = null;
      }
      activeModeRef.current = null;
      setActiveMode(null);
      reflexStateRef.current = 'EARLY';
      setReflexState('EARLY');
      extinguishAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (curState === 'FLASH') {
      const elapsed = Math.max(1, Math.round(nowMs() - reflexStartTimeRef.current));
      setReactionTime(elapsed);
      if (bestTimeRef.current === 0 || elapsed < bestTimeRef.current) {
        setBestTime(elapsed);
      }
      activeModeRef.current = null;
      setActiveMode(null);
      reflexStateRef.current = 'RESULT';
      setReflexState('RESULT');
      extinguishAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  // Unmount cleanup (clears every timer and extinguishes LEDs cleanly)
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      activeModeRef.current = null;
      clearAllTimers();
      extinguishAll();
    };
  }, [clearAllTimers, extinguishAll]);

  // Computed visual helpers
  const strobePeriodMs = Math.round(1000 / strobeHz);
  const strobeOnMs = Math.round(strobePeriodMs * (strobeDuty / 100));
  const strobeOffMs = Math.max(1, strobePeriodMs - strobeOnMs);

  const timerTotalMs = Math.max(1000, timerDuration * 1000);
  const timerProgressPct = Math.max(0, Math.min(100, (timerRemainingMs / timerTotalMs) * 100));

  const displayedBattery = batteryMode === 'real'
    ? (realBatteryInfo ? realBatteryInfo.level : null)
    : testBatteryLevel;
  const displayedBatteryLeds = displayedBattery !== null
    ? Math.round((displayedBattery / 100) * TOTAL_LEDS)
    : 0;

  const activeMorseData = morseDataMap[morsePreset] || morseDataMap.SOS;
  const currentMorseStep = currentMorseIndex >= 0 ? activeMorseData.steps[currentMorseIndex] : null;

  const showUtilities = sectionFilter === 'all' || sectionFilter === 'utilities';
  const showArcades = sectionFilter === 'all' || sectionFilter === 'arcades';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================ */}
      {/* SEGMENTED SECTION FILTER: ВСЕ (8) | УТИЛИТЫ (5) | АРКАДЫ (3) */}
      {/* ============================================================ */}
      <View style={styles.filterBar}>
        {[
          { id: 'all', label: 'ВСЕ (8)' },
          { id: 'utilities', label: 'УТИЛИТЫ (5)' },
          { id: 'arcades', label: 'АРКАДЫ (3)' },
        ].map((tab) => {
          const isSel = sectionFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterPill, isSel && styles.filterPillActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSectionFilter(tab.id);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.filterPillText, isSel && styles.filterPillTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showUtilities && (
        <>
          {/* ============================================================ */}
          {/* 1. STROBE BEACON                                             */}
          {/* ============================================================ */}
          <LiquidGlassCard isActive={activeMode === 'strobe'}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWithDot}>
                <Zap size={13} color={activeMode === 'strobe' ? GlyphColors.neonRed : '#D8D8E4'} />
                <View
                  style={[
                    styles.liveLedDot,
                    activeMode === 'strobe' && strobeLit && styles.liveLedDotOn,
                  ]}
                />
                <Text
                  style={styles.cardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  СТРОБОСКОП
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btn, activeMode === 'strobe' && styles.btnActive]}
                onPress={handleToggleStrobe}
                activeOpacity={0.7}
              >
                <View style={styles.btnIconRow}>
                  {activeMode === 'strobe' ? (
                    <Square size={9} color="#000000" fill="#000000" />
                  ) : (
                    <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
                  )}
                  <Text style={[styles.btnText, activeMode === 'strobe' && styles.btnTextActive]}>
                    {activeMode === 'strobe' ? 'СТОП' : 'СТАРТ'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <GlyphSlider
              label="ЧАСТОТА МИГАНИЯ"
              value={strobeHz}
              min={1}
              max={25}
              step={1}
              unit=" ГЦ"
              displayValue={`${strobeHz} ГЦ (${strobePeriodMs} МС)`}
              accentColor={GlyphColors.neonRed}
              onValueChange={handleStrobeHzChange}
            />

            {strobeHz > 3 && (
              <View style={styles.wcagWarningBar}>
                <AlertTriangle size={11} color="#FF7B84" />
                <Text
                  style={styles.wcagWarningText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  ВЫСОКАЯ ЧАСТОТА (&gt;3 ГЦ): РИСК ПРИ ФОТОЧУВСТВИТЕЛЬНОСТИ (WCAG 2.3.1)
                </Text>
              </View>
            )}

            <View style={styles.statusSubRow}>
              <Text style={styles.statusSubText}>
                {activeMode === 'strobe'
                  ? `АКТИВНО • ВКЛ ${strobeOnMs}МС / ВЫКЛ ${strobeOffMs}МС`
                  : `ГОТОВ • ПЕРИОД ${strobePeriodMs}МС (${strobeDuty}%)`}
              </Text>
              <View style={styles.dutySwitchRow}>
                {[25, 50, 75].map((duty) => (
                  <TouchableOpacity
                    key={duty}
                    style={[styles.miniChip, strobeDuty === duty && styles.miniChipActive]}
                    onPress={() => handleStrobeDutyChange(duty)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.miniChipText, strobeDuty === duty && styles.miniChipTextActive]}>
                      {duty}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.presetsRow}>
              {[1, 5, 10, 15, 20, 25].map((hz) => (
                <TouchableOpacity
                  key={hz}
                  style={[styles.smallPresetBtn, strobeHz === hz && styles.smallPresetBtnActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    handleStrobeHzChange(hz);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.smallPresetText, strobeHz === hz && styles.smallPresetTextActive]}>
                    {hz} ГЦ
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </LiquidGlassCard>

          {/* ============================================================ */}
          {/* 2. VISUAL TIMER                                              */}
          {/* ============================================================ */}
          <LiquidGlassCard isActive={activeMode === 'timer'}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWithDot}>
                <Timer size={13} color={GlyphColors.neonCyan} />
                <Text
                  style={styles.cardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  ТАЙМЕР
                </Text>
                <View style={styles.timerClockBadge}>
                  <Text style={styles.timerClockText}>{formatTimerClock(timerRemainingMs)}</Text>
                </View>
              </View>
              <View style={styles.headerActionsRow}>
                <TouchableOpacity
                  style={[styles.btn, isTimerRunning && styles.btnActive]}
                  onPress={handleTimerStartOrPause}
                  activeOpacity={0.7}
                >
                  <View style={styles.btnIconRow}>
                    {isTimerRunning ? (
                      <Pause size={10} color="#000000" fill="#000000" />
                    ) : (
                      <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
                    )}
                    <Text style={[styles.btnText, isTimerRunning && styles.btnTextActive]}>
                      {isTimerRunning ? 'ПАУЗА' : isTimerPaused ? 'ДАЛЕЕ' : 'ПУСК'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {(isTimerRunning || isTimerPaused) && (
                  <TouchableOpacity style={styles.btnStop} onPress={stopAll} activeOpacity={0.7}>
                    <View style={styles.btnIconRow}>
                      <Square size={9} color="#FFFFFF" fill="#FFFFFF" />
                      <Text style={styles.btnText}>СТОП</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${timerProgressPct.toFixed(1)}%` }]} />
            </View>

            <View style={styles.statusSubRow}>
              <Text style={styles.statusSubText}>
                {timerFinished
                  ? 'ЗАВЕРШЕНО!'
                  : isTimerRunning
                  ? 'ИДЁТ ОТСЧЁТ'
                  : isTimerPaused
                  ? 'НА ПАУЗЕ'
                  : `УСТАНОВЛЕНО: ${timerDuration} С`}
              </Text>
              <View style={styles.dutySwitchRow}>
                <TouchableOpacity
                  style={[styles.miniChip, timerDisplayMode === 'pixels' && styles.miniChipCyanActive]}
                  onPress={() => handleTimerDisplayModeChange('pixels')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.miniChipText, timerDisplayMode === 'pixels' && styles.miniChipCyanText]}>
                    36 LED
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.miniChip, timerDisplayMode === 'arcs' && styles.miniChipActive]}
                  onPress={() => handleTimerDisplayModeChange('arcs')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.miniChipText, timerDisplayMode === 'arcs' && styles.miniChipTextActive]}>
                    ДУГИ
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.presetsRow}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustTimerDuration(-5)}
                activeOpacity={0.7}
              >
                <Text style={styles.smallPresetText}>-5С</Text>
              </TouchableOpacity>
              {[10, 30, 60, 120].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.smallPresetBtn,
                    timerDuration === s && !isTimerRunning && !isTimerPaused && styles.smallPresetBtnActive,
                  ]}
                  onPress={() => handleSelectTimerDuration(s)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.smallPresetText,
                      timerDuration === s && !isTimerRunning && !isTimerPaused && styles.smallPresetTextActive,
                    ]}
                  >
                    {s} С
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustTimerDuration(5)}
                activeOpacity={0.7}
              >
                <Text style={styles.smallPresetText}>+5С</Text>
              </TouchableOpacity>
            </View>
          </LiquidGlassCard>

          {/* ============================================================ */}
          {/* 3. BATTERY HUD (REAL OS + MANUAL TEST)                       */}
          {/* ============================================================ */}
          <LiquidGlassCard isActive={activeMode === 'battery'}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWithDot}>
                <BatteryCharging size={14} color={GlyphColors.neonCyan} />
                <Text
                  style={styles.cardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  ИНДИКАТОР ЗАРЯДА
                </Text>
                {batteryMode === 'real' && realBatteryInfo?.isCharging && (
                  <View style={styles.chargingBadge}>
                    <Zap size={9} color={GlyphColors.neonCyan} fill={GlyphColors.neonCyan} />
                    <Text style={styles.chargingBadgeText} numberOfLines={1}>ЗАРЯДКА</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.btn, activeMode === 'battery' && styles.btnActive]}
                onPress={handleToggleBattery}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnText, activeMode === 'battery' && styles.btnTextActive]}>
                  {activeMode === 'battery' ? 'ОТКЛ' : 'ВКЛ'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.batteryModeRow}>
              <TouchableOpacity
                style={[styles.smallPresetBtn, batteryMode === 'real' && styles.smallPresetBtnCyan]}
                onPress={() => handleBatteryModeSwitch('real')}
                activeOpacity={0.7}
              >
                <Text style={[styles.smallPresetText, batteryMode === 'real' && styles.smallPresetTextCyan]}>
                  РЕАЛЬНАЯ
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallPresetBtn, batteryMode === 'test' && styles.smallPresetBtnActive]}
                onPress={() => handleBatteryModeSwitch('test')}
                activeOpacity={0.7}
              >
                <Text style={[styles.smallPresetText, batteryMode === 'test' && styles.smallPresetTextActive]}>
                  ТЕСТ ШКАЛЫ
                </Text>
              </TouchableOpacity>
            </View>

            {batteryMode === 'real' ? (
              <View style={styles.realBatteryBox}>
                <Text style={styles.realBatteryValue}>
                  {displayedBattery !== null
                    ? `${displayedBattery}% (${displayedBatteryLeds} / ${TOTAL_LEDS} LED)`
                    : 'НЕТ ДАННЫХ АКБ'}
                </Text>
                <View style={styles.realBatterySubRow}>
                  {realBatteryInfo?.isCharging && (
                    <Zap size={10} color={GlyphColors.neonCyan} fill={GlyphColors.neonCyan} />
                  )}
                  <Text style={styles.realBatterySub}>
                    {realBatteryInfo
                      ? `СТАТУС: ${realBatteryInfo.statusText}`
                      : 'ПЕРЕКЛЮЧИТЕ В «ТЕСТ ШКАЛЫ» ДЛЯ РУЧНОЙ ПРОВЕРКИ'}
                  </Text>
                </View>
              </View>
            ) : (
              <GlyphSlider
                label="УРОВЕНЬ БАТАРЕИ (ТЕСТ)"
                value={testBatteryLevel}
                min={0}
                max={100}
                step={1}
                unit="%"
                displayValue={`${testBatteryLevel}% (${Math.round((testBatteryLevel / 100) * TOTAL_LEDS)} / ${TOTAL_LEDS} LED)`}
                accentColor={GlyphColors.neonCyan}
                onValueChange={handleTestBatteryChange}
              />
            )}
          </LiquidGlassCard>

          {/* ============================================================ */}
          {/* 4. ZEN BREATHING 4-7-8                                       */}
          {/* ============================================================ */}
          <LiquidGlassCard isActive={activeMode === 'breath'}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWithDot}>
                <Wind size={13} color="#FFFFFF" />
                <Text
                  style={styles.cardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {isBreathing
                    ? `ДЫХАНИЕ: ${breathPhase === 'INHALE' ? 'ВДОХ' : breathPhase === 'HOLD' ? 'ЗАДЕРЖКА' : 'ВЫДОХ'} (${breathSeconds} С)`
                    : 'ДЫХАНИЕ ZEN (4-7-8)'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.btn, isBreathing && styles.btnActive]}
                onPress={handleToggleBreath}
                activeOpacity={0.7}
              >
                <View style={styles.btnIconRow}>
                  {isBreathing ? (
                    <Square size={9} color="#000000" fill="#000000" />
                  ) : (
                    <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
                  )}
                  <Text style={[styles.btnText, isBreathing && styles.btnTextActive]}>
                    {isBreathing ? 'СТОП' : 'СТАРТ'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.breathInfoRow}>
              <View style={[styles.breathPhaseBadge, isBreathing && breathPhase === 'INHALE' && styles.breathPhaseBadgeActive]}>
                <Text style={[styles.breathPhaseText, isBreathing && breathPhase === 'INHALE' && styles.breathPhaseTextActive]}>
                  ВДОХ 4С
                </Text>
              </View>
              <View style={[styles.breathPhaseBadge, isBreathing && breathPhase === 'HOLD' && styles.breathPhaseBadgeActive]}>
                <Text style={[styles.breathPhaseText, isBreathing && breathPhase === 'HOLD' && styles.breathPhaseTextActive]}>
                  ЗАДЕРЖКА 7С
                </Text>
              </View>
              <View style={[styles.breathPhaseBadge, isBreathing && breathPhase === 'EXHALE' && styles.breathPhaseBadgeActive]}>
                <Text style={[styles.breathPhaseText, isBreathing && breathPhase === 'EXHALE' && styles.breathPhaseTextActive]}>
                  ВЫДОХ 8С
                </Text>
              </View>
              {isBreathing && (
                <Text style={styles.breathCycleCount}>#{breathCycle}</Text>
              )}
            </View>
          </LiquidGlassCard>

          {/* ============================================================ */}
          {/* 5. TACTICAL MORSE BEACON (ITU-R)                             */}
          {/* ============================================================ */}
          <LiquidGlassCard isActive={activeMode === 'morse'}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWithDot}>
                <Radio size={13} color={GlyphColors.neonRed} />
                <Text
                  style={styles.cardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  МАЯК МОРЗЕ (ITU-R)
                </Text>
              </View>
              <View style={styles.headerActionsRow}>
                {[1, 2].map((spd) => (
                  <TouchableOpacity
                    key={spd}
                    style={[styles.miniChip, morseSpeed === spd && styles.miniChipCyanActive]}
                    onPress={() => handleToggleMorseSpeed(spd)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.miniChipText, morseSpeed === spd && styles.miniChipCyanText]}>
                      {spd}x
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.btn, isMorseRunning && styles.btnActive]}
                  onPress={handleToggleMorse}
                  activeOpacity={0.7}
                >
                  <View style={styles.btnIconRow}>
                    {isMorseRunning ? (
                      <Square size={9} color="#000000" fill="#000000" />
                    ) : (
                      <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
                    )}
                    <Text style={[styles.btnText, isMorseRunning && styles.btnTextActive]}>
                      {isMorseRunning ? 'СТОП' : 'МАЯК'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.presetsRow}>
              {MORSE_WORDS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.smallPresetBtn,
                    morsePreset === key && styles.smallPresetBtnActive,
                  ]}
                  onPress={() => handleSelectMorsePreset(key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.smallPresetText,
                      morsePreset === key && styles.smallPresetTextActive,
                    ]}
                  >
                    {key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Live ITU-R Symbol Sequence Visualizer */}
            <View style={styles.morseVisBox}>
              <View style={styles.morseTokensWrap}>
                {activeMorseData.letterGroups.map((group, gIdx) => (
                  <View key={`${group.char}-${gIdx}`} style={styles.morseLetterPill}>
                    <Text style={styles.morseCharLabel}>{group.char}</Text>
                    <View style={styles.morseSymbolsRow}>
                      {group.symbols.map((sym) => {
                        const isLit = isMorseRunning && currentMorseIndex === sym.seqIndex;
                        return (
                          <Text
                            key={sym.seqIndex}
                            style={[styles.morseSymbolText, isLit && styles.morseSymbolTextActive]}
                          >
                            {sym.symbol}
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.morseStatusText}>
                {isMorseRunning
                  ? currentMorseStep?.on
                    ? `ПЕРЕДАЧА: ${currentMorseStep.char} [${currentMorseStep.symbol}] (${morseSpeed}x)`
                    : `ПАУЗА МЕЖДУ СИГНАЛАМИ (${morseSpeed}x)`
                  : `КОД ITU-R: ${morsePreset} • СКОРОСТЬ ${morseSpeed}x`}
              </Text>
            </View>
          </LiquidGlassCard>
        </>
      )}

      {/* ============================================================ */}
      {/* 6. ARCADE MINI-GAMES                                         */}
      {/* ============================================================ */}
      {showArcades && (
        <>
          <View style={styles.arcadeHeaderRow}>
            <Text style={styles.arcadeSectionTitle}>АРКАДНЫЕ ИГРЫ GLYPH</Text>
          </View>

          {/* GAME 1: PRECISION TIMING ARCADE («МЕТКИЙ ГЛИФ») */}
          <LiquidGlassCard isActive={activeMode === 'precision'}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWithDot}>
                <Target size={13} color={GlyphColors.neonCyan} />
                <Text
                  style={styles.cardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  МЕТКИЙ ГЛИФ
                </Text>
              </View>
              <View style={styles.arcadeStatsRow}>
                <View style={styles.scorePill}>
                  <Text
                    style={styles.scorePillText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    СЧЁТ: {precisionScore}
                  </Text>
                </View>
                <View style={[styles.streakPill, precisionStreak > 1 && styles.streakPillActive]}>
                  <Text
                    style={[styles.streakPillText, precisionStreak > 1 && styles.streakPillTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    x{precisionStreak}
                  </Text>
                </View>
                <View style={styles.livesRow}>
                  {[0, 1, 2].map((idx) => {
                    const alive = idx < precisionLives;
                    return (
                      <Heart
                        key={idx}
                        size={11}
                        color={alive ? GlyphColors.neonRed : '#6A6A7A'}
                        fill={alive ? GlyphColors.neonRed : 'transparent'}
                      />
                    );
                  })}
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.precisionArcadeBtn,
                isPrecisionRunning && styles.precisionArcadeBtnActive,
                precisionGameOver && styles.precisionArcadeBtnGameOver,
              ]}
              onPress={handlePrecisionCatch}
              activeOpacity={0.8}
            >
              <View style={styles.btnIconRow}>
                {isPrecisionRunning ? (
                  <Target size={14} color="#FFFFFF" />
                ) : (
                  <Play size={13} color="#FFFFFF" fill="#FFFFFF" />
                )}
                <Text
                  style={[
                    styles.precisionBtnMainText,
                    isPrecisionRunning && styles.precisionBtnMainTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {!isPrecisionRunning && !precisionGameOver && 'НАЧАТЬ ИГРУ'}
                  {isPrecisionRunning && 'ПОЙМАТЬ МИШЕНЬ!'}
                  {precisionGameOver && `ИГРА ОКОНЧЕНА (${precisionScore}) • ЗАНОВО`}
                </Text>
              </View>
              {isPrecisionRunning && (
                <Text style={styles.precisionBtnSubText}>
                  {precisionFeedback
                    ? `${precisionFeedback} • МИШЕНЬ #${precisionTarget} • ЛУЧ #${precisionRunner}`
                    : `МИШЕНЬ: LED #${precisionTarget} • ЛУЧ: LED #${precisionRunner}`}
                </Text>
              )}
              {precisionBestScore > 0 && !isPrecisionRunning && (
                <Text style={styles.precisionBtnSubText}>
                  РЕКОРД СЕССИИ: {precisionBestScore} ОЧКОВ
                </Text>
              )}
            </TouchableOpacity>
          </LiquidGlassCard>

          {/* GAME 2: SPIN THE BOTTLE (СВЕТОВАЯ БУТЫЛОЧКА) */}
          <LiquidGlassCard isActive={activeMode === 'roulette'}>
            <View style={styles.rouletteBox}>
              <View style={styles.cardHeader}>
                <View style={styles.titleWithDot}>
                  <RotateCcw size={13} color="#FFFFFF" />
                  <Text
                    style={styles.cardTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    СВЕТОВАЯ БУТЫЛОЧКА
                  </Text>
                </View>
                <View style={styles.headerActionsRow}>
                  {(winnerPixel !== null || activeMode === 'roulette') && !isSpinning && (
                    <TouchableOpacity style={styles.btnStop} onPress={handleResetRoulette} activeOpacity={0.7}>
                      <Text style={styles.btnText}>СБРОС</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.btn, isSpinning && styles.btnActive]}
                    onPress={handleStartBottleSpin}
                    disabled={isSpinning}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.btnText, isSpinning && styles.btnTextActive]}>
                      {isSpinning ? 'КРУТИТ...' : 'КРУТИТЬ'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.resultBadge}>
                <Text style={styles.resultBadgeText}>
                  {isSpinning
                    ? 'ВРАЩЕНИЕ 36 LED...'
                    : winnerPixel !== null
                    ? `ВЫБРАН LED #${winnerPixel} • ЗОНА: ${getPixelZoneName(winnerPixel)}`
                    : 'НАЖМИТЕ «КРУТИТЬ» ДЛЯ ЗАПУСКА'}
                </Text>
              </View>
            </View>
          </LiquidGlassCard>

          {/* GAME 3: REFLEX TEST */}
          <LiquidGlassCard isActive={activeMode === 'reflex'}>
            <View style={styles.cardHeader}>
              <View style={styles.titleWithDot}>
                <Zap size={13} color={GlyphColors.neonCyan} />
                <Text
                  style={styles.cardTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  ТЕСТ РЕАКЦИИ
                </Text>
              </View>
              {bestTime > 0 && (
                <View style={styles.bestTimeBadge}>
                  <Text
                    style={styles.bestTimeText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    РЕКОРД: {bestTime} МС
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.reflexPad,
                reflexState === 'WAITING' && styles.reflexPadWaiting,
                reflexState === 'FLASH' && styles.reflexPadFlash,
                reflexState === 'EARLY' && styles.reflexPadEarly,
              ]}
              onPress={handleReflexTap}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.reflexMainText,
                  reflexState === 'FLASH' && styles.reflexMainTextFlash,
                ]}
              >
                {reflexState === 'IDLE' && 'НАЖМИТЕ ДЛЯ СТАРТА'}
                {reflexState === 'WAITING' && 'ЖДИТЕ СВЕТА...'}
                {reflexState === 'FLASH' && 'ЖМИТЕ СЕЙЧАС!'}
                {reflexState === 'EARLY' && 'СЛИШКОМ РАНО!'}
                {reflexState === 'RESULT' && `${reactionTime} МС`}
              </Text>

              {reflexState === 'WAITING' && (
                <Text style={styles.reflexSubText}>ОЖИДАНИЕ ВСПЫШКИ — НЕ НАЖИМАЙТЕ РАНЬШЕ</Text>
              )}
              {reflexState === 'EARLY' && (
                <Text style={styles.reflexEarlySubText}>НАЖМИТЕ ЕЩЁ РАЗ ДЛЯ НОВОЙ ПОПЫТКИ</Text>
              )}
              {reflexState === 'RESULT' && (
                <View style={styles.reflexResultRow}>
                  {reactionTime < 220 ? (
                    <Zap size={11} color={GlyphColors.neonCyan} fill={GlyphColors.neonCyan} />
                  ) : (
                    <Award size={11} color={GlyphColors.neonCyan} />
                  )}
                  <Text style={styles.reflexSubTextInline}>
                    {reactionTime < 220
                      ? 'НЕВЕРОЯТНАЯ РЕАКЦИЯ! • НАЖМИТЕ ЕЩЁ РАЗ'
                      : reactionTime < 320
                      ? 'ОТЛИЧНЫЙ РЕЗУЛЬТАТ • НАЖМИТЕ ЕЩЁ РАЗ'
                      : 'ХОРОШАЯ ПОПЫТКА • НАЖМИТЕ ЕЩЁ РАЗ'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </LiquidGlassCard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 115,
    gap: 8,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 2,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 6.5,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: '#FFFFFF',
  },
  filterPillText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#A6A6B6',
    letterSpacing: 0.6,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 6,
  },
  titleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  liveLedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  liveLedDotOn: {
    backgroundColor: '#FFFFFF',
    borderColor: GlyphColors.neonRed,
    shadowColor: '#FFFFFF',
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  cardTitle: {
    fontFamily: 'NDOT57',
    fontSize: 10.5,
    color: '#FFFFFF',
    letterSpacing: 0.9,
    flexShrink: 1,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  btnIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  btn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderTopColor: 'rgba(255, 255, 255, 0.40)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  btnStop: {
    backgroundColor: 'rgba(215, 25, 32, 0.24)',
    borderWidth: 1,
    borderColor: GlyphColors.nothingRed,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  btnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  btnText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#FFFFFF',
    letterSpacing: 0.7,
  },
  btnTextActive: {
    color: '#000000',
  },
  wcagWarningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(215, 25, 32, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 123, 132, 0.40)',
    marginVertical: 3,
  },
  wcagWarningText: {
    fontFamily: 'NDOT57',
    fontSize: 7,
    color: '#FFB4B8',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  statusSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 4,
    gap: 6,
  },
  statusSubText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B4',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  dutySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  miniChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: '#FFFFFF',
  },
  miniChipCyanActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
    borderColor: GlyphColors.neonCyan,
  },
  miniChipText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B4',
  },
  miniChipTextActive: {
    color: '#FFFFFF',
  },
  miniChipCyanText: {
    color: GlyphColors.neonCyan,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  smallPresetBtn: {
    flex: 1,
    paddingVertical: 5.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
  },
  adjustBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
  },
  smallPresetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderTopColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.20,
    shadowRadius: 5,
  },
  smallPresetBtnCyan: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: GlyphColors.neonCyan,
  },
  smallPresetText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B4',
    letterSpacing: 0.4,
  },
  smallPresetTextActive: {
    color: '#FFFFFF',
  },
  smallPresetTextCyan: {
    color: GlyphColors.neonCyan,
  },
  timerClockBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  timerClockText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginVertical: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: GlyphColors.neonCyan,
  },
  batteryModeRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  chargingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: GlyphColors.neonCyan,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chargingBadgeText: {
    fontFamily: 'NDOT57',
    fontSize: 7,
    color: GlyphColors.neonCyan,
    letterSpacing: 0.5,
  },
  realBatteryBox: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    gap: 3,
  },
  realBatteryValue: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  realBatterySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  realBatterySub: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B4',
    letterSpacing: 0.5,
  },
  morseVisBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 6,
  },
  morseTokensWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  morseLetterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  morseCharLabel: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#A4A4B4',
  },
  morseSymbolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  morseSymbolText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#A0A0B0',
  },
  morseSymbolTextActive: {
    color: GlyphColors.neonRed,
    textShadowColor: GlyphColors.neonRed,
    textShadowRadius: 6,
  },
  morseStatusText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#B4B4C4',
    letterSpacing: 0.6,
  },
  arcadeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  arcadeSectionTitle: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#D8D8E4',
    letterSpacing: 1.2,
  },
  rouletteBox: {
    gap: 8,
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderTopColor: 'rgba(255, 255, 255, 0.30)',
    alignItems: 'center',
  },
  resultBadgeText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  bestTimeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.40)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  bestTimeText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: GlyphColors.neonCyan,
    letterSpacing: 0.8,
  },
  reflexPad: {
    height: 110,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 10,
  },
  reflexPadWaiting: {
    backgroundColor: '#0A0A0E',
    borderColor: '#2A2A33',
  },
  reflexPadFlash: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  reflexPadEarly: {
    backgroundColor: 'rgba(215, 25, 32, 0.25)',
    borderColor: GlyphColors.nothingRed,
  },
  reflexMainText: {
    fontFamily: 'NDOT57',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 1.6,
  },
  reflexMainTextFlash: {
    color: '#000000',
  },
  reflexResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
  },
  reflexSubText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#A4A4B4',
    letterSpacing: 0.7,
    marginTop: 6,
    textAlign: 'center',
  },
  reflexSubTextInline: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#B4B4C4',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  reflexEarlySubText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#FFB4B8',
    letterSpacing: 0.7,
    marginTop: 6,
    textAlign: 'center',
  },
  breathInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  breathPhaseBadge: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
  },
  breathPhaseBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  breathPhaseText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#A4A4B4',
    letterSpacing: 0.6,
  },
  breathPhaseTextActive: {
    color: '#FFFFFF',
  },
  breathCycleCount: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: GlyphColors.neonCyan,
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  arcadeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  scorePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexShrink: 1,
  },
  scorePillText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  streakPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexShrink: 0,
  },
  streakPillActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: GlyphColors.neonCyan,
  },
  streakPillText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#A4A4B4',
    letterSpacing: 0.6,
  },
  streakPillTextActive: {
    color: GlyphColors.neonCyan,
  },
  livesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  precisionArcadeBtn: {
    height: 74,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
    gap: 4,
  },
  precisionArcadeBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  precisionArcadeBtnGameOver: {
    backgroundColor: 'rgba(215, 25, 32, 0.18)',
    borderColor: GlyphColors.nothingRed,
  },
  precisionBtnMainText: {
    fontFamily: 'NDOT57',
    fontSize: 12.5,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  precisionBtnMainTextActive: {
    color: '#FFFFFF',
  },
  precisionBtnSubText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#A8A8B8',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});

export default React.memo(UtilitiesScreen);
