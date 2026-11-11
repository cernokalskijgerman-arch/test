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

const PRESETS = {
  cyber: {
    name: 'CYBER METRO',
    topleft: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
    bottomleft: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    right: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bpm: 128,
  },
  heartbeat: {
    name: 'HEARTBEAT',
    topleft: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    bottomleft: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    right: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    bpm: 90,
  },
  strobe: {
    name: 'STROBE WAVE',
    topleft: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bottomleft: [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    right: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bpm: 140,
  },
  techno: {
    name: 'TECHNO ROLL',
    topleft: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1],
    bottomleft: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    right: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0],
    bpm: 134,
  },
  echo: {
    name: 'MINIMAL ECHO',
    topleft: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bottomleft: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    right: [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    bpm: 110,
  },
};

/**
 * Screen 3: «СЕКВЕНСОР»
 * 16-step rhythmic pattern sequencer across all 3 Glyph arcs.
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
    };
  }, [isPlaying, bpm]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================ */}
      {/* 1. TRANSPORT & BPM CONTROL                                   */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={isPlaying}>
        <View style={styles.transportRow}>
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

          <View style={styles.stepCounterBox}>
            <Text style={styles.stepCounterText}>
              ШАГ {isPlaying ? `${currentStep + 1} / 16` : 'ГОТОВ'}
            </Text>
          </View>

          <TouchableOpacity style={styles.clearBtn} onPress={clearAll} activeOpacity={0.7}>
            <Text style={styles.clearBtnText}>ОЧИСТИТЬ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Liquid Glass BPM Slider */}
        <GlyphSlider
          label="ТЕМП ВОСПРОИЗВЕДЕНИЯ"
          value={bpm}
          min={60}
          max={220}
          step={2}
          unit=" BPM"
          displayValue={`${bpm} BPM`}
          accentColor={GlyphColors.neonRed}
          onValueChange={(newBpm) => setBpm(newBpm)}
        />

        {/* Presets Row */}
        <View style={styles.presetLabelRow}>
          <Text style={styles.presetSectionLabel}>ПРЕСЕТЫ ПАТТЕРНОВ</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
          <View style={styles.presetsList}>
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
        </ScrollView>
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 2. 16-STEP RHYTHM GRID                                       */}
      {/* ============================================================ */}
      <LiquidGlassCard>
        <Text style={styles.matrixHeaderTitle}>МАТРИЦА ШАГОВ (16 ДОЛЕЙ)</Text>
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
                <Text style={styles.trackSubLabel}>#0..19</Text>
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
                <Text style={styles.trackSubLabel}>#31..35</Text>
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
                <Text style={styles.trackLabel}>ПРАВАЯ</Text>
                <Text style={styles.trackSubLabel}>#20..30</Text>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 12,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  playBtnActive: {
    backgroundColor: GlyphColors.neonRed,
  },
  playBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#000000',
    letterSpacing: 1,
  },
  playBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  stepCounterBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepCounterText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#D0D0DC',
    letterSpacing: 1,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  clearBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E98',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  presetLabelRow: {
    marginTop: 6,
    marginBottom: 4,
  },
  presetSectionLabel: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#808090',
    letterSpacing: 1,
  },
  presetsScroll: {
    marginHorizontal: -4,
  },
  presetsList: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: '#FFFFFF',
  },
  presetBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E98',
    letterSpacing: 0.8,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  matrixHeaderTitle: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  matrix: {
    paddingVertical: 4,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackLabelBox: {
    width: 78,
  },
  headerLabel: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#666675',
    letterSpacing: 1,
  },
  stepNumBox: {
    width: 32,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  stepNumQuarter: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  stepNumActive: {
    backgroundColor: '#FFFFFF',
  },
  stepNumText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#666675',
  },
  stepNumTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  trackLabel: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  trackSubLabel: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#666675',
  },
  stepCell: {
    width: 32,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepCellOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  stepCellPlaying: {
    borderColor: GlyphColors.neonRed,
    borderWidth: 2,
  },
});
