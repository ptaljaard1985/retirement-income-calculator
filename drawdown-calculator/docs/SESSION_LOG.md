# Session log archive

Older session entries live here. The most recent ~5 stay in `CLAUDE.md`. Oldest first within this file.

---

## Session 1 — 2026-04-22

**Built / changed**
- Named households & spouses. Each spouse has an editable inline name input in the household-position section; the value flows through the tax panel heading, drawdown-levers heading, year-table column groups, single-spouse LA-cap alert, future-capital-events selector, and print summary headings. "Prepared for" remains the household-level label.
- Documented the behaviour of the old "Other taxable income p.a." field — confirmed it was read once as a scalar, added flat to every year's tax and gross income, and never escalated.
- Replaced the two fixed `hp-other-A/B` inputs with a multi-item **Other taxable income streams** section (mirrors the Future capital events pattern). Each stream carries `{label, spouse, amountPV, startAge, duration, escalates}`. Resolved per-year inside `project()` via a new `otherIncomeForYear(store, suffix, age, yearIdx, cpi)` helper.
- Year-by-year table gained an aggregated per-spouse `Other` column (spouse group colspan 5 → 6).
- Print summary drops the per-spouse Other-income rows and gains a conditional "Other taxable income streams" schedule table + a methodology sentence explaining flat vs CPI-escalating streams.
- Python audits: added `other_income_for_year` helper and `incomes=` kwarg on `project()` in `tests/python/conftest.py`; 15 new tests in `tests/python/test_other_income.py`. Full suite: 77/77 Python and 16/16 JS pass.

**Architectural decisions**
- Schedule active window is half-open `[startAge, startAge + duration)`. Escalation factor is `(1+cpi)^yearIdx` (from today, not from startAge) so the adviser's entered `amountPV` preserves its real value when the stream kicks in late.
- `incomeStore` mirrors `eventsStore` exactly (in-memory array, `readX/renderX`, delegated handlers on `#incomes-list`, blur reformats amount). Keeps the file idiomatic.
- Python `project()` treats `incomes=None` as the legacy scalar-baseline path; `incomes=[]` forces the schedule path. Old tests keep passing, new tests get full coverage.
- `readPerson` still returns `otherIncome: 0` as a placeholder — `sA.otherIncome` is overwritten each year inside the loop before any read. Keeping the placeholder is defensive, not necessary.
- `Other` column in the year table shows the aggregated per-spouse total for that year. Itemised sub-rows were considered and rejected as too noisy.

**Follow-ups**
- Browser + print-preview pass with a non-trivial schedule to confirm the year-table layout at 18 data columns and the print summary's new block paginates cleanly.
- JS-side smoke test for `otherIncomeForYear` is optional; the function is pure and the Python audit covers the semantics.
- The legacy scalar-baseline path in `conftest.project()` and `readPerson`'s `otherIncome: 0` placeholder can both be removed once confidence in the schedule path is established.

---

## Session 2 — 2026-04-23

**Built / changed**
- Implemented the full hi-fi redesign from `design/design_files/` on branch `design-update-pr`. Three connected states (Empty / Single scenario / Compare) in one file; crossfade transitions driven by `setAppState()` and `body[data-app-state]`.
- Replaced the entire `:root` palette with the warm-paper + editorial token set (`--paper #faf7f0`, `--navy #1f2d3d`, `--gold #b8893c`, `--coral #a04438`, Fraunces / Inter Tight / JetBrains Mono via Google Fonts `@import`). Legacy token names (`--brand`, `--surface-alt`, `--ink-muted`, etc.) remain aliased to the new values so component CSS untouched in this pass keeps rendering.
- **State 1 (Empty)**: editorial title plate with two `contenteditable` spans (family name + monthly amount — the monthly span is bi-directionally bound to `#needs-monthly`), two-column spouse setup (I. / II.), household-needs strip (monthly, lump sums, markets — `#return` and `#cpi` sliders now live here), other-income + capital-events ledgers (ledger visual for events with grid header), navy CTA bar with gold "Build the projection →" button.
- **State 2 (Single)**: plan-bar-lite chrome (household / capital / target / date facts + "Edit plan ↓"); canvas-head with editorial Fraunces 44px headline (`R X a month is sustainable until age N.`, "sustainable" in serif italic, "age N" gold-underlined); action cluster (`Auto-top-up` toggle pill, `Real | Nominal` segmented, ghost Print, primary `Lock as baseline →`). New default chart view is **Income**: stacked bars (teal LA + gold Disc + navy-soft Other) with a dashed coral target line and a `shortfallShadingPlugin` that paints coral wash + dashed vertical at the first shortfall age. Capital view restyled with new tokens. Outcome strip (3 cells, teal primary). Condensed-path tax panel still writes into the existing `#ta-*` / `#tb-*` ids (no id changes). Narrative section with inline callouts. Canvas footer.
- **State 3 (Compare)**: baseline vs scenario two-up cards. "Lock as baseline" snapshots `project()` via `JSON.parse(JSON.stringify(...))`. Delta chip flips gold / coral based on year-count delta. Meta rows show per-spouse LA rates, disc draw, monthly need, return·CPI with inline italic `--gold-2` deltas. Scenario levers and tax panel live in a shared-chrome block rendered below state-compare (hidden only in State 1 via `body[data-app-state="empty"] #shared-chrome { display: none; }`).
- **Print**: `@media print` forces state-single visible, hides every interactive element, applies `-webkit-print-color-adjust: exact` to coloured blocks. A `beforeprint` / `afterprint` JS pair snapshots and restores `appState`.
- **Sliders**: new visual — 4px linear-gradient track with gold fill up to `--fill` %, 14px white thumb with `--gold-2` border, scale(1.15) on hover. `updateSliderFill()` keeps `--fill` in sync on every `input` event.
- **Docs**: `docs/DESIGN.md` fully rewritten to describe the new tokens, typography, three-state flow, chart spec, print behaviour, and component conventions.

