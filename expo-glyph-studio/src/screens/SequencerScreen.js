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

const PRESETS = {
  cyber: {
    name: 'CYBER',
    topleft: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
    bottomleft: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    right: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bpm: 128,
  },
  heartbeat: {
    name: 'PULSE',
    topleft: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    bottomleft: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    right: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    bpm: 90,
  },
  strobe: {
    name: 'STROBE',
    topleft: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bottomleft: [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    right: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bpm: 140,
  },
  techno: {
    name: 'TECHNO',
    topleft: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1],
    bottomleft: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    right: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0],
    bpm: 134,
  },
  echo: {
    name: 'ECHO',
    topleft: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bottomleft: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    right: [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    bpm: 110,
  },
};

/**
 * Screen 3: «СЕКВЕНСОР» (Матрица полей)
 * Compact 16-step rhythmic pattern matrix across all 3 Glyph arcs.
 * Fits on a single screen without vertical scrolling.
 */
export default function SequencerScreen({ brightness, onBrightnessChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(128);
  const [activePreset, setActivePreset] = useState('cyber');

  const [tracks, setTracks] = useState({
    topleft: [...PRESETS.cyber.topleft],
    bottomleft: [...PRESETS.cyber.bottomleft],
    right: [...PRESETS.cyber.right],
  });

  const timerRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const toggleStep = (trackName, index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTracks((prev) => ({
      ...prev,
      [trackName]: prev[trackName].map((v, i) => (i === index ? (v ? 0 : 1) : v)),
    }));
  };

  const loadPreset = (presetKey) => {
    Haptics.selectionAsync().catch(() => {});
    setActivePreset(presetKey);
    const p = PRESETS[presetKey];
    setTracks({
      topleft: [...p.topleft],
      bottomleft: [...p.bottomleft],
      right: [...p.right],
    });
    setBpm(p.bpm);
  };

  const clearAll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setActivePreset(null);
    setTracks({
      topleft: new Array(16).fill(0),
      bottomleft: new Array(16).fill(0),
      right: new Array(16).fill(0),
    });
    if (onBrightnessChange) {
      onBrightnessChange([0, 0, 0]);
    }
  };

  // Sequencer Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (onBrightnessChange) {
        onBrightnessChange([0, 0, 0]);
      }
      return;
    }

    const stepMs = Math.round((60000 / bpm) / 4);

    timerRef.current = setInterval(() => {
      const step = currentStepRef.current;
      const curTracks = tracksRef.current;

      const bTL = curTracks.topleft[step] ? 255 : 0;
      const bBL = curTracks.bottomleft[step] ? 255 : 0;
      const bR = curTracks.right[step] ? 255 : 0;

      if (onBrightnessChange) {
        onBrightnessChange([bTL, bBL, bR]);
      }

      currentStepRef.current = (step + 1) % 16;
      setCurrentStep(currentStepRef.current);
    }, stepMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (onBrightnessChange) {
        onBrightnessChange([0, 0, 0]);
      }
    };
  }, [isPlaying, bpm]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* ============================================================ */}
      {/* 1. COMPACT TRANSPORT & PRESETS BAR                           */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={isPlaying} style={styles.topCard}>
        <View style={styles.transportRow}>
          {/* Play / Stop Button */}
          <TouchableOpacity
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setIsPlaying((p) => !p);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.playBtnText, isPlaying && styles.playBtnTextActive]}>
              {isPlaying ? '■ СТОП' : '▶ ПУСК'}
            </Text>
          </TouchableOpacity>

          {/* Compact BPM Stepper */}
          <View style={styles.bpmBox}>
            <TouchableOpacity
              style={styles.bpmArrowBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setBpm((b) => Math.max(60, b - 4));
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.bpmArrowText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.bpmValueText}>{bpm} BPM</Text>
            <TouchableOpacity
              style={styles.bpmArrowBtn}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setBpm((b) => Math.min(220, b + 4));
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.bpmArrowText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Step Indicator */}
          <View style={styles.stepCounterBox}>
            <Text style={styles.stepCounterText}>
              {isPlaying ? `${currentStep + 1}/16` : '16 ШАГОВ'}
            </Text>
          </View>

          {/* Clear Button */}
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll} activeOpacity={0.7}>
            <Text style={styles.clearBtnText}>СБРОС</Text>
          </TouchableOpacity>
        </View>

        {/* Compact Presets Row */}
        <View style={styles.presetsRow}>
          {Object.keys(PRESETS).map((key) => {
            const p = PRESETS[key];
            const isSelected = activePreset === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                onPress={() => loadPreset(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetBtnText, isSelected && styles.presetBtnTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 2. 16-STEP RHYTHM MATRIX (3 TRACKS)                          */}
      {/* ============================================================ */}
      <LiquidGlassCard style={styles.matrixCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.matrix}>
            {/* Step header markers */}
            <View style={styles.stepHeaderRow}>
              <View style={styles.trackLabelBox}>
                <Text style={styles.headerLabel}>ДОРОЖКА</Text>
              </View>
              {Array.from({ length: 16 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepNumBox,
                    isPlaying && currentStep === i && styles.stepNumActive,
                    i % 4 === 0 && styles.stepNumQuarter,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepNumText,
                      isPlaying && currentStep === i && styles.stepNumTextActive,
                    ]}
                  >
                    {i + 1}
                  </Text>
                </View>
              ))}
            </View>

            {/* Track 1: Top-Left */}
            <View style={styles.trackRow}>
              <View style={styles.trackLabelBox}>
                <Text style={styles.trackLabel}>ВЕРХ-ЛЕВО</Text>
              </View>
              {tracks.topleft.map((val, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.stepCell,
                    val > 0 && styles.stepCellOn,
                    isPlaying && currentStep === i && styles.stepCellPlaying,
                  ]}
                  onPress={() => toggleStep('topleft', i)}
                  activeOpacity={0.6}
                />
              ))}
            </View>

            {/* Track 2: Bottom-Left */}
            <View style={styles.trackRow}>
              <View style={styles.trackLabelBox}>
                <Text style={styles.trackLabel}>НИЗ-ЛЕВО</Text>
              </View>
              {tracks.bottomleft.map((val, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.stepCell,
                    val > 0 && styles.stepCellOn,
                    isPlaying && currentStep === i && styles.stepCellPlaying,
                  ]}
                  onPress={() => toggleStep('bottomleft', i)}
                  activeOpacity={0.6}
                />
              ))}
            </View>

            {/* Track 3: Right Arc */}
            <View style={styles.trackRow}>
              <View style={styles.trackLabelBox}>
                <Text style={styles.trackLabel}>ПРАВЫЙ</Text>
              </View>
              {tracks.right.map((val, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.stepCell,
                    val > 0 && styles.stepCellOn,
                    isPlaying && currentStep === i && styles.stepCellPlaying,
                  ]}
                  onPress={() => toggleStep('right', i)}
                  activeOpacity={0.6}
                />
              ))}
            </View>
          </View>
        </ScrollView>
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
  topCard: {
    paddingVertical: 8,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 8,
  },
  playBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  playBtnActive: {
    backgroundColor: GlyphColors.neonRed,
  },
  playBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#000000',
    letterSpacing: 0.8,
  },
  playBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  bpmBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 6,
  },
  bpmArrowBtn: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  bpmArrowText: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  bpmValueText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  stepCounterBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stepCounterText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#D0D0DC',
    letterSpacing: 0.8,
  },
  clearBtn: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  clearBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#8E8E98',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderColor: '#FFFFFF',
  },
  presetBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#8E8E98',
    letterSpacing: 0.8,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  matrixCard: {
    paddingVertical: 8,
  },
  matrix: {
    gap: 5,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  trackLabelBox: {
    width: 68,
    justifyContent: 'center',
  },
  headerLabel: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#666675',
    letterSpacing: 0.8,
  },
  stepNumBox: {
    width: 22,
    height: 18,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  stepNumQuarter: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.35)',
  },
  stepNumActive: {
    backgroundColor: GlyphColors.neonRed,
    borderRadius: 4,
  },
  stepNumText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#555565',
  },
  stepNumTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackLabel: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#D0D0DC',
    letterSpacing: 0.8,
  },
  stepCell: {
    width: 22,
    height: 26,
    marginHorizontal: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  stepCellOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 6,
    elevation: 4,
  },
  stepCellPlaying: {
    borderColor: GlyphColors.neonRed,
    borderWidth: 1.8,
  },
});
