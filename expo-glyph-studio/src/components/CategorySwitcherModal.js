import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import LiquidGlassCard from './LiquidGlassCard';

/**
 * iOS-style Liquid Glass Category Switcher Bottom Sheet.
 * Implemented as an in-tree overlay to guarantee 100% crash-free,
 * freeze-free operation across Android and iOS in Expo Go (no OS Dialog Window collisions).
 */
export default function CategorySwitcherModal({
  visible,
  categories = [],
  currentTab,
  onSelectTab,
  onClose,
  stats = {},
}) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 13,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleSelect = (index) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectTab(index);
    onClose();
  };

  return (
    <View style={styles.overlayRoot} pointerEvents="auto">
      {/* Blurred Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 35}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Floating Sheet Container */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* BlurView for Liquid Glass Sheet */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 45 : 30}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

        {/* Specular physical reflection gradient sheen */}
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.22)',
            'rgba(255, 255, 255, 0.02)',
            'rgba(0, 0, 0, 0.42)',
          ]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Top edge chamfered specular rim highlight */}
        <View pointerEvents="none" style={styles.topRimHighlight} />

        {/* Grab Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handleBar} />
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.sheetTitle}>ПЕРЕКЛЮЧЕНИЕ КАТЕГОРИЙ</Text>
            <Text style={styles.sheetSubtitle}>Быстрый переход между разделами</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Category Cards List */}
        <View style={styles.cardsList}>
          {categories.map((cat) => {
            const isActive = currentTab === cat.id;
            const catStat = stats[cat.id];

            return (
              <LiquidGlassCard
                key={cat.id}
                isActive={isActive}
                onPress={() => handleSelect(cat.id)}
                style={styles.categoryCard}
              >
                <View style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    {/* Active indicator dot */}
                    <View
                      style={[
                        styles.categoryDot,
                        isActive && styles.categoryDotActive,
                      ]}
                    />
                    <View>
                      <Text
                        style={[
                          styles.categoryLabel,
                          isActive && styles.categoryLabelActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                      <Text style={styles.categoryDesc}>{cat.subtitle}</Text>
                    </View>
                  </View>

                  {/* Status Pill Badge */}
                  <View
                    style={[
                      styles.statPill,
                      isActive && styles.statPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statPillText,
                        isActive && styles.statPillTextActive,
                      ]}
                    >
                      {catStat || (isActive ? 'АКТИВЕН' : 'ОТКРЫТЬ')}
                    </Text>
                  </View>
                </View>
              </LiquidGlassCard>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheetContainer: {
    backgroundColor: 'rgba(14, 16, 24, 0.85)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  topRimHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  sheetTitle: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  sheetSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#8E8E98',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardsList: {
    gap: 6,
    marginTop: 4,
  },
  categoryCard: {
    marginVertical: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#404050',
    marginRight: 10,
  },
  categoryDotActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  categoryLabel: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#B0B0C0',
    letterSpacing: 1.2,
  },
  categoryLabelActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  categoryDesc: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#656575',
    marginTop: 1,
    letterSpacing: 0.4,
  },
  statPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  statPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.60)',
  },
  statPillText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#707080',
    letterSpacing: 0.8,
  },
  statPillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