**Architectural decisions**
- **Engine untouched.** `project()`, `solveTopUp`, `stepPerson`, the SARS tax helpers, and `solveLARate` were not modified. Existing test suites confirm: 77/77 Python + 16/16 JS continue to pass.
- **Single file preserved.** No build, no modules, no new packages. Only external dependency changes are Google Fonts (soft: falls back to Georgia + system sans + system mono offline) alongside the existing Chart.js CDN.
- **No DOM id collisions.** Setup inputs physically live in state-empty; outputs in state-single; shared per-spouse lever sliders + tax panel in `#shared-chrome`. Each `id` appears exactly once. `updateTaxPanel` / `updateCards` / `updatePrintSummary` all keep writing to their original ids.
- **Legacy summary cards retained (hidden)** so `updateCards(p)` keeps writing to `sum-capital` / `sum-gross` / `sum-net` / `sum-gap` without breakage while the new outcome strip takes the visible role.
- **Chart.js plugins are inline**. `shortfallShadingPlugin` is defined in the IIFE and passed to the Income chart's `plugins` array — no external plugin dependency.
- **Baseline is a JSON deep-clone** of the current `project()` output. Stored only in memory; cleared on `Clear baseline` or overwritten on `Re-lock as new baseline`. No persistence across reloads by design.

**Follow-ups**
- Browser walk-through (Chrome, Safari, Firefox print preview) with a non-trivial income schedule and capital events.
- Offline smoke test: disable network, reload, confirm system-font fallback reads acceptably.
- The `Solve to target` inline panel in State 3 is still a legacy `btn-solve` button inside shared chrome — per the plan, the proper inline panel is out of scope.
- Dead CSS from the old layout (`.header`, `.brand`, `.brand-mark`, `.title-block`, `.client-bar`, `.hp-row`, `.hp-field`) remains in the stylesheet. Harmless but could be pruned in a follow-up.
- Narrative sentence selection is canned + basic. A future pass could personalise more aggressively based on `an.laCapAge` vs `an.discExhaustAge` orderings.
- Income chart scales the need line from `series.target[i]` per-year. For Real mode this is flat (matches the design). For Nominal mode it rises with CPI and the "target need" reads as a shallow upward curve — intended.

---

## Session 3 — 2026-04-23 (PR 3)

**Built / changed** on branch `pr-3-changes`:
- **Refresh always lands on State 1.** `appState` default flipped from `'single'` to `'empty'`; `localStorage` read+write removed from `setAppState` and init. Initial DOM `is-hidden` swapped: `#state-empty` starts visible, `#state-single` starts hidden. Print flow (`beforeprint` forces `single`, `afterprint` restores) untouched and verified.
- **Print-summary leaked onto State 1.** Cause: `#print-summary` was a top-level sibling, not nested inside `#state-single` as the docs implied. Moved the entire block inside `#state-single` (just above its closing `</section>`). It now only renders on screen in single mode; print still works because `@media print` already forces `#state-single` visible regardless of on-screen state. Side effect: print-summary no longer shows on State 3 (Compare) — intentional, Compare is a side-by-side view, not a print-ready scenario.
- **State 1 headline reworded.** `A plan for ___ family, living off R___ a month.` → `A retirement income plan for the ___ family.` Dropped the `#hl-monthly-empty` `contenteditable` span and the entire `hlMonthly`/`needsMonthly` bidirectional sync block in init. The monthly figure is now sourced solely from the `#needs-monthly` input in the household-needs strip.
- **Income chart defaults to Nominal.** `var mode = 'real'` → `'nominal'`. Toggle `class="on"` and `aria-selected` swapped on both `#btn-real`/`#btn-nom` (State 2) and `#btn-real-c`/`#btn-nom-c` (State 3) so initial visual state matches.
- **Income target as box outlines, not a smoothed line.** New inline `targetBoxPlugin` (afterDatasetsDraw) draws per-year dashed coral rectangles from y=0 to y=`series.target[i]`, sized to the bar slot's width minus a 0.18 inset to align with bar edges. The original `line` dataset is retained (transparent border, zero width) so legend toggle, tooltips, and `shortfallShadingPlugin`'s `target.data[i]` access still work. Plugin order is `[targetBoxPlugin, shortfallShadingPlugin]` so the coral wash + dashed vertical paint over the box outline in shortfall years.
- **Auto-top-up default.** Verified — already OFF on disk (no `checked` attr, both pills `aria-checked="false"`, no init JS flips it). No change needed.

**Architectural decisions**
- **Engine still untouched.** No changes to `project()`, `solveTopUp`, `stepPerson`, tax helpers, or any series math. Tests confirm: 77/77 Python + 16/16 JS pass after the change.
- **Box plugin keeps the dataset.** Tempting to remove the now-invisible `line` dataset entirely, but it carries the per-year target values that both the new box plugin and the existing shortfall plugin read via `chart.data.datasets[3].data[i]`. Keeping it as a transparent line is the smallest delta and preserves legend semantics.
- **localStorage write removed entirely** rather than left in place "just in case". Stale keys in users' browsers are inert (no read path consumes them).

**Follow-ups**
- Browser walk-through across Chrome / Safari / Firefox: confirm box outlines render correctly at all zoom levels and bar widths; confirm refresh on State 2/3 always lands on State 1.
- Print preview with a populated scenario: verify the print-summary still appears on its own page and the methodology + disclaimer are intact.
- The `setMode()` function still only updates `#btn-real`/`#btn-nom`, not the `-c` pair. State 3's manual sync handlers cover the click case but the two pairs can drift if `setMode` is called from elsewhere. Out of scope for this PR; worth a follow-up if the plan-bar's mode pill ever gets shared logic.

---

## Session 4 — 2026-04-23 (export-report-redesign)

