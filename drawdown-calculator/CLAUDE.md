# CLAUDE.md

This file is read first by Claude Code on every session. It tells you what this project is, how it's built, and the conventions that matter.

## What this is

A standalone HTML retirement drawdown calculator for Simple Wealth (Pty) Ltd, a South African authorised financial services provider (FSP 50637). One file, `retirement_drawdown.html`, opens by double-click, prints to PDF cleanly, and is used by the adviser (Pierre) with clients in real meetings.

A second file, `retirement_drawdown_report.html`, is the **editorial client-report export** — a 12-slide A4-landscape PDF the adviser hands the client after the meeting. The calculator's "Export report" button serialises plan + projection into `localStorage['sw-drawdown-snapshot']` and opens the report file in a new tab; the report does NO math, only formatting and rendering.

The calculator models a two-spouse South African household with living annuities plus discretionary (taxable) portfolios. It projects year-by-year to the youngest spouse's age 100, applying SARS 2026/27 income tax with bracket creep, CGT on discretionary gains, and the legislated 2.5%–17.5% LA withdrawal band. It supports auto-top-up from discretionary, LA boosting to the ceiling, and one-off capital inflows (property sales, inheritances).

The target audience for this code is whoever (adviser or Claude) needs to update it in February each year when SARS tables change, or add a feature the adviser decides is worth having. Anything not strictly necessary to that goal has been resisted by design.

## Non-negotiable design constraints

These are not preferences. Breaking any of them is a regression:

1. **Single file**. Everything — HTML, CSS, JS — lives in `retirement_drawdown.html`. No build step, no npm, no React. The only external dependency is Chart.js from `cdnjs.cloudflare.com`. The file must open with `file://` and work offline except for the chart library.
2. **Prints to PDF cleanly**. Browser print dialog produces a compliance-ready document with inputs, outputs, methodology, and FSP disclaimer. Never break `@media print`.
3. **Math is auditable**. Any change to a calculation must come with a Python test in `tests/python/` that implements the same logic from scratch and agrees to the cent with the JS. If you can't write a closed-form or manual trace that matches, the change is unsafe.
4. **Warm paper aesthetic, not SaaS**. Background `#faf9f5`, brand navy `#2d3e50`, hairline borders, no gradients, no shadows, no animations, no emoji. Details in `docs/DESIGN.md`.
5. **South African context**. Rands with space separators ("R6 000 000"), SARS 2026/27 tax tables, FAIS/POPIA disclaimer with FSP 50637. Never swap to comma separators or generic USD conventions.

## How the code is organised

Inside the single HTML file:

- **Lines ~1–560**: CSS, using `:root` CSS variables as design tokens.
- **Lines ~560–1070**: HTML — header, client bar, household position, needs section, capital events, summary cards, chart/table slot, sliders, print summary, disclaimer.
- **Lines ~1075–1330**: SARS tax constants + year-aware helpers (brackets/rebates scaled by `(1+creep)^y`), CGT inclusion, `stepPerson`.
- **Lines ~1340–1600**: `project()` — the year loop, `solveTopUp()` three-phase solver, returns all series.
- **Lines ~1600–1850**: Rendering — `updateCards`, `buildChart`, `buildIncomeChart`, `buildYearTable`, `updatePrintSummary`, `updateAlerts`.
- **Lines ~1850–end**: Wiring — event listeners, toggles, solve-for, events store, init.

See `docs/ARCHITECTURE.md` for more detail on any section.

## Core calculation convention (the one thing that's easy to get wrong)

