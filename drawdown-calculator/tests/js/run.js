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
  'deriveMilestones',     // used by fingerprintFromProjection
  'fingerprint6',         // snapshot fingerprint (Component 3)
  'fingerprintFromProjection',
  'validateSnapshot',     // snapshot invariants (Component 2)
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
  return {
    solveTopUp, stepPerson, incomeTaxYear, rebateYear, cgtExclusionYear, incomeTaxPreRebateYear,
    deriveMilestones, fingerprint6, fingerprintFromProjection, validateSnapshot
  };
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
// fingerprint6 — pure synchronous djb2 hash of N anchor numbers
// ============================================================

console.log('\n== fingerprint6 ==');

test('fingerprint6: deterministic — same inputs → same output', () => {
  const a = testAPI.fingerprint6([100, 200, 300, 400, 500, 600]);
  const b = testAPI.fingerprint6([100, 200, 300, 400, 500, 600]);
  assert.strictEqual(a, b);
});

test('fingerprint6: format — 6 lowercase alphanumeric chars', () => {
  const fp = testAPI.fingerprint6([1, 2, 3, 4, 5, 6]);
  assert.strictEqual(fp.length, 6);
  assert.ok(/^[0-9a-z]{6}$/.test(fp), 'fp=' + fp + ' fails format');
});

test('fingerprint6: sensitivity — changing any anchor changes the hash', () => {
  const base = testAPI.fingerprint6([100, 200, 300, 400, 500, 600]);
  for (let i = 0; i < 6; i++) {
    const mutated = [100, 200, 300, 400, 500, 600];
    mutated[i] += 1;
    const fp = testAPI.fingerprint6(mutated);
    assert.notStrictEqual(fp, base, `anchor ${i} change did not alter fingerprint`);
  }
});

test('fingerprint6: rounds to rand precision (cents do not affect)', () => {
  // The Math.round in fingerprint6 means 100.4 and 100.0 both hash to 100.
  const a = testAPI.fingerprint6([100.4, 200, 300, 400, 500, 600]);
  const b = testAPI.fingerprint6([100, 200, 300, 400, 500, 600]);
  assert.strictEqual(a, b);
});

test('fingerprint6: handles zero and negative numbers', () => {
  const fp1 = testAPI.fingerprint6([0, 0, 0, 0, 0, 0]);
  const fp2 = testAPI.fingerprint6([-100, 50, 0, 999, -5, 1]);
  assert.strictEqual(fp1.length, 6);
  assert.strictEqual(fp2.length, 6);
  assert.notStrictEqual(fp1, fp2);
});


// ============================================================
// validateSnapshot — invariant assertions (Component 2)
// ============================================================

console.log('\n== validateSnapshot ==');

// Build a minimal valid snapshot for the happy-path baseline. Real fields
// only — anything left undefined would cause defensive `|| 0` reads to no-op
// the assertion (we want to test the assertions, not the falsy fallbacks).
function makeValidSnapshot() {
  const rows = [];
  for (let i = 0; i < 35; i++) {
    const laDraw = 200_000;
    const discDraw = 50_000;
    const otherIncome = 30_000;
    const totalIncome = laDraw + discDraw + otherIncome;  // 280_000
    const tax = 40_000;
    const requiredNom = 200_000 * Math.pow(1.03, i);
    const net = totalIncome - tax;
    rows.push({
      year: 2026 + i,
      age: 65 + i,
      laDraw, discDraw, otherIncome, totalIncome, tax,
      netLA: laDraw - tax * (laDraw / totalIncome),
      netDisc: discDraw - tax * (discDraw / totalIncome),
      netOther: otherIncome - tax * (otherIncome / totalIncome),
      netTotal: net,
      requiredReal: 200_000,
      requiredNom: requiredNom,
      laBalance: 4_000_000,
      discBalance: 1_000_000,
      totalCapital: 5_000_000,
      shortfall: net < requiredNom - 1,
      events: []
    });
  }
  return {
    proj: {
      startAge: 65,
      horizonAge: 99,
      years: 35,
      rNom: 0.065, cpi: 0.03,
      rows: rows,
      sustainableTo: 95,
      depletesAt: null, laCapHitAt: null, discExhaustsAt: null,
      year1: rows[0],
      taxA: { tax: 25_000, grossIncome: 150_000 },
      taxB: { tax: 15_000, grossIncome: 100_000 },
      taxByPerson: [
        { name: 'A', tax: 25_000, grossIncome: 150_000 },
        { name: 'B', tax: 15_000, grossIncome: 100_000 }
      ],
      hhGross: 250_000,
      hhTax: 40_000,
      hhNet: 210_000,
      hhEff: 0.16
    },
    plan: { single: false }
  };
}

test('validateSnapshot: happy path does not throw', () => {
  const s = makeValidSnapshot();
  testAPI.validateSnapshot(s.proj, s.plan, 'scenario');
});

test('validateSnapshot: I1 fires when totalIncome != sum of components', () => {
  const s = makeValidSnapshot();
  s.proj.rows[0].totalIncome = 999_999;
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I1/
  );
});

test('validateSnapshot: I2 fires when net is meaningfully negative', () => {
  const s = makeValidSnapshot();
  s.proj.rows[0].tax = s.proj.rows[0].totalIncome + 1000;  // tax > gross
  // I1 will also fire if we change tax without rebalancing — but here we're
  // only changing tax, so totalIncome still matches sum. I2 should fire.
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I2/
  );
});