**Built / changed** on branch `export-report-redesign`:
- **New deliverable: `retirement_drawdown_report.html`.** Single self-contained file (~2000 lines, no build, no external runtime deps beyond Google Fonts). 12 fixed slides (cover, answer, household, assumptions, four levers, projection, capital, Y1 tax, year-table, methodology, compliance, next steps) plus 2 conditional slides (capital events when `plan.capitalEvents.length > 0`; compare when `plan.baseline != null`). A4 landscape, 1588 × 1123 px design size, one slide per printed page via `@page { size: A4 landscape; margin: 0 }`.
- **Three inline-SVG chart renderers** in the report file: `renderIncomeChart` (stacked bars LA + disc + other vs dashed coral need line + coral-pale shortfall wash), `renderCapitalChart` (stacked balances + dashed withdrawal-rate polyline on right axis 0–20% + LA-ceiling dashed vertical + depletion wash), `renderTimeline` (vertical spine for the events slide). Vanilla SVG, no Chart.js — keeps print output crisp and avoids dragging the calculator's chart dependency into the report.
- **Snapshot serialisation in the calculator.** New `buildReportSnapshot()` reads inputs + runs `project()` and emits `{schemaVersion, plan, projection}`. The plan side carries `{familyName, preparedFor, preparedOn, adviser, spouses, monthlyNeed, annualLumpSums, returnPct, cpiPct, autoTopUp, capitalEvents, baseline}`. The projection side carries pre-computed `rows[]` in the report's expected shape, plus derived milestones `{sustainableTo, depletesAt, laCapHitAt, discExhaustsAt}` and per-spouse Y1 tax. Per-spouse "other income" is filtered to streams active in year 1 (`spouseAge ∈ [startAge, startAge+duration)`) and converted to today's-money monthly. Capital events: `year (years-from-now) → year (absolute = currentYear + ev.year - 1)`, amount in today's money.
- **Export report button** in State 2's canvas-head action cluster (between the Real|Nominal segmented and the existing Print button). On click: `localStorage.setItem('sw-drawdown-snapshot', ...)`, `window.open('retirement_drawdown_report.html', '_blank')`. The report auto-prints on load (suppressed with `?noprint` for iteration). Empty-state banner shows if the snapshot is missing.

**Architectural decisions**
- **Report does NO math.** The calculator's `project()` is the single source of truth — its output is serialised verbatim into the snapshot, and the report formats and renders. This honours the "math is auditable" rule (one engine, one test suite) and means SARS-table updates only need to touch the calculator. The prototype's `data.js` shipped a simplified projection; we deliberately do not use it.
- **Two single files, not a build.** Both deliverables stay double-clickable, offline, no bundler. The report's only external resource is Google Fonts (with system-font fallback) and the calculator's only external resource remains Chart.js from CDN. The prototype's split into `report.css` + `slides.css` + `binder.js` + `charts.js` + `deck-stage.js` was inlined into one HTML file.
- **No `deck-stage` web component.** The prototype shipped a keyboard-nav + scaling component for dev preview. Pierre's workflow is open → print → close, so the report ships with a simple vertical scroll instead. Removed ~620 lines of optional chrome.
- **localStorage is the snapshot transport.** Same pattern as the prototype's design intent. Survives the new-tab open. Stale snapshots from prior exports get overwritten on each Export click. No persistence across browser profile clears (acceptable — the calculator can always re-export).
- **Engine untouched.** `project()`, `solveTopUp`, `stepPerson`, tax helpers, `solveLARate`: all unchanged. Tests confirm 77/77 Python + 16/16 JS still pass.

**Follow-ups**
- Browser walkthrough across Chrome / Safari / Firefox: verify all 12 slides render correctly with realistic numbers, conditional slides drop when absent, and Cmd+P print preview produces clean A4 landscape pages. Safari is documented as misreporting `@page size: A4 landscape` — Chrome/Edge are the supported export targets.
- Capital-event labels: the calculator's `eventsStore` items have no `label` field. Snapshot synthesises a generic "Capital event" string. If Pierre wants editable labels, add a label input next to the existing year/amount/spouse on the events ledger.
- Outflow events: the calculator only supports positive `amountPV`. The report's events ledger / timeline already handles negative amounts (signed colour, `−` prefix), so adding outflows is a one-line tweak in the calc's events form if desired.
- "Other income" labels on the household slide: comes through from `incomeStore[i].label`. Already user-editable.
- The prototype's compare slide showed extra meta rows (LA draw rate · yr 1, Disc draw · yr 1) with inline italic deltas. Trimmed to monthly need + return·CPI to keep the slide honest with what the snapshot carries (the calc only stores a deep-clone of `project()` for the baseline, no intermediate aggregates). Could be re-introduced by enriching the baseline payload.
- Auto-print fires 600 ms after load to give the SVG charts time to paint. If clients on slower machines see blank charts in the print preview, bump the delay or wait on `requestAnimationFrame`.

---

## Session 5 — 2026-04-23 (fix/state-2-3-charts)

