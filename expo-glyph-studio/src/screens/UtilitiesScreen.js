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
 * Softlight torch with brightness, Strobe with Hz regulation,
 * Visual Countdown Timer, Battery HUD, and Arcade Mini-Games.
 */
export default function UtilitiesScreen({ brightness, onBrightnessChange }) {
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

  // Roulette State
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerArc, setWinnerArc] = useState(null);

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

  const stopAll = () => {
    setActiveMode(null);
    setIsTimerRunning(false);
    setIsSpinning(false);
    if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    if (reflexTimerRef.current) clearTimeout(reflexTimerRef.current);
    if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
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

  // 3. Timer Handlers
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
    // 0..33% -> TL, 34..66% -> TL+BL, 67..100% -> ALL
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

  // 5. Roulette Spin
  const handleStartRoulette = () => {
    if (isSpinning) return;
    stopAll();
    setActiveMode('roulette');
    setIsSpinning(true);
    setWinnerArc(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const arcOrder = [0, 2, 1]; // Top-Left -> Right -> Bottom-Left
    let step = 0;
    const totalSteps = 26 + Math.floor(Math.random() * 12);
    let delayMs = 35;

    const doStep = () => {
      const currentArc = arcOrder[step % 3];
      const nextBrightness = [0, 0, 0];
      nextBrightness[currentArc] = 255;
      if (onBrightnessChange) onBrightnessChange(nextBrightness);

      step++;
      if (step < totalSteps) {
        const progress = step / totalSteps;
        if (progress > 0.45) {
          delayMs = 35 + Math.floor(progress * progress * 350);
        }
        spinTimerRef.current = setTimeout(doStep, delayMs);
      } else {
        const finalArc = arcOrder[(step - 1) % 3];
        setWinnerArc(finalArc);
        setIsSpinning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        let fl = 0;
        const vi = setInterval(() => {
          fl++;
          const fb = fl % 2 === 1 ? 255 : 0;
          const flashArray = [0, 0, 0];
          flashArray[finalArc] = fb;
          if (onBrightnessChange) onBrightnessChange(flashArray);
          if (fl >= 6) {
            clearInterval(vi);
            const finalState = [0, 0, 0];
            finalState[finalArc] = 255;
            if (onBrightnessChange) onBrightnessChange(finalState);
          }
        }, 130);
      }
    };

    doStep();
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
    };
  }, []);

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
          <View>
            <Text style={styles.cardTitle}>ФОНАРИК (SOFTLIGHT)</Text>
            <Text style={styles.cardSubtitle}>
              Равномерное рассеянное свечение для фото и видео
            </Text>
          </View>
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
          <View>
            <Text style={styles.cardTitle}>СТРОБОСКОП</Text>
            <Text style={styles.cardSubtitle}>
              Импульсный стробоскоп с регулируемой частотой
            </Text>
          </View>
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
          <View>
            <Text style={styles.cardTitle}>
              {isTimerRunning ? `ТАЙМЕР: ${timerRemaining} С` : 'ТАЙМЕР'}
            </Text>
            <Text style={styles.cardSubtitle}>
              Плавное угасание глифа по истечении времени
            </Text>
          </View>
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
          <View>
            <Text style={styles.cardTitle}>ИНДИКАТОР ЗАРЯДА</Text>
            <Text style={styles.cardSubtitle}>
              Отображение уровня батареи секторами глифа
            </Text>
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
        <Text style={styles.arcadeSectionMeta}>Интерактивные мини-игры</Text>
      </View>

      {/* GAME 1: ROULETTE */}
      <LiquidGlassCard isActive={activeMode === 'roulette'}>
        <View style={styles.rouletteBox}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>СВЕТОВАЯ БУТЫЛОЧКА</Text>
              <Text style={styles.cardSubtitle}>Вращение луча света по 3 дугам</Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, isSpinning && styles.btnActive]}
              onPress={handleStartRoulette}
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
              {winnerArc !== null
                ? `ВЫБРАН СЕКТОР: ${
                    winnerArc === 0
                      ? 'ВЕРХ-ЛЕВО'
                      : winnerArc === 1
                      ? 'НИЗ-ЛЕВО'
                      : 'ПРАВЫЙ'
                  }`
                : 'НАЖМИТЕ «КРУТИТЬ» ДЛЯ ЗАПУСКА'}
            </Text>
          </View>
        </View>
      </LiquidGlassCard>

      {/* GAME 2: REFLEX TEST */}
      <LiquidGlassCard isActive={activeMode === 'reflex'}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>ТЕСТ СКОРОСТИ РЕАКЦИИ</Text>
            <Text style={styles.cardSubtitle}>
              Нажмите при внезапной белой вспышке
            </Text>
          </View>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  cardSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#8E8E98',
    marginTop: 2,
  },
  btn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  btnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  btnText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  btnTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  smallPresetBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
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
    fontSize: 9,
    color: '#8E8E98',
    letterSpacing: 0.5,
  },
  smallPresetTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  arcadeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  arcadeSectionTitle: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#D0D0DC',
    letterSpacing: 1.5,
  },
  arcadeSectionMeta: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#707080',
  },
  rouletteBox: {
    gap: 10,
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
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
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
    height: 120,
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
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  reflexMainTextFlash: {
    color: '#000000',
    fontWeight: 'bold',
  },
  reflexSubText: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#8E8E98',
    letterSpacing: 1,
    marginTop: 6,
  },
});