test('validateSnapshot: I3 fires when shortfall flag mismatches net-vs-net', () => {
  const s = makeValidSnapshot();
  // Force shortfall=true on a row where (totalIncome-tax) clearly >= requiredNom.
  s.proj.rows[0].shortfall = true;
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I3/
  );
});

test('validateSnapshot: I4 fires on negative balances', () => {
  const s = makeValidSnapshot();
  s.proj.rows[0].laBalance = -1000;
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I4/
  );
});

test('validateSnapshot: I5 fires when sustainableTo is outside horizon', () => {
  const s = makeValidSnapshot();
  s.proj.sustainableTo = 200;  // way past horizon
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I5/
  );
});

test('validateSnapshot: I6 fires when taxByPerson length mismatches single', () => {
  const s = makeValidSnapshot();
  s.plan.single = true;  // expect 1 spouse but taxByPerson has 2
  // I7 may also fire (hhTax sums both); test specifically for I6 by
  // also restoring hhTax to match single mode.
  s.proj.hhTax = s.proj.taxA.tax;
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I6/
  );
});

test('validateSnapshot: I7 fires when hhTax mismatches sum of spouse tax', () => {
  const s = makeValidSnapshot();
  s.proj.hhTax = 999_999;
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I7/
  );
});

test('validateSnapshot: I8 fires when year1.age != startAge', () => {
  const s = makeValidSnapshot();
  s.proj.year1 = { age: 99 };  // mismatched
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I8/
  );
});

test('validateSnapshot: I9 fires on zero requiredNom in early years', () => {
  const s = makeValidSnapshot();
  s.proj.rows[2].requiredNom = 0;
  // I3 will also fire because shortfall flag is now wrong; I9 fires first
  // by row order so we check that the error mentions I9 OR I3 — both are
  // legitimate signals.
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I9|I3/
  );
});

test('validateSnapshot: I10 fires when event.year != row.year', () => {
  const s = makeValidSnapshot();
  s.proj.rows[5].events = [{ year: 9999, label: 'Bad event', amount: 100_000 }];
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I10/
  );
});

test('validateSnapshot: I11 fires when netTotal != totalIncome - tax', () => {
  const s = makeValidSnapshot();
  s.proj.rows[0].netTotal = 999_999;
  assert.throws(
    () => testAPI.validateSnapshot(s.proj, s.plan, 'scenario'),
    /I11/
  );
});

test('validateSnapshot: single-client mode happy path', () => {
  const s = makeValidSnapshot();
  s.plan.single = true;
  s.proj.taxByPerson = [{ name: 'Client', tax: 25_000, grossIncome: 150_000 }];
  s.proj.taxA = { tax: 25_000, grossIncome: 150_000 };
  s.proj.taxB = null;
  s.proj.hhTax = 25_000;
  s.proj.hhGross = 150_000;
  s.proj.hhNet = 125_000;
  testAPI.validateSnapshot(s.proj, s.plan, 'scenario');
});


// ============================================================
// fingerprintFromProjection — composite hash from engine result
// ============================================================

console.log('\n== fingerprintFromProjection ==');

// Build a minimal project()-shaped object (only the fields fingerprint
// actually reads).
function makeFakeProjection(overrides) {
  const n = 35;
  const draw = (v) => Array(n).fill(v);
  const bal = (v) => Array(n).fill(v);
  const tax = Array(n).fill(50_000);
  const target = Array(n).fill(200_000);
  const proj = {
    years: n,
    startAge: 65,
    table: {
      laA_draw: draw(150_000), laB_draw: draw(100_000),
      discA_draw: draw(30_000), discB_draw: draw(20_000),
      otherA: draw(20_000), otherB: draw(10_000),
      laA_bal: bal(2_000_000), laB_bal: bal(1_500_000),
      discA_bal: bal(500_000), discB_bal: bal(400_000),
      clampA: Array(n).fill('ok'), clampB: Array(n).fill('ok')
    },
    nominal: { draw: draw(330_000), target: target, tax: tax },
    taxA: { grossIncome: 200_000 }, taxB: { grossIncome: 130_000 }
  };
  if (overrides) Object.assign(proj, overrides);
  return proj;
}

test('fingerprintFromProjection: deterministic for identical projections', () => {
  const a = testAPI.fingerprintFromProjection(makeFakeProjection());
  const b = testAPI.fingerprintFromProjection(makeFakeProjection());
  assert.strictEqual(a, b);
  assert.strictEqual(a.length, 6);
});

test('fingerprintFromProjection: changes when Y1 income changes', () => {
  const base = testAPI.fingerprintFromProjection(makeFakeProjection());
  const mutated = makeFakeProjection();
  mutated.table.laA_draw[0] = 999_999;  // change Y1 LA-A draw
  const fp = testAPI.fingerprintFromProjection(mutated);
  assert.notStrictEqual(fp, base);
});

test('fingerprintFromProjection: changes when end-capital changes', () => {
  const base = testAPI.fingerprintFromProjection(makeFakeProjection());
  const mutated = makeFakeProjection();
  mutated.table.laA_bal[34] = 9_999_999;  // change last-year LA balance
  const fp = testAPI.fingerprintFromProjection(mutated);
  assert.notStrictEqual(fp, base);
});

test('fingerprintFromProjection: handles empty projection gracefully', () => {
  const fp = testAPI.fingerprintFromProjection(null);
  assert.strictEqual(fp.length, 6);  // still a 6-char string, not a throw
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