**Built / changed** on branch `fix/state-2-3-charts`:
- **Income-chart bars now show net-to-bank with a Tax slice on top (Option B).** The existing 3 stacked datasets (LA, Disc, Other) are shrunk by their proportional share of household tax; a new 5th dataset "Tax" (mute grey `#7a8292`, `order: -1`, `stack: 'income'`) stacks on top to restore the bar to gross height. Target line now meets the top of the colored (net) portion when the auto-top-up solver is on-target instead of sitting below the gross-bar tops. Apportionment: `laShare = tax × (la / (la + other))`, `otherShare = tax × (other / (la + other))`; Disc left at gross (CGT-inclusion tax is a small fraction and lumped into the household total). New "Tax" button in the income legend.
- **Target need rendered as a stepped top line instead of per-year rectangles.** `targetBoxPlugin` was rewritten: single `ctx.beginPath()` pass with each year's horizontal segment spanning the full x-slot (no inset) so adjacent years touch at the slot boundary, vertical step segments only where `target[i+1] !== target[i]`, zero-target years break the path. No more left/right sides, no bottom edges, no hairlines from the x-axis. Real mode → flat line; Nominal mode → staircase rising with CPI.
- **State 3 Compare now shows mini income charts per card.** The compare cards previously had empty `<div>` shells despite the export report rendering charts into same-named containers. Added `<canvas id="cmp-chart-baseline">` and `<canvas id="cmp-chart-scenario">` inside the cards (wrapped in a new `.compare-mini-chart { height: 180px }` div; baseline wrapper at `opacity: 0.55` to read as "locked"). New `buildCompareMiniChart(which, p)` builds a tooltipless, y-tickless Chart.js instance with the same 5-dataset stack as the main chart, reusing `targetBoxPlugin` + `shortfallShadingPlugin`. `refresh()` calls it for both sides when `appState === 'compare'`: baseline reads the locked `baseline` snapshot, scenario reads the live `project()`.
- **State 1 polish.** The family-name headline was one big `contenteditable` around "the Mitchell family", letting advisers accidentally delete "the" or "family". Restructured to `"A retirement income plan for the <span>Surname</span> family."` — only the surname span is editable. Default value removed; span loads empty so `.editable:empty::before` paints the em-dash placeholder. Spouse name inputs default from "Marilyn"/"James" to empty with placeholders "Spouse A"/"Spouse B"; `getName()` already falls back to those strings, so downstream labels read sensibly until a real name is typed.

**Architectural decisions**
- **Tax apportionment is proportional, not exact.** The calculator computes a single household tax total per year; attributing it to specific sources requires apportionment. Using `gross-share × tax` on LA + Other (treating Disc as tax-free at the bar level) is a deliberate simplification — the bar TOTAL still equals gross, and the target line still meets the top of the net portion when on-target. The small CGT-inclusion mis-attribution (at most ~18% of disc-gain tax, itself a small share) lands on LA + Other. A per-source tax breakdown would require a new per-year series on `project()` output; out of scope.
- **Mini Compare charts reuse the main plugins.** `targetBoxPlugin` and `shortfallShadingPlugin` are dataset-index-agnostic as long as the 5-dataset layout matches, so both the main and mini charts share plugin code. No duplication.
- **Option B chosen over Option A (net-only bars).** B surfaces the tax bite visually, which is the point of the calculator for a FAIS adviser. If B reads poorly in a client meeting, swapping to A is a ~5-line change (remove the Tax dataset and the apportionment can be reverted; bars become net-only with a gap to the gross). Documented for future reference.
- **No engine changes.** 77/77 Python + 16/16 JS still pass. `project()` already exposed `nominal.tax` / `real.tax` per year; `incomeBarSeries` just reads it.

**Follow-ups**
- Pre-existing bug uncovered during investigation: the series-toggle click handler routes keys by name through `INCOME_KEYS` / `CAPITAL_KEYS`, and the income legend's `la`/`disc`/`other` buttons route to the Capital side (overlapping keys) — so clicking "LA draw" / "Discretionary" / "Other income" in the income legend silently does nothing. Only the new "Tax" button and the existing "Target need" button route correctly. Not user-reported yet; separate fix when it is.
- Watch whether Option B's Tax slice dominates in high-tax years (e.g., large LA draws at age 90). If the visual reads "most of my income is tax" for a stretch of years, a tweaked colour or a subtler hatching might be warranted.

---

## Session 6 — 2026-04-23 (feat/post-merge-iteration)

**Built / changed** on branch `feat/post-merge-iteration`:
- **Target-need line is now solid and bold.** `targetBoxPlugin` previously stroked the stepped path with `lineWidth: 1` + `setLineDash([3,3])`; both were too quiet for a 2m meeting-table read. Changed to `lineWidth: 2.5` with no dash (plus explicit `lineJoin: 'miter'` / `lineCap: 'butt'` to keep the step corners crisp). Path geometry is unchanged — still horizontal per-year segments spanning the full x-slot, joined by vertical steps only where the target changes. Same plugin is consumed by `buildIncomeChart` and both State-3 `buildCompareMiniChart` calls, so one edit covers State 2 + State 3 mini charts.
- **Tax slice is now dusty-rose pink.** New `--pink: #d27a88` token in `:root`; three `backgroundColor` references swapped: the Income-chart Tax dataset (index 4), the Compare mini chart Tax dataset, and the HTML legend swatch. The mute grey `#7a8292` remains the `--mute` colour for axis ticks elsewhere (semantically "mute text", not "tax" — deliberately untouched).
- **Return slider floor widened to 2%.** `#return` was `min="4" max="15"`; now `min="2" max="15"`. The 2% floor was the adviser's chosen realistic minimum for stress-testing (rejected 0% as too unrealistic).
- **State 3 scenario levers — new Scenario-adjustments block in `#shared-chrome`.** Previously only per-spouse LA rate + disc draw were accessible from Compare; advisers had to bounce back to State 1 to change markets, needs, events. New block sits above "Drawdown levers" and contains: `#return-c` slider (range 2–15, mirrors `#return`), `#needs-monthly-c` + `#needs-lump-c` currency inputs, and two collapsible sub-sections housing `#incomes-list-c` / `#events-list-c` with dedicated `#incomes-add-c` / `#events-add-c` buttons. `@media print { .scenario-adjust { display: none !important; } }` keeps it off paper. The collapsible pattern in the stylesheet (`.section-header.collapsible` + `.collapsible-body`) was previously defined but unused — this is its first consumer.
- **Bi-directional sync for scalar scenario inputs.** New `scenarioSyncPairs` array in the IIFE wires `#return ↔ #return-c`, `#needs-monthly ↔ #needs-monthly-c`, `#needs-lump ↔ #needs-lump-c`. Canonical → mirror on `input` (and `blur` for currency, to pick up post-`formatCurrencyInput` reformats). Mirror → canonical on `input` + `blur`, then `refresh()`. `updateLeverLabels()` also writes to `#return-c-out` so the mirror's val-span stays in sync. No engine change — `project()` continues reading only from the canonical IDs.
- **Dual-render for the store-backed ledgers.** `renderEvents()` and `renderIncomes()` now paint BOTH `#events-list`/`#events-list-c` (and `#incomes-list`/`#incomes-list-c`) from the same in-memory store in a single pass. Delegated handlers (input/change/click/blur) are factored into named functions and attached to every host, so editing from either side mutates the same store. `setAppState()` was extended to call both renderers on every state transition — belt-and-braces against any desync while a hidden side held stale HTML.

