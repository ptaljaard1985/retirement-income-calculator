/**
 * JS solver tests.
 *
 * Extracts the <script> block from retirement_drawdown.html and exercises
 * solveTopUp directly under Node. No Jest, no dependencies — just Node's
 * built-in assert.
 *
 * Why this exists: the Python tests catch spec bugs (where the code matches
 * intent but the intent is wrong). These tests catch implementation bugs
 * in the actual JS (scope issues, closures, iteration count regressions).
 *
 * Run: node run.js
 * Exit: 0 = all pass, non-zero = any failure
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// -------- Extract the inline script from the HTML --------
const htmlPath = path.join(__dirname, '..', '..', 'retirement_drawdown.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Concatenate all inline <script> blocks (ignores external script src tags)
const scriptMatches = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g) || [];
const inlineScripts = scriptMatches
  .filter(s => !/<script[^>]*\ssrc=/.test(s))
  .map(s => s.replace(/<\/?script[^>]*>/g, ''))
  .join('\n');

if (!inlineScripts.trim()) {
  console.error('ERROR: no inline script found in HTML');
  process.exit(1);
}

// -------- Minimal DOM shim so the script runs without a browser --------
// We don't need a real DOM. We intercept the IIFE's DOM-reading functions
// by stubbing document and window before eval.

const DOM_VALUES = {};  // id -> value (populated per-test)

const documentShim = {
  getElementById(id) {
    return {
      get value() { return DOM_VALUES[id] !== undefined ? String(DOM_VALUES[id]) : ''; },
      set value(v) { DOM_VALUES[id] = v; },
      get checked() { return !!DOM_VALUES['__checked_' + id]; },
      set checked(v) { DOM_VALUES['__checked_' + id] = !!v; },
      addEventListener() {},
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
      style: {},
      innerHTML: '',
      textContent: '',
      setAttribute() {},
      getAttribute() { return null; },
      appendChild() {},
      querySelector() { return documentShim.getElementById('dummy'); },
      querySelectorAll() { return []; },
      dispatchEvent() {},
    };
  },
  querySelector() { return documentShim.getElementById('dummy'); },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement() { return documentShim.getElementById('dummy'); },
};

const windowShim = { print() {} };

// Stub Chart.js — we never actually render
global.Chart = function () { return { update() {}, destroy() {}, data: {}, options: {} }; };
global.Chart.defaults = { responsive: {}, font: {}, plugins: {}, scales: {} };

// -------- Expose the solver and helpers for testing --------
//
// The script wraps everything in an IIFE, so solveTopUp isn't accessible
// from outside. We need to extract the relevant functions OR patch the
// script to expose them.
//
// Strategy: grab the source of solveTopUp + its dependencies as text, eval
// them at the top level of a module-scope closure, and expose them on a
// `testAPI` object.

function extractFn(src, name) {
  // Find the `function NAME(...)` declaration and grab it through its matching
  // closing brace. Not bulletproof but works for these hand-written functions.
  const pattern = new RegExp(
    'function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{',
    'g'
  );
  const match = pattern.exec(src);
  if (!match) throw new Error('Could not find function: ' + name);
  let depth = 1;
  let i = pattern.lastIndex;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '"' || c === "'" || c === '`') {
      // skip string literal
      const q = c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) break;
        i++;
      }
    } else if (c === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i+1] === '/')) i++;
      i++;
    }
    i++;
  }
  return src.substring(match.index, i);
}

// We need these helpers from the script:
const BRACKETS_SRC = /var BRACKETS\s*=\s*\[[\s\S]*?\];/.exec(inlineScripts)[0];
const REBATE_SRC = /var REBATE\s*=\s*\{[\s\S]*?\};/.exec(inlineScripts)[0];
const CGT_SRC = /var CGT\s*=\s*\{[\s\S]*?\};/.exec(inlineScripts)[0];
const CREEP_SRC = /var BRACKET_CREEP\s*=\s*[\d.]+;/.exec(inlineScripts)[0];

const helpers = [
  'incomeTaxPreRebateYear',
  'rebateYear',
  'incomeTaxYear',
  'cgtExclusionYear',
  'incomeTaxPreRebate',  // legacy non-year version
  'rebate',              // legacy non-year version
  'stepPerson',
];

let helpersSrc = '';
for (const name of helpers) {
  try {
    helpersSrc += extractFn(inlineScripts, name) + '\n\n';
  } catch (e) {
    // Some helpers might not exist — that's fine
    console.warn('Warning: helper not found:', name);
  }
}

// solveTopUp is defined inside project(). We extract it by finding its signature
// and reading through to its closing brace. It references cgtExclusionYear and
// incomeTaxYear which we've already grabbed.
const solveTopUpSrc = extractFn(inlineScripts, 'solveTopUp');

// Build the testable module
const testModuleSrc = `
  ${BRACKETS_SRC}
  ${REBATE_SRC}
  ${CGT_SRC}
  ${CREEP_SRC}
  ${helpersSrc}
  ${solveTopUpSrc}
  return { solveTopUp, stepPerson, incomeTaxYear, rebateYear, cgtExclusionYear, incomeTaxPreRebateYear };
`;

const testAPI = new Function(testModuleSrc)();


// ============================================================
// TESTS
// ============================================================

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    console.log('  FAIL ' + name);
    console.log('       ' + err.message);
  }
}

function approx(a, b, tol = 1.0) {
  return Math.abs(a - b) <= tol;
}

function person(opts = {}) {
  return {
    laBalance:    opts.la    !== undefined ? opts.la    : 4_000_000,
    laRate:       opts.laRate !== undefined ? opts.laRate : 0.05,
    discBalance:  opts.disc  !== undefined ? opts.disc  : 1_000_000,
    discBaseCost: opts.base  !== undefined ? opts.base  : 500_000,
    otherIncome:  opts.other !== undefined ? opts.other : 0,
    discDraw:     opts.discDraw !== undefined ? opts.discDraw : 0,
  };
}


console.log('\n== stepPerson ==');

test('stepPerson: clamp to floor when rand target below 2.5%', () => {
  const r = testAPI.stepPerson(person({ la: 1_000_000 }), 0.09, 0);
  assert.ok(approx(r.laDraw, 25_000), `laDraw=${r.laDraw}`);
  assert.strictEqual(r.laClamp, 'floor');
});

test('stepPerson: clamp to cap when rand target above 17.5%', () => {
  const r = testAPI.stepPerson(person({ la: 1_000_000 }), 0.09, 500_000);
  assert.ok(approx(r.laDraw, 175_000), `laDraw=${r.laDraw}`);
  assert.strictEqual(r.laClamp, 'cap');
});

test('stepPerson: empty LA balance', () => {
  const r = testAPI.stepPerson(person({ la: 0, disc: 0, base: 0 }), 0.09, 50_000);
  assert.strictEqual(r.laDraw, 0);
  assert.strictEqual(r.laClamp, 'empty');
});

test('stepPerson: disc gain proportional to base cost ratio', () => {
  const p = person({ la: 4_000_000, disc: 1_000_000, base: 500_000, discDraw: 100_000 });
  const r = testAPI.stepPerson(p, 0.09, 200_000);
  // proportion = 100k/1m = 0.1, cost_used = 500k × 0.1 = 50k, gain = 50k
  assert.ok(approx(r.gainRealised, 50_000), `gain=${r.gainRealised}`);
  assert.ok(approx(r.newBase, 450_000), `newBase=${r.newBase}`);
});


console.log('\n== incomeTaxYear ==');

test('tax: zero income = zero tax', () => {
  assert.strictEqual(testAPI.incomeTaxYear(0, 65, 0), 0);
});

test('tax: R200k age 65 year 0 = R8415', () => {
  assert.ok(approx(testAPI.incomeTaxYear(200_000, 65, 0), 8_415));
});

test('tax: R500k age 68 year 0 = R88,652', () => {
  assert.ok(approx(testAPI.incomeTaxYear(500_000, 68, 0), 88_652));
});

test('tax: bracket creep scales brackets and rebates', () => {
  // R250k × 1.03 at year 1 should produce ~1.03 × tax on R250k at year 0
  const y0 = testAPI.incomeTaxYear(250_000, 65, 0);
  const y1 = testAPI.incomeTaxYear(250_000 * 1.03, 65, 1);
  assert.ok(approx(y1, y0 * 1.03, 0.5), `y0=${y0} y1=${y1}`);
});


console.log('\n== solveTopUp: no shortfall ==');

test('no shortfall: LA covers target, no disc drawn', () => {
  const sA = person({ la: 8_000_000, disc: 0, base: 0 });
  const sB = person({ la: 8_000_000, disc: 0, base: 0 });
  const r = testAPI.solveTopUp(sA, sB, 500_000, 500_000, 65, 65, 0, 700_000);
  assert.strictEqual(r.discA, 0);
  assert.strictEqual(r.discB, 0);
  assert.ok(r.net > 700_000);
  assert.strictEqual(r.clampA, 'ok');
});


console.log('\n== solveTopUp: disc top-up (Phase 2) ==');

test('equal disc pots produce equal disc draws', () => {
  const sA = person({ la: 4_000_000, disc: 1_000_000, base: 500_000 });
  const sB = person({ la: 4_000_000, disc: 1_000_000, base: 500_000 });
  const r = testAPI.solveTopUp(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000);
  assert.ok(approx(r.discA, r.discB, 2));
  assert.ok(approx(r.net, 700_000, 200));
});

test('unequal disc pots split 80/20', () => {
  const sA = person({ la: 4_000_000, disc: 800_000, base: 400_000 });
  const sB = person({ la: 4_000_000, disc: 200_000, base: 100_000 });
  const r = testAPI.solveTopUp(sA, sB, 200_000, 200_000, 65, 65, 0, 550_000);
  const total = r.discA + r.discB;
  const shareA = r.discA / total;
  assert.ok(shareA > 0.75 && shareA < 0.85, `shareA=${shareA}`);
});

test('tiny disc caps; partner absorbs remainder', () => {
  const sA = person({ la: 4_000_000, disc: 5_000, base: 2_500 });
  const sB = person({ la: 4_000_000, disc: 2_000_000, base: 1_000_000 });
  const r = testAPI.solveTopUp(sA, sB, 150_000, 150_000, 65, 65, 0, 600_000);
  assert.ok(r.discA <= 5_001, `A disc=${r.discA}`);
  assert.ok(approx(r.net, 600_000, 500));
});


console.log('\n== solveTopUp: LA boost (Phase 3) ==');

test('no disc → boost LA above CPI target', () => {
  const sA = person({ la: 4_000_000, disc: 0, base: 0 });
  const sB = person({ la: 4_000_000, disc: 0, base: 0 });
  const r = testAPI.solveTopUp(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000);
  assert.ok(r.laDrawA > 200_000, 'A not boosted');
  assert.ok(r.laDrawB > 200_000, 'B not boosted');
  assert.ok(r.laDrawA <= 700_001);  // 17.5% ceiling on R4m
  assert.ok(approx(r.net, 700_000, 200));
});

test('boost is proportional to LA balance (75/25)', () => {
  const sA = person({ la: 6_000_000, disc: 0, base: 0 });
  const sB = person({ la: 2_000_000, disc: 0, base: 0 });
  const r = testAPI.solveTopUp(sA, sB, 300_000, 100_000, 65, 65, 0, 700_000);
  const boostA = r.laDrawA - 300_000;
  const boostB = r.laDrawB - 100_000;
  const total = boostA + boostB;
  if (total > 1) {
    const shareA = boostA / total;
    assert.ok(shareA > 0.70 && shareA < 0.80, `shareA=${shareA}`);
  }
});

test('both LAs hit 17.5% ceiling -> real shortfall preserved', () => {
  const sA = person({ la: 1_000_000, disc: 0, base: 0 });
  const sB = person({ la: 1_000_000, disc: 0, base: 0 });
  const r = testAPI.solveTopUp(sA, sB, 50_000, 50_000, 65, 65, 0, 700_000);
  assert.ok(approx(r.laDrawA, 175_000));
  assert.ok(approx(r.laDrawB, 175_000));
  assert.strictEqual(r.clampA, 'cap');
  assert.strictEqual(r.clampB, 'cap');
  assert.ok(r.net < 700_000);
});

test('REGRESSION: boost does NOT compound across iterations', () => {
  // The bug: earlier version mutated laDrawA mid-loop and computed next
  // boost against the already-boosted value. Net overshot target by R320k.
  const sA = person({ la: 4_000_000, disc: 0, base: 0 });
  const sB = person({ la: 4_000_000, disc: 0, base: 0 });
  const r = testAPI.solveTopUp(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000);
  assert.ok(r.net <= 700_000 + 1000,
    `Overshot! net=${r.net} (expected near 700,000). Boost is compounding.`);
  assert.ok(r.net > 699_000);
});


console.log('\n== solveTopUp: single-client (Spouse B all zero) ==');

test('single: B zero - Phase 1 only, no NaN, draw matches target', () => {
  // Spouse B is a synthetic zero person (what project() produces in single mode).
  // With a modest target that LA alone covers, expect Phase 1 to return cleanly.
  const sA = person({ la: 6_000_000, disc: 2_000_000, base: 1_000_000 });
  const sB = person({ la: 0, disc: 0, base: 0 });
  const r = testAPI.solveTopUp(sA, sB, 300_000, 0, 68, 68, 0, 500_000);
  assert.ok(!Number.isNaN(r.net), 'net is NaN');
  assert.ok(!Number.isNaN(r.laDrawA), 'laDrawA is NaN');
  assert.ok(!Number.isNaN(r.laDrawB), 'laDrawB is NaN');
  assert.strictEqual(r.laDrawB, 0);
  assert.strictEqual(r.discB, 0);
  assert.strictEqual(r.clampB, 'empty');
});

test('single: B zero - Phase 3 LA boost stays finite (NaN guard)', () => {
  // Force Phase 3 by giving A a tiny LA with no disc so boost must fire.
  // Pre-fix, wA2/wB2 were 0/0 because sB.laBalance was 0 — this asserts the
  // defensive guard now yields 0 instead of NaN.
  const sA = person({ la: 1_500_000, disc: 0, base: 0 });
  const sB = person({ la: 0, disc: 0, base: 0 });
  const r = testAPI.solveTopUp(sA, sB, 50_000, 0, 68, 68, 0, 350_000);
  assert.ok(!Number.isNaN(r.net), 'net is NaN');
  assert.ok(!Number.isNaN(r.laDrawA), 'laDrawA is NaN');
  // A's LA at 1.5m × 17.5% ceiling = 262,500 — solver should push there.
  assert.ok(r.laDrawA > 50_000, `not boosted: ${r.laDrawA}`);
  assert.ok(r.laDrawA <= 262_501, `above ceiling: ${r.laDrawA}`);
  assert.strictEqual(r.clampA, 'cap');
});

test('single: both spouses fully depleted mid-year stays finite', () => {
  // Pathological: both LA and disc zero for both. Solver should return all
  // zeros and net = 0 without any NaN.
  const sA = person({ la: 0, disc: 0, base: 0 });
  const sB = person({ la: 0, disc: 0, base: 0 });
  const r = testAPI.solveTopUp(sA, sB, 0, 0, 80, 80, 15, 500_000);
  assert.ok(!Number.isNaN(r.net), 'net is NaN');
  assert.strictEqual(r.laDrawA, 0);
  assert.strictEqual(r.laDrawB, 0);
  assert.strictEqual(r.discA, 0);
  assert.strictEqual(r.discB, 0);
});


// ============================================================
// Summary
// ============================================================

console.log('\n' + '='.repeat(50));
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log('  ' + f.name);
    console.log('    ' + f.err.stack.split('\n').slice(0, 3).join('\n    '));
  }
  process.exit(1);
}
process.exit(0);
