# Architecture

This document describes the internal structure of `retirement_drawdown.html`. Read this if you're about to modify the code. Math and tax conventions are in `CALCULATIONS.md`; visual choices are in `DESIGN.md`.

## The one-file principle

Everything lives in one HTML file. The `<head>` holds design tokens in a `:root` block and ~650 lines of component CSS. The `<body>` holds the page structure. A single `<script>` block at the bottom holds all the logic.

There is no module system, no build, no bundler. The cost is that the file is ~2000 lines. The benefit is that anyone can open it, edit it, and understand it without any tooling. Pierre emails it to clients. Breaking the single-file property breaks the product.

Chart.js is the only runtime dependency, loaded from `cdnjs.cloudflare.com`.

## Top-to-bottom page structure

```
<header>              Simple Wealth brand + document title + print button
<title-block>         H1, subtitle
<client-bar>          Prepared for / Meeting date / Adviser
<household-position>  Per-spouse: age, LA balance, disc balance, base cost, other income
<household-needs>     Monthly expenses, lump sum, auto-top-up toggle
<capital-events>      Optional list: year / amount / destination spouse
<summary-cards>       Y1 gross, tax, net, gap — four cards, navy highlight on first
<chart-controls>      Capital/Income/Table toggle + Real/Nominal toggle
<chart-card>          Legends, alerts bar, chart canvas(es) or table
<drawdown-levers>     Per-spouse sliders: initial LA rate, disc withdrawal
<market-assumptions>  Sliders: return, CPI
<tax-panel>           Per-spouse Y1 tax breakdown
<print-summary>       Compliance-ready tables: inputs, outputs, methodology, disclaimer
<footer>
```

Every top-level section has a corresponding `section-header` div. Collapsible sections use a `.collapsible-body` child with inline `max-height` for CSS transition.

## The JS, bottom to top

The `<script>` block contains one IIFE. Inside it, in roughly this order:

### 1. SARS tax constants

```js
var BRACKETS = [ [upper, rate, baseTax, lowerBound], ... ];
var REBATE = { primary, secondary, tertiary };
var CGT = { inclusion: 0.40, exclusion: 50000 };
var BRACKET_CREEP = 0.03;
```

The year-aware functions `incomeTaxPreRebateYear`, `rebateYear`, `incomeTaxYear`, and `cgtExclusionYear` all take a `yearIdx` argument and scale the constants by `(1 + BRACKET_CREEP)^yearIdx`. Year 0 is unscaled (the SARS-2026/27 year).

### 2. `stepPerson(p, growth, targetLADraw)`

Advances one spouse through one year. Takes a state `p` (LA balance, disc balance + base cost, other income, and the `discDraw` amount for that year), a nominal growth rate, and a target LA rand draw. Clamps the LA draw to the 2.5%–17.5% band and returns:

```js
{
  laDraw, laAfter, laClamp,     // 'ok' | 'floor' | 'cap' | 'empty'
  discDraw, discAfter,
  gainRealised, newBase
}
```

The function is pure — it does not mutate `p`. The caller assigns `laAfter`/`discAfter`/`newBase` back to state.

### 3. `readPerson(suffix)`

Reads spouse A or B inputs from the DOM, parses currency strings, clamps sensibly.

### 4. `project()` — the heart of the calculator

Called on every refresh. Reads all inputs, runs the year loop, returns a structured result object. The loop iterates `y = 0` through `years − 1` (where `years = 100 − youngest_age`).

Each iteration:

1. Record start-of-year balances (`laA_start`, `discA_start`, etc.)
2. Compute CPI-escalated LA rand targets: `targetA = laTargetA_Y1 * (1 + cpi)^y`
3. Compute the year's nominal expense target: `yearTargetNom = targetPVAnnual * (1 + cpi)^y`
4. If auto-top-up is on, call `solveTopUp()` to find LA + disc draws that meet the target after tax (see below). Otherwise use slider values for disc draws.
5. Call `stepPerson()` twice (once per spouse) to apply draws and growth.
6. Compute tax on the final LA + disc + other income.
7. Commit balances.
8. Push to all series arrays.
9. (If `y === 0`) capture `taxA`/`taxB` objects for the summary cards and tax panel — always from this loop's output, never from a separate calculation.
10. Apply any capital events scheduled for year `y + 1` — add nominal amount to that spouse's discBalance AND discBaseCost.

The return object exposes:

