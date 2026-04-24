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

_Sessions 1–9 archived in `docs/SESSION_LOG.md`._
