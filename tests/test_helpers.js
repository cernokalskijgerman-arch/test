/**
 * ============================================================================
 * BABA Glyph Studio — E2E Test Helpers & Harness Module
 * ============================================================================
 * Shared verification utilities for Opaque-Box testing across Tiers 1-4.
 * Includes:
 *   1. Path & Source Code Access
 *   2. AST & Lexical Invariant Evaluator (Babel AST parsing & text search)
 *   3. Algorithmic & Mathematical Invariant Models (Auto-walk, Sequencer, Audio)
 *   4. Viewport Layout Geometry Budget Calculator (Zero-scroll proof)
 *   5. Headless Application State Machine Harness (React state simulation)
 *   6. Strict Assertion Primitives with Informative Diagnostics
 * ============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

// Path Resolution Constants
const PROJECT_ROOT = path.resolve(__dirname, '..');
const STUDIO_ROOT = path.resolve(PROJECT_ROOT, 'expo-glyph-studio');

// ============================================================================
// 1. Filesystem & Source Loader
// ============================================================================

function resolvePath(relPath) {
  if (path.isAbsolute(relPath)) return relPath;
  const inStudio = path.resolve(STUDIO_ROOT, relPath);
  if (fs.existsSync(inStudio)) return inStudio;
  return path.resolve(PROJECT_ROOT, relPath);
}

function loadSource(relPath) {
  const fullPath = resolvePath(relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Source file not found at: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

// ============================================================================
// 2. AST & Static Code Inspection Helpers
// ============================================================================

let babelParser = null;
let babelTraverse = null;

function getBabelParser() {
  if (!babelParser) {
    try {
      babelParser = require('../expo-glyph-studio/node_modules/@babel/parser');
    } catch {
      try {
        babelParser = require('@babel/parser');
      } catch (e) {
        throw new Error('Babel parser not found in node_modules. Ensure @babel/parser is installed.');
      }
    }
  }
  return babelParser;
}

function getBabelTraverse() {
  if (!babelTraverse) {
    try {
      const trav = require('../expo-glyph-studio/node_modules/@babel/traverse');
      babelTraverse = trav.default || trav;
    } catch {
      try {
        const trav = require('@babel/traverse');
        babelTraverse = trav.default || trav;
      } catch (e) {
        throw new Error('Babel traverse not found in node_modules.');
      }
    }
  }
  return babelTraverse;
}

function parseAST(codeOrRelPath) {
  const code = (codeOrRelPath.includes('\n') || codeOrRelPath.length > 300)
    ? codeOrRelPath
    : loadSource(codeOrRelPath);

  const parser = getBabelParser();
  return parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

function traverseAST(ast, visitor) {
  const traverse = getBabelTraverse();
  traverse(ast, visitor);
}

/**
 * Asserts that a specific string or regex pattern is strictly ABSENT from a file
 */
function assertAbsenceOfPattern(relPath, pattern, customMsg) {
  const content = loadSource(relPath);
  const matched = typeof pattern === 'string'
    ? content.includes(pattern)
    : pattern.test(content);

  const desc = typeof pattern === 'string' ? `"${pattern}"` : String(pattern);
  assert.strictEqual(
    matched,
    false,
    customMsg || `Forbidden pattern ${desc} found in ${relPath}`
  );
}

/**
 * Asserts that a specific string or regex pattern is strictly PRESENT in a file
 */
function assertPresenceOfPattern(relPath, pattern, customMsg) {
  const content = loadSource(relPath);
  const matched = typeof pattern === 'string'
    ? content.includes(pattern)
    : pattern.test(content);

  const desc = typeof pattern === 'string' ? `"${pattern}"` : String(pattern);
  assert.strictEqual(
    matched,
    true,
    customMsg || `Required pattern ${desc} was not found in ${relPath}`
  );
}

/**
 * Searches AST for all occurrences of a JSX element by tag name and collects their props
 */
