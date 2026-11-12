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

/**
 * Screen 2: «АВТО-ОБХОД»
 * Ultra-fast circular 36 micro-LED animation engine with real-time speed regulation down to 5ms.
 */
export default function PixelsScreen({
  isAutoWalk = false,
  onToggleAutoWalk,
  autoWalkSpeed = 60,
  onAutoWalkSpeedChange,
  autoWalkMode = 'forward',
  onAutoWalkModeChange,
}) {
  const handleSpeedPreset = (ms) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAutoWalkSpeedChange && onAutoWalkSpeedChange(ms);
  };

  const modes = [
    { id: 'forward', label: 'ВПЕРЕД' },
    { id: 'comet', label: 'КОМЕТА' },
    { id: 'reverse', label: 'НАЗАД' },
    { id: 'pingpong', label: 'МАЯТНИК' },
    { id: 'random', label: 'ИСКРЫ' },
    { id: 'shimmer', label: 'БЛЕСК' },
  ];

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
          {modes.map((m) => {
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
          value={autoWalkSpeed}
          min={1}
          max={200}
          step={1}
          unit=" мс"
          displayValue={
            autoWalkSpeed === 1
              ? '1 мс (ГИПЕР)'
              : autoWalkSpeed <= 5
              ? `${autoWalkSpeed} мс (ТУРБО)`
              : autoWalkSpeed <= 20
              ? `${autoWalkSpeed} мс (БЫСТРО)`
              : `${autoWalkSpeed} мс / шаг`
          }
          accentColor={GlyphColors.neonCyan}
          onValueChange={(newSpeed) => {
            onAutoWalkSpeedChange && onAutoWalkSpeedChange(newSpeed);
          }}
        />

        {/* Speed Presets */}
        <View style={styles.speedPresetsRow}>
          {[
            { label: '1мс ГИПЕР', val: 1 },
            { label: '5мс ТУРБО', val: 5 },
            { label: '20мс БЫСТРО', val: 20 },
            { label: '60мс СТАНДАРТ', val: 60 },
            { label: '120мс ПЛАВНО', val: 120 },
          ].map((item) => {
            const isSelected = autoWalkSpeed === item.val;
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
    fontWeight: 'bold',
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
    paddingVertical: 7,
    paddingHorizontal: 2,
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
    marginVertical: 10,
  },
  speedPresetsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  speedPresetBtn: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 2,
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
    fontSize: 7,
    color: '#8E8E98',
  },
  speedPresetTextActive: {
    color: GlyphColors.neonCyan,
    fontWeight: 'bold',
  },
});
