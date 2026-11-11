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

export default function DashboardScreen({
  brightness,
  masterBrightness = 255,
  onMasterBrightnessChange,
  activePixel = null,
  onActivePixelChange,
  isAutoWalk = false,
  onToggleAutoWalk,
  autoWalkSpeed = 80,
  onAutoWalkSpeedChange,
  onNavigateTab,
  onTriggerUtility,
  onAllOn,
  onAllOff,
}) {
  const isAnyOn = brightness.some((b) => b > 0);

  const handleToggleAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isAnyOn) {
      onAllOff();
    } else {
      const targetBrightness = masterBrightness > 0 ? masterBrightness : 255;
      onAllOn(targetBrightness);
    }
  };

  const handleStepPixel = (direction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const total = 36;
    const current = activePixel !== null ? activePixel : 0;
    const next = (current + direction + total) % total;
    onActivePixelChange && onActivePixelChange(next);
  };

  const currentPixelInfo = activePixel !== null ? PIXEL_COORDINATES[activePixel] : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================ */}
      {/* 1. MASTER POWER & BRIGHTNESS CONTROL                         */}
      {/* ============================================================ */}
      <LiquidGlassCard style={styles.cardSpacing}>
        {/* Master Power Toggle Bar */}
        <View style={styles.masterRow}>
          <View style={styles.masterTitleRow}>
            <View style={[styles.statusDot, isAnyOn && styles.statusDotActive]} />
            <Text style={styles.masterTitle}>
              {isAnyOn ? `GLYPH: ON (${Math.round((masterBrightness / 255) * 100)}%)` : 'GLYPH: OFF'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.masterBtn, isAnyOn && styles.masterBtnActive]}
            onPress={handleToggleAll}
            activeOpacity={0.7}
          >
            <Text style={[styles.masterBtnText, isAnyOn && styles.masterBtnTextActive]}>
              {isAnyOn ? 'ОТКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Master Brightness Slider */}
        <GlyphSlider
          label="ЯРКОСТЬ GLYPH"
          value={masterBrightness}
          min={0}
          max={255}
          step={1}
          displayValue={
            masterBrightness === 0
              ? '0% (ВЫКЛ)'
              : `${Math.round((masterBrightness / 255) * 100)}% (${masterBrightness})`
          }
          onValueChange={(newVal) => {
            onMasterBrightnessChange && onMasterBrightnessChange(newVal);
          }}
        />
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 2. STEP-BY-STEP PIXEL STEPPER & SPEED REGULATION             */}
      {/* ============================================================ */}
      <LiquidGlassCard style={styles.cardSpacing}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>ПОШАГОВЫЙ ТЕСТ ПИКСЕЛЕЙ</Text>
            <Text style={styles.sectionSubtitle}>
              36 физических светодиодов по кругу камеры
            </Text>
          </View>
          {activePixel !== null && (
            <TouchableOpacity
              onPress={() => onActivePixelChange && onActivePixelChange(null)}
              style={styles.resetPixelBtn}
            >
              <Text style={styles.resetPixelBtnText}>СБРОС</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step-by-Step Channel Navigator */}
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepArrowBtn}
            onPress={() => handleStepPixel(-1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepArrowText}>◀</Text>
          </TouchableOpacity>

          <View style={styles.pixelInfoBox}>
            <Text style={styles.pixelChannelText}>
              {activePixel !== null ? `КАНАЛ #${activePixel}` : 'ПО ВСЕМ ДУГАМ'}
            </Text>
            <Text style={styles.pixelZoneText}>
              {currentPixelInfo ? currentPixelInfo.name : '36 светодиодов активны'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.stepArrowBtn}
            onPress={() => handleStepPixel(1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepArrowText}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* Auto Walk Toggle Button */}
        <TouchableOpacity
          style={[styles.autoWalkBtn, isAutoWalk && styles.autoWalkBtnActive]}
          onPress={onToggleAutoWalk}
          activeOpacity={0.7}
        >
          <Text style={[styles.autoWalkBtnText, isAutoWalk && styles.autoWalkBtnTextActive]}>
            {isAutoWalk ? '■ ОСТАНОВИТЬ АВТО-ОБХОД' : '▶ СТАРТ АВТО-ОБХОДА (БЕГУЩИЙ ОГОНЬ)'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Animation Step Speed Slider */}
        <GlyphSlider
          label="СКОРОСТЬ ШАГА АНИМАЦИИ"
          value={autoWalkSpeed}
          min={20}
          max={500}
          step={5}
          unit=" мс"
          displayValue={`${autoWalkSpeed} мс / шаг`}
          accentColor="#00E5FF"
          onValueChange={(newSpeed) => {
            onAutoWalkSpeedChange && onAutoWalkSpeedChange(newSpeed);
          }}
        />
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 3. MODE HUBS                                                 */}
      {/* ============================================================ */}
      <View style={styles.cardsGrid}>
        <LiquidGlassCard
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigateTab(1);
          }}
          style={styles.hubCard}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>СЕКВЕНСОР</Text>
            <Text style={styles.cardArrow}>→</Text>
          </View>
        </LiquidGlassCard>

        <LiquidGlassCard
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigateTab(2);
          }}
          style={styles.hubCard}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>МУЗЫКА</Text>
            <Text style={styles.cardArrow}>→</Text>
          </View>
        </LiquidGlassCard>

        <LiquidGlassCard
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigateTab(3);
          }}
          style={styles.hubCard}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>УТИЛИТЫ</Text>
            <Text style={styles.cardArrow}>→</Text>
          </View>
        </LiquidGlassCard>

        <LiquidGlassCard
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onNavigateTab(4);
          }}
          style={styles.hubCard}
        >
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>АРКАДА</Text>
            <Text style={styles.cardArrow}>→</Text>
          </View>
        </LiquidGlassCard>
      </View>

      {/* ============================================================ */}
      {/* 4. QUICK ACTIONS                                             */}
      {/* ============================================================ */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => onTriggerUtility('battery')}
          activeOpacity={0.7}
        >
          <Text style={styles.quickBtnText}>БАТАРЕЯ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => onTriggerUtility('strobe')}
          activeOpacity={0.7}
        >
          <Text style={styles.quickBtnText}>СТРОБ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => onTriggerUtility('timer')}
          activeOpacity={0.7}
        >
          <Text style={styles.quickBtnText}>ТАЙМЕР</Text>
        </TouchableOpacity>
      </View>
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
  cardSpacing: {
    padding: 0,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  masterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#444444',
    marginRight: 10,
  },
  statusDotActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 8,
    shadowOpacity: 1,
  },
  masterTitle: {
    fontFamily: 'NDOT57',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  masterBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  masterBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  masterBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  masterBtnTextActive: {
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  sectionSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E93',
    marginTop: 2,
  },
  resetPixelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  resetPixelBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E93',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 6,
    marginVertical: 6,
  },
  stepArrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepArrowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  pixelInfoBox: {
    alignItems: 'center',
    flex: 1,
  },
  pixelChannelText: {
    fontFamily: 'NDOT57',
    fontSize: 13,
    color: GlyphColors.neonRed,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  pixelZoneText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#D0D0D8',
    marginTop: 2,
  },
  autoWalkBtn: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoWalkBtnActive: {
    backgroundColor: GlyphColors.neonRed,
    borderColor: GlyphColors.neonRed,
  },
  autoWalkBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  autoWalkBtnTextActive: {
    color: '#FFFFFF',
  },
  cardsGrid: {
    gap: 10,
  },
  hubCard: {
    padding: 0,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  cardTitle: {
    fontFamily: 'NDOT57',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  cardArrow: {
    fontFamily: 'NDOT57',
    fontSize: 16,
    color: '#8E8E93',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
});
