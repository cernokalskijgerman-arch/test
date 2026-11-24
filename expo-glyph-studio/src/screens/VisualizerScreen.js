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

let Audio = null;
try {
  const av = require('expo-av');
  Audio = av ? av.Audio : null;
} catch (e) {
  Audio = null;
}
if (!Audio) {
  Audio = {
    Recording: class {
      async prepareToRecordAsync() {}
      async startAsync() {}
      async stopAndUnloadAsync() {}
    },
    requestPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
  };
}

const MODES = [
  { id: 'СПЕКТР EQ', label: 'СПЕКТР EQ' },
  { id: 'БИТ-СТРОБ', label: 'БИТ-СТРОБ' },
  { id: 'ВОЛНА',     label: 'ВОЛНА' },
  { id: 'ИСКРЫ',     label: 'ИСКРЫ' },
  { id: 'ГЛИЧ',      label: 'ГЛИЧ' },
  { id: 'РАДАР',     label: 'РАДАР' },
];

export default function VisualizerScreen({ brightness, onBrightnessChange, onActivePixelChange }) {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('СПЕКТР EQ');
  const [sensitivity, setSensitivity] = useState(85);
  const [speed, setSpeed] = useState(50);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [hasMicPermission, setHasMicPermission] = useState(false);

  const recordingRef = useRef(null);
  const energyHistoryRef = useRef([]);
  const lastBeatTimeRef = useRef(0);
  const strobeIntensityRef = useRef(0);
  const timerRef = useRef(null);
  const tickRef = useRef(0);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const cleanupAudio = async () => {
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    if (onBrightnessChange) onBrightnessChange([0, 0, 0]);
    if (onActivePixelChange) onActivePixelChange(null);
  };

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      cleanupAudio();
      setBass(0);
      setMid(0);
      setTreble(0);
      return;
    }

    Audio.requestPermissionsAsync().then((res) => {
      if (res.status !== 'granted') {
        setHasMicPermission(false);
      } else {
        setHasMicPermission(true);
      }
    }).catch(() => {});

    const intervalMs = Math.max(8, Math.round(50 - (speedRef.current / 100) * 42));
    timerRef.current = setInterval(() => {
      const sensitivityGain = sensitivityRef.current / 100;
      const sensitivityAudioThreshold = 1.3 - sensitivityGain * 0.5;
      const noiseFloor = 0.06;
      const curMode = modeRef.current;
      const spd = speedRef.current / 50;
      tickRef.current += 0.055 * spd * (intervalMs / 8);
      const t = tickRef.current;
      const timeMs = Math.round(t * 100);

      let curBass = Math.max(0, Math.sin(t * 1.1) * 0.9 * sensitivityGain);
      let curMid = Math.max(0, Math.cos(t * 1.8) * 0.8 * sensitivityGain);
      let curTreble = Math.max(0, Math.sin(t * 3.2) * 0.85 * sensitivityGain);

      const instantEnergy = Math.max(noiseFloor, (curBass + curMid + curTreble) / 3.0);
      energyHistoryRef.current.push(instantEnergy);
      if (energyHistoryRef.current.length > 30) energyHistoryRef.current.shift();
      const avgEnergy = energyHistoryRef.current.reduce((a, b) => a + b, 0) / energyHistoryRef.current.length;
      const spectralFlux = Math.max(0, instantEnergy - avgEnergy);
      const onsetThreshold = Math.max(noiseFloor, avgEnergy * sensitivityAudioThreshold);

      const now = Date.now();
      const minBeatInterval = 120;
      const isBeatDetected = instantEnergy > onsetThreshold && (now - lastBeatTimeRef.current) > minBeatInterval;
      if (isBeatDetected) {
        strobeIntensityRef.current = 1.0;
        lastBeatTimeRef.current = now;
      }

      const dt = intervalMs / 1000;
      const decayRate = 8.0;
      const decayFactor = Math.exp(-decayRate * dt);
      strobeIntensityRef.current = strobeIntensityRef.current * decayFactor;

      const jitterFactor = 0.25;
      const flickerJitter = strobeIntensityRef.current > 0.4 ? (1.0 - Math.random() * jitterFactor) : 1.0;
      const strobeFlicker = flickerJitter;
      const strobeBrightness = Math.min(255, Math.max(0, Math.round(strobeIntensityRef.current * 255 * flickerJitter)));

      let bTL = 0, bBL = 0, bR = 0;
      let activePixels = [];

      switch (curMode) {
        case 'СПЕКТР EQ':
        case 'spectrum':
          bTL = Math.round(Math.min(1, curMid * sensitivityGain) * 255);
          bBL = Math.round(Math.min(1, curTreble * sensitivityGain) * 255);
          bR = Math.round(Math.min(1, curBass * sensitivityGain) * 255);
          activePixels = Array.from({ length: Math.round(Math.min(1, instantEnergy) * 36) }, (_, i) => i);
          break;
        case 'БИТ-СТРОБ':
        case 'strobe':
          bTL = isBeatDetected ? 255 : strobeBrightness;
          bBL = isBeatDetected ? 255 : strobeBrightness;
          bR = isBeatDetected ? 255 : strobeBrightness;
          activePixels = isBeatDetected ? Array.from({ length: 36 }, (_, i) => i) : [];
          break;
        case 'ВОЛНА':
        case 'wave': {
          const wavePhase = (timeMs / 100) % 36;
          bTL = Math.round(Math.min(1, curMid * sensitivityGain) * 255);
          bBL = Math.round(Math.min(1, curTreble * sensitivityGain) * 255);
          bR = Math.round(Math.min(1, curBass * sensitivityGain) * 255);
          const center = Math.floor(wavePhase);
          activePixels = [(center - 1 + 36) % 36, center, (center + 1) % 36];
          break;
        }
        case 'ИСКРЫ':
        case 'sparks':
          bTL = Math.round(Math.min(1, curMid * 0.5 * sensitivityGain) * 255);
          bBL = Math.round(Math.min(1, curTreble * sensitivityGain) * 255);
          bR = Math.round(Math.min(1, curBass * 0.5 * sensitivityGain) * 255);
          if (curTreble > 0.4 || isBeatDetected) {
            activePixels = [
              Math.floor(Math.random() * 20),
              20 + Math.floor(Math.random() * 11),
              31 + Math.floor(Math.random() * 5),
            ];
          }
          break;
        case 'ГЛИЧ':
        case 'glitch': {
          const isGlitch = (timeMs % 160) < 40 && curBass > 0.5;
          bTL = isGlitch ? 255 : 0;
          bBL = isGlitch ? 0 : Math.round(curTreble * sensitivityGain * 255);
          bR = isGlitch ? 255 : Math.round(curBass * sensitivityGain * 255);
          activePixels = isGlitch ? [0, 5, 12, 22, 28, 33] : [];
          break;
        }
        case 'РАДАР':
        case 'radar': {
          const angleStep = Math.floor((timeMs / 50) % 36);
          bTL = Math.round(curMid * sensitivityGain * 200);
          bBL = Math.round(curTreble * sensitivityGain * 200);
          bR = Math.round(curBass * sensitivityGain * 200);
          const count = Math.round(Math.min(1, curBass * sensitivityGain) * 36);
          activePixels = Array.from({ length: count }, (_, i) => i);
          break;
        }
        default:
          bTL = Math.round(Math.min(1, curMid * sensitivityGain) * 255);
          bBL = Math.round(Math.min(1, curTreble * sensitivityGain) * 255);
          bR = Math.round(Math.min(1, curBass * sensitivityGain) * 255);
          activePixels = [];
          break;
      }

      setBass(curBass);
      setMid(curMid);
      setTreble(curTreble);
      if (onBrightnessChange) onBrightnessChange([bTL, bBL, bR]);
      if (onActivePixelChange) onActivePixelChange(activePixels);
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      cleanupAudio();
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
