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

## Session 14 — 2026-04-24 (feat/single-client-mode)

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

## Session 15 — 2026-04-25 (feat/layout-redesign)

**Built / changed** on branch `feat/layout-redesign` — full layout overhaul prompted by adviser testing: scrolling between chart and sliders disrupted meeting flow. Replaced the 3-state `empty/single/compare` flow with a 5-tab nav and pinned live levers as a sticky 240px rail beside a wide chart canvas. Engine untouched (88/88 Python + 19/19 JS).

1. **5-tab top nav** drives `body[data-tab="info|planning|scenarios|comparison|assumptions"]`. Tabs render via `[data-tab-panel]` attribute selectors — one CSS rule per tab hides every panel that doesn't match. Legacy `data-app-state` machinery retired; `setAppState()` survives as a back-compat shim mapping legacy state names to tab names. Tab vocabulary: **Info** (today's State 1, kept as-is), **Planning** (base scenario, rail+canvas), **Scenarios** (lock baseline + play with what-ifs, rail+canvas with two-up), **Comparison Summary** (decision-ready delta readout, new screen), **Assumptions** (methodology + SARS reference, new screen).

2. **Shared rail across Planning + Scenarios.** A single `<aside class="rail">` lives inside `.rail-canvas-shell` (a 2-col grid `[240px 1fr]`) and holds, top to bottom: **Drawdown levers** (per-spouse LA-rate + disc-draw sliders, IDs `la-rate-A/B`, `disc-draw-A/B`, with `Solve to target` button in the head), **Markets** (Return slider `#return-c`, mirror of canonical `#return` on Info), **Spending** (`#needs-monthly-rail` + `#needs-lump-rail` — see point 9 below), **Display** (Auto-top-up pill `#toggle-topup-pill`), **Schedules** (Other income + Capital events as collapsible sub-sections — see point 7), **Lock as baseline →** / **Continue → Summary** CTA pair (visibility CSS swaps which is shown per tab). State-single and state-compare both occupy `grid-column: 2 / row: 1` of the shell; the inactive one hides via tab-panel visibility CSS. **Sticky + internally scrollable**: `align-self: start; position: sticky; top: 14px; max-height: calc(100vh - 40px); overflow-y: auto` so the rail pins beside the chart and only its content scrolls when ledgers are expanded — the page itself never scrolls.

3. **Planning canvas.** Chart-view seg (Income | Capital | Table | Tax) + Real|Nominal seg pinned right on the same row + chart-card. The full Y1 outcome strip (3-cell verdict / Y1 need / Funded-by card) and the compact tax-strip below the chart were both **removed** — the verdict reads from the chart's coral shortfall wash + chart-alerts chip. Hidden span DOM (`#out-age`/`#out-need`/`#out-mix` etc.) survives inside the canvas so `updateOutcomeStrip()` writes are safe no-ops; same trick for `#pb-family`/`#doc-date`/`#btn-export-report` so `updatePlanBarLite()` and the canonical export handler keep working unchanged.

4. **Scenarios canvas.** Lifted `compare-grid` two-up + canvas-head from State 3. Auto-top-up + Real|Nom + clear/re-lock buttons that duplicated the rail dropped (kept `Clear baseline` + `Re-lock baseline` on a slim canvas-head). Mini-chart Tax dataset is constructed with `hidden: true` so the pink Tax slice never appears on Scenarios — adviser sees net-to-bank vs. baseline cleanly without the tax-bite distraction.

5. **Comparison Summary (new).** Static decision page: title eyebrow + today's date, Baseline/Scenario one-line summaries (`R 65k/month · sustainable to 89 · Return 6.5%` style), bulleted Key Changes (computed by new `diffPlanForSummary(baseline, current)` — return Δ, CPI Δ, monthly-need Δ, per-spouse LA-rate Δ, per-spouse disc-draw Δ, capital-events count Δ), verdict line (driven by `analyseProjection`'s `sustainableAge` delta), Export-report-PDF + Re-open-Scenarios CTAs. Empty state when no baseline: copy points back to Planning.

6. **Assumptions (new).** Read-only readouts of live Return / CPI / Auto-top-up + a static SARS 2026/27 reference table (bracket creep, CGT inclusion + exclusion, LA band, rebates) + methodology prose + FSP disclaimer. Read-only because canonical Return + CPI sliders live on Info (and Return on the Planning rail); duplicating them here would have created ID collisions. IDs `asm-return-readout`, `asm-cpi-readout`, `asm-topup-readout`, `asm-start-age`; `updateAssumptionsReadouts(p)` fires only when `activeTab === 'assumptions'`.

7. **Schedules in the rail (collapsibles).** Other income + Capital events live as `<div class="sub-section rail-sub">` with `.section-header.collapsible.collapsed.rail-collapsible` headers + `.collapsible-body.collapsed.rail-collapsible-body` bodies, inside the Schedules section. Both collapsed by default, expand on click. Body capped at `max-height: 240px` with internal scroll. Count badges `#incomes-count-c` / `#events-count-c` in the headers tick live. The dual-host pattern resurrected: `EVENTS_HOSTS = ['events-list', 'events-list-c']` paints both canonical (Info) and rail mirror from the same `eventsStore`. CSS `.rail-ledger .event-row { grid-template-columns: 1fr !important }` stacks the canonical 4-col row into a single column to fit the 240px rail; absolute-positioned `×` delete on each card.

8. **Tax view (4th chart-view button).** `Tax` was added to the `Income | Capital | Table | Tax` seg. The full per-spouse 9-row tax breakdown that previously lived in `#shared-chrome` was moved into the chart-card as `#tax-view-wrap` (sibling of `#chart`, `#chart-income`, `#year-table-wrap`). `setView('tax')` toggles its `display: ''`. Both `#year-table-wrap` and `#tax-view-wrap` are now `position: absolute; inset: 0` inside `.chart-wrap` so they fill the 480px canvas exactly and scroll internally — the older `height: 100%` pattern wasn't reliably anchoring on display swap. With this, `#shared-chrome` is gone entirely (the whole div was deleted; the compact tax-strip below the chart was also retired). `updateTaxPanel()` writes the same `ta-*` / `tb-*` IDs in their new home.

9. **Spending sliders (Monthly need ±R30k, Annual lumps ±R100k).** New section in the rail between Markets and Display. Sliders anchor to the canonical Info-tab values: `setupRailSpendingSlider(canonicalId, sliderId, valueOutId, swing)` reads the canonical text input, sets `slider.min = anchor - swing`, `slider.max = anchor + swing`, `slider.value = anchor`. Drag pushes a formatted value into `#needs-monthly` / `#needs-lump` and calls `refresh()`. Typing on Info re-anchors via `input` + `blur` listeners. Step 500 monthly, 5000 annual. Swing values per Pierre's spec.

10. **`-c` mirror cleanup.** With ledgers + needs editable from a single canonical home (Info) plus a rail mirror (Other income, Capital events), the `#shared-chrome` mirror DOM was deleted: `#needs-monthly-c`, `#needs-lump-c`, and the orphaned hidden tax panel. `scenarioSyncPairs` trimmed to `[['return','return-c']]` (Return is the only scalar that lives in two homes). `renderEvents()` / `renderIncomes()` already guarded `if (h)` per host. Net: ~150 lines of HTML + ~40 lines of sync logic retired.

