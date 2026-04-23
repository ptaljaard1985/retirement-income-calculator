# Architecture

This document describes the internal structure of `retirement_drawdown.html`. Read this if you're about to modify the code. Math and tax conventions are in `CALCULATIONS.md`; visual choices are in `DESIGN.md`. The sibling `retirement_drawdown_report.html` (the editorial client-report export) is described in its own section at the bottom of this file.

## The one-file principle

Everything lives in one HTML file. The `<head>` holds design tokens in a `:root` block and ~650 lines of component CSS. The `<body>` holds the page structure. A single `<script>` block at the bottom holds all the logic.

There is no module system, no build, no bundler. The cost is that the file is ~2000 lines. The benefit is that anyone can open it, edit it, and understand it without any tooling. Pierre emails it to clients. Breaking the single-file property breaks the product.

Chart.js is the only runtime dependency, loaded from `cdnjs.cloudflare.com`.

## Top-to-bottom page structure

```
<header>              Simple Wealth brand + document title + print button
<title-block>         H1, subtitle
<client-bar>          Prepared for / Meeting date / Adviser
<household-position>  Per-spouse name + age, LA balance, disc balance, disc base cost
<household-needs>     Monthly expenses, lump sum, auto-top-up toggle
<income-streams>      Optional list of other taxable income streams (see below)
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

Reads spouse A or B inputs from the DOM, parses currency strings, clamps sensibly. Returns `otherIncome: 0` as a placeholder — the schedule resolver overwrites this per year inside the projection loop, so the field is effectively unused outside the loop's per-year assignment.

### 3a. `otherIncomeForYear(store, suffix, age, yearIdx, cpi)`

Pure helper that resolves the current `incomeStore` schedule to a single nominal rand amount for one spouse in a given year. Active condition: `age ∈ [startAge, startAge + duration)`. While active, nominal = `amountPV × (1+cpi)^yearIdx` if `escalates` else `amountPV`. Lives alongside `incomeTaxYear` / `cgtExclusionYear` for symmetry.

### 4. `project()` — the heart of the calculator

Called on every refresh. Reads all inputs, runs the year loop, returns a structured result object. The loop iterates `y = 0` through `years − 1` (where `years = 100 − youngest_age`).

Each iteration:

1. Record start-of-year balances (`laA_start`, `discA_start`, etc.)
2. Resolve the other-income schedule for this year: `sA.otherIncome = otherIncomeForYear(incomes, 'A', ageThisYearA, y, cpi)` (same for B). Every downstream read (solver, `stepPerson`, `taxForYear`, `yearDraw` accumulation, Y1 capture) uses these values.
3. Compute CPI-escalated LA rand targets: `targetA = laTargetA_Y1 * (1 + cpi)^y`
4. Compute the year's nominal expense target: `yearTargetNom = targetPVAnnual * (1 + cpi)^y`
5. If auto-top-up is on, call `solveTopUp()` to find LA + disc draws that meet the target after tax (see below). Otherwise use slider values for disc draws.
6. Call `stepPerson()` twice (once per spouse) to apply draws and growth.
7. Compute tax on the final LA + disc + other income.
8. Commit balances.
9. Push to all series arrays (including per-spouse `otherA_series` / `otherB_series` for the year-table `Other` column).
10. (If `y === 0`) capture `taxA`/`taxB` objects for the summary cards and tax panel, including `otherIncome: sA.otherIncome` for the Y1 row in the tax panel — always from this loop's output, never from a separate calculation.
11. Apply any capital events scheduled for year `y + 1` — add nominal amount to that spouse's discBalance AND discBaseCost.

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
  incomes,            // raw income-schedule array (for print summary)
  table: {            // per-spouse per-year for the Table view
    ageA, ageB,
    laA_bal, laA_draw, laB_bal, laB_draw,
    discA_bal, discA_draw, discB_bal, discB_draw,
    otherA, otherB,   // per-spouse nominal other-income each year
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
- `buildIncomeChart(p)` — Income view (stacked bars inside per-year dashed coral target boxes; default is `mode='nominal'`)
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

`eventsStore` is an in-memory array. `renderEvents()` paints the DOM from it, writing the same rows into **both** `#events-list` (the State-1 canonical ledger) and `#events-list-c` (the scenario mirror inside `#shared-chrome`, shown in State 2/3). Event delegation is attached to both hosts via named handler functions (`eventsInputHandler` / `eventsChangeHandler` / `eventsClickHandler` / `eventsBlurHandler`), so edits from either side mutate the same store. `readEvents()` filters to valid events and is called inside `project()` on every refresh.

