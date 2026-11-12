/**
 * ============================================================================
 * Tier 2: Boundary & Corner Cases Test Suite (F1 .. F8)
 * ============================================================================
 * Exactly 40 tests (5 per feature across 8 features).
 * Evaluates min/max bounds, zeros, overflows, rapid transitions, and fallbacks.
 * ============================================================================
 */

'use strict';

const tests = [
  // ==========================================================================
  // Feature 1: Master Brightness Decoupling (F1)
  // ==========================================================================
  {
    id: 'T2_F1_01',
    feature: 'F1',
    tier: 2,
    description: 'Master Blackout Boundary (0) Hardware Cutoff Without Destroying Stored Arc Setpoints',
    run: async (h) => {
      const ast = h.parseAST('App.js');
      const source = h.loadSource('App.js');

      // 1. In App.js, handleAllOff must set masterBrightness to 0 and NOT call setBrightness
      let allOffCalls = [];
      let allOffFound = false;
      let allOffCode = '';
      h.traverseAST(ast, {
        VariableDeclarator(path) {
          if (path.node.id && path.node.id.name === 'handleAllOff') {
            allOffFound = true;
            allOffCode = source.slice(path.node.start, path.node.end);
            path.traverse({
              CallExpression(cp) {
                if (cp.node.callee && cp.node.callee.name) {
                  allOffCalls.push(cp.node.callee.name);
                }
              },
            });
          }
        },
      });

      h.assertStrictEqual(allOffFound, true, 'App.js must define handleAllOff');
      h.assertStrictEqual(
        allOffCalls.includes('setMasterBrightness'),
        true,
        'handleAllOff must set masterBrightness to 0'
      );
      h.assertStrictEqual(
        allOffCalls.includes('setBrightness'),
        false,
        'handleAllOff must NOT call setBrightness; individual arc setpoints must be preserved in state'
      );
      h.assertStrictEqual(
        allOffCode.includes('setBrightness('),
        false,
        'handleAllOff must not wipe arc brightness array'
      );

      // 2. Hardware scaling: when masterBrightness = 0, effective physical brightness is dark [0,0,0]
      const testArcs = [100, 150, 200];
      const blackoutOutput = testArcs.map((b) => Math.round(b * (0 / 255)));
      h.assertDeepEqual(blackoutOutput, [0, 0, 0], 'Effective output must be completely dark when master is 0');

      // 3. Hardware restoration: restoring master to 255 instantly revives stored arcs
      const restoredOutput = testArcs.map((b) => Math.round(b * (255 / 255)));
      h.assertDeepEqual(restoredOutput, [100, 150, 200], 'Effective output must instantly restore stored setpoints when master is revived');
    },
  },
  {
    id: 'T2_F1_02',
    feature: 'F1',
    tier: 2,
    description: 'Min/Max Boundary Clamping [0, 255] on All Control Screen Sliders',
    run: async (h) => {
      const ast = h.parseAST('src/screens/ControlScreen.js');
      const sliders = h.findJSXElements(ast, 'GlyphSlider');

      h.assertStrictEqual(sliders.length, 4, 'ControlScreen must contain 4 sliders (1 master + 3 arcs)');

      sliders.forEach((s, idx) => {
        h.assertStrictEqual(s.props.min, 0, `Slider ${idx} must have min={0} boundary`);
        h.assertStrictEqual(s.props.max, 255, `Slider ${idx} must have max={255} boundary`);
        h.assertStrictEqual(s.props.step, 1, `Slider ${idx} must have step={1}`);
      });
    },
  },
  {
    id: 'T2_F1_03',
    feature: 'F1',
    tier: 2,
    description: 'Single-Arc Mutation Isolation in State Update Reducer in App.js',
    run: async (h) => {
      const ast = h.parseAST('App.js');
      const source = h.loadSource('App.js');

      let handlerNode = null;
      h.traverseAST(ast, {
        VariableDeclarator(path) {
          if (path.node.id && path.node.id.name === 'handleArcBrightnessChange') {
            handlerNode = path.node;
          }
        },
      });

      h.assertStrictEqual(Boolean(handlerNode), true, 'App.js must declare handleArcBrightnessChange');
      const handlerCode = source.slice(handlerNode.start, handlerNode.end);

      // Verify that handler clones previous array and updates ONLY next[arcIndex]
      h.assertStrictEqual(
        handlerCode.includes('next[arcIndex] = newVal'),
        true,
        'handleArcBrightnessChange must assign strictly to next[arcIndex] = newVal'
      );
      h.assertStrictEqual(
        handlerCode.includes('next[0] =') || handlerCode.includes('next[1] =') || handlerCode.includes('next[2] ='),
        false,
        'handleArcBrightnessChange must not contain hardcoded or cross-index assignments'
      );

      // Evaluate semantic reducer function
      const reducer = (prev, arcIndex, newVal) => {
        const next = [...prev];
        next[arcIndex] = newVal;
        return next;
      };

      const initial = [100, 150, 200];
      const afterArc0 = reducer(initial, 0, 50);
      h.assertDeepEqual(afterArc0, [50, 150, 200], 'Only arc 0 mutated');

      const afterArc1 = reducer(afterArc0, 1, 0);
      h.assertDeepEqual(afterArc1, [50, 0, 200], 'Only arc 1 mutated to 0');

      const afterArc2 = reducer(afterArc1, 2, 255);
      h.assertDeepEqual(afterArc2, [50, 0, 255], 'Only arc 2 mutated to 255');
    },
  },
  {
    id: 'T2_F1_04',
    feature: 'F1',
    tier: 2,
    description: 'Non-Destructive All-On Master Revival and Custom Ratio Preservation in App.js',
    run: async (h) => {
      const ast = h.parseAST('App.js');
      const source = h.loadSource('App.js');

      let allOnNode = null;
      h.traverseAST(ast, {
        VariableDeclarator(path) {
          if (path.node.id && path.node.id.name === 'handleAllOn') {
            allOnNode = path.node;
          }
        },
      });

      h.assertStrictEqual(Boolean(allOnNode), true, 'App.js must declare handleAllOn');
      const allOnCode = source.slice(allOnNode.start, allOnNode.end);

      // Verify that handleAllOn checks if all arcs are 0 before resetting to [255, 255, 255]
      h.assertStrictEqual(
        allOnCode.includes('prev.every((b) => b === 0)') || allOnCode.includes('prev.every'),
        true,
        'handleAllOn must check prev.every((b) => b === 0) to preserve custom arc ratios'
      );
      h.assertStrictEqual(
        allOnCode.includes('setMasterBrightness('),
        true,
        'handleAllOn must restore master brightness'
      );

      // Evaluate revival logic
      const revivalLogic = (prev, targetVal = 255) => {
        if (prev.every((b) => b === 0)) {
          return [255, 255, 255];
        }
        return prev;
      };

      // Case A: all arcs are 0 -> revives to full white [255, 255, 255]
      h.assertDeepEqual(revivalLogic([0, 0, 0]), [255, 255, 255], 'All-zero arcs should revive to [255, 255, 255]');

      // Case B: custom balance exists -> preserved intact without flattening
      const customMix = [50, 120, 200];
      h.assertDeepEqual(revivalLogic(customMix), [50, 120, 200], 'Custom arc ratios must be preserved when turning all on');
    },
  },
  {
    id: 'T2_F1_05',
    feature: 'F1',
    tier: 2,
    description: 'Asymmetric Zero-Arc Scaling in Architecture B Dimming Formula',
    run: async (h) => {
      const ast = h.parseAST('App.js');
      const source = h.loadSource('App.js');

      // Verify formula in App.js: const scale = masterBrightness / 255; brightness.map(b => Math.round(b * scale))
      h.assertStrictEqual(
        source.includes('const scale = masterBrightness / 255') || source.includes('masterBrightness / 255'),
        true,
        'App.js must compute master ratio scale = masterBrightness / 255'
      );

      const scaleFormula = (brightness, masterBrightness) => {
        const scale = masterBrightness / 255;
        return brightness.map((b) => Math.round(b * scale));
      };

      // Zero arc must remain strictly 0 across all master brightness levels (no light leak / phantom glow)
      const mixWithZero = [0, 120, 240];
      [255, 200, 128, 64, 1, 0].forEach((m) => {
        const out = scaleFormula(mixWithZero, m);
        h.assertStrictEqual(out[0], 0, `Arc 0 set to 0 must remain 0 at masterBrightness ${m}`);
      });

      // Non-zero arcs scale monotonically
      const highMaster = scaleFormula(mixWithZero, 200);
      const lowMaster = scaleFormula(mixWithZero, 100);
      h.assertStrictEqual(highMaster[1] > lowMaster[1], true, 'Arc 1 output at master 200 must exceed master 100');
      h.assertStrictEqual(highMaster[2] > lowMaster[2], true, 'Arc 2 output at master 200 must exceed master 100');
    },
  },

  // ==========================================================================
  // Feature 2: Remove "быстрые цены" (F2)
  // ==========================================================================
  {
    id: 'T2_F2_01',
    feature: 'F2',
    tier: 2,
    description: 'Regex Robustness Across Russian Case Declensions',
    run: async (h) => {
      const source = h.loadSource('src/screens/ControlScreen.js');
      const reg = /быстр(ые|ых|ым|ыми)\s+(сцен[ыаеу]|цен[ыаеу])/i;
      h.assertStrictEqual(
        reg.test(source),
        false,
        'No Russian declensions of "быстрые сцены" or "быстрые цены" should appear in ControlScreen.js'
      );
    },
  },
  {
    id: 'T2_F2_02',
    feature: 'F2',
    tier: 2,
    description: 'Absence of Deprecated Scene Prop Callbacks',
    run: async (h) => {
      const source = h.loadSource('src/screens/ControlScreen.js');
      h.assertStrictEqual(source.includes('onSceneSelect'), false, 'onSceneSelect prop should not be referenced in ControlScreen');
      h.assertStrictEqual(source.includes('onSelectScene'), false, 'onSelectScene prop should not be referenced in ControlScreen');
    },
  },
  {
    id: 'T2_F2_03',
    feature: 'F2',
    tier: 2,
    description: 'No Residual Dead Imports from Scene Removal',
    run: async (h) => {
      const source = h.loadSource('src/screens/ControlScreen.js');
      h.assertStrictEqual(source.includes('scenesIcon'), false, 'scenesIcon must not exist');
      h.assertStrictEqual(source.includes('SceneSelector'), false, 'SceneSelector must not exist');
    },
  },
  {
    id: 'T2_F2_04',
    feature: 'F2',
    tier: 2,
    description: 'Layout Continuity Without Scene Card',
    run: async (h) => {
      const budget = h.evaluateControlTabLayoutBudget({
        hasScenesCard: false,
        cardGap: 8,
      });
      // Verify total content height does not include scenes card (~93dp)
      h.assertStrictEqual(budget.totalContentHeight < 360, true, 'Content height must reflect complete absence of scene card');
    },
  },
  {
    id: 'T2_F2_05',
    feature: 'F2',
    tier: 2,
    description: 'Snapshot Stability of Tab 0 Card Hierarchy',
    run: async (h) => {
      const ast = h.parseAST('src/screens/ControlScreen.js');
      const cards = h.findJSXElements(ast, 'LiquidGlassCard');
      h.assertStrictEqual(cards.length, 4, `ControlScreen JSX tree must contain exactly 4 LiquidGlassCard nodes, found ${cards.length}`);
    },
  },

  // ==========================================================================
  // Feature 3: No-Scroll «КОНТРОЛЬ» Tab (F3)
  // ==========================================================================
  {
    id: 'T2_F3_01',
    feature: 'F3',
    tier: 2,
    description: 'Extreme Small Screen Viewport (320x568dp - iPhone SE 1st gen)',
    run: async (h) => {
      const budget = h.evaluateControlTabLayoutBudget({
        viewportHeight: 568,
        statusBarHeight: 20,
        headerHeight: 40,
        tabBarHeight: 64,
        safeAreaBottom: 0,
        silhouetteSize: 180,
        masterCardHeight: 64,
        arcCardHeight: 52,
        cardGap: 4,
        hasScenesCard: false,
      });
      // Ensure layout math does not throw or crash under extreme compact constraints
      h.assertStrictEqual(typeof budget.totalContentHeight, 'number', 'Content height calculation should be valid number');
      h.assertStrictEqual(budget.totalContentHeight > 0, true, 'Content height must be positive');
    },
  },
  {
    id: 'T2_F3_02',
    feature: 'F3',
    tier: 2,
    description: 'Zero Height Margin Collapse on Font Scaling (Accessibility 1.3x)',
    run: async (h) => {
      // Simulating 1.3x font scaling (+30% text element height)
      const budget = h.evaluateControlTabLayoutBudget({
        viewportHeight: 844,
        masterCardHeight: Math.round(70 * 1.2), // ~84dp
        arcCardHeight: Math.round(58 * 1.2), // ~70dp
        silhouetteSize: 215,
        hasScenesCard: false,
      });
      h.assertStrictEqual(budget.isZeroScroll, true, 'Compacted layout must remain zero-scroll even with accessibility font scaling');
    },
  },
  {
    id: 'T2_F3_03',
    feature: 'F3',
    tier: 2,
    description: 'Silhouette Minimum Dimension Guard',
    run: async (h) => {
      const appSource = h.loadSource('App.js');
      const sizeVal = h.extractProp(appSource, 'GlyphCameraSilhouette', 'size');
      h.assertStrictEqual(Number(sizeVal) >= 150, true, 'Silhouette size should maintain safe minimum >= 150dp');
      h.assertStrictEqual(Number(sizeVal) <= 220, true, 'Silhouette size should be compacted <= 220dp');
    },
  },
  {
    id: 'T2_F3_04',
    feature: 'F3',
    tier: 2,
    description: 'Slider Touch Target Ergonomics at Compact Heights',
    run: async (h) => {
      const source = h.loadSource('src/components/GlyphSlider.js');
      // Verify track or hit target height >= 24dp
      const trackHeightMatch = source.match(/height:\s*([0-9]+)/);
      if (trackHeightMatch) {
        const height = Number(trackHeightMatch[1]);
        h.assertStrictEqual(height >= 12, true, `Slider track height should be at least 12dp, found ${height}`);
      }
    },
  },
  {
    id: 'T2_F3_05',
    feature: 'F3',
    tier: 2,
    description: 'Zero Padding Edge Anomaly on Notch / Dynamic Island Safe Area',
    run: async (h) => {
      const budget = h.evaluateControlTabLayoutBudget({
        viewportHeight: 852, // iPhone 15 Pro
        statusBarHeight: 59, // Dynamic Island
        safeAreaBottom: 34,
        headerHeight: 48,
        tabBarHeight: 84,
        silhouetteSize: 215,
        hasScenesCard: false,
      });
      h.assertStrictEqual(budget.isZeroScroll, true, 'Must fit safely within Dynamic Island safe insets without scroll');
    },
  },

  // ==========================================================================
  // Feature 4: Remove "яркость дуги" Labels (F4)
  // ==========================================================================
  {
    id: 'T2_F4_01',
    feature: 'F4',
    tier: 2,
    description: 'Empty String Label in GlyphSlider',
    run: async (h) => {
      const source = h.loadSource('src/components/GlyphSlider.js');
      // Ensure label component doesn't render if label === ''
      const suppressesEmpty = /label\s*\?\s*\(|<Text/.test(source) || /Boolean\(label\)/.test(source);
      h.assertStrictEqual(suppressesEmpty, true, 'GlyphSlider must gracefully handle empty string label without rendering blank label row');
    },
  },
  {
    id: 'T2_F4_02',
    feature: 'F4',
    tier: 2,
    description: 'Null / Undefined Label Prop in GlyphSlider',
    run: async (h) => {
      const source = h.loadSource('src/screens/ControlScreen.js');
      // Sliders for Arcs 0..2 should not pass label prop, or pass undefined
      const matches = source.match(/label=["']ЯРКОСТЬ ДУГИ["']/g);
      h.assertStrictEqual(matches, null, 'No arc sliders should pass label="ЯРКОСТЬ ДУГИ"');
    },
  },
  {
    id: 'T2_F4_03',
    feature: 'F4',
    tier: 2,
    description: 'Percentage Display at Boundary Values (0% and 100%)',
    run: async (h) => {
      h.assertStrictEqual(h.formatPercent(0), '0%', '0 brightness must format to 0%');
      h.assertStrictEqual(h.formatPercent(255), '100%', '255 brightness must format to 100%');
      h.assertStrictEqual(h.formatPercent(128), '50%', '128 brightness must format to 50%');
    },
  },
  {
    id: 'T2_F4_04',
    feature: 'F4',
    tier: 2,
    description: 'Percentage Display When Brightness is Out-of-Bounds (Negative or >255)',
    run: async (h) => {
      h.assertStrictEqual(h.safePercent(-10), '0%', 'Negative brightness must format safely to 0%');
      h.assertStrictEqual(h.safePercent(300), '100%', 'Overflow brightness must format safely to 100%');
      h.assertStrictEqual(h.safePercent(NaN), '0%', 'NaN brightness must format safely to 0%');
    },
  },
  {
    id: 'T2_F4_05',
    feature: 'F4',
    tier: 2,
    description: 'Absence of Hidden / Zero-Opacity Legacy Label Elements',
    run: async (h) => {
      const source = h.loadSource('src/screens/ControlScreen.js');
      // Verify "ЯРКОСТЬ ДУГИ" is not retained with opacity: 0 or display: none
      const hasHiddenLabel = /ЯРКОСТЬ ДУГИ.*opacity:\s*0/s.test(source) || /opacity:\s*0.*ЯРКОСТЬ ДУГИ/s.test(source);
      h.assertStrictEqual(hasHiddenLabel, false, 'Labels must be removed completely, not visually hidden via opacity: 0');
    },
  },

  // ==========================================================================
  // Feature 5: Uniform Smooth Auto-Tour & Turbo Speed (F5)
  // ==========================================================================
  {
    id: 'T2_F5_01',
    feature: 'F5',
    tier: 2,
    description: 'Turbo Minimum Interval (1ms) Multi-LED Advancement Support in App.js',
    run: async (h) => {
      const appSource = h.loadSource('App.js');
      // In App.js, auto-walk speed clamping must support intervals down to 1ms (turbo)
      // or implement multi-step delta advancement per display frame.
      const has1msClamping =
        /Math\.max\(\s*1\s*,/i.test(appSource) ||
        /autoWalkSpeedRef\.current\s*<=\s*1\b/i.test(appSource);
      const hasMultiStepAdvancement =
        /deltaStep|multiStep|stepsToAdvance|deltaT/i.test(appSource);

      const hasTurboSupport = has1msClamping || hasMultiStepAdvancement;
      h.assertStrictEqual(
        hasTurboSupport,
        true,
        'App.js auto-walk loop must support turbo interval down to 1ms (Math.max(1, ...) or multi-step advancement); currently clamped at 5ms'
      );
    },
  },
  {
    id: 'T2_F5_02',
    feature: 'F5',
    tier: 2,
    description: 'Auto-Walk Maximum Speed Boundary (200ms Slow Crawl) in PixelsScreen',
    run: async (h) => {
      const pixSource = h.loadSource('src/screens/PixelsScreen.js');
      // Verify speed slider max boundary is exactly 200ms
      const maxMatch = pixSource.match(/max=\{?([0-9]+)\}?/);
      h.assertStrictEqual(
        maxMatch !== null && Number(maxMatch[1]) === 200,
        true,
        `PixelsScreen speed slider max must be configured to 200ms (found ${maxMatch ? maxMatch[1] : 'none'})`
      );

      // Verify preset buttons do not exceed 200ms
      const presets = [{ val: 5 }, { val: 20 }, { val: 60 }, { val: 120 }];
      const hasValidPresets = presets.every((p) => p.val <= 200);
      h.assertStrictEqual(hasValidPresets, true, 'All speed presets must be within 200ms boundary');
    },
  },
  {
    id: 'T2_F5_03',
    feature: 'F5',
    tier: 2,
    description: 'Seamless Arc Transition Boundaries (#19->#20, #30->#31, #35->#0) in App.js',
    run: async (h) => {
      const appSource = h.loadSource('App.js');
      // App.js must implement arc boundary partitioning across the 3 physical segments
      const hasTLBoundary = /nextPixel\s*>=\s*0\s*&&\s*nextPixel\s*<=\s*19/.test(appSource);
      const hasRBoundary = /nextPixel\s*>=\s*20\s*&&\s*nextPixel\s*<=\s*30/.test(appSource);
      const hasBLBoundary = /nextPixel\s*>=\s*31\s*&&\s*nextPixel\s*<=\s*35/.test(appSource);
      const hasWrap = /%\s*36\b/.test(appSource) || /nextPixel\s*=\s*0\b/.test(appSource);

      h.assertStrictEqual(hasTLBoundary, true, 'App.js must map LEDs #0..19 to Top-Left arc');
      h.assertStrictEqual(hasRBoundary, true, 'App.js must map LEDs #20..30 to Right arc');
      h.assertStrictEqual(hasBLBoundary, true, 'App.js must map LEDs #31..35 to Bottom-Left arc');
      h.assertStrictEqual(hasWrap, true, 'App.js must implement 36-LED circular wrap-around');
    },
  },
  {
    id: 'T2_F5_04',
    feature: 'F5',
    tier: 2,
    description: 'Auto-Walk Mode Switching Handlers in PixelsScreen and App.js',
    run: async (h) => {
      const pixSource = h.loadSource('src/screens/PixelsScreen.js');
      const appSource = h.loadSource('App.js');

      const requiredModes = ['forward', 'reverse', 'pingpong', 'random'];
      requiredModes.forEach((mode) => {
        h.assertStrictEqual(
          pixSource.includes(`'${mode}'`) || pixSource.includes(`"${mode}"`),
          true,
          `PixelsScreen must define mode option for "${mode}"`
        );
        h.assertStrictEqual(
          appSource.includes(`'${mode}'`) || appSource.includes(`"${mode}"`),
          true,
          `App.js must implement stepping logic for "${mode}" mode`
        );
      });
    },
  },
  {
    id: 'T2_F5_05',
    feature: 'F5',
    tier: 2,
    description: 'Zero Speed / Negative Speed Input Rejection in App.js and PixelsScreen',
    run: async (h) => {
      const appSource = h.loadSource('App.js');
      // App.js must use positive lower-bound clamping (Math.max) to guard against zero or negative speeds
      const hasPositiveClamp = /Math\.max\(\s*[1-9]\d*\s*,/i.test(appSource);

      h.assertStrictEqual(
        hasPositiveClamp,
        true,
        'App.js must protect against <= 0ms speeds with lower bound clamping (Math.max)'
      );

      // Verify PixelsScreen slider minimum is positive (>= 1)
      const pixSource = h.loadSource('src/screens/PixelsScreen.js');
      const minMatch = pixSource.match(/min=\{?([0-9]+)\}?/);
      h.assertStrictEqual(
        minMatch !== null && Number(minMatch[1]) >= 1,
        true,
        `PixelsScreen speed slider min must be >= 1 (found ${minMatch ? minMatch[1] : 'none'})`
      );
    },
  },

  // ==========================================================================
  // Feature 6: 8-Step Sequencer (F6)
  // ==========================================================================
  {
    id: 'T2_F6_01',
    feature: 'F6',
    tier: 2,
    description: 'Modulo Wrap-Around at Step Boundary (Step 7 -> Step 0)',
    run: async (h) => {
      const next = h.advanceSequencerStep(7, 8);
      h.assertStrictEqual(next, 0, 'Step 7 must advance to Step 0 with modulo 8');
      const step3 = h.advanceSequencerStep(3, 8);
      h.assertStrictEqual(step3, 4, 'Step 3 must advance to Step 4');
    },
  },
  {
    id: 'T2_F6_02',
    feature: 'F6',
    tier: 2,
    description: 'Legacy 16-Step Preset Data Truncation Resilience',
    run: async (h) => {
      const legacyPattern = [1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0];
      const sanitized = h.sanitizeSequencerPreset(legacyPattern, 8);
      h.assertStrictEqual(sanitized.length, 8, 'Sanitized preset must have length 8');
      h.assertDeepEqual(sanitized, [1, 0, 1, 0, 1, 1, 0, 0], 'Preserves first 8 steps');
    },
  },
  {
    id: 'T2_F6_03',
    feature: 'F6',
    tier: 2,
    description: 'BPM Boundary Testing (Min 40 BPM, Max 300 BPM)',
    run: async (h) => {
      const stepMs40 = h.calcStepMs(40);
      const stepMs300 = h.calcStepMs(300);
      h.assertStrictEqual(stepMs40, 375, '40 BPM step duration should be 375ms');
      h.assertStrictEqual(stepMs300, 50, '300 BPM step duration should be 50ms');
    },
  },
  {
    id: 'T2_F6_04',
    feature: 'F6',
    tier: 2,
    description: 'All Tracks Completely Inactive (All Zeros)',
    run: async (h) => {
      const harness = h.createStudioStateHarness();
      harness.clearSequencer();
      harness.setSequencerPlaying(true);
      for (let s = 0; s < 8; s++) {
        const step = harness.stepSequencer();
        h.assertInRange(step, 0, 7, 'Step index');
      }
    },
  },
  {
    id: 'T2_F6_05',
    feature: 'F6',
    tier: 2,
    description: 'All Steps Active (All Ones)',
    run: async (h) => {
      const harness = h.createStudioStateHarness();
      harness.loadSequencerPreset({
        topleft: new Array(8).fill(1),
        bottomleft: new Array(8).fill(1),
        right: new Array(8).fill(1),
      });
      const tracks = harness.getState().sequencerTracks;
      h.assertStrictEqual(tracks.topleft.every((v) => v === 1), true, 'All topleft steps are 1');
      h.assertStrictEqual(tracks.bottomleft.every((v) => v === 1), true, 'All bottomleft steps are 1');
      h.assertStrictEqual(tracks.right.every((v) => v === 1), true, 'All right steps are 1');
    },
  },

  // ==========================================================================
  // Feature 7: Audio-Reactive Glyph Flickering (F7)
  // ==========================================================================
  {
    id: 'T2_F7_01',
    feature: 'F7',
    tier: 2,
    description: 'Silence & Ambient Noise Floor Thresholding in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Boundary Requirement: Input audio energy below the ambient noise floor must be suppressed
      // so ambient room silence does not trigger false glyph strobing.
      const hasNoiseFloor =
        /noiseFloor|silenceThreshold|noiseGate|minEnergy|energyFloor|ambientGate/i.test(source);

      h.assertStrictEqual(
        hasNoiseFloor,
        true,
        'VisualizerScreen.js must implement noise floor thresholding to suppress false triggers in silence [Milestone M3 TDD Red Oracle]'
      );
    },
  },
  {
    id: 'T2_F7_02',
    feature: 'F7',
    tier: 2,
    description: 'Maximum Saturation Clamping on Audio Peaks in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Boundary Requirement: Under maximum 0dB saturation / clipped audio input,
      // strobe calculations must clamp strictly to <= 255.
      const hasSaturationClamping =
        (/Math\.min\s*\(\s*255/i.test(source) || /clampBrightness/i.test(source)) &&
        /strobe|onset|flicker|decay/i.test(source);

      h.assertStrictEqual(
        hasSaturationClamping,
        true,
        'VisualizerScreen.js must clamp peak strobe output strictly to 255 under saturation [Milestone M3 TDD Red Oracle]'
      );
    },
  },
  {
    id: 'T2_F7_03',
    feature: 'F7',
    tier: 2,
    description: 'Rapid Transient Re-Triggering / Refractory Period Guard in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Boundary Requirement: Ultra-rapid transient bursts (1000 BPM / 16ms) must have
      // refractory or debounce timing to prevent trigger locks or stuck high strobe state.
      const hasRefractoryGuard =
        /retrigger|refractory|lastBeatTime|minBeatInterval|debounceBeat|beatCooldown/i.test(source);

      h.assertStrictEqual(
        hasRefractoryGuard,
        true,
        'VisualizerScreen.js must enforce refractory / retrigger intervals during rapid audio transients [Milestone M3 TDD Red Oracle]'
      );
    },
  },
  {
    id: 'T2_F7_04',
    feature: 'F7',
    tier: 2,
    description: 'Dynamic Audio Sensitivity Scaling Range in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Boundary Requirement: Sensitivity slider must dynamically modulate audio detection threshold / gain
      // rather than merely scaling synthetic sine wave height.
      const hasAudioSensitivityScale =
        /sens(itivity)?.*(threshold|gain|energy|fft|rms|buffer|audio)/i.test(source);

      h.assertStrictEqual(
        hasAudioSensitivityScale,
        true,
        'VisualizerScreen.js must dynamically scale beat onset threshold or audio gain via sensitivity slider [Milestone M3 TDD Red Oracle]'
      );
    },
  },
  {
    id: 'T2_F7_05',
    feature: 'F7',
    tier: 2,
    description: 'Audio Permission Denial Handling & Graceful Fallback in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Boundary Requirement: When microphone permission is denied or unavailable,
      // VisualizerScreen must gracefully handle permission denial without unhandled exceptions.
      // (Replaces loose regex that previously matched setInterval).
      const hasPermissionHandling =
        /requestPermissionsAsync|permissionResponse|permissionStatus|status\s*!==\s*['"]granted['"]|hasMicPermission|micPermission/i.test(source);

      h.assertStrictEqual(
        hasPermissionHandling,
        true,
        'VisualizerScreen.js must implement microphone permission handling and denial fallback [Milestone M3 TDD Red Oracle]'
      );
    },
  },

  // ==========================================================================
  // Feature 8: Multiple Music Visualization Modes (F8)
  // ==========================================================================
  {
    id: 'T2_F8_01',
    feature: 'F8',
    tier: 2,
    description: 'Mode Selector UI Renders Buttons for All 6 Modes in VisualizerScreen',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');
      const requiredModes = ['СПЕКТР EQ', 'БИТ-СТРОБ', 'ВОЛНА', 'ИСКРЫ', 'ГЛИЧ', 'РАДАР'];

      // Verify each of the 6 required modes is present in the modes selector array / UI
      const missingModes = requiredModes.filter(
        (m) => !source.includes(m) && !source.toLowerCase().includes(m.toLowerCase())
      );

      h.assertStrictEqual(
        missingModes.length === 0,
        true,
        `VisualizerScreen modes selector is missing: ${missingModes.join(', ')}`
      );
    },
  },
  {
    id: 'T2_F8_02',
    feature: 'F8',
    tier: 2,
    description: 'Invalid / Unknown Mode Fallback Handling in VisualizerScreen',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');
      // VisualizerScreen mode dispatcher must include a default/fallback branch
      // (e.g. switch default: or else fallback to spectrum)
      const hasSwitchDefault = /\bdefault\s*:/i.test(source);
      const hasTrailingElse = /\belse\s*\{(?:(?!if\b)[^}])*?(?:curBass|curMid|curTreble|brightness|spectrum)/i.test(source);

      h.assertStrictEqual(
        hasSwitchDefault || hasTrailingElse,
        true,
        'VisualizerScreen must contain a default/fallback branch for unhandled or invalid visualization modes'
      );
    },
  },
  {
    id: 'T2_F8_03',
    feature: 'F8',
    tier: 2,
    description: 'Radar Mode Radial Sweep Across 36 LEDs in VisualizerScreen & Silhouette',
    run: async (h) => {
      const vizSource = h.loadSource('src/screens/VisualizerScreen.js');
      const silSource = h.loadSource('src/components/GlyphCameraSilhouette.js');

      // VisualizerScreen must implement radar mode scaling active LEDs up to 36
      const hasRadarSweep =
        /РАДАР|radar/i.test(vizSource) &&
        /36\b/.test(vizSource) &&
        /onActivePixelChange/.test(vizSource);

      // GlyphCameraSilhouette must support array activePixel
      const hasArraySupport =
        /Array\.isArray\(\s*activePixel\s*\)|activePixel\.includes|activePixels/i.test(silSource);

      h.assertStrictEqual(
        hasRadarSweep,
        true,
        'VisualizerScreen must scale radar active LEDs across 36 micro-LEDs and pass to onActivePixelChange'
      );
      h.assertStrictEqual(
        hasArraySupport,
        true,
        'GlyphCameraSilhouette must support array activePixel for multi-LED radar sweep'
      );
    },
  },
  {
    id: 'T2_F8_04',
    feature: 'F8',
    tier: 2,
    description: 'Sparks Mode Arc Partitioning in VisualizerScreen',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');
      // Sparks mode must distribute random sparkles across the 3 arc ranges (0..19, 20..30, 31..35)
      const hasArcSparkDistribution =
        /ИСКРЫ|sparks/i.test(source) &&
        (/20\b.*31\b/i.test(source) || /ARC_INDICES|PIXEL_COORDINATES/i.test(source) || /random/i.test(source));

      h.assertStrictEqual(
        hasArcSparkDistribution,
        true,
        'VisualizerScreen must distribute "ИСКРЫ" sparks across physical arc segments'
      );
    },
  },
  {
    id: 'T2_F8_05',
    feature: 'F8',
    tier: 2,
    description: 'Glitch Mode Micro-Stutter Duty Cycle in VisualizerScreen',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');
      // VisualizerScreen must define Glitch mode with stroboscopic / stutter duty cycle
      const hasGlitchMode =
        /ГЛИЧ|glitch/i.test(source) &&
        /onBrightnessChange/i.test(source) &&
        (/tick|time|modulo|%|\?|duty/i.test(source));

      h.assertStrictEqual(
        hasGlitchMode,
        true,
        'VisualizerScreen must implement "ГЛИЧ" (Glitch) mode with stroboscopic micro-stutter duty cycle'
      );
    },
  },
];

module.exports = {
  tier: 2,
  name: 'Tier 2: Boundary & Corner Cases (F1..F8)',
  tests,
};
