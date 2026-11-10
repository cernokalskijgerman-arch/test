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
    name: 'Cyber Metro',
    topleft: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
    bottomleft: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    right: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bpm: 128,
  },
  heartbeat: {
    name: 'Heartbeat',
    topleft: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    bottomleft: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    right: [1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
    bpm: 90,
  },
  strobe: {
    name: 'Strobe Wave',
    topleft: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bottomleft: [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    right: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    bpm: 140,
  },
};

export default function SequencerScreen({ brightness, onBrightnessChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(128);

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
      {/* Transport Card */}
      <LiquidGlassCard>
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
              {isPlaying ? 'СТОП' : 'СТАРТ'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bpmRow}>
            <TouchableOpacity
              style={styles.bpmBtn}
              onPress={() => setBpm((b) => Math.max(60, b - 5))}
            >
              <Text style={styles.bpmBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.bpmText}>{bpm} BPM</Text>
            <TouchableOpacity
              style={styles.bpmBtn}
              onPress={() => setBpm((b) => Math.min(220, b + 5))}
            >
              <Text style={styles.bpmBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Text style={styles.clearBtnText}>ОЧИСТИТЬ</Text>
          </TouchableOpacity>
        </View>

        {/* Presets */}
        <View style={styles.presetRow}>
          <TouchableOpacity style={styles.presetBtn} onPress={() => loadPreset('cyber')}>
            <Text style={styles.presetBtnText}>METRO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetBtn} onPress={() => loadPreset('heartbeat')}>
            <Text style={styles.presetBtnText}>PULSE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetBtn} onPress={() => loadPreset('strobe')}>
            <Text style={styles.presetBtnText}>STROBE</Text>
          </TouchableOpacity>
        </View>
      </LiquidGlassCard>

      {/* Grid Card */}
      <LiquidGlassCard>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.matrix}>
            {/* Step numbers */}
            <View style={styles.stepHeaderRow}>
              <View style={styles.trackLabelBox}>
                <Text style={styles.headerLabel}>ДОРОЖКА</Text>
              </View>
              {Array.from({ length: 16 }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.stepNumBox, isPlaying && currentStep === i && styles.stepNumActive]}
                >
                  <Text
                    style={[styles.stepNumText, isPlaying && currentStep === i && styles.stepNumTextActive]}
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
                <Text style={styles.trackLabel}>ПРАВО</Text>
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
    paddingBottom: 24,
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
    paddingVertical: 10,
  },
  playBtnActive: {
    backgroundColor: GlyphColors.neonRed,
  },
  playBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#000000',
    letterSpacing: 1,
  },
  playBtnTextActive: {
    color: '#FFFFFF',
  },
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bpmBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpmBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 14,
    color: '#FFFFFF',
  },
  bpmText: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#8E8E93',
    letterSpacing: 1,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  presetBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
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
    width: 80,
  },
  headerLabel: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#666666',
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
  stepNumActive: {
    backgroundColor: '#FFFFFF',
  },
  stepNumText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#666666',
  },
  stepNumTextActive: {
    color: '#000000',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  trackLabel: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  stepCell: {
    width: 32,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 4,
  },
  stepCellOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  stepCellPlaying: {
    borderColor: GlyphColors.neonRed,
  },
});