- Projections are annual, iterating Y1 through Y_final (not starting at Y2).
- Series position `i` represents year `i+1`: `laSeriesNom[i]` is the start-of-that-year LA balance (before that year's draw); `drawSeriesNom[i]` is the draw *during* that year.
- Each year: (a) read start-of-year balance, (b) compute draws via solver, (c) apply draws, (d) grow remainder at nominal return, (e) apply any capital events landing that year.
- LA draws escalate in **rand terms at CPI** each year (not as a re-computed % of balance), clamped into the 2.5%–17.5% band. This reflects how living annuities actually work in South Africa.

See `docs/CALCULATIONS.md` for full maths and tax rules.

## Working style (what Pierre wants)

- **Direct, concise communication.** Push back when you see something wrong. No filler.
- **Scope discipline.** If asked to change X, change X. Do not refactor Y "while you're in there" unless Y is broken in a way that blocks X.
- **Ask one sharp question when ambiguous**, not three safe ones. Use the `ask_user_input_v0` tool if available.
- **Audit the math before shipping.** Never declare a financial calculation change finished without a passing Python test.
- **Don't narrate the design system** back. Just build to spec.
- **No emoji anywhere in the product**, not in the UI, not in generated documents.

## When you're asked to make a change

Run through this checklist:

1. **Is it a math change?** If yes — write or update the Python test in `tests/python/` FIRST. Make sure it fails with the current code (i.e. you've correctly captured the desired new behaviour). Then change the JS. Then verify the test passes.
2. **Is it a UI change?** Check it renders on screen AND in the print dialog. The print stylesheet is at the bottom of the `<style>` block and is easy to regress.
3. **Is it a design-system change?** Almost always no. The palette, typography, and spacing are deliberate. If you think they need to change, stop and ask.
4. **Does it touch SARS tables or bracket creep?** There's a separate `docs/SARS_UPDATES.md` playbook for the annual refresh. Read it first.
5. **Does it break the print output?** Open the file in a browser, hit Cmd+P, check the preview. The print summary must be a complete, self-contained record of the projection.

## Running tests

```bash
# Python tests (math audits)
cd tests/python
pytest

# JS tests (solver behaviour)
cd tests/js
node run.js
```

Both must pass before any change ships. See `tests/README.md`.

## File inventory

- `retirement_drawdown.html` — the calculator. Live tool used in client meetings.
- `retirement_drawdown_report.html` — the editorial client-report export. Single self-contained file, opens via the calculator's "Export report" button. Reads `localStorage['sw-drawdown-snapshot']`, renders 12 A4-landscape slides, auto-prints. No math — purely presentational.
- `README.md` — human-readable project overview, for GitHub.
- `CLAUDE.md` — this file.
- `docs/ARCHITECTURE.md` — code structure in detail.
- `docs/CALCULATIONS.md` — the maths and tax rules.
- `docs/DESIGN.md` — visual system and interaction patterns.
- `docs/SARS_UPDATES.md` — annual update playbook.
- `tests/python/` — math audits in Python.
- `tests/js/` — JS solver tests in Node.

## What not to do

- **Don't bundle.** No webpack, no rollup, no esbuild. The file is the file.
- **Don't add dependencies.** Chart.js is the only runtime dependency. No `Chart.js plugins`, no `lodash`, no `moment`.
- **Don't introduce a backend.** The calculator is stateless and client-side. Anything that needs persistence goes somewhere else (the CRM Pierre is building separately).
- **Don't add analytics, tracking, or telemetry.** Client financial data must stay in the browser.
- **Don't rename `retirement_drawdown.html`.** Pierre emails clients direct links to it; renaming breaks bookmarks.
- **Don't reformat the whole file in one commit.** Diff review is how regressions get caught; a 2000-line whitespace change defeats that.

## When in doubt

Ask. Pierre would rather answer one question now than fix a silent regression later.

## Session log

Most recent first. Keep to ~5 entries here; archive older ones in `docs/SESSION_LOG.md`.

### Session 16 — 2026-04-25 (feat/tax-year-scrub-and-card-parity)

**Built / changed** on branch `feat/tax-year-scrub-and-card-parity` — Planning-canvas polish in five connected pieces. Engine is touched lightly (per-year tax objects); tests still pass 88/88 Python + 19/19 JS:

1. **Income chart loads with bars hidden, only the navy target line visible.** `incomeSeriesVisible` default flipped from `{la:true, disc:true, other:true, tax:true, target:true}` → `{la:false, disc:false, other:false, tax:false, target:true}` (line ~3810). The four bar-series legend buttons (`tog-inc-la/disc/other/tax`) ship with `class="series-toggle off"` + `aria-pressed="false"` so the muted-grey state matches engine state on cold load. Click any pill and its colour fades back in. Per Pierre: opens the conversation with "what's our target?" before introducing how it gets funded.

2. **Income legend toggles now in-place (no destroy/rebuild).** Old click handler (lines ~5174–5196) destroyed `incomeChart` then called `refresh()`, producing a visible flash on every toggle. Replaced with a direct mutation: lookup table `INCOME_DATASET_INDEX = {la:0, disc:1, other:2, target:3, tax:4}` → `incomeChart.data.datasets[idx].hidden = !visible` → `incomeChart.update('none')`. Capital chart's destroy path is preserved because toggling its rate series creates/removes a secondary y-axis. `update('none')` (no animation) was a deliberate course-correct after Pierre flagged the fade as unnecessary motion.

3. **Plan-health alert pills suppressed on Table + Tax views.** `updateAlerts(p)` (line ~4339) gates the chart-alerts host's `display` on `chartView` — table and tax views never show the LA-cap / disc-exhausted / shortfall pills because the table itself shows clamp markers per cell, and the tax view doesn't relate to them. `setView()` already calls `refresh()` → `updateAlerts(p)`, so the toggle is automatic on every view switch.

4. **Tax view becomes a year-scrubbable breakdown.** Was Y1-only; now any year. New per-year arrays `taxA_obj_series` / `taxB_obj_series` capture the full tax breakdown (laDraw, otherIncome, gain, inclusion, taxable, grossPreRebate, rebate, tax, grossIncome, effRate, age) every iteration of `project()`'s year loop using year-aware helpers (`incomeTaxPreRebateYear(taxable, y)`, `rebateYear(age, y)`, `cgtExclusionYear(y)`). The post-loop `taxA = taxA_obj_series[0]` keeps existing Y1 consumers (summary cards, print summary, export-report snapshot) byte-identical. Result object exposes `taxA_objs` / `taxB_objs`. **DOM**: a `.tax-year-scrub` row above the description holds a paper-2 pilled `<input type="range" id="tax-year-slider" min="1" step="1">` with a numeric `Year N` readout. Per-spouse `<h4>` headings now read `Spouse A · age 65` (age driven by the year object). The "(year 1)" suffix on the `Other taxable income` row is gone — the slider implies the year. **Renderer**: `updateTaxPanel(p)` syncs `slider.max = p.years` on every refresh, clamps stale values, paints from `p.taxA_objs[idx]` / `p.taxB_objs[idx]`. **Wiring**: `lastProjection` cached at the top of `refresh()`; the slider's `input` handler calls `updateTaxPanel(lastProjection)` for an instant scrub with no `project()` re-run.

5. **Effective family income tax rate footer in coral.** A `.tax-family-eff` row at the bottom of the tax panel (separated by a hairline) renders `EFFECTIVE FAMILY INCOME TAX RATE   X.X%` in `--coral`. Computed inline in `updateTaxPanel` as `(taxA.tax + taxB.tax) / (taxA.grossIncome + taxB.grossIncome)` for the currently-selected year. Single-client mode: taxB is the synthetic zero person (grossIncome 0, tax 0), so the family rate equals Spouse A's rate. Returns `'—'` when total grossIncome is 0 (avoids divide-by-zero).

6. **All four chart-card views render at the same outer height.** Pierre flagged that Table / Tax cards looked smaller than Income / Capital. Root cause: `.chart-card` natural height varied by ~80px depending on whether the legend strip (Income/Capital only) and the alerts strip (conditional) were rendered. Fix: `.chart-card` is now `display: flex; flex-direction: column; min-height: 600px;` and `.chart-wrap` is `min-height: 480px; flex: 1 1 auto` (was `height: 480px`). On Income/Capital with legend + alerts, the wrap shrinks to ~480px (chart's natural target). On Table/Tax with neither, the wrap expands to fill the freed ~120px so `tax-view-wrap` and `year-table-wrap` (positioned `inset: 0`) cover the larger box. Net: all four views ~600px tall, table + tax content fits without internal scroll on a default 14" viewport.

**Architectural decisions**
- **Per-year tax objects over a recompute-on-scrub helper.** Considered a `taxBreakdownForYear(p, idx)` helper that re-runs the same per-year math from the existing thin-number series. Rejected: the year loop already computes every input the breakdown needs (post-clamp `laDraw`, post-distribution `discDraw`, post-CGT `gainRealised`, age-this-year, otherIncome) and a recompute would have to re-derive them by re-running half the loop. Pushing 35 small objects per refresh costs ~10 KB and zero CPU; the recompute would have to walk the entire loop again on every slider tick. Object capture wins on both axes.
- **Slider scrub bypasses `refresh()`.** The slider mutates only the tax view's render — it does not change the projection or affect any other panel. Re-running the full `refresh()` would rebuild cards, charts, alerts, table, print summary, plan-bar — all wasted work. Caching `lastProjection` and calling `updateTaxPanel(lastProjection)` directly keeps the scrub instant and side-effect-free.
- **Year-aware helpers for the per-year objects, not the Y1-only ones.** The old Y1 capture used `incomeTaxPreRebate(t)` / `rebate(age)` (no year scaling) since `y === 0`. The new code uses `incomeTaxPreRebateYear(t, y)` / `rebateYear(age, y)` for all years. For y=0 the Year variants produce identical numbers (creep factor `(1.03)^0 = 1`), so Y1 byte-identity is preserved; for y≥1 the breakdown reconciles with the authoritative `taxY_A` going into `taxA_series`.
- **In-place dataset toggle for the Income chart, destroy-rebuild for Capital.** Income legend's hidden toggles are pure visibility — Chart.js handles them natively. Capital legend's rate toggle creates/removes a secondary axis (`y1.display`), which Chart.js's `update()` will not retroactively reconfigure on the existing scale, so a destroy-rebuild is the simplest correct behaviour. Two paths, both right for their context.
- **Card-height parity via flex column + min-height, not by reserving placeholders for the legend / alerts.** First attempt set `visibility: hidden` on the alerts host on Table/Tax to preserve its space. Worked but left the absent legend strip unaccounted for, so Table/Tax were still ~36px shorter. Second attempt — the one that landed — moved the burden to the chart-card itself: fix the outer height with `min-height: 600px`, let the chart-wrap absorb whatever vertical space is left after the optional legend / alerts. One CSS rule, no per-view branching, no placeholder DOM.
- **Engine math untouched.** 88/88 Python + 19/19 JS pass. The only engine-shape change is two new arrays on the result object; the value-producing arithmetic is line-for-line identical to pre-session.

**Follow-ups**
- Browser walkthrough at 1366×768 (the 14" target): land on Planning, confirm cold-load Income chart shows only the navy target staircase. Click LA → bar fades in instantly with no flash. Flip to Capital → alerts pills reappear if the scenario hits constraints. Flip to Table → pills hide, table fills the larger box. Flip to Tax → year slider drags from 1 → max with per-spouse cards updating live and the family-eff footer recomputing in coral.
- Print preview from Tax view: confirm the year scrubber DOM doesn't paint on paper (it's inside the chart-card which is forced visible on Planning print). If the slider visibly prints, add a `@media print { #tax-year-slider, .tax-year-scrub { display: none !important; } }` rule.
- Single-client mode + Tax view: confirm the Spouse B card stays hidden under `body[data-client-mode="single"] .tax-grid { grid-template-columns: 1fr }`, the family-eff footer reads Spouse A's rate, and the slider scrubs across years cleanly.
- Snapshot consumers (`buildReportSnapshot()` line ~5520) read `p.taxA` / `p.taxB` only (still Y1). The export report is unchanged; if Pierre ever wants the editorial PDF to include a year-scrub or a per-year tax slide, `taxA_objs` / `taxB_objs` are now available on the snapshot-source object — no engine change needed.

### Session 15 — 2026-04-25 (feat/layout-redesign)

**Built / changed** on branch `feat/layout-redesign` — full layout overhaul prompted by adviser testing: scrolling between chart and sliders disrupted meeting flow. Replaced the 3-state `empty/single/compare` flow with a 5-tab nav and pinned live levers as a sticky 240px rail beside a wide chart canvas. Engine untouched (88/88 Python + 19/19 JS).

1. **5-tab top nav** drives `body[data-tab="info|planning|scenarios|comparison|assumptions"]`. Tabs render via `[data-tab-panel]` attribute selectors — one CSS rule per tab hides every panel that doesn't match. Legacy `data-app-state` machinery retired; `setAppState()` survives as a back-compat shim mapping legacy state names to tab names. Tab vocabulary: **Info** (today's State 1, kept as-is), **Planning** (base scenario, rail+canvas), **Scenarios** (lock baseline + play with what-ifs, rail+canvas with two-up), **Comparison Summary** (decision-ready delta readout, new screen), **Assumptions** (methodology + SARS reference, new screen).

2. **Shared rail across Planning + Scenarios.** A single `<aside class="rail">` lives inside `.rail-canvas-shell` (a 2-col grid `[240px 1fr]`) and holds, top to bottom: **Drawdown levers** (per-spouse LA-rate + disc-draw sliders, IDs `la-rate-A/B`, `disc-draw-A/B`, with `Solve to target` button in the head), **Markets** (Return slider `#return-c`, mirror of canonical `#return` on Info), **Spending** (`#needs-monthly-rail` + `#needs-lump-rail` — see point 9 below), **Display** (Auto-top-up pill `#toggle-topup-pill`), **Schedules** (Other income + Capital events as collapsible sub-sections — see point 7), **Lock as baseline →** / **Continue → Summary** CTA pair (visibility CSS swaps which is shown per tab). State-single and state-compare both occupy `grid-column: 2 / row: 1` of the shell; the inactive one hides via tab-panel visibility CSS. **Sticky + internally scrollable**: `align-self: start; position: sticky; top: 14px; max-height: calc(100vh - 40px); overflow-y: auto` so the rail pins beside the chart and only its content scrolls when ledgers are expanded — the page itself never scrolls.

3. **Planning canvas.** Chart-view seg (Income | Capital | Table | Tax) + Real|Nominal seg pinned right on the same row + chart-card. The full Y1 outcome strip (3-cell verdict / Y1 need / Funded-by card) and the compact tax-strip below the chart were both **removed** — the verdict reads from the chart's coral shortfall wash + chart-alerts chip. Hidden span DOM (`#out-age`/`#out-need`/`#out-mix` etc.) survives inside the canvas so `updateOutcomeStrip()` writes are safe no-ops; same trick for `#pb-family`/`#doc-date`/`#btn-export-report` so `updatePlanBarLite()` and the canonical export handler keep working unchanged.

4. **Scenarios canvas.** Lifted `compare-grid` two-up + canvas-head from State 3. Auto-top-up + Real|Nom + clear/re-lock buttons that duplicated the rail dropped (kept `Clear baseline` + `Re-lock baseline` on a slim canvas-head). Mini-chart Tax dataset is constructed with `hidden: true` so the pink Tax slice never appears on Scenarios — adviser sees net-to-bank vs. baseline cleanly without the tax-bite distraction.

5. **Comparison Summary (new).** Static decision page: title eyebrow + today's date, Baseline/Scenario one-line summaries (`R 65k/month · sustainable to 89 · Return 6.5%` style), bulleted Key Changes (computed by new `diffPlanForSummary(baseline, current)` — return Δ, CPI Δ, monthly-need Δ, per-spouse LA-rate Δ, per-spouse disc-draw Δ, capital-events count Δ), verdict line (driven by `analyseProjection`'s `sustainableAge` delta), Export-report-PDF + Re-open-Scenarios CTAs. Empty state when no baseline: copy points back to Planning.

6. **Assumptions (new).** Read-only readouts of live Return / CPI / Auto-top-up + a static SARS 2026/27 reference table (bracket creep, CGT inclusion + exclusion, LA band, rebates) + methodology prose + FSP disclaimer. Read-only because canonical Return + CPI sliders live on Info (and Return on the Planning rail); duplicating them here would have created ID collisions. IDs `asm-return-readout`, `asm-cpi-readout`, `asm-topup-readout`, `asm-start-age`; `updateAssumptionsReadouts(p)` fires only when `activeTab === 'assumptions'`.

7. **Schedules in the rail (collapsibles).** Other income + Capital events live as `<div class="sub-section rail-sub">` with `.section-header.collapsible.collapsed.rail-collapsible` headers + `.collapsible-body.collapsed.rail-collapsible-body` bodies, inside the Schedules section. Both collapsed by default, expand on click. Body capped at `max-height: 240px` with internal scroll. Count badges `#incomes-count-c` / `#events-count-c` in the headers tick live. The dual-host pattern resurrected: `EVENTS_HOSTS = ['events-list', 'events-list-c']` paints both canonical (Info) and rail mirror from the same `eventsStore`. CSS `.rail-ledger .event-row { grid-template-columns: 1fr !important }` stacks the canonical 4-col row into a single column to fit the 240px rail; absolute-positioned `×` delete on each card. After a brief modal experiment that we rejected as overkill, the verdict was: rail-internal scroll + sticky positioning (above) is the elegant answer — Pierre keeps watching the chart respond as he edits, no overlay covering the canvas.

8. **Tax view (4th chart-view button).** `Tax` was added to the `Income | Capital | Table | Tax` seg. The full per-spouse 9-row tax breakdown that previously lived in `#shared-chrome` was moved into the chart-card as `#tax-view-wrap` (sibling of `#chart`, `#chart-income`, `#year-table-wrap`). `setView('tax')` toggles its `display: ''`. Both `#year-table-wrap` and `#tax-view-wrap` are now `position: absolute; inset: 0` inside `.chart-wrap` so they fill the 480px canvas exactly and scroll internally — the older `height: 100%` pattern wasn't reliably anchoring on display swap. With this, `#shared-chrome` is gone entirely (the whole div was deleted; the compact tax-strip below the chart was also retired). `updateTaxPanel()` writes the same `ta-*` / `tb-*` IDs in their new home.

9. **Spending sliders (Monthly need ±R30k, Annual lumps ±R100k).** New section in the rail between Markets and Display. Sliders anchor to the canonical Info-tab values: `setupRailSpendingSlider(canonicalId, sliderId, valueOutId, swing)` reads the canonical text input, sets `slider.min = anchor - swing`, `slider.max = anchor + swing`, `slider.value = anchor`. Drag pushes a formatted value into `#needs-monthly` / `#needs-lump` and calls `refresh()`. Typing on Info re-anchors via `input` + `blur` listeners. Step 500 monthly, 5000 annual. Swing values per Pierre's spec.

10. **`-c` mirror cleanup.** With ledgers + needs editable from a single canonical home (Info) plus a rail mirror (Other income, Capital events), the `#shared-chrome` mirror DOM was deleted: `#needs-monthly-c`, `#needs-lump-c`, and the orphaned hidden tax panel. `scenarioSyncPairs` trimmed to `[['return','return-c']]` (Return is the only scalar that lives in two homes). `renderEvents()` / `renderIncomes()` already guarded `if (h)` per host. Net: ~150 lines of HTML + ~40 lines of sync logic retired.

11. **Page width + chart height.** `.page` max-width `1100px → 1400px` (gives the chart ~300px more horizontal room on a 14" MBP without crowding the margins). `.chart-wrap` height `340px → 480px` (chart now occupies the natural visual centre of the page rather than a small slice).

12. **Print path.** `@media print` hides `.tab-nav` and `.modal-backdrop` (none exist now but rule survives in case modals are reintroduced), forces `[data-tab-panel="planning"]` visible (`display: block !important`), collapses `.rail-canvas-shell` to a single column with `.rail { display: none !important }` so canvas spans full paper width. `beforeprint` stores `activeTab`, forces `setTab('planning')`, resizes charts; `afterprint` restores. Print summary stays nested inside `#state-single`, hidden on screen everywhere via `#print-summary { display: none }`, surfaced only on paper via `@media print { .print-summary { display: block !important; page-break-before: always } }`.

13. **Scroll snap-to-top.** Three layers ensure the viewport always lands at the top of the page on reload + tab switch: (a) `history.scrollRestoration = 'manual'` disables browser scroll-position restoration on cold reload; (b) `html, body { overflow-anchor: none }` disables CSS scroll-anchoring (the browser's reflow-stability feature that pulls the viewport down past the nav when panels swap); (c) `setTab()` triple-fires `window.scrollTo(0,0)` — immediate, next animation frame, and 50ms delayed — to defeat any late layout shifts (Chart.js resize is the typical offender).

**Architectural decisions**
- **Tabs over scroll.** Pierre's original bug was the meeting flow: drag a slider, scroll up to see chart, scroll down to drag again. Tabs partition concerns (setup vs. live vs. compare vs. summary vs. methodology) so each fits a 14" viewport without scrolling. Live meeting work happens on Planning (one chart) or Scenarios (two-up); the rail is the same in both, so muscle memory survives the tab switch.
- **One rail, two tabs.** Considered duplicating the rail per panel with `-2` suffix mirrors, considered DOM-relocating the rail at `setTab()` time, considered making the rail `position: fixed`. Settled on a 2-col CSS grid (`.rail-canvas-shell`) that holds rail + both panels overlapping on grid column 2. One DOM, single canonical IDs, no sync, no relocation. Visibility CSS does the rest.
- **Sticky scrollable rail over modal-for-edits.** When ledgers expand the rail can grow past the viewport. First instinct was a modal to host the ledger forms. Rejected: ~75 lines of CSS+JS for marginal benefit, and the modal would cover the chart while editing — Pierre loses the live feedback loop. Sticky-rail + internal scroll is 5 lines of CSS, keeps the chart visible while editing, and the Lock-as-baseline button stays reachable via the rail's own scroll.
- **Tax view inside the chart-card.** The full 9-row tax breakdown used to live below the chart in `#shared-chrome`. Now it's a 4th chart-view button — Pierre clicks Tax, the chart canvas hides, the breakdown takes over the 480px canvas slot. Same chart-card chrome, same screen real estate, no scroll required.
- **Outcome strip removed.** The verdict (sustainable-until-age, Y1 need, funded-by mix) duplicated the chart's coral shortfall wash + the alert chip. Removing the strip reclaimed ~80px of vertical real estate without losing information. Hidden span DOM kept so renderer writes are safe no-ops.
- **Comparison Summary is brand new.** Today's State 3 (now Scenarios) is interactive (locked baseline + live scenario two-up). Pierre wanted a SEPARATE static "decision page" he shows the client to seal a recommendation. `diffPlanForSummary()` enumerates real changes from the snapshot, not stored copy.
- **Assumptions is read-only on purpose.** Pierre adjusts assumptions during setup (Info) or live (rail). Assumptions tab shows what's in effect right now alongside SARS context. Editable sliders here would have created duplicate IDs and three places to edit the same number.
- **Engine untouched.** 88/88 Python + 19/19 JS pass. `project()`, `solveTopUp`, `stepPerson`, tax helpers, `solveLARate`, `analyseProjection`, all chart builders unchanged.

**Follow-ups**
- Browser walkthrough at 1366×768 (the 14" target): cycle Info → Planning → drag LA-A → Lock → Scenarios → drag scenario → Continue → Comparison Summary → Re-open Scenarios → Assumptions → Info. Confirm no scroll on any tab. Expand both rail Schedules collapsibles with multiple rows and confirm the rail's own scroll engages without page scroll.
- Print preview from any tab: should land on Planning, hide rail, show chart + print-summary.
- Dead CSS sweep: the now-orphaned `.outcome-strip*`, `.outcome-cell*`, `.tax-strip*`, `.strip-ledger*`, `.rail-ledger-btn`, `.plan-bar-lite*`, `.scenario-adjust*`, `.canvas-head-eyebrow`, `.empty-cta-eyebrow`, `.empty-cta-sub`, `.empty-topup-label`, `.empty-meta`, `.narrative-*`, `.headline-sub`, plus the `.is-shortfall` rule and the iteratively-abandoned `.tax-strip-cell` / `.rail-collapsible-body` overrides. Bundle with the Session 7/8/9/11 dead-CSS follow-ups in `TECH_DEBT.md`.
- Dead JS handlers: `toggle-topup-pill-c`, `btn-real-c`, `btn-nom-c` (lines ~5400 area) are now no-ops since their DOM was deleted. Trim in a follow-up.
- ARCHITECTURE.md and DESIGN.md still reference State 1/2/3 vocabulary in places. The Session 15 entry above is the canonical source while a focused doc-rewrite lands.

### Session 14 — 2026-04-24 (feat/single-client-mode)

**Built / changed** on branch `feat/single-client-mode` — first-class support for a single retiree (widow / widower / never-married), in addition to the existing two-spouse default. Five discrete changes:

1. **Couple | Single client segmented toggle.** New `.seg.mini` radio at the top of State 1's Household Position section (right-aligned, above the spouse cards), with IDs `#mode-couple` / `#mode-single`. Writes `<body data-client-mode="couple|single">` on click. Default is `couple` — every existing bookmark / saved meeting renders byte-identical. New `setClientMode()` handler flips the attribute, destroys both cached charts (so Spouse-B zero-series flushes through on rebuild), and calls `refresh()`.

2. **One CSS rule owns the collapse.** `body[data-client-mode="single"] .spouse-b-only { display: none !important; }`. The `.spouse-b-only` class is tagged onto the Spouse B card in Household Position, the `.empty-divider` between spouse cards, the Spouse B Financial-levers column, the Spouse B tax panel, the Spouse B inputs block in the print summary, and every Spouse B cell (header + body) in the year table. `.empty-setup`'s grid collapses to `1fr` under the attribute so the lone Spouse A card spans full width. The Spouse A step label uses a `.label-couple` / `.label-single` span pair so "I. Spouse A" reads "I. Client" when single — CSS-only swap, no JS mutation.

3. **Engine branches on `isSingleClient()`.** At the top of `project()`, when single, `pB` is replaced with a synthetic zero person (`laBalance: 0`, `discBalance: 0`, `discBaseCost: 0`, `discDraw: 0`, `otherIncome: 0`, `laRate: 0`) and `ageB` is set to `ageA`. The horizon then anchors on `ageA` alone (`Math.min(ageA, ageA) === ageA`). The UI's actual Spouse B inputs are never mutated, so flipping back to Couple restores the prior projection exactly. `project()` returns `single: true|false` on the result object so every renderer branches off `p.single` without re-reading the DOM. Related **defensive NaN guard** in `solveTopUp` Phase 3: the LA-boost apportionment's `wA2 = sA.laBalance / (sA.laBalance + sB.laBalance)` was saved only by the outer `totalHead > 0` check; now computes `totalLA = sA.laBalance + sB.laBalance` once and falls to `0` when zero. Mirrored in `conftest.py` for parity. `test_single_spouse.py` exercises both the happy path and the pathological "both depleted" case.

4. **Copy branches everywhere "spouse B" or "youngest spouse" appeared.** Outcome strip sub: `target fully met to age 100` (single) vs `youngest spouse · target fully met` (couple). Print-summary horizon line: `To age 100 (…)` vs `To youngest spouse age 100 (…)`. LA-cap alert: `LA at 17.5% ceiling from age X` (single) vs `Both LAs at 17.5% ceiling from age X` / `Jane LA at 17.5% ceiling from age X` (couple, depending on whether both or only one hit the cap). Print-summary heading: `<span class="label-couple">Projected capital at youngest spouse's age 100</span><span class="label-single">Projected capital at age 100</span>`.

5. **Export report + `retirement_drawdown_report.html`.** `buildReportSnapshot()` pushes one entry into `plan.spouses` when single (instead of two), emits a one-entry `taxByPerson`, strips `projection.taxB` to `null` so the report's fallback tax-card builder doesn't materialise a phantom R0 Spouse B row, and swaps the `preparedFor` fallback from `"Jane & Spouse B"` to just `"Jane"`. `plan.single` rides on the snapshot for the consumer. The report HTML swaps "age 100 of the younger spouse" → "age 100 of the client" on the methodology + longevity-horizon slides when `plan.single`. The spouse-cards slide and tax-grid slide already map through their arrays, so reducing the arrays to length 1 naturally produces a one-card render.

**Architectural decisions**
- **One toggle, one source of truth.** Considered threading a JS `isSingle` flag through every renderer as a call-site argument. Rejected: seven+ call sites, hard to keep consistent. `body[data-client-mode]` is readable by both CSS and JS, carries the default in the HTML itself, and collapses the entire UI with one CSS selector family. The `p.single` flag rides on every `project()` result so individual renderers stay pure.
- **Synthetic zero person over conditional math.** Considered adding `if (!single) { … }` guards inside `solveTopUp` and `stepPerson`. Rejected as a widening of the contract — the solver would become branchy, harder to audit, and the Python port would need mirror branches. Zeroing `pB` at the `project()` boundary means the rest of the engine runs unchanged with well-defined zero inputs; `stepPerson({ laBalance: 0, … })` already returns `{draw: 0, flag: 'empty'}` and `solveTopUp`'s Phase 2 skips cleanly when `discAvail === 0`. The only arithmetic edge was the Phase 3 `0/0` denominator, now guarded.
- **CSS-class tag over DOM rebuild.** For the year table, tagging every `<th>`/`<td>` with `.spouse-b-only` means `buildYearTable()` is unchanged shape-wise — no second code path for "single layout". The print stylesheet inherits the same rule for free; no separate `@media print` branch. Cost: twelve class tags in the template string. Benefit: table renderer stays a pure function of `p.table`.
- **Single mode is not persisted.** Same convention as `data-app-state`: a cold reload always lands on `couple`. An adviser opening the calculator for a new meeting gets the default posture; the toggle is a per-meeting override. If persistence is ever needed it's a 3-line `localStorage` addition.
- **Tests first.** Two new Python test classes (`test_single_spouse.py`: 7 cases covering horizon anchoring, NaN-free Phase 1/2/3, flat-zero `tax_B`, and the pathological both-depleted guard). Three new JS solver cases in `run.js` covering the same happy path + the `0/0` guard. All pass: **88/88 Python + 19/19 JS**.

**Follow-ups**
- Browser walkthrough: toggle Couple ↔ Single; confirm (a) Spouse B card vanishes and Spouse A label reads "I. Client", (b) Financial Levers shows one slider column, (c) Tax panel shows one card, (d) year table drops six columns cleanly, (e) outcome-strip sub reads "target fully met to age 100", (f) alert reads "LA at 17.5% ceiling" without a name prefix. Flip back to Couple and confirm byte-for-byte pre-fix rendering.
- Print preview: confirm Spouse B inputs block, Spouse B tax row, and Spouse B year-table columns all drop on paper under Single; confirm horizon line reads "To age 100" not "To youngest spouse age 100".
- Export report: open with Single active; confirm cover "Prepared for" is the single name (no " & Spouse B"), the spouses slide renders one card, the tax slide renders one card, and the methodology slide copy reads "age 100 of the client".
- If Pierre wants the surname-driven `#hl-family` headline ("the ——— family") to read differently for a single client, a per-mode copy swap (`body[data-client-mode="single"] .label-couple { display: none }` on the word `family`) is a 5-line follow-up. Holding off pending his call.

### Session 13 — 2026-04-24 (feat/chart-dividers-and-target-line)

**Built / changed** on branch `feat/chart-dividers-and-target-line` — three chart polish changes, no engine touch:

1. **Faint white year dividers on the Income chart.** Added `borderColor: '#ffffff'` + `borderWidth: { top: 0, right: 1, bottom: 0, left: 0 }` + `borderSkipped: false` to each of the four Income-chart bar datasets (LA, Disc, Other, Tax) in `buildIncomeChart`. Same treatment on `buildCompareMiniChart` so State 3's mini charts match. The 1px white right-border on every bar produces a faint vertical divider between adjacent years, matching the editorial-reference screenshot Pierre pointed at. The object-form `borderWidth` keeps top/bottom/left at 0 so the stacked LA→Disc→Other→Tax segments still read as continuous colour blocks — no horizontal lines inside the stack.

2. **Income-chart target line is now navy.** `targetBoxPlugin`'s `ctx.strokeStyle` shifted from coral `#a04438` to navy `#1f2d3d`. The `tog-inc-target` legend pill's `color` style updated to match so the swatch + text stay in sync with the line. Coral was overloaded — the same colour was painting the target line AND the shortfall dashed-vertical + label. Separating them: navy = target (editorial ink), coral = shortfall signal. Capital chart's withdrawal-rate line and legend stay coral — different chart, distinct signal (ratio vs capital).

3. **Same bar treatment on the Capital chart.** Capital was on Chart.js defaults (0.85 × 0.95) with no year dividers. Mirrored the Income chart's settings onto both the LA and Discretionary datasets in `buildChart`: `categoryPercentage: 1.0, barPercentage: 1.0` (flush bars) + the same white right-border pattern. Withdrawal-rate line dataset untouched. Capital chart doesn't use `targetBoxPlugin` / `shortfallShadingPlugin`, so no slot-width plugin work needed.

**Architectural decisions**
- **Right-border-only for year dividers.** Considered setting `borderWidth: 1` (all sides) with `borderSkipped: 'start'` so Chart.js's default skip-the-baseline behaviour would still apply. Rejected: 'start' would leave a TOP border on each segment of the stack, which would paint horizontal lines between LA / Disc / Other / Tax. Object-form `borderWidth` with only `right: 1` + `borderSkipped: false` is the cleanest way to get vertical dividers without horizontal clutter inside the stack.
- **Navy over pure black for the target.** Pierre first asked for black; amended to `--navy` (`#1f2d3d`) after seeing the proposal. Navy reads as an editorial ink line against the warm-paper background; pure `#000000` would have been too harsh. Uses the same brand-navy token as the plan-bar + primary buttons, so it integrates rather than introducing a new chart-only colour.
- **Coral stays reserved for shortfall.** With the target flipped to navy, every remaining `#a04438` use in the file is a shortfall signal or a withdrawal-rate signal on the Capital chart. Cleaner semantic separation — a reader scanning the Income chart learns "coral = something went wrong" rather than "coral = any chart line".
- **Capital mirrors Income even though no plugin geometry work carries over.** The slot-width fix from Session 12 was for `targetBoxPlugin` + `shortfallShadingPlugin`, which aren't on the Capital chart. But the bar-width + year-divider treatment is a consistency story: Pierre asked for the same rectangle changes. Keeping both charts visually consistent avoids the adviser having to re-tune their eye when flipping between Income and Capital views.
- **Engine untouched.** 81/81 Python + 16/16 JS pass.

**Follow-ups**
- Browser walkthrough with a stretched scenario: confirm (a) both charts have flush bars with faint vertical white dividers, (b) Income target line renders navy with no coral, (c) coral shortfall wash + dashed vertical + label still appear in depleted years, (d) Capital withdrawal-rate line + y1-axis ticks stay coral.
- If the 1px white dividers feel too faint on a projector or high-DPI display, bump to `right: 2` or shift `borderColor` to `rgba(255,255,255,0.8)`. Easy tweak.

### Session 12 — 2026-04-24 (fix/income-chart-geometry)

**Built / changed** on branch `fix/income-chart-geometry` — two income-chart geometry fixes, no engine touch:

1. **White band at the right edge of the Income chart — fixed.** Both `targetBoxPlugin` and `shortfallShadingPlugin` previously computed per-iteration `xNext` with a `(i + 1 < N) ? xScale.getPixelForValue(i + 1) : xScale.right` fallback. For `i === N-1` that produced a half-slot `barSpan` because `xScale.right` sits only half a slot past the last categorical position. The last year's shortfall rectangle and target step therefore rendered at half width, leaving visible white vertical stripes on each side of the final column (Pierre spotted them in the depleted-years region of a stretched scenario). Replaced the per-iteration computation with a single stable `slot = xScale.getPixelForValue(1) - xScale.getPixelForValue(0)` computed once before the loop, used for every year — including the last. Both plugins now paint uniform-width rectangles / segments across the full horizon.

2. **Income-chart bars are now flush.** Added `categoryPercentage: 1.0, barPercentage: 1.0` to each of the four bar datasets (LA, Disc, Other, Tax) in `buildIncomeChart`. Chart.js defaults are 0.8 × 0.9 = 0.72, so ~28% of each slot was horizontal whitespace between bars. Setting both to 1.0 makes adjacent years touch with zero gap, matching the editorial reference Pierre pointed to. Same change applied to `buildCompareMiniChart` (State 3 compare minis) so the two chart variants stay visually consistent. Capital chart (`buildChart`) keeps its 0.85 × 0.95 — different visual density requirements, out of scope.

**Architectural decisions**
- **Uniform slot over per-iteration compute.** Considered computing a correct `xNext` for the last year by extrapolating from `x_last + (x_last - x_{last-1})`. Rejected as more brittle than computing slot once: categorical x-scales on our year labels are guaranteed uniform, and a single variable is easier to reason about than a branch inside the loop. The slot computation gracefully degrades for `N <= 1` (falls back to plot-area width, which is the only sensible behaviour for a one-year chart).
- **Flush bars via dataset properties, not scale-level.** Chart.js accepts `categoryPercentage` / `barPercentage` on both dataset and scale objects. Applied at dataset level because our four income bar datasets share the `stack: 'income'` id, and per-dataset settings make the stacking contract explicit alongside the stack label.
- **Mini charts mirror main chart.** `buildCompareMiniChart` shares both plugins with the main income chart, so the slot-width fix applies automatically. The bar-percentage change had to be duplicated because the mini chart's datasets are defined independently. Kept in sync so State 3's baseline vs. scenario compare reads identically to State 2.
- **Engine untouched.** 81/81 Python + 16/16 JS pass.

**Follow-ups**
- Browser walkthrough: load a depleting scenario (e.g., R150k monthly need, auto-top-up on), confirm (a) bars touch across the full horizon, (b) coral shortfall wash and target-line staircase both extend the full slot width on the last year with no white stripes. Repeat in State 3 Compare.
- With bars flush, the pink Tax slice sits adjacent to the next year's teal LA slice — visually heavier than before. If any year's tax pink looks overwhelming in practice, consider a slightly tighter `categoryPercentage` (e.g., 0.96) as a compromise. Leaving at 1.0 until Pierre pushes back.

_Sessions 1–11 archived in `docs/SESSION_LOG.md`._
