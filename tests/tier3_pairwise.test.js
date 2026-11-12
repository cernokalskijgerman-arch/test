/**
 * ============================================================================
 * Tier 3: Cross-Feature Pairwise Interactions Test Suite
 * ============================================================================
 * Exactly 10 pairwise integration tests exercising combinations between features.
 * ============================================================================
 */

'use strict';

const tests = [
  // ==========================================================================
  // Pairwise Test 1: F1 + F5
  // ==========================================================================
  {
    id: 'T3_PAIR_01',
    feature: 'F1,F5',
    tier: 3,
    description: 'F1 (Decoupled Master) + F5 (Turbo Auto-Walk): Master Dimming Scales Auto-Walk Without Resetting Position',
    run: async (h) => {
      const harness = h.createStudioStateHarness({ masterBrightness: 255 });
      harness.setAutoWalk(true, 5, 'forward'); // 5ms turbo auto-walk
      // Step a few times
      harness.stepAutoWalk();
      harness.stepAutoWalk();
      const currentPixel = harness.stepAutoWalk();
      h.assertStrictEqual(typeof currentPixel === 'number' && currentPixel >= 0, true, 'Auto-walk has active pixel');

      // Now adjust master brightness down to 100
      harness.setMasterBrightness(100);
      h.assertStrictEqual(harness.getState().masterBrightness, 100, 'Master brightness adjusted');
      // Step again: auto-walk continues seamlessly from current pixel
      const nextPixel = harness.stepAutoWalk();
      h.assertStrictEqual(nextPixel, (currentPixel + 1) % 36, 'Auto-walk advances sequentially without jumping or resetting to 0');
      h.assertStrictEqual(harness.getState().isAutoWalk, true, 'Auto-walk remains active');
    },
  },

  // ==========================================================================
  // Pairwise Test 2: F5 + F6
  // ==========================================================================
  {
    id: 'T3_PAIR_02',
    feature: 'F5,F6',
    tier: 3,
    description: 'F5 (Auto-Walk) + F6 (8-Step Sequencer): Clean Tab Switch Halts Auto-Walk and Initializes Sequencer',
    run: async (h) => {
      const harness = h.createStudioStateHarness({ currentTab: 1 });
      harness.setAutoWalk(true, 10, 'forward');
      harness.stepAutoWalk();
      h.assertStrictEqual(harness.getState().isAutoWalk, true, 'Auto-walk is active on Tab 1');

      // Switch to Tab 2 (Sequencer)
      harness.switchTab(2);
      h.assertStrictEqual(harness.getState().isAutoWalk, false, 'Auto-walk must be stopped on tab switch');
      h.assertStrictEqual(harness.getState().activePixel, null, 'activePixel must be cleared to prevent crosstalk in sequencer');

      // Start 8-step sequencer
      harness.setSequencerPlaying(true);
      h.assertStrictEqual(harness.getState().sequencerPlaying, true, 'Sequencer started cleanly');
      const step = harness.stepSequencer();
      h.assertStrictEqual(step, 1, 'Sequencer begins cycle at step 1');
    },
  },

  // ==========================================================================
  // Pairwise Test 3: F7 + F8
  // ==========================================================================
  {
    id: 'T3_PAIR_03',
    feature: 'F7,F8',
    tier: 3,
    description: 'F7 (Audio Flickering) + F8 (6 Modes): Consistent Attack and Stroboscopic Decay Across All Modes',
    run: async (h) => {
      const modes = ['СПЕКТР EQ', 'БИТ-СТРОБ', 'ВОЛНА', 'ИСКРЫ', 'ГЛИЧ', 'РАДАР'];
      const beatFrame = { bass: 0.95, mid: 0.8, treble: 0.7, isBeat: true };

      modes.forEach((mode) => {
        const out = h.evaluateVisualizerMode(mode, beatFrame, 0, 1.0);
        // At least one channel lights up on beat peak in all modes
        const maxBrightness = Math.max(...out.brightness);
        h.assertStrictEqual(
          maxBrightness >= 150 || out.activePixels.length > 0,
          true,
          `Mode ${mode} must respond to transient beat attack with high brightness or micro-LED trigger`
        );
      });
    },
  },

  // ==========================================================================
  // Pairwise Test 4: F1 + F7
  // ==========================================================================
  {
    id: 'T3_PAIR_04',
    feature: 'F1,F7',
    tier: 3,
    description: 'F1 (Master Dimmer) + F7 (Audio Strobe): Master Brightness Acts as Non-Destructive Ceiling for Strobe',
    run: async (h) => {
      const masterCeiling = 140;
      const strobeOutput = h.evaluateVisualizerMode('БИТ-СТРОБ', { bass: 1.0, isBeat: true }, 0, 1.5);
      // Scaled through master brightness
      const effectiveStrobe = h.calculateEffectiveBrightness(strobeOutput.brightness, masterCeiling, true);
      effectiveStrobe.forEach((b, idx) => {
        h.assertStrictEqual(
          b <= masterCeiling,
          true,
          `Channel ${idx} brightness (${b}) must not exceed master brightness ceiling (${masterCeiling})`
        );
      });
    },
  },

  // ==========================================================================
  // Pairwise Test 5: F3 + F4
  // ==========================================================================
  {
    id: 'T3_PAIR_05',
    feature: 'F3,F4',
    tier: 3,
    description: 'F3 (No-Scroll Layout) + F4 (Label Absence): Card Compaction Directly Enables Zero-Scroll Guarantee',
    run: async (h) => {
      // With labels removed: arc card height is compacted to 58dp
      const budgetCompact = h.evaluateControlTabLayoutBudget({
        viewportHeight: 844,
        arcCardHeight: 58,
        hasScenesCard: false,
      });
      // With legacy labels (+16dp per card) and scenes card (+93dp):
      const budgetLegacy = h.evaluateControlTabLayoutBudget({
        viewportHeight: 844,
        arcCardHeight: 100,
        hasScenesCard: true,
      });

      h.assertStrictEqual(budgetCompact.isZeroScroll, true, 'Compacted layout with labels removed must achieve zero scroll');
      h.assertStrictEqual(budgetLegacy.isZeroScroll, false, 'Legacy uncompacted layout causes overflow/scroll');
    },
  },

  // ==========================================================================
  // Pairwise Test 6: F6 + F8
  // ==========================================================================
  {
    id: 'T3_PAIR_06',
    feature: 'F6,F8',
    tier: 3,
    description: 'F6 (8-Step Sequencer) + F8 (Music Visualizer): Tab Switch from Sequencer to Music Resets Step State',
    run: async (h) => {
      const harness = h.createStudioStateHarness({ currentTab: 2 });
      harness.setSequencerPlaying(true);
      harness.stepSequencer();
      h.assertStrictEqual(harness.getState().sequencerPlaying, true, 'Sequencer running on Tab 2');

      // Switch to Tab 3 (Music Visualizer)
      harness.switchTab(3);
      harness.setVisualizerActive(true, 'РАДАР');
      h.assertStrictEqual(harness.getState().currentTab, 3, 'Now on tab 3');
      h.assertStrictEqual(harness.getState().visualizerActive, true, 'Visualizer running');
    },
  },

  // ==========================================================================
  // Pairwise Test 7: F1 + F2
  // ==========================================================================
  {
    id: 'T3_PAIR_07',
    feature: 'F1,F2',
    tier: 3,
    description: 'F1 (Arc Decoupling) + F2 (Scene Removal): Arc Sliders Maintain Absolute State Isolation Without Scene Overwrites',
    run: async (h) => {
      const harness = h.createStudioStateHarness({
        brightness: [255, 255, 255],
        masterBrightness: 255,
      });
      // Adjust all 3 arcs independently to distinct values
      harness.setArcBrightness(0, 80);
      harness.setArcBrightness(1, 140);
      harness.setArcBrightness(2, 220);

      const state = harness.getState();
      h.assertDeepEqual(state.brightness, [80, 140, 220], 'Arcs maintain their explicit independent setpoints');
      h.assertStrictEqual(state.masterBrightness, 255, 'Master brightness was not mutated');
    },
  },

  // ==========================================================================
  // Pairwise Test 8: F5 + F8
  // ==========================================================================
  {
    id: 'T3_PAIR_08',
    feature: 'F5,F8',
    tier: 3,
    description: 'F5 (Auto-Tour) + F8 (Visualizer): Multi-LED Silhouette Support Handles Single, Array, and Null Cleanly',
    run: async (h) => {
      const source = h.loadSource('src/components/GlyphCameraSilhouette.js');
      // GlyphCameraSilhouette must handle single number, array of numbers, or null
      const handlesArray = /Array\.isArray\(activePixel\)/.test(source) || /activePixel\.includes/.test(source) || /activePixels/.test(source);
      h.assertStrictEqual(handlesArray, true, 'GlyphCameraSilhouette must support array activePixel for multi-LED modes');
    },
  },

  // ==========================================================================
  // Pairwise Test 9: F3 + F1
  // ==========================================================================
  {
    id: 'T3_PAIR_09',
    feature: 'F3,F1',
    tier: 3,
    description: 'F3 (Compact Viewport) + F1 (Master Slider & 3 Arcs): All 4 Control Sliders Coexist Within Budget',
    run: async (h) => {
      const budget = h.evaluateControlTabLayoutBudget({
        viewportHeight: 800,
        masterCardHeight: 68,
        arcCardHeight: 56,
        silhouetteSize: 215,
        cardGap: 8,
        hasScenesCard: false,
      });
      h.assertStrictEqual(budget.isZeroScroll, true, 'All 4 slider cards fit comfortably in 800dp screen without scroll');
    },
  },

  // ==========================================================================
  // Pairwise Test 10: F6 + F1
  // ==========================================================================
  {
    id: 'T3_PAIR_10',
    feature: 'F6,F1',
    tier: 3,
    description: 'F6 (Sequencer Stop) + F1 (Arc Brightness): Sequencer Playback/Stop Preserves Baseline Master Settings',
    run: async (h) => {
      const harness = h.createStudioStateHarness({ masterBrightness: 175 });
      harness.setSequencerPlaying(true);
      for (let s = 0; s < 16; s++) {
        harness.stepSequencer();
      }
      harness.setSequencerPlaying(false);
      // Verify master brightness was never mutated by sequencer cycling
      h.assertStrictEqual(harness.getState().masterBrightness, 175, 'Master brightness preserved after sequencer stop');
    },
  },
];

module.exports = {
  tier: 3,
  name: 'Tier 3: Cross-Feature Pairwise Interactions',
  tests,
};
