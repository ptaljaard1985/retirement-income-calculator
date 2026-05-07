/**
 * Tier-2 parity harness: run the actual JS project() against a list of
 * scenarios and emit results as JSON, so the Python parity tests can
 * compare row-by-row against the Python port.
 *
 * Usage:
 *   node parity_runner.js <scenarios.json> <results.json>
 *
 * scenarios.json shape:
 *   [
 *     {
 *       "name": "hayes_baseline",
 *       "pA": { "laBalance": 4000000, "laRate": 0.05, "discBalance": 1000000,
 *               "discBaseCost": 500000, "discDraw": 0 },
 *       "pB": { ... same shape ... },
 *       "ageA": 65, "ageB": 65,
 *       "rNom": 0.07, "cpi": 0.05,
 *       "targetPVAnnual": 600000,
 *       "autoTopup": false,
 *       "single": false,
 *       "events": [ {"year": 5, "amountPV": 2000000, "spouse": "A"}, ... ],
 *       "incomes": [ ... ],
 *       "goals": [ ... ]
 *     },
 *     ...
 *   ]
 *
 * results.json shape:
 *   {
 *     "<scenario name>": {
 *       "labels": [...], "la": [...], ..., "tax_A": [...], "clamp_A": [...]
 *     },
 *     ...
 *   }
 *
 * The result keys mirror the Python conftest.project()'s `series` dict so
 * the parity test can compare verbatim.
 */
const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
  console.error('usage: node parity_runner.js <scenarios.json> <results.json>');
  process.exit(2);
}
const SCENARIOS_PATH = process.argv[2];
const RESULTS_PATH = process.argv[3];

