#!/usr/bin/env node
/**
 * ============================================================================
 * BABA Glyph Studio — Master E2E Automated Test Runner
 * ============================================================================
 * Opaque-box, requirement-driven test runner for Tiers 1 through 4.
 * Pure Node.js (v18+) execution with zero external runtime dependencies.
 *
 * Usage:
 *   node tests/e2e_runner.js [options]
 *
 * Options:
 *   -t, --tier <1|2|3|4>    Execute only the specified tier
 *   -f, --feature <F1..F8>  Execute only tests matching feature ID
 *   -v, --verbose           Print verbose timing and assertion details
 *   -b, --bail              Stop execution immediately on first failure
 *   --timeout <ms>          Per-test execution timeout in ms (default: 5000)
 *   --json                  Output summary as formatted JSON
 *   -h, --help              Show usage information
 *
 * Exit Codes:
 *   0 = All tests executed and passed
 *   1 = One or more tests failed, or suite configuration error, or no tests matched
 * ============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { performance } = require('node:perf_hooks');

// Import shared test helpers
const helpers = require('./test_helpers');

// ANSI Terminal Colors & Styling
const isTTY = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
const c = {
  reset: isTTY ? '\x1b[0m' : '',
  bold: isTTY ? '\x1b[1m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  red: isTTY ? '\x1b[31m' : '',
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  blue: isTTY ? '\x1b[34m' : '',
  magenta: isTTY ? '\x1b[35m' : '',
  cyan: isTTY ? '\x1b[36m' : '',
  white: isTTY ? '\x1b[37m' : '',
  gray: isTTY ? '\x1b[90m' : '',
  bgRed: isTTY ? '\x1b[41m' : '',
  bgGreen: isTTY ? '\x1b[42m' : '',
};

// Parse Command Line Arguments
function parseArgs(args) {
  const options = {
    tier: null,
    feature: null,
    verbose: false,
    bail: false,
    json: false,
    timeout: 5000,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-t' || arg === '--tier') {
      options.tier = parseInt(args[++i], 10);
    } else if (arg === '-f' || arg === '--feature') {
      options.feature = (args[++i] || '').toUpperCase();
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '-b' || arg === '--bail') {
      options.bail = true;
    } else if (arg === '--timeout') {
      options.timeout = parseInt(args[++i], 10) || 5000;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${c.bold}BABA Glyph Studio E2E Test Runner${c.reset}

Usage: node tests/e2e_runner.js [options]

Options:
  -t, --tier <1-4>      Run specific tier (1: Features, 2: Boundaries, 3: Pairwise, 4: Scenarios)
  -f, --feature <ID>    Run specific feature (F1 through F8)
  -v, --verbose         Display detailed assertions, steps, and timing
  -b, --bail            Exit on first test failure
  --timeout <ms>        Per-test execution timeout in milliseconds (default: 5000)
  --json                Output results in JSON format
  -h, --help            Show this help message
`);
}

// Master Suite Definitions
const SUITE_CONFIGS = [
  { tier: 1, file: './tier1_features.test.js', name: 'Tier 1: Feature Coverage (F1..F8)' },
  { tier: 2, file: './tier2_boundaries.test.js', name: 'Tier 2: Boundary & Corner Cases (F1..F8)' },
  { tier: 3, file: './tier3_pairwise.test.js', name: 'Tier 3: Cross-Feature Pairwise Interactions' },
  { tier: 4, file: './tier4_scenarios.test.js', name: 'Tier 4: Real-World Application Scenarios' },
];

// Helper to parse single or comma/space-separated feature identifiers into clean array
function parseFeatureList(featureField) {
  if (!featureField) return [];
  if (Array.isArray(featureField)) {
    return Array.from(new Set(
      featureField
        .map(f => String(f).trim().toUpperCase())
        .filter(f => /^F[1-8]$/.test(f))
    ));
  }
  if (typeof featureField === 'string') {
    return Array.from(new Set(
      featureField
        .split(/[,+\s]+/)
        .map(f => f.trim().toUpperCase())
        .filter(f => /^F[1-8]$/.test(f))
    ));
  }
  return [];
}

// Scoped Helpers Wrapper for --verbose Logging and Diagnostic Interception
function createScopedHelpers(baseHelpers, verbose, onRecord) {
  if (!verbose) return baseHelpers;

  const scoped = Object.create(baseHelpers);

  function truncate(val, max = 50) {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'string') {
      const clean = val.replace(/\s+/g, ' ');
      return clean.length > max ? clean.slice(0, max - 3) + '...' : clean;
    }
    if (typeof val === 'object') {
      try {
        const s = JSON.stringify(val);
        return s.length > max ? s.slice(0, max - 3) + '...' : s;
      } catch {
        return String(val);
      }
    }
    return String(val);
  }

  const wrapAssertion = (fnName, formatSuccess, formatFailure) => {
    const orig = baseHelpers[fnName];
    if (typeof orig !== 'function') return;
    scoped[fnName] = function (...args) {
      try {
        const ret = orig.apply(baseHelpers, args);
        if (onRecord) {
          onRecord({
            type: 'assertion',
            name: fnName,
            status: 'pass',
            detail: formatSuccess ? formatSuccess(args) : '',
          });
        }
        return ret;
      } catch (err) {
        if (onRecord) {
          onRecord({
            type: 'assertion',
            name: fnName,
            status: 'fail',
            detail: formatFailure ? formatFailure(args, err) : err.message,
            error: err.message,
          });
        }
        throw err;
      }
    };
  };

  wrapAssertion(
    'assertStrictEqual',
    args => `${args[2] ? args[2] + ': ' : ''}${truncate(args[0])} === ${truncate(args[1])}`,
    (args, err) => `${args[2] ? args[2] + ': ' : ''}${truncate(args[0])} !== ${truncate(args[1])} — ${err.message}`
  );

  wrapAssertion(
    'assertDeepEqual',
    args => `${args[2] ? args[2] + ': ' : ''}deepEquals(${truncate(args[0])}, ${truncate(args[1])})`,
    (args, err) => `${args[2] ? args[2] + ': ' : ''}deepEquals failed: ${err.message}`
  );

  wrapAssertion(
    'assertInRange',
    args => `${args[3] || 'Value'}: ${truncate(args[0])} in range [${args[1]}, ${args[2]}]`,
    (args, err) => `${args[3] || 'Value'}: ${truncate(args[0])} out of range [${args[1]}, ${args[2]}]`
  );

  wrapAssertion(
    'assertCloseTo',
    args => `${args[3] || 'Value'}: ${truncate(args[0])} ≈ ${truncate(args[1])} ±${args[2] || 0.001}`,
    (args, err) => `${args[3] || 'Value'}: ${truncate(args[0])} not close to ${truncate(args[1])} ±${args[2] || 0.001}`
  );

  wrapAssertion(
    'assertPresenceOfPattern',
    args => `pattern present: ${truncate(String(args[1]))} in ${truncate(args[2] || 'source')}`,
    (args, err) => `pattern NOT found: ${truncate(String(args[1]))}`
  );

  wrapAssertion(
    'assertAbsenceOfPattern',
    args => `pattern absent: ${truncate(String(args[1]))} in ${truncate(args[2] || 'source')}`,
    (args, err) => `pattern UNEXPECTEDLY found: ${truncate(String(args[1]))}`
  );

  wrapAssertion(
    'assertThrows',
    args => `assertThrows passed${args[2] ? ' (' + args[2] + ')' : ''}`,
    (args, err) => `assertThrows failed: ${err.message}`
  );

  wrapAssertion(
    'assertDoesNotThrow',
    args => `assertDoesNotThrow passed${args[1] ? ' (' + args[1] + ')' : ''}`,
    (args, err) => `assertDoesNotThrow threw: ${err.message}`
  );

  scoped.step = (desc) => {
    if (onRecord) onRecord({ type: 'step', desc });
  };

  scoped.log = (...items) => {
    if (onRecord) onRecord({ type: 'log', detail: items.map(truncate).join(' ') });
  };

  return scoped;
}

// Load and Validate a Test Suite File
function loadSuite(config) {
  const fullPath = path.resolve(__dirname, config.file);
  if (!fs.existsSync(fullPath)) {
    return {
      tier: config.tier,
      name: config.name,
      file: config.file,
      tests: [],
      error: `Suite file not found: ${config.file}`,
      stack: null,
    };
  }

  try {
    const suiteModule = require(fullPath);
    const tests = Array.isArray(suiteModule) ? suiteModule : (suiteModule && suiteModule.tests ? suiteModule.tests : null);
    if (!tests || !Array.isArray(tests)) {
      return {
        tier: config.tier,
        name: (suiteModule && suiteModule.name) || config.name,
        file: config.file,
        tests: [],
        error: `Suite module must export an array of tests or an object with a .tests array`,
        stack: null,
      };
    }
    return {
      tier: config.tier,
      name: (suiteModule && suiteModule.name) || config.name,
      file: config.file,
      tests,
      error: null,
      stack: null,
    };
  } catch (err) {
    return {
      tier: config.tier,
      name: config.name,
      file: config.file,
      tests: [],
      error: `Failed to load suite: ${err.message}`,
      stack: err.stack,
    };
  }
}

// Formatter for Failure Details
function formatFailure(test, result, verbose = false) {
  const line = '─'.repeat(78);
  const maxStackLines = verbose ? 15 : 5;
  return `
${c.red}${c.bold}┌${line}┐
│ FAILURE: [${test.id}] ${(test.description || '').padEnd(64).slice(0, 64)} │
├${line}┤${c.reset}
  ${c.bold}Feature:${c.reset}     ${test.feature || 'N/A'}
  ${c.bold}Tier:${c.reset}        Tier ${test.tier}
  ${c.bold}Duration:${c.reset}    ${result.duration.toFixed(2)}ms
  ${c.bold}Error:${c.reset}       ${c.red}${result.error}${c.reset}
${result.stack ? `  ${c.bold}Stack Trace:${c.reset}\n${result.stack.split('\n').slice(1, maxStackLines).map(s => '    ' + c.gray + s.trim() + c.reset).join('\n')}` : ''}
${c.red}${c.bold}└${line}┘${c.reset}
`;
}

// Main Runner
async function run() {
  const options = parseArgs(process.argv.slice(2));
  const startTime = performance.now();

  if (!options.json) {
    console.log(`\n${c.bold}${c.cyan}================================================================================${c.reset}`);
    console.log(`${c.bold}${c.white} BABA GLYPH STUDIO — AUTOMATED E2E VERIFICATION RUNNER${c.reset}`);
    console.log(`${c.cyan} Target: expo-glyph-studio | Node: ${process.version} | ${new Date().toISOString()}${c.reset}`);
    console.log(`${c.bold}${c.cyan}================================================================================${c.reset}\n`);
  }

  // Filter suites by tier if requested
  const suitesToRun = SUITE_CONFIGS.filter(s => options.tier === null || s.tier === options.tier);

  const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tierBreakdown: {},
    featureBreakdown: {},
    failures: [],
  };

  // Initialize feature breakdown (F1..F8)
  for (let i = 1; i <= 8; i++) {
    stats.featureBreakdown[`F${i}`] = { total: 0, passed: 0, failed: 0 };
  }

  for (const config of suitesToRun) {
    const suite = loadSuite(config);
    stats.tierBreakdown[suite.tier] = {
      name: suite.name,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
    };

    if (suite.error) {
      stats.total++;
      stats.failed++;
      stats.tierBreakdown[suite.tier].total++;
      stats.tierBreakdown[suite.tier].failed++;

      const failureRecord = {
        test: {
          id: `TIER_${suite.tier}_LOAD_ERROR`,
          feature: null,
          tier: suite.tier,
          description: `Suite load failure: ${config.file}`,
        },
        duration: 0,
        error: suite.error,
        stack: suite.stack,
      };
      stats.failures.push(failureRecord);

      if (!options.json) {
        console.log(`  ${c.red}✗ [TIER ${suite.tier} LOAD ERROR] ${suite.name}: ${suite.error}${c.reset}`);
        if (options.verbose && suite.stack) {
          console.log(suite.stack.split('\n').slice(1, 8).map(s => '    ' + c.gray + s.trim() + c.reset).join('\n'));
        }
      }

      if (options.bail) {
        if (!options.json) {
          console.log(`\n${c.red}${c.bold}Execution halted immediately due to --bail flag.${c.reset}`);
        }
        break;
      }

      continue;
    }

    if (!options.json) {
      console.log(`${c.bold}${c.blue}[TIER ${suite.tier}] ${suite.name}${c.reset} (${suite.tests.length} tests)`);
    }

    const tierStartTime = performance.now();

    for (const test of suite.tests) {
      // Parse multi-feature identifiers
      const testFeatures = parseFeatureList(test.feature);

      // Filter by feature if requested (supporting single feature or comma-separated/multi-feature)
      if (options.feature && !testFeatures.includes(options.feature)) {
        continue;
      }

      stats.total++;
      stats.tierBreakdown[suite.tier].total++;
      for (const fid of testFeatures) {
        if (stats.featureBreakdown[fid]) {
          stats.featureBreakdown[fid].total++;
        }
      }

      const testStart = performance.now();
      let testPassed = false;
      let testError = null;
      let testStack = null;
      const assertionRecords = [];

      const scopedHelpers = createScopedHelpers(helpers, options.verbose, r => assertionRecords.push(r));

      try {
        if (typeof test.run !== 'function') {
          throw new Error(`Test ${test.id} missing executable run() function`);
        }

        const timeoutMs = options.timeout || 5000;
        let timer = null;
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Test timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        await Promise.race([test.run(scopedHelpers), timeoutPromise]).finally(() => {
          if (timer) clearTimeout(timer);
        });

        testPassed = true;
      } catch (err) {
        testPassed = false;
        testError = err.message || String(err);
        testStack = err.stack;
      }

      const duration = performance.now() - testStart;

      if (testPassed) {
        stats.passed++;
        stats.tierBreakdown[suite.tier].passed++;
        for (const fid of testFeatures) {
          if (stats.featureBreakdown[fid]) {
            stats.featureBreakdown[fid].passed++;
          }
        }
        if (!options.json) {
          const timeStr = `${duration.toFixed(1)}ms`;
          console.log(`  ${c.green}✓${c.reset} ${c.dim}[${test.id}]${c.reset} ${test.feature ? c.bold + test.feature + ': ' + c.reset : ''}${test.description} ${c.gray}(${timeStr})${c.reset}`);
          if (options.verbose && assertionRecords.length > 0) {
            for (const r of assertionRecords) {
              if (r.type === 'step') {
                console.log(`      ${c.cyan}▸ [step] ${r.desc}${c.reset}`);
              } else if (r.type === 'log') {
                console.log(`      ${c.gray}ℹ [log] ${r.detail}${c.reset}`);
              } else {
                console.log(`      ${c.green}↳ [PASS] ${r.detail || r.name}${c.reset}`);
              }
            }
          }
        }
      } else {
        stats.failed++;
        stats.tierBreakdown[suite.tier].failed++;
        for (const fid of testFeatures) {
          if (stats.featureBreakdown[fid]) {
            stats.featureBreakdown[fid].failed++;
          }
        }
        const failureRecord = {
          test,
          duration,
          error: testError,
          stack: testStack,
          assertions: assertionRecords,
        };
        stats.failures.push(failureRecord);

        if (!options.json) {
          console.log(`  ${c.red}✗ [${test.id}] ${test.feature ? test.feature + ': ' : ''}${test.description}${c.reset}`);
          if (options.verbose && assertionRecords.length > 0) {
            for (const r of assertionRecords) {
              if (r.status === 'fail') {
                console.log(`      ${c.red}↳ [FAIL] ${r.detail || r.name}${c.reset}`);
              } else if (r.type === 'step') {
                console.log(`      ${c.cyan}▸ [step] ${r.desc}${c.reset}`);
              } else {
                console.log(`      ${c.green}↳ [PASS] ${r.detail || r.name}${c.reset}`);
              }
            }
          }
          console.log(formatFailure(test, failureRecord, options.verbose));
        }

        if (options.bail) {
          if (!options.json) {
            console.log(`\n${c.red}${c.bold}Execution halted immediately due to --bail flag.${c.reset}`);
          }
          break;
        }
      }
    }

    stats.tierBreakdown[suite.tier].duration = performance.now() - tierStartTime;
    if (!options.json) console.log('');

    if (options.bail && stats.failed > 0) {
      break;
    }
  }

  const totalDuration = performance.now() - startTime;

  // Render JSON Output if requested
  if (options.json) {
    const isNoTests = stats.total === 0;
    const status = isNoTests ? 'NO_TESTS_MATCHED' : (stats.failed > 0 ? 'FAILED' : 'PASSED');

    const jsonOutput = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      durationMs: totalDuration,
      status,
      verdict: status,
      filter: {
        tier: options.tier,
        feature: options.feature,
      },
      summary: {
        status,
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped,
        passRate: stats.total > 0 ? Number(((stats.passed / stats.total) * 100).toFixed(1)) : 0,
      },
      tierBreakdown: stats.tierBreakdown,
      featureBreakdown: stats.featureBreakdown,
      failures: stats.failures.map(f => ({
        id: f.test.id,
        feature: f.test.feature,
        tier: f.test.tier,
        description: f.test.description,
        error: f.error,
        durationMs: f.duration,
        ...(options.verbose && f.assertions ? { assertions: f.assertions } : {}),
      })),
    };
    console.log(JSON.stringify(jsonOutput, null, 2));
    process.exit((stats.failed > 0 || stats.total === 0) ? 1 : 0);
  }

  // Render Executive Summary Table
  const hr = '═'.repeat(80);
  const thinHr = '─'.repeat(80);

  console.log(`${c.bold}${c.cyan}${hr}${c.reset}`);
  console.log(`${c.bold}${c.white} E2E TEST EXECUTION SUMMARY DASHBOARD${c.reset}`);
  console.log(`${c.bold}${c.cyan}${hr}${c.reset}`);
  console.log(`${c.bold}  Tier                          Total    Passed    Failed    Skipped    Duration${c.reset}`);
  console.log(`  ${thinHr.slice(2)}`);

  for (const tierNum of [1, 2, 3, 4]) {
    const tb = stats.tierBreakdown[tierNum];
    if (tb) {
      const name = tb.name.padEnd(28).slice(0, 28);
      const tot = String(tb.total).padStart(5);
      const pass = c.green + String(tb.passed).padStart(6) + c.reset;
      const fail = (tb.failed > 0 ? c.red : c.gray) + String(tb.failed).padStart(6) + c.reset;
      const skip = c.gray + String(tb.skipped).padStart(7) + c.reset;
      const time = `${tb.duration.toFixed(0)}ms`.padStart(11);
      console.log(`  Tier ${tierNum}: ${name} ${tot}    ${pass}    ${fail}    ${skip} ${time}`);
    }
  }

  console.log(`  ${thinHr.slice(2)}`);
  const totStr = String(stats.total).padStart(5);
  const passStr = c.green + String(stats.passed).padStart(6) + c.reset;
  const failStr = (stats.failed > 0 ? c.red : c.green) + String(stats.failed).padStart(6) + c.reset;
  const skipStr = c.gray + String(stats.skipped).padStart(7) + c.reset;
  const timeStr = `${totalDuration.toFixed(0)}ms`.padStart(11);
  console.log(`  ${c.bold}TOTAL                         ${totStr}    ${passStr}    ${failStr}    ${skipStr} ${timeStr}${c.reset}`);
  console.log(`${c.cyan}${thinHr}${c.reset}`);

  // Feature Coverage Matrix
  console.log(`${c.bold} Feature Coverage Matrix:${c.reset}`);
  const featureNames = {
    F1: 'Master Brightness Decoupling',
    F2: 'Remove "быстрые цены"',
    F3: 'No-Scroll «КОНТРОЛЬ» Tab',
    F4: 'Remove "яркость дуги" Labels',
    F5: 'Uniform Auto-Tour & Turbo Speed',
    F6: '8-Step Sequencer',
    F7: 'Audio-Reactive Flickering',
    F8: '6 Music Visualization Modes',
  };

  for (let i = 1; i <= 8; i++) {
    const fid = `F${i}`;
    const fb = stats.featureBreakdown[fid];
    const fname = (featureNames[fid] || fid).padEnd(32).slice(0, 32);
    const count = `${fb.passed}/${fb.total}`.padStart(7);
    const status = fb.total === 0 ? `${c.gray}NO TESTS${c.reset}` :
                   fb.failed === 0 ? `${c.green}✓ PASS (${count})${c.reset}` :
                   `${c.red}✗ FAIL (${count})${c.reset}`;
    console.log(`    ${c.bold}${fid}${c.reset} [${fname}]: ${status}`);
  }

  console.log(`${c.bold}${c.cyan}${hr}${c.reset}`);

  // Final Verdict
  if (stats.failed === 0 && stats.total > 0) {
    console.log(`${c.bold}${c.bgGreen}${c.white} VERDICT: ALL ${stats.total} TESTS PASSED (100.0%) in ${(totalDuration / 1000).toFixed(2)}s — EXIT 0 ${c.reset}\n`);
    process.exit(0);
  } else if (stats.total === 0) {
    const filterParts = [];
    if (options.tier !== null) filterParts.push(`tier=${options.tier}`);
    if (options.feature) filterParts.push(`feature=${options.feature}`);
    const filterStr = filterParts.length > 0 ? ` (${filterParts.join(', ')})` : '';
    console.log(`${c.bold}${c.yellow} VERDICT: NO TESTS MATCHED FILTER${filterStr} — EXIT 1 ${c.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${c.bold}${c.bgRed}${c.white} VERDICT: ${stats.failed} OF ${stats.total} TESTS FAILED — EXIT 1 ${c.reset}\n`);
    process.exit(1);
  }
}

// Execute Runner
run().catch(err => {
  console.error(`${c.red}FATAL ERROR IN RUNNER: ${err.message}${c.reset}`);
  console.error(err.stack);
  process.exit(1);
});