function findJSXElements(ast, tagName) {
  const elements = [];
  traverseAST(ast, {
    JSXElement(astPath) {
      const opening = astPath.node.openingElement;
      if (opening.name && opening.name.name === tagName) {
        const props = {};
        opening.attributes.forEach(attr => {
          if (attr.type === 'JSXAttribute' && attr.name) {
            const propName = attr.name.name;
            if (!attr.value) {
              props[propName] = true;
            } else if (attr.value.type === 'StringLiteral') {
              props[propName] = attr.value.value;
            } else if (attr.value.type === 'JSXExpressionContainer') {
              if (attr.value.expression.type === 'NumericLiteral') {
                props[propName] = attr.value.expression.value;
              } else if (attr.value.expression.type === 'StringLiteral') {
                props[propName] = attr.value.expression.value;
              } else if (attr.value.expression.type === 'BooleanLiteral') {
                props[propName] = attr.value.expression.value;
              } else {
                props[propName] = attr.value.expression;
              }
            }
          }
        });
        elements.push({ node: astPath.node, props });
      }
    },
  });
  return elements;
}

/**
 * Extracts a prop value from a component JSX tag in source or AST
 */
function extractProp(sourceOrAST, componentName, propName) {
  let ast;
  if (typeof sourceOrAST === 'string') {
    // Regex fast check
    const regex = new RegExp(`<${componentName}[^>]*\\b${propName}=\\{?([^\\s>}"']+)\\}?`, 'i');
    const match = sourceOrAST.match(regex);
    if (match && match[1]) {
      const parsedNum = Number(match[1]);
      return isNaN(parsedNum) ? match[1] : parsedNum;
    }
    ast = parseAST(sourceOrAST);
  } else {
    ast = sourceOrAST;
  }

  const elements = findJSXElements(ast, componentName);
  for (const el of elements) {
    if (el.props[propName] !== undefined) {
      return el.props[propName];
    }
  }
  return null;
}

// ============================================================================
// 3. Mathematical & Algorithmic Invariant Models
// ============================================================================

// Physical Geometry Constants of Nothing Phone Camera Module
const PHYSICAL_ARCS = {
  TOP_LEFT: { arcIndex: 0, leds: 20, startId: 0, endId: 19, spanDeg: 41.0, degPerLed: 41.0 / 19 },
  BOTTOM_LEFT: { arcIndex: 1, leds: 5, startId: 31, endId: 35, spanDeg: 21.0, degPerLed: 21.0 / 4 },
  RIGHT: { arcIndex: 2, leds: 11, startId: 20, endId: 30, spanDeg: 48.0, degPerLed: 48.0 / 10 },
};

/**
 * Computes the normalized step duration for a given micro-LED index
 * such that angular velocity (degrees/sec) is constant across all 3 arcs.
 */
function calculateNormalizedStepDelay(pixelIndex, baseDelayMs) {
  const meanDegPerLed = (41.0 + 21.0 + 48.0) / 33.0; // ~3.333 deg
  let degPerLed = 0;
  if (pixelIndex >= 0 && pixelIndex <= 19) {
    degPerLed = PHYSICAL_ARCS.TOP_LEFT.degPerLed; // ~2.158 deg
  } else if (pixelIndex >= 20 && pixelIndex <= 30) {
    degPerLed = PHYSICAL_ARCS.RIGHT.degPerLed; // ~4.800 deg
  } else if (pixelIndex >= 31 && pixelIndex <= 35) {
    degPerLed = PHYSICAL_ARCS.BOTTOM_LEFT.degPerLed; // ~5.250 deg
  } else {
    return baseDelayMs;
  }

  const scale = degPerLed / meanDegPerLed;
  return Math.max(1, Math.round(baseDelayMs * scale));
}

/**
 * Computes angular velocity omega = deltaTheta / deltaTime (deg/sec)
 */
function calculateAngularVelocity(arcIndex, stepDelayMs) {
  let degPerLed = 0;
  if (arcIndex === 0) degPerLed = PHYSICAL_ARCS.TOP_LEFT.degPerLed;
  else if (arcIndex === 1) degPerLed = PHYSICAL_ARCS.BOTTOM_LEFT.degPerLed;
  else if (arcIndex === 2) degPerLed = PHYSICAL_ARCS.RIGHT.degPerLed;

  return (degPerLed / (stepDelayMs / 1000.0));
}

