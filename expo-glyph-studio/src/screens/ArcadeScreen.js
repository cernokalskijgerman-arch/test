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
import { GlyphColors } from '../theme/colors';

export default function ArcadeScreen({ brightness, onBrightnessChange }) {
  const [activeGame, setActiveGame] = useState('roulette'); // 'roulette' | 'reflex'

  // Roulette State
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerArc, setWinnerArc] = useState(null);

  // Reflex State
  const [reflexState, setReflexState] = useState('IDLE'); // 'IDLE' | 'WAITING' | 'FLASH' | 'RESULT' | 'EARLY'
  const [reactionTime, setReactionTime] = useState(0);
  const [bestTime, setBestTime] = useState(0);

  const spinTimerRef = useRef(null);
  const reflexTimerRef = useRef(null);
  const startTimeRef = useRef(0);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      if (reflexTimerRef.current) clearTimeout(reflexTimerRef.current);
    };
  }, []);

  // Roulette Spin (Light circles around the 3 arcs: TL -> R -> BL -> TL)
  const startRouletteSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWinnerArc(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const arcOrder = [0, 2, 1]; // Top-Left -> Right -> Bottom-Left -> Top-Left
    let step = 0;
    const totalSteps = 24 + Math.floor(Math.random() * 15);
    let delayMs = 40;

    const doStep = () => {
      const currentArc = arcOrder[step % 3];
      const nextBrightness = [0, 0, 0];
      nextBrightness[currentArc] = 255;
      if (onBrightnessChange) onBrightnessChange(nextBrightness);

      step++;
      if (step < totalSteps) {
        const progress = step / totalSteps;
        if (progress > 0.4) {
          delayMs = 40 + Math.floor(progress * progress * 380);
        }
        spinTimerRef.current = setTimeout(doStep, delayMs);
      } else {
        // Landed!
        const finalArc = arcOrder[(step - 1) % 3];
        setWinnerArc(finalArc);
        setIsSpinning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        // Victory flash
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
        }, 140);
      }
    };

    doStep();
  };

  // Reflex Tap Handler
  const handleReflexTap = () => {
    if (reflexState === 'IDLE' || reflexState === 'RESULT' || reflexState === 'EARLY') {
      setReflexState('WAITING');
      if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      Haptics.selectionAsync().catch(() => {});

      const randDelay = 1500 + Math.random() * 2500;
      reflexTimerRef.current = setTimeout(() => {
        setReflexState('FLASH');
        startTimeRef.current = Date.now();
        if (onBrightnessChange) onBrightnessChange([255, 255, 255]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      }, randDelay);
    } else if (reflexState === 'WAITING') {
      clearTimeout(reflexTimerRef.current);
      setReflexState('EARLY');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else if (reflexState === 'FLASH') {
      const elapsed = Date.now() - startTimeRef.current;
      setReactionTime(elapsed);
      if (bestTime === 0 || elapsed < bestTime) {
        setBestTime(elapsed);
      }
      setReflexState('RESULT');
      if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Game Toggle */}
      <View style={styles.gameSwitchRow}>
        <TouchableOpacity
          style={[styles.switchBtn, activeGame === 'roulette' && styles.switchBtnActive]}
          onPress={() => setActiveGame('roulette')}
        >
          <Text
            style={[styles.switchBtnText, activeGame === 'roulette' && styles.switchBtnTextActive]}
          >
            РУЛЕТКА
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchBtn, activeGame === 'reflex' && styles.switchBtnActive]}
          onPress={() => setActiveGame('reflex')}
        >
          <Text
            style={[styles.switchBtnText, activeGame === 'reflex' && styles.switchBtnTextActive]}
          >
            РЕАКЦИЯ
          </Text>
        </TouchableOpacity>
      </View>

      {/* GAME 1: ROULETTE */}
      {activeGame === 'roulette' && (
        <LiquidGlassCard>
          <View style={styles.rouletteBox}>
            <Text style={styles.gameHeader}>СВЕТОВАЯ БУТЫЛОЧКА</Text>

            <TouchableOpacity
              style={[styles.actionBtn, isSpinning && styles.actionBtnDisabled]}
              onPress={startRouletteSpin}
              disabled={isSpinning}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>
                {isSpinning ? 'ВРАЩЕНИЕ...' : 'КРУТИТЬ'}
              </Text>
            </TouchableOpacity>

            <View style={styles.resultBadge}>
              <Text style={styles.resultBadgeText}>
                {winnerArc !== null
                  ? `СЕКТОР: ${
                      winnerArc === 0
                        ? 'ВЕРХ-ЛЕВО'
                        : winnerArc === 1
                        ? 'НИЗ-ЛЕВО'
                        : 'ПРАВО'
                    }`
                  : 'НАЖМИТЕ ДЛЯ СТАРТА'}
              </Text>
            </View>
          </View>
        </LiquidGlassCard>
      )}

      {/* GAME 2: REFLEX */}
      {activeGame === 'reflex' && (
        <LiquidGlassCard>
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
              {reflexState === 'IDLE' && 'СТАРТ'}
              {reflexState === 'WAITING' && 'ЖДИТЕ...'}
              {reflexState === 'FLASH' && 'ЖМИ!'}
              {reflexState === 'EARLY' && 'РАНО!'}
              {reflexState === 'RESULT' && `${reactionTime} МС`}
            </Text>

            {reflexState === 'RESULT' && (
              <Text style={styles.reflexSubText}>
                ЛУЧШИЙ: {bestTime} МС
              </Text>
            )}
          </TouchableOpacity>
        </LiquidGlassCard>
      )}
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
    paddingBottom: 24,
    gap: 12,
  },
  gameSwitchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  switchBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  switchBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#8E8E93',
    letterSpacing: 1.5,
  },
  switchBtnTextActive: {
    color: '#000000',
  },
  rouletteBox: {
    alignItems: 'center',
    gap: 18,
    paddingVertical: 10,
  },
  gameHeader: {
    fontFamily: 'NDOT57',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  actionBtn: {
    width: '80%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  actionBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 13,
    color: '#000000',
    letterSpacing: 2,
  },
  resultBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  resultBadgeText: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  reflexPad: {
    height: 180,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  reflexMainTextFlash: {
    color: '#000000',
  },
  reflexSubText: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#8E8E93',
    letterSpacing: 1,
    marginTop: 8,
  },
});
