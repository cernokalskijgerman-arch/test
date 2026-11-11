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
import { PIXEL_COORDINATES } from '../components/GlyphCameraSilhouette';
import { GlyphColors } from '../theme/colors';

/**
 * Screen 2: «ПИКСЕЛИ»
 * 36 physical micro-LED step-by-step navigation, direct LED chip matrix,
 * auto-walk engine with 4 modes, and instant real-time speed regulation.
 */
export default function PixelsScreen({
  activePixel = null,
  onActivePixelChange,
  isAutoWalk = false,
  onToggleAutoWalk,
  autoWalkSpeed = 80,
  onAutoWalkSpeedChange,
  autoWalkMode = 'forward',
  onAutoWalkModeChange,
}) {
  const currentPixelInfo = activePixel !== null ? PIXEL_COORDINATES[activePixel] : null;

  const handleStepPixel = (direction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const total = 36;
    let next;
    if (activePixel === null) {
      next = direction > 0 ? 0 : total - 1;
    } else {
      next = (activePixel + direction + total) % total;
    }
    onActivePixelChange && onActivePixelChange(next);
  };

  const handleSelectChip = (pixelId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (activePixel === pixelId) {
      // Toggle off
      onActivePixelChange && onActivePixelChange(null);
    } else {
      onActivePixelChange && onActivePixelChange(pixelId);
    }
  };

  const handleSpeedPreset = (ms) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAutoWalkSpeedChange && onAutoWalkSpeedChange(ms);
  };

  const modes = [
    { id: 'forward', label: 'ВПЕРЕД' },
    { id: 'reverse', label: 'НАЗАД' },
    { id: 'pingpong', label: 'МАЯТНИК' },
    { id: 'random', label: 'ИСКРЫ' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================ */}
      {/* 1. CHANNEL STEPPER & METADATA                                */}
      {/* ============================================================ */}
      <LiquidGlassCard>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>ШАГОВЫЙ ТЕСТ 36 СВЕТОДИОДОВ</Text>
            <Text style={styles.subtitle}>
              Прямой контроль каждого физического микро-LED
            </Text>
          </View>
          {activePixel !== null && (
            <TouchableOpacity
              onPress={() => onActivePixelChange && onActivePixelChange(null)}
              style={styles.resetBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.resetBtnText}>СБРОСИТЬ</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stepper Navigator */}
        <View style={styles.stepperBox}>
          <TouchableOpacity
            style={styles.stepArrowBtn}
            onPress={() => handleStepPixel(-1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepArrowText}>◀</Text>
          </TouchableOpacity>

          <View style={styles.pixelMetaCenter}>
            <Text style={styles.pixelNumberText}>
              {activePixel !== null ? `КАНАЛ #${activePixel}` : 'ПО ВСЕМ ДУГАМ'}
            </Text>
            <Text style={styles.pixelZoneText}>
              {currentPixelInfo ? currentPixelInfo.name : '36 светодиодов активны'}
            </Text>
            {activePixel !== null && (
              <Text style={styles.pixelDetailText}>
                {activePixel >= 0 && activePixel <= 19 && 'Дуга Верх-Лево (198°..239°)'}
                {activePixel >= 20 && activePixel <= 30 && 'Дуга Справа (-16°..32°)'}
                {activePixel >= 31 && activePixel <= 35 && 'Дуга Низ-Лево (134°..155°)'}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.stepArrowBtn}
            onPress={() => handleStepPixel(1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepArrowText}>▶</Text>
          </TouchableOpacity>
        </View>
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 2. DIRECT 36-LED MATRIX PICKER CHIPS                         */}
      {/* ============================================================ */}
      <LiquidGlassCard>
        <View style={styles.matrixHeaderRow}>
          <Text style={styles.matrixTitle}>ИНТЕРАКТИВНАЯ МАТРИЦА СВЕТОДИОДОВ</Text>
          <Text style={styles.matrixSubtitle}>Нажмите на любой LED</Text>
        </View>

        {/* Section 1: Top-Left (0..19) */}
        <Text style={styles.arcGroupLabel}>ВЕРХ-ЛЕВО (#0..19)</Text>
        <View style={styles.chipsGrid}>
          {Array.from({ length: 20 }).map((_, i) => {
            const isSelected = activePixel === i;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.ledChip, isSelected && styles.ledChipActive]}
                onPress={() => handleSelectChip(i)}
                activeOpacity={0.6}
              >
                <Text style={[styles.ledChipText, isSelected && styles.ledChipTextActive]}>
                  {i}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section 2: Right (20..30) */}
        <Text style={styles.arcGroupLabel}>СПРАВА (#20..30)</Text>
        <View style={styles.chipsGrid}>
          {Array.from({ length: 11 }).map((_, i) => {
            const id = 20 + i;
            const isSelected = activePixel === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.ledChip, isSelected && styles.ledChipActive]}
                onPress={() => handleSelectChip(id)}
                activeOpacity={0.6}
              >
                <Text style={[styles.ledChipText, isSelected && styles.ledChipTextActive]}>
                  {id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section 3: Bottom-Left (31..35) */}
        <Text style={styles.arcGroupLabel}>НИЗ-ЛЕВО (#31..35)</Text>
        <View style={styles.chipsGrid}>
          {Array.from({ length: 5 }).map((_, i) => {
            const id = 31 + i;
            const isSelected = activePixel === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.ledChip, isSelected && styles.ledChipActive]}
                onPress={() => handleSelectChip(id)}
                activeOpacity={0.6}
              >
                <Text style={[styles.ledChipText, isSelected && styles.ledChipTextActive]}>
                  {id}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 3. AUTO-WALK ENGINE (БЕГУЩИЙ ОГОНЬ)                          */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={isAutoWalk}>
        <View style={styles.autoWalkHeaderRow}>
          <View>
            <Text style={styles.autoWalkTitle}>АВТО-ОБХОД ПИКСЕЛЕЙ</Text>
            <Text style={styles.autoWalkSubtitle}>
              Циклическая анимация бегущего света по кругу
            </Text>
          </View>
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
          {modes.map((m) => {
            const isSelected = autoWalkMode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                onPress={() => onAutoWalkModeChange && onAutoWalkModeChange(m.id)}
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

        {/* Real-time Step Speed Slider */}
        <GlyphSlider
          label="СКОРОСТЬ ШАГА АНИМАЦИИ"
          value={autoWalkSpeed}
          min={20}
          max={500}
          step={5}
          unit=" мс"
          displayValue={`${autoWalkSpeed} мс / шаг`}
          accentColor={GlyphColors.neonCyan}
          onValueChange={(newSpeed) => {
            onAutoWalkSpeedChange && onAutoWalkSpeedChange(newSpeed);
          }}
        />

        {/* Speed Presets */}
        <View style={styles.speedPresetsRow}>
          {[
            { label: '30мс ТУРБО', val: 30 },
            { label: '80мс СТАНДАРТ', val: 80 },
            { label: '160мс ПЛАВНО', val: 160 },
            { label: '320мс МЕДЛЕННО', val: 320 },
          ].map((item) => {
            const isSelected = Math.abs(autoWalkSpeed - item.val) < 10;
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
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
    paddingBottom: 28,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E98',
    marginTop: 2,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  resetBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepArrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepArrowText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pixelMetaCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  pixelNumberText: {
    fontFamily: 'NDOT57',
    fontSize: 15,
    color: GlyphColors.neonRed,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  pixelZoneText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#D0D0DC',
    marginTop: 2,
  },
  pixelDetailText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#7A7A88',
    marginTop: 2,
  },
  matrixHeaderRow: {
    marginBottom: 8,
  },
  matrixTitle: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  matrixSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#8E8E98',
    marginTop: 2,
  },
  arcGroupLabel: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#808090',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 4,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  ledChip: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  ledChipText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E98',
  },
  ledChipTextActive: {
    color: '#000000',
    fontWeight: 'bold',
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
    letterSpacing: 1.5,
  },
  autoWalkSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#8E8E98',
    marginTop: 2,
  },
  autoWalkBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  autoWalkBtnActive: {
    backgroundColor: GlyphColors.neonRed,
    borderColor: GlyphColors.neonRed,
  },
  autoWalkBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  autoWalkBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  modesRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderColor: GlyphColors.neonCyan,
  },
  modeBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E98',
    letterSpacing: 0.5,
  },
  modeBtnTextActive: {
    color: GlyphColors.neonCyan,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  speedPresetsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  speedPresetBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  speedPresetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: '#FFFFFF',
  },
  speedPresetText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#808090',
  },
  speedPresetTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