/**
 * Simulates next auto-walk step according to traversal mode
 */
function advanceAutoWalk(current, mode = 'forward', direction = 1, totalPixels = 36) {
  let next = 0;
  let nextDir = direction;

  if (mode === 'forward') {
    next = current < 0 ? 0 : (current + 1) % totalPixels;
  } else if (mode === 'reverse') {
    next = current <= 0 ? totalPixels - 1 : current - 1;
  } else if (mode === 'pingpong') {
    if (current >= totalPixels - 1) nextDir = -1;
    else if (current <= 0) nextDir = 1;
    next = Math.max(0, Math.min(totalPixels - 1, current + nextDir));
  } else if (mode === 'random') {
    next = Math.floor(Math.random() * totalPixels);
  }

  return { nextPixel: next, nextDirection: nextDir };
}

/**
 * Validates auto-walk speed clamping down to 1ms turbo
 */
function clampAutoWalkSpeed(speed) {
  if (typeof speed !== 'number' || isNaN(speed)) return 60;
  return Math.max(1, Math.min(200, Math.round(speed)));
}

/**
 * Advances sequencer step strictly with modulo 8
 */
function advanceSequencerStep(currentStep, stepCount = 8) {
  return (currentStep + 1) % stepCount;
}

/**
 * Calculates milliseconds per 16th step from BPM
 */
function calcStepMs(bpm) {
  if (!bpm || bpm <= 0) return 125;
  return Math.round((60000 / bpm) / 4);
}

/**
 * Sanitizes sequencer presets to guarantee exact 8-step arrays
 */
function sanitizeSequencerPreset(patternArray, targetLength = 8) {
  if (!Array.isArray(patternArray)) {
    return new Array(targetLength).fill(0);
  }
  if (patternArray.length >= targetLength) {
    return patternArray.slice(0, targetLength);
  }
  const padded = [...patternArray];
  while (padded.length < targetLength) padded.push(0);
  return padded;
}

/**
 * Non-destructive master brightness scaler:
 * Computes effective physical output [bTL, bBL, bR] without clobbering arc values.
 */
function calculateEffectiveBrightness(arcBrightness, masterBrightness, isPowerOn = true) {
  if (!isPowerOn || masterBrightness <= 0) {
    return [0, 0, 0];
  }
  const masterRatio = Math.max(0, Math.min(255, masterBrightness)) / 255.0;
  return arcBrightness.map(b => {
    const clamped = Math.max(0, Math.min(255, b));
    return Math.round(clamped * masterRatio);
  });
}

/**
 * Formats brightness (0-255) as percentage string
 */
function formatPercent(val) {
  if (typeof val !== 'number' || isNaN(val)) return '0%';
  const clamped = Math.max(0, Math.min(255, val));
  return `${Math.round((clamped / 255) * 100)}%`;
}

function safePercent(val) {
  if (typeof val !== 'number' || isNaN(val)) return '0%';
  const clamped = Math.max(0, Math.min(255, val));
  return `${Math.round((clamped / 255) * 100)}%`;
}

/**
 * Stroboscopic envelope evaluator: Instant attack, exponential decay
 * B(t) = B_peak * exp(-lambda * t)
 */
function evaluateStrobeEnvelope(peakBrightness, elapsedMs, decayRate = 0.025) {
  if (elapsedMs < 0) return 0;
  const decay = Math.exp(-decayRate * elapsedMs);
  return Math.max(0, Math.min(255, Math.round(peakBrightness * decay)));
}

/**
 * Dynamic beat onset energy detector
 */
function detectBeatOnset(currentEnergy, historyEnergies, sensitivity = 1.0) {
  if (!historyEnergies || historyEnergies.length === 0) return false;
  const meanEnergy = historyEnergies.reduce((a, b) => a + b, 0) / historyEnergies.length;
  const c = Math.max(1.1, 1.6 - (sensitivity - 1.0) * 0.3);
  return currentEnergy > (c * meanEnergy) && currentEnergy > 0.15;
}