// -------- Load HTML and extract inline scripts ----------
const htmlPath = path.join(__dirname, '..', '..', 'retirement_drawdown.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scriptMatches = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g) || [];
const inlineScripts = scriptMatches
  .filter(s => !/<script[^>]*\ssrc=/.test(s))
  .map(s => s.replace(/<\/?script[^>]*>/g, ''))
  .join('\n');

if (!inlineScripts.trim()) {
  throw new Error('no inline script found in HTML');
}

// -------- Strip the trailing `})();` and inject state-exposure ----------
// The IIFE wraps everything; closure vars (project, stores, helpers) aren't
// reachable from outside without injection. We inject a globalThis assignment
// just before the IIFE close so we can call project() with controlled state.
const trimmedSrc = inlineScripts.trimEnd();
const closeIdx = trimmedSrc.lastIndexOf('})();');
if (closeIdx === -1) throw new Error('IIFE close `})();` not found');
const injected = trimmedSrc.substring(0, closeIdx) +
  '\n  globalThis.__pari = {\n' +
  '    project: project,\n' +
  '    eventsStore: eventsStore,\n' +
  '    incomeStore: incomeStore,\n' +
  '    goalsStore: goalsStore\n' +
  '  };\n' +
  '})();' +
  trimmedSrc.substring(closeIdx + 5);

// -------- DOM stub ----------
// Backed by DOM_VALUES so we can set per-scenario inputs before each
// project() call. Returns a single shared element-like object per id, lazily
// created — this matches how the calculator's getElementById is used.
const DOM_VALUES = {};
const DOM_CHECKED = {};
const ELEMENTS = {};

function makeElement(id) {
  const styleStore = {};
  const attrStore = {};
  const datasetStore = {};
  const el = {
    id,
    get value() { return DOM_VALUES[id] !== undefined ? String(DOM_VALUES[id]) : ''; },
    set value(v) { DOM_VALUES[id] = v; },
    get checked() { return !!DOM_CHECKED[id]; },
    set checked(v) { DOM_CHECKED[id] = !!v; },
    // CSS getters/setters used widely by the calculator's slider-fill helper
    // and the rail/chart toggles.
    addEventListener() {},
    removeEventListener() {},
    classList: {
      toggle() {}, add() {}, remove() {}, contains() { return false; },
    },
    style: {
      setProperty(name, value) { styleStore[name] = value; },
      removeProperty(name) { delete styleStore[name]; },
      getPropertyValue(name) { return styleStore[name] || ''; },
    },
    dataset: datasetStore,
    innerHTML: '',
    textContent: '',
    // Attribute methods. The calculator reads role / aria attrs and toggles
    // `hidden` etc.; back them with attrStore so reads round-trip.
    setAttribute(name, value) { attrStore[name] = value; },
    getAttribute(name) { return attrStore[name] !== undefined ? attrStore[name] : null; },
    removeAttribute(name) { delete attrStore[name]; },
    hasAttribute(name) { return name in attrStore; },
    appendChild() {},
    removeChild() {},
    insertBefore() {},
    cloneNode() { return makeElement(id + '-clone'); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    dispatchEvent() {},
    focus() {},
    blur() {},
    click() {},
    parentNode: null,
    children: [],
    childNodes: [],
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
    offsetWidth: 0,
    offsetHeight: 0,
    clientWidth: 0,
    clientHeight: 0,
    scrollWidth: 0,
    scrollHeight: 0,
    getBoundingClientRect() {
      return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
    },
  };
  return el;
}

function getElementById(id) {
  if (!ELEMENTS[id]) ELEMENTS[id] = makeElement(id);
  return ELEMENTS[id];
}

// document.body needs special handling: project() reads dataset.clientMode and
// getAttribute('data-client-mode'). Back the body's data-client-mode by a
// settable variable so scenarios can flip single ↔ couple.
const bodyAttrs = {};
const bodyShim = makeElement('body');
bodyShim.getAttribute = (name) => bodyAttrs[name] !== undefined ? bodyAttrs[name] : null;
bodyShim.setAttribute = (name, value) => { bodyAttrs[name] = value; };
bodyShim.dataset = new Proxy({}, {
  get(_, key) {
    // dataset.clientMode → data-client-mode
    const attr = 'data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    return bodyAttrs[attr];
  },
  set(_, key, value) {
    const attr = 'data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    bodyAttrs[attr] = value;
    return true;
  },
});

const documentShim = {
  getElementById,
  querySelector: (sel) => null,
  querySelectorAll: (sel) => [],
  addEventListener() {},
  createElement() { return makeElement('__created'); },
  body: bodyShim,
  documentElement: makeElement('html'),
  head: makeElement('head'),
};

const windowShim = {
  print() {},
  addEventListener() {},
  print: () => {},
};

// Stub Chart.js — we never render
const ChartStub = function () {
  return { update() {}, destroy() {}, data: { datasets: [] }, options: {} };
};
ChartStub.defaults = { responsive: {}, font: {}, plugins: {}, scales: {} };
ChartStub.register = function () {};
ChartStub.registry = { add() {} };

// -------- Run the script in a controlled global scope ----------
global.document = documentShim;
global.window = windowShim;
global.Chart = ChartStub;
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
};
// History API stub — calculator manipulates scrollRestoration etc.
global.history = { scrollRestoration: 'auto' };
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.cancelAnimationFrame = () => {};

// Pre-populate DOM_VALUES with safe defaults so the IIFE's init refresh()
// call doesn't trip on undefined inputs.
const SAFE_DEFAULTS = {
  'hp-la-A': '4000000', 'hp-la-B': '4000000',
  'hp-disc-A': '1000000', 'hp-disc-B': '1000000',
  'hp-base-A': '500000', 'hp-base-B': '500000',
  'la-rate-A': '5', 'la-rate-B': '5',
  'disc-draw-A': '0', 'disc-draw-B': '0',
  'hp-age-A': '65', 'hp-age-B': '65',
  'return': '7', 'return-c': '7',
  'cpi': '5',
  'needs-monthly': '50000', 'needs-monthly-rail': '50000',
  'needs-lump': '0', 'needs-lump-rail': '0',
  'hp-name-A': '', 'hp-name-B': '',
  'client-name': '', 'client-date': '', 'adviser-name': '',
  // Tax view's year slider — refresh() at init reads its value via parseInt;
  // an empty string would parse to NaN and crash updateTaxPanel.
  'tax-year-slider': '1',
  // Solver button (Solve LA rates to target) — clicked never, but bind reads
  // value during init.
  'btn-solve': '',
};
Object.assign(DOM_VALUES, SAFE_DEFAULTS);
DOM_CHECKED['needs-topup'] = false;

// Run the modified script. The IIFE init runs once and exposes state on
// globalThis.__pari. Init may try to render; the Chart and DOM stubs absorb
// those calls.
try {
  new Function(injected)();
} catch (err) {
  console.error('Error executing inline script:', err.message);
  console.error(err.stack);
  process.exit(3);
}

const api = global.__pari;
if (!api || typeof api.project !== 'function') {
  console.error('__pari.project not exposed — IIFE injection failed');
  process.exit(4);
}

// -------- Per-scenario runner ----------

function setScenarioState(scn) {
  // Spouse A inputs
  DOM_VALUES['hp-la-A'] = String(scn.pA.laBalance);
  DOM_VALUES['hp-disc-A'] = String(scn.pA.discBalance);
  DOM_VALUES['hp-base-A'] = String(scn.pA.discBaseCost);
  DOM_VALUES['la-rate-A'] = String(scn.pA.laRate * 100);
  DOM_VALUES['disc-draw-A'] = String(scn.pA.discDraw || 0);
  DOM_VALUES['hp-age-A'] = String(scn.ageA);

  // Spouse B inputs
  DOM_VALUES['hp-la-B'] = String(scn.pB.laBalance);
  DOM_VALUES['hp-disc-B'] = String(scn.pB.discBalance);
  DOM_VALUES['hp-base-B'] = String(scn.pB.discBaseCost);
  DOM_VALUES['la-rate-B'] = String(scn.pB.laRate * 100);
  DOM_VALUES['disc-draw-B'] = String(scn.pB.discDraw || 0);
  DOM_VALUES['hp-age-B'] = String(scn.ageB);

  // Markets + spending
  DOM_VALUES['return'] = String(scn.rNom * 100);
  DOM_VALUES['return-c'] = String(scn.rNom * 100);
  DOM_VALUES['cpi'] = String(scn.cpi * 100);
  // The JS engine derives target from monthly × 12 + lump. Set monthly so
  // that monthly × 12 = scn.targetPVAnnual; keep lump at 0.
  DOM_VALUES['needs-monthly'] = String(scn.targetPVAnnual / 12);
  DOM_VALUES['needs-lump'] = '0';

  // Auto-top-up checkbox
  DOM_CHECKED['needs-topup'] = !!scn.autoTopup;

  // Single mode
  bodyAttrs['data-client-mode'] = scn.single ? 'single' : 'couple';

  // Stores — replace contents in place (preserves the closure refs
  // captured in __pari).
  api.eventsStore.length = 0;
  for (const ev of (scn.events || [])) api.eventsStore.push({ ...ev });

  api.incomeStore.length = 0;
  for (const inc of (scn.incomes || [])) api.incomeStore.push({ ...inc });

  api.goalsStore.length = 0;
  for (const g of (scn.goals || [])) api.goalsStore.push({ ...g });
}

function toPyShape(p) {
  // Map JS project()'s output into the same shape as the Python port's
  // series dict. This is what the parity test compares against.
  return {
    labels: p.labels,
    la: p.nominal.la,
    disc: p.nominal.disc,
    total: p.nominal.total,
    draw: p.nominal.draw,
    tax: p.nominal.tax,
    net: p.nominal.net,
    target: p.nominal.target,
    laA_bal: p.table.laA_bal,
    laA_draw: p.table.laA_draw,
    laB_bal: p.table.laB_bal,
    laB_draw: p.table.laB_draw,
    discA_bal: p.table.discA_bal,
    discA_draw: p.table.discA_draw,
    discB_bal: p.table.discB_bal,
    discB_draw: p.table.discB_draw,
    otherA: p.table.otherA,
    otherB: p.table.otherB,
    tax_A: p.table.taxA,
    tax_B: p.table.taxB,
    clamp_A: p.table.clampA,
    clamp_B: p.table.clampB,
    draw_rate_pct: p.drawRatePct,
  };
}

const scenarios = JSON.parse(fs.readFileSync(SCENARIOS_PATH, 'utf8'));
const results = {};
const errors = [];

for (const scn of scenarios) {
  try {
    setScenarioState(scn);
    const projection = api.project();
    results[scn.name] = toPyShape(projection);
  } catch (err) {
    errors.push({ name: scn.name, message: err.message, stack: err.stack });
    results[scn.name] = { __error: err.message };
  }
}

fs.writeFileSync(RESULTS_PATH, JSON.stringify(results));

if (errors.length) {
  console.error(`parity_runner: ${errors.length} scenario(s) errored:`);
  for (const e of errors) console.error(`  - ${e.name}: ${e.message}`);
  process.exit(5);
}
