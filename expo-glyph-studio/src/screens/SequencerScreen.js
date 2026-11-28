import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Play, Square } from 'lucide-react-native';
import LiquidGlassCard from '../components/LiquidGlassCard';
import GlyphSlider from '../components/GlyphSlider';
import { GlyphColors } from '../theme/colors';

const STEP_COUNT = 8;
const MIN_BPM = 40;
const MAX_BPM = 260;

const PRESETS = {
  cyber: {
    name: 'CYBER',
    topleft:    [1, 0, 0, 1, 0, 0, 1, 0],
    bottomleft: [0, 0, 1, 0, 0, 1, 0, 0],
    right:      [1, 0, 1, 0, 1, 0, 1, 0],
    bpm: 128,
  },
  heartbeat: {
    name: 'PULSE',
    topleft:    [1, 1, 0, 0, 1, 1, 0, 0],
    bottomleft: [1, 1, 0, 0, 1, 1, 0, 0],
    right:      [1, 1, 0, 0, 1, 1, 0, 0],
    bpm: 90,
  },
  strobe: {
    name: 'STROBE',
    topleft:    [1, 0, 1, 0, 1, 0, 1, 0],
    bottomleft: [0, 1, 0, 1, 0, 1, 0, 1],
    right:      [1, 0, 0, 0, 1, 0, 0, 0],
    bpm: 140,
  },
  techno: {
    name: 'TECHNO',
    topleft:    [1, 0, 0, 0, 1, 0, 0, 0],
    bottomleft: [0, 0, 1, 0, 0, 0, 1, 0],
    right:      [0, 1, 0, 1, 0, 1, 0, 1],
    bpm: 134,
  },
  echo: {
    name: 'ECHO',
    topleft:    [1, 0, 0, 0, 0, 1, 0, 0],
    bottomleft: [0, 0, 1, 0, 0, 0, 0, 1],
    right:      [0, 0, 0, 0, 1, 0, 0, 0],
    bpm: 110,
  },
};

const TRACK_CONFIG = [
  { key: 'topleft', label: 'В-ЛЕВО', color: '#FFFFFF' },
  { key: 'bottomleft', label: 'Н-ЛЕВО', color: '#FFFFFF' },
  { key: 'right', label: 'ПРАВО', color: '#FFFFFF' },
];

const BPM_QUICK_PRESETS = [80, 110, 128, 140, 175];

const nowMs = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const clampNum = (val, min, max, fallback) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
};

const sanitizeTrackArray = (arr) => {
  const out = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    out.push(Array.isArray(arr) && arr[i] ? 1 : 0);
  }
  return out;
};

const sanitizeTracks = (rawTracks) => {
  const src = rawTracks && typeof rawTracks === 'object' ? rawTracks : {};
  return {
    topleft: sanitizeTrackArray(src.topleft ?? PRESETS.cyber.topleft),
    bottomleft: sanitizeTrackArray(src.bottomleft ?? PRESETS.cyber.bottomleft),
    right: sanitizeTrackArray(src.right ?? PRESETS.cyber.right),
  };
};

const sanitizeTrackLevels = (rawLevels) => {
  const src = rawLevels && typeof rawLevels === 'object' ? rawLevels : {};
  return {
    topleft: clampNum(src.topleft, 0, 100, 100),
    bottomleft: clampNum(src.bottomleft, 0, 100, 100),
    right: clampNum(src.right, 0, 100, 100),
  };
};

const cloneSlotData = (slot) => {
  if (!slot || typeof slot !== 'object') return null;
  return {
    tracks: sanitizeTracks(slot.tracks),
    bpm: clampNum(slot.bpm, MIN_BPM, MAX_BPM, 128),
    stepIntensity: clampNum(slot.stepIntensity, 0, 100, 100),
    trackLevels: sanitizeTrackLevels(slot.trackLevels),
    pixelMode: slot.pixelMode === 'pixels' ? 'pixels' : 'arcs',
    gatePct: clampNum(slot.gatePct, 20, 100, 75),
    swingPct: clampNum(slot.swingPct, 0, 60, 0),
  };
};

const createInitialState = (savedState, fallbackState) => {
  const src = savedState && typeof savedState === 'object'
    ? savedState
    : (fallbackState && typeof fallbackState === 'object' ? fallbackState : null);

  if (!src) {
    return {
      tracks: sanitizeTracks(PRESETS.cyber),
      bpm: PRESETS.cyber.bpm,
      activePreset: 'cyber',
      stepIntensity: 100,
      trackLevels: { topleft: 100, bottomleft: 100, right: 100 },
      pixelMode: 'arcs',
      gatePct: 75,
      swingPct: 0,
      customSlot: null,
      customSlots: { my1: null, my2: null },
    };
  }

  return {
    tracks: sanitizeTracks(src.tracks),
    bpm: clampNum(src.bpm, MIN_BPM, MAX_BPM, 128),
    activePreset: src.activePreset !== undefined ? src.activePreset : 'cyber',
    stepIntensity: clampNum(src.stepIntensity, 0, 100, 100),
    trackLevels: sanitizeTrackLevels(src.trackLevels),
    pixelMode: src.pixelMode === 'pixels' ? 'pixels' : 'arcs',
    gatePct: clampNum(src.gatePct, 20, 100, 75),
    swingPct: clampNum(src.swingPct, 0, 60, 0),
    customSlot: src.customSlot === 'my1' || src.customSlot === 'my2' ? src.customSlot : null,
    customSlots: {
      my1: cloneSlotData(src.customSlots?.my1),
      my2: cloneSlotData(src.customSlots?.my2),
    },
  };
};