### 9a. Income-schedule store + wiring

`incomeStore` is an in-memory array that mirrors `eventsStore`. Each item is `{label, spouse, amountPV, startAge, duration, escalates}`. `renderIncomes()` paints rows into **both** `#incomes-list` and `#incomes-list-c` (scenario mirror). Delegated handlers on each host (`incomesInputHandler` / `incomesChangeHandler` / `incomesClickHandler` / `incomesBlurHandler`) cover `input` (label/amount/startAge/duration), `change` (spouse select and escalates checkbox), `click` (delete button), and capture-phase `blur` (reformat amount). `readIncomes()` filters to valid rows (`amountPV > 0`, spouse in {A,B}, startAge ≥ 1, duration ≥ 1) and is called once per refresh inside `project()`. The resolver `otherIncomeForYear` consumes the filtered list.

### 9b. Scenario-adjustments mirror (`#shared-chrome`)

Visible in State 2/3, hidden in State 1. Hosts the extra levers advisers reach for in live meetings: `#return-c` slider, `#needs-monthly-c` + `#needs-lump-c` currency inputs, and the two collapsible ledger sub-sections described above. Each scalar input is bi-directionally synced to its canonical counterpart via the `scenarioSyncPairs` array: `#return ↔ #return-c`, `#needs-monthly ↔ #needs-monthly-c`, `#needs-lump ↔ #needs-lump-c`. Canonical → mirror on `input` (and `blur` for text inputs, to catch post-`formatCurrencyInput` reformats); mirror → canonical on `input` + `blur`, then `refresh()`. `project()` reads from canonical IDs only — the mirror never becomes a source of truth. `updateLeverLabels()` also writes `#return-c-out` so the mirror's val span tracks the canonical slider. `@media print { .scenario-adjust { display: none !important; } }` keeps the block off paper. `setAppState()` calls `renderEvents()` and `renderIncomes()` on every state transition so both ledger hosts are always consistent with the store after a state swap.

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
- The print summary is a single div nested **inside `#state-single`** so it only renders on screen in single mode. `@media print` forces `#state-single` visible regardless of on-screen state, so printing still works from any state.
- Chart.js dataset visibility (via the series-toggle buttons) is managed by mutating `dataset.hidden`, not by filtering the dataset list. This preserves order and colour assignments.
- The Income chart has **five datasets** in this fixed order: `[0] LA (net)`, `[1] Disc`, `[2] Other (net)`, `[3] Target need (transparent line, data carrier)`, `[4] Tax (pink slice)`. The 4 bar datasets share `stack: 'income'`; stacking order within the stack follows array order, so Tax caps the top. `targetBoxPlugin` draws the target as a **solid, bold** (2.5px, no dash) stepped top line: horizontal per-year segments spanning the full x-slot, vertical steps only where the target changes — no sides, no bottom. `shortfallShadingPlugin` paints a coral wash between the colored-bar-top and the need-line for years where net (sum of datasets 0+1+2) < target, plus a dashed vertical at the first shortfall age. Both plugins read `chart.data.datasets[3].data[i]` for the target value.
- **Tax apportionment for the Income chart** (see `incomeBarSeries()`): household `nominal.tax[i]` (or `real.tax[i]`) is apportioned to LA and Other in proportion to their gross shares; Disc is left at gross. Bar total therefore equals gross income, colored portion = net to bank, pink `--pink` `#d27a88` Tax cap = what goes to SARS. This is Option B in `docs/DESIGN.md` — the client sees the tax bite visually rather than a target line floating below the gross-bar tops.
- `buildCompareMiniChart(which, p)` renders a smaller instance of the Income chart into each State 3 compare card (`#cmp-chart-baseline` / `#cmp-chart-scenario`). Same 5-dataset layout and both plugins as the main chart, tooltips off, y-ticks off. `refresh()` calls it once per side when `appState === 'compare'`: baseline reads the locked `baseline` global snapshot, scenario reads the live `project()` output.
- **State 1 title plate**: only the surname inside `#hl-family` is editable; the surrounding "A retirement income plan for the" and "family." is static text. The span loads empty so `.editable:empty::before` paints the em-dash placeholder. `buildReportSnapshot()` reads the span's `textContent.trim()` — just the surname — and the export report's cover wraps it in "A plan for the [surname] family", matching the slot.
- **Spouse-name defaults**: the two `#hp-name-{A,B}` inputs load empty with `placeholder="Spouse A" / "Spouse B"`. `getName(suffix)` falls back to `'Spouse ' + suffix` when the input is blank, so every downstream label reads sensibly until the adviser types a real name.
- `setAppState(next)` no longer persists to `localStorage`. Refresh always lands on the default `appState = 'empty'`. The `beforeprint` listener still snapshots the current state, forces `'single'` for paper, and `afterprint` restores.
- The "Export report" button (State 2 canvas-head, between the Real|Nominal segmented and Print) calls `buildReportSnapshot()`, writes the result to `localStorage['sw-drawdown-snapshot']`, and opens `retirement_drawdown_report.html` in a new tab. The snapshot is the single contract between the two files — see the report-architecture section below.