/**
 * 6 Visualizer Mode Model
 * Computes { brightness: [b0, b1, b2], activePixels: number[] }
 */
function evaluateVisualizerMode(mode, audioSignals, timeMs = 0, sensitivity = 1.0) {
  const { bass = 0, mid = 0, treble = 0, isBeat = false } = audioSignals || {};
  const s = Math.max(0.1, sensitivity);

  let bTL = 0, bBL = 0, bR = 0;
  let activePixels = [];

  switch (mode) {
    case 'СПЕКТР EQ':
    case 'spectrum': {
      bTL = Math.round(Math.min(1, mid * s) * 255);
      bBL = Math.round(Math.min(1, treble * s) * 255);
      bR = Math.round(Math.min(1, bass * s) * 255);
      const ledCount = Math.round(Math.min(1, (bass + mid + treble) / 3.0 * s) * 36);
      activePixels = Array.from({ length: ledCount }, (_, i) => i);
      break;
    }
    case 'БИТ-СТРОБ':
    case 'strobe': {
      const strobeVal = isBeat ? 255 : Math.round(Math.max(0, bass * s * 255));
      bTL = strobeVal;
      bBL = strobeVal;
      bR = strobeVal;
      activePixels = isBeat ? Array.from({ length: 36 }, (_, i) => i) : [];
      break;
    }
    case 'ВОЛНА':
    case 'wave': {
      const wavePhase = (timeMs / 100) % 36;
      bTL = Math.round(Math.min(1, mid * s) * 255);
      bBL = Math.round(Math.min(1, treble * s) * 255);
      bR = Math.round(Math.min(1, bass * s) * 255);
      const center = Math.floor(wavePhase);
      activePixels = [(center - 1 + 36) % 36, center, (center + 1) % 36];
      break;
    }
    case 'ИСКРЫ':
    case 'sparks': {
      bTL = Math.round(Math.min(1, mid * 0.5 * s) * 255);
      bBL = Math.round(Math.min(1, treble * s) * 255);
      bR = Math.round(Math.min(1, bass * 0.5 * s) * 255);
      if (treble > 0.4 || isBeat) {
        activePixels = [
          Math.floor(Math.random() * 20),
          20 + Math.floor(Math.random() * 11),
          31 + Math.floor(Math.random() * 5),
        ];
      }
      break;
    }
    case 'ГЛИЧ':
    case 'glitch': {
      const isGlitch = (timeMs % 160) < 40 && bass > 0.5;
      bTL = isGlitch ? 255 : 0;
      bBL = isGlitch ? 0 : Math.round(treble * s * 255);
      bR = isGlitch ? 255 : Math.round(bass * s * 255);
      activePixels = isGlitch ? [0, 5, 12, 22, 28, 33] : [];
      break;
    }
    case 'РАДАР':
    case 'radar': {
      const angleStep = Math.floor((timeMs / 50) % 36);
      bTL = Math.round(mid * s * 200);
      bBL = Math.round(treble * s * 200);
      bR = Math.round(bass * s * 200);
      const count = Math.round(Math.min(1, bass * s) * 36);
      activePixels = Array.from({ length: count }, (_, i) => i);
      break;
    }
    default:
      // Graceful fallback to spectrum
      return evaluateVisualizerMode('СПЕКТР EQ', audioSignals, timeMs, sensitivity);
  }

  return {
    brightness: [bTL, bBL, bR],
    activePixels,
  };
}

// ============================================================================
// 4. Viewport Layout Geometry Budget Calculator (Zero-Scroll Proof)
// ============================================================================

/**
 * Computes exact vertical layout height budget for Tab 0 (ControlScreen)
 */
