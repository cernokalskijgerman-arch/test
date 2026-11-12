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
 * Minimalist tools: Softlight flashlight, Strobe beacon, Visual Countdown Timer,
 * Battery HUD, Single-Pixel Spin the Bottle, and Reflex Reaction Test.
 */
export default function UtilitiesScreen({
  brightness,
  onBrightnessChange,
  onActivePixelChange,
}) {
  const [activeMode, setActiveMode] = useState(null); // 'softlight' | 'strobe' | 'timer' | 'battery' | 'roulette' | 'reflex'

  // Softlight State
  const [softlightLevel, setSoftlightLevel] = useState(255);

  // Strobe State
  const [strobeHz, setStrobeHz] = useState(10);

  // Timer State
  const [timerDuration, setTimerDuration] = useState(30);
  const [timerRemaining, setTimerRemaining] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Battery State
  const [batteryLevel, setBatteryLevel] = useState(82);

  // Bottle Spin (Roulette) State: Single Moving Pixel
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerPixel, setWinnerPixel] = useState(null);

  // Reflex State
  const [reflexState, setReflexState] = useState('IDLE'); // 'IDLE' | 'WAITING' | 'FLASH' | 'RESULT' | 'EARLY'
  const [reactionTime, setReactionTime] = useState(0);
  const [bestTime, setBestTime] = useState(0);

  // Refs for timers
  const strobeTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const spinTimerRef = useRef(null);
  const reflexTimerRef = useRef(null);
  const reflexStartTimeRef = useRef(0);
  const spinStepRef = useRef(0);

  const stopAll = () => {
    setActiveMode(null);
    setIsTimerRunning(false);
    setIsSpinning(false);
    if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    if (reflexTimerRef.current) clearTimeout(reflexTimerRef.current);
    if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
    if (onActivePixelChange) onActivePixelChange(null);
  };

  // 1. Softlight Handlers
  const handleToggleSoftlight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (activeMode === 'softlight') {
      stopAll();
    } else {
      stopAll();
      setActiveMode('softlight');
      if (onBrightnessChange) onBrightnessChange([softlightLevel, softlightLevel, softlightLevel]);
    }
  };

  const handleSoftlightLevelChange = (val) => {
    setSoftlightLevel(val);
    if (activeMode === 'softlight' && onBrightnessChange) {
      onBrightnessChange([val, val, val]);
    }
  };

  // 2. Strobe Handlers
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
    const tl = level > 5 ? Math.round(Math.min(1, level / 33) * 255) : 0;
    const bl = level > 33 ? Math.round(Math.min(1, (level - 33) / 33) * 255) : 0;
    const r = level > 66 ? Math.round(Math.min(1, (level - 66) / 34) * 255) : 0;
    if (onBrightnessChange) onBrightnessChange([tl, bl, r]);
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
        // Non-linear natural deceleration curve (starts at fast 16ms, smoothly decelerates up to ~220ms)
        let delayMs = 16;
        if (progress > 0.45) {
          const decelFactor = (progress - 0.45) / 0.55;
          delayMs = 16 + Math.floor(Math.pow(decelFactor, 2.4) * 210);
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

  useEffect(() => {
    return () => {
      if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      if (reflexTimerRef.current) clearTimeout(reflexTimerRef.current);
      if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      if (onActivePixelChange) onActivePixelChange(null);
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
      {/* 1. SOFTLIGHT FLASHLIGHT                                      */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={activeMode === 'softlight'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>ФОНАРИК (SOFTLIGHT)</Text>
          <TouchableOpacity
            style={[styles.btn, activeMode === 'softlight' && styles.btnActive]}
            onPress={handleToggleSoftlight}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, activeMode === 'softlight' && styles.btnTextActive]}>
              {activeMode === 'softlight' ? 'ВЫКЛ' : 'ВКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          label="ЯРКОСТЬ ФОНАРИКА"
          value={softlightLevel}
          min={10}
          max={255}
          step={1}
          displayValue={`${Math.round((softlightLevel / 255) * 100)}%`}
          accentColor="#FFFFFF"
          onValueChange={handleSoftlightLevelChange}
        />
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 2. STROBE BEACON                                             */}
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
          displayValue={`${batteryLevel}%`}
          accentColor="#00E5FF"
          onValueChange={handleBatteryLevelChange}
        />
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 5. ARCADE MINI-GAMES                                         */}
      {/* ============================================================ */}
      <View style={styles.arcadeHeaderRow}>
        <Text style={styles.arcadeSectionTitle}>АРКАДНЫЕ ИГРЫ GLYPH</Text>
      </View>

      {/* GAME 1: SPIN THE BOTTLE (СВЕТОВАЯ БУТЫЛОЧКА) */}
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
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  btnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
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
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  smallPresetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
});
