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
 * Screen 1: «КОНТРОЛЬ»
 * Master Power, Master Brightness, Individual Arc Dimmers, and Quick Scenes.
 */
export default function ControlScreen({
  brightness = [255, 255, 255],
  masterBrightness = 255,
  onMasterBrightnessChange,
  onArcBrightnessChange,
  onArcToggle,
  onAllOn,
  onAllOff,
}) {
  const isAnyOn = brightness.some((b) => b > 0);

  const handleToggleMaster = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isAnyOn) {
      onAllOff && onAllOff();
    } else {
      const target = masterBrightness > 0 ? masterBrightness : 255;
      onAllOn && onAllOn(target);
    }
  };

  const setBrightnessPreset = (val) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (val === 0) {
      onAllOff && onAllOff();
    } else {
      onMasterBrightnessChange && onMasterBrightnessChange(val);
      onAllOn && onAllOn(val);
    }
  };

  const handleSceneSelect = (scene) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const b = masterBrightness > 0 ? masterBrightness : 255;
    if (scene === 'all') {
      onAllOn && onAllOn(b);
    } else if (scene === 'flash') {
      // Top-Left max, others off
      onArcBrightnessChange && onArcBrightnessChange(0, b);
      onArcBrightnessChange && onArcBrightnessChange(1, 0);
      onArcBrightnessChange && onArcBrightnessChange(2, 0);
    } else if (scene === 'invert') {
      // Invert current states
      const invTL = brightness[0] > 10 ? 0 : b;
      const invBL = brightness[1] > 10 ? 0 : b;
      const invR = brightness[2] > 10 ? 0 : b;
      onArcBrightnessChange && onArcBrightnessChange(0, invTL);
      onArcBrightnessChange && onArcBrightnessChange(1, invBL);
      onArcBrightnessChange && onArcBrightnessChange(2, invR);
    } else if (scene === 'dim') {
      const dimVal = 50;
      onMasterBrightnessChange && onMasterBrightnessChange(dimVal);
      onAllOn && onAllOn(dimVal);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================ */}
      {/* 1. MASTER POWER & MASTER BRIGHTNESS                          */}
      {/* ============================================================ */}
      <LiquidGlassCard>
        <View style={styles.masterRow}>
          <View style={styles.masterTitleRow}>
            <View style={[styles.statusDot, isAnyOn && styles.statusDotActive]} />
            <View>
              <Text style={styles.masterTitle}>
                {isAnyOn
                  ? `ГЛИФ: ВКЛ (${Math.round((masterBrightness / 255) * 100)}%)`
                  : 'ГЛИФ: ОТКЛЮЧЕН'}
              </Text>
              <Text style={styles.masterSubtitle}>
                Общее управление подсветкой камеры
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.masterBtn, isAnyOn && styles.masterBtnActive]}
            onPress={handleToggleMaster}
            activeOpacity={0.7}
          >
            <Text style={[styles.masterBtnText, isAnyOn && styles.masterBtnTextActive]}>
              {isAnyOn ? 'ОТКЛ' : 'ВКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Master Brightness Slider */}
        <GlyphSlider
          label="МАСТЕР-ЯРКОСТЬ"
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

        {/* Quick Power Presets */}
        <View style={styles.presetRow}>
          {[
            { label: '0%', val: 0 },
            { label: '25%', val: 64 },
            { label: '50%', val: 128 },
            { label: '75%', val: 192 },
            { label: '100%', val: 255 },
          ].map((item) => {
            const isSelected =
              item.val === 0
                ? masterBrightness === 0
                : Math.abs(masterBrightness - item.val) < 15;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                onPress={() => setBrightnessPreset(item.val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    isSelected && styles.presetBtnTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 2. INDIVIDUAL ARC CONTROLLERS (3 ARCS)                       */}
      {/* ============================================================ */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>ДУГИ СВЕЧЕНИЯ NOTHING</Text>
        <Text style={styles.sectionHeaderMeta}>3 независимых канала</Text>
      </View>

      {/* ARC 0: TOP-LEFT */}
      <LiquidGlassCard isActive={brightness[0] > 10}>
        <View style={styles.arcCardHeader}>
          <View style={styles.arcInfo}>
            <View
              style={[styles.arcDot, brightness[0] > 10 && styles.arcDotActive]}
            />
            <View>
              <Text style={styles.arcTitle}>ВЕРХ-ЛЕВО (20 LED)</Text>
              <Text style={styles.arcSubtitle}>
                Канал #0..19 • Дуга над оптикой (198°..239°)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.arcToggleBtn, brightness[0] > 10 && styles.arcToggleBtnActive]}
            onPress={() => onArcToggle && onArcToggle(0)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.arcToggleText,
                brightness[0] > 10 && styles.arcToggleTextActive,
              ]}
            >
              {brightness[0] > 10 ? 'ВКЛ' : 'ВЫКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          label="ЯРКОСТЬ ДУГИ"
          value={brightness[0]}
          min={0}
          max={255}
          step={1}
          displayValue={`${Math.round((brightness[0] / 255) * 100)}%`}
          accentColor="#FFFFFF"
          onValueChange={(val) => onArcBrightnessChange && onArcBrightnessChange(0, val)}
        />
      </LiquidGlassCard>

      {/* ARC 1: BOTTOM-LEFT */}
      <LiquidGlassCard isActive={brightness[1] > 10}>
        <View style={styles.arcCardHeader}>
          <View style={styles.arcInfo}>
            <View
              style={[styles.arcDot, brightness[1] > 10 && styles.arcDotActive]}
            />
            <View>
              <Text style={styles.arcTitle}>НИЗ-ЛЕВО (5 LED)</Text>
              <Text style={styles.arcSubtitle}>
                Канал #31..35 • Нижний сектор (134°..155°)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.arcToggleBtn, brightness[1] > 10 && styles.arcToggleBtnActive]}
            onPress={() => onArcToggle && onArcToggle(1)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.arcToggleText,
                brightness[1] > 10 && styles.arcToggleTextActive,
              ]}
            >
              {brightness[1] > 10 ? 'ВКЛ' : 'ВЫКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          label="ЯРКОСТЬ ДУГИ"
          value={brightness[1]}
          min={0}
          max={255}
          step={1}
          displayValue={`${Math.round((brightness[1] / 255) * 100)}%`}
          accentColor="#FFFFFF"
          onValueChange={(val) => onArcBrightnessChange && onArcBrightnessChange(1, val)}
        />
      </LiquidGlassCard>

      {/* ARC 2: RIGHT */}
      <LiquidGlassCard isActive={brightness[2] > 10}>
        <View style={styles.arcCardHeader}>
          <View style={styles.arcInfo}>
            <View
              style={[styles.arcDot, brightness[2] > 10 && styles.arcDotActive]}
            />
            <View>
              <Text style={styles.arcTitle}>ПРАВЫЙ (11 LED)</Text>
              <Text style={styles.arcSubtitle}>
                Канал #20..30 • Дуга перископа (-16°..32°)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.arcToggleBtn, brightness[2] > 10 && styles.arcToggleBtnActive]}
            onPress={() => onArcToggle && onArcToggle(2)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.arcToggleText,
                brightness[2] > 10 && styles.arcToggleTextActive,
              ]}
            >
              {brightness[2] > 10 ? 'ВКЛ' : 'ВЫКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          label="ЯРКОСТЬ ДУГИ"
          value={brightness[2]}
          min={0}
          max={255}
          step={1}
          displayValue={`${Math.round((brightness[2] / 255) * 100)}%`}
          accentColor="#FFFFFF"
          onValueChange={(val) => onArcBrightnessChange && onArcBrightnessChange(2, val)}
        />
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 3. LIGHTING SCENES                                           */}
      {/* ============================================================ */}
      <LiquidGlassCard>
        <Text style={styles.scenesTitle}>БЫСТРЫЕ СЦЕНЫ СВЕТА</Text>
        <View style={styles.scenesGrid}>
          <TouchableOpacity
            style={styles.sceneBtn}
            onPress={() => handleSceneSelect('all')}
            activeOpacity={0.7}
          >
            <Text style={styles.sceneBtnText}>ВСЕ ДУГИ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sceneBtn}
            onPress={() => handleSceneSelect('flash')}
            activeOpacity={0.7}
          >
            <Text style={styles.sceneBtnText}>ВСПЫШКА</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sceneBtn}
            onPress={() => handleSceneSelect('invert')}
            activeOpacity={0.7}
          >
            <Text style={styles.sceneBtnText}>ИНВЕРСИЯ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sceneBtn}
            onPress={() => handleSceneSelect('dim')}
            activeOpacity={0.7}
          >
            <Text style={styles.sceneBtnText}>МЯГКИЙ 20%</Text>
          </TouchableOpacity>
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
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444450',
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
    letterSpacing: 1.5,
  },
  masterSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E98',
    marginTop: 2,
  },
  masterBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
  },
  presetBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#8E8E98',
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionHeader: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#D0D0DC',
    letterSpacing: 1.5,
  },
  sectionHeaderMeta: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#70707E',
  },
  arcCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  arcInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  arcDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#40404C',
  },
  arcDotActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  arcTitle: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  arcSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#80808C',
    marginTop: 1,
  },
  arcToggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  arcToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  arcToggleText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
  },
  arcToggleTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  scenesTitle: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  scenesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  sceneBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  sceneBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
