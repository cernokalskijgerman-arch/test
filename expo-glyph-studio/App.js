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
  const [isMatrixCollapsed, setIsMatrixCollapsed] = useState(false);

  const handleArcPress = useCallback((arcIndex) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBrightness((prev) => {
      const next = [...prev];
      next[arcIndex] = next[arcIndex] > 0 ? 0 : 255;
      return next;
    });
  }, []);

  const handleAllOn = useCallback((val = 255) => {
    setBrightness([val, val, val]);
  }, []);

  const handleAllOff = useCallback(() => {
    setBrightness([0, 0, 0]);
  }, []);

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
          <GlyphCameraSilhouette
            brightness={brightness}
            onArcPress={handleArcPress}
            size={240}
          />
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
