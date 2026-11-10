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

export default function UtilitiesScreen({ brightness, onBrightnessChange }) {
  const [activeMode, setActiveMode] = useState(null); // 'timer' | 'strobe' | 'softlight'
  const [timerSeconds, setTimerSeconds] = useState(30);

  const strobeTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const stopAll = () => {
    setActiveMode(null);
    if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
  };

  const startSoftlight = (val = 255) => {
    stopAll();
    setActiveMode('softlight');
    if (onBrightnessChange) onBrightnessChange([val, val, val]);
  };

  const startStrobe = (hz = 10) => {
    stopAll();
    setActiveMode('strobe');
    let state = false;
    const intervalMs = Math.round(1000 / (hz * 2));
    strobeTimerRef.current = setInterval(() => {
      state = !state;
      const b = state ? 255 : 0;
      if (onBrightnessChange) onBrightnessChange([b, b, b]);
    }, intervalMs);
  };

  const startTimer = (secs) => {
    stopAll();
    setActiveMode('timer');
    setTimerSeconds(secs);
    let remaining = secs;

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setTimerSeconds(remaining);
      const frac = remaining / secs;
      const b = Math.round(frac * 255);
      if (onBrightnessChange) onBrightnessChange([b, b, b]);

      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current);
        // Flash 3 times
        let flash = 0;
        const flasher = setInterval(() => {
          flash++;
          const fb = flash % 2 === 1 ? 255 : 0;
          if (onBrightnessChange) onBrightnessChange([fb, fb, fb]);
          if (flash >= 6) {
            clearInterval(flasher);
            stopAll();
          }
        }, 150);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (strobeTimerRef.current) clearInterval(strobeTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Softlight Card */}
      <LiquidGlassCard isActive={activeMode === 'softlight'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>ФОНАРИК</Text>
          <TouchableOpacity
            style={[styles.btn, activeMode === 'softlight' && styles.btnActive]}
            onPress={() => (activeMode === 'softlight' ? stopAll() : startSoftlight(255))}
          >
            <Text style={[styles.btnText, activeMode === 'softlight' && styles.btnTextActive]}>
              {activeMode === 'softlight' ? 'ВЫКЛ' : 'ВКЛ'}
            </Text>
          </TouchableOpacity>
        </View>
      </LiquidGlassCard>

      {/* Strobe Card */}
      <LiquidGlassCard isActive={activeMode === 'strobe'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>СТРОБОСКОП</Text>
          <TouchableOpacity
            style={[styles.btn, activeMode === 'strobe' && styles.btnActive]}
            onPress={() => (activeMode === 'strobe' ? stopAll() : startStrobe(10))}
          >
            <Text style={[styles.btnText, activeMode === 'strobe' && styles.btnTextActive]}>
              {activeMode === 'strobe' ? 'СТОП' : 'СТАРТ'}
            </Text>
          </TouchableOpacity>
        </View>
      </LiquidGlassCard>

      {/* Timer Card */}
      <LiquidGlassCard isActive={activeMode === 'timer'}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>
            {activeMode === 'timer' ? `ТАЙМЕР: ${timerSeconds}С` : 'ТАЙМЕР'}
          </Text>
          <TouchableOpacity
            style={[styles.btn, activeMode === 'timer' && styles.btnActive]}
            onPress={() => (activeMode === 'timer' ? stopAll() : startTimer(30))}
          >
            <Text style={[styles.btnText, activeMode === 'timer' && styles.btnTextActive]}>
              {activeMode === 'timer' ? 'СТОП' : 'СТАРТ 30С'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timerPresetsRow}>
          {[10, 30, 60].map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.timeBtn}
              onPress={() => startTimer(s)}
            >
              <Text style={styles.timeBtnText}>{s}С</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    paddingBottom: 24,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: 'NDOT57',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  btn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  },
  timerPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  timeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  timeBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