function evaluateControlTabLayoutBudget({
  viewportHeight = 844,
  statusBarHeight = 44,
  headerHeight = 50,
  tabBarHeight = 84,
  safeAreaBottom = 34,
  silhouetteSize = 215,
  silhouetteMarginVertical = 12,
  masterCardHeight = 68,
  arcCardHeight = 62,
  cardGap = 8,
  hasScenesCard = false,
  scenesCardHeight = 93,
} = {}) {
  const silhouetteTotal = silhouetteSize + (silhouetteMarginVertical * 2);
  const availableHeight = viewportHeight - (statusBarHeight + headerHeight + tabBarHeight + safeAreaBottom) - silhouetteTotal;

  // Height consumed by the content cards in ControlScreen
  let totalContentHeight = 0;
  totalContentHeight += masterCardHeight;
  totalContentHeight += (arcCardHeight * 3);
  totalContentHeight += (cardGap * 3);

  if (hasScenesCard) {
    totalContentHeight += scenesCardHeight + cardGap;
  }

  const clearance = availableHeight - totalContentHeight;
  const isZeroScroll = clearance >= 0;

  return {
    viewportHeight,
    availableHeight,
    totalContentHeight,
    totalScreenContentHeight: totalContentHeight + silhouetteTotal,
    clearance,
    isZeroScroll,
  };
}

// ============================================================================
// 5. Headless Application State Machine Harness
// ============================================================================

/**
 * Creates an isolated, headless state harness mirroring App.js state machine
 */
function createStudioStateHarness(initialOverrides = {}) {
  const state = {
    brightness: [255, 255, 255],
    masterBrightness: 255,
    isPowerOn: true,
    activePixel: null,
    isAutoWalk: false,
    autoWalkSpeed: 20,
    autoWalkMode: 'forward',
    walkDirection: 1,
    currentTab: 0,
    sequencerPlaying: false,
    sequencerStep: 0,
    sequencerTracks: {
      topleft: new Array(8).fill(0),
      bottomleft: new Array(8).fill(0),
      right: new Array(8).fill(0),
    },
    visualizerActive: false,
    visualizerMode: 'СПЕКТР EQ',
    visualizerSensitivity: 1.0,
    ...initialOverrides,
  };

  return {
    getState: () => ({
      ...state,
      brightness: [...state.brightness],
      sequencerTracks: {
        topleft: [...state.sequencerTracks.topleft],
        bottomleft: [...state.sequencerTracks.bottomleft],
        right: [...state.sequencerTracks.right],
      },
    }),

    // Decoupled Arc Brightness: Mutates only target arc; leaves master intact
    setArcBrightness: (arcIndex, newVal) => {
      assert(arcIndex >= 0 && arcIndex <= 2, `Invalid arcIndex: ${arcIndex}`);
      state.brightness[arcIndex] = Math.max(0, Math.min(255, newVal));
    },

    // Decoupled Master Brightness: Mutates only master; leaves arc array intact
    setMasterBrightness: (newVal) => {
      state.masterBrightness = Math.max(0, Math.min(255, newVal));
    },

    // Arc Press Toggle (0 or previous/255)
    toggleArc: (arcIndex) => {
      assert(arcIndex >= 0 && arcIndex <= 2, `Invalid arcIndex: ${arcIndex}`);
      state.brightness[arcIndex] = state.brightness[arcIndex] > 0 ? 0 : 255;
    },

    // Power Toggle
    togglePower: () => {
      state.isPowerOn = !state.isPowerOn;
    },

    allOff: () => {
      state.brightness = [0, 0, 0];
    },

    allOn: () => {
      state.brightness = [255, 255, 255];
    },

    // Effective Brightness Output
    getEffectiveBrightness: () => {
      return calculateEffectiveBrightness(
        state.brightness,
        state.masterBrightness,
        state.isPowerOn
      );
    },

    // Auto-Walk Control
    setAutoWalk: (enabled, speed = state.autoWalkSpeed, mode = state.autoWalkMode) => {
      state.isAutoWalk = enabled;
      state.autoWalkSpeed = clampAutoWalkSpeed(speed);
      state.autoWalkMode = mode;
      if (!enabled) state.activePixel = null;
    },

    stepAutoWalk: () => {
      if (!state.isAutoWalk) return null;
      const { nextPixel, nextDirection } = advanceAutoWalk(
        state.activePixel !== null ? state.activePixel : -1,
        state.autoWalkMode,
        state.walkDirection,
        36
      );
      state.activePixel = nextPixel;
      state.walkDirection = nextDirection;
      return nextPixel;
    },

    // Tab Navigation & Lifecycle Cleanup
    switchTab: (newTabId) => {
      state.currentTab = newTabId;
      // Tab exit cleanup
      if (newTabId !== 1 && state.isAutoWalk) {
        state.isAutoWalk = false;
        state.activePixel = null;
      }
      if (newTabId !== 3 && state.visualizerActive) {
        state.visualizerActive = false;
        state.activePixel = null;
      }
    },

    // Sequencer Control
    setSequencerPlaying: (playing) => {
      state.sequencerPlaying = playing;
      if (!playing) state.sequencerStep = 0;
    },

    stepSequencer: () => {
      if (!state.sequencerPlaying) return 0;
      state.sequencerStep = advanceSequencerStep(state.sequencerStep, 8);
      return state.sequencerStep;
    },

    toggleSequencerCell: (track, stepIndex) => {
      if (state.sequencerTracks[track] && stepIndex >= 0 && stepIndex < 8) {
        state.sequencerTracks[track][stepIndex] = state.sequencerTracks[track][stepIndex] ? 0 : 1;
      }
    },

    clearSequencer: () => {
      state.sequencerTracks = {
        topleft: new Array(8).fill(0),
        bottomleft: new Array(8).fill(0),
        right: new Array(8).fill(0),
      };
    },

    loadSequencerPreset: (preset) => {
      state.sequencerTracks = {
        topleft: sanitizeSequencerPreset(preset.topleft, 8),
        bottomleft: sanitizeSequencerPreset(preset.bottomleft, 8),
        right: sanitizeSequencerPreset(preset.right, 8),
      };
    },

    // Visualizer Control
    setVisualizerActive: (active, mode = state.visualizerMode) => {
      state.visualizerActive = active;
      state.visualizerMode = mode;
      if (!active) {
        state.activePixel = null;
      }
    },

    setVisualizerSensitivity: (sens) => {
      state.visualizerSensitivity = Math.max(0.1, Math.min(3.0, sens));
    },
  };
}

