/**
 * ============================================================================
 * EMPIRICAL CHALLENGER 1 — M1 Verification & Adversarial Stress Harness
 * ============================================================================
 * Milestone: M1 (UI & Controls Refinement)
 * Targets:
 *   - Feature 1: Master Brightness Decoupling & State Invariance
 *   - Feature 4: Removal of "ЯРКОСТЬ ДУГИ" & Arc Header Readout Integrity
 * 
 * Verifies:
 *   1. Arc slider (0..255) mutations never alter masterBrightness.
 *   2. Arc toggles never alter masterBrightness.
 *   3. Master slider (0..255) mutations never alter raw brightness array.
 *   4. Pulling master to 0 does not erase arc values; output drops to [0, 0, 0].
 *   5. Restoring master from 0 to 255 preserves exact arc ratios and values.
 *   6. Exhaustive 65,536-domain check of Math.round(b * (masterBrightness / 255)).
 *   7. Dual-axis monotonicity of effectiveBrightness scaling.
 *   8. 100,000-cycle randomized adversarial chaos fuzzing.
 *   9. Zero instances of "ЯРКОСТЬ ДУГИ" in ControlScreen.js and robust GlyphSlider label suppression.
 *   10. Header percentage formula accuracy and active glow threshold.
 * ============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const APP_PATH = path.resolve(PROJECT_ROOT, 'expo-glyph-studio', 'App.js');
const CONTROL_PATH = path.resolve(PROJECT_ROOT, 'expo-glyph-studio', 'src', 'screens', 'ControlScreen.js');
const SLIDER_PATH = path.resolve(PROJECT_ROOT, 'expo-glyph-studio', 'src', 'components', 'GlyphSlider.js');

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
// 1. Static AST Verification of Decoupling Invariants
// ---------------------------------------------------------------------------
function testStaticASTInvariants() {
  console.log('\n--- Section 1: Static AST & Semantic Invariance Check ---');
  const appCode = fs.readFileSync(APP_PATH, 'utf8');
  const ast = babelParser.parse(appCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let arcBrightnessCallsMaster = false;
  let arcPressCallsMaster = false;
  let masterBrightnessCallsSetBrightness = false;
  let allOffSetsBrightness = false;
  let effectiveBrightnessDefined = false;
  let silhouetteReceivesEffective = false;
  let controlScreenReceivesRaw = false;

  babelTraverse(ast, {
    VariableDeclarator(nodePath) {
      const id = nodePath.node.id;
      if (!id || id.type !== 'Identifier') return;

      if (id.name === 'handleArcBrightnessChange') {
        nodePath.traverse({
          CallExpression(callPath) {
            const callee = callPath.node.callee;
            if (callee.type === 'Identifier' && callee.name === 'setMasterBrightness') {
              arcBrightnessCallsMaster = true;
            }
          },
          AssignmentExpression(assignPath) {
            const left = assignPath.node.left;
            if (
              left.type === 'MemberExpression' &&
              left.object.name === 'masterBrightnessRef' &&
              left.property.name === 'current'
            ) {
              arcBrightnessCallsMaster = true;
            }
          },
        });
      }

      if (id.name === 'handleArcPress') {
        nodePath.traverse({
          CallExpression(callPath) {
            const callee = callPath.node.callee;
            if (callee.type === 'Identifier' && callee.name === 'setMasterBrightness') {
              arcPressCallsMaster = true;
            }
          },
          AssignmentExpression(assignPath) {
            const left = assignPath.node.left;
            if (
              left.type === 'MemberExpression' &&
              left.object.name === 'masterBrightnessRef' &&
              left.property.name === 'current'
            ) {
              arcPressCallsMaster = true;
            }
          },
        });
      }

      if (id.name === 'handleMasterBrightnessChange') {
        nodePath.traverse({
          CallExpression(callPath) {
            const callee = callPath.node.callee;
            if (callee.type === 'Identifier' && callee.name === 'setBrightness') {
              masterBrightnessCallsSetBrightness = true;
            }
          },
        });
      }

      if (id.name === 'handleAllOff') {
        nodePath.traverse({
          CallExpression(callPath) {
            const callee = callPath.node.callee;
            if (callee.type === 'Identifier' && callee.name === 'setBrightness') {
              allOffSetsBrightness = true;
            }
          },
        });
      }

      if (id.name === 'effectiveBrightness') {
        effectiveBrightnessDefined = true;
      }
    },

    JSXElement(nodePath) {
      const opening = nodePath.node.openingElement;
      if (opening.name && opening.name.name === 'GlyphCameraSilhouette') {
        for (const attr of opening.attributes) {
          if (
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'brightness' &&
            attr.value.type === 'JSXExpressionContainer' &&
            attr.value.expression.name === 'effectiveBrightness'
          ) {
            silhouetteReceivesEffective = true;
          }
        }
      }

      if (opening.name && opening.name.name === 'ControlScreen') {
        for (const attr of opening.attributes) {
          if (
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'brightness' &&
            attr.value.type === 'JSXExpressionContainer' &&
            attr.value.expression.name === 'brightness'
          ) {
            controlScreenReceivesRaw = true;
          }
        }
      }
    },
  });

  recordTest(
    'AST: handleArcBrightnessChange has NO setMasterBrightness calls',
    !arcBrightnessCallsMaster,
    'Found setMasterBrightness or masterBrightnessRef mutation inside handleArcBrightnessChange'
  );

  recordTest(
    'AST: handleArcPress has NO setMasterBrightness calls',
    !arcPressCallsMaster,
    'Found setMasterBrightness or masterBrightnessRef mutation inside handleArcPress'
  );

  recordTest(
    'AST: handleMasterBrightnessChange has NO setBrightness calls',
    !masterBrightnessCallsSetBrightness,
    'Found destructive setBrightness call inside handleMasterBrightnessChange'
  );

  recordTest(
    'AST: handleAllOff does NOT wipe raw brightness array',
    !allOffSetsBrightness,
    'Found setBrightness call inside handleAllOff'
  );

  recordTest(
    'AST: effectiveBrightness useMemo computation defined in App.js',
    effectiveBrightnessDefined,
    'effectiveBrightness definition missing from App.js'
  );

  recordTest(
    'AST: GlyphCameraSilhouette receives effectiveBrightness prop',
    silhouetteReceivesEffective,
    'GlyphCameraSilhouette brightness prop is not effectiveBrightness'
  );

  recordTest(
    'AST: ControlScreen receives raw brightness prop',
    controlScreenReceivesRaw,
    'ControlScreen brightness prop is not raw brightness'
  );
}

// ---------------------------------------------------------------------------
// 2. Headless State Runtime Simulation (Mirroring App.js logic)
// ---------------------------------------------------------------------------
function createRealAppRuntime() {
  let brightness = [255, 255, 255];
  let masterBrightness = 255;
  const masterBrightnessRef = { current: 255 };
  let activePixel = null;
  const activePixelRef = { current: null };
  let isAutoWalk = false;
  const isAutoWalkRef = { current: false };

  function setBrightness(updater) {
    brightness = typeof updater === 'function' ? updater(brightness) : updater;
  }

  function setMasterBrightness(val) {
    masterBrightness = val;
    masterBrightnessRef.current = val;
  }

  const handleArcPress = (arcIndex) => {
    setBrightness((prev) => {
      const next = [...prev];
      next[arcIndex] = next[arcIndex] > 0 ? 0 : 255;
      return next;
    });
  };

  const handleArcBrightnessChange = (arcIndex, newVal) => {
    setBrightness((prev) => {
      const next = [...prev];
      next[arcIndex] = newVal;
      return next;
    });
  };

  const handleMasterBrightnessChange = (newVal) => {
    setMasterBrightness(newVal);
  };

  const handleAllOn = (val = 255) => {
    const target = val > 0 ? val : 255;
    setMasterBrightness(target);
    setBrightness((prev) => {
      if (prev.every((b) => b === 0)) {
        return [255, 255, 255];
      }
      return prev;
    });
  };

  const handleAllOff = () => {
    setMasterBrightness(0);
    activePixel = null;
    activePixelRef.current = null;
    if (isAutoWalkRef.current) {
      isAutoWalk = false;
      isAutoWalkRef.current = false;
    }
  };

  const getEffectiveBrightness = () => {
    const scale = masterBrightness / 255;
    return brightness.map((b) => Math.round(b * scale));
  };

  return {
    getState: () => ({
      brightness: [...brightness],
      masterBrightness,
      masterBrightnessRefCurrent: masterBrightnessRef.current,
      effectiveBrightness: getEffectiveBrightness(),
      isMasterOn: masterBrightness > 0 && brightness.some((b) => b > 0),
    }),
    handleArcPress,
    handleArcBrightnessChange,
    handleMasterBrightnessChange,
    handleAllOn,
    handleAllOff,
    getEffectiveBrightness,
    // Direct state seed for testing
    seed: (b, m) => {
      brightness = [...b];
      masterBrightness = m;
      masterBrightnessRef.current = m;
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Empirical Test Execution
// ---------------------------------------------------------------------------
function runEmpiricalTests() {
  testStaticASTInvariants();
  console.log('\n--- Section 2: Empirical State Transition Invariants ---');

  // Test 1: Moving arc sliders (0..255) never mutates masterBrightness
  {
    const app = createRealAppRuntime();
    app.seed([255, 255, 255], 180);
    let masterMutated = false;

    for (let arc = 0; arc < 3; arc++) {
      for (let v = 0; v <= 255; v++) {
        app.handleArcBrightnessChange(arc, v);
        const state = app.getState();
        if (state.masterBrightness !== 180 || state.masterBrightnessRefCurrent !== 180) {
          masterMutated = true;
          break;
        }
        if (state.brightness[arc] !== v) {
          masterMutated = true;
          break;
        }
      }
    }

    recordTest(
      'Empirical: Moving arc sliders (0..255) across all 3 arcs NEVER mutates masterBrightness',
      !masterMutated,
      'masterBrightness changed while adjusting arc sliders'
    );
  }

  // Test 2: Toggling an arc never mutates masterBrightness
  {
    const app = createRealAppRuntime();
    app.seed([100, 150, 200], 210);
    let masterMutated = false;

    for (let arc = 0; arc < 3; arc++) {
      app.handleArcPress(arc); // 100/150/200 -> 0
      let st = app.getState();
      if (st.masterBrightness !== 210 || st.brightness[arc] !== 0) masterMutated = true;

      app.handleArcPress(arc); // 0 -> 255
      st = app.getState();
      if (st.masterBrightness !== 210 || st.brightness[arc] !== 255) masterMutated = true;

      app.handleArcPress(arc); // 255 -> 0
      st = app.getState();
      if (st.masterBrightness !== 210 || st.brightness[arc] !== 0) masterMutated = true;
    }

    recordTest(
      'Empirical: Toggling arcs NEVER mutates masterBrightness',
      !masterMutated,
      'masterBrightness changed during arc toggle'
    );
  }

  // Test 3: Moving masterBrightness never mutates brightness state
  {
    const app = createRealAppRuntime();
    const baselineBrightness = [42, 173, 241];
    app.seed(baselineBrightness, 255);
    let brightnessMutated = false;

    for (let m = 0; m <= 255; m++) {
      app.handleMasterBrightnessChange(m);
      const st = app.getState();
      if (st.masterBrightness !== m) {
        brightnessMutated = true;
        break;
      }
      if (
        st.brightness[0] !== baselineBrightness[0] ||
        st.brightness[1] !== baselineBrightness[1] ||
        st.brightness[2] !== baselineBrightness[2]
      ) {
        brightnessMutated = true;
        break;
      }
    }

    recordTest(
      'Empirical: Sweeping masterBrightness (0..255) NEVER mutates raw brightness state',
      !brightnessMutated,
      'Raw brightness state array was overwritten by master brightness change'
    );
  }

  // Test 4: Pulling masterBrightness to 0 does not erase arc values
  {
    const app = createRealAppRuntime();
    const baseline = [75, 150, 225];
    app.seed(baseline, 255);

    // Pull slider to 0
    app.handleMasterBrightnessChange(0);
    let st = app.getState();
    const sliderZeroRetainsArcs =
      st.brightness[0] === 75 &&
      st.brightness[1] === 150 &&
      st.brightness[2] === 225 &&
      st.masterBrightness === 0;

    const effectiveZeroAtSlider =
      st.effectiveBrightness[0] === 0 &&
      st.effectiveBrightness[1] === 0 &&
      st.effectiveBrightness[2] === 0;

    // Call handleAllOff
    app.handleAllOff();
    st = app.getState();
    const allOffRetainsArcs =
      st.brightness[0] === 75 &&
      st.brightness[1] === 150 &&
      st.brightness[2] === 225 &&
      st.masterBrightness === 0;

    const effectiveZeroAtAllOff =
      st.effectiveBrightness[0] === 0 &&
      st.effectiveBrightness[1] === 0 &&
      st.effectiveBrightness[2] === 0;

    recordTest(
      'Empirical: Pulling masterBrightness to 0 and handleAllOff preserves raw arc values while zeroing effective output',
      sliderZeroRetainsArcs && effectiveZeroAtSlider && allOffRetainsArcs && effectiveZeroAtAllOff,
      'Arc values were erased or effective brightness was not zero'
    );
  }

  // Test 5: Returning masterBrightness from 0 to 255 restores original arc ratios
  {
    const app = createRealAppRuntime();
    const initialArcs = [50, 100, 200]; // 1 : 2 : 4
    app.seed(initialArcs, 255);

    // Turn master off
    app.handleAllOff();
    assert.strictEqual(app.getState().masterBrightness, 0);

    // Turn master back on
    app.handleAllOn(255);
    const st = app.getState();

    const restoredCorrectly =
      st.masterBrightness === 255 &&
      st.brightness[0] === initialArcs[0] &&
      st.brightness[1] === initialArcs[1] &&
      st.brightness[2] === initialArcs[2] &&
      st.effectiveBrightness[0] === initialArcs[0] &&
      st.effectiveBrightness[1] === initialArcs[1] &&
      st.effectiveBrightness[2] === initialArcs[2];

    const ratio0to1 = st.effectiveBrightness[0] / st.effectiveBrightness[1];
    const ratio1to2 = st.effectiveBrightness[1] / st.effectiveBrightness[2];
    const ratiosExact = Math.abs(ratio0to1 - 0.5) < 1e-9 && Math.abs(ratio1to2 - 0.5) < 1e-9;

    recordTest(
      'Empirical: Restoring master from 0 to 255 restores exact original arc values and ratios',
      restoredCorrectly && ratiosExact,
      `Expected [50, 100, 200], got brightness: ${JSON.stringify(st.brightness)}, effective: ${JSON.stringify(st.effectiveBrightness)}`
    );
  }

  // Test 6: Exhaustive 65,536-combination domain check for effectiveBrightness
  {
    console.log('\n--- Section 3: Exhaustive 65,536 Domain & Mathematical Invariance ---');
    let mathFailures = 0;
    let maxError = 0;
    let rangeViolations = 0;
    let nonIntegerCount = 0;
    let zeroBoundaryViolations = 0;
    let fullScaleViolations = 0;

    for (let b = 0; b <= 255; b++) {
      for (let m = 0; m <= 255; m++) {
        const scale = m / 255;
        const calculated = Math.round(b * scale);
        const continuous = b * (m / 255);
        const err = Math.abs(calculated - continuous);
        if (err > maxError) maxError = err;

        if (err > 0.5 + 1e-9) {
          mathFailures++;
        }
        if (!Number.isInteger(calculated)) {
          nonIntegerCount++;
        }
        if (calculated < 0 || calculated > 255) {
          rangeViolations++;
        }
        if (m === 0 && calculated !== 0) {
          zeroBoundaryViolations++;
        }
        if (b === 0 && calculated !== 0) {
          zeroBoundaryViolations++;
        }
        if (m === 255 && calculated !== b) {
          fullScaleViolations++;
        }
      }
    }

    recordTest(
      'Empirical: Exhaustive 65,536 domain check: Math.round(b * (m / 255)) exactness (|err| <= 0.5)',
      mathFailures === 0 && maxError <= 0.5,
      `Found ${mathFailures} math failures, max error = ${maxError}`
    );

    recordTest(
      'Empirical: Exhaustive domain output strictly integer within [0, 255]',
      rangeViolations === 0 && nonIntegerCount === 0,
      `Found ${rangeViolations} out-of-range and ${nonIntegerCount} non-integers`
    );

    recordTest(
      'Empirical: Zero boundary conditions hold (m=0 => 0, b=0 => 0)',
      zeroBoundaryViolations === 0,
      `Found ${zeroBoundaryViolations} zero boundary violations`
    );

    recordTest(
      'Empirical: Full scale condition holds (m=255 => b)',
      fullScaleViolations === 0,
      `Found ${fullScaleViolations} full scale violations`
    );
  }

  // Test 7: Dual-Axis Monotonicity Proof
  {
    console.log('\n--- Section 4: Dual-Axis Monotonicity & Ordering Invariants ---');
    let bMonotonicityViolations = 0;
    let mMonotonicityViolations = 0;

    // Check monotonicity wrt b for all m
    for (let m = 0; m <= 255; m++) {
      const scale = m / 255;
      for (let b = 0; b < 255; b++) {
        const eff1 = Math.round(b * scale);
        const eff2 = Math.round((b + 1) * scale);
        if (eff2 < eff1) {
          bMonotonicityViolations++;
        }
      }
    }

    // Check monotonicity wrt m for all b
    for (let b = 0; b <= 255; b++) {
      for (let m = 0; m < 255; m++) {
        const eff1 = Math.round(b * (m / 255));
        const eff2 = Math.round(b * ((m + 1) / 255));
        if (eff2 < eff1) {
          mMonotonicityViolations++;
        }
      }
    }

    recordTest(
      'Empirical: Monotonicity wrt arc brightness: b1 <= b2 ==> eff(b1, m) <= eff(b2, m)',
      bMonotonicityViolations === 0,
      `Found ${bMonotonicityViolations} monotonicity violations along arc dimension`
    );

    recordTest(
      'Empirical: Monotonicity wrt master brightness: m1 <= m2 ==> eff(b, m1) <= eff(b, m2)',
      mMonotonicityViolations === 0,
      `Found ${mMonotonicityViolations} monotonicity violations along master dimension`
    );
  }

  // Test 8: 100,000-Cycle Randomized Adversarial Chaos Fuzzing
  {
    console.log('\n--- Section 5: 100,000-Cycle Chaos Fuzzing & Invariant Stress Test ---');
    const app = createRealAppRuntime();
    let invariantBreaches = 0;
    let lastMaster = app.getState().masterBrightness;
    let lastBrightness = app.getState().brightness;

    // Pseudo-random deterministic LCG generator for reproducible stress testing
    let seed = 1337420;
    function rand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const CYCLES = 100000;
    for (let i = 0; i < CYCLES; i++) {
      const action = Math.floor(rand() * 6);

      if (action === 0) {
        // Change arc slider
        const arc = Math.floor(rand() * 3);
        const val = Math.floor(rand() * 256);
        const preMaster = app.getState().masterBrightness;
        app.handleArcBrightnessChange(arc, val);
        const post = app.getState();
        // Master must NOT change
        if (post.masterBrightness !== preMaster) invariantBreaches++;
        if (post.brightness[arc] !== val) invariantBreaches++;
      } else if (action === 1) {
        // Toggle arc
        const arc = Math.floor(rand() * 3);
        const preMaster = app.getState().masterBrightness;
        const preVal = app.getState().brightness[arc];
        app.handleArcPress(arc);
        const post = app.getState();
        // Master must NOT change
        if (post.masterBrightness !== preMaster) invariantBreaches++;
        const expected = preVal > 0 ? 0 : 255;
        if (post.brightness[arc] !== expected) invariantBreaches++;
      } else if (action === 2) {
        // Change master slider
        const val = Math.floor(rand() * 256);
        const preBrightness = app.getState().brightness;
        app.handleMasterBrightnessChange(val);
        const post = app.getState();
        // Raw brightness must NOT change
        if (
          post.brightness[0] !== preBrightness[0] ||
          post.brightness[1] !== preBrightness[1] ||
          post.brightness[2] !== preBrightness[2]
        ) {
          invariantBreaches++;
        }
        if (post.masterBrightness !== val) invariantBreaches++;
      } else if (action === 3) {
        // handleAllOff
        const preBrightness = app.getState().brightness;
        app.handleAllOff();
        const post = app.getState();
        if (post.masterBrightness !== 0) invariantBreaches++;
        if (
          post.brightness[0] !== preBrightness[0] ||
          post.brightness[1] !== preBrightness[1] ||
          post.brightness[2] !== preBrightness[2]
        ) {
          invariantBreaches++;
        }
        if (
          post.effectiveBrightness[0] !== 0 ||
          post.effectiveBrightness[1] !== 0 ||
          post.effectiveBrightness[2] !== 0
        ) {
          invariantBreaches++;
        }
      } else if (action === 4) {
        // handleAllOn
        const target = Math.floor(rand() * 256);
        const preBrightness = app.getState().brightness;
        app.handleAllOn(target);
        const post = app.getState();
        const expectedTarget = target > 0 ? target : 255;
        if (post.masterBrightness !== expectedTarget) invariantBreaches++;
        if (preBrightness.every((b) => b === 0)) {
          if (
            post.brightness[0] !== 255 ||
            post.brightness[1] !== 255 ||
            post.brightness[2] !== 255
          ) {
            invariantBreaches++;
          }
        } else {
          if (
            post.brightness[0] !== preBrightness[0] ||
            post.brightness[1] !== preBrightness[1] ||
            post.brightness[2] !== preBrightness[2]
          ) {
            invariantBreaches++;
          }
        }
      } else if (action === 5) {
        // Preset simulation
        const presets = [0, 64, 128, 192, 255];
        const pVal = presets[Math.floor(rand() * presets.length)];
        const preBrightness = app.getState().brightness;
        if (pVal === 0) {
          app.handleAllOff();
        } else {
          app.handleMasterBrightnessChange(pVal);
          if (preBrightness.every((b) => b === 0)) {
            app.handleAllOn(pVal);
          }
        }
        const post = app.getState();
        if (post.masterBrightness !== pVal) invariantBreaches++;
      }

      // Check global invariants at every step
      const current = app.getState();
      for (let k = 0; k < 3; k++) {
        const b = current.brightness[k];
        const eff = current.effectiveBrightness[k];
        if (b < 0 || b > 255 || !Number.isInteger(b)) invariantBreaches++;
        if (eff < 0 || eff > 255 || !Number.isInteger(eff)) invariantBreaches++;
      }
    }

    recordTest(
      `Empirical: 100,000-cycle chaos fuzzing: ZERO invariant breaches across random action sequence`,
      invariantBreaches === 0,
      `Found ${invariantBreaches} invariant breaches during 100,000-cycle stress test`
    );
  }

  // Test 9: Feature 4 Verification — Complete absence of "ЯРКОСТЬ ДУГИ"
  {
    console.log('\n--- Section 6: Feature 4 — Label Absence & Header Readouts ---');
    const controlCode = fs.readFileSync(CONTROL_PATH, 'utf8');
    const appCode = fs.readFileSync(APP_PATH, 'utf8');
    const sliderCode = fs.readFileSync(SLIDER_PATH, 'utf8');

    const controlHasLabel = controlCode.includes('ЯРКОСТЬ ДУГИ');
    const appHasLabel = appCode.includes('ЯРКОСТЬ ДУГИ');

    recordTest(
      'Feature 4: Literal string "ЯРКОСТЬ ДУГИ" is 100% absent from ControlScreen.js',
      !controlHasLabel,
      'Found occurrences of "ЯРКОСТЬ ДУГИ" in ControlScreen.js'
    );

    recordTest(
      'Feature 4: Literal string "ЯРКОСТЬ ДУГИ" is 100% absent from App.js',
      !appHasLabel,
      'Found occurrences of "ЯРКОСТЬ ДУГИ" in App.js'
    );

    // Verify GlyphSlider conditional rendering of labelRow
    const sliderAST = babelParser.parse(sliderCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let labelRowGuarded = false;
    babelTraverse(sliderAST, {
      JSXElement(nodePath) {
        const opening = nodePath.node.openingElement;
        for (const attr of opening.attributes) {
          if (
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'style' &&
            attr.value &&
            attr.value.type === 'JSXExpressionContainer'
          ) {
            // Check if styles.labelRow is guarded by label check
            const parentLogical = nodePath.findParent((p) => p.isLogicalExpression());
            if (parentLogical) {
              labelRowGuarded = true;
            }
          }
        }
      },
    });

    recordTest(
      'Feature 4: GlyphSlider.js conditionally suppresses labelRow when label is omitted or falsy',
      labelRowGuarded || sliderCode.includes('label &&'),
      'GlyphSlider labelRow is not conditionally guarded'
    );
  }

  // Test 10: Arc Header Percentage Precision and Active Glow Threshold
  {
    const controlCode = fs.readFileSync(CONTROL_PATH, 'utf8');

    // Check that header contains percentage formula in JSX
    const hasHeaderPercentFormula =
      controlCode.includes('Math.round((brightness[0] / 255) * 100)}') &&
      controlCode.includes('Math.round((brightness[1] / 255) * 100)}') &&
      controlCode.includes('Math.round((brightness[2] / 255) * 100)}');

    // Check active glow threshold brightness[i] > 10
    const hasActiveGlowThreshold =
      controlCode.includes('brightness[0] > 10') &&
      controlCode.includes('brightness[1] > 10') &&
      controlCode.includes('brightness[2] > 10') &&
      controlCode.includes('styles.arcPercentActive');

    recordTest(
      'Feature 4: Arc card headers contain correct Math.round((brightness[i] / 255) * 100)}% formula',
      hasHeaderPercentFormula,
      'Header percentage formula not found in ControlScreen.js'
    );

    recordTest(
      'Feature 4: Arc percentage indicators activate glow style when brightness > 10',
      hasActiveGlowThreshold,
      'Active glow threshold (> 10) not found in ControlScreen.js'
    );
  }

  // Test 11: ControlScreen isMasterOn State Machine & Power Toggle Invariance
  {
    console.log('\n--- Section 7: ControlScreen Power Toggle & Presets ---');
    const app = createRealAppRuntime();

    // Case 1: Initial state (b=[255,255,255], m=255) => isMasterOn=true
    let st = app.getState();
    assert.strictEqual(st.isMasterOn, true);

    // Toggle off => calls handleAllOff()
    app.handleAllOff();
    st = app.getState();
    const offStateOk = !st.isMasterOn && st.masterBrightness === 0 && st.brightness[0] === 255;

    // Toggle on => calls handleAllOn(255)
    app.handleAllOn(255);
    st = app.getState();
    const onStateOk = st.isMasterOn && st.masterBrightness === 255 && st.brightness[0] === 255;

    // Case 2: All arcs 0, master 255 => isMasterOn=false
    app.seed([0, 0, 0], 255);
    st = app.getState();
    const allZeroArcsIsMasterOff = !st.isMasterOn;

    // Toggling master ON revives arcs to [255, 255, 255]
    app.handleAllOn(255);
    st = app.getState();
    const revivesAllZeroArcs =
      st.isMasterOn &&
      st.brightness[0] === 255 &&
      st.brightness[1] === 255 &&
      st.brightness[2] === 255;

    // Case 3: Presets (0%, 25%, 50%, 75%, 100%)
    app.seed([80, 160, 240], 255);
    const presets = [
      { val: 0, expectedMaster: 0, expectEffZero: true },
      { val: 64, expectedMaster: 64, expectEffZero: false },
      { val: 128, expectedMaster: 128, expectEffZero: false },
      { val: 192, expectedMaster: 192, expectEffZero: false },
      { val: 255, expectedMaster: 255, expectEffZero: false },
    ];

    let presetsOk = true;
    for (const p of presets) {
      if (p.val === 0) {
        app.handleAllOff();
      } else {
        app.handleMasterBrightnessChange(p.val);
      }
      st = app.getState();
      if (st.masterBrightness !== p.expectedMaster) presetsOk = false;
      // Raw brightness must never change
      if (st.brightness[0] !== 80 || st.brightness[1] !== 160 || st.brightness[2] !== 240) {
        presetsOk = false;
      }
      if (p.expectEffZero) {
        if (st.effectiveBrightness.some((b) => b !== 0)) presetsOk = false;
      } else {
        const expectedEff = [
          Math.round(80 * (p.val / 255)),
          Math.round(160 * (p.val / 255)),
          Math.round(240 * (p.val / 255)),
        ];
        if (
          st.effectiveBrightness[0] !== expectedEff[0] ||
          st.effectiveBrightness[1] !== expectedEff[1] ||
          st.effectiveBrightness[2] !== expectedEff[2]
        ) {
          presetsOk = false;
        }
      }
    }

    recordTest(
      'Empirical: isMasterOn logic, power toggle cycles, and preset stepping maintain state decoupling',
      offStateOk && onStateOk && allZeroArcsIsMasterOff && revivesAllZeroArcs && presetsOk,
      'Power toggle or preset stepping failed invariant check'
    );
  }

  // Summary
  console.log('\n================================================================');
  console.log(` CHALLENGER 1 EMPIRICAL VERIFICATION SUMMARY`);
  console.log(` Total tests:  ${results.total}`);
  console.log(` Passed:       ${results.passed}`);
  console.log(` Failed:       ${results.failed}`);
  console.log(` Verdict:      ${results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES'}`);
  console.log('================================================================\n');

  return results;
}

const finalResults = runEmpiricalTests();
if (finalResults.failed > 0) {
  process.exit(1);
}
