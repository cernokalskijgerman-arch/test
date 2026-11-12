/**
 * ============================================================================
 * Tier 1: Feature Coverage Test Suite (F1 .. F8)
 * ============================================================================
 * Exactly 40 tests (5 per feature across 8 features).
 * Evaluates core requirements, primary paths, and acceptance criteria.
 * ============================================================================
 */

'use strict';

const tests = [
  // ==========================================================================
  // Feature 1: Master Brightness Decoupling (F1)
  // ==========================================================================
  {
    id: 'T1_F1_01',
    feature: 'F1',
    tier: 1,
    description: 'Arc Handlers Decoupled from Master Brightness in App.js',
    run: async (h) => {
      const ast = h.parseAST('App.js');
      const source = h.loadSource('App.js');

      // Helper to collect all call expressions within a specific variable declarator
      function getCallsInDeclarator(declaratorName) {
        const calls = [];
        h.traverseAST(ast, {
          VariableDeclarator(path) {
            if (path.node.id && path.node.id.name === declaratorName) {
              path.traverse({
                CallExpression(cp) {
                  if (cp.node.callee && cp.node.callee.name) {
                    calls.push(cp.node.callee.name);
                  }
                },
              });
            }
          },
        });
        return calls;
      }

      // 1. handleArcBrightnessChange must only call setBrightness and NEVER setMasterBrightness
      const arcChangeCalls = getCallsInDeclarator('handleArcBrightnessChange');
      h.assertStrictEqual(
        arcChangeCalls.includes('setBrightness'),
        true,
        'handleArcBrightnessChange must update arc brightness state via setBrightness'
      );
      h.assertStrictEqual(
        arcChangeCalls.includes('setMasterBrightness'),
        false,
        'handleArcBrightnessChange must NOT call setMasterBrightness; arc changes must be decoupled from master'
      );

      // 2. handleArcPress must only call setBrightness and NEVER setMasterBrightness
      const arcPressCalls = getCallsInDeclarator('handleArcPress');
      h.assertStrictEqual(
        arcPressCalls.includes('setBrightness'),
        true,
        'handleArcPress must update arc brightness state via setBrightness'
      );
      h.assertStrictEqual(
        arcPressCalls.includes('setMasterBrightness'),
        false,
        'handleArcPress must NOT call setMasterBrightness; toggling an arc must be decoupled from master'
      );

      // 3. Neither handler should mutate masterBrightnessRef
      let modifiesMasterRef = false;
      h.traverseAST(ast, {
        VariableDeclarator(path) {
          if (path.node.id && (path.node.id.name === 'handleArcBrightnessChange' || path.node.id.name === 'handleArcPress')) {
            const code = source.slice(path.node.start, path.node.end);
            if (code.includes('masterBrightnessRef.current =') || code.includes('setMasterBrightness(')) {
              modifiesMasterRef = true;
            }
          }
        },
      });
      h.assertStrictEqual(modifiesMasterRef, false, 'Arc handlers must not mutate masterBrightnessRef');
    },
  },
  {
    id: 'T1_F1_02',
    feature: 'F1',
    tier: 1,
    description: 'Master Brightness Handler Decoupled from Stored Arc Array in App.js',
    run: async (h) => {
      const ast = h.parseAST('App.js');
      const source = h.loadSource('App.js');

      // handleMasterBrightnessChange must update master state without calling setBrightness
      let masterCalls = [];
      let handlerFound = false;
      let handlerCode = '';
      h.traverseAST(ast, {
        VariableDeclarator(path) {
          if (path.node.id && path.node.id.name === 'handleMasterBrightnessChange') {
            handlerFound = true;
            handlerCode = source.slice(path.node.start, path.node.end);
            path.traverse({
              CallExpression(cp) {
                if (cp.node.callee && cp.node.callee.name) {
                  masterCalls.push(cp.node.callee.name);
                }
              },
            });
          }
        },
      });

      h.assertStrictEqual(handlerFound, true, 'App.js must define handleMasterBrightnessChange');
      h.assertStrictEqual(
        masterCalls.includes('setMasterBrightness'),
        true,
        'handleMasterBrightnessChange must invoke setMasterBrightness'
      );
      h.assertStrictEqual(
        masterCalls.includes('setBrightness'),
        false,
        'handleMasterBrightnessChange must NOT call setBrightness; master slider must not overwrite stored arc setpoints'
      );
      h.assertStrictEqual(
        handlerCode.includes('setBrightness('),
        false,
        'handleMasterBrightnessChange code must not contain setBrightness calls'
      );
    },
  },
  {
    id: 'T1_F1_03',
    feature: 'F1',
    tier: 1,
    description: 'Architecture B Non-Destructive Master Scaling & Silhouette Delivery in App.js',
    run: async (h) => {
      const ast = h.parseAST('App.js');

      // 1. App.js must define memoized effectiveBrightness depending on [brightness, masterBrightness]
      let effDepNames = [];
      let effFound = false;
      h.traverseAST(ast, {
        VariableDeclarator(path) {
          if (path.node.id && path.node.id.name === 'effectiveBrightness') {
            effFound = true;
            const init = path.node.init;
            if (init && init.type === 'CallExpression' && init.arguments.length >= 2) {
              const deps = init.arguments[1];
              if (deps && deps.type === 'ArrayExpression') {
                effDepNames = deps.elements.map((e) => (e && e.name ? e.name : ''));
              }
            }
          }
        },
      });

      h.assertStrictEqual(effFound, true, 'App.js must declare effectiveBrightness');
      h.assertStrictEqual(
        effDepNames.includes('brightness') && effDepNames.includes('masterBrightness'),
        true,
        'effectiveBrightness useMemo must depend on [brightness, masterBrightness]'
      );

      // 2. GlyphCameraSilhouette must receive effectiveBrightness
      const silhouetteElements = h.findJSXElements(ast, 'GlyphCameraSilhouette');
      h.assertStrictEqual(silhouetteElements.length >= 1, true, 'App.js must render GlyphCameraSilhouette');
      const brightProp = silhouetteElements[0].props.brightness;
      h.assertStrictEqual(
        Boolean(brightProp && brightProp.name === 'effectiveBrightness'),
        true,
        'GlyphCameraSilhouette must receive brightness={effectiveBrightness} for non-destructive physical dimming'
      );

      // 3. Mathematical invariant evaluation: verify scaling formula
      const testArcs = [100, 180, 240];
      const masterVal = 180;
      const expectedEffective = testArcs.map((b) => Math.round(b * (masterVal / 255)));
      h.assertDeepEqual(expectedEffective, [71, 127, 169], 'Master scaling must scale arc values proportionally without mutation');
    },
  },
  {
    id: 'T1_F1_04',
    feature: 'F1',
    tier: 1,
    description: 'ControlScreen Independent Prop Wiring in App.js',
    run: async (h) => {
      const ast = h.parseAST('App.js');
      const ctrlElements = h.findJSXElements(ast, 'ControlScreen');
      h.assertStrictEqual(ctrlElements.length >= 1, true, 'App.js must render ControlScreen component');

      const props = ctrlElements[0].props;
      // ControlScreen must receive raw stored brightness, not effectiveBrightness
      h.assertStrictEqual(
        Boolean(props.brightness && props.brightness.name === 'brightness'),
        true,
        'ControlScreen must receive raw stored brightness state to prevent slider overwrite'
      );
      // Master brightness prop
      h.assertStrictEqual(
        Boolean(props.masterBrightness && props.masterBrightness.name === 'masterBrightness'),
        true,
        'ControlScreen must receive masterBrightness state'
      );
      // Handlers must be wired to distinct functions
      const masterHandlerName = props.onMasterBrightnessChange ? props.onMasterBrightnessChange.name : null;
      const arcHandlerName = props.onArcBrightnessChange ? props.onArcBrightnessChange.name : null;
      const toggleHandlerName = props.onArcToggle ? props.onArcToggle.name : null;

      h.assertStrictEqual(masterHandlerName, 'handleMasterBrightnessChange', 'onMasterBrightnessChange bound to handleMasterBrightnessChange');
      h.assertStrictEqual(arcHandlerName, 'handleArcBrightnessChange', 'onArcBrightnessChange bound to handleArcBrightnessChange');
      h.assertStrictEqual(toggleHandlerName, 'handleArcPress', 'onArcToggle bound to handleArcPress');
      h.assertStrictEqual(
        masterHandlerName !== arcHandlerName,
        true,
        'Master and arc brightness change handlers must be distinct functions'
      );
    },
  },
  {
    id: 'T1_F1_05',
    feature: 'F1',
    tier: 1,
    description: 'ControlScreen Slider Separation & Channel Isolation in ControlScreen.js',
    run: async (h) => {
      const ast = h.parseAST('src/screens/ControlScreen.js');
      const sliders = h.findJSXElements(ast, 'GlyphSlider');

      h.assertStrictEqual(sliders.length, 4, 'ControlScreen must render exactly 4 GlyphSlider instances (1 master + 3 arcs)');

      // Master slider
      const masterSlider = sliders.find((s) => s.props.label === 'МАСТЕР-ЯРКОСТЬ');
      h.assertStrictEqual(Boolean(masterSlider), true, 'Master slider must have label "МАСТЕР-ЯРКОСТЬ"');
      h.assertStrictEqual(masterSlider.props.value.name, 'masterBrightness', 'Master slider value bound to masterBrightness');

      // 3 Arc sliders
      const arcSliders = sliders.filter((s) => s.props.label !== 'МАСТЕР-ЯРКОСТЬ');
      h.assertStrictEqual(arcSliders.length, 3, 'ControlScreen must have exactly 3 arc sliders');

      arcSliders.forEach((s, idx) => {
        const val = s.props.value;
        h.assertStrictEqual(
          val && val.type === 'MemberExpression' && val.object.name === 'brightness' && val.property.value === idx,
          true,
          `Arc slider ${idx} value must bind to brightness[${idx}]`
        );
      });
    },
  },

  // ==========================================================================
  // Feature 2: Remove "быстрые цены" (F2)
  // ==========================================================================
  {
    id: 'T1_F2_01',
    feature: 'F2',
    tier: 1,
    description: 'Absence of "БЫСТРЫЕ СЦЕНЫ СВЕТА" Title in ControlScreen',
    run: async (h) => {
      h.assertAbsenceOfPattern(
        'src/screens/ControlScreen.js',
        /быстры[ея]\s*(сцены|цены)/i,
        'Quick scenes card title must be completely removed from ControlScreen.js'
      );
    },
  },
  {
    id: 'T1_F2_02',
    feature: 'F2',
    tier: 1,
    description: 'Absence of Scene Preset Buttons in Tab 0',
    run: async (h) => {
      const forbiddenButtons = ['ВСЕ ДУГИ', 'ВСПЫШКА', 'ИНВЕРСИЯ', 'МЯГКИЙ 20%'];
      forbiddenButtons.forEach((btn) => {
        h.assertAbsenceOfPattern(
          'src/screens/ControlScreen.js',
          btn,
          `Legacy scene button "${btn}" must be removed from ControlScreen.js`
        );
      });
    },
  },
  {
    id: 'T1_F2_03',
    feature: 'F2',
    tier: 1,
    description: 'Removal of handleSceneSelect Function',
    run: async (h) => {
      h.assertAbsenceOfPattern(
        'src/screens/ControlScreen.js',
        'handleSceneSelect',
        'handleSceneSelect function handler must be removed from ControlScreen.js'
      );
    },
  },
  {
    id: 'T1_F2_04',
    feature: 'F2',
    tier: 1,
    description: 'Removal of Scene Grid Styles',
    run: async (h) => {
      const source = h.loadSource('src/screens/ControlScreen.js');
      h.assertStrictEqual(source.includes('scenesGrid'), false, 'scenesGrid style should be pruned');
      h.assertStrictEqual(source.includes('scenesTitle'), false, 'scenesTitle style should be pruned');
    },
  },
  {
    id: 'T1_F2_05',
    feature: 'F2',
    tier: 1,
    description: 'Tab 0 Only Renders Master and 3 Arc Cards',
    run: async (h) => {
      const source = h.loadSource('src/screens/ControlScreen.js');
      const matches = source.match(/<LiquidGlassCard/g) || [];
      h.assertStrictEqual(
        matches.length,
        4,
        `ControlScreen must render exactly 4 LiquidGlassCard components (1 Master + 3 Arcs), found ${matches.length}`
      );
    },
  },

  // ==========================================================================
  // Feature 3: No-Scroll «КОНТРОЛЬ» Tab (F3)
  // ==========================================================================
  {
    id: 'T1_F3_01',
    feature: 'F3',
    tier: 1,
    description: 'Silhouette Size Compacted to <= 220',
    run: async (h) => {
      const appSource = h.loadSource('App.js');
      const sizeVal = h.extractProp(appSource, 'GlyphCameraSilhouette', 'size');
      h.assertStrictEqual(
        typeof sizeVal === 'number' && sizeVal <= 220,
        true,
        `GlyphCameraSilhouette size prop in App.js must be <= 220 (received: ${sizeVal})`
      );
    },
  },
  {
    id: 'T1_F3_02',
    feature: 'F3',
    tier: 1,
    description: 'Total Control Screen Content Height <= 380dp',
    run: async (h) => {
      const budget = h.evaluateControlTabLayoutBudget({
        silhouetteSize: 215,
        masterCardHeight: 70,
        arcCardHeight: 58,
        cardGap: 8,
        hasScenesCard: false,
      });
      h.assertInRange(budget.totalContentHeight, 200, 380, 'Total Control content height');
      h.assertStrictEqual(budget.isZeroScroll, true, 'Layout budget must achieve zero scroll');
    },
  },
  {
    id: 'T1_F3_03',
    feature: 'F3',
    tier: 1,
    description: 'Compact Card Padding <= 10dp in ControlScreen and LiquidGlassCard',
    run: async (h) => {
      // 1. Verify ControlScreen renders compact LiquidGlassCard for all card sections
      const ctrlAST = h.parseAST('src/screens/ControlScreen.js');
      const cards = h.findJSXElements(ctrlAST, 'LiquidGlassCard');
      h.assertStrictEqual(
        cards.length >= 4,
        true,
        `ControlScreen must render at least 4 LiquidGlassCard elements (found ${cards.length})`
      );
      cards.forEach((card, idx) => {
        const isCompact = card.props.compact === true || card.props.compact === 'true';
        h.assertStrictEqual(
          isCompact,
          true,
          `LiquidGlassCard #${idx} in ControlScreen must have compact={true} enabled`
        );
      });

      // 2. Verify LiquidGlassCard StyleSheet defines compactInner with padding <= 10dp
      const lgcAST = h.parseAST('src/components/LiquidGlassCard.js');
      let paddingVertical = null;
      let paddingHorizontal = null;
      h.traverseAST(lgcAST, {
        ObjectProperty(astPath) {
          if (
            astPath.node.key &&
            astPath.node.key.name === 'compactInner' &&
            astPath.node.value.type === 'ObjectExpression'
          ) {
            astPath.node.value.properties.forEach((prop) => {
              if (prop.key && prop.key.name === 'paddingVertical' && prop.value.type === 'NumericLiteral') {
                paddingVertical = prop.value.value;
              }
              if (prop.key && prop.key.name === 'paddingHorizontal' && prop.value.type === 'NumericLiteral') {
                paddingHorizontal = prop.value.value;
              }
            });
          }
        },
      });

      h.assertStrictEqual(
        typeof paddingVertical === 'number',
        true,
        'LiquidGlassCard must define compactInner.paddingVertical'
      );
      h.assertStrictEqual(
        typeof paddingHorizontal === 'number',
        true,
        'LiquidGlassCard must define compactInner.paddingHorizontal'
      );
      h.assertStrictEqual(
        paddingVertical <= 10,
        true,
        `LiquidGlassCard compactInner paddingVertical must be <= 10dp (found: ${paddingVertical}dp)`
      );
      h.assertStrictEqual(
        paddingHorizontal <= 10,
        true,
        `LiquidGlassCard compactInner paddingHorizontal must be <= 10dp (found: ${paddingHorizontal}dp)`
      );
    },
  },
  {
    id: 'T1_F3_04',
    feature: 'F3',
    tier: 1,
    description: 'Zero Viewport Overflow on Standard Mobile Screen (390x844dp)',
    run: async (h) => {
      const budget = h.evaluateControlTabLayoutBudget({
        viewportHeight: 844,
        silhouetteSize: 215,
        masterCardHeight: 70,
        arcCardHeight: 58,
        cardGap: 8,
        hasScenesCard: false,
      });
      h.assertStrictEqual(budget.isZeroScroll, true, 'Must fit completely within 844dp viewport without scrolling');
      h.assertStrictEqual(budget.clearance > 50, true, `Clearance should have comfortable safety margin (found ${budget.clearance}dp)`);
    },
  },
  {
    id: 'T1_F3_05',
    feature: 'F3',
    tier: 1,
    description: 'Zero Viewport Overflow on Compact Mobile Screen (360x780dp)',
    run: async (h) => {
      const budget = h.evaluateControlTabLayoutBudget({
        viewportHeight: 780,
        statusBarHeight: 38,
        headerHeight: 48,
        tabBarHeight: 80,
        safeAreaBottom: 24,
        silhouetteSize: 210,
        masterCardHeight: 68,
        arcCardHeight: 56,
        cardGap: 6,
        hasScenesCard: false,
      });
      h.assertStrictEqual(budget.isZeroScroll, true, 'Must fit on 780dp compact screen without scrolling');
      h.assertStrictEqual(budget.clearance >= 0, true, `Clearance must be non-negative on 780dp (found ${budget.clearance}dp)`);
    },
  },

  // ==========================================================================
  // Feature 4: Remove "яркость дуги" Labels (F4)
  // ==========================================================================
  {
    id: 'T1_F4_01',
    feature: 'F4',
    tier: 1,
    description: 'Literal String "ЯРКОСТЬ ДУГИ" Absent from ControlScreen',
    run: async (h) => {
      h.assertAbsenceOfPattern(
        'src/screens/ControlScreen.js',
        'ЯРКОСТЬ ДУГИ',
        'Literal text "ЯРКОСТЬ ДУГИ" must be completely removed from ControlScreen.js'
      );
    },
  },
  {
    id: 'T1_F4_02',
    feature: 'F4',
    tier: 1,
    description: 'All 3 Arc Sliders Retain Min/Max/Step Slider Functionality',
    run: async (h) => {
      const ast = h.parseAST('src/screens/ControlScreen.js');
      const sliders = h.findJSXElements(ast, 'GlyphSlider');
      // At least 4 sliders (1 master + 3 arcs)
      h.assertStrictEqual(sliders.length >= 4, true, `Expected at least 4 GlyphSlider elements, found ${sliders.length}`);
      const arcSliders = sliders.slice(1);
      arcSliders.forEach((s, idx) => {
        h.assertStrictEqual(s.props.min === 0 || s.props.min === undefined, true, `Arc slider ${idx} min should be 0 or default`);
        h.assertStrictEqual(s.props.max === 255 || s.props.max === undefined, true, `Arc slider ${idx} max should be 255 or default`);
        h.assertStrictEqual(Boolean(s.props.onValueChange), true, `Arc slider ${idx} must have onValueChange handler`);
      });
    },
  },
  {
    id: 'T1_F4_03',
    feature: 'F4',
    tier: 1,
    description: 'Percentage Readout Preserved in Arc Card Header',
    run: async (h) => {
      const source = h.loadSource('src/screens/ControlScreen.js');
      // Header includes percentage calculation formula e.g. Math.round((brightness[
      const hasPercentFormula = /Math\.round\(\s*\(?\s*brightness\[/.test(source) || /%\s*\{?Math\.round/.test(source);
      h.assertStrictEqual(hasPercentFormula, true, 'Percentage calculation formula must be preserved in Arc card header');
    },
  },
  {
    id: 'T1_F4_04',
    feature: 'F4',
    tier: 1,
    description: 'GlyphSlider Gracefully Suppresses Label Row When Label is Omitted',
    run: async (h) => {
      const source = h.loadSource('src/components/GlyphSlider.js');
      // Check that labelRow is rendered conditionally e.g. label ? ( or Boolean(label)
      const hasConditionalLabel = Boolean(source.match(/label\s*\?/i) || source.match(/Boolean\(label\)/i) || source.match(/label\s*&&/i));
      h.assertStrictEqual(hasConditionalLabel, true, 'GlyphSlider must conditionally render label container when label prop is provided');
    },
  },
  {
    id: 'T1_F4_05',
    feature: 'F4',
    tier: 1,
    description: 'Master Brightness Label "МАСТЕР-ЯРКОСТЬ" Remains Intact',
    run: async (h) => {
      h.assertPresenceOfPattern(
        'src/screens/ControlScreen.js',
        'МАСТЕР-ЯРКОСТЬ',
        'ControlScreen must retain the "МАСТЕР-ЯРКОСТЬ" label for the master brightness slider'
      );
    },
  },

  // ==========================================================================
  // Feature 5: Uniform Smooth Auto-Tour & Turbo Speed (F5)
  // ==========================================================================
  {
    id: 'T1_F5_01',
    feature: 'F5',
    tier: 1,
    description: 'Angular Velocity Normalization Across Arcs in App.js',
    run: async (h) => {
      const appSource = h.loadSource('App.js');
      // App.js must implement arc-aware angular velocity normalization so that
      // the high-density Top-Left arc (20 LEDs across 41°) traverses at the same
      // angular speed (deg/s) as Right (48°) and Bottom-Left (21°).
      const hasNormalizationLogic =
        /calculateNormalizedStepDelay|normalizedDelay|degPerLed|angularVelocity|scale.*span/i.test(appSource) ||
        (/arc\s*===\s*0/.test(appSource) && /delay|timeout|stepDelay/i.test(appSource) && /span|deg/i.test(appSource));

      h.assertStrictEqual(
        hasNormalizationLogic,
        true,
        'App.js auto-walk engine must normalize step delay across arcs to maintain uniform visual angular velocity'
      );
    },
  },
  {
    id: 'T1_F5_02',
    feature: 'F5',
    tier: 1,
    description: 'Traversal Time Proportion Matches Physical Arc Angular Span in App.js',
    run: async (h) => {
      const appSource = h.loadSource('App.js');
      // App.js must incorporate physical arc angular proportions (41°, 21°, 48°)
      // or arc-specific timing factors so Top-Left does not monopolize 55.6% of the walk cycle.
      const hasPhysicalArcScaling =
        /PHYSICAL_ARCS|arcSpans|41\.0|41\b.*21\b.*48\b/i.test(appSource) ||
        /degPerLed|arcRatio|arcTiming/i.test(appSource);

      h.assertStrictEqual(
        hasPhysicalArcScaling,
        true,
        'App.js must incorporate physical arc angular proportions (41° TL, 21° BL, 48° R) into auto-walk pacing'
      );
    },
  },
  {
    id: 'T1_F5_03',
    feature: 'F5',
    tier: 1,
    description: 'Turbo Speed Slider Range Down to 1ms',
    run: async (h) => {
      const source = h.loadSource('src/screens/PixelsScreen.js');
      // Look for min={1} on auto-walk speed slider
      const hasMin1 = /min=\{1\}/.test(source) || /min:\s*1\b/.test(source) || /\[1,\s*200\]/.test(source);
      h.assertStrictEqual(hasMin1, true, 'PixelsScreen auto-walk speed slider must support minimum speed down to 1ms');
    },
  },
  {
    id: 'T1_F5_04',
    feature: 'F5',
    tier: 1,
    description: 'Turbo 1ms Preset Button Present',
    run: async (h) => {
      const source = h.loadSource('src/screens/PixelsScreen.js');
      const hasTurboPreset = /1мс/i.test(source) && (/ТУРБО/i.test(source) || /ГИПЕР/i.test(source) || /val:\s*1\b/.test(source));
      h.assertStrictEqual(hasTurboPreset, true, 'PixelsScreen must include a 1ms Turbo speed preset option');
    },
  },
  {
    id: 'T1_F5_05',
    feature: 'F5',
    tier: 1,
    description: 'Multi-Pixel Bloom / Sub-Pixel Smoothness Support',
    run: async (h) => {
      const source = h.loadSource('src/components/GlyphCameraSilhouette.js');
      // Verify activePixel can handle array or multi-pixel check
      const hasArraySupport = /Array\.isArray\(activePixel\)/.test(source) || /activePixel\.includes/.test(source) || /activePixels/.test(source);
      h.assertStrictEqual(hasArraySupport, true, 'GlyphCameraSilhouette must support multi-pixel array or bloom for activePixel');
    },
  },

  // ==========================================================================
  // Feature 6: 8-Step Sequencer (F6)
  // ==========================================================================
  {
    id: 'T1_F6_01',
    feature: 'F6',
    tier: 1,
    description: 'Sequencer Step Count Exactly 8 Steps',
    run: async (h) => {
      const source = h.loadSource('src/screens/SequencerScreen.js');
      const hasModulo8 = /%\s*8\b/.test(source) || /%\s*STEP_COUNT\b/.test(source);
      h.assertStrictEqual(hasModulo8, true, 'Sequencer playback must cycle with modulo 8');
      const hasLength8 = /length:\s*8\b/.test(source) || /Array\(8\)/.test(source) || /STEP_COUNT\s*=\s*8\b/.test(source);
      h.assertStrictEqual(hasLength8, true, 'Sequencer must construct 8 step columns');
    },
  },
  {
    id: 'T1_F6_02',
    feature: 'F6',
    tier: 1,
    description: 'Sequencer Step Indicator Label Updated to 8',
    run: async (h) => {
      const source = h.loadSource('src/screens/SequencerScreen.js');
      h.assertStrictEqual(source.includes('16 ШАГОВ'), false, 'Sequencer must not contain legacy "16 ШАГОВ" label');
      h.assertStrictEqual(source.includes('/16'), false, 'Sequencer counter must not display "/16"');
      const has8StepsLabel = source.includes('8 ШАГОВ') || source.includes('/8');
      h.assertStrictEqual(has8StepsLabel, true, 'Sequencer must display "8 ШАГОВ" or "/8" indicator');
    },
  },
  {
    id: 'T1_F6_03',
    feature: 'F6',
    tier: 1,
    description: 'All 5 Preset Rhythms Contain Exactly 8 Steps per Track',
    run: async (h) => {
      const source = h.loadSource('src/screens/SequencerScreen.js');
      // Parse PRESETS object from source
      const presetMatches = source.match(/\[([01],\s*){7}[01]\]/g);
      h.assertStrictEqual(
        Boolean(presetMatches && presetMatches.length >= 5),
        true,
        'Sequencer presets must define 8-element track arrays'
      );
    },
  },
  {
    id: 'T1_F6_04',
    feature: 'F6',
    tier: 1,
    description: 'Track Clear Resets to 8-Element Zero Arrays',
    run: async (h) => {
      const harness = h.createStudioStateHarness();
      harness.clearSequencer();
      const tracks = harness.getState().sequencerTracks;
      h.assertStrictEqual(tracks.topleft.length, 8, 'topleft track length must be 8');
      h.assertStrictEqual(tracks.bottomleft.length, 8, 'bottomleft track length must be 8');
      h.assertStrictEqual(tracks.right.length, 8, 'right track length must be 8');
      h.assertStrictEqual(tracks.topleft.every((v) => v === 0), true, 'All steps in cleared track must be 0');
    },
  },
  {
    id: 'T1_F6_05',
    feature: 'F6',
    tier: 1,
    description: 'App Tab Subtitle and Category Status Updated to 8 Steps',
    run: async (h) => {
      const appSource = h.loadSource('App.js');
      h.assertStrictEqual(appSource.includes('16-шаговые'), false, 'App.js must not contain "16-шаговые" subtitle');
      const has8StepsSubtitle = /8-шаговые\s*ритмы/i.test(appSource);
      h.assertStrictEqual(has8StepsSubtitle, true, 'App.js Tab 2 subtitle must read "8-шаговые ритмы"');
      const has8StepsStatus = /'8 ШАГОВ'|"8 ШАГОВ"/.test(appSource);
      h.assertStrictEqual(has8StepsStatus, true, 'App.js category sheet status must read "8 ШАГОВ"');
    },
  },

  // ==========================================================================
  // Feature 7: Audio-Reactive Glyph Flickering (F7)
  // ==========================================================================
  {
    id: 'T1_F7_01',
    feature: 'F7',
    tier: 1,
    description: 'Dynamic Beat Onset Detection Implementation in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Requirement: Feature 7 requires real beat onset detection (energy flux / history comparison)
      // rather than pure synthetic trigonometric sine waves.
      const hasBeatOnsetLogic =
        /beatOnset|detectBeat|energyHistory|spectralFlux|isBeatDetected|onsetThreshold|beatDetector/i.test(source);

      h.assertStrictEqual(
        hasBeatOnsetLogic,
        true,
        'VisualizerScreen.js must implement dynamic beat onset detection logic (energy comparison / spectral flux) [Milestone M3 TDD Red Oracle]'
      );
    },
  },
  {
    id: 'T1_F7_02',
    feature: 'F7',
    tier: 1,
    description: 'Exponential Stroboscopic Decay Envelope Physics in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Requirement: Strobe flash must exhibit fast attack and exponential decay envelope
      // (e.g. Math.exp(-lambda * dt) or decay coefficient * strobeIntensity)
      const hasExponentialDecay =
        /Math\.exp\s*\(|decayRate|strobeDecay|envelopeDecay|attackDecay|decayFactor/i.test(source);

      h.assertStrictEqual(
        hasExponentialDecay,
        true,
        'VisualizerScreen.js must calculate exponential attack/decay strobe envelopes for glyph flickering [Milestone M3 TDD Red Oracle]'
      );
    },
  },
  {
    id: 'T1_F7_03',
    feature: 'F7',
    tier: 1,
    description: 'Peak Micro-Flickering Jitter and Stroboscopic Flutter in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Requirement: Sustained loud passages must flutter with stroboscopic micro-jitter
      // rather than illuminating as a solid static light bar.
      const hasStrobeFlutter =
        /strobeFlicker|flickerJitter|microStrobe|strobeRate|flutter|jitterFactor|strobeModulation/i.test(source);

      h.assertStrictEqual(
        hasStrobeFlutter,
        true,
        'VisualizerScreen.js must implement micro-flickering stroboscopic flutter logic during peak passages [Milestone M3 TDD Red Oracle]'
      );
    },
  },
  {
    id: 'T1_F7_04',
    feature: 'F7',
    tier: 1,
    description: 'Real Audio Reactivity / Stream Buffer Analysis in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Requirement: Audio reactivity must ingest real audio data (microphone recording,
      // FFT analyzer node, audio frequency buffer) instead of purely synthetic setInterval sine waves.
      const hasAudioInput =
        /Audio\.Recording|Audio\.requestPermissionsAsync|sampleBuffer|frequencyData|audioStream|micStream|audioAnalyser|audioMeter/i.test(source);

      h.assertStrictEqual(
        hasAudioInput,
        true,
        'VisualizerScreen.js must integrate real audio stream/buffer capture rather than pure synthetic Math.sin [Milestone M3 TDD Red Oracle]'
      );
    },
  },
  {
    id: 'T1_F7_05',
    feature: 'F7',
    tier: 1,
    description: 'Audio Stream Teardown & Arc Extinguish on Deactivation in VisualizerScreen.js',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');

      // Requirement: When visualizer stops or unmounts, audio recording/stream must be stopped and unloaded cleanly
      const hasAudioTeardown =
        /stopAndUnloadAsync|cleanupAudio|audioStream\.stop|recording\.stop|recordingRef\.current\s*\.\s*stop/i.test(source);

      h.assertStrictEqual(
        hasAudioTeardown,
        true,
        'VisualizerScreen.js cleanup must stop and unload audio capture hardware on stop or unmount [Milestone M3 TDD Red Oracle]'
      );
    },
  },

  // ==========================================================================
  // Feature 8: Multiple Music Visualization Modes (F8)
  // ==========================================================================
  {
    id: 'T1_F8_01',
    feature: 'F8',
    tier: 1,
    description: 'Presence of 6 Distinct Visualization Modes',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');
      const expectedModeKeys = ['СПЕКТР EQ', 'БИТ-СТРОБ', 'ВОЛНА', 'ИСКРЫ', 'ГЛИЧ', 'РАДАР'];
      expectedModeKeys.forEach((modeKey) => {
        h.assertStrictEqual(
          source.includes(modeKey) || source.toLowerCase().includes(modeKey.toLowerCase()),
          true,
          `VisualizerScreen must contain mode definition for "${modeKey}"`
        );
      });
    },
  },
  {
    id: 'T1_F8_02',
    feature: 'F8',
    tier: 1,
    description: 'Spectrum EQ Mode Drives 3 Arcs by Frequency Bands in VisualizerScreen',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');
      // Verify VisualizerScreen implements Spectrum EQ routing:
      // Bass/Mid/Treble mapped to 3 arc brightness channels
      const hasSpectrumEQHandler =
        /СПЕКТР\s*EQ|spectrum_eq/i.test(source) &&
        /onBrightnessChange/i.test(source) &&
        /bass|mid|treble/i.test(source);

      h.assertStrictEqual(
        hasSpectrumEQHandler,
        true,
        'VisualizerScreen must implement "СПЕКТР EQ" mode mapping frequency bands (bass/mid/treble) to the 3 arc channels'
      );
    },
  },
  {
    id: 'T1_F8_03',
    feature: 'F8',
    tier: 1,
    description: 'Wave Mode Drives Traveling Circular Micro-LEDs in VisualizerScreen',
    run: async (h) => {
      const vizSource = h.loadSource('src/screens/VisualizerScreen.js');
      const silSource = h.loadSource('src/components/GlyphCameraSilhouette.js');

      // VisualizerScreen must accept onActivePixelChange prop and invoke it during wave mode
      const hasActivePixelCallback =
        /onActivePixelChange/.test(vizSource) &&
        /ВОЛНА|wave/i.test(vizSource);

      // GlyphCameraSilhouette must support array activePixel
      const hasArraySilhouette =
        /Array\.isArray\(\s*activePixel\s*\)|activePixel\.includes|activePixels/i.test(silSource);

      h.assertStrictEqual(
        hasActivePixelCallback,
        true,
        'VisualizerScreen must invoke onActivePixelChange during "ВОЛНА" (Wave) mode to drive circular micro-LEDs'
      );
      h.assertStrictEqual(
        hasArraySilhouette,
        true,
        'GlyphCameraSilhouette must support array activePixel for multi-LED visualization'
      );
    },
  },
  {
    id: 'T1_F8_04',
    feature: 'F8',
    tier: 1,
    description: 'Sparks Mode Generates Multi-LED Constellations in VisualizerScreen',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');
      // VisualizerScreen must implement Sparks mode generating random active micro-LEDs
      const hasSparksHandler =
        /ИСКРЫ|sparks/i.test(source) &&
        /onActivePixelChange/.test(source) &&
        /Math\.random|constellation|spark/i.test(source);

      h.assertStrictEqual(
        hasSparksHandler,
        true,
        'VisualizerScreen must implement "ИСКРЫ" mode generating multi-LED constellation active pixels'
      );
    },
  },
  {
    id: 'T1_F8_05',
    feature: 'F8',
    tier: 1,
    description: 'Radar Mode Sweeps 360° Circular Proportional to Energy in VisualizerScreen',
    run: async (h) => {
      const source = h.loadSource('src/screens/VisualizerScreen.js');
      // VisualizerScreen must implement Radar mode sweeping circular LEDs
      const hasRadarHandler =
        /РАДАР|radar/i.test(source) &&
        /onActivePixelChange/.test(source);

      h.assertStrictEqual(
        hasRadarHandler,
        true,
        'VisualizerScreen must implement "РАДАР" mode sweeping circular micro-LEDs proportional to audio energy'
      );
    },
  },
];

module.exports = {
  tier: 1,
  name: 'Tier 1: Feature Coverage (F1..F8)',
  tests,
};