// ============================================================================
// 6. Strict Assertion Primitives
// ============================================================================

function assertInRange(val, min, max, label = 'Value') {
  assert(
    val >= min && val <= max,
    `${label} expected to be between ${min} and ${max}, received ${val}`
  );
}

function assertCloseTo(actual, expected, delta = 0.001, label = 'Value') {
  const diff = Math.abs(actual - expected);
  assert(
    diff <= delta,
    `${label} expected ${expected} ±${delta}, received ${actual} (diff: ${diff})`
  );
}

// Module Exports
module.exports = {
  // Paths & File System
  PROJECT_ROOT,
  STUDIO_ROOT,
  resolvePath,
  loadSource,

  // AST & Code Analysis
  getBabelParser,
  getBabelTraverse,
  parseAST,
  traverseAST,
  findJSXElements,
  extractProp,
  assertAbsenceOfPattern,
  assertPresenceOfPattern,

  // Constants & Math Models
  PHYSICAL_ARCS,
  calculateNormalizedStepDelay,
  calculateAngularVelocity,
  advanceAutoWalk,
  clampAutoWalkSpeed,
  advanceSequencerStep,
  calcStepMs,
  sanitizeSequencerPreset,
  calculateEffectiveBrightness,
  formatPercent,
  safePercent,
  evaluateStrobeEnvelope,
  detectBeatOnset,
  evaluateVisualizerMode,

  // Layout Budget Simulator
  evaluateControlTabLayoutBudget,

  // Headless State Harness
  createStudioStateHarness,

  // Assertions
  assertStrictEqual: assert.strictEqual,
  assertDeepEqual: assert.deepStrictEqual,
  assertInRange,
  assertCloseTo,
  assertThrows: assert.throws,
  assertDoesNotThrow: assert.doesNotThrow,
};