## The export-report sibling (`retirement_drawdown_report.html`)

A second self-contained HTML file in this directory. It produces the editorial A4-landscape PDF the adviser hands the client after a meeting. **It does not run any projection math.** The calculator computes everything in `project()`, serialises it into a snapshot, and the report file formats and renders.

### The contract: `localStorage['sw-drawdown-snapshot']`

```ts
{
  schemaVersion: 1,
  plan: {
    familyName, preparedFor, preparedOn, adviser,
    spouses: [{ name, age, laBalance, discretionary, discBaseCost,
                otherIncome: [{ kind, monthly }] }, ...],   // monthly = today's-money rand
    monthlyNeed, annualLumpSums, returnPct, cpiPct, autoTopUp,
    capitalEvents: [{ year, label, forWhom, amount }],     // year = absolute, amount = today's-money
    baseline: null | { sustainableTo, monthlyNeed, returnPct, cpiPct, note }
  },
  projection: {
    startAge, horizonAge, years, rNom, cpi,
    rows: [{ year, age, laDraw, discDraw, otherIncome, totalIncome,
             requiredReal, laBalance, discBalance, totalCapital, shortfall, events }],
    sustainableTo, depletesAt, laCapHitAt, discExhaustsAt,
    year1, taxA, taxB, taxByPerson, hhGross, hhTax, hhNet, hhEff
  }
}
```

- `plan.spouses[i].otherIncome` is the **year-1 active streams only**, derived from `incomeStore` filtered by `spouseAge ∈ [startAge, startAge + duration)`. Streams that kick in later (deferred DB pension) do not appear on the household slide.
- `plan.capitalEvents[i].year` is the **absolute calendar year** (`new Date().getFullYear() + ev.year - 1`); the calculator stores year-from-now.
- `plan.baseline` mirrors only the delta-relevant fields the report needs, derived from the calculator's `baseline` global (which is itself a deep clone of `project()`).
- `projection.rows[i]` is shaped to the report binder's expectations exactly — no further transformation is done at render time.
- `projection.taxByPerson` is a 2-element array `[{name, age, laDraw, otherIncome, discDraw, gain, inclusion, taxable, grossIncome, tax, effRate}]` built from `p.taxA` / `p.taxB` for the Y1 tax slide.