**Architectural decisions**
- **Mirror over move.** Considered moving the setup inputs out of `#state-empty` into `#shared-chrome` (single source of truth). Rejected because Session 5 had just iterated on State 1's layout, and `#shared-chrome` is explicitly hidden in State 1. Two-way sync with `-c` suffixes keeps both layouts intact. `project()` reads from canonical IDs only — one engine contract, unchanged.
- **Same store, dual host.** The in-memory `eventsStore` / `incomeStore` arrays are the authoritative source for the ledger rows. Both lists render from the same store; edits from either side mutate the same backing array. No duplication of state, only of DOM.
- **No CPI mirror in the Scenario-adjustments block.** The adviser explicitly asked for Return only. CPI stays editable from State 1; a CPI mirror would add surface without a concrete meeting-time use case. Easy to add later if the brief changes.
- **Engine still untouched.** 77/77 Python + 16/16 JS pass. Session 5 already validated the Option-B tax apportionment and `targetBoxPlugin` path geometry; those untouched.

**Follow-ups**
- Browser walkthrough: move sliders, type in currency fields, add/delete an income stream and a capital event from State 3, switch to State 1 — confirm both sides stay consistent. Print preview from State 2 to confirm the Scenario-adjustments block is hidden on paper.
- Pre-existing income-legend-routing bug from Session 5 (LA/Disc/Other buttons in the income legend route through `CAPITAL_KEYS`) is still open — independent of this change.
- The `.collapsible-body` CSS transitions `max-height` but doesn't set a numeric expanded max — it falls back to `none`, so expansion snaps open without animation. Could add an explicit max-height via JS for a smoother reveal, but the snap is acceptable and keeps the code minimal.

---

## Session 7 — 2026-04-23 (feat/next-iteration)

**Built / changed** on branch `feat/next-iteration` — all UI / copy, no engine changes:
- **Tax slice now stacks on top of the income bars.** `buildIncomeChart` and `buildCompareMiniChart` previously set explicit `order: 3 / 2 / 1 / 0 / -1` on the five datasets. Chart.js treats `order` as both draw-order and stack-order, so Tax at `order: -1` was drawn first → visually at the BOTTOM of each bar. CLAUDE.md's own docs claimed "stacking follows array order, so Tax caps the top" — true only when `order` is absent. Fix: removed every `order:` property from both chart builders so array-index stacking takes over (LA[0] at bottom, Tax[4] on top). Matches the documented intent.
- **Income-legend pills all toggle correctly.** Long-standing Session-5 bug: the `.series-toggle` click handler routed by `data-series` key through two lookup objects, `CAPITAL_KEYS = {la, disc, rate}` and a stale `INCOME_KEYS = {gross, tax, net, target}`. Income-legend buttons have `data-series="la" | "disc" | "other" | "tax" | "target"` — `la` and `disc` collided with `CAPITAL_KEYS` → wrong branch → toggled an invisible chart; `other` matched neither set → silent no-op. Rewrote the handler to discriminate on the parent legend container (`btn.closest('#legend-income')`) instead of the key name, and destroy the relevant chart so `refresh()` rebuilds it with the new `hidden` state. All five income pills and all three capital pills now work.
- **Real | Nominal moved to the chart-controls row.** Was in `.canvas-head-actions` alongside Auto-top-up / Export / Print / Lock-baseline; moved into `.controls-row` on the right, with Income | Capital | Table on the left. `.controls-row` was already `flex; justify-content: space-between; align-items: center;` — no CSS change. `#btn-real` / `#btn-nom` IDs unchanged, `setMode()` wiring untouched.
- **Print buttons removed.** Deleted both `Print ↓` (top, canvas-head) and `One-page summary ↓` (bottom, canvas-foot). The browser's Cmd+P still works via the untouched `@media print` rules + `beforeprint`/`afterprint` listeners. Export report is the canonical client-PDF path now.
- **"Scenario adjustments" → "Financial levers"** (single `section-header` text change at `#shared-chrome`). CSS class `.scenario-adjust` is retained to avoid selector churn; ARCHITECTURE + DESIGN docs call out the heading/class split.
- **Removed the "Is this sustainable?" narrative card.** HTML block, `updateNarrative()` function, and `refresh()` call site all deleted. Dead `.narrative-*` CSS selectors remain in the stylesheet — noted in `TECH_DEBT.md` for a later sweep per the "don't reformat the whole file" rule.
- **State-2 main headline reworded.** Was `"R X a month is sustainable/stretched until age N."`; now `"Your desired lifestyle is projected to cost R X per month. Based on current assumptions, this is sustainable until age N."` The word "sustainable" is now static — per the adviser's steer, the heading states a fact (the projected age) and the client decides what to make of it. `#hl-verdict` span removed; `updateHeadline()` trimmed to drop the verdict word-swap.

**Architectural decisions**
- **Array-index stacking over explicit `order`.** Removing `order:` is the smaller delta and matches what the docs already claimed. Keeping the explicit values but inverting them would have been symmetrical but more brittle — every future change to the dataset list would need a matching re-inversion of `order` numbers.
- **Discriminate toggles by parent container, not by key rename.** Renaming `data-series` values (e.g. `income-la`, `capital-la`) would have fixed the collision but rippled into styling selectors, ARIA wiring, and the two legends that have to stay cosmetically identical. `btn.closest('#legend-income')` is one line and localises the fix.
- **Static "sustainable" in the headline.** Considered the verdict-based stretched/sustainable swap, rejected after the adviser's steer. The outcome strip and chart already carry the verdict signal (teal vs plain navy primary cell, coral shortfall wash). Two signals is enough; three is preachy.
- **Engine untouched.** 77/77 Python + 16/16 JS pass. No projection / tax / solver code touched.

