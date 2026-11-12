import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import LiquidGlassCard from '../components/LiquidGlassCard';
import GlyphSlider from '../components/GlyphSlider';
import { GlyphColors } from '../theme/colors';

/**
 * Screen 5: «УТИЛИТЫ»
 * Minimalist tools: Strobe beacon, Visual Countdown Timer,
 * Battery HUD, Single-Pixel Spin the Bottle, and Reflex Reaction Test.
 */
export default function UtilitiesScreen({
  brightness,
  onBrightnessChange,
  onActivePixelChange,
  onPixelLevelsChange,
}) {
  const [activeMode, setActiveMode] = useState(null); // 'strobe' | 'timer' | 'battery' | 'breath' | 'morse' | 'roulette' | 'reflex' | 'precision'

  // Strobe State
  const [strobeHz, setStrobeHz] = useState(10);

  // Timer State
  const [timerDuration, setTimerDuration] = useState(30);
  const [timerRemaining, setTimerRemaining] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Battery State
  const [batteryLevel, setBatteryLevel] = useState(82);

  // Breathing Zen 4-7-8 State
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathPhase, setBreathPhase] = useState('INHALE'); // 'INHALE' | 'HOLD' | 'EXHALE'
  const [breathSeconds, setBreathSeconds] = useState(4);
  const [breathCycle, setBreathCycle] = useState(0);

  // Morse Code Beacon State
  const [isMorseRunning, setIsMorseRunning] = useState(false);
  const [morsePreset, setMorsePreset] = useState('SOS');
  const [currentMorseIndex, setCurrentMorseIndex] = useState(-1);

  // Precision Timing Arcade Game State
  const [isPrecisionRunning, setIsPrecisionRunning] = useState(false);
  const [precisionScore, setPrecisionScore] = useState(0);
  const [precisionStreak, setPrecisionStreak] = useState(1);
  const [precisionLives, setPrecisionLives] = useState(3);
  const [precisionBestScore, setPrecisionBestScore] = useState(0);
  const [precisionGameOver, setPrecisionGameOver] = useState(false);
  const [precisionTarget, setPrecisionTarget] = useState(12);
  const [precisionRunner, setPrecisionRunner] = useState(0);

  // Bottle Spin (Roulette) State: Single Moving Pixel
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerPixel, setWinnerPixel] = useState(null);

  // Reflex State
  const [reflexState, setReflexState] = useState('IDLE'); // 'IDLE' | 'WAITING' | 'FLASH' | 'RESULT' | 'EARLY'
  const [reactionTime, setReactionTime] = useState(0);
  const [bestTime, setBestTime] = useState(0);

  // Refs for timers & animation loops
  const strobeTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const spinTimerRef = useRef(null);
  const reflexTimerRef = useRef(null);
  const reflexStartTimeRef = useRef(0);
  const spinStepRef = useRef(0);
  const breathTimerRef = useRef(null);
  const breathStartTimeRef = useRef(0);
  const morseTimerRef = useRef(null);
  const precisionTimerRef = useRef(null);
  const precisionRunnerRef = useRef(0);
  const precisionTargetRef = useRef(12);
  const precisionSpeedRef = useRef(85);
  const precisionStreakRef = useRef(1);
  const precisionScoreRef = useRef(0);
  const precisionLivesRef = useRef(3);

  const stopAll = () => {
    setActiveMode(null);
    setIsTimerRunning(false);
    setIsSpinning(false);
    setIsBreathing(false);
    setIsMorseRunning(false);
    setIsPrecisionRunning(false);
    if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    if (reflexTimerRef.current) clearTimeout(reflexTimerRef.current);
    if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    if (morseTimerRef.current) clearTimeout(morseTimerRef.current);
    if (precisionTimerRef.current) clearTimeout(precisionTimerRef.current);
    if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
    if (onActivePixelChange) onActivePixelChange(null);
    if (onPixelLevelsChange) onPixelLevelsChange(null);
  };

  // 1. Strobe Handlers
  const handleToggleStrobe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeMode === 'strobe') {
      stopAll();
    } else {
      stopAll();
      setActiveMode('strobe');
      startStrobeLoop(strobeHz);
    }
  };

  const startStrobeLoop = (hz) => {
    if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
    let state = false;
    const intervalMs = Math.max(20, Math.round(1000 / (hz * 2)));
    strobeTimerRef.current = setInterval(() => {
      state = !state;
      const b = state ? 255 : 0;
      if (onBrightnessChange) onBrightnessChange([b, b, b]);
    }, intervalMs);
  };

  const handleStrobeHzChange = (newHz) => {
    setStrobeHz(newHz);
    if (activeMode === 'strobe') {
      startStrobeLoop(newHz);
    }
  };

  // 3. Visual Timer Handlers
  const handleStartTimer = (secs) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    stopAll();
    setActiveMode('timer');
    setIsTimerRunning(true);
    setTimerDuration(secs);
    setTimerRemaining(secs);

    let remaining = secs;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setTimerRemaining(remaining);
      const frac = remaining / secs;
      const b = Math.round(frac * 255);
      if (onBrightnessChange) onBrightnessChange([b, b, b]);

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        setIsTimerRunning(false);
        // Triple victory strobe
        let flash = 0;
        const flasher = setInterval(() => {
          flash++;
          const fb = flash % 2 === 1 ? 255 : 0;
          if (onBrightnessChange) onBrightnessChange([fb, fb, fb]);
          if (flash >= 6) {
            clearInterval(flasher);
            stopAll();
          }
        }, 140);
      }
    }, 1000);
  };

  // 4. Battery HUD Handler
  const handleToggleBattery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeMode === 'battery') {
      stopAll();
    } else {
      stopAll();
      setActiveMode('battery');
      applyBatteryGlyphs(batteryLevel);
    }
  };

  const applyBatteryGlyphs = (level) => {
    // Fill / unfill micro-LEDs by sequential count (36 LEDs total) rather than dimming
    const count = Math.round((level / 100) * 36);
    if (count <= 0) {
      if (onActivePixelChange) onActivePixelChange([]);
      if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      return;
    }
    const activePixels = [];
    for (let i = 0; i < count; i++) {
      activePixels.push(i);
    }
    if (onActivePixelChange) {
      onActivePixelChange(activePixels);
    }
    if (onBrightnessChange) {
      onBrightnessChange([0, 0, 0]);
    }
  };

  const handleBatteryLevelChange = (newLevel) => {
    setBatteryLevel(newLevel);
    if (activeMode === 'battery') {
      applyBatteryGlyphs(newLevel);
    }
  };

  // 5. Spin the Bottle (Световая бутылочка): Single Moving Pixel with Randomized Timing
  const handleStartBottleSpin = () => {
    if (isSpinning) return;
    stopAll();
    setActiveMode('roulette');
    setIsSpinning(true);
    setWinnerPixel(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    // Randomize time and total step parameters on EVERY new spin
    // Total steps = random revolutions (3..5 full circles) + random landing offset (0..35)
    const fullRevolutions = 3 + Math.floor(Math.random() * 3);
    const landingPixel = Math.floor(Math.random() * 36);
    const startPixel = Math.floor(Math.random() * 36);
    const totalSteps = fullRevolutions * 36 + ((landingPixel - startPixel + 36) % 36);

    let currentPixel = startPixel;
    let step = 0;
    spinStepRef.current = 0;

    const runStep = () => {
      // Step to next pixel circularly around 36 micro-LEDs
      currentPixel = (currentPixel + 1) % 36;
      if (onActivePixelChange) {
        onActivePixelChange(currentPixel);
      }

      step++;
      spinStepRef.current = step;

      if (step < totalSteps) {
        const progress = step / totalSteps;
        // Non-linear natural deceleration curve (starts at 120Hz 8ms, smoothly decelerates up to ~220ms)
        let delayMs = 8;
        if (progress > 0.45) {
          const decelFactor = (progress - 0.45) / 0.55;
          delayMs = 8 + Math.floor(Math.pow(decelFactor, 2.4) * 218);
        }

        spinTimerRef.current = setTimeout(runStep, delayMs);
      } else {
        // Stopped smoothly on the final randomly chosen pixel!
        const finalPixel = currentPixel;
        setWinnerPixel(finalPixel);
        setIsSpinning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        // Victory confirmation pulse on the winning pixel
        let flash = 0;
        const victoryTimer = setInterval(() => {
          flash++;
          if (flash % 2 === 1) {
            onActivePixelChange && onActivePixelChange(null);
          } else {
            onActivePixelChange && onActivePixelChange(finalPixel);
          }
          if (flash >= 6) {
            clearInterval(victoryTimer);
            onActivePixelChange && onActivePixelChange(finalPixel);
          }
        }, 120);
      }
    };

    runStep();
  };

  // 6. Reflex Test
  const handleReflexTap = () => {
    if (reflexState === 'IDLE' || reflexState === 'RESULT' || reflexState === 'EARLY') {
      stopAll();
      setActiveMode('reflex');
      setReflexState('WAITING');
      if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      Haptics.selectionAsync().catch(() => {});

      const randDelay = 1400 + Math.random() * 2400;
      reflexTimerRef.current = setTimeout(() => {
        setReflexState('FLASH');
        reflexStartTimeRef.current = Date.now();
        if (onBrightnessChange) onBrightnessChange([255, 255, 255]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, randDelay);
    } else if (reflexState === 'WAITING') {
      clearTimeout(reflexTimerRef.current);
      setReflexState('EARLY');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (reflexState === 'FLASH') {
      const elapsed = Date.now() - reflexStartTimeRef.current;
      setReactionTime(elapsed);
      if (bestTime === 0 || elapsed < bestTime) {
        setBestTime(elapsed);
      }
      setReflexState('RESULT');
      if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  // 7. Breathing Zen 4-7-8 Handlers
  const handleToggleBreath = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeMode === 'breath') {
      stopAll();
    } else {
      stopAll();
      setActiveMode('breath');
      setIsBreathing(true);
      startBreathingCycle();
    }
  };

  const startBreathingCycle = () => {
    if (breathTimerRef.current) clearInterval(breathTimerRef.current);
    breathStartTimeRef.current = Date.now();
    let lastPhase = '';

    breathTimerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedTotal = (now - breathStartTimeRef.current) / 1000;
      const cycleTime = elapsedTotal % 19; // 4s inhale + 7s hold + 8s exhale = 19s
      const currentCycle = Math.floor(elapsedTotal / 19) + 1;
      setBreathCycle(currentCycle);

      let currentB = 0;
      let phaseName = 'INHALE';
      let secsLeft = 0;

      if (cycleTime < 4) {
        // INHALE: 0..4s (smooth organic sine swell 20 -> 255)
        phaseName = 'INHALE';
        secsLeft = Math.ceil(4 - cycleTime);
        const p = cycleTime / 4;
        currentB = Math.round(20 + 235 * (1 - Math.cos(p * Math.PI)) / 2);
      } else if (cycleTime < 11) {
        // HOLD: 4..11s (steady 255 with subtle calm oscillation)
        phaseName = 'HOLD';
        secsLeft = Math.ceil(11 - cycleTime);
        const holdP = (cycleTime - 4) / 7;
        currentB = Math.round(250 + 5 * Math.sin(holdP * Math.PI * 4));
      } else {
        // EXHALE: 11..19s (smooth organic sine descent 255 -> 20)
        phaseName = 'EXHALE';
        secsLeft = Math.ceil(19 - cycleTime);
        const p = (cycleTime - 11) / 8;
        currentB = Math.round(20 + 235 * (1 + Math.cos(p * Math.PI)) / 2);
      }

      setBreathPhase(phaseName);
      setBreathSeconds(secsLeft);

      if (phaseName !== lastPhase) {
        lastPhase = phaseName;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      if (onBrightnessChange) {
        onBrightnessChange([currentB, currentB, currentB]);
      }
    }, 8); // 120Hz high-refresh organic breathing curve
  };

  // 8. Morse Code Tactical Beacon Handlers
  const MORSE_PATTERNS = {
    'SOS': [
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 450 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 450 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 1200 },
    ],
    'HELP': [
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 450 },
      { on: true, dur: 160 }, { on: false, dur: 450 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 450 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 1200 },
    ],
    'NOTHING': [
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 450 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 1200 },
    ],
    'OK': [
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 450 },
      { on: true, dur: 450 }, { on: false, dur: 160 },
      { on: true, dur: 160 }, { on: false, dur: 160 },
      { on: true, dur: 450 }, { on: false, dur: 1200 },
    ],
  };

  const handleToggleMorse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeMode === 'morse') {
      stopAll();
    } else {
      stopAll();
      setActiveMode('morse');
      setIsMorseRunning(true);
      startMorsePlayback(morsePreset);
    }
  };

  const handleSelectMorsePreset = (key) => {
    setMorsePreset(key);
    Haptics.selectionAsync().catch(() => {});
    if (activeMode === 'morse') {
      if (morseTimerRef.current) clearTimeout(morseTimerRef.current);
      startMorsePlayback(key);
    }
  };

  const startMorsePlayback = (presetKey) => {
    if (morseTimerRef.current) clearTimeout(morseTimerRef.current);
    const pattern = MORSE_PATTERNS[presetKey] || MORSE_PATTERNS['SOS'];
    let stepIdx = 0;

    const playStep = () => {
      if (stepIdx >= pattern.length) {
        stepIdx = 0;
      }
      const item = pattern[stepIdx];
      setCurrentMorseIndex(stepIdx);

      if (item.on) {
        if (onBrightnessChange) onBrightnessChange([255, 255, 255]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } else {
        if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      }

      stepIdx++;
      morseTimerRef.current = setTimeout(playStep, item.dur);
    };

    playStep();
  };

  // 9. Precision Timing Arcade Game («МЕТКИЙ ГЛИФ»)
  const handleTogglePrecision = () => {
    if (activeMode === 'precision' && isPrecisionRunning) {
      stopAll();
    } else {
      startPrecisionGame();
    }
  };

  const startPrecisionGame = () => {
    stopAll();
    setActiveMode('precision');
    setIsPrecisionRunning(true);
    setPrecisionScore(0);
    setPrecisionStreak(1);
    setPrecisionLives(3);
    setPrecisionGameOver(false);

    precisionScoreRef.current = 0;
    precisionStreakRef.current = 1;
    precisionLivesRef.current = 3;
    precisionSpeedRef.current = 80;

    const newTarget = Math.floor(Math.random() * 36);
    setPrecisionTarget(newTarget);
    precisionTargetRef.current = newTarget;

    precisionRunnerRef.current = (newTarget + 18) % 36;
    setPrecisionRunner(precisionRunnerRef.current);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    runPrecisionLoop();
  };

  const runPrecisionLoop = () => {
    precisionRunnerRef.current = (precisionRunnerRef.current + 1) % 36;
    setPrecisionRunner(precisionRunnerRef.current);

    const target = precisionTargetRef.current;
    const runner = precisionRunnerRef.current;

    // Show both target and runner on the camera silhouette
    if (onActivePixelChange) {
      onActivePixelChange([target, runner]);
    }

    precisionTimerRef.current = setTimeout(runPrecisionLoop, precisionSpeedRef.current);
  };

  const handlePrecisionCatch = () => {
    if (!isPrecisionRunning) {
      startPrecisionGame();
      return;
    }

    const runner = precisionRunnerRef.current;
    const target = precisionTargetRef.current;
    const diff = Math.min(Math.abs(runner - target), 36 - Math.abs(runner - target));

    if (diff === 0) {
      // Direct Bullseye Hit!
      const bonus = 100 * precisionStreakRef.current;
      precisionScoreRef.current += bonus;
      setPrecisionScore(precisionScoreRef.current);

      precisionStreakRef.current = Math.min(5, precisionStreakRef.current + 1);
      setPrecisionStreak(precisionStreakRef.current);

      // Speed increases (delay reduces from 80ms down to 24ms)
      precisionSpeedRef.current = Math.max(24, precisionSpeedRef.current - 4);

      if (precisionScoreRef.current > precisionBestScore) {
        setPrecisionBestScore(precisionScoreRef.current);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      // Victory burst on arcs
      if (onBrightnessChange) {
        onBrightnessChange([255, 255, 255]);
        setTimeout(() => onBrightnessChange && onBrightnessChange([0, 0, 0]), 90);
      }

      // Pick next target separated by at least 6 LEDs
      let nextTarget = Math.floor(Math.random() * 36);
      while (Math.min(Math.abs(nextTarget - runner), 36 - Math.abs(nextTarget - runner)) < 6) {
        nextTarget = Math.floor(Math.random() * 36);
      }
      precisionTargetRef.current = nextTarget;
      setPrecisionTarget(nextTarget);
    } else if (diff <= 1) {
      // Near Hit!
      const bonus = 40;
      precisionScoreRef.current += bonus;
      setPrecisionScore(precisionScoreRef.current);

      if (precisionScoreRef.current > precisionBestScore) {
        setPrecisionBestScore(precisionScoreRef.current);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      let nextTarget = Math.floor(Math.random() * 36);
      while (Math.min(Math.abs(nextTarget - runner), 36 - Math.abs(nextTarget - runner)) < 6) {
        nextTarget = Math.floor(Math.random() * 36);
      }
      precisionTargetRef.current = nextTarget;
      setPrecisionTarget(nextTarget);
    } else {
      // Missed!
      precisionLivesRef.current -= 1;
      setPrecisionLives(precisionLivesRef.current);
      precisionStreakRef.current = 1;
      setPrecisionStreak(1);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

      if (precisionLivesRef.current <= 0) {
        // Game Over!
        if (precisionTimerRef.current) clearTimeout(precisionTimerRef.current);
        setIsPrecisionRunning(false);
        setPrecisionGameOver(true);
        if (onActivePixelChange) onActivePixelChange(null);
        if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      if (reflexTimerRef.current) clearTimeout(reflexTimerRef.current);
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
      if (morseTimerRef.current) clearTimeout(morseTimerRef.current);
      if (precisionTimerRef.current) clearTimeout(precisionTimerRef.current);
      if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      if (onActivePixelChange) onActivePixelChange(null);
      if (onPixelLevelsChange) onPixelLevelsChange(null);
    };
  }, []);

  const getWinnerPixelZone = (p) => {
    if (p === null) return '';
    if (p >= 0 && p <= 19) return 'ВЕРХ-ЛЕВО';
    if (p >= 20 && p <= 30) return 'ПРАВЫЙ';
    return 'НИЗ-ЛЕВО';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================ */}
      {/* 1. STROBE BEACON                                             */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={activeMode === 'strobe'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>СТРОБОСКОП</Text>
          <TouchableOpacity
            style={[styles.btn, activeMode === 'strobe' && styles.btnActive]}
            onPress={handleToggleStrobe}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, activeMode === 'strobe' && styles.btnTextActive]}>
              {activeMode === 'strobe' ? 'СТОП' : 'СТАРТ'}
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          label="ЧАСТОТА МИГАНИЯ"
          value={strobeHz}
          min={1}
          max={25}
          step={1}
          unit=" ГЦ"
          displayValue={`${strobeHz} Гц`}
          accentColor={GlyphColors.neonRed}
          onValueChange={handleStrobeHzChange}
        />

        <View style={styles.presetsRow}>
          {[5, 10, 15, 20].map((hz) => (
            <TouchableOpacity
              key={hz}
              style={[styles.smallPresetBtn, strobeHz === hz && styles.smallPresetBtnActive]}
              onPress={() => handleStrobeHzChange(hz)}
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
      {/* 3. VISUAL TIMER                                              */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={activeMode === 'timer'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {isTimerRunning ? `ТАЙМЕР: ${timerRemaining} С` : 'ТАЙМЕР'}
          </Text>
          <TouchableOpacity
            style={[styles.btn, isTimerRunning && styles.btnActive]}
            onPress={() => (isTimerRunning ? stopAll() : handleStartTimer(timerDuration))}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, isTimerRunning && styles.btnTextActive]}>
              {isTimerRunning ? 'СТОП' : 'ПУСК'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.presetsRow}>
          {[10, 30, 60, 120].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.smallPresetBtn,
                timerDuration === s && !isTimerRunning && styles.smallPresetBtnActive,
              ]}
              onPress={() => {
                setTimerDuration(s);
                handleStartTimer(s);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.smallPresetText,
                  timerDuration === s && !isTimerRunning && styles.smallPresetTextActive,
                ]}
              >
                {s} С
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 4. BATTERY HUD                                               */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={activeMode === 'battery'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>ИНДИКАТОР ЗАРЯДА</Text>
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

        <GlyphSlider
          label="УРОВЕНЬ БАТАРЕИ"
          value={batteryLevel}
          min={0}
          max={100}
          step={1}
          unit="%"
          displayValue={`${batteryLevel}% (${Math.round((batteryLevel / 100) * 36)} / 36 LED)`}
          accentColor="#00E5FF"
          onValueChange={handleBatteryLevelChange}
        />
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 5. ZEN BREATHING 4-7-8                                       */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={activeMode === 'breath'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {isBreathing
              ? `ДЫХАНИЕ: ${breathPhase === 'INHALE' ? 'ВДОХ' : breathPhase === 'HOLD' ? 'ЗАДЕРЖКА' : 'ВЫДОХ'} (${breathSeconds} С)`
              : 'ДЫХАНИЕ ZEN (4-7-8)'}
          </Text>
          <TouchableOpacity
            style={[styles.btn, isBreathing && styles.btnActive]}
            onPress={handleToggleBreath}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, isBreathing && styles.btnTextActive]}>
              {isBreathing ? 'СТОП' : 'СТАРТ'}
            </Text>
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
      {/* 6. TACTICAL MORSE BEACON                                     */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={activeMode === 'morse'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>МАЯК МОРЗЕ (ITU-R)</Text>
          <TouchableOpacity
            style={[styles.btn, isMorseRunning && styles.btnActive]}
            onPress={handleToggleMorse}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, isMorseRunning && styles.btnTextActive]}>
              {isMorseRunning ? 'СТОП' : 'МАЯК'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.presetsRow}>
          {['SOS', 'HELP', 'NOTHING', 'OK'].map((key) => (
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
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 7. ARCADE MINI-GAMES                                         */}
      {/* ============================================================ */}
      <View style={styles.arcadeHeaderRow}>
        <Text style={styles.arcadeSectionTitle}>АРКАДНЫЕ ИГРЫ GLYPH</Text>
      </View>

      {/* GAME 1: PRECISION TIMING ARCADE («МЕТКИЙ ГЛИФ») */}
      <LiquidGlassCard isActive={activeMode === 'precision'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>МЕТКИЙ ГЛИФ (АРКАДА)</Text>
          <View style={styles.arcadeStatsRow}>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillText}>СЧЁТ: {precisionScore}</Text>
            </View>
            <View style={[styles.streakPill, precisionStreak > 1 && styles.streakPillActive]}>
              <Text style={[styles.streakPillText, precisionStreak > 1 && styles.streakPillTextActive]}>
                x{precisionStreak}
              </Text>
            </View>
            <Text style={styles.livesText}>
              {'❤'.repeat(Math.max(0, precisionLives))}
            </Text>
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
          <Text
            style={[
              styles.precisionBtnMainText,
              isPrecisionRunning && styles.precisionBtnMainTextActive,
            ]}
          >
            {!isPrecisionRunning && !precisionGameOver && '▶ НАЧАТЬ ИГРУ'}
            {isPrecisionRunning && '🎯 ПОЙМАТЬ МИШЕНЬ!'}
            {precisionGameOver && `ИГРА ОКОНЧЕНА (${precisionScore} ОЧКОВ) • ЗАНОВО`}
          </Text>
          {isPrecisionRunning && (
            <Text style={styles.precisionBtnSubText}>
              МИШЕНЬ: LED #{precisionTarget} • ЛУЧ: LED #{precisionRunner}
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
            <Text style={styles.cardTitle}>СВЕТОВАЯ БУТЫЛОЧКА</Text>
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

          <View style={styles.resultBadge}>
            <Text style={styles.resultBadgeText}>
              {isSpinning
                ? 'ВРАЩЕНИЕ...'
                : winnerPixel !== null
                ? `ВЫБРАН LED #${winnerPixel} (${getWinnerPixelZone(winnerPixel)})`
                : 'НАЖМИТЕ «КРУТИТЬ» ДЛЯ ЗАПУСКА'}
            </Text>
          </View>
        </View>
      </LiquidGlassCard>

      {/* GAME 2: REFLEX TEST */}
      <LiquidGlassCard isActive={activeMode === 'reflex'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>ТЕСТ СКОРОСТИ РЕАКЦИИ</Text>
          {bestTime > 0 && (
            <View style={styles.bestTimeBadge}>
              <Text style={styles.bestTimeText}>РЕКОРД: {bestTime} МС</Text>
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

          {reflexState === 'RESULT' && (
            <Text style={styles.reflexSubText}>
              {reactionTime < 220
                ? '⚡ НЕВЕРОЯТНАЯ РЕАКЦИЯ!'
                : reactionTime < 320
                ? '👍 ОТЛИЧНЫЙ РЕЗУЛЬТАТ'
                : '👌 ХОРОШАЯ ПОПЫТКА'}
            </Text>
          )}
        </TouchableOpacity>
      </LiquidGlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 115,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  btn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.38)',
    borderRadius: 10,
    paddingHorizontal: 12,
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
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  btnTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 4,
  },
  smallPresetBtn: {
    flex: 1,
    paddingVertical: 5.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
  },
  smallPresetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.60)',
    borderTopColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.20,
    shadowRadius: 5,
  },
  smallPresetText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#8E8E98',
    letterSpacing: 0.4,
  },
  smallPresetTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  arcadeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  arcadeSectionTitle: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#D0D0DC',
    letterSpacing: 1.2,
  },
  rouletteBox: {
    gap: 8,
  },
  resultBadge: {
    paddingHorizontal: 14,
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
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  bestTimeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bestTimeText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: GlyphColors.neonCyan,
    letterSpacing: 1,
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
    letterSpacing: 1.8,
  },
  reflexMainTextFlash: {
    color: '#000000',
    fontWeight: 'bold',
  },
  reflexSubText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E98',
    letterSpacing: 1,
    marginTop: 6,
  },
  // Breath & Morse Styles
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
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
    color: '#8E8E98',
    letterSpacing: 0.6,
  },
  breathPhaseTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  breathCycleCount: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: GlyphColors.neonCyan,
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  // Precision Timing Arcade Styles
  arcadeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scorePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scorePillText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  streakPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  streakPillActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.20)',
    borderColor: '#FFD700',
  },
  streakPillText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#8E8E98',
    letterSpacing: 0.6,
  },
  streakPillTextActive: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  livesText: {
    fontSize: 10,
    color: GlyphColors.nothingRed,
    letterSpacing: 1,
  },
  precisionArcadeBtn: {
    height: 72,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 1.4,
  },
  precisionBtnMainTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  precisionBtnSubText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#8E8E98',
    letterSpacing: 0.8,
  },
});
