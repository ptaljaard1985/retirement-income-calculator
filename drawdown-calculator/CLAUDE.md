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

_Sessions 1–13 archived in `docs/SESSION_LOG.md`._
