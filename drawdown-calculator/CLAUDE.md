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

### Session 9 — 2026-04-23 (refactor/shrink-above-chart)

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

### Session 8 — 2026-04-23 (fix/income-bar-apportionment)

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

### Session 7 — 2026-04-23 (feat/next-iteration)

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

### Session 6 — 2026-04-23 (feat/post-merge-iteration)

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

### Session 5 — 2026-04-23 (fix/state-2-3-charts)

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

### Session 4 — 2026-04-23 (export-report-redesign)

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

### Session 3 — 2026-04-23 (PR 3)

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

### Session 2 — 2026-04-23

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

_Session 1 (2026-04-22, named spouses + other-income schedule) archived in `docs/SESSION_LOG.md`._