If the schema needs to evolve, bump `schemaVersion` and add a back-compat read in the report's binder. The current binder reads schema 1 only.

### Top-to-bottom structure

```
<head>          design tokens (mirrors calculator's :root) + ~700 lines of CSS
<body>
  <div id="deck">  fixed sequence of 14 <section class="slide"> nodes
    [I.   cover]                              always
    [II.  answer]    income chart + outcome   always
    [III. household] spouse cards             always
    [IV.  assumptions] editorial table        always
    [V.   levers]    four lever blocks        always
    [VI.  projection] full-width income chart always
    [VII. capital]   full-width capital chart always
    [VIII.tax]       per-spouse Y1 tax cards  always
    [IX.  events]    timeline + ledger        if plan.capitalEvents.length > 0
    [X.   compare]   baseline vs scenario     if plan.baseline != null
    [XI.  year-table] every 5 years + key ages always
    [XII. methodology] two-column prose       always
    [XIII.compliance]  six blocks             always
    [XIV. next steps] cover-style closing     always
  <div id="empty-banner">  shown when no snapshot in localStorage
<script>  one IIFE, ~670 lines
```

Slide content is driven by `[data-field="..."]` placeholders that the binder writes via `setField()`. Spouse, tax, events, and year-table rows are injected with `innerHTML` from template literals. Everything else is static markup with values written at load.

### The binder (the script block at the bottom)

In order:

1. **Snapshot loader** — tries `?data=<base64-JSON>`, then `localStorage['sw-drawdown-snapshot']`. If neither, shows the empty-state banner and returns.
2. **Drop conditional slides** — `[data-slide="events"]` removed if no events; `[data-slide="compare"]` removed if no baseline.
3. **Renumber** — iterate `.slide` nodes, write Roman numerals to `.eyebrow .rn` and `.slide-foot .rn`, write zero-padded page numbers to every `[data-field="pageNum"]`, set `[data-field="pageTotal"]` to the post-removal slide count.
4. **Top-level field bind** — `setField()` for every cover, household total, assumption, outcome, projection-foot, household-totals etc.
5. **Per-spouse household cards** — innerHTML from `plan.spouses`.
6. **Per-spouse Y1 tax cards** — innerHTML from `projection.taxByPerson`.
7. **Events ledger + timeline** — innerHTML from `plan.capitalEvents` (skipped if hidden).
8. **Compare slide** — fields + chip class flipped pos/neg by horizon delta (skipped if hidden).
9. **Year-by-year table** — every 5 years from start age plus any year matching `{startAge, discExhaustsAt, laCapHitAt, sustainableTo, depletesAt}`.
10. **Charts** — three inline-SVG renderers:
    - `renderIncomeChart(container, rows, {needBase, width, height})` — slides II, VI, X.
    - `renderCapitalChart(container, rows, {laCapAt, depleteAt, withdrawalRate, width, height})` — slide VII.
    - `renderTimeline(container, events)` — slide IX.
    Rows are sliced by `chartSlice(extraYears)` so charts don't paint depleted years past the horizon + buffer.
11. **Auto-print** — fires 600 ms after `load`. Suppressed via `?noprint` querystring for iteration.

### Charts (inline SVG, no external lib)

The inline SVG approach was chosen over Chart.js for two reasons: print fidelity (raster Chart.js canvases blur at A4 print resolution while SVG paths stay crisp), and to avoid loading the calculator's Chart.js dependency into a print-only context. CSS variables are resolved at draw time via `getComputedStyle(document.documentElement)` because Safari doesn't reliably substitute `var(...)` inside SVG attribute values.

### Print

```css
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: white; }
  .slide { margin: 0; box-shadow: none;
           page-break-after: always; break-after: page;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .slide:last-of-type { page-break-after: auto; }
  .empty-banner { display: none; }
}
```

Chrome and Edge produce a clean one-slide-per-page PDF. Safari misreports `size: A4 landscape` — document the limitation if Pierre relies on it. The auto-print listener triggers `window.print()` 600 ms after `load` to give the SVG charts time to paint.
