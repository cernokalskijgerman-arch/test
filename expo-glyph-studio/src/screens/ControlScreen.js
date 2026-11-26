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
 * Master Power, Master Brightness, Individual Arc Dimmers.
 * Compact layout optimized for zero vertical scrolling on >= 780dp screens.
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
  const isMasterOn = masterBrightness > 0 && brightness.some((b) => b > 0);
  const isMasterZero = masterBrightness === 0;

  const handleToggleMaster = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isMasterOn) {
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
      if (brightness.every((b) => b === 0)) {
        onAllOn && onAllOn(val);
      }
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
      <LiquidGlassCard compact={true} isActive={isMasterOn}>
        <View style={styles.masterRow}>
          <View style={styles.masterTitleRow}>
            <View style={[styles.statusDot, isMasterOn && styles.statusDotActive]} />
            <Text style={styles.masterTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {isMasterOn
                ? `ГЛИФ: ВКЛ (${Math.round((masterBrightness / 255) * 100)}%)`
                : 'ГЛИФ: ВЫКЛ (0%)'}
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: isMasterOn }}
            accessibilityLabel="Общее питание глифов"
            style={[styles.masterBtn, isMasterOn && styles.masterBtnActive]}
            onPress={handleToggleMaster}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.masterBtnText, isMasterOn && styles.masterBtnTextActive]}>
              {isMasterOn ? 'ВКЛ' : 'ВЫКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Master Brightness Slider */}
        <GlyphSlider
          compact={true}
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
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                onPress={() => setBrightnessPreset(item.val)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
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
        {isMasterZero && (
          <View style={styles.masterZeroBadge}>
            <Text style={styles.masterZeroBadgeText}>МАСТЕР 0%</Text>
          </View>
        )}
      </View>

      {/* ARC 0: TOP-LEFT */}
      <LiquidGlassCard
        compact={true}
        isActive={brightness[0] > 0 && !isMasterZero}
        style={isMasterZero ? styles.arcCardDimmed : undefined}
      >
        <View style={styles.arcCardHeader}>
          <View style={styles.arcInfo}>
            <View
              style={[styles.arcDot, brightness[0] > 0 && styles.arcDotActive]}
            />
            <Text style={styles.arcTitle}>ВЕРХ-ЛЕВО (20 LED)</Text>
            <Text
              style={[
                styles.arcPercent,
                brightness[0] > 10 && styles.arcPercentActive,
              ]}
            >
              {Math.round((brightness[0] / 255) * 100)}%
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: brightness[0] > 0 }}
            style={[styles.arcToggleBtn, brightness[0] > 0 && styles.arcToggleBtnActive]}
            onPress={() => onArcToggle && onArcToggle(0)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.arcToggleText,
                brightness[0] > 0 && styles.arcToggleTextActive,
              ]}
            >
              {brightness[0] > 0 ? 'ВКЛ' : 'ВЫКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          compact={true}
          value={brightness[0]}
          min={0}
          max={255}
          step={1}
          accentColor="#FFFFFF"
          onValueChange={(val) => onArcBrightnessChange && onArcBrightnessChange(0, val)}
        />
      </LiquidGlassCard>

      {/* ARC 1: BOTTOM-LEFT */}
      <LiquidGlassCard
        compact={true}
        isActive={brightness[1] > 0 && !isMasterZero}
        style={isMasterZero ? styles.arcCardDimmed : undefined}
      >
        <View style={styles.arcCardHeader}>
          <View style={styles.arcInfo}>
            <View
              style={[styles.arcDot, brightness[1] > 0 && styles.arcDotActive]}
            />
            <Text style={styles.arcTitle}>НИЗ-ЛЕВО (5 LED)</Text>
            <Text
              style={[
                styles.arcPercent,
                brightness[1] > 10 && styles.arcPercentActive,
              ]}
            >
              {Math.round((brightness[1] / 255) * 100)}%
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: brightness[1] > 0 }}
            style={[styles.arcToggleBtn, brightness[1] > 0 && styles.arcToggleBtnActive]}
            onPress={() => onArcToggle && onArcToggle(1)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.arcToggleText,
                brightness[1] > 0 && styles.arcToggleTextActive,
              ]}
            >
              {brightness[1] > 0 ? 'ВКЛ' : 'ВЫКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          compact={true}
          value={brightness[1]}
          min={0}
          max={255}
          step={1}
          accentColor="#FFFFFF"
          onValueChange={(val) => onArcBrightnessChange && onArcBrightnessChange(1, val)}
        />
      </LiquidGlassCard>

      {/* ARC 2: RIGHT */}
      <LiquidGlassCard
        compact={true}
        isActive={brightness[2] > 0 && !isMasterZero}
        style={isMasterZero ? styles.arcCardDimmed : undefined}
      >
        <View style={styles.arcCardHeader}>
          <View style={styles.arcInfo}>
            <View
              style={[styles.arcDot, brightness[2] > 0 && styles.arcDotActive]}
            />
            <Text style={styles.arcTitle}>ПРАВЫЙ (11 LED)</Text>
            <Text
              style={[
                styles.arcPercent,
                brightness[2] > 10 && styles.arcPercentActive,
              ]}
            >
              {Math.round((brightness[2] / 255) * 100)}%
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: brightness[2] > 0 }}
            style={[styles.arcToggleBtn, brightness[2] > 0 && styles.arcToggleBtnActive]}
            onPress={() => onArcToggle && onArcToggle(2)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.arcToggleText,
                brightness[2] > 0 && styles.arcToggleTextActive,
              ]}
            >
              {brightness[2] > 0 ? 'ВКЛ' : 'ВЫКЛ'}
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          compact={true}
          value={brightness[2]}
          min={0}
          max={255}
          step={1}
          accentColor="#FFFFFF"
          onValueChange={(val) => onArcBrightnessChange && onArcBrightnessChange(2, val)}
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
    paddingTop: 2,
    paddingBottom: 120,
    gap: 4,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#565666',
  },
  statusDotActive: {
    backgroundColor: GlyphColors.neonRed,
    shadowColor: GlyphColors.neonRed,
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  masterTitle: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.1,
    flexShrink: 1,
  },
  masterBtn: {
    minWidth: 50,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.38)',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 3.5,
  },
  masterBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  masterBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  masterBtnTextActive: {
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 2,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 3,
  },
  presetBtn: {
    flex: 1,
    minHeight: 28,
    justifyContent: 'center',
    paddingVertical: 3.5,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.60)',
    borderTopColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.20,
    shadowRadius: 4,
  },
  presetBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: GlyphColors.textSecondary,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    marginBottom: 1,
  },
  sectionHeader: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: GlyphColors.textSecondary,
    letterSpacing: 1.2,
  },
  masterZeroBadge: {
    backgroundColor: 'rgba(215, 25, 32, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 59, 0.55)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  masterZeroBadgeText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#FF7078',
    letterSpacing: 0.6,
  },
  arcCardDimmed: {
    opacity: 0.65,
  },
  arcCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
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
    backgroundColor: '#565666',
  },
  arcDotActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  arcTitle: {
    fontFamily: 'NDOT57',
    fontSize: 10.5,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  arcPercent: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: GlyphColors.textSecondary,
    letterSpacing: 0.8,
  },
  arcPercentActive: {
    color: '#FFFFFF',
  },
  arcToggleBtn: {
    minWidth: 50,
    minHeight: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  arcToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  arcToggleText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
  },
  arcToggleTextActive: {
    color: '#000000',
  },
});
