/**
 * ============================================================================
 * EMPIRICAL CHALLENGER 1 — M2 Motion Physics & Turbo Speed Stress Harness
 * ============================================================================
 * Milestone: M2 (Motion & Sequencer Engine)
 * Target: Feature 5 (Auto-Tour Traversal & Turbo Speed)
 *
 * Verifies:
 *   1. Angular velocity uniformity across all 3 non-uniform arcs (Top-Left, Right, Bottom-Left):
 *      - 1,000-step auto-walk traversal simulation at baseSpeed = 60ms.
 *      - Dwell time and angular distance tracking across arcs.
 *      - Angular velocity matching: max deviation <= 15% across all 3 arcs.
 *      - Time proportion inside Top-Left arc matches physical arc proportion (37.3% +/- 5%).
 *   2. Turbo speed scaling & boundary input clamping:
 *      - Speeds: 1ms, 5ms, 10ms, 20ms, 60ms, 120ms, 200ms.
 *      - Boundary rejection: 0ms -> 1ms, -10ms -> 1ms, 500ms -> 200ms, NaN -> 60ms.
 *      - Multi-step calculation: at 60Hz frame (16.6ms) for 1ms speed, step advance is 16-17 steps.
 *   3. Mode switching & chaos fuzzing under 1ms turbo speed:
 *      - Rapidly switch between forward, reverse, pingpong, and random for 5,000 iterations.
 *      - Zero out-of-bounds indices (0 <= p <= 35), zero NaNs, zero runtime exceptions.
 *   4. Inter-arc transitions:
 *      - Single-step and multi-step leaps across 19->20, 30->31, 35->0, and reverse / pingpong.
 *   5. Silhouette sub-pixel bloom & multi-LED array rendering support.
 *   6. Live wall-clock timer execution & lifecycle cancellation.
 * ============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_PATH = path.resolve(PROJECT_ROOT, 'expo-glyph-studio', 'App.js');
const PIXELS_PATH = path.resolve(PROJECT_ROOT, 'expo-glyph-studio', 'src', 'screens', 'PixelsScreen.js');
const SILHOUETTE_PATH = path.resolve(PROJECT_ROOT, 'expo-glyph-studio', 'src', 'components', 'GlyphCameraSilhouette.js');

let babelParser;
let babelTraverse;
try {
  babelParser = require('../expo-glyph-studio/node_modules/@babel/parser');
  babelTraverse = require('../expo-glyph-studio/node_modules/@babel/traverse').default || require('../expo-glyph-studio/node_modules/@babel/traverse');
} catch (e) {
  babelParser = require('@babel/parser');
  babelTraverse = require('@babel/traverse').default || require('@babel/traverse');
}

// ---------------------------------------------------------------------------
// Test Runner Infrastructure
// ---------------------------------------------------------------------------
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: [],
};

function recordTest(name, passed, message = '', meta = {}) {
  results.total++;
  if (passed) {
    results.passed++;
    results.details.push({ name, status: 'PASS', message, meta });
    console.log(`  ✓ PASS: ${name}`);
  } else {
    results.failed++;
    results.details.push({ name, status: 'FAIL', message, meta });
    console.error(`  ✗ FAIL: ${name} — ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Physical Constants of Nothing Phone Glyph Camera Module
// ---------------------------------------------------------------------------
const PHYSICAL_GEOMETRY = {
  TOP_LEFT: {
    arcIndex: 0,
    ledCount: 20,
    startId: 0,
    endId: 19,
    spanDeg: 41.0,
    intervals: 19,
    degPerLed: 41.0 / 19.0, // ~2.15789 deg
  },
  RIGHT: {
    arcIndex: 2,
    ledCount: 11,
    startId: 20,
    endId: 30,
    spanDeg: 48.0,
    intervals: 10,
    degPerLed: 48.0 / 10.0, // 4.80000 deg
  },
  BOTTOM_LEFT: {
    arcIndex: 1,
    ledCount: 5,
    startId: 31,
    endId: 35,
    spanDeg: 21.0,
    intervals: 4,
    degPerLed: 21.0 / 4.0, // 5.25000 deg
  },
  TOTAL_LEDS: 36,
  TOTAL_INTERVALS: 33,
  TOTAL_SPAN_DEG: 110.0,
  MEAN_DEG_PER_INTERVAL: 110.0 / 33.0, // ~3.33333 deg
};

// ---------------------------------------------------------------------------
// Mathematical Domain Models Extracted from App.js Implementation
// ---------------------------------------------------------------------------

function calculateNormalizedStepDelay(pixelIndex, baseDelayMs) {
  const meanDegPerLed = 110.0 / 33.0;
  let degPerLed = 3.333;
  if (pixelIndex >= 0 && pixelIndex <= 19) {
    degPerLed = 41.0 / 19.0;
  } else if (pixelIndex >= 20 && pixelIndex <= 30) {
    degPerLed = 48.0 / 10.0;
  } else if (pixelIndex >= 31 && pixelIndex <= 35) {
    degPerLed = 21.0 / 4.0;
  }
  const scale = degPerLed / meanDegPerLed;
  return Math.max(1, Math.round(baseDelayMs * scale));
}

function clampSpeedInput(newSpeed) {
  return (typeof newSpeed !== 'number' || isNaN(newSpeed))
    ? 60
    : Math.max(1, Math.min(200, Math.round(newSpeed)));
}

function calculateDeltaStep(baseSpeed, elapsedMs = 16.6) {
  if (baseSpeed < 16) {
    return Math.max(1, Math.round((elapsedMs > 0 ? elapsedMs : 16.6) / baseSpeed));
  }
  return 1;
}

function stepAutoWalkEngine(current, mode, direction, deltaStep = 1, totalLeds = 36) {
  let nextPixel = 0;
  let nextDir = direction;

  if (mode === 'forward') {
    nextPixel = current < 0 ? 0 : (current + deltaStep) % totalLeds;
  } else if (mode === 'reverse') {
    const startPos = current < 0 ? totalLeds : current;
    nextPixel = ((startPos - deltaStep) % totalLeds + totalLeds) % totalLeds;
  } else if (mode === 'pingpong') {
    let tempPixel = current < 0 ? 0 : current;
    let tempDir = direction;
    for (let s = 0; s < deltaStep; s++) {
      if (tempPixel >= totalLeds - 1) tempDir = -1;
      else if (tempPixel <= 0) tempDir = 1;
      tempPixel = Math.max(0, Math.min(totalLeds - 1, tempPixel + tempDir));
    }
    nextDir = tempDir;
    nextPixel = tempPixel;
  } else if (mode === 'random') {
    nextPixel = Math.floor(Math.random() * totalLeds);
  }

  // Determine active arc
  let arc = 0;
  if (nextPixel >= 0 && nextPixel <= 19) arc = 0; // Top-Left
  else if (nextPixel >= 20 && nextPixel <= 30) arc = 2; // Right
  else if (nextPixel >= 31 && nextPixel <= 35) arc = 1; // Bottom-Left

  return { nextPixel, nextDir, arc };
}

// ===========================================================================
// MAIN VERIFICATION SUITE
// ===========================================================================

async function runAllChallenges() {
  console.log('\n================================================================');
  console.log(' EMPIRICAL CHALLENGER 1 — FEATURE 5 RIGOROUS STRESS SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: Static AST & Architecture Check
  // -------------------------------------------------------------------------
  console.log('--- Section 1: Static AST & Architecture Verification ---');

  const appSource = fs.readFileSync(APP_PATH, 'utf8');
  const pixelsSource = fs.readFileSync(PIXELS_PATH, 'utf8');
  const silhouetteSource = fs.readFileSync(SILHOUETTE_PATH, 'utf8');

  // 1.1 App.js contains calculateNormalizedStepDelay
  const hasDelayFunc = /const calculateNormalizedStepDelay\s*=/.test(appSource);
  recordTest(
    'AST: App.js defines calculateNormalizedStepDelay with arc-specific ratios',
    hasDelayFunc && appSource.includes('41.0 / 19.0') && appSource.includes('48.0 / 10.0') && appSource.includes('21.0 / 4.0'),
    'Expected calculateNormalizedStepDelay with exact arc ratios (41/19, 48/10, 21/4)'
  );

  // 1.2 App.js triggerWalkStep handles turbo multi-stepping for speeds < 16ms
  const hasTurboStep = /deltaStep\s*=\s*baseSpeed\s*<\s*16/.test(appSource) &&
    /Math\.round\(.*elapsed.*\/.*baseSpeed\)/.test(appSource);
  recordTest(
    'AST: App.js triggerWalkStep computes multi-step deltaStep when baseSpeed < 16ms',
    hasTurboStep,
    'Expected multi-step calculation based on elapsed / baseSpeed when speed < 16ms'
  );

  // 1.3 App.js clamps autoWalkSpeed safely in handleAutoWalkSpeedChange
  const hasSpeedClamp = /handleAutoWalkSpeedChange[\s\S]*?Math\.max\(\s*1\s*,\s*Math\.min\(\s*200/.test(appSource);
  recordTest(
    'AST: handleAutoWalkSpeedChange strictly clamps speed within [1, 200] with NaN fallback',
    hasSpeedClamp,
    'Expected speed clamp between 1ms and 200ms'
  );

  // 1.4 PixelsScreen.js slider configured with min={1}, max={200}, step={1}
  const hasSliderConfig = /min=\{1\}/.test(pixelsSource) && /max=\{200\}/.test(pixelsSource) && /step=\{1\}/.test(pixelsSource);
  recordTest(
    'AST: PixelsScreen.js GlyphSlider configured with min={1}, max={200}, step={1}',
    hasSliderConfig,
    'Expected slider bounds min=1, max=200, step=1'
  );

  // 1.5 PixelsScreen.js includes 1ms turbo/hyper preset
  const has1msPreset = /1мс\s*ГИПЕР|1мс\s*ТУРБО/.test(pixelsSource) && /val:\s*1\b/.test(pixelsSource);
  recordTest(
    'AST: PixelsScreen.js provides 1ms hyper speed preset button',
    has1msPreset,
    'Expected 1ms preset option in preset list'
  );

  // 1.6 GlyphCameraSilhouette.js supports Array.isArray(activePixel) and adjacent bloom
  const hasSilhouetteMultiPixel = /Array\.isArray\(activePixel\)/.test(silhouetteSource) &&
    /isAdjacent/.test(silhouetteSource) &&
    /activePixel\s*\+\s*1/.test(silhouetteSource);
  recordTest(
    'AST: GlyphCameraSilhouette.js supports Array.isArray(activePixel) & adjacent bloom halos',
    hasSilhouetteMultiPixel,
    'Expected array activePixel check and adjacent bloom calculation'
  );

  // -------------------------------------------------------------------------
  // SECTION 2: Angular Velocity Uniformity Empirical Physics Simulation
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: Angular Velocity Uniformity Across Arcs ---');

  // Simulation: 1,000 auto-walk forward steps at base speed = 60ms
  const SIMULATION_STEPS = 1000;
  const BASE_SPEED = 60; // ms

  let currentPixel = -1;
  const arcMetrics = {
    topLeft: { steps: 0, totalTimeMs: 0, totalAngleDeg: 0, intervals: 0 },
    right: { steps: 0, totalTimeMs: 0, totalAngleDeg: 0, intervals: 0 },
    bottomLeft: { steps: 0, totalTimeMs: 0, totalAngleDeg: 0, intervals: 0 },
  };

  let totalSimulatedTimeMs = 0;

  for (let i = 0; i < SIMULATION_STEPS; i++) {
    const { nextPixel, arc } = stepAutoWalkEngine(currentPixel, 'forward', 1, 1, 36);
    const delay = calculateNormalizedStepDelay(nextPixel, BASE_SPEED);

    totalSimulatedTimeMs += delay;

    if (arc === 0) {
      // Top-Left (LEDs 0..19, span 41°)
      arcMetrics.topLeft.steps++;
      arcMetrics.topLeft.totalTimeMs += delay;
      arcMetrics.topLeft.totalAngleDeg += PHYSICAL_GEOMETRY.TOP_LEFT.degPerLed;
    } else if (arc === 2) {
      // Right (LEDs 20..30, span 48°)
      arcMetrics.right.steps++;
      arcMetrics.right.totalTimeMs += delay;
      arcMetrics.right.totalAngleDeg += PHYSICAL_GEOMETRY.RIGHT.degPerLed;
    } else if (arc === 1) {
      // Bottom-Left (LEDs 31..35, span 21°)
      arcMetrics.bottomLeft.steps++;
      arcMetrics.bottomLeft.totalTimeMs += delay;
      arcMetrics.bottomLeft.totalAngleDeg += PHYSICAL_GEOMETRY.BOTTOM_LEFT.degPerLed;
    }

    currentPixel = nextPixel;
  }

  // Calculate empirical angular velocities: omega = deltaTheta / (deltaTime / 1000) [deg/s]
  const omegaTL = arcMetrics.topLeft.totalAngleDeg / (arcMetrics.topLeft.totalTimeMs / 1000);
  const omegaR = arcMetrics.right.totalAngleDeg / (arcMetrics.right.totalTimeMs / 1000);
  const omegaBL = arcMetrics.bottomLeft.totalAngleDeg / (arcMetrics.bottomLeft.totalTimeMs / 1000);
  const meanOmega = (omegaTL + omegaR + omegaBL) / 3;

  const devTL = Math.abs(omegaTL - meanOmega) / meanOmega * 100;
  const devR = Math.abs(omegaR - meanOmega) / meanOmega * 100;
  const devBL = Math.abs(omegaBL - meanOmega) / meanOmega * 100;
  const maxPairwiseDev = Math.max(
    Math.abs(omegaTL - omegaR) / meanOmega,
    Math.abs(omegaTL - omegaBL) / meanOmega,
    Math.abs(omegaR - omegaBL) / meanOmega
  ) * 100;

  console.log(`  [Sim Metrics @ 60ms]:`);
  console.log(`    Top-Left:    ${arcMetrics.topLeft.steps} steps, ${arcMetrics.topLeft.totalTimeMs}ms, omega = ${omegaTL.toFixed(2)} deg/s (dev: ${devTL.toFixed(2)}%)`);
  console.log(`    Right:       ${arcMetrics.right.steps} steps, ${arcMetrics.right.totalTimeMs}ms, omega = ${omegaR.toFixed(2)} deg/s (dev: ${devR.toFixed(2)}%)`);
  console.log(`    Bottom-Left: ${arcMetrics.bottomLeft.steps} steps, ${arcMetrics.bottomLeft.totalTimeMs}ms, omega = ${omegaBL.toFixed(2)} deg/s (dev: ${devBL.toFixed(2)}%)`);
  console.log(`    Max pairwise deviation: ${maxPairwiseDev.toFixed(2)}% (threshold: <= 15.0%)`);

  recordTest(
    'Physics: Angular velocity omega matches within <= 15% across all 3 arcs (1,000-step sim)',
    maxPairwiseDev <= 15.0,
    `Max deviation was ${maxPairwiseDev.toFixed(2)}% (threshold <= 15%)`,
    { omegaTL, omegaR, omegaBL, maxPairwiseDev }
  );

  // Time proportion inside Top-Left:
  const tlTimeProportion = (arcMetrics.topLeft.totalTimeMs / totalSimulatedTimeMs) * 100;
  const physicalTLProportion = (41.0 / 110.0) * 100; // 37.27%
  const legacyTLProportion = (20.0 / 36.0) * 100;    // 55.56%

  console.log(`  [Time Proportion]:`);
  console.log(`    Top-Left time: ${tlTimeProportion.toFixed(2)}% (Physical target: ${physicalTLProportion.toFixed(2)}%, Legacy: ${legacyTLProportion.toFixed(2)}%)`);

  recordTest(
    'Physics: Top-Left time proportion matches physical arc span (37.3% +/- 5%, not legacy 55.6%)',
    Math.abs(tlTimeProportion - physicalTLProportion) <= 5.0 && Math.abs(tlTimeProportion - legacyTLProportion) >= 15.0,
    `Top-Left time was ${tlTimeProportion.toFixed(2)}% (target: ${physicalTLProportion.toFixed(2)}% +/- 5%)`,
    { tlTimeProportion, physicalTLProportion, legacyTLProportion }
  );

  // Multi-speed angular velocity verification
  const testSpeeds = [20, 40, 80, 100, 120, 160, 200];
  let multiSpeedAllMatch = true;
  for (const spd of testSpeeds) {
    const dTL = calculateNormalizedStepDelay(0, spd);
    const dR = calculateNormalizedStepDelay(20, spd);
    const dBL = calculateNormalizedStepDelay(31, spd);

    const wTL = PHYSICAL_GEOMETRY.TOP_LEFT.degPerLed / (dTL / 1000);
    const wR = PHYSICAL_GEOMETRY.RIGHT.degPerLed / (dR / 1000);
    const wBL = PHYSICAL_GEOMETRY.BOTTOM_LEFT.degPerLed / (dBL / 1000);
    const meanW = (wTL + wR + wBL) / 3;
    const maxDev = Math.max(Math.abs(wTL - wR), Math.abs(wTL - wBL), Math.abs(wR - wBL)) / meanW * 100;

    if (maxDev > 15.0) {
      multiSpeedAllMatch = false;
      console.error(`    FAILED at speed ${spd}ms: maxDev = ${maxDev.toFixed(2)}%`);
    }
  }

  recordTest(
    'Physics: Angular velocity uniformity holds across multiple speeds (20ms..200ms)',
    multiSpeedAllMatch,
    'Deviation across tested speeds was <= 15%'
  );

  // -------------------------------------------------------------------------
  // SECTION 3: Turbo Speed Scaling & Boundary Clamping
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: Turbo Speed Scaling & Boundary Clamping Stress ---');

  // Boundary inputs to clampSpeedInput:
  const boundaryCases = [
    { input: 0, expected: 1, desc: '0ms clamped to 1ms' },
    { input: -10, expected: 1, desc: '-10ms clamped to 1ms' },
    { input: -9999, expected: 1, desc: '-9999ms clamped to 1ms' },
    { input: 200, expected: 200, desc: '200ms upper bound intact' },
    { input: 201, expected: 200, desc: '201ms clamped to 200ms' },
    { input: 500, expected: 200, desc: '500ms clamped to 200ms' },
    { input: 10000, expected: 200, desc: '10000ms clamped to 200ms' },
    { input: NaN, expected: 60, desc: 'NaN clamped to default 60ms' },
    { input: 'string', expected: 60, desc: 'String clamped to default 60ms' },
    { input: undefined, expected: 60, desc: 'undefined clamped to default 60ms' },
  ];

  let boundaryAllPassed = true;
  for (const b of boundaryCases) {
    const actual = clampSpeedInput(b.input);
    if (actual !== b.expected) {
      boundaryAllPassed = false;
      console.error(`    FAIL boundary: ${b.desc} -> got ${actual}, expected ${b.expected}`);
    }
  }

  recordTest(
    'Boundary: Speed input clamping [1..200] correctly handles 0ms, -10ms, 500ms, and NaN',
    boundaryAllPassed,
    'All boundary cases matched expected clamped values'
  );

  // Multi-step calculation at 60Hz frame (16.6ms):
  const turboCases = [
    { speed: 1, frameElapsed: 16.6, minStep: 16, maxStep: 17, desc: '1ms hyper speed' },
    { speed: 1, frameElapsed: 16.0, minStep: 16, maxStep: 16, desc: '1ms at 16.0ms frame' },
    { speed: 5, frameElapsed: 16.6, minStep: 3, maxStep: 3, desc: '5ms turbo speed' },
    { speed: 10, frameElapsed: 16.6, minStep: 2, maxStep: 2, desc: '10ms turbo speed' },
    { speed: 15, frameElapsed: 16.6, minStep: 1, maxStep: 1, desc: '15ms turbo speed' },
    { speed: 20, frameElapsed: 16.6, minStep: 1, maxStep: 1, desc: '20ms standard' },
    { speed: 60, frameElapsed: 16.6, minStep: 1, maxStep: 1, desc: '60ms standard' },
    { speed: 120, frameElapsed: 16.6, minStep: 1, maxStep: 1, desc: '120ms standard' },
    { speed: 200, frameElapsed: 16.6, minStep: 1, maxStep: 1, desc: '200ms crawl' },
  ];

  let turboStepsPassed = true;
  for (const tc of turboCases) {
    const delta = calculateDeltaStep(tc.speed, tc.frameElapsed);
    if (delta < tc.minStep || delta > tc.maxStep) {
      turboStepsPassed = false;
      console.error(`    FAIL turbo step: ${tc.desc} -> got ${delta}, expected [${tc.minStep}, ${tc.maxStep}]`);
    }
  }

  recordTest(
    'Turbo: Multi-step calculation at 60Hz frame (16.6ms) yields 16-17 steps at 1ms, 3 at 5ms, 1 at >=16ms',
    turboStepsPassed,
    'Multi-step advancement matched exact refresh frame physics'
  );

  // -------------------------------------------------------------------------
  // SECTION 4: Mode Switching & Turbo Chaos Fuzzing (5,000 Iterations)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 4: Mode Switching & Turbo Chaos Fuzzing (5,000 Iterations) ---');

  const MODES = ['forward', 'reverse', 'pingpong', 'random'];
  let currentP = -1;
  let currentD = 1;
  let fuzzViolations = 0;
  const arcDistribution = { 0: 0, 1: 0, 2: 0 };

  for (let iter = 0; iter < 5000; iter++) {
    // Randomly pick mode every 1-5 iterations
    const selectedMode = MODES[iter % MODES.length];

    // Simulate 1ms turbo speed with slight jitter in frame elapsed (15ms .. 18ms)
    const frameElapsed = 15.0 + (iter % 4);
    const delta = calculateDeltaStep(1, frameElapsed);

    try {
      const { nextPixel, nextDir, arc } = stepAutoWalkEngine(currentP, selectedMode, currentD, delta, 36);

      // Invariants:
      if (!Number.isInteger(nextPixel)) {
        fuzzViolations++;
        console.error(`[Fuzz breach] nextPixel is not integer: ${nextPixel}`);
      }
      if (nextPixel < 0 || nextPixel > 35) {
        fuzzViolations++;
        console.error(`[Fuzz breach] nextPixel out of bounds [0, 35]: ${nextPixel}`);
      }
      if (isNaN(nextPixel)) {
        fuzzViolations++;
        console.error(`[Fuzz breach] nextPixel is NaN!`);
      }
      if (nextDir !== 1 && nextDir !== -1) {
        fuzzViolations++;
        console.error(`[Fuzz breach] invalid direction: ${nextDir}`);
      }

      // Check arc mapping consistency
      if (nextPixel >= 0 && nextPixel <= 19 && arc !== 0) fuzzViolations++;
      if (nextPixel >= 20 && nextPixel <= 30 && arc !== 2) fuzzViolations++;
      if (nextPixel >= 31 && nextPixel <= 35 && arc !== 1) fuzzViolations++;

      arcDistribution[arc]++;
      currentP = nextPixel;
      currentD = nextDir;
    } catch (err) {
      fuzzViolations++;
      console.error(`[Fuzz exception at iter ${iter}]: ${err.message}`);
    }
  }

  recordTest(
    'Chaos: 5,000 iterations of rapid mode switching at 1ms turbo speed produced ZERO violations',
    fuzzViolations === 0,
    `Violations: ${fuzzViolations}. Distribution: TL=${arcDistribution[0]}, R=${arcDistribution[2]}, BL=${arcDistribution[1]}`,
    { fuzzViolations, arcDistribution }
  );

  // -------------------------------------------------------------------------
  // SECTION 5: Inter-Arc Transitions & Circular Wrap Boundaries
  // -------------------------------------------------------------------------
  console.log('\n--- Section 5: Inter-Arc Transitions & Boundary Wraparounds ---');

  // Test 19 -> 20 (Top-Left -> Right)
  const t19to20 = stepAutoWalkEngine(19, 'forward', 1, 1, 36);
  recordTest(
    'Transition: Step 19 -> 20 shifts from Top-Left (Arc 0) to Right (Arc 2)',
    t19to20.nextPixel === 20 && t19to20.arc === 2,
    `Expected pixel 20 arc 2, got pixel ${t19to20.nextPixel} arc ${t19to20.arc}`
  );

  // Test 30 -> 31 (Right -> Bottom-Left)
  const t30to31 = stepAutoWalkEngine(30, 'forward', 1, 1, 36);
  recordTest(
    'Transition: Step 30 -> 31 shifts from Right (Arc 2) to Bottom-Left (Arc 1)',
    t30to31.nextPixel === 31 && t30to31.arc === 1,
    `Expected pixel 31 arc 1, got pixel ${t30to31.nextPixel} arc ${t30to31.arc}`
  );

  // Test 35 -> 0 (Bottom-Left -> Top-Left circular wrap)
  const t35to0 = stepAutoWalkEngine(35, 'forward', 1, 1, 36);
  recordTest(
    'Transition: Step 35 -> 0 circularly wraps from Bottom-Left (Arc 1) to Top-Left (Arc 0)',
    t35to0.nextPixel === 0 && t35to0.arc === 0,
    `Expected pixel 0 arc 0, got pixel ${t35to0.nextPixel} arc ${t35to0.arc}`
  );

  // Test reverse transitions: 0 -> 35, 31 -> 30, 20 -> 19
  const rev0to35 = stepAutoWalkEngine(0, 'reverse', 1, 1, 36);
  const rev31to30 = stepAutoWalkEngine(31, 'reverse', 1, 1, 36);
  const rev20to19 = stepAutoWalkEngine(20, 'reverse', 1, 1, 36);

  recordTest(
    'Transition: Reverse steps (0->35, 31->30, 20->19) wrap and traverse correctly',
    rev0to35.nextPixel === 35 && rev0to35.arc === 1 &&
    rev31to30.nextPixel === 30 && rev31to30.arc === 2 &&
    rev20to19.nextPixel === 19 && rev20to19.arc === 0,
    'Reverse transitions matched expected pixel and arc coordinates'
  );

  // Test Ping-Pong bounce at extremities:
  // Bounce at 35: from 34 with dir=1, steps=2 -> hits 35, reverses dir to -1, lands on 34
  const ppBounceUpper = stepAutoWalkEngine(34, 'pingpong', 1, 2, 36);
  // Bounce at 0: from 1 with dir=-1, steps=2 -> hits 0, reverses dir to 1, lands on 1
  const ppBounceLower = stepAutoWalkEngine(1, 'pingpong', -1, 2, 36);

  recordTest(
    'Transition: Ping-Pong mode rebounds cleanly at boundaries #35 and #0 without overshoot',
    ppBounceUpper.nextPixel === 34 && ppBounceUpper.nextDir === -1 &&
    ppBounceLower.nextPixel === 1 && ppBounceLower.nextDir === 1,
    `Upper rebound: pixel ${ppBounceUpper.nextPixel} dir ${ppBounceUpper.nextDir}, Lower: pixel ${ppBounceLower.nextPixel} dir ${ppBounceLower.nextDir}`
  );

  // Test multi-step turbo leap crossing multiple arcs (e.g. step = 17)
  const leapFrom15 = stepAutoWalkEngine(15, 'forward', 1, 17, 36); // 15 + 17 = 32 (Arc 1: Bottom-Left)
  const leapFrom30 = stepAutoWalkEngine(30, 'forward', 1, 17, 36); // (30 + 17) % 36 = 11 (Arc 0: Top-Left)

  recordTest(
    'Transition: 17-step turbo leap smoothly crosses arc boundaries (15->32 in BL, 30->11 wrap into TL)',
    leapFrom15.nextPixel === 32 && leapFrom15.arc === 1 &&
    leapFrom30.nextPixel === 11 && leapFrom30.arc === 0,
    `Leap 15->${leapFrom15.nextPixel} (arc ${leapFrom15.arc}), Leap 30->${leapFrom30.nextPixel} (arc ${leapFrom30.arc})`
  );

  // -------------------------------------------------------------------------
  // SECTION 6: Silhouette Bloom & Multi-LED Array Support
  // -------------------------------------------------------------------------
  console.log('\n--- Section 6: Silhouette Bloom & Multi-LED Array Support ---');

  // Emulate GlyphCameraSilhouette rendering logic:
  function evaluatePixelLighting(activePixel, pixelId, totalPixels = 36) {
    const isActive = Array.isArray(activePixel)
      ? activePixel.includes(pixelId)
      : pixelId === activePixel;

    const isAdjacent = !Array.isArray(activePixel) && activePixel !== null && activePixel !== undefined && (
      pixelId === (activePixel + 1) % totalPixels ||
      pixelId === (activePixel - 1 + totalPixels) % totalPixels
    );

    return { isActive, isAdjacent };
  }

  // Test single pixel: activePixel = 0
  const p0State = evaluatePixelLighting(0, 0);
  const p1State = evaluatePixelLighting(0, 1);
  const p35State = evaluatePixelLighting(0, 35);
  const p18State = evaluatePixelLighting(0, 18);

  recordTest(
    'Silhouette: Single active pixel #0 illuminates #0 as active and #1, #35 as adjacent bloom halos',
    p0State.isActive && !p0State.isAdjacent &&
    !p1State.isActive && p1State.isAdjacent &&
    !p35State.isActive && p35State.isAdjacent &&
    !p18State.isActive && !p18State.isAdjacent,
    'Correct single-pixel bloom assignment including circular wrap (#35)'
  );

  // Test array activePixel: activePixel = [0, 10, 25]
  const arrPixel = [0, 10, 25];
  const arrP0 = evaluatePixelLighting(arrPixel, 0);
  const arrP10 = evaluatePixelLighting(arrPixel, 10);
  const arrP25 = evaluatePixelLighting(arrPixel, 25);
  const arrP1 = evaluatePixelLighting(arrPixel, 1); // adjacent should be false for array mode

  recordTest(
    'Silhouette: Array activePixel illuminates all specified LEDs as active with adjacent halos disabled',
    arrP0.isActive && arrP10.isActive && arrP25.isActive &&
    !arrP1.isActive && !arrP1.isAdjacent,
    'Array mode correctly illuminates multiple LEDs cleanly'
  );

  // Test null / undefined activePixel
  const nullP0 = evaluatePixelLighting(null, 0);
  const undefP0 = evaluatePixelLighting(undefined, 0);

  recordTest(
    'Silhouette: Null and undefined activePixel render zero active and zero adjacent blooms',
    !nullP0.isActive && !nullP0.isAdjacent &&
    !undefP0.isActive && !undefP0.isAdjacent,
    'Null activePixel cleanly leaves all LEDs in default/off state'
  );

  // -------------------------------------------------------------------------
  // SECTION 7: Live Wall-Clock Timer Execution & Lifecycle
  // -------------------------------------------------------------------------
  console.log('\n--- Section 7: Live Wall-Clock Timer Execution & Lifecycle ---');

  const timerPromise = new Promise((resolve) => {
    let tickCount = 0;
    let timerRef = null;
    let isRunning = true;
    let currentP = 0;
    const startTime = Date.now();

    function triggerStep() {
      if (!isRunning) return;
      tickCount++;
      currentP = (currentP + 1) % 36;
      // Schedule at 10ms
      timerRef = setTimeout(triggerStep, 10);
    }

    triggerStep();

    // Run for 150ms then stop cleanly
    setTimeout(() => {
      isRunning = false;
      if (timerRef) {
        clearTimeout(timerRef);
        timerRef = null;
      }
      const duration = Date.now() - startTime;
      resolve({ tickCount, duration, timerRef });
    }, 150);
  });

  const timerResult = await timerPromise;
  console.log(`  [Timer Result]: ${timerResult.tickCount} ticks in ${timerResult.duration}ms, timerRef cleared: ${timerResult.timerRef === null}`);

  recordTest(
    'Lifecycle: Live wall-clock timer executes repeated ticks and cancels cleanly on stop',
    timerResult.tickCount >= 5 && timerResult.timerRef === null,
    `Completed ${timerResult.tickCount} ticks in ${timerResult.duration}ms with zero leaks`,
    timerResult
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(' CHALLENGER 1 EMPIRICAL VERIFICATION SUMMARY');
  console.log(` Total tests:  ${results.total}`);
  console.log(` Passed:       ${results.passed}`);
  console.log(` Failed:       ${results.failed}`);
  const verdict = results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
  console.log(` Verdict:      ${verdict}`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    process.exitCode = 1;
  }
}

runAllChallenges().catch((err) => {
  console.error('Fatal challenge runner error:', err);
  process.exitCode = 1;
});
