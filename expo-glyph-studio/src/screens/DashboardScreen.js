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
import { GlyphColors } from '../theme/colors';

export default function DashboardScreen({
  brightness,
  onNavigateTab,
  onTriggerUtility,
  onAllOn,
  onAllOff,
}) {
  const isAnyOn = brightness.some((b) => b > 10);

  const handleToggleAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isAnyOn) {
      onAllOff();
    } else {
      onAllOn(255);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Master Toggle Bar */}
      <LiquidGlassCard style={styles.masterCard}>
        <View style={styles.masterRow}>
          <View style={styles.masterTitleRow}>
            <View style={[styles.statusDot, isAnyOn && styles.statusDotActive]} />
            <Text style={styles.masterTitle}>
              {isAnyOn ? 'GLYPH: ON' : 'GLYPH: OFF'}
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
      </LiquidGlassCard>

      {/* Mode Cards: Strictly short and simple titles WITHOUT explanations */}
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

      {/* Quick Actions */}
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
    paddingBottom: 24,
    gap: 12,
  },
  masterCard: {
    padding: 0,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 14,
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