**Follow-ups**
- Dead `.narrative-*` CSS (5 selectors) ready for a broom-sweep pass — entry logged in `TECH_DEBT.md`.
- `.collapsible-body` max-height snap (Session 6 follow-up) is still open; documented in `TECH_DEBT.md` — cosmetic only.

---

## Session 8 — 2026-04-23 (fix/income-bar-apportionment)

**Built / changed** on branch `fix/income-bar-apportionment` — two correctness fixes:

1. **Income-bar tax apportionment now includes Disc.** The adviser spotted that in shortfall years the chart's coral gap between bar-top and target line was smaller than the real shortfall. Root cause: `incomeBarSeries()` computed `taxableBase = laDisp + otherDisp` and pushed `disc.push(discDisp)` at gross — meaning the full household tax (which already includes CGT on disc gains) was apportioned only across LA and Other, and Disc carried zero share. The colored stack therefore equalled `laGross + discGross + otherGross − (laShare + otherShare)` = `gross − tax + discShare`, sitting ABOVE the true net-to-bank by the disc CGT contribution. Fixed by changing `taxableBase` to `laDisp + discDisp + otherDisp` and subtracting each source's proportional share. Bar total now equals gross exactly; colored sum equals true net; on-target years land the colored top on the target line; shortfall years show the real shortfall in the coral wash.

2. **Trimmed the above-the-chart area on State 2.** The editorial 44px headline and the subtitle paragraph duplicated what the outcome strip already shows (target-met age, Y1 need, funded-by mix) and what the chart alert chips say about shortfalls / LA cap. Deleted both from the HTML at `retirement_drawdown.html:1964–1987`; `updateHeadline()` trimmed to only write the eyebrow (the monthly / age / sub branches are gone). Eyebrow + outcome strip + action cluster now carry the summary in one compact band. Saves ~200px of vertical real estate — on a 13" laptop the income chart lands above the fold and the Financial-levers block is a short scroll instead of a long one. The canvas-head's `display: flex; align-items: flex-end;` collapses gracefully as the left side shrinks to just the eyebrow; no CSS change needed.

3. **17.5% LA-cap flag now fires when auto-top-up is on.** Audit finding: `stepPerson`'s cap detection uses strict `target > laCeil`. In auto-top-up mode, `solveTopUp` pre-clamps the target to `ceil` exactly (Phase 1) or boosts LA up to `ceil` (Phase 3). `project()` was then calling `stepPerson(sA, rNom, topup.laDrawA)` with `target === ceil`; the strict `>` check missed the equality → flag stayed `'ok'`. Result: the `"Both LAs at 17.5% ceiling from age X"` alert and the ▲ markers in the year-table **never fired when auto-top-up was on**, regardless of how pinned the household was to the cap. `solveTopUp`'s own Phase-1 clampLA helper and Phase-3 boost tracker both set `clampA = 'cap'` correctly — those flags were being computed and discarded. Fix: thread `topup.clampA` / `topup.clampB` into `clampA_series` when auto-top-up is on; fall back to `stepPerson`'s flag otherwise. Non-auto-top-up mode still catches strict-`>` cases (CPI-escalated user-fixed rate pushing above 17.5% as balance depletes). Mirrored in the Python port (`conftest.project()`) + a new `tests/python/test_cap_flag_propagation.py` (4 tests) guards the Phase-1 cap, the Phase-3 cap, and the non-auto-top-up path.

**Architectural decisions**
- **Three-way apportionment over CGT-specific attribution.** Considered splitting the household tax into income-tax and CGT components and attributing CGT specifically to Disc, but `project()` only exposes a single `nominal.tax[i]` / `real.tax[i]` scalar per year. Breaking that apart would widen the engine's contract for a presentation concern. Proportional three-way apportionment is a ~3-line change in `incomeBarSeries()` with the correct visual invariants (colored = net = target when on-target).
- **Solver-authoritative clamp flag (auto-top-up mode).** Considered loosening `stepPerson` to `target >= ceil` (one-char diff) but rejected: the "at-cap-by-user-choice" case (non-auto-top-up, user sets rate=17.5% directly) should still flag correctly, and `stepPerson`'s strict semantic means "I was forced down". The solver already distinguishes "pre-clamped to ceil" (Phase 1, forced) from "boosted to ceil" (Phase 3, pinned). Using its flag keeps the semantic precise and leaves stepPerson's contract intact.
- **Engine untouched.** 81/81 Python + 16/16 JS pass. No projection, tax, solver, or clamp-math change; only the flag that feeds alerts/table markers is now authoritative.

**Follow-ups**
- The Y1 summary card and tax panel already read from `p.taxA` / `p.taxB` directly (not the bar series), so they're unaffected by either fix.

---

## Session 9 — 2026-04-23 (refactor/shrink-above-chart)

**Built / changed** on branch `refactor/shrink-above-chart` — further tightening of State 2's above-chart area:
- **Removed the eyebrow.** `SUSTAINABILITY PROJECTION · FUTURE RANDS` was semantically redundant: the Real|Nominal toggle on the chart-controls row signals the mode, and the plan-bar-lite already names the product ("Simple Wealth · Retirement Drawdown"). Deleted `<div class="eyebrow canvas-head-eyebrow" id="hl-eyebrow">` and the `.canvas-head-left` wrapper. `updateHeadline()` (the one-line function introduced in Session 8 after the headline/subtitle delete) is now gone entirely; the call site in `refresh()` is removed too.
- **Canvas-head is action-cluster only.** With the left side empty, `.canvas-head`'s `justify-content: space-between` would push the single remaining child (`.canvas-head-actions`) to the left. Added `margin-left: auto` to `.canvas-head-actions` so it stays right-aligned in State 2 and still works in State 3 (where the canvas-head-left wrapper remains for the "What if we nudge the levers?" headline).
- **Shrunk the outcome strip.** Padding `18px 22px → 14px 20px`; gap between rows `6px → 4px`; `.oval` font `28px → 22px`; `.oval .num-italic` `34px → 26px`; `.oval .unit` `14px → 12px`; `.oval.split` `18px → 15px`; `.osub` `11px → 10px`. Each cell ~25–30px shorter. All three cells retain their label / value / sub structure; nothing dropped.

