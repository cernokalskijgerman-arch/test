import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  SlidersHorizontal,
  Orbit,
  LayoutGrid,
  AudioLines,
  Wrench,
} from 'lucide-react-native';
import LiquidGlassCard from './LiquidGlassCard';
import { GlyphColors } from '../theme/colors';

const CATEGORY_ICONS = [
  SlidersHorizontal,
  Orbit,
  LayoutGrid,
  AudioLines,
  Wrench,
];

/**
 * iOS-style Liquid Glass Category Switcher Bottom Sheet.
 * Implemented as an in-tree overlay to guarantee 100% crash-free,
 * freeze-free operation across Android and iOS (no OS Dialog Window collisions).
 */
function CategorySwitcherModal({
  visible,
  categories = [],
  currentTab,
  onSelectTab,
  onClose,
  stats = {},
}) {
  const [shouldRender, setShouldRender] = React.useState(visible);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          slideAnim.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 75 || gs.vy > 0.6) {
          Haptics.selectionAsync().catch(() => {});
          onCloseRef.current?.();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 120,
            friction: 14,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 120,
          friction: 14,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
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
    } else if (shouldRender) {
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
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, shouldRender, fadeAnim, slideAnim]);

  if (!shouldRender) return null;

  const handleSelect = (index) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectTab(index);
    onClose();
  };

  return (
    <View style={styles.overlayRoot} pointerEvents={visible ? 'auto' : 'none'}>
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

        {/* Drag-to-close Grab Handle & Header */}
        <View {...sheetPanResponder.panHandlers}>
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.sheetTitle}>ПЕРЕКЛЮЧЕНИЕ РАЗДЕЛОВ</Text>
              <Text style={styles.sheetSubtitle}>Быстрый переход между режимами</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Закрыть меню разделов"
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Cards List */}
        <View style={styles.cardsList}>
          {categories.map((cat) => {
            const isActive = currentTab === cat.id;
            const catStat = stats[cat.id];
            const IconComponent = CATEGORY_ICONS[cat.id % CATEGORY_ICONS.length];

            return (
              <LiquidGlassCard
                key={cat.id}
                compact={true}
                isActive={isActive}
                onPress={() => handleSelect(cat.id)}
                style={styles.categoryCard}
              >
                <View style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                      {IconComponent && (
                        <IconComponent
                          size={16}
                          color={isActive ? '#FFFFFF' : GlyphColors.textSecondary}
                          strokeWidth={isActive ? 2.3 : 1.8}
                        />
                      )}
                    </View>
                    <View style={styles.categoryTextWrap}>
                      <Text
                        style={[
                          styles.categoryLabel,
                          isActive && styles.categoryLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {cat.label}
                      </Text>
                      <Text style={styles.categoryDesc} numberOfLines={1}>
                        {cat.subtitle}
                      </Text>
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
                      numberOfLines={1}
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
    backgroundColor: 'rgba(14, 16, 24, 0.88)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
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
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  titleBlock: {
    flex: 1,
    paddingRight: 8,
  },
  sheetTitle: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 1.4,
  },
  sheetSubtitle: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: GlyphColors.textTertiary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
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
    paddingVertical: 3,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconBoxActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.48)',
  },
  categoryTextWrap: {
    flex: 1,
  },
  categoryLabel: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#D2D2DF',
    letterSpacing: 1.1,
  },
  categoryLabelActive: {
    color: '#FFFFFF',
  },
  categoryDesc: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: GlyphColors.textTertiary,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  statPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  statPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  statPillText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: GlyphColors.textSecondary,
    letterSpacing: 0.7,
  },
  statPillTextActive: {
    color: '#FFFFFF',
  },
});

export default React.memo(CategorySwitcherModal);