// Session-level fallback store in case parent does not supply savedState / onSaveState
let sessionSequencerFallback = null;

/**
 * Compute swung step duration in ms for a given step index (0..7), BPM, and Swing (0..60%).
 * Keeps paired 2-step duration invariant so average tempo stays locked to BPM.
 */
const computeStepMs = (stepIndex, bpm, swingPct) => {
  const safeBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm || 128));
  const baseStepMs = (60000 / safeBpm) / 4;
  const swingFactor = (Math.max(0, Math.min(60, swingPct || 0)) / 100) * 0.6;
  return stepIndex % 2 === 0
    ? baseStepMs * (1 + swingFactor)
    : baseStepMs * (1 - swingFactor);
};

/**
 * Build 36-LED wave levels for pixel sequencer mode.
 * Arc mapping on Nothing Phone (3a Pro):
 *  - Top-Left: #0..19 (20 LEDs)
 *  - Right: #20..30 (11 LEDs)
 *  - Bottom-Left: #31..35 (5 LEDs)
 */
const buildPixelWaveLevels = (step, tlLevel, blLevel, rLevel) => {
  const levels = new Array(36).fill(0);
  const progress = step / Math.max(1, STEP_COUNT - 1);

  if (tlLevel > 0) {
    const centerTL = progress * 19;
    for (let i = 0; i <= 19; i++) {
      const dist = Math.abs(i - centerTL);
      if (dist <= 3.6) {
        levels[i] = Math.min(1, Math.max(0.18, 1 - dist / 4.2) * tlLevel);
      }
    }
  }

  if (rLevel > 0) {
    const centerR = 20 + progress * 10;
    for (let i = 20; i <= 30; i++) {
      const dist = Math.abs(i - centerR);
      if (dist <= 2.3) {
        levels[i] = Math.min(1, Math.max(0.22, 1 - dist / 2.7) * rLevel);
      }
    }
  }

  if (blLevel > 0) {
    const centerBL = 31 + progress * 4;
    for (let i = 31; i <= 35; i++) {
      const dist = Math.abs(i - centerBL);
      if (dist <= 1.4) {
        levels[i] = Math.min(1, Math.max(0.30, 1 - dist / 1.8) * blLevel);
      }
    }
  }

  return levels;
};

/**
 * Screen 3: «СЕКВЕНСОР» (Матрица полей)
 * Responsive 8-step rhythmic pattern matrix across all 3 Glyph arcs or 36 micro-LEDs.
 */