11. **Page width + chart height.** `.page` max-width `1100px → 1400px` (gives the chart ~300px more horizontal room on a 14" MBP without crowding the margins). `.chart-wrap` height `340px → 480px` (chart now occupies the natural visual centre of the page rather than a small slice).

12. **Print path.** `@media print` hides `.tab-nav` and `.modal-backdrop` (none exist now but rule survives in case modals are reintroduced), forces `[data-tab-panel="planning"]` visible (`display: block !important`), collapses `.rail-canvas-shell` to a single column with `.rail { display: none !important }` so canvas spans full paper width. `beforeprint` stores `activeTab`, forces `setTab('planning')`, resizes charts; `afterprint` restores. Print summary stays nested inside `#state-single`, hidden on screen everywhere via `#print-summary { display: none }`, surfaced only on paper via `@media print { .print-summary { display: block !important; page-break-before: always } }`.

13. **Scroll snap-to-top.** Three layers ensure the viewport always lands at the top of the page on reload + tab switch: (a) `history.scrollRestoration = 'manual'` disables browser scroll-position restoration on cold reload; (b) `html, body { overflow-anchor: none }` disables CSS scroll-anchoring (the browser's reflow-stability feature that pulls the viewport down past the nav when panels swap); (c) `setTab()` triple-fires `window.scrollTo(0,0)` — immediate, next animation frame, and 50ms delayed — to defeat any late layout shifts (Chart.js resize is the typical offender).

**Architectural decisions**
- **Tabs over scroll.** Pierre's original bug was the meeting flow: drag a slider, scroll up to see chart, scroll down to drag again. Tabs partition concerns (setup vs. live vs. compare vs. summary vs. methodology) so each fits a 14" viewport without scrolling.
- **One rail, two tabs.** Settled on a 2-col CSS grid (`.rail-canvas-shell`) that holds rail + both panels overlapping on grid column 2. One DOM, single canonical IDs, no sync, no relocation. Visibility CSS does the rest.
- **Sticky scrollable rail over modal-for-edits.** When ledgers expand the rail can grow past the viewport. Sticky-rail + internal scroll keeps the chart visible while editing.
- **Engine untouched.** 88/88 Python + 19/19 JS pass.

---

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


---

### Session 17 — 2026-04-25 (chore/misc-fixes)

**Built / changed** on branch `chore/misc-fixes` — eleven connected pieces. Engine grew two new concepts (per-item `pctTaxable` split + household goals); tests rise to **108/108 Python + 19/19 JS** (was 88/88 + 19/19).

1. **Plan-health alert pills disabled.** `updateAlerts(p)` (line ~4374) is now a no-op that always hides `#chart-alerts`. Removes the persistent "Both LAs at 17.5% ceiling from age 95" / "Discretionary exhausted" / "Real shortfall" chips. Per Pierre: the chart's coral shortfall wash + the table's clamp markers carry the same signal without the chip clutter.

2. **Auto-top-up pill moved to chart card top-right.** `#toggle-topup-pill` left the rail's "Display" section (which only held this one item, so the rail-divider + section-head went too) and now sits in `.controls-row-right` immediately left of the Real|Nominal seg. Same ID, all `setupTopupPill()` wiring untouched.

3. **Solve-to-target button removed.** `#btn-solve` is gone from the rail. The `solveLARate()` function (line ~4764) is retained as the methodology so it can be re-attached to a control later. Click handler deleted.

4. **Rail "Other income" + "Capital events" promoted to flat headings.** Were nested under a "Schedules" parent with collapsible sub-sections; now top-level `.rail-section-head`s with a small "+" button on the right (id `incomes-add-c` / `events-add-c`). Caret + count badge + collapsible body wrappers + the wide dashed `+ Add ...` footer button — all gone. New `.rail-section-add` button styling for the inline "+".

5. **Modal-driven Add → evolved to category modal.** First pass: a single-entry modal with empty fields + Save/Cancel/Delete (ended the live-bound "every keystroke = refresh" UX). Final pass replaced that with a **category modal**: clicking any rail row OR the section "+" opens the same `#add-modal` element with `.modal-card--wide` (1100px, 85vh max-height), rendering every entry in the category as an editable horizontal grid row (7 fields for incomes, 3 for events, 5 for goals) plus a `+ Add ...` row at the bottom. Save commits all rows in one transaction; Cancel/Esc/backdrop discards. In-progress edits persist across re-renders via `syncStagedFromDOM()`. Per-row `×` deletes from the staged array. The single-entry modal code stays in place but no UI calls it.

6. **`pctTaxable` field end-to-end (engine + tests + UI).** Each income item carries `pctTaxable` (0–100, default 100). The taxable portion enters the tax base; the tax-free portion is cash flow only. Engine: `otherIncomeForYear` returns `{total, taxable, taxFree}`; year loop sets `sA.otherIncome` (= total), `sA.otherTaxable`, `sA.otherTaxFree`; tax-base reads (`solveTopUp.taxFor`, `taxForYear`, year-loop `taxableA/B`) use `otherTaxable`; gross / net / yearDraw use `otherIncome`. Tax view splits "Other taxable income" → two rows: "Other income · taxable" + "Other income · tax-free". Python parity in `conftest.py` + new `tests/python/test_other_income_taxable.py` (9 tests). Backward compat: legacy items without `pctTaxable` default to fully taxable (verified by test).

7. **Goals (recurring household expenses).** New top-level concept: `{label, amountPV, everyNYears, startAge, endAge}`. Household-wide (no spouse field). Lands when youngest age ∈ [startAge, endAge] AND `(age - startAge) % everyN === 0`; nominal escalates by CPI. Engine bumps `yearTargetNom` in qualifying years — the auto-top-up solver pulls more disc / boosts LA to cover, and the chart's target line steps up that year. Python parity (`goals_for_year` in conftest, `goals=` kwarg on `project`) + 11 new tests in `tests/python/test_goals.py`. UI: new "Goals" section in the rail (between Spending and Other income), new ledger on Info tab (3-col grid), modal mode `'goal'` with Label / Amount / Every N years / Start age / End age.

8. **Compact 1-line entry rows in rail + Info ledgers.** `.entry-row` replaced the 7-column inline editor: shows a single summary line (`Travel · R 200 000 · every 5 yr · 65–90` / `Rental · R 60 000/yr · 65–85 · Pierre · 40% taxable`). Click row → opens category modal. `×` deletes inline. Dead inline-edit handlers (`incomesInputHandler`, `eventsBlurHandler`, etc.) removed.

9. **Info-tab widened + ledgers above the fold.** `.empty-canvas` max-width 920px → 1300px (matches Planning width). New `.empty-ledgers` 3-col grid holds Other Income | Capital Events | Goals side-by-side, moved to sit directly below Spouse setup (above Needs/Markets). Orphaned `.empty-events-header` (4-col "When/Event/For whom/Amount") deleted. Responsive: ledgers collapse to 1-col below 820px.

10. **Rail tightened.** `.rail` gap `12px → 6px`; `.rail-section-head`'s `margin-top: 4px` removed (parent gap handles spacing). `.rail-divider` is now half-width (`width: 50%; margin: 4px auto;`) at 0.55 opacity — a faint separator instead of a full hairline.

11. **Shortfall plugin redraw fix.** `incomeChart.update('none')` in `buildIncomeChart`'s early-return path was replaced with `incomeChart.update()` so the `shortfallShadingPlugin`'s `afterDatasetsDraw` reliably re-runs against fresh dataset values; the dashed "shortfall begins · age N" vertical now moves with sliders. Same fix applied to `buildCompareMiniChart` (Scenarios two-up). Legend toggle still uses `update('none')` because that's a visibility flip, not a data refresh.

**Architectural decisions**
- **Math change → Python test first.** Both `pctTaxable` and `goals` started with a failing Python test that captured the desired behaviour, then `conftest.py` + JS landed simultaneously to keep the two implementations in lockstep. Backward compat verified for both: legacy items / `goals=None` produce byte-identical projections.
- **Category modal over per-entry modal.** Pierre wanted to see + edit a whole category in one place rather than opening a modal per row. The wide layout (1100px) accommodates 7 fields per row for incomes; 5–8 rows fit without scroll on a 14" viewport. Save commits all rows in one transaction; nothing touches the live store mid-edit. The per-entry modal code is unused but kept in place — small surface, no harm.
- **`otherIncome` stays as the total field on `sA`.** Could have renamed to `otherTotal`, but every existing reader expects `otherIncome` for gross/net/yearDraw. Adding `otherTaxable` and `otherTaxFree` as siblings keeps the rename diff to zero. The fallback `(p.otherTaxable !== undefined) ? p.otherTaxable : (p.otherIncome || 0)` lets legacy callers (Y1-only tax objects, the synthetic single-mode `pB`) keep working.
- **Goals are anchored on the youngest spouse's age.** Same anchor as the projection horizon. A goal with `startAge: 65, endAge: 90, everyN: 5` lands at the youngest's age 65, 70, 75, 80, 85, 90 — six occurrences. Couple mode and single mode produce the same cadence on the same calendar years.
- **Capital events stay distinct from goals / other income.** Pierre wondered if "every-5-years travel" subsumed capital events. Pushed back: capital events INJECT into `discBalance` + `discBaseCost` and compound; goals BUMP the target need; other income is consumed in the year. Three different operations on the projection. Confirmed with Pierre that capital events model real inheritances/property sales — kept separate.
- **Half-width faint dividers.** Pierre's request after rail spacing was tightened — the full-width hairline became visually heavy when section gaps shrunk to 6px. Centered 50%-width at 55% opacity reads as a subtle break rather than a hard rule.

**Follow-ups**
- Browser walkthrough at 1366×768 (the 14" target): Info → Planning. On Info, confirm 3-col ledgers (Other income | Capital events | Goals) fit above the fold next to Spouse setup. On Planning, click any rail row → category modal opens with all rows editable, click Save → store replaced, chart reflects. Repeat for incomes, events, goals.
- Print preview: `.modal-backdrop` already in `@media print`, so the category modal hides on paper. Confirm the new Goals ledger on Info paginates cleanly with several entries.
- Per-entry modal cleanup: `openAddModal` / `saveAddModal` / `deleteFromAddModal` are unused in UI. Tag for removal in next dead-code sweep alongside the existing `.outcome-strip*`, `.tax-strip-cell` orphans listed in `TECH_DEBT.md`.
- Export-report snapshot consumers (`buildReportSnapshot`): currently only consume `p.taxA` / `p.taxB` (Y1). The new `otherTaxable` / `otherTaxFree` fields ride on the result object's `taxA_objs[i]` so the editorial PDF can surface the split if Pierre ever wants it.
- Goals are not yet visualised on the chart (only their effect on the target line is). A future polish could mark goal years with a small dot on the target staircase or list them in the canvas footer.


---

### Session 18 — 2026-04-25 (chore/misc-fixes-2)

**Built / changed** on branch `chore/misc-fixes-2` — eight UI / interaction polish pieces. Engine untouched; tests still 108/108 Python + 19/19 JS.

1. **Comparison Summary diffs incomes / events / goals as itemised changes (not just count).** `diffPlanForSummary(base, cur)` previously surfaced `Capital events 0 → 2 (+2)`; now produces structured per-collection bullets:
   - `Other income added · Rental · R 60 000/yr · 65–85 · Pierre · CPI`
   - `Capital event removed · R 4 000 000 · year 5 · Jane`
   - `Goal changed · Travel · R 200 000 every 5 yr · age 65–90 → R 250 000 every 5 yr · age 65–90`
   New `diffCollection(baseList, curList, identityFn, fmtFn, kindLabel)` helper indexes both lists by stable identity and emits added / removed / changed bullets. Identity keys: incomes `spouse|label|startAge`, events `spouse|year` (no label field on events), goals `label|startAge`. Duplicate keys get a `#n` suffix so two `Travel` goals starting at 65 stay distinguishable. Also surfaced `goals` on the `project()` result (`retirement_drawdown.html:3818`) — they were read by `readGoals()` but never exposed on the snapshot, so the locked-baseline copy had no goals to diff against.

2. **`Lock as baseline` button moved + renamed to `Explore Scenario`.** Was a primary CTA at the bottom of the rail; now sits at the head of `.controls-row-right` immediately left of the Auto-top-up pill (`retirement_drawdown.html:2801`). Comparison Summary empty-state copy updated to track the new label. The trailing `rail-divider` that preceded the rail-actions block was tagged `id="rail-actions-divider"` and a CSS rule collapses it + `.rail-actions` on Planning, so there's no dangling half-width hairline above an empty container. On Scenarios both reappear and host `Continue → Summary` as before. Internal IDs (`#btn-lock-baseline`, `baseline` JS variable, snapshot keys) unchanged — only the user-facing label changed. Print path unaffected (`.controls-row` and `.btn` were already in the print-hide list).

3. **Modal redesign across all three category modals (incomes / events / goals).** Single `#add-modal` element, `.modal-card--wide` variant. White background (was warm `--paper-2`), Fraunces serif title at 24px in normal weight (was uppercase 11px sans), small uppercase caption underneath that varies per mode (`Inheritances · property sales · maturing policies` / `Recurring household goals · travel · vehicles · gifts` / `Rental · DB pensions · trust distributions · maintenance`). Caption injected as a new `<p class="modal-caption" hidden>` sibling of the title, populated by `categoryCaptionFor(mode)` in `openCategoryModal`, hidden in `closeCategoryModal`. `min-height: 70vh` + `max-height: 90vh` so the wide variant loads tall regardless of how many rows are in the category. Backdrop now blurs with a deeper overlay (`rgba(20,24,30,0.42)` + `backdrop-filter: blur(2px)`). Card radius `var(--r-sm)` → `var(--radius-lg)` (12px), softer/larger drop shadow (`0 24px 56px / 0 4px 12px`), 32–36px padding. Footer gained a top hairline above the action row.

   **Category rows redesigned to fix the bare-input bug.** The previous `.category-row .input-wrap input` rule only set `font-size`, so inputs rendered as raw HTML controls with no wrapper styling — that's why the screenshot showed the `R` prefix floating *outside* the amount box and the year `<select>` cropped to "e.g". New `.category-row .input-wrap` is a proper field pill (white bg, hairline border, 36px height, padding, focus-within ring at 8% navy). Inputs/selects inside go borderless. Rows themselves get warm-paper bg (`--paper`), hairline border, hover/focus-within border transitions, and 16px×18px padding (was 8px). Goal/income/event grid widths bumped slightly so labels fit without crowding. `.escalate-toggle` (income row) styled to match adjacent input-wrap height. Add-row CTA gained navy hover state (was muted grey).

4. **Shortfall vertical line + label removed from Income chart.** `shortfallShadingPlugin.afterDatasetsDraw` (line ~4216) now only paints the coral wash over depleted years; the dashed coral vertical at the first shortfall year and its `shortfall begins · age N` text were retired. The wash itself + the table's clamp markers still carry the signal — the chrome was redundant. Tracking variable `shortfallStart` and the trailing `if` block deleted.

5. **Rail extends to chart-card height; chart-card stretches to match.** `.rail-canvas-shell` now uses `align-items: stretch` (was `start`) and the rail uses `align-self: stretch` (was `start`). Without `canvas-foot` below the chart-card (see #6), the panel's intrinsic height = controls-row + chart-card, and grid stretch makes both grid items match the rail's content height. To make the chart-card actually FILL its grid cell (not just sit at min-height with empty space below), Planning panel + canvas + chart-card form a flex column chain (`retirement_drawdown.html:1942-1953`): panel `display: flex; flex-direction: column`, canvas `flex: 1 1 auto`, chart-card `flex: 1 1 auto; margin-bottom: 0`. The `margin-bottom: 0` is critical — chart-card's default `margin-bottom: 28px` was leaving a 28px gap between its border and the rail's bottom edge after flex distribution. Sticky positioning preserved (rail still `position: sticky; top: 14px; max-height: calc(100vh - 40px)` with internal scroll when ledgers overflow).

6. **`canvas-foot` removed entirely.** The "Illustrative only · 2026/27 SARS tables · auto-top-up off · nominal terms" + `Year-by-year table` button strip below the chart-card (`#foot-topup`, `#foot-mode`, `#btn-show-table`) was deleted in full: HTML, CSS, the print-hide entry, the `updateCanvasFoot()` function and its call site in `refresh()`, and the `btnShowTable` lookup + click handler. The Year-by-year table button was redundant with the Table button in the chart-view seg. Side benefit: with canvas-foot gone, the rail/chart height alignment in #5 became clean (no need for a magic `min-height` on the rail tied to the chart-card area).

7. **Tab nav background flipped from warm cream to solid light grey.** `.tab-nav` background `var(--paper-2)` (warm cream) → `#e8eaed` (cool light grey at 100% opacity). Inactive tab text `color` `var(--mute)` → `var(--ink-2)` for legibility against the new background. Active tab styling (white text on navy) untouched.

8. **Chart-card stretches without inflating from canvas-foot (combined with #5/#6).** With #6 removing canvas-foot from the panel and #5 chaining flex through the panel, the chart-card now fills the vertical space the rail dictates. The chart's inner `.chart-wrap` (`min-height: 480px; flex: 1 1 auto`) absorbs the new space, so the chart canvas itself grows when the rail content is tall. Scenarios panel left untouched (the flex chain rule is scoped to `[data-tab-panel="planning"]`).

**Architectural decisions**
- **Goals were missing from the projection result, not just from the diff.** When extending #1, the temptation was to teach `diffPlanForSummary` to read `readGoals()` directly. Rejected: `baseline` and `cur` are frozen `project()` snapshots, and reading the live store at diff time would compare the *current live* goals against the locked baseline goals — which is wrong (Scenarios edits should diff against snapshot). Fix is to surface goals on the projection result so both `baseline` and `cur` carry them as captured-at-the-time data.
- **Identity-keyed diff with duplicate-suffixing.** Considered hashing the entire item as the key. Rejected: when the user edits an item (changes amount), the hash changes and the row appears as `removed` + `added` rather than `changed`. Identity on `spouse|label|startAge` (or equivalent) lets us detect "same item, changed value". The `#n` suffix path handles legitimate duplicates (two Travel goals starting at 65) by giving each a stable position-based fallback key.
- **Modal restyle vs. full DOM rewrite.** The wide-modal HTML structure is sound (single `#add-modal` reused per category, JS swaps the body via `renderCategoryRow(mode, entry, idx)`). The visual problem was the `.input-wrap` rule didn't actually style anything. Restyle keeps the JS / DOM contract identical — purely a CSS lift + one new caption element + 4 lines of JS to populate/hide it. No regression risk to modal behaviour.
- **canvas-foot removal over hide-on-Planning.** Pierre flagged the strip as removable. Considered just `display: none` on the canvas-foot DOM. Rejected: leaves dead JS (`updateCanvasFoot`, `btnShowTable`) + dead CSS that grow the file unnecessarily. Full removal is ~20 lines of deletions and the layout cleanly aligns without a magic min-height tied to the chart-card area.
- **Rail-stretch via grid `align-items: stretch` + flex chain rather than min-height arithmetic.** First attempt was `min-height: 652px` on the rail (sum of controls-row + chart-card min-height). Worked visually but was brittle: any change to chart-card min-height or controls-row layout would silently desync. Grid stretch pushes both grid items to the same row height naturally; the flex chain inside the panel makes chart-card fill that height. Self-correcting if the rail or chart-card grow.
- **Chart-card `margin-bottom: 0` only inside the flex chain.** Outside the flex chain (e.g., if the chart-card were ever lifted out of `[data-tab-panel="planning"]`), the original 28px bottom margin is still appropriate spacing. Scoped the override to the flex-chain selector specifically.
- **Engine untouched.** 108/108 Python + 19/19 JS pass. No `project()` arithmetic touched; the only result-shape change is `goals` joining `events` and `incomes` on the return object.

**Follow-ups**
- Browser walkthrough at 1366×768 (the 14" target): land on Planning, confirm rail and chart-card outer borders end at the same pixel y. Click `Explore Scenario` → switches to Scenarios. Open each of the three modals via the rail "+" affordances; confirm the new white card + serif title + caption render and `min-height: 70vh` makes them load tall. Edit a row, save, reopen — confirm staged changes reflect.
- Comparison Summary walkthrough: lock a baseline on Planning with one Other income + one Capital event + one Goal. On Scenarios, edit each (change amount on income, change year on event, change cadence on goal) + add a new one in each category + delete one in each category. On Comparison, confirm three sets of `added/removed/changed` bullets appear with correct formatting. Re-lock baseline → bullets clear.
- 32" / 55" presentation: layout is unchanged (1400px page cap + content-sized vertical). Use browser zoom (`Cmd +`) at meeting time for boardroom projector — covered in conversation, no code path needed.
- The `Year-by-year table` button removal means that affordance now lives ONLY in the chart-view seg's Table button. If Pierre wants a more discoverable "see the numbers" CTA on Planning, the Table chart-view stays available — no follow-up needed unless feedback differs.
- Per-entry modal code (`openAddModal` / `saveAddModal` / `deleteFromAddModal`) is still present but unused in UI (Session 17 noted this). Modal restyle in #3 affected `.modal-card` base styles too, so the per-entry modal would inherit the new look if ever revived.


---

### Session 19 — 2026-04-27 (claude/scenario-planning-feature-hrU5T)

**Built / changed** — the editorial client report now contains BOTH the locked baseline AND the explored scenario when a baseline is locked at export time. Previously the report showed only the scenario plus a small Compare delta-chip; now adviser hands the client a single PDF that walks the conversation end-to-end. Acceptance is documented out-of-band by email follow-up — no in-app accept/reject. Engine math untouched; tests still 108/108 Python + 19/19 JS.

1. **Snapshot schema bumped to v2** (`retirement_drawdown.html`). New top-level `baseline: {plan, projection}` block when a baseline is locked; legacy v1 `plan.baseline` metadata block dropped from new emissions. Old localStorage v1 snapshots still render in the report via a `schemaVersion` fallback path.

2. **Calculator refactor** (`retirement_drawdown.html` ~lines 6230–6480). `buildReportSnapshot()` was a 200-line inline mass; split into three peer helpers at the IIFE scope:
   - `deriveMilestones(pp)` — pure of DOM, takes a `project()` result.
   - `captureCurrentPlanInputs()` — reads the live DOM/store and returns a deep-cloned, self-contained `plan`-shape object (plus an internal `startYear` that gets stripped before emit). Called both at lock time AND export time.
   - `buildProjectionPayload(p, planInputs)` — pure of DOM, takes a frozen projection result + matching inputs, returns the existing `projection` shape.
   - Top-level `buildReportSnapshot()` is now a 25-line orchestrator. Same byte-output for the scenario half; adds the baseline half conditionally.

3. **Lock-time freeze** (`retirement_drawdown.html` line 6155). `snapshotBaseline()` now captures `baselineInputs = captureCurrentPlanInputs()` alongside the existing `baseline = JSON.parse(JSON.stringify(project()))`. The deep-clone discipline means later mutations on the Scenarios tab don't bleed into the frozen baseline. Auto-snapshot path on Scenarios-tab click + clear-baseline + re-lock all updated to keep the two globals paired. New module-level `var baselineInputs = null;` (line 3242).

4. **Two new editorial divider slides** (`retirement_drawdown_report.html`). `divider-baseline` and `divider-scenario`, cover-style layout with `data-conditional="dualrun"` and `style="display:none"` so they only appear in dual-run mode. Each carries a one-sentence subtitle framing what the run is. The baseline divider explicitly mentions the email-follow-up acceptance pattern. Print stylesheet inherits `.slide` page-break automatically — no new CSS needed.

5. **Report IIFE rewrite** (`retirement_drawdown_report.html` ~lines 1855–2700). Was a flat top-to-bottom binder with global `setField` calls; restructured into:
   - **Schema detection** → `hasDualRun = schema >= 2 && snap.baseline && snap.baseline.plan && snap.baseline.projection`.
   - **DOM helpers**: `setField(name, value)` (shared), `setRunField(suffix, name, value)` (per-run), `runEl(suffix, id)` (scoped lookup), `suffixSlide(node, suffix)` (recursive walker).
   - **`SHARED_FIELDS`** set: field names that appear inside doubled slides but represent shared values (`familyName`, `familyNamePoss`, `preparedOn`, `pageNum`, `pageTotal`). The walker exempts these so a single `setField` call paints them across baseline-clone, scenario-original, and static slides simultaneously.
   - **`setupDualRun()`**: clones the seven doubled slides (Answer, Household, Projection, Capital, Tax, Events, Year-table) for the baseline run, suffixes their IDs/data-fields with `-baseline`, marks originals as scenario with `-scenario`, builds a fragment in the desired order (Cover → divider-baseline → baseline run → Compare → divider-scenario → scenario run), inserts after Cover. Static slides (Assumptions, Levers, Methodology, Compliance, Next) auto-end-up after the fragment.
   - **`setupSingleRun()`**: drops divider templates, drops Events if no events, drops Compare if no v1 baseline metadata. Today's behaviour preserved byte-for-byte.
   - **`renderRun(plan, proj, suffix)`**: encapsulates the per-run rendering — Answer fields, Household cards, Tax cards, Projection foot, Events ledger, Year-table, three charts. Pure of side-effects beyond writing into its scoped DOM. Called once for single-run, twice for dual-run.
   - **`renderCompare()`**: v2 path reads from `snap.baseline.plan` + `snap.plan` directly and constructs proper baseline-vs-scenario mini-charts (each from its own projection rows). v1 path falls through to the legacy `plan.baseline` metadata binder.
   - **`renumberSlides()`**: runs once after all DOM rearrangement; walks `.slide` in document order, writes pageNum + Roman numerals + page total. Roman array extended to XXIV (24) since dual-run mode produces up to 22 slides.
   - **Per-run events conditional drop**: a baseline with 2 events + a scenario with 0 events shows the baseline events slide and not the scenario one. Evaluated independently per run.

6. **Compare slide stays as the bridge** (`retirement_drawdown_report.html` ~line 1496). Same DOM, rebound to read either v2's two-projection structure or v1's metadata. In dual-run it sits between the two runs as the "what changed" recap; today's adviser-facing positioning works.

7. **Sensible-defaults piece** — confirmed with user that no code change needed. Existing input defaults (Return 6.5%, CPI 3%, etc.) already serve as the meeting-time "sensible assumptions" for inputs not set in stone.

**Architectural decisions**
- **Capture inputs at lock time, not at export time.** Considered making `buildReportSnapshot` always read live DOM for both runs and storing only the projection result on the baseline global. Rejected: the live store can mutate between lock and export (Pierre edits Other-income rows on Scenarios), which would corrupt the "baseline" half. Freezing `baselineInputs` at lock time + deep-cloning list-shaped fields is the only correct contract.
- **Schema bump to v2 over additive fields on v1.** Considered keeping v1 and adding optional `baselineRuns` etc. Rejected: the report's render strategy diverges between single-run and dual-run (DOM cloning, slide reorder, Compare slide rebinding). A clean schema flag at the top of the snapshot makes the branch obvious; the `schemaVersion >= 2` check costs one line and the v1 fallback path is preserved in `renderCompare` for any old localStorage out there.
- **Clone-at-runtime over duplicate-DOM-on-disk.** Considered hardcoding two sets of HTML (one for baseline, one for scenario). Rejected: doubles the file size for the no-baseline case, and the slides drift apart over time as one or the other gets edited. Cloning at runtime keeps a single source of truth in HTML; the walker is ~12 lines.
- **Suffixing the originals as `-scenario` rather than the clones.** Originals stay in document order; clones get attached after the baseline-divider. The originals' `data-field` and `id` attrs get rewritten in-place to `-scenario`. Risk: if any code OUTSIDE my refactor still does `getElementById('chart-answer')` it'll fail. Mitigated by rewriting all such call sites into `runEl(suffix, ...)` calls. Verified by smoke test: when no baseline, runEl('', 'household-grid') resolves to the unsuffixed id; when dual-run, the originals are now `household-grid-scenario` and the runEl call routes correctly.
- **`SHARED_FIELDS` as an exemption list rather than a per-call decision.** The walker has one rule: if `data-field` is in SHARED_FIELDS, leave it alone; otherwise suffix it. Nine lines of code. Alternative (pass a `shared: true` flag at every setField call site) would have peppered the renderer with boilerplate. The set has 5 entries; if a new shared field is added later, it's a one-line update.
- **Compare slide as bridge, not delete.** First instinct was to drop the Compare slide entirely once both runs render in full (it'd be redundant). Rejected after consideration: with full runs spanning ~7 slides each, the Compare slide gives Pierre a one-page "what changed in 4 numbers" recap when the conversation gets long. Kept. v2 binding rebuilds it from the two projections directly so the data stays correct as Pierre's runs evolve.
- **Engine untouched.** `project()`, `solveTopUp`, `stepPerson`, tax helpers all unchanged. The only engine-shape addition was no addition — both `baseline` (the global) and the new `baselineInputs` (the global) are populated from the SAME `project()` calls and SAME DOM reads as before, just frozen earlier. 108/108 + 19/19 pass.

**Smoke tests**
Three snapshot shapes verified end-to-end via JSDOM-driven IIFE execution:
- v1 legacy (with `plan.baseline` metadata): renders 14 slides, no clones, Compare slide via legacy binder. Today's exact behaviour.
- v2 no baseline: renders 13 slides (Compare dropped), no clones, no dividers. Same as today minus Compare.
- v2 dual-run: renders 22 slides in the order Cover → divider-baseline → 6/7 baseline-run slides → Compare → divider-scenario → 7 scenario-run slides → 5 static slides. Per-run events conditional drop verified (baseline with 0 events drops events-baseline; scenario with 2 events keeps events). Roman numerals renumber correctly.

**Follow-ups**
- Browser walkthrough at the 1366×768 target: open `retirement_drawdown.html` fresh, set up a couple, confirm Export Report on Comparison Summary still produces today's 14-slide PDF (no baseline locked). Then on Planning click Explore Scenario, edit a slider on Scenarios, edit a capital event, click Export Report; confirm the new dual-run PDF renders in the order described above and prints cleanly to A4 landscape.
- Baseline-divider subtitle copy mentions "by email after the meeting" — confirm with Pierre this matches his actual workflow phrasing.
- Single-client toggle between lock and export is unsupported (rendering uses each run's frozen `single` flag). If Pierre flips couple → single in Scenarios, the baseline run still renders couple-mode. Edge case; not blocking. Document in `TECH_DEBT.md` if it becomes an issue.
- Assumptions slide shows scenario values for `returnPct` / `cpiPct` / `autoTopUp` only. If a scenario tweaks return/CPI, the baseline values aren't shown on this slide (Compare still shows them). Acceptable per user agreement; revisit if the scenarios-tweak-return pattern becomes common.
- `docs/ARCHITECTURE.md` references `buildReportSnapshot`'s old monolithic shape; update to reflect the three-helper split.


---

### Session 20 — 2026-04-27 (v2 dual-run report + per-event labels)

**Built / changed** — three coordinated follow-ups to the v2 dual-run report wired in earlier the same day. The dual-run editorial PDF now reads as designerly as the source mock, with named capital events round-tripping through the snapshot and the scenario GE column visibly diffing against the locked baseline. Engine math untouched: **108/108 Python + 19/19 JS** pass.

1. **v2 dual-run layout grafted onto the report** (earlier in the same session). `retirement_drawdown_report.html` gained ~370 lines of v2 CSS primitives (`.run-strip`, `.run-chip`, `.run-headline`, `.run-chart-card`, `.assume-strip`, `.compare-assume-table`, `.levers-grid-4`, `.ge-grid` + `.ge-col`, `.goal-row`, `.ev-row`) and 5 new slide templates marked `data-conditional="dualrun-v2"` (`run-income`, `run-ge`, `assumptions-compare`, `levers-v2`, `compliance-v2`). `setupDualRun()` was rewritten: drops every v1 slide except cover, clones `run-income` + `run-ge` twice with `-baseline` / `-scenario` suffixes via `suffixSlide`, reveals the static v2 slides. Final dual-run deck is **8 slides**: Cover → Baseline-income → Baseline-ge → Scenario-income → Scenario-ge → Assumptions-compare → Levers → Compliance. Section numbering uses I/I (baseline pair), II/II (scenario pair), III/IV/V for the static rest. `setupSingleRun()` extended to drop both `dualrun` AND `dualrun-v2` templates so the original 12-slide flow is byte-identical when no baseline is locked. New renderers: `renderRunV2`, `renderAssumptionsCompare`, `renderIncomeChartV2` (annotation overlay around `renderIncomeChart` adding gold disc-exhausts/LA-ceiling verticals + coral 6%-opacity shortfall band).

2. **Snapshot v2 augmented** (calculator-side, additive). `captureCurrentPlanInputs()` now emits richer `plan.spouses[].otherIncome[]` (preserves `kind`/`monthly` for back-compat, adds `name`/`monthlyAmount`/`startAge`/`endAge`/`duration`/`cpiLinked`/`pctTaxable`), `plan.capitalEvents[]` carry `age` + `spouse`, and a new top-level `plan.goals[]` from `goalsStore`. `schemaVersion: 2` unchanged — additive shape, the existing v1 `renderRun` single-run path keeps reading what it always read.

3. **Per-event labels in the calculator.** Events store today is `{year, amountPV, spouse}` with no label. The report previously hardcoded `"Capital event"` everywhere. Seven small edits in `retirement_drawdown.html` to add user-entered labels:
   - `.category-row.row--event` grid `110px 1fr 160px 28px` → `110px 1.4fr 1fr 160px 28px` (label takes more breathing room).
   - `renderCategoryRow('event')` — new label text input column between Year and Amount, placeholder `e.g. Property sale · Hout Bay`.
   - `blankEntryFor('event')` — adds `label: ''` to the seed object so the first row paints with an empty label input rather than `undefined`.
   - `saveCategoryModal` event branch — reads `s.label`, trims, includes in `clean.push`. `syncStagedFromDOM` already walked all `[data-field]`s so the label input is captured automatically.
   - `readEvents()` — pass-through preserves `label` (defaults to `''` for older saved events).
   - `renderEvents()` summary — prepends label when non-empty: `Property sale · Hout Bay · R 4 000 000 · year 5 · Pierre disc` (vs. today's `R 4 000 000 · year 5 · Pierre disc`). Inline 5-char escape for HTML-safety since the calculator's IIFE has no global body-content escaper.
   - `captureCurrentPlanInputs` capital-events map — `label: ev.label || 'Capital event'` (fallback preserves rendering for unlabeled legacy events).
   - `diffCollection` event identity changed from `spouse|year` to `spouse|year|label.toLowerCase()` so two same-year events on the same spouse stay distinguishable; `fmtEvent` prepends label when present so Comparison Summary bullets read `Capital event added · Property sale · Hout Bay · R 4 000 000 · year 5 · Pierre`.

4. **Diff badges on the scenario GE column** (report-side, JS only — CSS classes were laid down in step 1). New `diffByKey(baseList, scenList, keyFn)` helper near the v2 renderers returns `{ isAdded, isChanged, addedCount, changedCount }` with JSON-shape comparison. `renderRunV2` builds three diffs only when `which === 'scenario' && hasDualRun`: goals key on `label|startAge`, streams on `spouseName|name|startAge`, events on `spouse|year|label` (matches the calculator's `diffCollection` after step 3). Three column renderers extended to accept `{ diff, baseline }` opts. Visual treatments:
   - **Lifestyle income row** (implicit, derived from `monthlyNeed`): when scenario differs from baseline, renders with `↑ uplifted` (or `↑ reduced`) gold italic badge + `.warn` (coral) amount + delta narrative in the note (`+ R 5 000/mo vs. baseline · this is the lever the household pulled today.`).
   - **Goal rows**: `↑ added` or `↑ updated` gold italic badge inline with the name when the diff says so.
   - **Other-income rows**: `.added` class (gold-tinted background + gold age numbers per CSS).
   - **Capital-event rows**: `.added` class composes with `.outflow` (coral) cleanly.
   - **GE column subtitles**: append `· N added · N changed` tail derived from the diff result. Lifestyle counts as +1 changed when uplifted.

5. **Renumber section map** (report). `renumberSlides()` now branches on `hasDualRun`: dual-run uses a section map (cover → none, baseline pair → I, scenario pair → II, assumptions → III, levers → IV, compliance → V); single-run keeps the per-slide Roman walker. Page numbers always increment per-slide.

**Architectural decisions**
- **Additive snapshot, not v3.** Considered bumping to `schemaVersion: 3` for the new fields. Rejected: the existing v2 readers (today's `renderRun` single-run path) gracefully ignore unknown fields, and bumping the version would force a third fallback path in the report's binder. Additive fields with v1-style aliases (`kind`/`monthly` preserved alongside `name`/`monthlyAmount`) cost zero compatibility and let the old single-run renderer keep working byte-for-byte.
- **Diff in the report, not the calculator.** Considered exporting `diffPlanForSummary` results as part of the snapshot so the report could just read pre-baked diff bullets. Rejected: the report's diff treatment (per-row badges) is shape-different from the calculator's diff vocabulary (full narrative bullets), and the report already has both `snap.plan` and `snap.baseline.plan` available. A 12-line `diffByKey` helper in the report's IIFE is simpler than a snapshot extension.
- **JSON-shape changed-detection over field-by-field.** `JSON.stringify(b) !== JSON.stringify(s)` flags any change. Cheaper than enumerating per-shape fields and won't miss schema additions. Stable for the small per-row objects in this domain (no key-order issues since both come from the same captured shape).
- **Lifestyle row is implicit.** The v2 mock shows "Lifestyle income" as the first goal row in the GE column. The calculator doesn't store this as a `goal` — it lives as `plan.monthlyNeed`. The report's `renderGoalsCol` injects it implicitly (always first), and the diff treats it as "changed" iff `scenario.monthlyNeed !== baseline.monthlyNeed`. Avoids polluting `goalsStore` with a synthetic always-on entry.
- **Per-event label is optional, not required.** No validator rejection on empty labels. Older saved events (pre-Session-20) have no label and render as `Capital event` via the snapshot fallback. New events without a label do the same. The label is editorial polish, not a data integrity requirement.
- **Section numerals over per-slide.** The v2 mock uses I/I for the baseline pair (signalling "this is one section"), II/II for scenario, then III/IV/V. Per-slide numbering (I-VIII) would have read as a flat eight-slide deck rather than a baseline-vs-scenario document. Reflects how Pierre will narrate the document in the meeting.
- **Engine untouched.** 108/108 Python + 19/19 JS pass throughout. No `project()` arithmetic touched; the only engine-shape addition is no addition — `captureCurrentPlanInputs` reads from existing stores.

**Smoke tests**
JSDOM-driven smoke at `/tmp/sw-smoke/smoke.js` (dual-run, synthetic snapshot with baseline R 50k → scenario R 55k, baseline 2 streams → scenario 3 streams, baseline 0 events → scenario 1 outflow event):
- 8 slides in correct order, section numerals I/I/II/II/III/IV/V correct.
- Lifestyle row paints `↑ uplifted` badge + `.warn` red amount + `+ R 5 000/mo vs. baseline` narrative.
- Other-income column flags 1 added row (Consulting · Peter) with `.added` class.
- Events column flags 1 added row.
- Subtitle counts: `3 goals · 1 changed`, `4 streams · 1 added`, `1 outflow · 1 added`.
- Baseline GE column carries zero diff badges (must not bleed).
Single-run smoke at `/tmp/sw-smoke/smoke-single.js`: 12 slides, original I-XI numerals, v2 templates correctly dropped, no baseline.

**Follow-ups**
- Browser walkthrough at 1366×768: open `retirement_drawdown.html`, set up a couple, add a labelled event ("Daughter's wedding contribution"), confirm label round-trips through Export Report into the v1 single-run year-table and v2 dual-run scenario events column. Lock baseline, edit `monthlyNeed` + add an event on Scenarios, click Export Report — confirm the dual-run PDF renders the `↑ uplifted` Lifestyle row + gold-tinted added events/streams + assumptions-compare deltas.
- Print preview of both single-run and dual-run PDFs — confirm no overflow at A4 landscape and that the run strips + chips survive the print color filter (`-webkit-print-color-adjust: exact`).
- Estate-floor `breached at age N` status flag — out of scope for this cut, requires projection-side check against `goal.amountPV`. Logged in `TECH_DEBT.md`.
- The capital event label round-trip is one-way today: editing an event in the modal updates `eventsStore` and the rail summary, but the rail summary line was already truncated in the rail's narrow column; the label may overflow for long names. If Pierre flags this as ugly, add `text-overflow: ellipsis` to `.entry-row .entry-summary` in the rail-ledger context.


---

### Session 21 — 2026-04-27 (report income-chart y-axis fix · real-rand rendering)

**Built / changed** — surgical fix to `retirement_drawdown_report.html`. The Answer / Projection / dual-run / compare-mini income charts were rendering bars as stubs at the bottom of the frame with the dashed coral target line floating low; the y-axis was scaling to year-30+ nominal income (~2.4× year-1 at 3% CPI) while `requiredReal` and the passed-in `needBase` were today's-rand. Mixing the two units on one chart blew the axis ceiling far above the target. Engine math untouched: **108/108 Python + 19/19 JS** unaffected (the report does no math).

1. **`toRealRows(rows, cpi, startAge)` helper** added at `retirement_drawdown_report.html:2797`, immediately above `renderIncomeChart`. Returns a new array (never mutates) where `laDraw`, `discDraw`, `otherIncome`, and `totalIncome` are deflated by `v / (1+cpi)^(age - startAge)` — the same formula as the engine's `deflate()` at `retirement_drawdown.html:3879–3880`. `requiredReal` and `needBase` are already today's-rand, so they pass through untouched.

2. **Seven call sites wrapped** to pass real-rand rows into `renderIncomeChart` / `renderIncomeChartV2`:
   - `renderRun` chart-answer + chart-projection (lines 3262, 3267)
   - `renderCompare` v2 mini-charts compare-baseline + compare-scenario (lines 3322, 3327)
   - `renderCompare` v1 fallback mini-charts (lines 3365, 3370)
   - `renderRunV2` dual-run income chart (line 3741)
   The dual-run v2 annotations (`opts.discExhaustsAt`, `opts.laCapAt`, `opts.shortfallFromAge`) are age-based, so they continue to land at the right x-coordinates without modification.

3. **Capital chart left as-is.** `renderCapitalChart` has the same nominal-growth issue on its y-axis but its purpose is *capital balances* (not expenses), and the user's note specifically called out expenses. Tracked in `TECH_DEBT.md` for revisit if Pierre flags it.

**Architectural decisions**
- **Inline deflation over snapshot bump.** The deflator is constant `(1+cpi)^i` — replicable in the report from three pieces of data already on the snapshot (`projection.cpi`, `projection.startAge`, `r.age`). Adding `p.real.la[i]` etc. to `buildProjectionPayload` would force a calculator-side change for the same numbers; inline keeps this a single-file fix.
- **Real-mode rendering, not y-axis clamping.** Considered `Math.min(maxVal, needBase × 1.5)` as a one-line patch to cap the axis. Rejected: in years where nominal income overshoots the real target, that would visually clip bars off the top of the chart — worse than today's stubs. Real-mode is the only fix that keeps the data faithful AND scales the axis to expense-shape.
- **Report stays nominal-only-input.** The snapshot continues to carry only `p.nominal.total[i]` per row. `toRealRows` is a render-time view, not a data shape — the year-table on the same page still shows nominal values (which is correct for the year-by-year table since it's labelled with years, not "today's money").

**Smoke check**
Manual walkthrough: y-axis tick at the top of the income charts now reads roughly `R 600k` for an R 50k/month plan (annual need × 1.08), bars stack to roughly the height of the dashed coral target line in the early years, target line sits near the top of the frame. Print preview at A4 landscape — chart scales correctly under print color exact mode.

**Follow-ups**
- Browser walkthrough at 1366×768: confirm the visual fix lands across Answer slide (height 300), Projection slide (height 480), v2 dual-run run-income slide (height 480), and the v2 compare-bridge mini-charts (height 180). Also confirm v1 single-run path renders correctly.
- If any bar visibly clips the top edge of a chart, tune the `* 1.08` headroom in `renderIncomeChart:2809` — but defer until we see real data shape post-fix.
- Capital chart real-mode rendering — see `TECH_DEBT.md` entry.

**Also in this session — seeded defaults for capital events / goals / other income.** Pierre asked for representative dummy data so a fresh page load has enough texture to test the report end-to-end without manual data entry. Three in-memory stores in `retirement_drawdown.html` were initialised from `[]` to seeded arrays:
- **`eventsStore`** (line ~5145): 3 events — Endowment maturity (year 5, R 800k, A), Property downsize (year 8, R 4m, A), Inheritance (year 12, R 2m, B).
- **`goalsStore`** (line ~5876): 5 goals — Travel (R 150k every 2 yrs, 65–80), Vehicle replacement (R 600k every 8 yrs, 65–90), Home maintenance (R 50k every 1 yr, 65–95), Family gifts (R 100k every 3 yrs, 65–95), Healthcare buffer (R 200k every 5 yrs, 70–95).
- **`incomeStore`** (line ~5788): 2 streams — Rental property (Spouse A, R 144k/yr, age 65, 15 yrs, CPI-linked, 100% taxable), DB pension (Spouse B, R 120k/yr, age 65, 35 yrs, CPI-linked, 100% taxable).

These stores are pure in-memory at IIFE scope (no localStorage persistence — `sw-drawdown-snapshot` is the only thing the calculator persists, and that's for the report). Every fresh page load gets the seeded defaults; the modal Save still replaces stores wholesale so editing in a meeting overrides the defaults for that session. The values exercise the existing engine (per-event labels round-trip into the report's events ledger, goals bump the target line, both incomes feed the tax view) so the dual-run editorial PDF has shape on first export.


---

### Session 22 — 2026-04-27 (real y-axis fix · cold-init render · GE single-column redesign)

**Built / changed** — three follow-ups after the Session 21 PR landed and Pierre opened the report against the seeded defaults. The first two were bugs masquerading as the "y-axis still too high" complaint; the third is a layout redesign Pierre asked for once the chart was actually rendering correctly. Engine math untouched: **108/108 Python + 19/19 JS** unaffected.

1. **Actual y-axis bug — `r.totalIncome` was carrying capital, not income.** `buildProjectionPayload` (`retirement_drawdown.html:6445`) was setting `var totalIncome = (p.nominal.total[i] || 0)`, but `p.nominal.total` is a misleadingly named CAPITAL series — `totalNom.push(capAtStart)` at line 3812 pushes start-of-year LA + Disc balance, not gross income. So `r.totalIncome` was carrying ~R 10m of capital instead of ~R 700k of income, blowing `maxVal` in `renderIncomeChart` regardless of the Session 21 `toRealRows` deflation (which was working correctly — it was just deflating the wrong field). Bars rendered at proportional heights internally because they read `laDraw`/`discDraw`/`otherIncome` directly per row, but they got squashed against an oversized y-axis ceiling. Same wrong field also drove the `r.shortfall` row flag (silently almost always false because capital ≫ target) and the v1 year-table's "Total income" column. Fix: compute `totalIncome = laDraw + discDraw + otherInc` directly from the three components in the same row builder. Y-axis now tops near `R 700k–R 1m` against the dashed coral target line, exactly as Pierre's diagnosis predicted.

2. **Seeded stores didn't paint on cold load.** The Session 21 commit seeded `eventsStore` / `goalsStore` / `incomeStore` with representative defaults but the three render functions (`renderEvents` / `renderIncomes` / `renderGoals`) were only wired into `setTab()` (tab switches) and the modal save/delete handlers — neither fires on first paint. So the data was in memory but not in the DOM until the user clicked a tab. Fix: explicit `renderEvents() / renderIncomes() / renderGoals()` calls right before the initial `refresh()` at the bottom of the IIFE.

3. **GE slide redesign — single-column stack with Lifestyle as the lead section.** Pierre flagged the run-ge slide as having a huge empty band above the headline and asked for a one-column page that fills more vertical space, with Lifestyle expenses split into two line items (monthly need + annual lump sum) before goals / other income / capital events.
   - **Layout**: replaced the 3-column `.ge-grid` with a `.ge-stack` flex column. Sections now stack top-to-bottom inside `.slide-body` (which is also a flex column on run-ge so the stack can absorb remaining vertical space). The "empty band above" was a separate layout bug: `.slide` had `grid-template-rows: auto 1fr auto` (3 rows) but the run-income / run-ge slides have FOUR children (slide-top, run-strip, slide-body, slide-foot), so the 4px run-strip was claiming the 1fr expansion row and slide-body was sliding into an implicit auto row at the bottom. Fixed by giving these two slide types `grid-template-rows: auto auto 1fr auto` so slide-body lands in the 1fr row.
   - **Sections, in order**: i. Lifestyle expenses → ii. Goals → iii. Other income → iv. Capital events. Roman numerals scoped to within the slide; deck-level pagination is unchanged.
   - **New renderer**: `renderLifestyleSection(plan, opts)` produces two `.goal-row`s — `Monthly lifestyle income` and `Annual lump-sum needs`. `renderGoalsCol` no longer injects the implicit Lifestyle row; `goalCt` drops the `+1`. Headline reads "rests on five goals" (was "six") for the seeded data.
   - **Diff badges**: the `↑ uplifted/reduced` badge moves from the goals column into the lifestyle section. `lifestyleChangeCount` now tracks `monthlyNeed` and `annualLumpSums` independently — section subtitle reads e.g. `2 items · 2 changed` when both differ between baseline and scenario.

**Architectural decisions**
- **Engine series stays as-is, the report adapts.** Considered renaming `p.nominal.total` to `p.nominal.capital` to remove the trap. Rejected: the calculator-side `set('s-end-real', fmtR(p.real.total[endIdx]))` callers (line ~4069) read this series as capital correctly. Renaming would touch the engine + UI + all consumers; computing `totalIncome` from the components in the report payload is one line, and the Session 21 commit message + this entry pin the trap for future readers.
- **Inline render-on-init over wiring into a shared init helper.** Three direct calls right before `refresh()` is dumber and clearer than introducing a `renderAllStores()` helper. The render functions are idempotent and cheap.
- **Single-file CSS for the slide-grid fix.** Targeted `[data-slide^="run-income"]` and `[data-slide^="run-ge"]` so the rule only kicks in for the two dual-run slide types that actually have the run-strip child. Other slides (cover, single-run answer / projection / etc.) keep the 3-row layout — flipping them would have broken `.slide-body` height on slides with no run-strip.
- **Lifestyle as a section, not a goal.** Considered injecting `monthlyNeed` + `annualLumpSums` as two synthetic entries at the top of `goalsStore` so the existing renderer handled them. Rejected: that would pollute the calculator's goals UI, the snapshot, and the engine's `goals[]` consumer (`goals_for_year` in `conftest.py`). A dedicated `renderLifestyleSection` keeps the lifestyle inputs where they belong (`plan.monthlyNeed` / `plan.annualLumpSums`) and keeps the section structure explicit in HTML.

**Smoke check**
Manual walkthrough (dual-run, seeded defaults): y-axis on the income charts tops near `R 700k`; bars proportional to target line; run-ge baseline + scenario both render four sections in order with seeded counts (`2 items`, `5 goals`, `2 streams`, `3 events`). Cold-load paints all rail-ledger rows immediately without needing a tab click first.

**Follow-ups**
- Browser walkthrough at A4 landscape print preview — confirm no overflow on run-ge with the stack now fully populated (5 goals + 2 streams + 3 events + 2 lifestyle rows + section heads).
- Capital chart real-mode rendering — still tracked in `TECH_DEBT.md`; not in this branch.


---

### Session 23 — 2026-04-27 (sustainableTo fix · assume-strip removal · flush bars)

**Built / changed** — three small follow-ups after Pierre's screenshot review of the Session 22 report. Engine math untouched: **108/108 Python + 19/19 JS** still pass.

1. **`sustainableTo` was reading the wrong engine series.** Same naming-trap bug as Session 22 but on the calculator side: `deriveMilestones()` (`retirement_drawdown.html:6285`) compared `pp.nominal.total[i]` against `pp.nominal.target[i]` to detect shortfall. `pp.nominal.total` is the engine's CAPITAL series (line 3812 pushes `capAtStart`, the start-of-year LA + Disc balance), not gross income. With capital ≈ R 10m and target ≈ R 700k the shortfall test almost never tripped, so `sustainableTo` kept advancing all the way to ~age 98 even when the chart visibly showed bars dropping below the target line at the LA ceiling (age 89). Fix: read `pp.nominal.draw[i]` (the actual gross-income series — `laDraw + discDraw + otherIncome` per year). After fix, `sustainableTo` is the last age before income < target — matching what the chart shows. Headlines on the run-income slide ("the lifestyle holds until age N") now read correctly.

2. **Removed the `.assume-strip` below the run-income chart.** Six-cell summary row (Monthly need · Return·CPI · Other income · Capital events · Auto top-up · Sustainable to) sat directly below each run-income chart, duplicating values already carried by the headline ("At R 50 000/mo... lifestyle holds until age 88") and the chart annotations (disc-exhausts / LA-ceiling verticals). Pierre asked for it gone. Removed the HTML block, the `assume-*` `setRunField` calls in `renderRunV2`, and the `.assume-strip` / `.assume-cell` / `.assume-label` / `.assume-value` CSS rules. Slide-body still flexes to fill the height; chart-card now sits with the headline above and clean space below.

3. **Flush bars + 1px white year dividers in the report charts.** `renderIncomeChart` and `renderCapitalChart` were rendering bars at 68% slot width with the bar centered inside the slot — so adjacent years had a 32% horizontal gap. The calculator's Chart.js setup uses `categoryPercentage: 1.0, barPercentage: 1.0` (flush bars) plus a 1px white right-border per dataset to mark year boundaries. Match it: `bw = slot`, `x = pad.left + slot * i` (left-aligned, no centering offset), and after rendering all bars paint 1px white `<line>` elements at every internal slot boundary. Applies to both income (Answer / Projection / dual-run / compare-mini) and capital (single-run only).

**Architectural decisions**
- **Engine series stays misleading-named.** Same call as Session 22: renaming `p.nominal.total` to `p.nominal.capital` would touch the engine + UI + every consumer (`set('s-end-real', fmtR(p.real.total[endIdx]))` reads it correctly as capital). Surgical per-call-site fixes plus a comment in `deriveMilestones` pin the trap for future readers.
- **White year dividers, not paper-coloured gaps.** Considered `bw = slot - 1` (1px gap, paper background showing through) instead of overlay lines. Rejected: paper colour would muddy the visual against the warm `#faf9f5` background; the calculator uses literal white so the dividers read as crisp editorial polish. SVG `<line>` overlay is one extra loop, ~6 lines.

**Smoke check**
Manual walkthrough (dual-run, seeded defaults): headline reads "lifestyle holds until age 88" matching the chart's first-shortfall age 89; assume-strip gone; bars touch flush with thin white dividers. Print preview at A4 landscape clean.

**Follow-ups**
- Pierre to confirm post-depletion target-line visibility in the shortfall wash zone — flagged in conversation as a possible follow-up but no specific issue spotted yet.
- Capital chart still nominal in dual-run report — tracked in `TECH_DEBT.md` since Session 21.


---

### Session 24 — 2026-04-27 (report income charts: nominal + stepped per-year target)

**Built / changed** — unwound PR #24's deflation. The report's run-income / answer / projection / compare-mini charts now render in nominal terms with a stepped per-year target line — matching the calculator UI's shape language (rising bars + rising stepped target staircase). Engine math untouched: **108/108 Python + 19/19 JS** still pass.

**Why it was wrong before.** PR #24 (Session 21) wrapped every chart row in `toRealRows(rows, cpi, startAge)` to deflate `laDraw / discDraw / otherIncome / totalIncome` to today's-rand. At the time we thought the y-axis blow-up was a real-vs-nominal unit mismatch. Turns out the actual root cause was a different bug — `r.totalIncome` was reading `p.nominal.total[i]` which is the engine's CAPITAL series (Session 22 fix). PR #24's deflation was masking the symptom by squashing the wrong-magnitude data, and producing flat bars + a flat horizontal target line that didn't match the UI's rising-with-CPI editorial story. Pierre A/B'd the report against the calculator's Scenarios-tab compare cards and flagged the shape difference.

1. **Snapshot: per-year nominal target field.** Each row in `buildProjectionPayload` (`retirement_drawdown.html:6448`) now also carries `requiredNom = p.nominal.target[i]` — the engine's per-year nominal target need (CPI escalation + goal bumps, already correctly computed for years; just newly exposed in the export bundle). Existing static `requiredReal = p.targetPVAnnual` is kept for back-compat with v1 single-run paths and for fallback. Additive snapshot field — `schemaVersion` unchanged; existing v2 readers ignore unknown fields.

2. **Report: drop `toRealRows`.** Helper deleted from `retirement_drawdown_report.html` (~line 2768) and all seven call sites (`renderRun` chart-answer + chart-projection, `renderCompare` v2 + v1 mini-charts, `renderRunV2` dual-run income chart) now pass nominal rows straight through.

3. **Report: stepped target line + per-year shortfall.** `renderIncomeChart` replaces the single horizontal `<line>` with a staircase `<polyline>` — for each year `i`, a horizontal segment at `targetY(i)` from the slot-left to slot-right edge; vertical steps appear where the target changes (every year via CPI, plus bigger steps in goal years). Same shape vocabulary as the calculator's `targetBoxPlugin` (`retirement_drawdown.html:4243`). `maxVal` now folds in `r.requiredNom` so the y-axis fits the year-30 nominal target. Shortfall wash compares per-year `r.totalIncome < rowTarget(i)` and fills from `targetY(i)` down to the bar top — accurate shortfall geometry in goal years. TARGET NEED label anchored to the last year's target height so it sits at the right edge at the right vertical position. Coral dashed kept for editorial continuity with the existing legend marker.

**Architectural decisions**
- **Engine + UI untouched.** `p.nominal.target` already existed and was already correct — used by the calculator's `targetBoxPlugin` for the same staircase shape. The fix was a one-line snapshot addition + report-side rendering change, no engine arithmetic touched.
- **`r.requiredReal` kept alongside `requiredNom`.** Considered dropping `requiredReal` since it's now redundant for the chart. Rejected: v1 single-run paths and pre-bump localStorage snapshots still consume it; the report's `rowTarget()` helper falls back to it cleanly. ~6 bytes per row in the snapshot.
- **Coral dashed target, not solid navy.** UI uses solid 2.5px navy via `targetBoxPlugin`. Report keeps coral dashed to match its existing legend marker. Pierre's complaint was about the SHAPE (staircase) not the colour. Single-pixel-cost change vs. churning the legend + design-system parity.

**Smoke check**
Manual walkthrough (dual-run, seeded defaults): bars rise from age 65 (~R 600k) to ages in the late 80s (~R 1.5–2m), then drop in shortfall years. Target line is a coral dashed staircase rising every year with bigger steps in goal years. Y-axis tops near R 3–4m. Caption "NOMINAL RANDS · ESCALATED AT CPI" now matches the data. Print preview at A4 landscape clean.

**Follow-ups**
- Capital chart still nominal in dual-run report — tracked in `TECH_DEBT.md` since Session 21.
- If any year visibly clips the top of the chart at very long horizons (e.g. age 95 with high CPI), bump the headroom in `renderIncomeChart`'s `maxVal` calc from `* 1.08` to `* 1.12`.


---

### Session 25 — 2026-04-27 (report income charts: net bars · solid navy target · age-99 horizon)

**Built / changed** — three follow-ups to the dual-run income chart after Pierre A/B'd it against the calculator's Scenarios tab and flagged shortfall mis-detection, dashed coral target, and an early x-axis cutoff. Engine math untouched: **108/108 Python + 19/19 JS** still pass.

**Why the shortfall was off.** The engine's solver treats `p.nominal.target[i]` as a **net** (after-tax) target — `solveTopUp` line 3558 reads `var shortfall = targetNom - netLA;`. The calculator UI's `incomeBarSeries` apportions household tax across LA/Disc/Other and renders bars as net-to-bank, so the on-target relationship "bar tops meet target line" holds and the coral wash starts at the true first-shortfall age. The report had been stacking **gross** bars (`r.laDraw + r.discDraw + r.otherIncome`) against the same net target — gross is ~25% above net at typical SARS marginal rates, so the coral wash didn't paint until even gross fell below net (deep depletion, ~5 years late). Pierre's screenshot showed UI shortfall at age ~89 vs. report shortfall at age ~95.

1. **Snapshot: per-year `tax` field + corrected `shortfall` flag.** `buildProjectionPayload` (`retirement_drawdown.html:6448`) now reads `taxNom = p.nominal.tax[i]` and ships it on every row alongside the existing fields. The pre-existing `shortfall` flag (consumed by `firstShortfallAge` + the v2 dual-run shortfall band overlay) was using the same gross-vs-net comparison; updated to `(totalIncome - taxNom) < target - 1`. `r.totalIncome` stays gross — preserves the run-foot "total income" totals (`retirement_drawdown_report.html:3194/3196/3200`) and the year-table "Total income" column (`:3245`). The chart computes net locally.

2. **Report: net bars in `renderIncomeChart`.** New local helper `netParts(r)` (`retirement_drawdown_report.html:2797`) mirrors the UI's `incomeBarSeries` apportionment — proportional split of `r.tax` across LA/Disc/Other based on each source's gross share, returning `{la, disc, other, total}` net-to-bank. Bar rendering loop, shortfall comparison, and `maxVal` all read from `netParts` instead of the row's gross fields. Three colours preserved (no Tax slice added — the editorial 3-stack stays). Legacy v1 snapshots without `r.tax` fall through to `taxApp = 0` → bars stack at gross, identical to pre-Session-25 behaviour.

3. **Report: solid navy target line.** Polyline at `:2829` now strokes `'#1f2d3d'` at 2.5px with no `stroke-dasharray` — matches the calculator UI's `targetBoxPlugin` (`retirement_drawdown.html:4262`). Right-edge `TARGET NEED` label colour also flipped to navy. The three "Target need" legend chips on the cover/answer/projection slides (`:1456/:1690/:2215`) swapped from `background:var(--coral)` to `var(--navy)`.

4. **Report: income charts always run to age 99.** `renderRunV2`'s `min(sustainableTo + 5, lastAge)` slice was capping the dual-run scenario at age 98 for `sustain=93`; replaced with full `rows`. `renderRun` (single-run) Answer + Projection charts now also pass full `rows` instead of `chartSlice(3)` / `chartSlice(6)`. `renderCompare` v2 mini-charts dropped their inline `sustainableTo + 3` cap. The local `chartSlice()` helper survives — only the v1 capital chart still uses it (its real-mode rendering is tracked in `TECH_DEBT.md`).

**Architectural decisions**
- **Snapshot stays additive (v2).** `tax` is a new field; `shortfall` is the same field with corrected semantics. v1 readers (none today, but the legacy compare-slide path) ignore unknown fields. `r.totalIncome` deliberately not repurposed — keeping it gross preserves the run-foot total reads and avoids a second pass through every consumer.
- **3-color net bars over 4-color tax slice.** Considered mirroring the UI's full 4-stack (LA-net + Disc-net + Other-net + Tax-on-top, bar tops at gross). Rejected: Pierre had specifically called out that the report was "looking better" — adding a fourth colour would have unwound the editorial simplicity that landed in Session 24. Net 3-stack achieves the goal (bar tops align with target on-target years; coral wash reads the real shortfall) without inflating the visual.
- **Income charts go to 99, capital chart still sliced.** Income parity matters because that's the chart Pierre compares against the UI. The capital chart has a separate open issue (real-mode rendering, TECH_DEBT.md since Session 21); keeping it sliced avoids two unrelated changes in one PR.
- **Engine untouched.** 108/108 + 19/19 pass. Only snapshot shape (additive) + report rendering (presentation) changed.

**Smoke check**
Manual walkthrough (dual-run, seeded defaults): scenario chart x-axis runs from age 65 → age 99. Bars at age 88–89 sit at the navy target staircase (on-target); coral wash begins at age ~89–90, matching the UI. Target line is solid navy at 2.5px; right-edge `TARGET NEED` label paints navy; legend chips paint navy. Print preview at A4 landscape clean.

**Follow-ups**
- Capital chart still nominal + sliced in dual-run report — both tracked in `TECH_DEBT.md` since Session 21.
- The year-table "Total income" column still shows gross. If Pierre wants a Tax column or a Net column on the year-table, that's a separate cut — `r.tax` is now available on the snapshot for whoever reads it next.

