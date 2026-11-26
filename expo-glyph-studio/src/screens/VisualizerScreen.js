import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import NothingGlyph from '../../modules/nothing-glyph';

const MODES = [
  { id: 'СПЕКТР EQ', label: 'СПЕКТР EQ' },
  { id: 'БИТ-СТРОБ', label: 'БИТ-СТРОБ' },
  { id: 'ВОЛНА',     label: 'ВОЛНА' },
  { id: 'ИСКРЫ',     label: 'ИСКРЫ' },
  { id: 'ГЛИЧ',      label: 'ГЛИЧ' },
  { id: 'РАДАР',     label: 'РАДАР' },
];

const AUDIO_SOURCES = [
  { id: 'auto', label: 'АВТО' },
  { id: 'mix',  label: 'МИКС' },
  { id: 'mic',  label: 'МИКР.' },
];

const ZERO_BANDS = new Array(16).fill(0);
const ZERO_PIXELS = new Array(36).fill(0);
const EQ_SEGMENTS = 12;
const SEGMENT_INDICES = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export default function VisualizerScreen({
  brightness,
  onBrightnessChange,
  onActivePixelChange,
  onPixelLevelsChange,
  onEnsurePowerOn,
}) {
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('СПЕКТР EQ');
  const [sourceMode, setSourceMode] = useState('auto');
  const [activeSource, setActiveSource] = useState('none'); // 'mix' | 'mic' | 'none'
  const [mixSupported, setMixSupported] = useState(true);
  const [signalDetected, setSignalDetected] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);
  const [peakDb, setPeakDb] = useState(-96);
  const [bands, setBands] = useState(ZERO_BANDS);
  const [sensitivity, setSensitivity] = useState(85);
  const [speed, setSpeed] = useState(50);
  const [bass, setBass] = useState(0);
  const [mid, setMid] = useState(0);
  const [treble, setTreble] = useState(0);
  const [peakHold, setPeakHold] = useState({ mid: 0, treble: 0, bass: 0 });
  const [hasMicPermission, setHasMicPermission] = useState(() => NothingGlyph.hasAudioPermission());
  const [permissionStatus, setPermissionStatus] = useState(() =>
    NothingGlyph.hasAudioPermission() ? 'granted' : 'undetermined'
  );
  const [captureError, setCaptureError] = useState(null);

  const isMountedRef = useRef(true);
  const audioAnalyserRef = useRef({ active: false, source: 'none' });
  const energyHistoryRef = useRef([]);
  const lastBeatTimeRef = useRef(0);
  const strobeIntensityRef = useRef(0);
  const rafRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const lastUiSyncRef = useRef(0);
  const wavePhaseRef = useRef(0);
  const radarAngleRef = useRef(0);
  const sparkLevelsRef = useRef(new Array(36).fill(0));
  const smoothedBandsRef = useRef({ bass: 0, mid: 0, treble: 0, rms: 0, bands: new Array(16).fill(0) });
  const peakHoldRef = useRef({ mid: 0, treble: 0, bass: 0 });
  const wasSilentRef = useRef(true);

  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;

  const onBrightnessChangeRef = useRef(onBrightnessChange);
  onBrightnessChangeRef.current = onBrightnessChange;
  const onActivePixelChangeRef = useRef(onActivePixelChange);
  onActivePixelChangeRef.current = onActivePixelChange;
  const onPixelLevelsChangeRef = useRef(onPixelLevelsChange);
  onPixelLevelsChangeRef.current = onPixelLevelsChange;
  const onEnsurePowerOnRef = useRef(onEnsurePowerOn);
  onEnsurePowerOnRef.current = onEnsurePowerOn;

  const cleanupAudio = useCallback(() => {
    if (rafRef.current !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current);
      } else {
        clearTimeout(rafRef.current);
      }
      rafRef.current = null;
    }

    NothingGlyph.stopAudioCapture();
    audioAnalyserRef.current = { active: false, source: 'none' };

    energyHistoryRef.current = [];
    strobeIntensityRef.current = 0;
    lastBeatTimeRef.current = 0;
    wavePhaseRef.current = 0;
    radarAngleRef.current = 0;
    sparkLevelsRef.current.fill(0);
    smoothedBandsRef.current = {
      bass: 0,
      mid: 0,
      treble: 0,
      rms: 0,
      bands: new Array(16).fill(0),
    };
    peakHoldRef.current = { mid: 0, treble: 0, bass: 0 };
    wasSilentRef.current = true;

    if (isMountedRef.current) {
      setBass(0);
      setMid(0);
      setTreble(0);
      setPeakHold({ mid: 0, treble: 0, bass: 0 });
      setPeakDb(-96);
      setBands(ZERO_BANDS);
      setSignalDetected(false);
      setBeatFlash(false);
      setActiveSource('none');
    }

    onPixelLevelsChangeRef.current?.(null);
    onActivePixelChangeRef.current?.(null);
    onBrightnessChangeRef.current?.([0, 0, 0]);
  }, []);

  const handleRequestAudioPermission = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const permissionResponse = await NothingGlyph.requestAudioPermission();
      if (!isMountedRef.current) return false;
      const granted = Boolean(
        permissionResponse?.granted || permissionResponse?.status === 'granted'
      );
      setHasMicPermission(granted);
      setPermissionStatus(granted ? 'granted' : (permissionResponse?.status || 'denied'));
      if (granted) {
        setCaptureError(null);
      }
      return granted;
    } catch (e) {
      if (!isMountedRef.current) return false;
      setHasMicPermission(false);
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const startCapturePipeline = useCallback(async (requestedSource, isCancelled = () => false) => {
    let granted = NothingGlyph.hasAudioPermission();
    if (!granted) {
      const permissionResponse = await NothingGlyph.requestAudioPermission();
      if (isCancelled() || !isMountedRef.current) return false;
      granted = Boolean(
        permissionResponse?.granted || permissionResponse?.status === 'granted'
      );
      setHasMicPermission(granted);
      if (permissionResponse?.status !== 'granted' && !granted) {
        setPermissionStatus(permissionResponse?.status || 'denied');
        setCaptureError('Требуется разрешение RECORD_AUDIO для реального анализа аудио');
        setIsActive(false);
        return false;
      }
    }

    if (isCancelled() || !isMountedRef.current) return false;
    setHasMicPermission(true);
    setPermissionStatus('granted');

    const startRes = NothingGlyph.startAudioCapture(requestedSource);
    if (isCancelled() || !isMountedRef.current) {
      NothingGlyph.stopAudioCapture();
      return false;
    }
    setMixSupported(Boolean(startRes?.mixSupported));
    if (!startRes?.started) {
      setCaptureError(startRes?.error || 'Не удалось запустить захват аудио');
      setActiveSource('none');
      return false;
    }

    setCaptureError(startRes?.error || null);
    setActiveSource(startRes?.activeSource || 'none');
    audioAnalyserRef.current = {
      active: true,
      source: startRes?.activeSource || 'none',
    };
    return true;
  }, []);

  useEffect(() => {
    if (!isActive) {
      cleanupAudio();
      return;
    }

    let cancelled = false;
    onEnsurePowerOnRef.current?.();

    const scheduleFrame = (fn) => {
      if (typeof requestAnimationFrame === 'function') {
        rafRef.current = requestAnimationFrame(fn);
      } else {
        rafRef.current = setTimeout(() => fn(Date.now()), 16);
      }
    };

    const runAudioStreamLoop = (nowMs) => {
      if (cancelled) return;

      const now = Date.now();
      const prevTime = lastFrameTimeRef.current || now;
      const dt = Math.min(0.1, Math.max(0.004, (now - prevTime) / 1000));
      lastFrameTimeRef.current = now;

      const audioStream = NothingGlyph.getAudioMetrics();
      const frequencyData = Array.isArray(audioStream?.bands) && audioStream.bands.length === 16
        ? audioStream.bands
        : ZERO_BANDS;

      const sensitivityVal = sensitivityRef.current;
      const sensitivityGain = 0.25 + (sensitivityVal / 100) * 1.55;
      const sensitivityThreshold = 1.48 - (sensitivityVal / 100) * 0.48;
      const noiseFloor = 0.045 * (1.35 - (sensitivityVal / 100) * 0.75);

      const gateLevel = (raw) => {
        if (!audioStream?.active || !audioStream?.signalDetected || raw <= noiseFloor) {
          return 0;
        }
        const normalized = (raw - noiseFloor) / (1 - noiseFloor);
        return Math.min(1, Math.max(0, normalized * sensitivityGain));
      };

      const rawBass = gateLevel(audioStream?.bass || 0);
      const rawMid = gateLevel(audioStream?.mid || 0);
      const rawTreble = gateLevel(audioStream?.treble || 0);
      const rawRms = gateLevel(audioStream?.rms || 0);
      const rawFlux = audioStream?.active && audioStream?.signalDetected
        ? Math.min(1, (audioStream?.flux || 0) * sensitivityGain)
        : 0;

      // Fast attack, speed-modulated exponential release
      const attackAlpha = 1 - Math.exp(-32 * dt);
      const releaseRate = 4.0 + (speedRef.current / 100) * 18.0;
      const releaseAlpha = 1 - Math.exp(-releaseRate * dt);

      const smooth = (prevVal, targetVal) => {
        const alpha = targetVal > prevVal ? attackAlpha : releaseAlpha;
        const nextVal = prevVal + (targetVal - prevVal) * alpha;
        return nextVal < 0.004 ? 0 : Math.min(1, nextVal);
      };

      const sb = smoothedBandsRef.current;
      const curBass = smooth(sb.bass, rawBass);
      const curMid = smooth(sb.mid, rawMid);
      const curTreble = smooth(sb.treble, rawTreble);
      const curRms = smooth(sb.rms, rawRms);
      sb.bass = curBass;
      sb.mid = curMid;
      sb.treble = curTreble;
      sb.rms = curRms;

      const curBands = sb.bands;
      for (let i = 0; i < 16; i++) {
        curBands[i] = smooth(curBands[i], gateLevel(frequencyData[i] || 0));
      }

      // Real Beat Onset Detection (energy history + native spectral flux)
      const instantEnergy = rawBass * 0.55 + rawMid * 0.30 + rawTreble * 0.15;
      energyHistoryRef.current.push(instantEnergy);
      if (energyHistoryRef.current.length > 32) {
        energyHistoryRef.current.shift();
      }
      const avgEnergy = energyHistoryRef.current.length > 0
        ? energyHistoryRef.current.reduce((a, b) => a + b, 0) / energyHistoryRef.current.length
        : 0;
      const spectralFlux = Math.max(rawFlux, Math.max(0, instantEnergy - avgEnergy));
      const onsetThreshold = Math.max(noiseFloor * 1.4, avgEnergy * sensitivityThreshold);

      const minBeatInterval = 115;
      const isBeatDetected = Boolean(
        audioStream?.signalDetected &&
        instantEnergy > noiseFloor * 1.5 &&
        (instantEnergy > onsetThreshold || spectralFlux > 0.22) &&
        (now - lastBeatTimeRef.current) > minBeatInterval
      );

      if (isBeatDetected) {
        strobeIntensityRef.current = 1.0;
        lastBeatTimeRef.current = now;
      }

      // Exponential Stroboscopic Decay Envelope + Peak Micro-Flickering
      const decayRate = 5.5 + (speedRef.current / 100) * 7.5;
      const decayFactor = Math.exp(-decayRate * dt);
      strobeIntensityRef.current = strobeIntensityRef.current * decayFactor;
      if (strobeIntensityRef.current < 0.005) {
        strobeIntensityRef.current = 0;
      }

      const jitterFactor = 0.25;
      const flickerJitter = strobeIntensityRef.current > 0.4
        ? (1.0 - Math.random() * jitterFactor)
        : 1.0;
      const strobeFlicker = flickerJitter;
      const strobeBrightness = Math.min(
        255,
        Math.max(0, Math.round(strobeIntensityRef.current * 255 * strobeFlicker))
      );

      const curMode = modeRef.current;
      const speedNorm = speedRef.current / 100;
      const hasAudibleEnergy = curBass > 0 || curMid > 0 || curTreble > 0 || strobeIntensityRef.current > 0;

      let bTL = 0;
      let bBL = 0;
      let bR = 0;
      let activePixels = [];
      let pixelLevels = new Array(36).fill(0);
      let preferArcMode = false;

      switch (curMode) {
        case 'СПЕКТР EQ':
        case 'spectrum': {
          preferArcMode = true;
          bTL = Math.min(255, Math.max(0, Math.round(curMid * 255)));
          bBL = Math.min(255, Math.max(0, Math.round(curTreble * 255)));
          bR = Math.min(255, Math.max(0, Math.round(curBass * 255)));

          // Arc 0 (0..19): 20 LEDs driven by Mids + bands[4..10]
          const midFill = curMid * 20;
          for (let i = 0; i < 20; i++) {
            const bandVal = curBands[4 + Math.floor((i * 7) / 20)];
            const fillLvl = Math.max(0, Math.min(1, midFill - i));
            const lvl = fillLvl > 0 ? Math.max(fillLvl * curMid, bandVal * 0.9) : 0;
            pixelLevels[i] = lvl;
            if (lvl > 0.05) activePixels.push(i);
          }

          // Arc 2 (20..30): 11 LEDs driven by Bass + bands[0..4]
          const bassFill = curBass * 11;
          for (let i = 0; i < 11; i++) {
            const idx = 20 + i;
            const bandVal = curBands[Math.floor((i * 5) / 11)];
            const fillLvl = Math.max(0, Math.min(1, bassFill - i));
            const lvl = fillLvl > 0 ? Math.max(fillLvl * curBass, bandVal * 0.95) : 0;
            pixelLevels[idx] = lvl;
            if (lvl > 0.05) activePixels.push(idx);
          }

          // Arc 1 (31..35): 5 LEDs driven by Treble + bands[11..15]
          const trebleFill = curTreble * 5;
          for (let i = 0; i < 5; i++) {
            const idx = 31 + i;
            const bandVal = curBands[11 + i];
            const fillLvl = Math.max(0, Math.min(1, trebleFill - i));
            const lvl = fillLvl > 0 ? Math.max(fillLvl * curTreble, bandVal * 0.9) : 0;
            pixelLevels[idx] = lvl;
            if (lvl > 0.05) activePixels.push(idx);
          }
          break;
        }

        case 'БИТ-СТРОБ':
        case 'strobe': {
          preferArcMode = true;
          const outB = isBeatDetected ? 255 : strobeBrightness;
          bTL = outB;
          bBL = outB;
          bR = outB;

          const baseStrobe = isBeatDetected ? 1.0 : Math.min(1, strobeIntensityRef.current * strobeFlicker);
          if (baseStrobe > 0.01) {
            for (let i = 0; i < 36; i++) {
              const mod = isBeatDetected ? 1.0 : Math.min(1, baseStrobe * (0.65 + 0.35 * curBands[i % 16]));
              pixelLevels[i] = mod;
              if (mod > 0.12) activePixels.push(i);
            }
          }
          break;
        }

        case 'ВОЛНА':
        case 'wave': {
          const waveEnergy = Math.max(curBass, curMid, curRms);
          if (waveEnergy > 0.008) {
            wavePhaseRef.current = (
              wavePhaseRef.current + dt * (5.0 + speedNorm * 26.0) * (0.4 + waveEnergy * 1.4)
            ) % 36;
            const center = wavePhaseRef.current;
            const width = 2.0 + curBass * 5.0;

            bTL = Math.min(255, Math.round(curMid * 255));
            bBL = Math.min(255, Math.round(curTreble * 255));
            bR = Math.min(255, Math.round(curBass * 255));

            for (let i = 0; i < 36; i++) {
              const rawDist = Math.abs(i - center);
              const dist = Math.min(rawDist, 36 - rawDist);
              const crest = Math.max(0, 1 - dist / width);
              const lvl = Math.min(1, crest * crest * (0.4 + waveEnergy * 0.8));
              pixelLevels[i] = lvl;
            }

            const centerIdx = Math.floor(center) % 36;
            activePixels = [(centerIdx - 1 + 36) % 36, centerIdx, (centerIdx + 1) % 36];
          }
          break;
        }

        case 'ИСКРЫ':
        case 'sparks': {
          const sparkDecay = Math.exp(-11.0 * dt);
          for (let i = 0; i < 36; i++) {
            sparkLevelsRef.current[i] *= sparkDecay;
            if (sparkLevelsRef.current[i] < 0.01) sparkLevelsRef.current[i] = 0;
          }

          if (curTreble > 0.16 || isBeatDetected) {
            const pTL = Math.floor(Math.random() * 20);
            const pR = 20 + Math.floor(Math.random() * 11);
            const pBL = 31 + Math.floor(Math.random() * 5);
            const sparkPower = Math.min(1, Math.max(curTreble * 1.15, isBeatDetected ? 1.0 : 0.45));

            sparkLevelsRef.current[pTL] = sparkPower;
            sparkLevelsRef.current[pR] = sparkPower;
            sparkLevelsRef.current[pBL] = sparkPower;

            if (isBeatDetected) {
              sparkLevelsRef.current[Math.floor(Math.random() * 20)] = 1.0;
              sparkLevelsRef.current[20 + Math.floor(Math.random() * 11)] = 1.0;
            }
          }

          bTL = Math.min(255, Math.round(curMid * 0.55 * 255));
          bBL = Math.min(255, Math.round(curTreble * 255));
          bR = Math.min(255, Math.round(curBass * 0.55 * 255));

          for (let i = 0; i < 36; i++) {
            pixelLevels[i] = sparkLevelsRef.current[i];
            if (sparkLevelsRef.current[i] > 0.12) {
              activePixels.push(i);
            }
          }
          break;
        }

        case 'ГЛИЧ':
        case 'glitch': {
          const glitchTrigger = spectralFlux > 0.12 || curBass > 0.48 || isBeatDetected;
          const periodMs = Math.max(50, Math.round(160 - speedNorm * 100));
          const dutyOn = (now % periodMs) < (periodMs * 0.45);
          const isGlitch = glitchTrigger && dutyOn;

          if (isGlitch) {
            preferArcMode = false;
            const alt = ((now >> 5) % 2) === 0;
            bTL = alt ? 255 : 0;
            bBL = alt ? 0 : 255;
            bR = 255;
            const glitchSet = [
              Math.floor(Math.random() * 10),
              10 + Math.floor(Math.random() * 10),
              20 + Math.floor(Math.random() * 11),
              31 + Math.floor(Math.random() * 5),
            ];
            activePixels = glitchSet;
            for (let i = 0; i < 36; i++) {
              pixelLevels[i] = glitchSet.includes(i) ? 1.0 : (curBands[i % 16] * 0.35);
            }
          } else if (hasAudibleEnergy) {
            preferArcMode = true;
            bTL = Math.min(255, Math.round(curMid * 0.4 * 255));
            bBL = Math.min(255, Math.round(curTreble * 0.8 * 255));
            bR = Math.min(255, Math.round(curBass * 0.8 * 255));
            for (let i = 0; i < 36; i++) {
              pixelLevels[i] = Math.min(1, curBands[i % 16] * 0.5);
            }
          }
          break;
        }

        case 'РАДАР':
        case 'radar': {
          const radarEnergy = Math.max(curBass, curMid, curRms);
          const count = Math.round(Math.min(1, radarEnergy) * 36);
          if (count > 0) {
            radarAngleRef.current = (
              radarAngleRef.current + dt * (8.0 + speedNorm * 32.0)
            ) % 36;
            const head = Math.floor(radarAngleRef.current) % 36;

            bTL = Math.min(255, Math.round(curMid * 220));
            bBL = Math.min(255, Math.round(curTreble * 220));
            bR = Math.min(255, Math.round(curBass * 220));

            for (let step = 0; step < count; step++) {
              const led = (head - step + 36) % 36;
              const fade = 1.0 - (step / Math.max(1, count)) * 0.82;
              pixelLevels[led] = Math.min(1, fade * (0.45 + radarEnergy * 0.55));
              activePixels.push(led);
            }
          }
          break;
        }

        default: {
          preferArcMode = true;
          bTL = Math.min(255, Math.max(0, Math.round(curMid * 255)));
          bBL = Math.min(255, Math.max(0, Math.round(curTreble * 255)));
          bR = Math.min(255, Math.max(0, Math.round(curBass * 255)));
          for (let i = 0; i < 36; i++) {
            pixelLevels[i] = curBands[i % 16];
          }
          break;
        }
      }

      // Drive 36 micro-LEDs directly when supported; fall back cleanly to arc/activePixel callbacks
      if (typeof onPixelLevelsChangeRef.current === 'function') {
        onBrightnessChangeRef.current?.([bTL, bBL, bR]);
        onPixelLevelsChangeRef.current(hasAudibleEnergy ? pixelLevels : ZERO_PIXELS);
      } else {
        if (preferArcMode) {
          onActivePixelChangeRef.current?.(null);
          onBrightnessChangeRef.current?.([bTL, bBL, bR]);
        } else {
          onActivePixelChangeRef.current?.(activePixels);
          onBrightnessChangeRef.current?.([bTL, bBL, bR]);
        }
      }

      // Update segmented EQ Peak Hold markers
      const peakDecay = dt * 0.45;
      const ph = peakHoldRef.current;
      ph.mid = curMid >= ph.mid ? curMid : Math.max(0, ph.mid - peakDecay);
      ph.treble = curTreble >= ph.treble ? curTreble : Math.max(0, ph.treble - peakDecay);
      ph.bass = curBass >= ph.bass ? curBass : Math.max(0, ph.bass - peakDecay);
      if (ph.mid < 0.015) ph.mid = 0;
      if (ph.treble < 0.015) ph.treble = 0;
      if (ph.bass < 0.015) ph.bass = 0;

      // Sync React HUD state (~30Hz, skipping redundant updates during steady silence)
      const hasPeakHold = ph.mid > 0 || ph.treble > 0 || ph.bass > 0;
      const isCurrentlySilent = !audioStream?.signalDetected && !hasAudibleEnergy && !hasPeakHold;
      if ((now - lastUiSyncRef.current) >= 32 && (!isCurrentlySilent || !wasSilentRef.current)) {
        lastUiSyncRef.current = now;
        wasSilentRef.current = isCurrentlySilent;
        setBass(curBass);
        setMid(curMid);
        setTreble(curTreble);
        setPeakHold({ mid: ph.mid, treble: ph.treble, bass: ph.bass });
        setBands([...curBands]);
        setPeakDb(typeof audioStream?.peakDb === 'number' ? Math.round(audioStream.peakDb) : -96);
        setSignalDetected(Boolean(audioStream?.signalDetected));
        setBeatFlash(isBeatDetected || strobeIntensityRef.current > 0.55);
        setActiveSource(audioStream?.source || 'none');
      }

      scheduleFrame(runAudioStreamLoop);
    };

    (async () => {
      const ok = await startCapturePipeline(sourceModeRef.current, () => cancelled);
      if (cancelled || !isMountedRef.current) {
        if (ok) NothingGlyph.stopAudioCapture();
        return;
      }
      if (!ok) {
        setIsActive(false);
        return;
      }
      lastFrameTimeRef.current = Date.now();
      lastUiSyncRef.current = 0;
      scheduleFrame(runAudioStreamLoop);
    })();

    return () => {
      cancelled = true;
      cleanupAudio();
    };
  }, [isActive, sourceMode, startCapturePipeline, cleanupAudio]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleToggleActive = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (isActive) {
      setIsActive(false);
      return;
    }
    if (!NothingGlyph.hasAudioPermission()) {
      const granted = await handleRequestAudioPermission();
      if (!isMountedRef.current) return;
      if (!granted) {
        setCaptureError('Доступ к аудио отклонён. Разрешите RECORD_AUDIO для анализа звука.');
        return;
      }
    }
    if (!isMountedRef.current) return;
    setIsActive(true);
  };

  const handleSourceSelect = (newSource) => {
    Haptics.selectionAsync().catch(() => {});
    setSourceMode(newSource);
  };

  const getSourceStatusText = () => {
    if (!hasMicPermission && permissionStatus !== 'granted') {
      return 'НЕТ РАЗРЕШЕНИЯ RECORD_AUDIO';
    }
    if (!isActive) {
      return sourceMode === 'mix'
        ? 'ОЖИДАНИЕ: СИСТЕМНЫЙ МИКС'
        : sourceMode === 'mic'
          ? 'ОЖИДАНИЕ: МИКРОФОН PCM FFT'
          : 'ОЖИДАНИЕ: АВТО (МИКС + МИКРОФОН)';
    }
    if (activeSource === 'mix') {
      return 'СИСТЕМНЫЙ МИКС (DRM-ТРЕКИ БЛОКИРУЮТСЯ ANDROID)';
    }
    if (activeSource === 'mic') {
      return 'МИКРОФОН PCM (РЕАЛЬНЫЙ RADIX-2 FFT)';
    }
    return mixSupported ? 'ИНИЦИАЛИЗАЦИЯ АУДИО...' : 'МИКС НЕДОСТУПЕН НА ЭТОМ ANDROID';
  };

  const showPermissionBanner = !hasMicPermission && permissionStatus !== 'granted';

  const renderSegmentedMeter = (label, level, peak) => {
    const litCount = Math.round(Math.min(1, Math.max(0, level)) * EQ_SEGMENTS);
    const peakIdx = peak > 0.03 ? Math.min(EQ_SEGMENTS - 1, Math.max(0, Math.ceil(peak * EQ_SEGMENTS) - 1)) : -1;

    return (
      <View style={styles.meterCol}>
        <View style={styles.segStack}>
          {SEGMENT_INDICES.map((segIdx) => {
            const isLit = segIdx < litCount;
            const isPeakMarker = segIdx === peakIdx;
            const isHotZone = segIdx >= 10;
            let cellStyle = styles.segCellOff;
            if (isPeakMarker) {
              cellStyle = isHotZone ? styles.segCellPeakHot : styles.segCellPeak;
            } else if (isLit) {
              cellStyle = isHotZone ? styles.segCellHot : styles.segCellLit;
            }
            return <View key={segIdx} style={[styles.segCell, cellStyle]} />;
          })}
        </View>
        <Text style={styles.meterLabel} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LiquidGlassCard isActive={isActive}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              ВИЗУАЛИЗАТОР МУЗЫКИ
            </Text>
            {isActive && (
              <View style={[styles.beatBadge, beatFlash && styles.beatBadgeActive]}>
                <Text style={[styles.beatBadgeText, beatFlash && styles.beatBadgeTextActive]}>
                  {beatFlash ? 'BEAT' : peakDb <= -85 ? 'ТИШИНА' : `${peakDb} дБ`}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
            onPress={handleToggleActive}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleBtnText, isActive && styles.toggleBtnTextActive]}>
              {isActive ? '■ СТОП' : '▶ СТАРТ'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Honest Audio Source Selector + Live Status */}
        <View style={styles.sourceRow}>
          {AUDIO_SOURCES.map((src) => {
            const selected = sourceMode === src.id;
            return (
              <TouchableOpacity
                key={src.id}
                style={[styles.sourceBtn, selected && styles.sourceBtnActive]}
                onPress={() => handleSourceSelect(src.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sourceBtnText, selected && styles.sourceBtnTextActive]}>
                  {src.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              isActive && signalDetected
                ? styles.statusDotLive
                : isActive
                  ? styles.statusDotIdle
                  : styles.statusDotOff,
            ]}
          />
          <Text style={styles.statusText} numberOfLines={2}>
            {getSourceStatusText()}
          </Text>
        </View>

        {captureError && !showPermissionBanner ? (
          <Text style={styles.errorHint}>{captureError}</Text>
        ) : null}

        {showPermissionBanner && (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionDesc}>
              Для захвата реального системного микса и микрофона Android требует разрешение RECORD_AUDIO. При воспроизведении DRM-треков Android может блокировать внутренний микс.
            </Text>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={handleRequestAudioPermission}
              activeOpacity={0.75}
            >
              <Text style={styles.permissionBtnText}>РАЗРЕШИТЬ ДОСТУП К АУДИО</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode Selector - 2 rows of 3 */}
        <View style={styles.modesContainer}>
          <View style={styles.modesRow}>
            {MODES.slice(0, 3).map((m) => {
              const isSelected = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMode(m.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.modeBtnText, isSelected && styles.modeBtnTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.modesRow}>
            {MODES.slice(3, 6).map((m) => {
              const isSelected = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, isSelected && styles.modeBtnActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMode(m.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.modeBtnText, isSelected && styles.modeBtnTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.divider} />

        {/* 16-Band Real FFT Mini Analyzer Strip */}
        <View style={styles.fftStrip}>
          {bands.map((lvl, idx) => (
            <View key={idx} style={styles.fftBarBg}>
              <View
                style={[
                  styles.fftBarFill,
                  {
                    height: `${Math.round(Math.min(1, Math.max(0, lvl)) * 100)}%`,
                    backgroundColor: idx < 4 ? '#FFFFFF' : idx < 11 ? '#D8F6FF' : GlyphColors.neonCyan,
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* 3 Segmented LED Spectrum Meters with Peak Hold */}
        <View style={styles.metersRow}>
          {renderSegmentedMeter('ВЕРХ-ЛЕВО', mid, peakHold.mid)}
          {renderSegmentedMeter('НИЗ-ЛЕВО', treble, peakHold.treble)}
          {renderSegmentedMeter('ПРАВАЯ', bass, peakHold.bass)}
        </View>

        <View style={styles.divider} />

        {/* Sensitivity Slider */}
        <GlyphSlider
          label="ЧУВСТВИТЕЛЬНОСТЬ"
          value={sensitivity}
          min={10}
          max={100}
          step={1}
          displayValue={`${sensitivity}%`}
          accentColor="#FFFFFF"
          onValueChange={(val) => setSensitivity(val)}
        />

        {/* Speed Slider */}
        <GlyphSlider
          label="СКОРОСТЬ"
          value={speed}
          min={1}
          max={100}
          step={1}
          displayValue={
            speed <= 20 ? `${speed}% МЕДЛЕННО`
            : speed <= 70 ? `${speed}%`
            : `${speed}% БЫСТРО`
          }
          accentColor={GlyphColors.neonCyan}
          onValueChange={(val) => setSpeed(val)}
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
    paddingTop: 4,
    paddingBottom: 115,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  title: {
    flexShrink: 1,
    fontFamily: 'NDOT57',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  beatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  beatBadgeActive: {
    backgroundColor: GlyphColors.neonRed,
    borderColor: GlyphColors.neonRed,
  },
  beatBadgeText: {
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#A2A2B2',
    letterSpacing: 0.6,
  },
  beatBadgeTextActive: {
    color: '#FFFFFF',
  },
  toggleBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderTopColor: 'rgba(255, 255, 255, 0.38)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  toggleBtnTextActive: {
    color: '#000000',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 6,
  },
  sourceBtn: {
    flex: 1,
    paddingVertical: 5.5,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
  },
  sourceBtnActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: GlyphColors.neonCyan,
  },
  sourceBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#A2A2B2',
    letterSpacing: 0.6,
  },
  sourceBtnTextActive: {
    color: '#FFFFFF',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    marginBottom: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotLive: {
    backgroundColor: '#30D158',
  },
  statusDotIdle: {
    backgroundColor: GlyphColors.neonCyan,
  },
  statusDotOff: {
    backgroundColor: '#6E6E78',
  },
  statusText: {
    flex: 1,
    fontFamily: 'NDOT57',
    fontSize: 8,
    color: '#C8C8D2',
    letterSpacing: 0.5,
  },
  errorHint: {
    fontSize: 10,
    color: '#FF6B6B',
    marginBottom: 6,
  },
  permissionBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.35)',
    marginBottom: 8,
    gap: 8,
  },
  permissionDesc: {
    fontSize: 11,
    lineHeight: 15,
    color: '#E6E6EE',
  },
  permissionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  permissionBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#000000',
    letterSpacing: 0.7,
  },
  modesContainer: {
    gap: 5,
    marginBottom: 4,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 5,
  },
  modeBtn: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.60)',
    borderTopColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.20,
    shadowRadius: 5,
  },
  modeBtnText: {
    fontFamily: 'NDOT57',
    fontSize: 9.5,
    color: '#A2A2B2',
    letterSpacing: 0.5,
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 6,
  },
  fftStrip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 28,
    gap: 3,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  fftBarBg: {
    flex: 1,
    height: '100%',
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fftBarFill: {
    width: '100%',
    borderRadius: 3,
  },
  metersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  meterCol: {
    alignItems: 'center',
    width: 78,
  },
  segStack: {
    width: 38,
    padding: 4,
    gap: 2.5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  segCell: {
    width: '100%',
    height: 4.5,
    borderRadius: 2,
  },
  segCellOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  segCellLit: {
    backgroundColor: '#FFFFFF',
  },
  segCellHot: {
    backgroundColor: GlyphColors.neonRed,
  },
  segCellPeak: {
    backgroundColor: GlyphColors.neonCyan,
  },
  segCellPeakHot: {
    backgroundColor: '#FF5E57',
  },
  meterLabel: {
    fontFamily: 'NDOT57',
    fontSize: 8.5,
    color: '#A2A2B2',
    letterSpacing: 0.8,
    marginTop: 6,
  },
});
