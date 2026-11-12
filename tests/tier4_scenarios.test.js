/**
 * ============================================================================
 * Tier 4: Real-World Application Scenarios Test Suite
 * ============================================================================
 * Exactly 6 end-to-end multi-step workflow scenarios testing realistic user flows.
 * ============================================================================
 */

'use strict';

const tests = [
  // ==========================================================================
  // Scenario 1: Live Stage Concert Mode (F1, F5, F7, F8)
  // ==========================================================================
  {
    id: 'T4_SCEN_01',
    feature: 'F1,F5,F7,F8',
    tier: 4,
    description: 'Live Stage Concert Mode: Master Dimming, Turbo Tour, Strobe Flickering and Radar Light Show',
    run: async (h) => {
      // Step 1: Open studio, set stage master brightness to 220
      const harness = h.createStudioStateHarness({ masterBrightness: 220, currentTab: 0 });
      h.assertStrictEqual(harness.getState().masterBrightness, 220, 'Stage master brightness configured to 220');

      // Step 2: Navigate to PixelsScreen (Tab 1), run 1ms hyper-turbo auto-walk
      harness.switchTab(1);
      harness.setAutoWalk(true, 1, 'pingpong');
      for (let s = 0; s < 50; s++) {
        harness.stepAutoWalk();
      }
      h.assertStrictEqual(harness.getState().isAutoWalk, true, 'Auto-walk traversed 50 steps at turbo speed');

      // Step 3: Switch to Music Visualizer (Tab 3), select БИТ-СТРОБ
      harness.switchTab(3);
      h.assertStrictEqual(harness.getState().isAutoWalk, false, 'Auto-walk automatically stopped upon leaving Tab 1');
      harness.setVisualizerActive(true, 'БИТ-СТРОБ');
      harness.setVisualizerSensitivity(1.4);

      // Step 4: Beat transient fires -> exponential strobe attack & decay
      const strobeOutput = h.evaluateVisualizerMode('БИТ-СТРОБ', { bass: 0.95, isBeat: true }, 0, 1.4);
      const effectiveStrobe = h.calculateEffectiveBrightness(strobeOutput.brightness, 220, true);
      h.assertStrictEqual(effectiveStrobe[0] <= 220, true, 'Strobe peak is capped by master brightness 220');

      // Step 5: Switch to РАДАР mode for circular 360-degree light show
      harness.setVisualizerActive(true, 'РАДАР');
      const radarOut = h.evaluateVisualizerMode('РАДАР', { bass: 0.8 }, 100, 1.4);
      h.assertStrictEqual(radarOut.activePixels.length > 0, true, 'Radar lights circular micro-LEDs');

      // Step 6: Stop visualizer and return to Tab 0
      harness.setVisualizerActive(false);
      harness.switchTab(0);
      const finalState = harness.getState();
      h.assertStrictEqual(finalState.masterBrightness, 220, 'Master brightness remains intact after stage session');
      h.assertStrictEqual(finalState.activePixel, null, 'Active micro-LED extinguished on return to Tab 0');
    },
  },

  // ==========================================================================
  // Scenario 2: Compact Touch Ergonomics & Clean Control Session (F1, F2, F3, F4)
  // ==========================================================================
  {
    id: 'T4_SCEN_02',
    feature: 'F1,F2,F3,F4',
    tier: 4,
    description: 'Compact Touch Ergonomics & Clean Control Session: No-Scroll Layout, Zero Scenes, Zero Labels, Decoupled Controls',
    run: async (h) => {
      // Step 1: Layout budget on standard mobile screen (390x844dp)
      const budget = h.evaluateControlTabLayoutBudget({
        viewportHeight: 844,
        silhouetteSize: 215,
        masterCardHeight: 70,
        arcCardHeight: 58,
        hasScenesCard: false,
      });
      h.assertStrictEqual(budget.isZeroScroll, true, 'Control tab must fit without scrolling');

      // Step 2: Code inspection for complete removal of scenes and labels
      const source = h.loadSource('src/screens/ControlScreen.js');
      h.assertStrictEqual(/быстры[ея]\s*(сцены|цены)/i.test(source), false, 'Zero occurrences of scenes title');
      h.assertStrictEqual(source.includes('ЯРКОСТЬ ДУГИ'), false, 'Zero occurrences of "ЯРКОСТЬ ДУГИ"');

      // Step 3: Manipulate individual arcs independently
      const harness = h.createStudioStateHarness({ masterBrightness: 255 });
      harness.setArcBrightness(0, 180);
      harness.setArcBrightness(1, 90);
      harness.setArcBrightness(2, 240);

      const stateAfterArcs = harness.getState();
      h.assertDeepEqual(stateAfterArcs.brightness, [180, 90, 240], 'All 3 arcs store independent setpoints');
      h.assertStrictEqual(stateAfterArcs.masterBrightness, 255, 'Master brightness remains 255');

      // Step 4: 50% Master preset -> effective output scales non-destructively
      harness.setMasterBrightness(128);
      const effective50 = harness.getEffectiveBrightness();
      h.assertStrictEqual(effective50[0], Math.round(180 * (128 / 255)));
      h.assertStrictEqual(effective50[1], Math.round(90 * (128 / 255)));
      h.assertStrictEqual(effective50[2], Math.round(240 * (128 / 255)));
      h.assertDeepEqual(harness.getState().brightness, [180, 90, 240], 'Stored arc setpoints are preserved');

      // Step 5: Master power toggle OFF then ON
      harness.togglePower();
      h.assertDeepEqual(harness.getEffectiveBrightness(), [0, 0, 0], 'Blackout when master power is OFF');
      harness.togglePower();
      h.assertDeepEqual(harness.getEffectiveBrightness(), effective50, 'Original scaled brightness restored when master power is turned back ON');
    },
  },

  // ==========================================================================
  // Scenario 3: Techno Sequencer & Light Show Combo (F5, F6, F8)
  // ==========================================================================
  {
    id: 'T4_SCEN_03',
    feature: 'F5,F6,F8',
    tier: 4,
    description: 'Techno Sequencer & Light Show Combo: 8-Step Modulo Playback, Preset Loading, and Glitch Music Reactivity',
    run: async (h) => {
      // Step 1: Open Sequencer (Tab 2)
      const harness = h.createStudioStateHarness({ currentTab: 2 });

      // Step 2: Load TECHNO preset (8 steps)
      const technoPreset = {
        topleft: [1, 0, 0, 0, 1, 0, 1, 1],
        bottomleft: [0, 0, 1, 0, 0, 1, 0, 0],
        right: [0, 1, 0, 1, 0, 1, 1, 0],
      };
      harness.loadSequencerPreset(technoPreset);
      const tracks = harness.getState().sequencerTracks;
      h.assertStrictEqual(tracks.topleft.length, 8, 'Topleft has exactly 8 steps');
      h.assertStrictEqual(tracks.bottomleft.length, 8, 'Bottomleft has exactly 8 steps');
      h.assertStrictEqual(tracks.right.length, 8, 'Right has exactly 8 steps');

      // Step 3: Run playback for 16 ticks (2 full 8-step loops)
      harness.setSequencerPlaying(true);
      const visitedSteps = [];
      for (let i = 0; i < 16; i++) {
        visitedSteps.push(harness.stepSequencer());
      }
      h.assertStrictEqual(visitedSteps.every((s) => s >= 0 && s <= 7), true, 'All steps strictly within 0..7');
      h.assertStrictEqual(visitedSteps[7], 0, 'Step wraps from 7 back to 0 on 8th tick');
      h.assertStrictEqual(visitedSteps[15], 0, 'Step wraps from 7 back to 0 on 16th tick');

      // Step 4: Toggle cell on Step 3
      harness.toggleSequencerCell('topleft', 3);
      h.assertStrictEqual(harness.getState().sequencerTracks.topleft[3], 1, 'Toggled cell 3 to active (1)');

      // Step 5: Stop sequencer, switch to Visualizer (Tab 3) in ГЛИЧ mode
      harness.setSequencerPlaying(false);
      harness.switchTab(3);
      harness.setVisualizerActive(true, 'ГЛИЧ');
      harness.setVisualizerSensitivity(1.1);

      // Step 6: Verify glitch mode outputs stroboscopic micro-stutters
      const glitchActive = h.evaluateVisualizerMode('ГЛИЧ', { bass: 0.9 }, 20, 1.1);
      h.assertStrictEqual(glitchActive.brightness[0] === 255 || glitchActive.brightness[2] === 255, true, 'Glitch pulse fires arcs');
    },
  },

  // ==========================================================================
  // Scenario 4: Rapid Audio Dynamic Stress & Fallback Session (F7, F8, F1)
  // ==========================================================================
  {
    id: 'T4_SCEN_04',
    feature: 'F7,F8,F1',
    tier: 4,
    description: 'Rapid Audio Dynamic Stress & Fallback Session: Silence to Blast, Mode Cycling, Master Ceiling Enforced',
    run: async (h) => {
      const masterCeiling = 180;
      const harness = h.createStudioStateHarness({ masterBrightness: masterCeiling, currentTab: 3 });
      harness.setVisualizerActive(true, 'СПЕКТР EQ');

      // Phase 1: Silence
      const silentOut = h.evaluateVisualizerMode('СПЕКТР EQ', { bass: 0, mid: 0, treble: 0 }, 0, 1.0);
      const effectiveSilent = h.calculateEffectiveBrightness(silentOut.brightness, masterCeiling, true);
      h.assertDeepEqual(effectiveSilent, [0, 0, 0], 'Silence results in [0, 0, 0]');

      // Phase 2: Massive volume blast
      const blastOut = h.evaluateVisualizerMode('СПЕКТР EQ', { bass: 1.0, mid: 1.0, treble: 1.0 }, 0, 2.0);
      const effectiveBlast = h.calculateEffectiveBrightness(blastOut.brightness, masterCeiling, true);
      effectiveBlast.forEach((b) => {
        h.assertStrictEqual(b <= masterCeiling, true, 'Blast brightness never exceeds master ceiling 180');
      });

      // Phase 3: Transition to ВОЛНА and ИСКРЫ under dynamic stress
      const waveOut = h.evaluateVisualizerMode('ВОЛНА', { bass: 0.6, mid: 0.7 }, 250, 1.0);
      h.assertStrictEqual(waveOut.activePixels.length > 0, true, 'Wave mode emits traveling active pixels');

      const sparksOut = h.evaluateVisualizerMode('ИСКРЫ', { treble: 0.95, isBeat: true }, 300, 1.0);
      h.assertStrictEqual(sparksOut.activePixels.length >= 2, true, 'Sparks mode emits randomized constellation');

      // Phase 4: Stop visualizer -> verify complete blackout
      harness.setVisualizerActive(false);
      h.assertStrictEqual(harness.getState().activePixel, null, 'All micro-LEDs extinguished on stop');
    },
  },

  // ==========================================================================
  // Scenario 5: Full Studio Workflow Session (Cross-Cutting F1 through F8)
  // ==========================================================================
  {
    id: 'T4_SCEN_05',
    feature: 'F1,F2,F3,F4,F5,F6,F7,F8',
    tier: 4,
    description: 'Full Studio Workflow Session: Cross-Tab Journey Across Controls, Walk, Sequencer, and Music',
    run: async (h) => {
      // Step 1: Tab 0 Setup
      const harness = h.createStudioStateHarness({ currentTab: 0 });
      harness.setArcBrightness(0, 100);
      harness.setArcBrightness(1, 150);
      harness.setArcBrightness(2, 200);
      harness.setMasterBrightness(200);

      // Step 2: Tab 1 Auto-Walk
      harness.switchTab(1);
      harness.setAutoWalk(true, 1, 'forward'); // 1ms hyper-turbo
      for (let i = 0; i < 36; i++) {
        harness.stepAutoWalk();
      }

      // Step 3: Tab 2 Sequencer
      harness.switchTab(2);
      harness.loadSequencerPreset({
        topleft: [1, 0, 0, 1, 0, 0, 1, 0],
        bottomleft: [0, 0, 1, 0, 0, 1, 0, 0],
        right: [1, 0, 1, 0, 1, 0, 1, 0],
      });
      harness.setSequencerPlaying(true);
      for (let i = 0; i < 8; i++) {
        harness.stepSequencer();
      }
      harness.clearSequencer();
      harness.setSequencerPlaying(false);

      // Step 4: Tab 3 Visualizer across all 6 modes
      harness.switchTab(3);
      const modes = ['СПЕКТР EQ', 'БИТ-СТРОБ', 'ВОЛНА', 'ИСКРЫ', 'ГЛИЧ', 'РАДАР'];
      modes.forEach((mode, idx) => {
        harness.setVisualizerActive(true, mode);
        const out = h.evaluateVisualizerMode(mode, { bass: 0.8, mid: 0.6, treble: 0.7, isBeat: idx % 2 === 0 }, idx * 60, 1.0);
        h.assertStrictEqual(out.brightness.length, 3, `Mode ${mode} emits 3 arc channels`);
      });
      harness.setVisualizerActive(false);

      // Step 5: Return to Tab 0 -> Verify state persistence
      harness.switchTab(0);
      const endState = harness.getState();
      h.assertStrictEqual(endState.currentTab, 0, 'Back on Tab 0');
      h.assertStrictEqual(endState.masterBrightness, 200, 'Master brightness remains 200');
      h.assertDeepEqual(endState.brightness, [100, 150, 200], 'Arc setpoints preserved without corruption');
      h.assertStrictEqual(endState.activePixel, null, 'Active pixel is cleanly reset to null');
    },
  },

  // ==========================================================================
  // Scenario 6: High-Cadence Rapid Tab & Mode Cycling Session (F1, F5, F6, F7, F8)
  // ==========================================================================
  {
    id: 'T4_SCEN_06',
    feature: 'F1,F5,F6,F7,F8',
    tier: 4,
    description: 'High-Cadence Rapid Tab & Mode Cycling Session: Rapid Navigation with Active Engines and Master Changes',
    run: async (h) => {
      const harness = h.createStudioStateHarness();

      for (let cycle = 0; cycle < 5; cycle++) {
        // Tab 0
        harness.switchTab(0);
        harness.setMasterBrightness((cycle * 50) % 256);

        // Tab 1 (Auto-walk)
        harness.switchTab(1);
        harness.setAutoWalk(true, 5);
        harness.stepAutoWalk();

        // Tab 2 (Sequencer)
        harness.switchTab(2);
        harness.setSequencerPlaying(true);
        harness.stepSequencer();

        // Tab 3 (Visualizer)
        harness.switchTab(3);
        harness.setVisualizerActive(true, 'БИТ-СТРОБ');
        h.evaluateVisualizerMode('БИТ-СТРОБ', { bass: 0.9, isBeat: true }, cycle * 100, 1.0);
      }

      // Finish by returning to Tab 0
      harness.switchTab(0);
      const finalState = harness.getState();
      h.assertStrictEqual(finalState.currentTab, 0, 'Safely returned to Tab 0');
      h.assertStrictEqual(finalState.isAutoWalk, false, 'Auto-walk stopped');
      h.assertStrictEqual(finalState.visualizerActive, false, 'Visualizer stopped');
      h.assertStrictEqual(finalState.activePixel, null, 'Active pixel extinguished');
    },
  },
];

module.exports = {
  tier: 4,
  name: 'Tier 4: Real-World Application Scenarios',
  tests,
};
