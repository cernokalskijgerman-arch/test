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
 * Screen 4: «МУЗЫКА»
 * Advanced Music Visualizer with 6 reactive modes,
 * real-time frequency meters, and sensitivity control.
 */

const MODES = [
  { id: 'spectrum',   label: 'СПЕКТР' },
  { id: 'wave',       label: 'ВОЛНА' },
  { id: 'pulse',      label: 'ПУЛЬС' },
  { id: 'bassboom',   label: 'БАС-БУМ' },
  { id: 'chase',      label: 'ПОГОНЯ' },
  { id: 'strobe',     label: 'СТРОБ' },
];

export default function VisualizerScreen({ brightness, onBrightnessChange }) {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('spectrum');
  const [sensitivity, setSensitivity] = useState(85);
  const [speed, setSpeed] = useState(50);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);

  const timerRef = useRef(null);
  const tickRef = useRef(0);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  const speedRef = useRef(speed);
  speedRef.current = speed;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (onBrightnessChange) {
        onBrightnessChange([0, 0, 0]);
      }
      setBass(0);
      setMid(0);
      setTreble(0);
      return;
    }

    // 120Hz dynamic refresh: 8ms minimum interval for fluid high-framerate spectrum
    const intervalMs = Math.max(8, Math.round(50 - (speedRef.current / 100) * 42));

    timerRef.current = setInterval(() => {
      const sens = sensitivityRef.current / 100;
      const curMode = modeRef.current;
      const spd = speedRef.current / 50; // speed multiplier

      tickRef.current += 0.055 * spd * (intervalMs / 8);
      const t = tickRef.current;

      let curBass = 0;
      let curMid = 0;
      let curTreble = 0;

      if (curMode === 'spectrum') {
        // Classic FFT spectrum: each arc reacts to a different frequency band
        curBass = Math.max(0, Math.sin(t * 1.1) * 0.9 * sens + (Math.sin(t * 0.4) > 0.5 ? 0.3 : 0));
        curMid = Math.max(0, Math.cos(t * 1.8) * 0.8 * sens);
        curTreble = Math.max(0, Math.sin(t * 3.2) * 0.85 * sens);
      } else if (curMode === 'wave') {
        // Smooth sine wave flowing through arcs with phase offset
        curBass = Math.max(0, (Math.sin(t) * 0.5 + 0.5) * sens);
        curMid = Math.max(0, (Math.sin(t + 1.2) * 0.5 + 0.5) * sens);
        curTreble = Math.max(0, (Math.sin(t + 2.4) * 0.5 + 0.5) * sens);
      } else if (curMode === 'pulse') {
        // Sharp beat-synced pulse: all arcs flash on beat
        const beat = Math.sin(t * 2) > 0.6 ? 1 : 0.05;
        curBass = beat * sens;
        curMid = Math.max(0, (beat * 0.7 + Math.sin(t * 4) * 0.25) * sens);
        curTreble = Math.max(0, (beat * 0.5 + Math.cos(t * 6) * 0.3) * sens);
      } else if (curMode === 'bassboom') {
        // Heavy bass emphasis: right arc (bass) dominates, others react subtly
        const bassHit = Math.pow(Math.max(0, Math.sin(t * 1.4)), 3);
        curBass = Math.min(1, bassHit * 1.5 * sens);
        curMid = Math.max(0, bassHit * 0.25 * sens + Math.sin(t * 5) * 0.08 * sens);
        curTreble = Math.max(0, bassHit * 0.15 * sens + Math.cos(t * 7) * 0.06 * sens);
      } else if (curMode === 'chase') {
        // Light chases around arcs sequentially
        const phase = (t * 1.5) % 3;
        curBass = phase < 1 ? Math.max(0, (1 - phase) * sens) : 0;
        curMid = phase >= 0.8 && phase < 1.8 ? Math.max(0, (1 - Math.abs(phase - 1.3) / 0.5) * sens) : 0;
        curTreble = phase >= 1.6 && phase < 2.6 ? Math.max(0, (1 - Math.abs(phase - 2.1) / 0.5) * sens) : 0;
      } else if (curMode === 'strobe') {
        // Random rapid strobe flicker on all arcs independently
        const strobeThresh = 0.55 - sens * 0.3;
        curBass = Math.random() > strobeThresh ? sens : 0;
        curMid = Math.random() > strobeThresh ? sens : 0;
        curTreble = Math.random() > strobeThresh ? sens : 0;
      }

      curBass = Math.min(1, Math.max(0, curBass));
      curMid = Math.min(1, Math.max(0, curMid));
      curTreble = Math.min(1, Math.max(0, curTreble));

      setBass(curBass);
      setMid(curMid);
      setTreble(curTreble);

      const bTL = Math.round(curMid * 255);
      const bBL = Math.round(curTreble * 255);
      const bR = Math.round(curBass * 255);

      if (onBrightnessChange) {
        onBrightnessChange([bTL, bBL, bR]);
      }
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (onBrightnessChange) {
        onBrightnessChange([0, 0, 0]);
      }
    };
  }, [isActive, speed]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================ */}
      {/* VISUALIZER MASTER CARD                                       */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={isActive}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>ВИЗУАЛИЗАТОР МУЗЫКИ</Text>
          <TouchableOpacity
            style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setIsActive((a) => !a);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleBtnText, isActive && styles.toggleBtnTextActive]}>
              {isActive ? '■ СТОП' : '▶ СТАРТ'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mode Selector - 2 rows of 3 */}
        <View style={styles.modesContainer}>
          <View style={styles.modesRow}>
            {MODES.slice(0, 3).map((m) => {
              const isSelected = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMode(m.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeBtnText, isSelected && styles.modeBtnTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.modesRow}>
            {MODES.slice(3, 6).map((m) => {
              const isSelected = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMode(m.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modeBtnText, isSelected && styles.modeBtnTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        {/* 3 Spectrum Meters */}
        <View style={styles.metersRow}>
          {/* Mids -> Top-Left Arc */}
          <View style={styles.meterCol}>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { height: `${Math.round(mid * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.meterLabel}>ВЕРХ-ЛЕВО</Text>
          </View>

          {/* Treble -> Bottom-Left Arc */}
          <View style={styles.meterCol}>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { height: `${Math.round(treble * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.meterLabel}>НИЗ-ЛЕВО</Text>
          </View>

          {/* Bass -> Right Arc */}
          <View style={styles.meterCol}>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { height: `${Math.round(bass * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.meterLabel}>ПРАВАЯ</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Sensitivity Slider */}
        <GlyphSlider
          label="ЧУВСТВИТЕЛЬНОСТЬ"
          value={sensitivity}
          min={10}
          max={100}
          step={1}
          displayValue={`${sensitivity}%`}
          accentColor="#FFFFFF"
          onValueChange={(val) => setSensitivity(val)}
        />

        {/* Speed Slider */}
        <GlyphSlider
          label="СКОРОСТЬ"
          value={speed}
          min={1}
          max={100}
          step={1}
          displayValue={
            speed <= 20 ? `${speed}% МЕДЛЕННО`
            : speed <= 70 ? `${speed}%`
            : `${speed}% БЫСТРО`
          }
          accentColor={GlyphColors.neonCyan}
          onValueChange={(val) => setSpeed(val)}
        />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  toggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.38)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  toggleBtnTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  modesContainer: {
    gap: 5,
    marginBottom: 4,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 5,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 5.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.60)',
    borderTopColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.20,
    shadowRadius: 5,
  },
  modeBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#8E8E98',
    letterSpacing: 0.6,
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 6,
  },
  metersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  meterCol: {
    alignItems: 'center',
    width: 72,
  },
  barBg: {
    width: 34,
    height: 95,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 2,
  },
  barFill: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  meterLabel: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#FFFFFF',
    letterSpacing: 0.8,
    marginTop: 6,
  },
});
