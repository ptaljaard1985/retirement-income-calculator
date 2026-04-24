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

### Session 11 — 2026-04-24 (refactor/state-2-chrome-consolidation)

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
- Archived Sessions 2–6 into `docs/SESSION_LOG.md` while writing Session 11 to bring the main log back to the "~5 entries" guideline.

### Session 10 — 2026-04-24 (refactor/plan-bar-and-financial-levers)

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

_Sessions 1–6 archived in `docs/SESSION_LOG.md`._
