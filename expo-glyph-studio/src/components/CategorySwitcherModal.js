import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import LiquidGlassCard from './LiquidGlassCard';
import { GlyphColors } from '../theme/colors';

export default function CategorySwitcherModal({
  visible,
  categories = [],
  currentTab,
  onSelectTab,
  onClose,
  stats = {},
}) {
  const slideAnim = useRef(new Animated.Value(550)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 75,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 550,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Pull-down dismiss PanResponder for iOS sheet feel
  const handlePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          Haptics.selectionAsync().catch(() => {});
          onClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleSelect = (index) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectTab(index);
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 70 : 50}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </TouchableWithoutFeedback>

      <View style={styles.sheetWrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* iOS Grab Handle with pull-down gesture */}
          <View style={styles.handleContainer} {...handlePanResponder.panHandlers}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.70)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: 'rgba(14, 16, 24, 0.95)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1.2,
    borderTopColor: GlyphColors.glassSpecularTop,
    borderLeftColor: GlyphColors.glassSpecularLeft,
    borderRightColor: GlyphColors.glassSpecularRight,
    borderBottomColor: 'transparent',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.6,
        shadowRadius: 25,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  sheetTitle: {
    fontFamily: 'NDOT57',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  sheetSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#8E8E98',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  cardsList: {
    gap: 8,
    marginTop: 6,
  },
  categoryCard: {
    marginVertical: 2,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#404050',
    marginRight: 12,
  },
  categoryDotActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 8,
    shadowOpacity: 1,
  },
  categoryLabel: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#B0B0C0',
    letterSpacing: 1.5,
  },
  categoryLabelActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  categoryDesc: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#656575',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  statPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  statPillText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#707080',
    letterSpacing: 1,
  },
  statPillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