```js
{
  years, startAge, horizonAge,
  ageA, ageB,
  pA, pB,             // original input states
  taxA, taxB,         // Y1 tax objects (for cards + tax panel)
  rNom, cpi,
  labels,             // ['Age 65', 'Age 66', ...]
  drawRatePct,        // household withdrawal rate % for each year
  targetPVAnnual,
  events,             // raw events array (for print summary)
  table: {            // per-spouse per-year for the Table view
    ageA, ageB,
    laA_bal, laA_draw, laB_bal, laB_draw,
    discA_bal, discA_draw, discB_bal, discB_draw,
    taxA, taxB,
    clampA, clampB
  },
  nominal: { la, disc, total, draw, tax, net, target },
  real:    { la, disc, total, draw, tax, net, target }
}
```

### 5. `solveTopUp(...)` — the three-phase solver

Lives inside `project()` so it can close over `incomeTaxYear`, `cgtExclusionYear`, `CGT`, etc. Called each year when auto-top-up is on.

- **Phase 1**: LA at CPI-escalated target, clamped to 2.5%–17.5%.
- **Phase 2**: if net (LA only) < nominal target, draw from discretionary proportionally to disc balance. CGT on gains is included. Iterates (max 8 rounds) because each additional disc draw increases tax and widens the gap slightly. Converges to R100 tolerance.
- **Phase 3**: if disc is exhausted (both pots ≤ R0.01) AND a gap remains, boost LA draws toward the 17.5% ceiling proportionally to LA balance. Important: the boost is always measured against the Phase-1 baseline (`baseA`, `baseB`), NOT cumulatively. An earlier version had this wrong and compounded boosts across iterations.

Returns `{ laDrawA, laDrawB, discA, discB, gainA, gainB, taxA, taxB, net, clampA, clampB }`.

### 6. Rendering functions

Each of these reads the `project()` result and updates the DOM:

- `updateCards(p)` — the four Y1 summary cards
- `updateTaxPanel(p)` — per-spouse tax breakdown
- `updateAlerts(p)` — the chart-alerts bar (LA cap, disc exhausted, real shortfall)
- `buildChart(p)` — Capital view (stacked bars + withdrawal rate line)
- `buildIncomeChart(p)` — Income view (gross, tax, net, target lines)
- `buildYearTable(p)` — Table view (sticky-column HTML table)
- `updatePrintSummary(p)` — all the print-only tables, including events

All are idempotent. `refresh()` calls them in sequence.

### 7. `refresh()`

The main update loop. Called on any input change. Sequence:

```js
updateLeverLabels();
var p = project();
updateCards(p);
updateTaxPanel(p);
updateAlerts(p);
if (chartView === 'capital') buildChart(p);
else if (chartView === 'income') buildIncomeChart(p);
else if (chartView === 'table') buildYearTable(p);
updatePrintSummary(p);
```

### 8. Solver tool: `solveLARate()`

A binary search that finds the single LA rate (equal for both spouses, 2.5%–17.5%) needed to hit the target. Called by the "Solve LA rates to target" button. Fires a single-Y1 tax calculation per iteration. Not related to `solveTopUp` — this is a different kind of solve.

### 9. Events store + wiring

`eventsStore` is an in-memory array. `renderEvents()` paints the DOM from it. Event delegation on `#events-list` handles input/change/delete. `readEvents()` filters to valid events and is called inside `project()` on every refresh.

### 10. Event wiring

At the end: slider listeners, text-input listeners with blur-to-format, toggle listeners, view switcher, solve-for button, events add/delete, date initialiser. Everything ends by calling `refresh()`.

## Data flow on a user interaction

1. User moves a slider (or ticks a box, or adds an event)
2. `input` or `change` listener fires → `refresh()`
3. `project()` re-reads all inputs and re-runs the full year loop
4. Rendering functions pull from the fresh `p` object
5. Chart.js `update('none')` call (if chart exists) or a fresh chart is built

There is no caching, no debouncing, no animation. The whole projection re-runs in a few milliseconds; for a 35-year horizon it's imperceptible.

## What *not* to add

- **State management libraries.** Global mutable state with `refresh()` is fine for a single-page, single-user tool.
- **Component frameworks.** Rendering is 120 lines total.
- **Async/promises.** Nothing here is async. Keep it that way.
- **Type declarations.** The file is small enough to hold in your head. TypeScript would fight the no-build rule.

## Things worth knowing

- The LA clamp flag can be `'ok' | 'floor' | 'cap' | 'empty'`. Only `'cap'` is used for the visual cap markers in the table — the floor case fires green, the empty case fires nothing.
- `updateCards` and `updateTaxPanel` both read from `p.taxA`/`p.taxB`. These are the same objects built inside the first iteration of the year loop, so they're guaranteed to match the Y1 entry in any series.
- The event delegation on `#events-list` uses capture phase for `blur` because `blur` doesn't bubble.
- The print summary is a single div with inline class attributes. `@media print` handles page breaks and hides everything else.
- Chart.js dataset visibility (via the series-toggle buttons) is managed by mutating `dataset.hidden`, not by filtering the dataset list. This preserves order and colour assignments.
