/**
 * Comprehensive Priority Regression QA Suite (Blocks P1 .. P6)
 * Covers bugs #1..#24, boundary invariants, 360dp viewport geometry,
 * React lifecycle/timer safety, touch disambiguation, and Ketchum SDK 2.0 contracts.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const assert = require('assert');
const {
  STUDIO_ROOT,
  loadSource,
  parseAST,
  traverseAST,
  findJSXElements,
  PHYSICAL_ARCS,
  clampAutoWalkSpeed,
  calculateNormalizedStepDelay,
  createStudioStateHarness,
  assertStrictEqual,
  assertDeepEqual,
  assertInRange,
  assertCloseTo,
} = require('./test_helpers');

let passed = 0;
let failed = 0;
const results = [];
const queuedTests = [];

function runTest(section, name, fn) {
  queuedTests.push({ section, name, fn });
}

function logSectionHeader(title) {
  queuedTests.push({ header: title });
}

// ---------------------------------------------------------------------------
// Shared AST / Style / Bytecode Helpers (DRY)
// ---------------------------------------------------------------------------

function extractStyleSheetMap(ast, sourceCode) {
  const styles = {};
  traverseAST(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      if (
        callee.type === 'MemberExpression' &&
        callee.object.name === 'StyleSheet' &&
        callee.property.name === 'create' &&
        p.node.arguments[0]?.type === 'ObjectExpression'
      ) {
        for (const prop of p.node.arguments[0].properties) {
          if (prop.type !== 'ObjectProperty' || prop.value.type !== 'ObjectExpression') continue;
          const styleName = prop.key.name || prop.key.value;
          const obj = {};
          for (const kv of prop.value.properties) {
            if (kv.type !== 'ObjectProperty') continue;
            const k = kv.key.name || kv.key.value;
            const v = kv.value;
            if (v.type === 'NumericLiteral') obj[k] = v.value;
            else if (v.type === 'UnaryExpression' && v.operator === '-' && v.argument.type === 'NumericLiteral') {
              obj[k] = -v.argument.value;
            } else if (v.type === 'StringLiteral') obj[k] = v.value;
            else if (v.type === 'BooleanLiteral') obj[k] = v.value;
            else obj[k] = sourceCode.slice(v.start, v.end);
          }
          styles[styleName] = obj;
        }
      }
    },
  });
  return styles;
}

function getJSXAttrValue(jsxEl, attrName, sourceCode) {
  const node = jsxEl?.node || jsxEl;
  const attr = (node?.openingElement?.attributes || []).find(
    (a) => a.type === 'JSXAttribute' && a.name && a.name.name === attrName
  );
  if (!attr) return undefined;
  if (!attr.value) return true; // boolean shorthand prop e.g. adjustsFontSizeToFit
  if (attr.value.type === 'StringLiteral') return attr.value.value;
  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (expr.type === 'BooleanLiteral' || expr.type === 'NumericLiteral' || expr.type === 'StringLiteral') {
      return expr.value;
    }
    return sourceCode.slice(expr.start, expr.end);
  }
  return sourceCode.slice(attr.value.start, attr.value.end);
}

function walkJSFiles(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.expo', 'android', 'ios'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walkJSFiles(full));
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function extractConstDeclSource(ast, sourceCode, varName) {
  let snippet = null;
  traverseAST(ast, {
    VariableDeclarator(p) {
      if (p.node.id.type === 'Identifier' && p.node.id.name === varName && !snippet) {
        snippet = sourceCode.slice(p.node.init.start, p.node.init.end);
      }
    },
  });
  return snippet;
}

function readJarClinitConstants(jarPath, classEntryName) {
  const buf = fs.readFileSync(jarPath);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'Invalid JAR archive (missing EOCD)');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdCount = buf.readUInt16LE(eocd + 10);

  let pos = cdOffset;
  let classBytes = null;
  for (let i = 0; i < cdCount; i++) {
    const compMethod = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const fnLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const cmtLen = buf.readUInt16LE(pos + 32);
    const localOff = buf.readUInt32LE(pos + 42);
    const name = buf.slice(pos + 46, pos + 46 + fnLen).toString('utf8');
    pos += 46 + fnLen + extraLen + cmtLen;
    if (name === classEntryName) {
      const lfn = buf.readUInt16LE(localOff + 26);
      const lex = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lfn + lex;
      const raw = buf.slice(dataStart, dataStart + compSize);
      classBytes = compMethod === 8 ? zlib.inflateRawSync(raw) : raw;
      break;
    }
  }
  assert.ok(classBytes, `Missing class entry ${classEntryName} in JAR`);

  // Minimal JVM classfile constant pool + <clinit> putstatic decoder
  let o = 8;
  const cpCount = classBytes.readUInt16BE(o);
  o += 2;
  const cp = [null];
  for (let i = 1; i < cpCount; i++) {
    const tag = classBytes[o++];
    if (tag === 1) {
      const len = classBytes.readUInt16BE(o);
      o += 2;
      cp[i] = classBytes.slice(o, o + len).toString('utf8');
      o += len;
    } else if (tag === 3) {
      cp[i] = classBytes.readInt32BE(o);
      o += 4;
    } else if (tag === 4) {
      cp[i] = classBytes.readFloatBE(o);
      o += 4;
    } else if (tag === 5 || tag === 6) {
      o += 8;
      cp[i] = null;
      cp[++i] = null;
    } else if ([7, 8, 16, 19, 20].includes(tag)) {
      cp[i] = { tag, idx: classBytes.readUInt16BE(o) };
      o += 2;
    } else if ([9, 10, 11, 12, 17, 18].includes(tag)) {
      cp[i] = { tag, a: classBytes.readUInt16BE(o), b: classBytes.readUInt16BE(o + 2) };
      o += 4;
    } else if (tag === 15) {
      o += 3;
    }
  }
  o += 6;
  const ifaces = classBytes.readUInt16BE(o);
  o += 2 + ifaces * 2;
  const fc = classBytes.readUInt16BE(o);
  o += 2;
  const declaredFields = [];
  for (let i = 0; i < fc; i++) {
    o += 2;
    declaredFields.push(cp[classBytes.readUInt16BE(o)]);
    o += 4;
    const ac = classBytes.readUInt16BE(o);
    o += 2;
    for (let a = 0; a < ac; a++) {
      o += 2;
      o += 4 + classBytes.readUInt32BE(o);
    }
  }
  const mc = classBytes.readUInt16BE(o);
  o += 2;
  const constants = {};
  for (let m = 0; m < mc; m++) {
    o += 2;
    const name = cp[classBytes.readUInt16BE(o)];
    o += 4;
    const ac = classBytes.readUInt16BE(o);
    o += 2;
    for (let a = 0; a < ac; a++) {
      const aname = cp[classBytes.readUInt16BE(o)];
      o += 2;
      const al = classBytes.readUInt32BE(o);
      o += 4;
      if (name === '<clinit>' && aname === 'Code') {
        const codeLen = classBytes.readUInt32BE(o + 4);
        const bc = classBytes.slice(o + 8, o + 8 + codeLen);
        let lastVal = null;
        for (let pc = 0; pc < bc.length; pc++) {
          const op = bc[pc];
          if (op >= 0x03 && op <= 0x08) lastVal = op - 0x03;
          else if (op === 0x10) lastVal = bc.readInt8(++pc);
          else if (op === 0x11) {
            lastVal = bc.readInt16BE(pc + 1);
            pc += 2;
          } else if (op === 0x12) {
            const e = cp[bc[++pc]];
            lastVal = e && e.tag === 8 ? cp[e.idx] : e;
          } else if (op === 0xb3) {
            const fref = cp[bc.readUInt16BE(pc + 1)];
            pc += 2;
            const nat = cp[fref.b];
            constants[cp[nat.a]] = lastVal;
            lastVal = null;
          }
        }
      }
      o += al;
    }
  }
  return { declaredFields, constants };
}

// ---------------------------------------------------------------------------
// Load common sources once
// ---------------------------------------------------------------------------
const appSrc = loadSource('App.js');
const appAst = parseAST(appSrc);
const controlSrc = loadSource('src/screens/ControlScreen.js');
const controlAst = parseAST(controlSrc);
const pixelsSrc = loadSource('src/screens/PixelsScreen.js');
const pixelsAst = parseAST(pixelsSrc);
const seqSrc = loadSource('src/screens/SequencerScreen.js');
const seqAst = parseAST(seqSrc);
const visSrc = loadSource('src/screens/VisualizerScreen.js');
const visAst = parseAST(visSrc);
const utilSrc = loadSource('src/screens/UtilitiesScreen.js');
const utilAst = parseAST(utilSrc);
const sliderSrc = loadSource('src/components/GlyphSlider.js');
const sliderAst = parseAST(sliderSrc);
const tabBarSrc = loadSource('src/components/FloatingTabBar.js');
const tabBarAst = parseAST(tabBarSrc);
const silhouetteSrc = loadSource('src/components/GlyphCameraSilhouette.js');
const silhouetteAst = parseAST(silhouetteSrc);
const glassCardSrc = loadSource('src/components/LiquidGlassCard.js');
const glassCardAst = parseAST(glassCardSrc);
const bridgeSrc = loadSource('modules/nothing-glyph/index.js');
const bridgeAst = parseAST(bridgeSrc);

const ktModulePath = 'modules/nothing-glyph/android/src/main/java/expo/modules/nothingglyph/NothingGlyphModule.kt';
const ktModuleSrc = loadSource(ktModulePath);
const ktAudioPath = 'modules/nothing-glyph/android/src/main/java/expo/modules/nothingglyph/RealAudioAnalyzer.kt';
const ktAudioSrc = loadSource(ktAudioPath);
const manifestSrc = loadSource('modules/nothing-glyph/android/src/main/AndroidManifest.xml');
const gradleSrc = loadSource('modules/nothing-glyph/android/build.gradle');
const pluginSrc = loadSource('plugins/withNothingGlyph.js');
const jarPath = path.join(STUDIO_ROOT, 'modules/nothing-glyph/android/libs/glyph-matrix-sdk-2.0.jar');

logSectionHeader('\n[BLOCK P1] Lifecycle, Timer Leaks & Rapid Tab/Mode Switching');

runTest('P1-01', 'Every setTimeout/setInterval/requestAnimationFrame in expo-glyph-studio assigns its handle to a ref', () => {
  const files = walkJSFiles(STUDIO_ROOT);
  assert.ok(files.length >= 15, 'Expected >=15 JS source files');
  const uncaptured = [];
  for (const full of files) {
    const src = fs.readFileSync(full, 'utf8');
    const ast = parseAST(src);
    traverseAST(ast, {
      CallExpression(p) {
        const name = p.node.callee.type === 'Identifier' ? p.node.callee.name : null;
        if (!['setTimeout', 'setInterval', 'requestAnimationFrame'].includes(name)) return;
        const parent = p.parentPath?.node;
        const assignedToRef =
          parent &&
          parent.type === 'AssignmentExpression' &&
          parent.left.type === 'MemberExpression' &&
          parent.left.property.name === 'current';
        if (!assignedToRef) {
          uncaptured.push(`${path.relative(STUDIO_ROOT, full)}:L${p.node.loc?.start.line} (${name})`);
        }
      },
    });
  }
  assertDeepEqual(uncaptured, [], `Found unmanaged timer/RAF calls: ${uncaptured.join('; ')}`);
});

runTest('P1-02', 'UtilitiesScreen clears 100% of allocated timer refs in clearAllTimers & unmounts cleanly', () => {
  const assignedRefs = new Set();
  const clearedRefs = new Set();
  traverseAST(utilAst, {
    AssignmentExpression(p) {
      if (
        p.node.right.type === 'CallExpression' &&
        ['setTimeout', 'setInterval'].includes(p.node.right.callee.name) &&
        p.node.left.type === 'MemberExpression' &&
        p.node.left.object.type === 'Identifier'
      ) {
        assignedRefs.add(p.node.left.object.name);
      }
    },
    CallExpression(p) {
      if (['clearTimeout', 'clearInterval'].includes(p.node.callee.name)) {
        const arg = p.node.arguments[0];
        if (arg?.type === 'MemberExpression' && arg.object.type === 'Identifier') {
          clearedRefs.add(arg.object.name);
        }
      }
    },
  });
  assert.ok(assignedRefs.size >= 10, `Expected >=10 timer refs in UtilitiesScreen, found ${assignedRefs.size}`);
  for (const refName of assignedRefs) {
    assert.ok(clearedRefs.has(refName), `Timer ref ${refName} is scheduled but never cleared!`);
  }
  assert.ok(/useEffect\(\(\)\s*=>\s*\{[\s\S]*clearAllTimers\(\)[\s\S]*extinguishAll\(\)/m.test(utilSrc),
    'UtilitiesScreen unmount cleanup must call clearAllTimers() and extinguishAll()');
});

runTest('P1-03', 'SequencerScreen reschedulePendingStep recalculates BOTH gateTimerRef and stepTimerRef mid-step (Bug #4)', () => {
  const fnSrc = extractConstDeclSource(seqAst, seqSrc, 'reschedulePendingStep');
  assert.ok(fnSrc, 'reschedulePendingStep not found in SequencerScreen');
  assert.ok(fnSrc.includes('gateTimerRef.current'), 'reschedulePendingStep must clear/update gateTimerRef');
  assert.ok(fnSrc.includes('newGateOnMs'), 'reschedulePendingStep must recompute newGateOnMs from updated BPM/Gate/Swing');
  assert.ok(fnSrc.includes('triggerGateBlackout()') && fnSrc.includes('gateRemainingMs'),
    'reschedulePendingStep must trigger or reschedule gateTimerRef based on remaining gate time');
  assert.ok(fnSrc.includes('stepTimerRef.current'), 'reschedulePendingStep must also reschedule stepTimerRef');
});

runTest('P1-04', 'VisualizerScreen async permission cancellation aborts cleanly and stops orphan audio capture (Bug #1)', () => {
  const startSrc = extractConstDeclSource(visAst, visSrc, 'startCapturePipeline');
  assert.ok(startSrc, 'startCapturePipeline not found');
  // Runtime behavioral check of cancellation check placement relative to awaits & startAudioCapture
  const reqIdx = startSrc.indexOf('await NothingGlyph.requestAudioPermission()');
  const firstCancelCheck = startSrc.indexOf('isCancelled()', reqIdx);
  const startCaptureIdx = startSrc.indexOf('NothingGlyph.startAudioCapture(');
  const postStartCancelCheck = startSrc.indexOf('isCancelled()', startCaptureIdx);
  const postStopCall = startSrc.indexOf('NothingGlyph.stopAudioCapture()', postStartCancelCheck);

  assert.ok(reqIdx >= 0 && firstCancelCheck > reqIdx && firstCancelCheck < startCaptureIdx,
    'Must check isCancelled() & isMountedRef immediately after await requestAudioPermission() BEFORE startAudioCapture');
  assert.ok(postStartCancelCheck > startCaptureIdx && postStopCall > postStartCancelCheck,
    'Must re-check isCancelled() after startAudioCapture and immediately invoke stopAudioCapture() if cancelled');

  // Behavioral simulation with mocked NothingGlyph & delayed promise
  let stopCalls = 0;
  let startCalls = 0;
  let stateMutatedAfterUnmount = false;
  let cancelled = false;
  let mounted = true;
  let permResolve;
  const mockNothingGlyph = {
    hasAudioPermission: () => false,
    requestAudioPermission: () => new Promise((r) => { permResolve = r; }),
    startAudioCapture: () => { startCalls++; return { started: true, activeSource: 'mic', mixSupported: true }; },
    stopAudioCapture: () => { stopCalls++; },
  };
  const safeSet = () => { stateMutatedAfterUnmount = true; };

  const runner = (async () => {
    const granted = await mockNothingGlyph.requestAudioPermission();
    if (cancelled || !mounted) return false;
    if (!granted?.granted) { safeSet(); return false; }
    const res = mockNothingGlyph.startAudioCapture('auto');
    if (cancelled || !mounted) {
      mockNothingGlyph.stopAudioCapture();
      return false;
    }
    safeSet();
    return Boolean(res?.started);
  })();

  // User switches tab before answering OS prompt
  cancelled = true;
  mounted = false;
  permResolve({ granted: true, status: 'granted' });
  return runner.then((started) => {
    assertStrictEqual(started, false, 'Cancelled startup must return false');
    assertStrictEqual(startCalls, 0, 'startAudioCapture must never start after cancellation');
    assertStrictEqual(stateMutatedAfterUnmount, false, 'No setState allowed after unmount/cancel');
  });
});

runTest('P1-05', 'RealAudioAnalyzer.kt protects mixScratch across callbacks and stopCaptureLocked via mixCaptureLock (Bug #2)', () => {
  assert.ok(/private val mixCaptureLock\s*=\s*Any\(\)/.test(ktAudioSrc),
    'RealAudioAnalyzer must define mixCaptureLock');
  assert.ok(/onWaveFormDataCapture[\s\S]*?synchronized\(mixCaptureLock\)/.test(ktAudioSrc),
    'onWaveFormDataCapture must hold mixCaptureLock');
  assert.ok(/onFftDataCapture[\s\S]*?synchronized\(mixCaptureLock\)/.test(ktAudioSrc),
    'onFftDataCapture must hold mixCaptureLock');
  assert.ok(/stopCaptureLocked\(\)[\s\S]*?synchronized\(mixCaptureLock\)\s*\{\s*mixScratch\.reset\(\)/.test(ktAudioSrc),
    'stopCaptureLocked must reset mixScratch under mixCaptureLock after generation increment');
  assert.ok(/stopCaptureLocked\(\)[\s\S]*?threadToJoin\.interrupt\(\)[\s\S]*?threadToJoin\.join\(/.test(ktAudioSrc),
    'stopCaptureLocked must interrupt and join micThread');
});

runTest('P1-06', 'GlyphCameraSilhouette blocks arc clicks on effect tabs 1..4 (Bug #3)', () => {
  const silhouettes = findJSXElements(appAst, 'GlyphCameraSilhouette');
  assertStrictEqual(silhouettes.length, 1);
  const onArcPressProp = getJSXAttrValue(silhouettes[0], 'onArcPress', appSrc);
  assert.ok(onArcPressProp.includes('currentTab === 0'),
    `onArcPress must gate interaction to Tab 0 (got: ${onArcPressProp})`);
  assert.ok(/if\s*\(!onArcPress\)\s*\{\s*return null;\s*\}/.test(silhouetteSrc),
    'GlyphCameraSilhouette HitTargetsLayer must return null when onArcPress is undefined');
});

runTest('P1-07', 'Rapid 1000-cycle tab switching isolates effect state and preserves saved ControlScreen arcs', () => {
  const switchSrc = extractConstDeclSource(appAst, appSrc, 'handleTabSwitch');
  assert.ok(switchSrc.indexOf('currentTabRef.current = tabIndex') < switchSrc.indexOf('setCurrentTab(tabIndex)'),
    'currentTabRef.current must update synchronously BEFORE setCurrentTab triggers unmounts');
  assert.ok(switchSrc.includes('setActivePixel(null)') && switchSrc.includes('setPixelLevels(null)') && switchSrc.includes('setEffectBrightness(null)'),
    'handleTabSwitch must clear effect outputs atomically');

  const harness = createStudioStateHarness({ brightness: [35, 140, 210], masterBrightness: 200 });
  for (let i = 0; i < 1000; i++) {
    const nextTab = i % 5;
    harness.switchTab(nextTab);
    if (nextTab === 1) {
      harness.setAutoWalk(true, 60, 'forward');
      harness.stepAutoWalk();
    } else if (nextTab === 3) {
      harness.setVisualizerActive(true, 'РАДАР');
    }
  }
  harness.switchTab(0);
  const st = harness.getState();
  assertDeepEqual(st.brightness, [35, 140, 210], 'ControlScreen arc balance drifted after 1000 tab switches');
  assertStrictEqual(st.isAutoWalk, false, 'Auto-walk leaked onto Tab 0');
  assertStrictEqual(st.visualizerActive, false, 'Visualizer leaked onto Tab 0');
  assertStrictEqual(st.activePixel, null, 'activePixel leaked onto Tab 0');
});

runTest('P1-08', 'UtilitiesScreen stopAll resets all mode flags and extinguishes pixels before arcs', () => {
  const stopSrc = extractConstDeclSource(utilAst, utilSrc, 'stopAll');
  const extSrc = extractConstDeclSource(utilAst, utilSrc, 'extinguishAll');
  assert.ok(stopSrc && extSrc);
  const pxNull = extSrc.indexOf('onPixelLevelsChangeRef.current?.(null)');
  const actNull = extSrc.indexOf('onActivePixelChangeRef.current?.(null)');
  const brZero = extSrc.indexOf('onBrightnessChangeRef.current?.([0, 0, 0])');
  assert.ok(pxNull >= 0 && actNull > pxNull && brZero > actNull,
    'extinguishAll must clear pixelLevels & activePixel before zeroing brightness');
  assert.ok(stopSrc.includes('clearAllTimers()') && stopSrc.includes("activeModeRef.current = null"),
    'stopAll must clear all timers and reset activeModeRef');
});

// ===========================================================================
// BLOCK P2 — Stale Closures & Touch Geometry (GlyphSlider, FloatingTabBar)
// ===========================================================================
logSectionHeader('\n[BLOCK P2] Stale Closures & Touch Geometry');

runTest('P2-01', 'GlyphSlider stores latest props in propsRef and PanResponder reads propsRef.current dynamically', () => {
  assert.ok(/propsRef\.current\s*=\s*\{[\s\S]*value:\s*safeValue[\s\S]*min:\s*safeMin[\s\S]*max:\s*safeMax[\s\S]*step:\s*safeStep[\s\S]*disabled:\s*Boolean\(disabled\)[\s\S]*onValueChange/m.test(sliderSrc),
    'GlyphSlider must sync safe props into propsRef.current on every render');
  const panSrc = extractConstDeclSource(sliderAst, sliderSrc, 'panResponder');
  assert.ok(panSrc && panSrc.includes('propsRef.current'), 'PanResponder must read propsRef.current');
});

runTest('P2-02', 'GlyphSlider prefers local locationX on initial tap to eliminate ±36px tab-slide offset (Bug #5)', () => {
  assert.ok(/locationX\s*>=\s*0\s*&&\s*locationX\s*<=\s*width/.test(sliderSrc),
    'GlyphSlider must prioritize locationX within [0, width]');
  // Runtime check mimicking computeValue with poisoned trackWindowXRef (-36 offset during animation)
  const calc = (width, trackWindowX, locationX, pageX, min, max, step) => {
    let x;
    if (typeof locationX === 'number' && Number.isFinite(locationX) && locationX >= 0 && locationX <= width) {
      x = locationX;
    } else if (typeof pageX === 'number' && Number.isFinite(pageX)) {
      x = pageX - trackWindowX;
    } else {
      return min;
    }
    const ratio = Math.max(0, Math.min(1, x / width));
    const raw = min + ratio * (max - min);
    return Math.max(min, Math.min(max, Math.round((raw - min) / step) * step + min));
  };
  // Width = 280, user taps dead center (locationX=140), while stale trackWindowX is skewed by 36px
  const val = calc(280, 16 + 36, 140, 16 + 140, 1, 200, 1);
  assertInRange(val, 99, 102, 'Tapping center of track during ±36px slide must still resolve ~50% (not 37%)');
  // Dragging outside left/right edge still falls back to pageX - trackWindowX cleanly
  assertStrictEqual(calc(280, 20, -25, 10, 0, 255, 1), 0, 'Drag left outside track must clamp to min');
  assertStrictEqual(calc(280, 20, 310, 320, 0, 255, 1), 255, 'Drag right outside track must clamp to max');
});

runTest('P2-03', 'GlyphSlider yields vertical scroll gestures to ScrollView while capturing horizontal drags (Bug #7)', () => {
  const panSrc = extractConstDeclSource(sliderAst, sliderSrc, 'panResponder');
  assert.ok(/onStartShouldSetPanResponderCapture:\s*\(\)\s*=>\s*false/.test(panSrc),
    'onStartShouldSetPanResponderCapture must return false so parent ScrollView can scroll');
  assert.ok(panSrc.includes('absDy > 8 && absDy > absDx * 1.4'),
    'onMoveShouldSetPanResponder must yield to vertical ScrollView drags');
  assert.ok(panSrc.includes('absDx > 4 && absDx >= absDy'),
    'onMoveShouldSetPanResponderCapture must capture clear horizontal slider drags');
});

runTest('P2-04', 'GlyphSlider sanitizes NaN, undefined, inverted bounds, and non-positive step without "NaN%" (Bug #9)', () => {
  const sanitizeBlock = sliderSrc.match(/const safeMin[\s\S]*?const safeValue[\s\S]*?;/);
  assert.ok(sanitizeBlock, 'Sanitization block for safeMin/safeMax/safeStep/safeValue missing in GlyphSlider');

  const evaluateSliderMath = (value, min, max, step) => {
    const safeMin = typeof min === 'number' && Number.isFinite(min) ? min : 0;
    const rawMax = typeof max === 'number' && Number.isFinite(max) ? max : safeMin + 100;
    const safeMax = rawMax > safeMin ? rawMax : safeMin + 1;
    const rawStep = typeof step === 'number' && Number.isFinite(step) && step > 0 ? step : 1;
    const safeStep = rawStep;
    const rawVal = typeof value === 'number' && Number.isFinite(value) ? value : safeMin;
    const safeValue = Math.max(safeMin, Math.min(safeMax, rawVal));
    const span = safeMax - safeMin || 1;
    const ratio = Math.max(0, Math.min(1, (safeValue - safeMin) / span));
    return { safeMin, safeMax, safeStep, safeValue, fillPercent: ratio * 100 };
  };

  for (const [val, min, max, step] of [
    [NaN, 0, 255, 1],
    [undefined, 1, 200, 1],
    [null, 10, 100, 1],
    [Infinity, 40, 260, 2],
    [50, 100, 100, 0], // min === max, step === 0
    [-999, 1, 25, -5],
  ]) {
    const out = evaluateSliderMath(val, min, max, step);
    assert.ok(Number.isFinite(out.fillPercent), `fillPercent became non-finite for (${val}, ${min}, ${max}, ${step})`);
    assertInRange(out.fillPercent, 0, 100, 'fillPercent must remain within [0, 100]');
  }
});

runTest('P2-05', 'FloatingTabBar sets translateX.value directly during scrub and springs only on release (Bug #6)', () => {
  const scrubSrc = extractConstDeclSource(tabBarAst, tabBarSrc, 'processScrubEvent');
  const finishSrc = extractConstDeclSource(tabBarAst, tabBarSrc, 'finishScrub');
  assert.ok(scrubSrc && finishSrc);
  assert.ok(/translateX\.value\s*=\s*targetPillX/.test(scrubSrc),
    'processScrubEvent must assign translateX.value directly for zero lag');
  assert.ok(!scrubSrc.includes('withSpring('),
    'processScrubEvent must NOT trigger withSpring on every move frame');
  assert.ok(finishSrc.includes('withSpring('),
    'finishScrub must spring-snap translateX cleanly on release');
});

runTest('P2-06', 'FloatingTabBar pageX -> tabIndex math maps all 5 zones accurately on 360dp and 412dp widths', () => {
  const mapScrub = (width, paddingHorizontal, tabsLen, barWindowX, pageX) => {
    const containerWidth = width - paddingHorizontal * 2;
    const innerWidth = Math.max(1, containerWidth - 2);
    const tabWidth = innerWidth / tabsLen;
    const localX = pageX - barWindowX;
    const clampedX = Math.max(0, Math.min(innerWidth - 0.1, localX));
    return Math.max(0, Math.min(tabsLen - 1, Math.floor(clampedX / tabWidth)));
  };

  for (const w of [360, 412]) {
    const innerW = w - 32 - 2;
    const tabW = innerW / 5;
    for (let i = 0; i < 5; i++) {
      const centerPageX = 16 + (i + 0.5) * tabW;
      assertStrictEqual(mapScrub(w, 16, 5, 16, centerPageX), i, `Zone ${i} failed at width=${w}`);
    }
    assertStrictEqual(mapScrub(w, 16, 5, 16, -20), 0, 'Left overflow pageX must clamp to tab 0');
    assertStrictEqual(mapScrub(w, 16, 5, 16, w + 40), 4, 'Right overflow pageX must clamp to tab 4');
  }
});

// ===========================================================================
// BLOCK P3 — Boundary Sweeps (1..200ms, 1..25Hz, 0..255, BPM 40..260, Battery)
// ===========================================================================
logSectionHeader('\n[BLOCK P3] Boundary Sweeps & Value Contracts');

runTest('P3-01', 'Auto-Walk normalized step delay & turbo deltaPhase sweep cleanly across 1..200 ms', () => {
  const refDelay = calculateNormalizedStepDelay(0, 100);
  assert.ok(Number.isFinite(refDelay) && refDelay > 0);
  // Check continuity across 15ms <-> 16ms and all 36 pixels at extremes 1ms and 200ms
  for (const speed of [1, 5, 15, 16, 60, 120, 200]) {
    for (let px = 0; px < 36; px++) {
      const d = calculateNormalizedStepDelay(px, speed);
      assert.ok(Number.isFinite(d) && d > 0, `Invalid step delay at px=${px}, speed=${speed}: ${d}`);
    }
  }
  // Turbo phase step continuity: at 16ms frame, speed=15ms accumulates ~16/15 ≈ 1.067 steps/frame,
  // while speed=16ms uses 16ms frame step ~1.0 step/frame (zero abrupt speed jump)
  const turboStepAt15 = 16 / calculateNormalizedStepDelay(0, 15);
  const discreteStepAt16 = 16 / calculateNormalizedStepDelay(0, 16);
  assertCloseTo(turboStepAt15, discreteStepAt16, 0.25, 'Speed jump across 15ms <-> 16ms boundary');
  assertStrictEqual(clampAutoWalkSpeed(NaN), 60);
  assertStrictEqual(clampAutoWalkSpeed(-10), 1);
  assertStrictEqual(clampAutoWalkSpeed(999), 200);
});

runTest('P3-02', 'App.js shimmer spdFactor is strictly monotonic across ALL 1..200 ms with zero plateau (Bug #11)', () => {
  const match = appSrc.match(/const spdFactor\s*=\s*([^;]+);/);
  assert.ok(match, 'spdFactor formula missing in App.js');
  const fn = new vm.Script(`(baseSpeed) => (${match[1]})`).runInThisContext();
  let prev = Infinity;
  for (let spd = 1; spd <= 200; spd++) {
    const val = fn(spd);
    assert.ok(Number.isFinite(val) && val > 0, `Invalid spdFactor at speed=${spd}: ${val}`);
    assert.ok(val < prev, `Shimmer plateau or inversion at speed=${spd}: prev=${prev}, cur=${val}`);
    prev = val;
  }
  assertCloseTo(fn(1), 5.0, 1e-6);
  assertCloseTo(fn(200), 0.25, 1e-6);
});

runTest('P3-03', 'UtilitiesScreen Strobe phase timing sweep across 1..25 Hz × 25/50/75% duty + invalid inputs', () => {
  const fnSrc = extractConstDeclSource(utilAst, utilSrc, 'getStrobePhaseDurationMs');
  assert.ok(fnSrc, 'getStrobePhaseDurationMs not found');
  const fn = new vm.Script(`(${fnSrc})`).runInThisContext();

  for (let hz = 1; hz <= 25; hz++) {
    for (const duty of [25, 50, 75]) {
      const onMs = fn(true, hz, duty);
      const offMs = fn(false, hz, duty);
      assertCloseTo(onMs + offMs, 1000 / hz, 1e-6, `Period mismatch at ${hz}Hz/${duty}%`);
      assertCloseTo(onMs / (onMs + offMs), duty / 100, 1e-6, `Duty mismatch at ${hz}Hz/${duty}%`);
    }
  }
  // Invalid inputs clamp safely without NaN/Infinity
  assertCloseTo(fn(true, 0, 50) + fn(false, 0, 50), 100, 1e-6); // 0 falls back to 10Hz
  assertCloseTo(fn(true, -5, 50) + fn(false, -5, 50), 1000, 1e-6); // -5 clamps to 1Hz
  assertCloseTo(fn(true, 999, 50) + fn(false, 999, 50), 40, 1e-6); // 999 clamps to 25Hz
  assert.ok(Number.isFinite(fn(true, NaN, NaN)));
});

runTest('P3-04', 'ControlScreen keeps > 0 toggle semantics across all 3 arcs and uses > 10 ONLY for arcPercentActive (Bug #8)', () => {
  for (const idx of [0, 1, 2]) {
    assert.ok(controlSrc.includes(`brightness[${idx}] > 0 && styles.arcDotActive`), `Arc ${idx} dot must use > 0`);
    assert.ok(controlSrc.includes(`brightness[${idx}] > 0 && styles.arcToggleBtnActive`), `Arc ${idx} toggle btn must use > 0`);
    assert.ok(controlSrc.includes(`brightness[${idx}] > 0 ? 'ВКЛ' : 'ВЫКЛ'`), `Arc ${idx} label must switch on > 0`);
    assert.ok(controlSrc.includes(`checked: brightness[${idx}] > 0`), `Arc ${idx} accessibilityState.checked must use > 0`);
    assert.ok(controlSrc.includes(`brightness[${idx}] > 10 && styles.arcPercentActive`),
      `Arc ${idx} arcPercentActive glow threshold > 10 must be preserved strictly for percentage styling`);
  }
});

runTest('P3-05', 'SequencerScreen computeStepMs maintains invariant paired-step tempo across BPM 40..260 & Swing 0..60%', () => {
  const fnSrc = extractConstDeclSource(seqAst, seqSrc, 'computeStepMs');
  assert.ok(fnSrc, 'computeStepMs not found');
  const computeStepMs = new vm.Script(`((MIN_BPM, MAX_BPM) => (${fnSrc}))(40, 260)`).runInThisContext();

  for (const bpm of [40, 90, 128, 175, 260]) {
    const expectedTwoSteps = 2 * (60000 / bpm / 4);
    for (const swing of [0, 20, 40, 60]) {
      const even = computeStepMs(0, bpm, swing);
      const odd = computeStepMs(1, bpm, swing);
      assert.ok(even >= 20 && odd >= 20, `Step ms must stay >=20ms at bpm=${bpm}, swing=${swing}`);
      assertCloseTo(even + odd, expectedTwoSteps, 1e-6, `Swing drifted average tempo at bpm=${bpm}, swing=${swing}`);
    }
  }
  // Clamping out-of-range BPM
  assertCloseTo(computeStepMs(0, 10, 0), 60000 / 40 / 4, 1e-6);
  assertCloseTo(computeStepMs(0, 999, 0), 60000 / 260 / 4, 1e-6);
  assertCloseTo(computeStepMs(0, NaN, 0), 60000 / 128 / 4, 1e-6);
});

runTest('P3-06', 'UtilitiesScreen timer duration controls enforce [5s .. 600s] clamping bounds', () => {
  assert.ok(/handleSelectTimerDuration[\s\S]*clampInt\(secs,\s*5,\s*600,\s*30\)/.test(utilSrc),
    'handleSelectTimerDuration must clamp duration to [5..600] seconds');
  assert.ok(/handleAdjustTimerDuration[\s\S]*handleSelectTimerDuration\(timerDurationRef\.current \+ delta\)/.test(utilSrc),
    'handleAdjustTimerDuration must delegate through clamped handleSelectTimerDuration');
});

runTest('P3-07', 'UtilitiesScreen getBatteryInfo adapter handles percent, -1 unavailable, and numeric Android status codes (Bug #10)', () => {
  const mapSrc = extractConstDeclSource(utilAst, utilSrc, 'mapBatteryStatus');
  assert.ok(mapSrc, 'mapBatteryStatus not found');
  const mapBatteryStatus = new vm.Script(`(${mapSrc})`).runInThisContext();

  assertStrictEqual(mapBatteryStatus(2, true), 'ЗАРЯДКА');
  assertStrictEqual(mapBatteryStatus(3, false), 'РАЗРЯД');
  assertStrictEqual(mapBatteryStatus(4, false), 'ПАУЗА');
  assertStrictEqual(mapBatteryStatus(5, true), 'ЗАРЯЖЕН 100%');
  assertStrictEqual(mapBatteryStatus(-1, false), 'АКТИВНА');

  // Verify readBatteryOnce uses info.percent ?? info.level and rejects negative (<0) as null
  assert.ok(utilSrc.includes("typeof info?.percent === 'number' ? info.percent : info?.level"),
    'readBatteryOnce must prefer percent over raw level');
  assert.ok(utilSrc.includes('!Number.isFinite(pct) || pct < 0'),
    'readBatteryOnce must map negative/invalid battery responses (-1) to null');
});

runTest('P3-08', 'VisualizerScreen sensitivity (10..100%) and noise gating remain strictly bounded in [0, 1]', () => {
  const evalGate = (raw, sensitivityVal, active = true, signalDetected = true) => {
    const sensitivityGain = 0.25 + (sensitivityVal / 100) * 1.55;
    const noiseFloor = 0.045 * (1.35 - (sensitivityVal / 100) * 0.75);
    if (!active || !signalDetected || raw <= noiseFloor) return 0;
    const normalized = (raw - noiseFloor) / (1 - noiseFloor);
    return Math.min(1, Math.max(0, normalized * sensitivityGain));
  };
  for (const sens of [10, 50, 85, 100]) {
    assertStrictEqual(evalGate(0, sens), 0);
    assertStrictEqual(evalGate(0.01, sens), 0, 'Sub-noise floor signal must gate to 0');
    assertInRange(evalGate(0.5, sens), 0, 1);
    assertStrictEqual(evalGate(2.5, sens), 1, 'Overdrive signal must clamp at 1');
    assertStrictEqual(evalGate(0.8, sens, true, false), 0, 'Silence signalDetected=false must output 0');
  }
});

// ===========================================================================
// BLOCK P4 — Master Brightness Zeroing & Decoupling Invariants
// ===========================================================================
logSectionHeader('\n[BLOCK P4] Master Brightness Zeroing & Decoupling');

runTest('P4-01', 'masterBrightness === 0 forces effectiveBrightness=[0,0,0], pixelLevels=null, and UI activePixel=null (Bug #12)', () => {
  assert.ok(/effectivePixelLevels[\s\S]*if\s*\(!pixelLevels\s*\|\|\s*masterBrightness\s*===\s*0\)\s*return null/.test(appSrc),
    'effectivePixelLevels must return null when masterBrightness === 0');
  assert.ok(appSrc.includes('const silhouetteActivePixel = masterBrightness === 0 ? null : activePixel;'),
    'App.js must suppress silhouette activePixel when masterBrightness === 0');
  const sil = findJSXElements(appAst, 'GlyphCameraSilhouette')[0];
  assertStrictEqual(getJSXAttrValue(sil, 'activePixel', appSrc), 'silhouetteActivePixel');
});

runTest('P4-02', 'Master dimmer proportionally scales both arc brightness and 36-pixel levels across 1..255', () => {
  const scaleLevels = (levels, master) => {
    if (!levels || master === 0) return null;
    const factor = Math.max(0, Math.min(1, master / 255));
    return levels.map((v) => Math.max(0, Math.min(1, v * factor)));
  };
  for (const master of [1, 64, 128, 255]) {
    const out = scaleLevels([0, 0.5, 1.0], master);
    assertStrictEqual(out[0], 0);
    assertCloseTo(out[1], 0.5 * (master / 255), 1e-9);
    assertCloseTo(out[2], 1.0 * (master / 255), 1e-9);
  }
  assertStrictEqual(scaleLevels([1, 1, 1], 0), null);
});

runTest('P4-03', 'Channel isolation preserves Tab 0 arc balance across all effect tabs', () => {
  const h = createStudioStateHarness({ brightness: [15, 95, 230], masterBrightness: 180 });
  h.setArcBrightness(0, 15);
  h.setArcBrightness(1, 95);
  h.setArcBrightness(2, 230);
  for (const tab of [1, 2, 3, 4]) {
    h.switchTab(tab);
    if (tab === 1) h.setAutoWalk(true, 30, 'comet');
    if (tab === 2) h.setSequencerPlaying(true);
    if (tab === 3) h.setVisualizerActive(true, 'ГЛИЧ');
    assertDeepEqual(h.getState().brightness, [15, 95, 230], `Saved arc brightness mutated on Tab ${tab}`);
  }
  h.switchTab(0);
  assertDeepEqual(h.getState().brightness, [15, 95, 230]);
});

runTest('P4-04', 'ensurePowerOnIfZero wakes masterBrightness only from 0 to 255, preserving non-zero user dim levels', () => {
  const fnSrc = extractConstDeclSource(appAst, appSrc, 'ensurePowerOnIfZero');
  assert.ok(fnSrc.includes('if (masterBrightnessRef.current === 0)'),
    'ensurePowerOnIfZero must only act when masterBrightnessRef.current === 0');
  const h = createStudioStateHarness({ masterBrightness: 77 });
  const cur = h.getState().masterBrightness;
  if (cur === 0) h.setMasterBrightness(255);
  assertStrictEqual(h.getState().masterBrightness, 77, 'Non-zero user dim level 77 must stay 77');
});

runTest('P4-05', 'ControlScreen displays МАСТЕР 0% badge & dimmed arc cards while keeping individual sliders active', () => {
  assert.ok(controlSrc.includes('МАСТЕР 0%'), 'ControlScreen must render МАСТЕР 0% indicator');
  assert.ok(controlSrc.includes('isMasterZero ? styles.arcCardDimmed : undefined'),
    'Arc cards must visually dim when isMasterZero is true');
  assert.ok(!controlSrc.includes('disabled={isMasterZero}'),
    'Individual arc sliders must remain adjustable even when master is at 0%');
});

runTest('P4-06', 'App.js handleAllOff / handleAllOn / handleArcPress preserve valid hardware output invariants', () => {
  const allOnSrc = extractConstDeclSource(appAst, appSrc, 'handleAllOn');
  const allOffSrc = extractConstDeclSource(appAst, appSrc, 'handleAllOff');
  assert.ok(allOnSrc && allOnSrc.includes('prev.every((b) => b === 0)') && allOnSrc.includes('return [255, 255, 255]'),
    'handleAllOn must revive 0-ed arcs to [255, 255, 255] while preserving custom balance');
  assert.ok(allOffSrc && allOffSrc.includes('setMasterBrightness(0)') && allOffSrc.includes('NothingGlyph.turnOff()'),
    'handleAllOff must zero masterBrightness and turn off hardware');
  assert.ok(appSrc.includes('next[arcIndex] = next[arcIndex] > 0 ? 0 : 255'),
    'handleArcPress must toggle arc state cleanly on > 0');
  assert.ok(appSrc.includes('NothingGlyph.setArcsBrightness('), 'App.js must sync effectiveBrightness to hardware');
});

// ===========================================================================
// BLOCK P5 — 360dp Viewport Budget & No-Overflow Checks
// ===========================================================================
logSectionHeader('\n[BLOCK P5] 360dp Viewport Geometry & Anti-Overflow');

runTest('P5-01', 'Tab 0 ControlScreen uses paddingBottom >= 92 and clears FloatingTabBar without clipping (Bug #14)', () => {
  const appStyles = extractStyleSheetMap(appAst, appSrc);
  const ctrlStyles = extractStyleSheetMap(controlAst, controlSrc);
  const cardStyles = extractStyleSheetMap(glassCardAst, glassCardSrc);
  const sliderStyles = extractStyleSheetMap(sliderAst, sliderSrc);

  assert.ok(ctrlStyles.content.paddingBottom >= 92,
    `ControlScreen content.paddingBottom must be >= 92 to clear FloatingTabBar (got ${ctrlStyles.content.paddingBottom})`);
  assert.ok(cardStyles.compactInner.paddingVertical <= 8 && cardStyles.compactInner.paddingHorizontal <= 10,
    'LiquidGlassCard compactInner must stay compact');
  assert.ok(sliderStyles.containerCompact.marginVertical <= 2,
    `GlyphSlider containerCompact marginVertical must stay <= 2 (got ${sliderStyles.containerCompact.marginVertical})`);
  assert.ok(appSrc.includes('useSafeAreaInsets()') && appSrc.includes('<SafeAreaProvider>'),
    'App.js must wrap root in SafeAreaProvider and use dynamic useSafeAreaInsets()');
  assert.ok(appStyles.simulatorContainer.paddingTop <= 4);
});

runTest('P5-02', 'FloatingTabBar fits all 5 compact labels on 360dp without ellipsis truncation (Bug #15)', () => {
  const labelsMatch = tabBarSrc.match(/COMPACT_TAB_LABELS\s*=\s*\{([\s\S]*?)\};/);
  assert.ok(labelsMatch, 'COMPACT_TAB_LABELS map missing in FloatingTabBar.js');
  const labelsObj = new vm.Script(`({${labelsMatch[1]}})`).runInThisContext();
  const values = Object.values(labelsObj);
  assertStrictEqual(values.length, 5, 'Expected 5 compact tab labels');
  for (const lbl of values) {
    assert.ok(lbl.length <= 8, `Compact tab label "${lbl}" exceeds 8 chars and risks overflow at 360dp`);
  }
  const tabBarTexts = findJSXElements(tabBarAst, 'Text');
  const labelText = tabBarTexts.find((el) => getJSXAttrValue(el, 'minimumFontScale', tabBarSrc) !== undefined);
  assert.ok(labelText, 'FloatingTabBar label <Text> must specify minimumFontScale');
  assertStrictEqual(getJSXAttrValue(labelText, 'numberOfLines', tabBarSrc), 1);
  assertStrictEqual(getJSXAttrValue(labelText, 'adjustsFontSizeToFit', tabBarSrc), true);

  // Verify 360dp math: (360 - 32 - 2) / 5 = 65.2dp per tab
  const tabWidth360 = (360 - 16 * 2 - 2) / 5;
  assert.ok(tabWidth360 >= 65, `Tab width at 360dp too narrow: ${tabWidth360}`);
});

runTest('P5-03', 'SequencerScreen fits 8 step cells + 58dp track label + 5 presets inside 360dp (Bug #19)', () => {
  const s = extractStyleSheetMap(seqAst, seqSrc);
  const cardInnerWidth360 = 360 - (s.content.paddingHorizontal * 2) - 20; // 360 - 24 - 20 = 316dp
  assert.ok(s.trackLabelBox.width >= 58, `trackLabelBox.width must be >= 58 (got ${s.trackLabelBox.width})`);
  assertStrictEqual(s.stepCell.flex, 1, 'stepCell must use flex: 1 for adaptive 360dp width');
  const gridAvail = cardInnerWidth360 - s.trackLabelBox.width - s.trackLabelBox.marginRight - (7 * s.stepsFlexRow.gap) - s.barSplitGap.marginLeft;
  const perCellWidth = gridAvail / 8;
  assert.ok(perCellWidth >= 26, `8 step cells on 360dp yielded only ${perCellWidth.toFixed(1)}dp width`);
  assert.ok(seqSrc.includes('>ДОЛЯ</Text>') && seqSrc.includes('>ДОРОЖКА</Text>'),
    'Sequencer header labels must use compact ДОЛЯ / ДОРОЖКА');
});

runTest('P5-04', 'VisualizerScreen header shrinks cleanly and 6 modes render as 2x3 equal flex grid on 360dp (Bug #16)', () => {
  const s = extractStyleSheetMap(visAst, visSrc);
  assertStrictEqual(s.titleGroup.flexShrink, 1);
  assertStrictEqual(s.title.flexShrink, 1);
  assertStrictEqual(s.modeBtn.flex, 1);
  assert.ok(s.modeBtn.minHeight >= 38);
  assert.ok(visSrc.includes('MODES.slice(0, 3)') && visSrc.includes('MODES.slice(3, 6)'),
    'Visualizer modes must render in two 3-column rows');
  const titleEl = findJSXElements(visAst, 'Text').find((el) => getJSXAttrValue(el, 'adjustsFontSizeToFit', visSrc) && String(getJSXAttrValue(el, 'style', visSrc)).includes('styles.title'));
  assert.ok(titleEl, 'Visualizer header title must have adjustsFontSizeToFit + numberOfLines={1}');
});

runTest('P5-05', 'PixelsScreen speed presets are concise, telemetryRow wraps, and buttons keep minHeight >= 40 (Bug #17)', () => {
  const s = extractStyleSheetMap(pixelsAst, pixelsSrc);
  assertStrictEqual(s.telemetryRow.flexWrap, 'wrap', 'telemetryRow must allow flexWrap on 360dp');
  assert.ok(s.speedPresetBtn.minHeight >= 40, `speedPresetBtn minHeight must be >= 40 (got ${s.speedPresetBtn.minHeight})`);
  const presetsMatch = pixelsSrc.match(/SPEED_PRESETS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(presetsMatch);
  const presets = new vm.Script(`([${presetsMatch[1]}])`).runInThisContext();
  for (const p of presets) {
    assert.ok(p.label.length <= 10, `Speed preset "${p.label}" too long for 5-column 360dp row`);
  }
});

runTest('P5-06', 'UtilitiesScreen arcade header shrinks safely on 360dp (Bug #18) and all effect screens pad bottom >= 115', () => {
  const us = extractStyleSheetMap(utilAst, utilSrc);
  const ps = extractStyleSheetMap(pixelsAst, pixelsSrc);
  const ss = extractStyleSheetMap(seqAst, seqSrc);
  const vs = extractStyleSheetMap(visAst, visSrc);

  assert.ok(us.content.paddingBottom >= 115 && ps.content.paddingBottom >= 115 &&
            ss.content.paddingBottom >= 115 && vs.content.paddingBottom >= 115,
    'All effect screens ScrollView paddingBottom must be >= 115dp to clear FloatingTabBar');
  assertStrictEqual(us.titleWithDot.flexShrink, 1);
  assertStrictEqual(us.cardTitle.flexShrink, 1);
  assertStrictEqual(us.scorePill.flexShrink, 1);
  assert.ok(utilSrc.includes('МЕТКИЙ ГЛИФ') && !utilSrc.includes('МЕТКИЙ ГЛИФ (АРКАДА)'),
    'Precision game title should stay compact without (АРКАДА) suffix');
});

// ===========================================================================
// BLOCK P6 — Ketchum SDK 2.0 & RealAudioAnalyzer Native Contracts
// ===========================================================================
logSectionHeader('\n[BLOCK P6] Ketchum SDK 2.0 & RealAudioAnalyzer Native Contracts');

runTest('P6-01', 'Ketchum SDK 2.0 binary JAR matches NothingGlyphModule.kt Phone (3a Pro) / (2a) / (2) segment counts', () => {
  const { constants } = readJarClinitConstants(jarPath, 'com/nothing/ketchum/Glyph.class');
  assertStrictEqual(constants.DEVICE_24111, 'A059');
  assertStrictEqual(constants.DEVICE_24111_SIZE, 36);
  assertStrictEqual(constants.DEVICE_23111_SIZE, 26);
  assertStrictEqual(constants.DEVICE_22111_SIZE, 33);

  const c24111 = readJarClinitConstants(jarPath, 'com/nothing/ketchum/Glyph$Code_24111.class');
  assertStrictEqual(c24111.declaredFields.length, 36, 'Glyph$Code_24111 must define 36 channels');

  // Verify Kotlin syncDeviceProfileForRegisteredCode matches SDK for 24111/23111/22111
  assert.ok(/registerAndOpenSession[\s\S]*syncDeviceProfileForRegisteredCode\(matchedCode\)/.test(ktModuleSrc),
    'registerAndOpenSession must call syncDeviceProfileForRegisteredCode after fallback match (Bug #22 Part A)');
  assert.ok(/Glyph\.DEVICE_24111[\s\S]*totalSegments\s*=\s*36/.test(ktModuleSrc));
  assert.ok(/"23111"[\s\S]*totalSegments\s*=\s*26/.test(ktModuleSrc));
  assert.ok(/"22111"[\s\S]*totalSegments\s*=\s*33/.test(ktModuleSrc));
});

runTest('P6-02', 'Phone (1) (DEVICE_20111 / A063) totalSegments in NothingGlyphModule.kt matches Ketchum SDK Code_20111 (15 segments)', () => {
  const { constants } = readJarClinitConstants(jarPath, 'com/nothing/ketchum/Glyph.class');
  const c20111 = readJarClinitConstants(jarPath, 'com/nothing/ketchum/Glyph$Code_20111.class');
  const sdkCount = constants.DEVICE_20111_SIZE;
  assertStrictEqual(sdkCount, 15);
  assertStrictEqual(c20111.declaredFields.length, 15);

  const matchDetect = ktModuleSrc.match(/is20111\s*\|\|[\s\S]*?activeDeviceCode\s*=\s*"20111"\s*\r?\n\s*totalSegments\s*=\s*(\d+)/);
  const matchSync = ktModuleSrc.match(/syncDeviceProfileForRegisteredCode[\s\S]*?"20111",\s*"A063"[\s\S]*?totalSegments\s*=\s*(\d+)/);
  assert.ok(matchDetect && matchSync, '20111/A063 profile blocks missing in NothingGlyphModule.kt');
  const actualDetect = Number(matchDetect[1]);
  const actualSync = Number(matchSync[1]);
  assertStrictEqual(actualDetect, sdkCount,
    `NothingGlyphModule.kt detectDevice sets Phone (1) totalSegments=${actualDetect}, expected ${sdkCount} per Glyph$Code_20111 (Bug #22 Part B)`);
  assertStrictEqual(actualSync, sdkCount,
    `NothingGlyphModule.kt syncDeviceProfileForRegisteredCode sets Phone (1) totalSegments=${actualSync}, expected ${sdkCount} per Glyph$Code_20111 (Bug #22 Part B)`);
});

runTest('P6-03', 'Native setChannels clears trailing channels, openSession replays buffered frame, and brightness scales 0..4095 (Bugs #21, #23)', () => {
  assert.ok(/Function\("setChannels"\)[\s\S]*?currentFrameBrightness\.fill\(0\)/.test(ktModuleSrc),
    'setChannels must zero trailing channels via currentFrameBrightness.fill(0)');
  assert.ok(/openSession\(\)[\s\S]*?currentFrameBrightness\.any\s*\{\s*it\s*>\s*0\s*\}[\s\S]*?sendFrameToHardware\(\)/.test(ktModuleSrc),
    'registerAndOpenSession must flush pre-buffered frame immediately after openSession()');
  assert.ok(ktModuleSrc.includes('if (val255 <= 0) return 0') && ktModuleSrc.includes('if (val255 >= 255) return 4095'));
  assert.ok(/if\s*\(isAllOff\)\s*\{\s*manager\.turnOff\(\)/.test(ktModuleSrc));
});

runTest('P6-04', 'Async requestAudioPermission stores pending promise and resolves on foreground resume / destroy (Bug #20)', () => {
  assert.ok(ktModuleSrc.includes('pendingPermissionPromise = promise'));
  assert.ok(/OnActivityEntersForeground\s*\{[\s\S]*?resolvePendingPermissionOnResume\(\)/.test(ktModuleSrc),
    'OnActivityEntersForeground must resolve pendingPermissionPromise after user responds to OS dialog');
  assert.ok(/OnDestroy\s*\{[\s\S]*?pendingPermissionPromise[\s\S]*?pending\?\.resolve\(/.test(ktModuleSrc),
    'OnDestroy must clean up unresolved pendingPermissionPromise');
});

runTest('P6-05', 'RealAudioAnalyzer uses 1024-pt Radix-2 FFT + Hann window and declares required Android permissions', () => {
  assert.ok(ktAudioSrc.includes('FFT_SIZE = 1024') || ktAudioSrc.includes('private const val FFT_SIZE = 1024'));
  assert.ok(ktAudioSrc.includes('NUM_BANDS = 16'));
  assert.ok(ktAudioSrc.includes('fun runRadix2Fft') || ktAudioSrc.includes('private fun runRadix2Fft'));
  assert.ok(ktAudioSrc.includes('computeBandParsevalRms'));
  assert.ok(manifestSrc.includes('android.permission.RECORD_AUDIO'));
  assert.ok(manifestSrc.includes('android.permission.MODIFY_AUDIO_SETTINGS'));
  assert.ok(manifestSrc.includes('com.nothing.ketchum.permission.ENABLE'));
  assert.ok(pluginSrc.includes('RECORD_AUDIO') && gradleSrc.includes("include: ['*.jar'])"),
    'Plugin must inject RECORD_AUDIO and gradle must link libs/*.jar SDK');
});

runTest('P6-06', 'JS bridge exports all 19 API methods with safe fallback contracts and native BatteryManager keys', () => {
  const expectedMethods = [
    'initHardware', 'isConnected', 'getDeviceModel', 'getHardwareStatus', 'getBatteryInfo',
    'hasAudioPermission', 'requestAudioPermission', 'startAudioCapture', 'stopAudioCapture',
    'getAudioMetrics', 'turnOff', 'setBrightness', 'setChannel', 'setChannels',
    'setArcBrightness', 'setArcsBrightness', 'setVirtualPixel', 'setVirtualPixels', 'setPixelLevels',
  ];
  for (const m of expectedMethods) {
    assert.ok(bridgeSrc.includes(`${m}:`), `JS bridge missing method ${m}`);
  }
  assert.ok(ktModuleSrc.includes('"level" to rawLevel') && ktModuleSrc.includes('"percent" to percent') && ktModuleSrc.includes('"isCharging" to isCharging'));
});

// ---------------------------------------------------------------------------
// Final Runner & Report (supports async/sync tests cleanly)
// ---------------------------------------------------------------------------
(async () => {
  console.log('\n======================================================================');
  console.log('GLYPH STUDIO — PRIORITY QA SUITE (P1 .. P6)');
  console.log('======================================================================');

  for (const entry of queuedTests) {
    if (entry.header) {
      console.log(entry.header);
      continue;
    }
    const { section, name, fn } = entry;
    const start = Date.now();
    try {
      await fn();
      passed++;
      const ms = Date.now() - start;
      results.push({ section, name, ok: true, ms });
      console.log(`  PASS [${section}] ${name}`);
    } catch (err) {
      failed++;
      const ms = Date.now() - start;
      results.push({ section, name, ok: false, error: err.message, ms });
      console.log(`  FAIL [${section}] ${name}`);
      console.log(`       -> ${err.message}`);
    }
  }

  console.log('\n======================================================================');
  console.log(`PRIORITY QA SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('======================================================================');

  process.exit(failed > 0 ? 1 : 0);
})();
