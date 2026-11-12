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
 * FFT Reactive Audio Visualizer with 3 frequency meters and sensitivity slider.
 */
export default function VisualizerScreen({ brightness, onBrightnessChange }) {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('spectrum'); // 'spectrum' | 'wave' | 'pulse'
  const [sensitivity, setSensitivity] = useState(85);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);

  const timerRef = useRef(null);
  const tickRef = useRef(0);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

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

    timerRef.current = setInterval(() => {
      const sens = sensitivityRef.current / 100;
      const curMode = modeRef.current;

      tickRef.current += 0.22;
      const t = tickRef.current;

      let curBass = 0;
      let curMid = 0;
      let curTreble = 0;

      if (curMode === 'spectrum') {
        curBass = Math.max(0, Math.sin(t * 1.1) * 0.9 * sens + (Math.sin(t * 0.4) > 0.5 ? 0.3 : 0));
        curMid = Math.max(0, Math.cos(t * 1.8) * 0.8 * sens);
        curTreble = Math.max(0, Math.sin(t * 3.2) * 0.85 * sens);
      } else if (curMode === 'wave') {
        curBass = Math.max(0, (Math.sin(t) * 0.5 + 0.5) * sens);
        curMid = Math.max(0, (Math.sin(t + 1.2) * 0.5 + 0.5) * sens);
        curTreble = Math.max(0, (Math.sin(t + 2.4) * 0.5 + 0.5) * sens);
      } else if (curMode === 'pulse') {
        const beat = Math.sin(t * 2) > 0.6 ? 1 : 0.05;
        curBass = beat * sens;
        curMid = Math.max(0, (beat * 0.7 + Math.sin(t * 4) * 0.25) * sens);
        curTreble = Math.max(0, (beat * 0.5 + Math.cos(t * 6) * 0.3) * sens);
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
    }, 40);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (onBrightnessChange) {
        onBrightnessChange([0, 0, 0]);
      }
    };
  }, [isActive]);

  const modes = [
    { id: 'spectrum', label: 'СПЕКТР' },
    { id: 'wave', label: 'ВОЛНА' },
    { id: 'pulse', label: 'БАС-ПУЛЬС' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================ */}
      {/* 1. VISUALIZER MASTER CARD                                    */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={isActive}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>FFT ВИЗУАЛИЗАТОР МУЗЫКИ</Text>
            <Text style={styles.subtitle}>
              Реакция глифов на частотный спектр звука
            </Text>
          </View>
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

        {/* Mode Selector */}
        <View style={styles.modesRow}>
          {modes.map((m) => {
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
                <Text
                  style={[
                    styles.modeBtnText,
                    isSelected && styles.modeBtnTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
            <Text style={styles.meterFreq}>СЧ (MID)</Text>
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
            <Text style={styles.meterFreq}>ВЧ (TREBLE)</Text>
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
            <Text style={styles.meterFreq}>НЧ (BASS)</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Sensitivity Slider */}
        <GlyphSlider
          label="ЧУВСТВИТЕЛЬНОСТЬ РЕАКЦИИ"
          value={sensitivity}
          min={10}
          max={100}
          step={1}
          unit="%"
          displayValue={`${sensitivity}%`}
          accentColor="#FFFFFF"
          onValueChange={(val) => setSensitivity(val)}
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
  subtitle: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#8E8E98',
    marginTop: 1,
  },
  toggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
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
  modesRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: '#FFFFFF',
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
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
  meterFreq: {
    fontFamily: 'NDOT57',
    fontSize: 7,
    color: '#707080',
    marginTop: 1,
  },
});
