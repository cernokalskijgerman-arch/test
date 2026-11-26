import React from 'react';
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

const MODES = [
  { id: 'forward', label: 'ВПЕРЕД' },
  { id: 'comet', label: 'КОМЕТА' },
  { id: 'reverse', label: 'НАЗАД' },
  { id: 'pingpong', label: 'МАЯТНИК' },
  { id: 'random', label: 'ИСКРЫ' },
  { id: 'shimmer', label: 'БЛЕСК' },
];

const SPEED_PRESETS = [
  { label: '1мс ГИПЕР', val: 1 },
  { label: '5мс ТУРБО', val: 5 },
  { label: '20мс', val: 20 },
  { label: '60мс', val: 60 },
  { label: '120мс', val: 120 },
];

// Normalized full-circle duration factor across 36 LEDs (41° + 48° + 21° = 110°)
const CYCLE_STEP_FACTOR = 36.66;

/**
 * Screen 2: «АВТО-ОБХОД»
 * Ultra-fast circular 36 micro-LED animation engine with real-time speed regulation
 * from 1ms hyper-stream (60 FPS phase-accumulated) to 200ms precision crawl.
 */
function PixelsScreen({
  isAutoWalk = false,
  onToggleAutoWalk,
  autoWalkSpeed = 60,
  onAutoWalkSpeedChange,
  autoWalkMode = 'forward',
  onAutoWalkModeChange,
}) {
  const safeSpeed = Math.max(1, Math.min(200, Math.round(autoWalkSpeed || 60)));
  const isStreamMode = safeSpeed < 16;
  const cycleMs = safeSpeed * CYCLE_STEP_FACTOR;
  const revsPerSec = 1000 / cycleMs;

  const speedReadout =
    autoWalkMode === 'shimmer'
      ? `${safeSpeed} мс • БЛЕСК`
      : revsPerSec >= 1
      ? `${revsPerSec.toFixed(1)} об/с`
      : `${(cycleMs / 1000).toFixed(1)} с/круг (${revsPerSec.toFixed(2)} об/с)`;

  const handleSpeedPreset = (ms) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAutoWalkSpeedChange && onAutoWalkSpeedChange(ms);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LiquidGlassCard isActive={isAutoWalk}>
        <View style={styles.autoWalkHeaderRow}>
          <Text style={styles.autoWalkTitle}>АВТО-ОБХОД ПИКСЕЛЕЙ</Text>
          <TouchableOpacity
            style={[styles.autoWalkBtn, isAutoWalk && styles.autoWalkBtnActive]}
            onPress={onToggleAutoWalk}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.autoWalkBtnText,
                isAutoWalk && styles.autoWalkBtnTextActive,
              ]}
            >
              {isAutoWalk ? '■ СТОП' : '▶ СТАРТ'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mode Selector */}
        <View style={styles.modesRow}>
          {MODES.map((m) => {
            const isSelected = autoWalkMode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onAutoWalkModeChange && onAutoWalkModeChange(m.id);
                }}
                activeOpacity={0.7}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
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

        {/* Real-time Step Speed Slider with Turbo Speeds */}
        <GlyphSlider
          label="СКОРОСТЬ ШАГА АНИМАЦИИ"
          value={safeSpeed}
          min={1}
          max={200}
          step={1}
          unit=" мс"
          displayValue={
            safeSpeed === 1
              ? '1 мс (ГИПЕР)'
              : safeSpeed <= 5
              ? `${safeSpeed} мс (ТУРБО)`
              : safeSpeed <= 20
              ? `${safeSpeed} мс (БЫСТРО)`
              : `${safeSpeed} мс / шаг`
          }
          accentColor={GlyphColors.neonCyan}
          onValueChange={(newSpeed) => {
            onAutoWalkSpeedChange && onAutoWalkSpeedChange(newSpeed);
          }}
        />

        {/* Real-Time Telemetry Badge Row */}
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryBadge}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={styles.telemetryLabel}
            >
              ШАГ: {safeSpeed} мс
            </Text>
          </View>
          <View style={styles.telemetryBadge}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={styles.telemetryValue}
            >
              {speedReadout}
            </Text>
          </View>
          <View style={[styles.telemetryBadge, isStreamMode && styles.telemetryBadgeActive]}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[styles.telemetryLabel, isStreamMode && styles.telemetryLabelActive]}
            >
              {isStreamMode ? 'ПОТОК 60 FPS' : 'ТОЧНЫЙ ШАГ'}
            </Text>
          </View>
        </View>

        {/* Speed Presets */}
        <View style={styles.speedPresetsRow}>
          {SPEED_PRESETS.map((item) => {
            const isSelected = safeSpeed === item.val;
            return (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.speedPresetBtn,
                  isSelected && styles.speedPresetBtnActive,
                ]}
                onPress={() => handleSpeedPreset(item.val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.speedPresetText,
                    isSelected && styles.speedPresetTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.speedHintText}>
          Меньше мс — быстрее вращение • 1–15 мс: плавный поток без рывков
        </Text>
      </LiquidGlassCard>
    </ScrollView>
  );
}

export default React.memo(PixelsScreen);

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
  autoWalkHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  autoWalkTitle: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  autoWalkBtn: {
    minHeight: 34,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderTopColor: 'rgba(255, 255, 255, 0.45)',
  },
  autoWalkBtnActive: {
    backgroundColor: GlyphColors.neonCyan,
    borderColor: '#FFFFFF',
    shadowColor: GlyphColors.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  autoWalkBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  autoWalkBtnTextActive: {
    color: '#000000',
  },
  modesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  modeBtn: {
    flexBasis: '31%',
    flexGrow: 1,
    minHeight: 40,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.60)',
    borderTopColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.20,
    shadowRadius: 6,
  },
  modeBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#A4A4B6',
    letterSpacing: 0.6,
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  telemetryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    marginTop: 6,
  },
  telemetryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  telemetryBadgeActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: 'rgba(0, 229, 255, 0.45)',
  },
  telemetryLabel: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B6',
    letterSpacing: 0.5,
  },
  telemetryLabelActive: {
    color: GlyphColors.neonCyan,
  },
  telemetryValue: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  speedPresetsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  speedPresetBtn: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 7,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
  },
  speedPresetBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.22)',
    borderColor: GlyphColors.neonCyan,
    borderTopColor: '#FFFFFF',
    shadowColor: GlyphColors.neonCyan,
    shadowOpacity: 0.40,
    shadowRadius: 6,
  },
  speedPresetText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B6',
    textAlign: 'center',
  },
  speedPresetTextActive: {
    color: GlyphColors.neonCyan,
  },
  speedHintText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B6',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 8,
  },
});