function SequencerScreen({
  brightness,
  onBrightnessChange,
  onPixelLevelsChange,
  onEnsurePowerOn,
  savedState,
  onSaveState,
}) {
  const initialRef = useRef(null);
  if (initialRef.current === null) {
    initialRef.current = createInitialState(savedState, sessionSequencerFallback);
  }
  const init = initialRef.current;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(init.bpm);
  const [activePreset, setActivePreset] = useState(init.activePreset);
  const [tracks, setTracks] = useState(init.tracks);
  const [stepIntensity, setStepIntensity] = useState(init.stepIntensity);
  const [trackLevels, setTrackLevels] = useState(init.trackLevels);
  const [pixelMode, setPixelMode] = useState(init.pixelMode);
  const [gatePct, setGatePct] = useState(init.gatePct);
  const [swingPct, setSwingPct] = useState(init.swingPct);
  const [customSlot, setCustomSlot] = useState(init.customSlot);
  const [customSlots, setCustomSlots] = useState(init.customSlots);
  const [saveFeedback, setSaveFeedback] = useState(null);

  // Always-fresh callback refs
  const onBrightnessChangeRef = useRef(onBrightnessChange);
  onBrightnessChangeRef.current = onBrightnessChange;
  const onPixelLevelsChangeRef = useRef(onPixelLevelsChange);
  onPixelLevelsChangeRef.current = onPixelLevelsChange;
  const onEnsurePowerOnRef = useRef(onEnsurePowerOn);
  onEnsurePowerOnRef.current = onEnsurePowerOn;
  const onSaveStateRef = useRef(onSaveState);
  onSaveStateRef.current = onSaveState;

  // Live playback refs (prevent timer teardown/restarts during live edits)
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const intensityRef = useRef(stepIntensity);
  intensityRef.current = stepIntensity;
  const trackLevelsRef = useRef(trackLevels);
  trackLevelsRef.current = trackLevels;
  const pixelModeRef = useRef(pixelMode);
  pixelModeRef.current = pixelMode;
  const gateRef = useRef(gatePct);
  gateRef.current = gatePct;
  const swingRef = useRef(swingPct);
  swingRef.current = swingPct;

  const currentStepRef = useRef(0);
  const lastStepIndexRef = useRef(0);
  const lastStepTimeRef = useRef(0);
  const lastStepHasOutputRef = useRef(false);
  const lastStepGatedOutRef = useRef(false);
  const nextStepTimeRef = useRef(0);
  const stepTimerRef = useRef(null);
  const gateTimerRef = useRef(null);
  const lastOutputModeRef = useRef(null);
  const bpmHoldTimeoutRef = useRef(null);
  const bpmHoldIntervalRef = useRef(null);
  const saveFeedbackTimerRef = useRef(null);

  // Authoritative snapshot for synchronous persistence across rapid edits / unmounts
  const persistedRef = useRef({
    tracks: init.tracks,
    bpm: init.bpm,
    activePreset: init.activePreset,
    stepIntensity: init.stepIntensity,
    trackLevels: init.trackLevels,
    pixelMode: init.pixelMode,
    gatePct: init.gatePct,
    swingPct: init.swingPct,
    customSlot: init.customSlot,
    customSlots: init.customSlots,
  });

  const persistUpdate = useCallback((patch) => {
    const next = { ...persistedRef.current, ...patch };
    persistedRef.current = next;
    sessionSequencerFallback = next;
    onSaveStateRef.current?.(next);
  }, []);

  const clearPlaybackTimers = useCallback(() => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (gateTimerRef.current) {
      clearTimeout(gateTimerRef.current);
      gateTimerRef.current = null;
    }
  }, []);

  const stopBpmHold = useCallback(() => {
    if (bpmHoldTimeoutRef.current) {
      clearTimeout(bpmHoldTimeoutRef.current);
      bpmHoldTimeoutRef.current = null;
    }
    if (bpmHoldIntervalRef.current) {
      clearInterval(bpmHoldIntervalRef.current);
      bpmHoldIntervalRef.current = null;
    }
  }, []);

  const extinguishHardware = useCallback(() => {
    onPixelLevelsChangeRef.current?.(null);
    onBrightnessChangeRef.current?.([0, 0, 0]);
    lastOutputModeRef.current = null;
  }, []);

  const triggerGateBlackout = useCallback(() => {
    if (!isPlayingRef.current) return;
    lastStepGatedOutRef.current = true;
    gateTimerRef.current = null;
    if (pixelModeRef.current === 'pixels') {
      onPixelLevelsChangeRef.current?.(new Array(36).fill(0));
    } else {
      onBrightnessChangeRef.current?.([0, 0, 0]);
    }
  }, []);

  const scheduleTick = useCallback(() => {
    if (!isPlayingRef.current) return;

    if (gateTimerRef.current) {
      clearTimeout(gateTimerRef.current);
      gateTimerRef.current = null;
    }

    const step = ((currentStepRef.current % STEP_COUNT) + STEP_COUNT) % STEP_COUNT;
    const curTracks = tracksRef.current;
    const curBpm = bpmRef.current;
    const curGate = gateRef.current;
    const curSwing = swingRef.current;
    const masterScale = Math.max(0, Math.min(1, intensityRef.current / 100));
    const curTrackLevels = trackLevelsRef.current;
    const curPixelMode = pixelModeRef.current;

    const tlLevel = curTracks.topleft[step] ? masterScale * (curTrackLevels.topleft / 100) : 0;
    const blLevel = curTracks.bottomleft[step] ? masterScale * (curTrackLevels.bottomleft / 100) : 0;
    const rLevel = curTracks.right[step] ? masterScale * (curTrackLevels.right / 100) : 0;

    if (curPixelMode === 'pixels') {
      lastOutputModeRef.current = 'pixels';
      const levels = buildPixelWaveLevels(step, tlLevel, blLevel, rLevel);
      onPixelLevelsChangeRef.current?.(levels);
    } else {
      if (lastOutputModeRef.current !== 'arcs') {
        onPixelLevelsChangeRef.current?.(null);
        lastOutputModeRef.current = 'arcs';
      }
      onBrightnessChangeRef.current?.([
        Math.round(tlLevel * 255),
        Math.round(blLevel * 255),
        Math.round(rLevel * 255),
      ]);
    }

    setCurrentStep(step);

    const stepDurationMs = computeStepMs(step, curBpm, curSwing);
    const now = nowMs();
    const hasActiveOutput = tlLevel > 0 || blLevel > 0 || rLevel > 0;
    lastStepIndexRef.current = step;
    lastStepTimeRef.current = now;
    lastStepHasOutputRef.current = hasActiveOutput;
    lastStepGatedOutRef.current = false;

    // Schedule real Gate blackout between steps (unless legato >= 98%)
    if (curGate < 98 && hasActiveOutput) {
      const gateOnMs = Math.max(12, Math.round(stepDurationMs * (curGate / 100)));
      if (gateOnMs < stepDurationMs - 8) {
        gateTimerRef.current = setTimeout(triggerGateBlackout, gateOnMs);
      }
    }

    currentStepRef.current = (step + 1) % STEP_COUNT;

    if (nextStepTimeRef.current === 0) {
      nextStepTimeRef.current = now;
    }
    nextStepTimeRef.current += stepDurationMs;

    // Resync monotonically if JS event loop experienced a pause > 1 step
    if (nextStepTimeRef.current < now - stepDurationMs) {
      nextStepTimeRef.current = now + Math.max(8, Math.round(stepDurationMs));
    }

    const delay = Math.max(8, Math.round(nextStepTimeRef.current - now));
    stepTimerRef.current = setTimeout(scheduleTick, delay);
  }, [triggerGateBlackout]);

  // Dynamically recalculate BOTH pending step timer and active gate timer when BPM/Swing/Gate changes mid-step
  const reschedulePendingStep = useCallback(() => {
    if (!isPlayingRef.current) return;
    const now = nowMs();
    const stepDurationMs = computeStepMs(lastStepIndexRef.current, bpmRef.current, swingRef.current);

    if (gateTimerRef.current) {
      clearTimeout(gateTimerRef.current);
      gateTimerRef.current = null;
    }

    if (lastStepHasOutputRef.current && !lastStepGatedOutRef.current && gateRef.current < 98) {
      const newGateOnMs = Math.max(12, Math.round(stepDurationMs * (gateRef.current / 100)));
      if (newGateOnMs < stepDurationMs - 8) {
        const gateRemainingMs = Math.round(lastStepTimeRef.current + newGateOnMs - now);
        if (gateRemainingMs <= 0) {
          triggerGateBlackout();
        } else {
          gateTimerRef.current = setTimeout(triggerGateBlackout, gateRemainingMs);
        }
      }
    }

    if (!stepTimerRef.current) return;
    clearTimeout(stepTimerRef.current);
    stepTimerRef.current = null;

    const targetNext = lastStepTimeRef.current + stepDurationMs;
    nextStepTimeRef.current = targetNext;

    if (targetNext <= now) {
      nextStepTimeRef.current = now;
      scheduleTick();
    } else {
      const delay = Math.max(8, Math.round(targetNext - now));
      stepTimerRef.current = setTimeout(scheduleTick, delay);
    }
  }, [scheduleTick, triggerGateBlackout]);

  // Playback lifecycle: ONLY starts/stops on isPlaying toggle (never resets on BPM or edits)
  useEffect(() => {
    if (!isPlaying) {
      clearPlaybackTimers();
      extinguishHardware();
      return;
    }

    onEnsurePowerOnRef.current?.();
    currentStepRef.current = 0;
    nextStepTimeRef.current = nowMs();
    lastOutputModeRef.current = null;
    scheduleTick();

    return () => {
      clearPlaybackTimers();
      extinguishHardware();
    };
  }, [isPlaying, clearPlaybackTimers, extinguishHardware, scheduleTick]);

  // Final cleanup on unmount without wiping saved patterns
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      clearPlaybackTimers();
      stopBpmHold();
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
        saveFeedbackTimerRef.current = null;
      }
      extinguishHardware();
    };
  }, [clearPlaybackTimers, stopBpmHold, extinguishHardware]);

  const applyBpm = useCallback((valueOrDelta, isDelta = false) => {
    const base = bpmRef.current;
    const raw = isDelta ? base + valueOrDelta : valueOrDelta;
    const next = clampNum(raw, MIN_BPM, MAX_BPM, base);
    if (next === base) return;
    bpmRef.current = next;
    setBpm(next);
    persistUpdate({ bpm: next });
    reschedulePendingStep();
  }, [persistUpdate, reschedulePendingStep]);

  const startBpmHold = useCallback((delta) => {
    stopBpmHold();
    applyBpm(delta, true);
    bpmHoldTimeoutRef.current = setTimeout(() => {
      bpmHoldIntervalRef.current = setInterval(() => {
        applyBpm(delta * 2, true);
      }, 65);
    }, 320);
  }, [applyBpm, stopBpmHold]);

  const toggleStep = (trackName, index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const cur = tracksRef.current;
    const nextTracks = {
      ...cur,
      [trackName]: cur[trackName].map((v, i) => (i === index ? (v ? 0 : 1) : v)),
    };
    tracksRef.current = nextTracks;
    setTracks(nextTracks);
    setActivePreset('custom');
    persistUpdate({ tracks: nextTracks, activePreset: 'custom' });
  };

  const cycleTrackLevel = (trackName) => {
    Haptics.selectionAsync().catch(() => {});
    const cur = trackLevelsRef.current;
    const currentLvl = cur[trackName] ?? 100;
    const nextLvl = currentLvl >= 95 ? 65 : currentLvl >= 60 ? 35 : currentLvl > 0 ? 0 : 100;
    const nextLevels = { ...cur, [trackName]: nextLvl };
    trackLevelsRef.current = nextLevels;
    setTrackLevels(nextLevels);
    persistUpdate({ trackLevels: nextLevels });
  };

  const loadPreset = (presetKey) => {
    Haptics.selectionAsync().catch(() => {});
    const p = PRESETS[presetKey];
    if (!p) return;

    const nextTracks = {
      topleft: sanitizeTrackArray((p.topleft || []).slice(0, STEP_COUNT)),
      bottomleft: sanitizeTrackArray((p.bottomleft || []).slice(0, STEP_COUNT)),
      right: sanitizeTrackArray((p.right || []).slice(0, STEP_COUNT)),
    };
    const nextBpm = clampNum(p.bpm, MIN_BPM, MAX_BPM, bpmRef.current);

    tracksRef.current = nextTracks;
    bpmRef.current = nextBpm;
    setTracks(nextTracks);
    setBpm(nextBpm);
    setActivePreset(presetKey);
    setCustomSlot(null);
    persistUpdate({
      tracks: nextTracks,
      bpm: nextBpm,
      activePreset: presetKey,
      customSlot: null,
    });
    reschedulePendingStep();
  };

  const clearAll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const emptyTracks = {
      topleft: new Array(STEP_COUNT).fill(0),
      bottomleft: new Array(STEP_COUNT).fill(0),
      right: new Array(STEP_COUNT).fill(0),
    };
    tracksRef.current = emptyTracks;
    setTracks(emptyTracks);
    setActivePreset(null);
    setCustomSlot(null);
    persistUpdate({
      tracks: emptyTracks,
      activePreset: null,
      customSlot: null,
    });

    if (pixelModeRef.current === 'pixels' && isPlayingRef.current) {
      onPixelLevelsChangeRef.current?.(new Array(36).fill(0));
    } else {
      onPixelLevelsChangeRef.current?.(null);
      onBrightnessChangeRef.current?.([0, 0, 0]);
    }
  };

  const saveToCustomSlot = (slotKey) => {
    const targetSlot = slotKey === 'my2' ? 'my2' : 'my1';
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const snapshot = {
      tracks: sanitizeTracks(tracksRef.current),
      bpm: bpmRef.current,
      stepIntensity: intensityRef.current,
      trackLevels: sanitizeTrackLevels(trackLevelsRef.current),
      pixelMode: pixelModeRef.current,
      gatePct: gateRef.current,
      swingPct: swingRef.current,
    };
    const nextSlots = {
      ...persistedRef.current.customSlots,
      [targetSlot]: snapshot,
    };
    setCustomSlots(nextSlots);
    setCustomSlot(targetSlot);
    setActivePreset(targetSlot);
    persistUpdate({
      customSlots: nextSlots,
      customSlot: targetSlot,
      activePreset: targetSlot,
    });

    if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
    setSaveFeedback(targetSlot === 'my1' ? 'СОХРАНЕНО: МОЙ 1' : 'СОХРАНЕНО: МОЙ 2');
    saveFeedbackTimerRef.current = setTimeout(() => {
      setSaveFeedback(null);
      saveFeedbackTimerRef.current = null;
    }, 1400);
  };

  const handleSelectCustomSlot = (slotKey) => {
    Haptics.selectionAsync().catch(() => {});
    const slotData = persistedRef.current.customSlots?.[slotKey];
    if (!slotData) {
      setCustomSlot(slotKey);
      persistUpdate({ customSlot: slotKey });
      return;
    }
    const clean = cloneSlotData(slotData);
    tracksRef.current = clean.tracks;
    bpmRef.current = clean.bpm;
    intensityRef.current = clean.stepIntensity;
    trackLevelsRef.current = clean.trackLevels;
    pixelModeRef.current = clean.pixelMode;
    gateRef.current = clean.gatePct;
    swingRef.current = clean.swingPct;

    setTracks(clean.tracks);
    setBpm(clean.bpm);
    setStepIntensity(clean.stepIntensity);
    setTrackLevels(clean.trackLevels);
    setPixelMode(clean.pixelMode);
    setGatePct(clean.gatePct);
    setSwingPct(clean.swingPct);
    setCustomSlot(slotKey);
    setActivePreset(slotKey);

    persistUpdate({
      ...clean,
      customSlot: slotKey,
      activePreset: slotKey,
    });
    reschedulePendingStep();
  };

  const handlePixelModeChange = (mode) => {
    Haptics.selectionAsync().catch(() => {});
    if (mode === pixelModeRef.current) return;
    pixelModeRef.current = mode;
    setPixelMode(mode);
    persistUpdate({ pixelMode: mode });
    if (isPlayingRef.current) {
      if (mode === 'arcs') {
        onPixelLevelsChangeRef.current?.(null);
        lastOutputModeRef.current = 'arcs';
      } else {
        onBrightnessChangeRef.current?.([0, 0, 0]);
        lastOutputModeRef.current = 'pixels';
      }
    }
  };

  const handleIntensityChange = (val) => {
    const next = clampNum(val, 0, 100, 100);
    intensityRef.current = next;
    setStepIntensity(next);
    persistUpdate({ stepIntensity: next });
  };

  const handleGateChange = (val) => {
    const next = clampNum(val, 20, 100, 75);
    gateRef.current = next;
    setGatePct(next);
    persistUpdate({ gatePct: next });
    reschedulePendingStep();
  };

  const handleSwingChange = (val) => {
    const next = clampNum(val, 0, 60, 0);
    swingRef.current = next;
    setSwingPct(next);
    persistUpdate({ swingPct: next });
    reschedulePendingStep();
  };

  const targetSaveSlot = customSlot === 'my2' ? 'my2' : 'my1';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* ============================================================ */}
      {/* 1. COMPACT TRANSPORT, BPM & PRESETS BAR                      */}
      {/* ============================================================ */}
      <LiquidGlassCard isActive={isPlaying} compact style={styles.topCard}>
        <View style={styles.transportRow}>
          {/* Play / Stop Button */}
          <TouchableOpacity
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setIsPlaying((p) => !p);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.btnIconRow}>
              {isPlaying ? (
                <Square size={9} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={10} color="#FFFFFF" fill="#FFFFFF" />
              )}
              <Text style={[styles.playBtnText, isPlaying && styles.playBtnTextActive]} numberOfLines={1}>
                {isPlaying ? 'СТОП' : 'ПУСК'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Compact BPM Stepper (40..260, tap +-2, long-press accelerate) */}
          <View style={styles.bpmBox}>
            <TouchableOpacity
              style={styles.bpmArrowBtn}
              onPressIn={() => startBpmHold(-2)}
              onPressOut={stopBpmHold}
              activeOpacity={0.6}
            >
              <Text style={styles.bpmArrowText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.bpmValueText} numberOfLines={1}>{bpm} BPM</Text>
            <TouchableOpacity
              style={styles.bpmArrowBtn}
              onPressIn={() => startBpmHold(2)}
              onPressOut={stopBpmHold}
              activeOpacity={0.6}
            >
              <Text style={styles.bpmArrowText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Step Indicator */}
          <View style={styles.stepCounterBox}>
            <Text style={styles.stepCounterText} numberOfLines={1}>
              {isPlaying ? `${currentStep + 1}/8` : '8 ШАГОВ'}
            </Text>
          </View>

          {/* Clear Button */}
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll} activeOpacity={0.7}>
            <Text style={styles.clearBtnText} numberOfLines={1}>СБРОС</Text>
          </TouchableOpacity>
        </View>

        {/* Quick BPM Chips */}
        <View style={styles.bpmQuickRow}>
          {BPM_QUICK_PRESETS.map((presetBpm) => {
            const isSel = bpm === presetBpm;
            return (
              <TouchableOpacity
                key={presetBpm}
                style={[styles.bpmChip, isSel && styles.bpmChipActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  applyBpm(presetBpm, false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.bpmChipText, isSel && styles.bpmChipTextActive]} numberOfLines={1}>
                  {presetBpm}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Factory Presets Row */}
        <View style={styles.presetsRow}>
          {Object.keys(PRESETS).map((key) => {
            const p = PRESETS[key];
            const isSelected = activePreset === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                onPress={() => loadPreset(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetBtnText, isSelected && styles.presetBtnTextActive]} numberOfLines={1}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom User Pattern Slots Row */}
        <View style={styles.userSlotsRow}>
          {[
            { key: 'my1', label: 'МОЙ 1' },
            { key: 'my2', label: 'МОЙ 2' },
          ].map((slot) => {
            const hasSaved = Boolean(customSlots[slot.key]);
            const isSelected = customSlot === slot.key || activePreset === slot.key;
            return (
              <TouchableOpacity
                key={slot.key}
                style={[styles.slotBtn, isSelected && styles.slotBtnActive]}
                onPress={() => handleSelectCustomSlot(slot.key)}
                onLongPress={() => saveToCustomSlot(slot.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.slotDot, hasSaved && styles.slotDotFilled]} />
                <Text style={[styles.slotBtnText, isSelected && styles.slotBtnTextActive]} numberOfLines={1}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.saveSlotBtn, saveFeedback && styles.saveSlotBtnSuccess]}
            onPress={() => saveToCustomSlot(targetSaveSlot)}
            activeOpacity={0.7}
          >
            <Text style={styles.saveSlotBtnText} numberOfLines={1}>
              {saveFeedback || `СОХР. В ${targetSaveSlot === 'my2' ? 'МОЙ 2' : 'МОЙ 1'}`}
            </Text>
          </TouchableOpacity>

          {activePreset === 'custom' && (
            <View style={styles.modifiedBadge}>
              <Text style={styles.modifiedBadgeText} numberOfLines={1}>ИЗМЕНЁН</Text>
            </View>
          )}
        </View>
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 2. ADAPTIVE 8-STEP RHYTHM MATRIX (3 TRACKS, FITS 360DP)      */}
      {/* ============================================================ */}
      <LiquidGlassCard compact style={styles.matrixCard}>
          <View style={styles.matrix}>
            {/* Bar Markers Row: Такт 1 (1-4) vs Такт 2 (5-8) */}
            <View style={styles.barHeaderRow}>
              <View style={styles.trackLabelBox}>
                <Text style={styles.headerLabel} numberOfLines={1}>ДОЛЯ</Text>
              </View>
              <View style={styles.stepsFlexRow}>
                <View style={styles.barGroupBadge}>
                  <Text style={styles.barGroupText}>ТАКТ 1–4</Text>
                </View>
                <View style={styles.barDividerSpacer} />
                <View style={styles.barGroupBadge}>
                  <Text style={styles.barGroupText}>ТАКТ 5–8</Text>
                </View>
              </View>
            </View>

            {/* Step Headers + 3 Track Rows with Continuous Active Column Highlight */}
            <View style={styles.gridColumnsContainer}>
              {isPlaying && (
                <View pointerEvents="none" style={styles.activeColumnOverlay}>
                  {Array.from({ length: STEP_COUNT }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.activeColumnSlot,
                        i === 4 && styles.barSplitGap,
                        currentStep === i && styles.activeColumnHighlight,
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Step Numbers Header (1..8) */}
              <View style={styles.stepHeaderRow}>
                <View style={styles.trackLabelBox}>
                  <Text style={styles.headerLabel} numberOfLines={1}>ДОРОЖКА</Text>
                </View>
                <View style={styles.stepsFlexRow}>
                  {Array.from({ length: STEP_COUNT }).map((_, i) => {
                    const isDownbeat = i % 4 === 0;
                    const isActiveCol = isPlaying && currentStep === i;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.stepNumBox,
                          i === 4 && styles.barSplitGap,
                          isDownbeat && styles.stepNumQuarter,
                          isActiveCol && styles.stepNumActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepNumText,
                            isDownbeat && styles.stepNumTextQuarter,
                            isActiveCol && styles.stepNumTextActive,
                          ]}
                        >
                          {i + 1}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* 3 Adaptive Track Rows */}
              {TRACK_CONFIG.map((track) => {
                const lvl = trackLevels[track.key] ?? 100;
                const rowValues = tracks[track.key] || [];
                return (
                  <View key={track.key} style={styles.trackRow}>
                    <TouchableOpacity
                      style={styles.trackLabelBox}
                      onPress={() => cycleTrackLevel(track.key)}
                      activeOpacity={0.65}
                    >
                      <View style={styles.trackLabelLine}>
                        <View
                          style={[
                            styles.trackArcMarker,
                            { opacity: lvl === 0 ? 0.2 : Math.max(0.35, lvl / 100) },
                          ]}
                        />
                        <View style={styles.trackTextCol}>
                          <Text
                            style={styles.trackLabel}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                          >
                            {track.label}
                          </Text>
                          <Text
                            style={[
                              styles.trackLevelTag,
                              { opacity: lvl === 0 ? 0.45 : 0.85 },
                            ]}
                            numberOfLines={1}
                          >
                            {lvl}%
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.stepsFlexRow}>
                      {rowValues.map((val, i) => {
                        const isOn = val > 0;
                        const isActiveCol = isPlaying && currentStep === i;
                        const cellOpacity = isOn
                          ? Math.max(0.30, (stepIntensity / 100) * (lvl / 100))
                          : 1;
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[
                              styles.stepCell,
                              i === 4 && styles.barSplitGap,
                              isOn && [
                                styles.stepCellOn,
                                { opacity: cellOpacity },
                              ],
                              isActiveCol && (isOn ? styles.stepCellPlayingOn : styles.stepCellPlaying),
                            ]}
                            onPress={() => toggleStep(track.key, i)}
                            activeOpacity={0.6}
                          />
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
      </LiquidGlassCard>

      {/* ============================================================ */}
      {/* 3. OUTPUT MODE (ARCS VS 36-PIXEL WAVE) & LIVE DYNAMICS       */}
      {/* ============================================================ */}
      <LiquidGlassCard compact style={styles.dynamicsCard}>
        <View style={styles.modeSwitchRow}>
          <Text style={styles.sectionMiniTitle}>ВЫВОД:</Text>
          <TouchableOpacity
            style={[styles.modePill, pixelMode === 'arcs' && styles.modePillActive]}
            onPress={() => handlePixelModeChange('arcs')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modePillText, pixelMode === 'arcs' && styles.modePillTextActive]} numberOfLines={1}>
              3 ДУГИ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modePill, pixelMode === 'pixels' && styles.modePillCyanActive]}
            onPress={() => handlePixelModeChange('pixels')}
            activeOpacity={0.7}
          >
            <Text style={[styles.modePillText, pixelMode === 'pixels' && styles.modePillCyanTextActive]} numberOfLines={1}>
              ПИКСЕЛИ (36 LED)
            </Text>
          </TouchableOpacity>
        </View>

        <GlyphSlider
          compact
          label="ЯРКОСТЬ (ИНТЕНСИВНОСТЬ)"
          value={stepIntensity}
          min={0}
          max={100}
          step={1}
          unit="%"
          displayValue={`${stepIntensity}%`}
          accentColor="#FFFFFF"
          onValueChange={handleIntensityChange}
        />

        <GlyphSlider
          compact
          label="GATE (ДЛИТЕЛЬНОСТЬ)"
          value={gatePct}
          min={20}
          max={100}
          step={5}
          unit="%"
          displayValue={
            gatePct <= 35
              ? `${gatePct}% СТАККАТО`
              : gatePct >= 95
              ? `${gatePct}% ЛЕГАТО`
              : `${gatePct}%`
          }
          accentColor={GlyphColors.neonCyan}
          onValueChange={handleGateChange}
        />

        <GlyphSlider
          compact
          label="SWING (ШАФФЛ)"
          value={swingPct}
          min={0}
          max={60}
          step={2}
          unit="%"
          displayValue={swingPct === 0 ? '0% РОВНО' : `${swingPct}%`}
          accentColor={GlyphColors.neonRed}
          onValueChange={handleSwingChange}
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
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 115,
    gap: 8,
  },
  topCard: {
    paddingVertical: 4,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 6,
  },
  btnIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  playBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderTopColor: 'rgba(255, 255, 255, 0.45)',
  },
  playBtnActive: {
    backgroundColor: GlyphColors.nothingRed,
    borderColor: '#FFFFFF',
    shadowColor: GlyphColors.nothingRed,
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  playBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  playBtnTextActive: {
    color: '#FFFFFF',
  },
  bpmBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 4,
  },
  bpmArrowBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bpmArrowText: {
    fontFamily: 'NDOT57',
    fontSize: 12,
    color: '#FFFFFF',
  },
  bpmValueText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  stepCounterBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  stepCounterText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#D8D8E4',
    letterSpacing: 0.6,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
  clearBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#B4B4C4',
  },
  bpmQuickRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  bpmChip: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  bpmChipActive: {
    backgroundColor: 'rgba(215, 25, 32, 0.28)',
    borderColor: GlyphColors.nothingRed,
  },
  bpmChipText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B6',
  },
  bpmChipTextActive: {
    color: '#FFFFFF',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 5.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderTopColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.20,
    shadowRadius: 5,
  },
  presetBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B6',
    letterSpacing: 0.6,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
  },
  userSlotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  slotBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.18)',
    borderColor: GlyphColors.neonCyan,
  },
  slotDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  slotDotFilled: {
    backgroundColor: GlyphColors.neonCyan,
  },
  slotBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#B4B4C4',
  },
  slotBtnTextActive: {
    color: '#FFFFFF',
  },
  saveSlotBtn: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  saveSlotBtnSuccess: {
    backgroundColor: 'rgba(0, 229, 255, 0.24)',
    borderColor: GlyphColors.neonCyan,
  },
  saveSlotBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  modifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: GlyphColors.nothingRed,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  modifiedBadgeText: {
    fontFamily: 'NDOT57',
    fontSize: 7,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  matrixCard: {
    paddingVertical: 4,
  },
  matrix: {
    gap: 5,
  },
  barHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridColumnsContainer: {
    position: 'relative',
    gap: 5,
  },
  activeColumnOverlay: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    left: 63,
    right: 0,
    flexDirection: 'row',
    gap: 3,
  },
  activeColumnSlot: {
    flex: 1,
    borderRadius: 7,
  },
  activeColumnHighlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  trackLabelBox: {
    width: 58,
    marginRight: 5,
    justifyContent: 'center',
  },
  trackLabelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackArcMarker: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  trackTextCol: {
    flex: 1,
  },
  stepsFlexRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  barGroupBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  barGroupBadgeSecond: {
    backgroundColor: 'rgba(0, 229, 255, 0.10)',
  },
  barGroupText: {
    fontFamily: 'NDOT57',
    fontSize: 6.5,
    color: '#A8A8B8',
    letterSpacing: 0.7,
  },
  barGroupSecondText: {
    fontFamily: 'NDOT57',
    fontSize: 6.5,
    color: GlyphColors.neonCyan,
    letterSpacing: 0.7,
  },
  barDividerSpacer: {
    width: 3,
  },
  barSplitGap: {
    marginLeft: 3,
  },
  headerLabel: {
    fontFamily: 'NDOT57',
    fontSize: 7,
    color: '#A4A4B6',
    letterSpacing: 0.5,
  },
  stepNumBox: {
    flex: 1,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  stepNumSecondBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  stepNumQuarter: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.50)',
  },
  stepNumActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 5,
  },
  stepNumText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A0A0B0',
  },
  stepNumTextQuarter: {
    color: '#D8D8E4',
  },
  stepNumTextActive: {
    color: '#FFFFFF',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackLabel: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#EAEAF4',
    letterSpacing: 0.4,
  },
  trackLevelTag: {
    fontFamily: 'NDOT57',
    fontSize: 6.5,
    color: '#D8D8E6',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  stepCell: {
    flex: 1,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.28)',
  },
  stepCellOn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
    elevation: 5,
  },
  stepCellPlaying: {
    borderColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  stepCellPlayingOn: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.95,
    shadowRadius: 10,
  },
  dynamicsCard: {
    paddingVertical: 4,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  sectionMiniTitle: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#A8A8B8',
    letterSpacing: 0.8,
    marginRight: 2,
  },
  modePill: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  modePillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: '#FFFFFF',
  },
  modePillCyanActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
    borderColor: GlyphColors.neonCyan,
  },
  modePillText: {
    fontFamily: 'NDOT57',
    fontSize: 7.5,
    color: '#A4A4B6',
    letterSpacing: 0.5,
  },
  modePillTextActive: {
    color: '#FFFFFF',
  },
  modePillCyanTextActive: {
    color: GlyphColors.neonCyan,
  },
});

export default React.memo(SequencerScreen);