**Architectural decisions**
- **Remove eyebrow over shrink.** The user asked for "less tall and contain much less info" — removing entirely is the limit of that ask, and the mode signal is already carried by the Real|Nominal toggle. Shrinking the eyebrow but keeping it would have added nothing: it named a section ("Sustainability projection") that the rest of the page already is.
- **`margin-left: auto` over changing `justify-content`.** `.canvas-head` is shared with State 3's `.canvas-head.compact` (where both a left wrapper and action cluster exist). Changing the parent rule would have rippled. Adding `margin-left: auto` to the right child is flex-container-agnostic and doesn't break the two-child State 3 layout.
- **Tighten rather than delete outcome-strip rows.** The `.osub` lines carry real content for the primary cell ("shortfall emerges before the horizon" / "youngest spouse · target fully met"). Keeping all three rows on all three cells preserves the verdict signal and keeps cell heights consistent in the flex row.
- **Engine untouched.** 81/81 Python + 16/16 JS pass.

**Follow-ups**
- Dead print-CSS selectors `.canvas-head .headline` and `.canvas-head-eyebrow` at `retirement_drawdown.html:915–917` apply to State 2 on paper but reference elements that no longer exist there. State 3 is hidden on paper, so these rules effectively paint nothing. Left in place — same "no broad sweep" principle; bundle with the Session-7 `.narrative-*` and Session-8 `.headline-sub` sweep.

---

## Session 10 — 2026-04-24 (refactor/plan-bar-and-financial-levers)

**Built / changed** on branch `refactor/plan-bar-and-financial-levers` — three State-2 chrome changes, no engine touch:

1. **Plan-bar trimmed.** Deleted the `Household`, `Capital`, and `Target` facts from the `.plan-bar-lite`. The bar is now `[Simple Wealth · Retirement Drawdown] · [Family <surname>] · [Prepared <date>] · [Edit plan ↓]`. Added `#pb-family` span; `updatePlanBarLite()` rewritten to a no-arg helper that reads `#hl-family.textContent` from the State-1 title-plate and writes to `#pb-family`. The call site in `refresh()` passes no argument. Removed `#pb-household` / `#pb-capital` / `#pb-target` DOM + their JS writes.

2. **Auto-top-up pill moved to the chart-controls row.** Removed the `<label id="toggle-topup-pill">` from `.canvas-head-actions`; added a new `.controls-row-right { display: inline-flex; gap: 12px; }` cluster on the right side of `.controls-row` that houses `[toggle-topup-pill] [Real | Nominal]`. Canvas-head-actions is now just `[Export report] [Lock as baseline]`. Existing click/keydown handlers bind by ID, so the wiring is unchanged.

3. **Drawdown levers folded into Financial levers at the top.** The per-spouse LA-rate / disc-draw sliders + `Solve LA rates to target` button moved from their standalone location between `.scenario-adjust` and the tax panel into `.scenario-adjust` as the first content block after the `Financial levers` heading. New wrapper class `.drawdown-levers-inline`; sub-heading class `.drawdown-levers-head` styled `flex; justify-content: space-between` to keep the Solve button right-docked. The following `Expected nominal return` row gained a `.scenario-adjust-row-divider` utility (margin-top + padding-top + hairline border-top) so the boundary reads as a clean section break. All spouse/slider IDs preserved — `project()`, `updateLeverLabels()`, `scenarioSyncPairs`, and every binding still point at the same elements.

**Architectural decisions**
- **`#hl-family` drives the plan-bar surname.** State 1's title-plate span is already the canonical surname input (the editorial `"A retirement income plan for the <span>___</span> family."`). Duplicating it into a plan-bar input would have required a second edit site + bi-directional sync. Reading `textContent` on every refresh is simpler and cheap — the span's content mutates only during setAppState flips from State 1, which always trigger refresh.
- **Controls-row-right as a cluster instead of two independent right-aligned children.** Could have added both the pill and the Real|Nominal seg as direct children of `.controls-row` with `margin-left: auto` on each, but that can split them across wraps on narrow viewports. A shared `inline-flex` cluster keeps them glued together and still wraps to the next line as one unit when space is tight.
- **Drawdown-levers on paper preserved.** `.scenario-adjust { display: none !important; }` on print would have dropped the drawdown sliders from the printed PDF — a regression. Replaced the single blanket rule with a targeted pattern: the container chrome goes transparent and `.scenario-adjust > .section-header, > .scenario-adjust-row, > .sub-section` are `display: none !important`, but `.drawdown-levers-inline` stays visible. Net paper output matches pre-Session-10 behaviour — strategy-board chrome hidden, spouse slider cards survive above the tax panel.
- **Engine untouched.** 81/81 Python + 16/16 JS pass. No changes to `project()`, `solveTopUp`, `stepPerson`, tax helpers, or any series math.

**Follow-ups**
- Browser walkthrough: confirm the plan-bar sits on one line (wrapping was only caused by the 5-item strip); verify the auto-top-up pill aligns with the Real|Nominal toggle on the right of the chart-controls row; verify the drawdown spouse cards render correctly inside the Financial levers white card (the nested `.levers` cards have their own hairline borders — may read as double-bordered; not a regression but worth an eye).
- Print preview with a populated scenario: confirm drawdown-levers sliders still render on paper and the Financial-levers container chrome (heading, return slider, collapsibles) is hidden.
- The `contenteditable` surname edits don't trigger `refresh()` — they flow through the state-flip on "Build the projection". If Pierre starts using State 2 in a workflow where he edits the surname on State 1 without flipping, the plan-bar will lag until the next refresh trigger. An `input` listener on `#hl-family` calling `updatePlanBarLite()` would close the gap (~3 lines). Holding off for now since the State-1 → State-2 flow already refreshes.

