import React, { useState, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { GlyphColors } from './src/theme/colors';

import GlyphCameraSilhouette from './src/components/GlyphCameraSilhouette';
import DashboardScreen from './src/screens/DashboardScreen';
import SequencerScreen from './src/screens/SequencerScreen';
import VisualizerScreen from './src/screens/VisualizerScreen';
import UtilitiesScreen from './src/screens/UtilitiesScreen';
import ArcadeScreen from './src/screens/ArcadeScreen';

const TABS = [
  { id: 0, label: 'ХАБ' },
  { id: 1, label: 'СЕКВЕНСОР' },
  { id: 2, label: 'МУЗЫКА' },
  { id: 3, label: 'УТИЛИТЫ' },
  { id: 4, label: 'АРКАДА' },
];

export default function App() {
  // Load official Nothing NDOT 57 Font
  const [fontsLoaded] = useFonts({
    'NDOT57': require('./assets/fonts/Ndot57.otf'),
  });

  const [currentTab, setCurrentTab] = useState(0);
  // 3 Continuous White Glyph Arcs: [Top-Left, Bottom-Left, Right] (0..255)
  const [brightness, setBrightness] = useState([255, 255, 255]);
  const [masterBrightness, setMasterBrightness] = useState(255);
  const [activePixel, setActivePixel] = useState(null);
  const [isAutoWalk, setIsAutoWalk] = useState(false);
  const [autoWalkSpeed, setAutoWalkSpeed] = useState(80);
  const [isMatrixCollapsed, setIsMatrixCollapsed] = useState(false);

  const autoWalkSpeedRef = useRef(autoWalkSpeed);
  autoWalkSpeedRef.current = autoWalkSpeed;

  const isAutoWalkRef = useRef(isAutoWalk);
  isAutoWalkRef.current = isAutoWalk;

  const activePixelRef = useRef(activePixel);
  activePixelRef.current = activePixel;

  const masterBrightnessRef = useRef(masterBrightness);
  masterBrightnessRef.current = masterBrightness;

  const handleArcPress = useCallback((arcIndex) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBrightness((prev) => {
      const next = [...prev];
      const targetB = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      next[arcIndex] = next[arcIndex] > 0 ? 0 : targetB;
      return next;
    });
  }, []);

  // Master brightness handler with immediate 0-cutoff and recovery
  const handleMasterBrightnessChange = useCallback((newVal) => {
    setMasterBrightness(newVal);
    if (newVal <= 0) {
      setBrightness([0, 0, 0]);
      setActivePixel(null);
      if (isAutoWalkRef.current) {
        setIsAutoWalk(false);
      }
    } else {
      setBrightness([newVal, newVal, newVal]);
    }
  }, []);

  const handleAllOn = useCallback((val = 255) => {
    const target = val > 0 ? val : (masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255);
    setMasterBrightness(target);
    setBrightness([target, target, target]);
  }, []);

  const handleAllOff = useCallback(() => {
    setMasterBrightness(0);
    setBrightness([0, 0, 0]);
    setActivePixel(null);
    if (isAutoWalkRef.current) {
      setIsAutoWalk(false);
    }
  }, []);

  // Step-by-step pixel navigation
  const handleActivePixelChange = useCallback((pixelId) => {
    setActivePixel(pixelId);
    if (pixelId === null) {
      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      setBrightness([b, b, b]);
    } else {
      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      let arc = 0;
      if (pixelId >= 0 && pixelId <= 19) arc = 0; // Top-Left
      else if (pixelId >= 20 && pixelId <= 30) arc = 2; // Right
      else if (pixelId >= 31 && pixelId <= 35) arc = 1; // Bottom-Left
      const nextB = [0, 0, 0];
      nextB[arc] = b;
      setBrightness(nextB);
    }
  }, []);

  // Auto-walk toggle & circular stepper loop with dynamic speed
  const handleToggleAutoWalk = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsAutoWalk((prev) => !prev);
  }, []);

  // Real-time animation loop: uses autoWalkSpeedRef.current on every step for instant speed responsiveness
  useEffect(() => {
    if (!isAutoWalk) {
      return;
    }

    let isCancelled = false;
    let timerId = null;

    const runStep = () => {
      if (isCancelled || !isAutoWalkRef.current) return;

      const current = activePixelRef.current !== null ? activePixelRef.current : -1;
      const nextPixel = (current + 1) % 36;
      activePixelRef.current = nextPixel;
      setActivePixel(nextPixel);

      const b = masterBrightnessRef.current > 0 ? masterBrightnessRef.current : 255;
      let arc = 0;
      if (nextPixel >= 0 && nextPixel <= 19) arc = 0; // Top-Left
      else if (nextPixel >= 20 && nextPixel <= 30) arc = 2; // Right
      else if (nextPixel >= 31 && nextPixel <= 35) arc = 1; // Bottom-Left
      const nextB = [0, 0, 0];
      nextB[arc] = b;
      setBrightness(nextB);

      // Instantaneous speed adjustment from ref
      const currentSpeed = Math.max(20, autoWalkSpeedRef.current || 80);
      timerId = setTimeout(runStep, currentSpeed);
    };

    runStep();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [isAutoWalk]);

  const handleTabSwitch = (tabIndex) => {
    Haptics.selectionAsync().catch(() => {});
    setCurrentTab(tabIndex);
  };

  const handleTriggerQuickUtility = (type) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCurrentTab(3);
  };

  // Horizontal swipe between tabs
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 35 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          setCurrentTab((curr) => {
            const next = Math.min(curr + 1, TABS.length - 1);
            if (next !== curr) Haptics.selectionAsync().catch(() => {});
            return next;
          });
        } else if (gestureState.dx > 50) {
          setCurrentTab((curr) => {
            const next = Math.max(curr - 1, 0);
            if (next !== curr) Haptics.selectionAsync().catch(() => {});
            return next;
          });
        }
      },
    })
  ).current;

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  const isAnyOn = brightness.some((b) => b > 10);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.headerTitle}>GLYPH (STUDIO)</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.deviceTag}>PHONE (3A)</Text>
        </View>
      </View>

      {/* Persistent Floating Camera Module (NO phone body chassis) */}
      <View style={styles.simulatorContainer}>
        {!isMatrixCollapsed ? (
          <>
            <GlyphCameraSilhouette
              brightness={brightness}
              activePixel={activePixel}
              onArcPress={handleArcPress}
              size={220}
            />

            {/* 3 Quick Arc Toggles */}
            <View style={styles.arcPillRow}>
              <TouchableOpacity
                style={[styles.arcPill, brightness[0] > 10 && styles.arcPillActive]}
                onPress={() => handleArcPress(0)}
                activeOpacity={0.7}
              >
                <View style={[styles.arcPillDot, brightness[0] > 10 && styles.arcPillDotActive]} />
                <Text style={[styles.arcPillText, brightness[0] > 10 && styles.arcPillTextActive]}>
                  ВЕРХ-ЛЕВ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.arcPill, brightness[1] > 10 && styles.arcPillActive]}
                onPress={() => handleArcPress(1)}
                activeOpacity={0.7}
              >
                <View style={[styles.arcPillDot, brightness[1] > 10 && styles.arcPillDotActive]} />
                <Text style={[styles.arcPillText, brightness[1] > 10 && styles.arcPillTextActive]}>
                  НИЗ-ЛЕВ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.arcPill, brightness[2] > 10 && styles.arcPillActive]}
                onPress={() => handleArcPress(2)}
                activeOpacity={0.7}
              >
                <View style={[styles.arcPillDot, brightness[2] > 10 && styles.arcPillDotActive]} />
                <Text style={[styles.arcPillText, brightness[2] > 10 && styles.arcPillTextActive]}>
                  ПРАВЫЙ
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.collapsedBadgeRow}>
            <View style={[styles.collapsedDot, isAnyOn && styles.collapsedDotActive]} />
            <Text style={styles.collapsedText}>
              ГЛИФ: {isAnyOn ? 'СВЕЧЕНИЕ АКТИВНО' : 'ОТКЛЮЧЕНО'}
            </Text>
          </View>
        )}

        {/* Toggle to collapse/expand camera block */}
        <TouchableOpacity
          style={styles.collapseToggle}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setIsMatrixCollapsed((prev) => !prev);
          }}
          activeOpacity={0.6}
        >
          <Text style={styles.collapseToggleText}>
            {isMatrixCollapsed ? '▼ РАЗВЕРНУТЬ GLYPH' : '▲ СВЕРНУТЬ'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs (NDOT Font) */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isSelected = currentTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isSelected && styles.tabButtonActive]}
              onPress={() => handleTabSwitch(tab.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabText, isSelected && styles.tabTextActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active Screen View with Swipe Gestures */}
      <View style={styles.screenContainer} {...panResponder.panHandlers}>
        {currentTab === 0 && (
          <DashboardScreen
            brightness={brightness}
            masterBrightness={masterBrightness}
            onMasterBrightnessChange={handleMasterBrightnessChange}
            activePixel={activePixel}
            onActivePixelChange={handleActivePixelChange}
            isAutoWalk={isAutoWalk}
            onToggleAutoWalk={handleToggleAutoWalk}
            autoWalkSpeed={autoWalkSpeed}
            onAutoWalkSpeedChange={setAutoWalkSpeed}
            onNavigateTab={handleTabSwitch}
            onTriggerUtility={handleTriggerQuickUtility}
            onAllOn={handleAllOn}
            onAllOff={handleAllOff}
          />
        )}
        {currentTab === 1 && (
          <SequencerScreen
            brightness={brightness}
            onBrightnessChange={setBrightness}
          />
        )}
        {currentTab === 2 && (
          <VisualizerScreen
            brightness={brightness}
            onBrightnessChange={setBrightness}
          />
        )}
        {currentTab === 3 && (
          <UtilitiesScreen
            brightness={brightness}
            onBrightnessChange={setBrightness}
          />
        )}
        {currentTab === 4 && (
          <ArcadeScreen
            brightness={brightness}
            onBrightnessChange={setBrightness}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'android' ? 32 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GlyphColors.neonRed,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: 'NDOT57',
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  headerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deviceTag: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  simulatorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  arcPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 16,
  },
  arcPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  arcPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  arcPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444450',
    marginRight: 6,
  },
  arcPillDotActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 5,
    shadowOpacity: 1,
  },
  arcPillText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#777785',
    letterSpacing: 1,
  },
  arcPillTextActive: {
    color: '#FFFFFF',
  },
  collapsedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  collapsedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#555555',
    marginRight: 8,
  },
  collapsedDotActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  collapsedText: {
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  collapseToggle: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 2,
  },
  collapseToggleText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#666666',
    letterSpacing: 1,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tabText: {
    fontFamily: 'NDOT57',
    fontSize: 10,
    color: '#8E8E93',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: '#000000',
    fontFamily: 'NDOT57',
  },
  screenContainer: {
    flex: 1,
  },
});
