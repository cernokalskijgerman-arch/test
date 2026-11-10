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

export default function VisualizerScreen({ brightness, onBrightnessChange }) {
  const [isActive, setIsActive] = useState(false);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);

  const timerRef = useRef(null);
  const tickRef = useRef(0);

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
      tickRef.current += 0.24;
      const t = tickRef.current;

      const curBass = Math.max(0, Math.sin(t) * 0.95);
      const curMid = Math.max(0, Math.cos(t * 1.6) * 0.78);
      const curTreble = Math.max(0, Math.sin(t * 2.8) * 0.88);

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
    };
  }, [isActive]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LiquidGlassCard>
        <View style={styles.headerRow}>
          <Text style={styles.title}>FFT ВИЗУАЛИЗАТОР</Text>
          <TouchableOpacity
            style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setIsActive((a) => !a);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleBtnText, isActive && styles.toggleBtnTextActive]}>
              {isActive ? 'СТОП' : 'СТАРТ'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3 Spectrum Meters */}
        <View style={styles.metersRow}>
          {/* Mids -> Top-Left Arc */}
          <View style={styles.meterCol}>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { height: `${Math.round(mid * 100)}%` }]} />
            </View>
            <Text style={styles.meterLabel}>ВЕРХ-ЛЕВО</Text>
          </View>

          {/* Treble -> Bottom-Left Arc */}
          <View style={styles.meterCol}>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { height: `${Math.round(treble * 100)}%` }]} />
            </View>
            <Text style={styles.meterLabel}>НИЗ-ЛЕВО</Text>
          </View>

          {/* Bass -> Right Arc */}
          <View style={styles.meterCol}>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { height: `${Math.round(bass * 100)}%` }]} />
            </View>
            <Text style={styles.meterLabel}>ПРАВО</Text>
          </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'NDOT57',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  toggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  toggleBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  toggleBtnTextActive: {
    color: '#000000',
  },
  metersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  meterCol: {
    alignItems: 'center',
    width: 80,
  },
  barBg: {
    width: 36,
    height: 120,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 3,
  },
  barFill: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  meterLabel: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#8E8E93',
    letterSpacing: 1,
    marginTop: 10,
  },
});