---

## Session 11 — 2026-04-24 (refactor/state-2-chrome-consolidation)

**Built / changed** on branch `refactor/state-2-chrome-consolidation` — another State-2 chrome consolidation pass plus two State-1 simplifications, no engine touch:

1. **Export report moved into the plan-bar-lite.** `Export report →` now lives on the right side of the top-nav bar alongside `Edit plan ↓`, inside a new `.plan-bar-lite-actions` wrapper (`inline-flex`, 10px gap). The canvas-head is retired entirely on State 2 — both actions it previously held are relocated. The plan-bar also gained an `18px` top margin so it doesn't butt against the browser chrome.

2. **Lock as baseline moved onto the chart-controls row.** Joins the `.controls-row-right` cluster alongside `Auto-top-up` and `Real | Nominal`. The row now reads left-to-right: `[Income | Capital | Table] ... [Auto-top-up] [Real | Nominal] [Lock as baseline →]`. Lock is a scenario-level CTA — freezing the current `project()` into a baseline snapshot is conceptually a chart/scenario action, not plan navigation, so the controls row is the semantically correct home. Plan-level navigation (Export, Edit) lives on the plan-bar; chart/scenario actions live on the controls row.

3. **State-2 canvas-head removed.** With both buttons moved out, the `<div class="canvas-head">` + `.canvas-head-actions` divs were deleted from `#state-single` entirely. The outcome strip sits directly under the plan-bar. State 3's `.canvas-head.compact` variant is untouched — its rules remain live for the Compare view's headline.

4. **State 1 CTA trimmed to just the button.** The navy CTA bar's left column (`empty-cta-eyebrow` + `empty-cta-sub` copy) was deleted; `.empty-cta` restyled from a navy bar with space-between flex to a simple centered-flex container. The "Ready to see if this lifestyle is sustainable?" eyebrow and the "year-by-year projection across both spouses..." sub-paragraph are gone — the editorial title-plate above already names what the calculator does. `.empty-cta-eyebrow` / `.empty-cta-sub` CSS selectors are orphaned but left in place per the "no broad sweep" principle.

5. **State 1 auto-top-up toggle + client-meta row removed from view.** The `<label class="empty-topup-label">` block (with the long explanatory paragraph) and the `<div class="empty-meta">` row (Prepared for / Meeting date / Adviser) are gone from the UI. The underlying inputs — `#needs-topup`, `#client-name`, `#client-date`, `#adviser-name` — are preserved as `hidden` inputs with their original default values so the engine, print summary, and export-report snapshot all keep reading them. Auto-top-up is now toggled exclusively from the State-2 chart-controls pill; `#client-date` is still auto-filled with today's date during init.

6. **`setAppState` scrolls to top on every transition.** Browsers keep the scroll position across `display` swaps, which landed the user near the bottom of State 2 after clicking `Build the projection →` on State 1 (because `#state-single` is much taller than `#state-empty`). Added `window.scrollTo(0, 0)` at the end of `setAppState()` so every state change gives the user a top-of-page read. Wrapped in `try/catch` for belt-and-braces against scroll-restoration quirks.

**Architectural decisions**
- **Plan-bar as top-nav.** State 2 now has a single chrome row at the top — the plan-bar doubles as the app bar. Combining identity (brand + family + date) with navigation/actions (Export + Edit) in one horizontal strip matches private-bank research-note conventions and reclaims the vertical real estate the canvas-head was holding.
- **Lock on the controls row, not the plan-bar.** Considered Lock on the plan-bar alongside Export/Edit (three ghost+primary buttons together). Rejected because Lock is a scenario-level action that depends on the current projection state, while Export/Edit are plan-level. Keeping the two concerns on separate rows (plan chrome vs chart chrome) is clearer for the adviser and lets each row's spacing stay consistent.
- **Preserve hidden inputs instead of deleting them.** The adviser-facing UI for `#client-name` / `#client-date` / `#adviser-name` was removed, but the values feed the compliance print block and the export-report cover slide. Deleting the inputs would either null those out or require restructuring `updatePrintSummary` / `buildReportSnapshot`. Hidden inputs with the original defaults are a minimal delta and preserve downstream behaviour.
- **Scroll-reset in `setAppState`, not just the Build-projection handler.** Every state transition can trigger the behaviour (Edit plan → Empty, Lock as baseline → Compare, Back to Empty from Compare). Centralising the fix covers all transitions with one line instead of wiring three handlers.
- **Engine untouched.** 81/81 Python + 16/16 JS pass. No changes to `project()`, `solveTopUp`, `stepPerson`, tax helpers, or any series math.

**Follow-ups**
- Browser walkthrough: flip Build → Single → Lock → Compare → Edit → Empty; confirm each transition lands at the top of the page. Confirm Export report still opens the new-tab PDF path. Resize to a narrow viewport and confirm the chart-controls row wraps gracefully (4 items on the right + 1 on the left).
- Print preview with a populated scenario: confirm `#client-name` / `#client-date` / `#adviser-name` values still appear in the compliance block's `Prepared for` / `Meeting date` / `Adviser` rows.
- `.empty-cta-eyebrow`, `.empty-cta-sub`, `.empty-topup-label`, `.empty-meta` CSS selectors + the `.canvas-head` print rules at lines ~915–937 are now orphaned. Bundle the sweep with the Session 7 `.narrative-*` / Session 8 `.headline-sub` / Session 9 `.canvas-head-eyebrow` dead-CSS follow-up in `TECH_DEBT.md`.

---

## Session 12 — 2026-04-24 (fix/income-chart-geometry)

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

---

## Session 13 — 2026-04-24 (feat/chart-dividers-and-target-line)

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
