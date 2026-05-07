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

### Session 30 — 2026-05-07 (state-1 row dividers · income-chart cached-update fix)

**Built / changed** on `claude/state1-row-dividers` — two surgical UI tweaks. Engine math untouched; tests still **115/115 Python · 45/45 JS**.

1. **Cached-chart update path for the Income chart aligned with the Session-29 reorder.** The S29 reorder (LA → Other → Disc → Tax) updated the initial dataset definitions and `INCOME_DATASET_INDEX` correctly, but the cached-chart update branch in `buildIncomeChart` (line ~4407) was still feeding `bars.disc` to `datasets[1]` and `bars.other` to `datasets[2]`. After the reorder, `datasets[1]` is the navy "Other income" entry and `datasets[2]` is the gold "Discretionary" entry. Net effect: the gold band painted Other-income data under the Discretionary label, while actual disc draws (correctly zero) painted as a 0-height invisible navy band. Pierre caught it: auto-top-up off + disc sliders at R 0, yet the chart showed a non-zero gold band sized exactly like the household's Rental + DB pension. Fix: swap `datasets[1]` and `datasets[2]` data + hidden assignments to match the reordered chart. The initial `new Chart()` build path (run only once per page load) was always correct; the bug surfaced on every subsequent `refresh()` that hit the cached-update branch.

2. **State 1 row dividers — full-width hairline at the bottom of every two-column row.** Pierre asked for visible section delimiters across the Info screen so each row's content "ends" at a clear baseline regardless of how many ledger items are inside. Three CSS adjustments:
   - `.empty-setup` (Spouse setup): added `padding-bottom: 36px; border-bottom: 1px solid var(--hairline);` (kept the existing `margin-bottom: 36px` for above-the-line breathing room).
   - `.empty-ledgers` (paired-row class — used twice for Row 2 and Row 3): same pattern with `padding-bottom: 28px; border-bottom: 1px solid var(--hairline); margin-bottom: 28px;`.
   - `.empty-markets`: dropped `border-top` (the row above now carries its own bottom border, so the previous double-line would have read as visual noise). Kept `border-bottom` so the markets row still frames as a strip.

   Mirrors the existing `.empty-titleplate` pattern (padding + margin + border-bottom). Total visual rhythm between rows: 28px padding above the line, then 1px hairline, then 28-36px margin into the next row's content.

**Architectural decisions**
- **Padding-bottom + margin-bottom rather than just margin-bottom + border.** Borders sit at the box edge — without `padding-bottom`, the hairline would touch the last item in the row. The padding gives the line breathing room above; the margin gives breathing room below. Same pattern the title plate already uses, so the State 1 reads as a uniform editorial sequence.
- **Drop `.empty-markets` border-top, not the previous row's border-bottom.** Either approach removes the doubled line, but losing the previous row's bottom border would mean Row 3 (Other income + Capital events) had no visible delimiter — and that was the row Pierre was specifically asking to be delimited. Markets keeps its bottom border because the page below it is a CTA, and the strip-style framing was deliberate.

**Smoke check**
- `cd tests/python && pytest` → 115 passed.
- `cd tests/js && node run.js` → 45 passed.
- Inline script parses cleanly under `new Function()`.

**Follow-ups**
- Browser walkthrough at 1366×768: open `retirement_drawdown.html` fresh, confirm full-width hairlines under Spouse setup, under the Monthly + Goals row, under the Other income + Capital events row, and below Market assumptions. Add unequal counts of incomes vs events to confirm the lines still span the column gutter cleanly. Reload the calculator on Planning, drag any slider, confirm the Income chart's gold "Discretionary" band stays at zero when disc-draw sliders are R 0 and auto-top-up is off; the navy "Other income" band should appear as the second slot above LA.

### Session 29 — 2026-05-07 (info-screen polish · monthly-need slider · income-chart reorder · two follow-ups closed)

**Built / changed** on `claude/info-screen-tweaks` — Info-screen polish in six pieces plus an Income-chart stacking reorder. Engine math untouched; tests still **115/115 Python · 45/45 JS**.

1. **Roman numerals removed from Info screen.** `<span class="rom">I.</span>` … `VII.` deleted from all seven steplabels. The `.rom` and `.empty-steplabel .rom` CSS rules dropped — `.rom` had no other call sites (verified via grep). Reading order is unchanged; the numerals only added visual chrome. Spouse-A's `.label-couple` / `.label-single` swap still works; the leading `<span class="rom">I.</span>` was the only loss in that label.

2. **Two-column row alignment when item counts differ.** `.empty-ledgers` cells were stretching to row height but their internal ledger boxes were content-sized → "+ Add …" buttons sat at different y positions when one column had more items than the other. Fix in three CSS adjustments:
   - `.empty-ledgers > div { display: flex; flex-direction: column; }` — cells become flex columns.
   - `.empty-events-ledger`, `.empty-incomes-ledger` get `flex: 1; display: flex; flex-direction: column;` so the ledger box absorbs the cell's full height.
   - `.empty-events-ledger .add-btn`, `.empty-incomes-ledger .add-btn` get `margin: auto 0 0` (was `4px 0 0`) so the add button sits at the bottom of the box regardless of how many items pile from the top.
   Also `.empty-ledgers .empty-steplabel` flips to `flex-direction: column; align-items: flex-start; gap: 4px; min-height: 38px` so a wrapping subhint on one side doesn't shove its column's content below its sibling. Title on line 1, subhint on line 2 (italic serif). The 38px min-height absorbs cells with no subhint (Monthly need) so they line up with the goals/incomes/events headers.

3. **Monthly household need is now a slider (0–R 300 000 · default 0).** `<input type="text" id="needs-monthly" value="50 000">` replaced with `<input type="range" id="needs-monthly" min="0" max="300000" step="1000" value="0">` plus a big readout span `#needs-monthly-out` styled to match the prior gold-R/22px-mono treatment. Cold-load target need is therefore R 0 (was R 50 000 × 12 = R 600 000); chart's target line lands at zero until the adviser drags. Engine reads via `parseCurrency('needs-monthly')` still work — `.value` on a range is a numeric string, `parseCurrency` strips non-digits, returns the integer rand value. Wiring:
   - `needs-monthly` added to `sliderIds` so the input listener attaches `updateSliderFill` + `refresh()`.
   - `needs-monthly` removed from `hpInputs` (the text-input blur-format list) — `formatCurrencyInput` would otherwise force-stringify the slider value.
   - `updateLeverLabels()` writes the readout: `set('needs-monthly-out', Math.round(read('needs-monthly')).toLocaleString('en-ZA').replace(/,/g, ' '))` — produces `0` / `50 000`. The `R` prefix lives in markup so the readout span carries just the number.
   - `setupRailSpendingSlider` extended to handle a range-typed canonical: when canonical is a `<input type="range">`, the rail's input handler writes `String(v)` directly (a range input rejects `"50 000"` style strings) and calls `updateSliderFill(canonical)`. Text-input canonicals continue to receive the formatted "50 000" string. The rail slider stays at its existing ±R30k anchor-and-swing behaviour relative to the canonical.

4. **Market assumptions row split into two clearly-labelled cells.** Was a single `.empty-assumptions` flex row with `[range][num] · [range][num]` and a hint `return · CPI` below. Now a 2-column grid with named cells:
   - Cell 1: `ASSUM-LABEL: Investment return` + `[range][num 9.00%]` row.
   - Cell 2: `ASSUM-LABEL: Inflation` + `[range][num 5.00%]` row.
   - The redundant `return · CPI` hint dropped. `.assum-label` shares the eyebrow style language (Inter Tight 11px uppercase, 1.4px tracking, mute colour) so it harmonises with the rest of State 1's section labels.

5. **Rail "Annual lumps" slider removed.** The `.rail-slider` block + `setupRailSpendingSlider('needs-lump', ...)` call deleted. With monthly-need now defaulting to 0 and the canonical lumps having defaulted to 0 since Session 28, the rail slider was orphaned (no canonical State-1 affordance, no diff signal). Hidden `#needs-lump` input retained so `parseCurrency('needs-lump')` reads in `targetPVAnnual` continue to resolve to 0.

6. **v2 report's GE "Annual lump-sum needs" row dropped.** `renderLifestyleSection` returns only the Monthly lifestyle income row. `lifestyleChangeCount` simplified — only `monthlyNeed` is compared to baseline, since `annualLumpSums` is constant 0 across both runs. Section subtitle now reads `1 item` (or `1 item · 1 changed` when scenario monthly differs). Diff badge logic for `annualLumpSums` removed (would have been unreachable). The v1 single-run path's appendix-style "Annual lump sums" row in the plan-inputs verbatim section (line ~3583) is preserved — that's a compliance artefact and a verbatim record should still show the field, even at R 0.

7. **Income chart stacking reordered: LA → Other → Disc → Tax (was LA → Disc → Other → Tax).** Pierre wanted Other income pinned in the second slot — it reads as a more stable, predictable layer when the conversation is about "where does the income come from this year?" Disc moves to the third slot, just below the tax cap. Updates in three places:
   - `buildIncomeChart` main datasets array: indices [1] and [2] swapped (Other now at [1], Disc at [2]). Stack still follows array index — no `order:` props.
   - `buildCompareMiniChart` (Scenarios two-up cards): same swap on the cmp datasets, same swap on the `ref.data.datasets[i].data = bars.X` update path.
   - `INCOME_DATASET_INDEX` lookup → `{ la: 0, other: 1, disc: 2, target: 3, tax: 4 }`. The legend pill toggle handler reads through this map; series-toggle keys (`la` / `disc` / `other` / `tax` / `target`) unchanged so legend HTML didn't move.
   - Report's inline-SVG `renderIncomeChart`: paint order swapped from `LA → Disc → Other` to `LA → Other → Disc` so the printed PDF matches the screen.

   The colours stay the same per source (LA teal, Other navy-soft, Disc gold, Tax pink); only the y-stacking order flipped.

**Architectural decisions**
- **Slider over text input for Monthly need.** Pierre asked for a slider; the trade-off is precision vs. expressiveness. R 1 000 step gives 300 ticks across the 0–300k range — adequate for client meetings where "around R 50k/mo" is the conversation, not "exactly R 53 715". If finer precision is ever needed, the existing rail Monthly-need slider (`±R 30k` swing around canonical) gives the adviser a fine-tune affordance on Planning without leaving the chart in view.
- **Default 0, not the previous R 50 000.** Pierre's explicit request. Aligns with the "blank calculator on cold load" principle — the adviser walks the client through every input deliberately rather than starting from a planted default. Cold-load target line lands at R 0; the conversation begins by dragging the slider up.
- **`min-height: 38px` on steplabel rather than markup placeholders.** Considered injecting an invisible `&nbsp;` second line into bare-title steplabels (Monthly need, Spouse cards) to force uniform height without CSS. Rejected: invisible whitespace is a debugging trap and the min-height is one declaration. Steplabels with a subhint stack to ~33px (1 title line + 1 subhint line); the 38px reserves room for subhint wrapping at smaller viewports without growing the cell when subhint fits on one line.
- **Range canonical via direct value-write + manual `updateSliderFill`, not via dispatched input event.** Could have done `canonical.value = String(v); canonical.dispatchEvent(new Event('input', { bubbles: true }))` and let the canonical's own listener handle fill + refresh. Rejected: dispatching `input` would fire `recenter` (the rail's anchor-recompute helper listens to canonical's input) on every rail drag, re-anchoring the rail slider to its current value mid-drag and breaking the ±R 30k swing UX. Direct write + explicit `updateSliderFill(canonical)` keeps the rail's drag isolated from canonical's anchor.
- **Engine untouched.** 115/115 Python + 45/45 JS pass. No `project()` arithmetic touched; only DOM shape, listener wiring, and presentation.

**Smoke check**
- `cd tests/python && pytest` → 115 passed.
- `cd tests/js && node run.js` → 45 passed.
- Both inline scripts parse cleanly under `new Function()`.
- No `class="rom"` references remain anywhere in `retirement_drawdown.html`.

**Follow-ups**
- Browser walkthrough at 1366×768: open `retirement_drawdown.html` fresh, confirm State 1 reads cleanly without numerals, the Monthly need slider sits at 0 with the readout showing `R 0`, and dragging it updates the readout + chart target. On Planning, confirm the rail's Monthly-need slider stays anchored to the new canonical value (the ±R 30k swing should track wherever Pierre dragged the State 1 slider). Add a couple of incomes + events of unequal counts and confirm the "+ Add …" buttons sit at the same y across both columns.
- Report end-to-end: lock a baseline with Monthly = R 50k, drag scenario to R 60k, click Export Report — confirm the dual-run GE Lifestyle section shows a single row (`Monthly lifestyle income`) on both runs, with the `↑ uplifted` badge + coral amount + `+ R 10 000/mo vs. baseline` narrative on the scenario side.
- The Spouse-card defaults (R 4m LA / R 1m disc / R 500k base cost) still planted on cold load. If "blank everywhere" becomes the broader pattern Pierre wants, those would need to default to 0 next.

### Session 28 — 2026-05-07 (state-1 paired layout · annual lump sums folded into Goals)

**Built / changed** — Info-screen restructure on `claude/pull-main-create-feature-wnlLl`. State 1 (the setup screen Pierre walks the couple through at the top of the meeting) was reflowed from "two stacked strips below the spouse cards" into a 4-row paired-grid narrative, and Annual lump sums was retired from the visible UI in favour of modelling the same need as a Goal. Engine math untouched: **115/115 Python + 45/45 JS** pass (test counts inherit Session 27's additions).

**Why it was wrong before.** Roman numerals on State 1 ran I, II → VI, VII, VIII → III, IV, V because the ledgers (Other income / Capital events / Goals) had been promoted above the fold in Session 17 without resequencing. Reading order didn't match numeral order. Annual lump sums was also a redundant concept once Goals shipped (Session 17): a Goal with `everyNYears: 1` over the household horizon expresses the same recurring lump-sum drain, with finer control (label, age range, escalation cadence). Two ways to enter the same thing is a UI smell.

1. **State 1 DOM reorganised into 4 rows.** The visible content under the title plate + couple/single toggle is now:
   - **Row 1**: Spouse A (I) | Spouse B (II) — `.empty-setup`, unchanged.
   - **Row 2**: Monthly household need (III) | Goals (IV) — paired in `.empty-ledgers` (now 2-col).
   - **Row 3**: Other taxable income (V) | Family capital events (VI) — paired in a second `.empty-ledgers`.
   - **Row 4**: Market assumptions (VII) — full-width band in new `.empty-markets`.
   Roman numerals now run I-VII in document order. The Goals subhint extended to mention "lump-sum needs" so users know where the retired Annual lump sums affordance went.

2. **`.empty-ledgers` re-purposed from 3-col to 2-col.** Was `grid-template-columns: 1fr 1fr 1fr; gap: 24px; mb: 36px` for the old (Other income | Capital events | Goals) row; now `1fr 1fr; gap: 28px; mb: 28px` and used twice (Row 2 + Row 3). The class name is generic enough — left as-is rather than renamed to avoid a sweep through any external readers.

3. **`.empty-needs` strip class deleted.** Was the bordered 3-col container holding Monthly + Lump + Markets. With Lump removed and Monthly + Markets relocated, the container has no role. Cell-divider rules `.empty-needs-cell:first-child` / `:last-child` deleted; `.empty-needs-cell { padding: 0 }` retained because the Monthly cell still uses `.empty-needs-cell .input-wrap.large` + `.empty-needs-cell .hint` styling inside the new pair-grid. The mobile rule at the bottom of `.empty-canvas` lost its `.empty-needs { 1fr; gap: 18px }` line for the same reason.

4. **`.empty-markets` band added.** Mirrors the framing the old `.empty-needs` strip carried (top + bottom hairlines, 24px y-padding, 28px bottom margin) so Markets reads as a deliberate cap on the page rather than an afterthought tacked below the ledgers. The `.hint { return · CPI }` selector below it was scoped under `.empty-markets .hint` via a comma-extension on the existing `.empty-needs-cell .hint` rule — same italic 11px serif visual.

5. **Annual lump sums removed from the visible UI.** The `<input id="needs-lump" value="100 000">` cell + label deleted from State 1 DOM. A hidden `<input type="text" id="needs-lump" value="0" hidden>` was added to the existing hidden-inputs block so engine reads (`parseCurrency('needs-lump')` at retirement_drawdown.html:3510 + 4003, the `needs-monthly * 12 + needs-lump` formula in `getCurrentTargetPV`, the snapshot capture at line 6489's `annualLumpSums: parseCurrency('needs-lump')`) all resolve cleanly to 0 without code changes. The rail's "Annual lumps ±R100k" slider on Planning is still wired (lines 2818, 2820, 6283); it now defaults to 0 instead of 100 000 on cold load. Tracked as orphan affordance in `TECH_DEBT.md` for a follow-up cut.

**Architectural decisions**
- **Hidden `needs-lump` over engine surgery.** Considered ripping `parseCurrency('needs-lump')` out of every read site and rewriting `targetPVAnnual = monthly * 12` directly. Rejected: the engine reads, the snapshot field `annualLumpSums`, the report's GE Lifestyle row "Annual lump-sum needs", the v2 diff badge logic that compares scenario vs. baseline `annualLumpSums` — all keep working byte-identical when `needs-lump` is just always 0. A rip would touch ~6 calculator sites, the snapshot schema (still v2), the report renderer, and the diff helper. Hidden 0 is one line and zero regression risk; the concept retires gracefully.
- **`.empty-ledgers` reused for both pair rows over a new class.** The class name is colour-neutral once it's 2-col (it's just "a paired row in the empty canvas"). Reusing it keeps the mobile collapse rule (`.empty-ledgers { grid-template-columns: 1fr; gap: 24px }`) covering both pair rows with one selector. A new class would have meant duplicate mobile rules.
- **Markets stays full-width, not paired.** Tried pairing Markets with another scalar but nothing else on State 1 wants the same visual weight (return + CPI sliders + numeric readouts). Full-width with the bordered band echoes the old strip framing and gives the two sliders room to stretch.
- **Goals subhint extended, not the steplabel.** The Goals section already had `recurring household expenses — travel, cars, holidays`; appending `, lump-sum needs` keeps the original framing intact and signals where the retired affordance moved. Cleaner than adding a "lump sums →" pointer or a dismiss-once banner.
- **Engine + tests untouched.** 115/115 Python + 45/45 JS pass post-merge. No schema change, no Python parity test needed, no snapshot bump. The only behaviour delta is a default-value change (cold-load target drops from R 700k/yr to R 600k/yr because lump now defaults to 0 instead of 100 000); everything else is presentation.

**Smoke check**
Tests both green. Browser walkthrough deferred to user — open `retirement_drawdown.html` fresh, confirm Info renders four rows in the order above with numerals I-VII running, then on Planning confirm the chart still draws against a R 600k target line (was R 700k pre-change). The "Annual lumps" rail slider should sit at 0 on cold load; dragging it still injects lump in the engine reads.

**Follow-ups**
- Rail "Annual lumps" slider is now an orphan (defaults to 0, no canonical State 1 affordance feeds it). Either remove the slider DOM + the `setupRailSpendingSlider('needs-lump', ...)` call at line 6283, or leave it as a power-user shortcut. Logged in `TECH_DEBT.md`.
- v2 dual-run report's GE Lifestyle section still renders the "Annual lump-sum needs" row sourced from `plan.annualLumpSums`. With lump now always 0, the row will show R 0 by default. Consider dropping the row from the lifestyle stack entirely (one-line edit in the report's `renderLifestyleSection`), or leaving it as a visible 0 for completeness.
- v2 diff helper compares `annualLumpSums` between baseline + scenario for the `↑ uplifted/reduced` Lifestyle badge. With lump always 0 in the new world it'll never trigger, but the code path is harmless.

### Session 27 — 2026-04-28 (sustainableTo net-vs-net fix · I12 invariant)

**Built / changed** — surgical follow-up after Pierre A/B'd the Session 26 export and spotted that the report headline said "the same household carries to age 96" while the income chart's coral wash started at age 94. Two paths computed first-shortfall age and disagreed by 2 years. Tests: **115/115 Python · 45/45 JS** (was 41 — added 3 deriveMilestones cases + 1 I12 trip).

**Why the headline was off.** Two functions in the calculator detect shortfall and they used different comparisons:
- `buildProjectionPayload` (line 6481, post Session 25): `r.shortfall = (totalIncome - tax) < requiredNom - 1` — **net vs net**. Drives the chart's per-row coral wash.
- `deriveMilestones` (line 6307, pre this session): `shortfall = pp.nominal.draw[i] < pp.nominal.target[i] - 1` — **gross vs net**. Drives `proj.sustainableTo`, which the report's headline copy reads.

The engine's solver treats `nominal.target` as a NET (after-tax) target — Session 25 fixed `buildProjectionPayload` accordingly, but the parallel fix in `deriveMilestones` was missed. At typical SARS marginal rates gross sits ~25% above net, so gross stays above the net target for ~2-3 more years than net does, and `sustainableTo` over-reported by exactly that margin. Calculator outcome strip on Planning was unaffected (it reads from `analyseProjection`, which has done net-vs-net real all along) — the bug was scoped to the snapshot pipeline → report headlines.

1. **`deriveMilestones` line 6307**: changed from `var shortfall = (rs[i] || 0) < (ts[i] || 0) - 1;` to read `pp.nominal.tax[i]` and compare `(rs[i] - taxes[i]) < target - 1`. Tolerance stays at R1 (matches `r.shortfall`). All other milestones (`depletesAt` / `laCapHitAt` / `discExhaustsAt`) untouched — they're balance-driven, not income-vs-target.

2. **New invariant I12 in `validateSnapshot`**: when `sustainableTo` is non-null, the row at that age must have `shortfall === false`. Ties the two derivations together structurally — if a future change ever causes `deriveMilestones` and `buildProjectionPayload` to disagree, the export will throw with a visible alert before the snapshot ships. This is exactly the defence-in-depth Session 26's framework was built for; the bug found two days later proves the framework's value.

3. **JS test additions** (`tests/js/run.js`): three focused cases for `deriveMilestones` exercising the net-vs-net contract (gross > target but net < target → sustainableTo stays null, recovery scenarios, regression guard) plus an I12-trip case in `validateSnapshot`. The `makeValidSnapshot` test fixture was also tightened — the pre-existing version had a hardcoded `sustainableTo: 95` that didn't agree with the row-level shortfall flags it generated. I12 caught the inconsistency in the test fixture itself, which is exactly what it should do; fixed by scaling all the per-row income / tax values by CPI so net consistently exceeds target every year.

**Architectural decisions**
- **Tolerance asymmetry between `analyseProjection` (R100, real) and `deriveMilestones` (R1, nominal) left as-is.** Both compute shortfall correctly net-vs-net after this fix; in extreme edge cases they could disagree by 1 year due to different tolerances. Not a problem for typical scenarios; if Pierre sees a 1-year mismatch between the calculator outcome strip and the report headline, that's the next thread to pull.
- **No engine math change.** `project()`, `solveTopUp`, `stepPerson` byte-for-byte identical. Only `deriveMilestones` (pure helper, reads engine output) and `validateSnapshot` (new check) touched. 115/115 Python pass.
- **Fingerprint will change for the same plan inputs.** `sustainableTo` is one of the 6 anchor numbers — old reports printed before this fix will show a different fingerprint than the live calculator after deploying. That's the point: the fix is correct, so old fingerprints reflect the old (wrong) number; new ones reflect the corrected number. Adviser may notice their pre-fix PDFs no longer match a refreshed calculator screen — by design.
- **Knock-on audit ran first.** Before shipping, traced every consumer: calculator outcome strip uses `analyseProjection` (correct), report headlines use `proj.sustainableTo` (fixes), capital chart slice clamps at age 99 (no visible change), v1 Compare slide delta preserved (both halves shift together), Python parity port has no `sustainable_to` consumer (no test churn). Single chart-slice path was the only "could change geometry" risk; verified clamped behaviour leaves it visually identical.

**Smoke check**
- `cd tests/python && pytest` → 115 passed
- `cd tests/js && node run.js` → 45 passed
- Both inline scripts parse cleanly under `new Function()`.

**Follow-ups**
- Browser walkthrough: open the calculator, watch `fp:` change after the fix lands. Click Export Report, confirm the cover-slide fingerprint matches the screen. The headline on the Answer / Run-income slides should now read the same age the chart's coral wash signals.
- If Pierre's compliance archive contains a pre-fix PDF that needs to be re-issued, flag the discrepancy: the old PDF's "carries to age 96" overstated the sustainable horizon by ~2 years.
- Tolerance reconciliation between `analyseProjection` (R100 real) and `deriveMilestones` (R1 nominal) — only relevant if a 1-year edge-case mismatch surfaces in practice.

### Session 26 — 2026-04-28 (verification chain: appendix · invariants · fingerprint · netParts collapse)

**Built / changed** — four coordinated pieces tightening the calculator ↔ report verification chain. Pierre's worry was structural: Sessions 22 + 25 both shipped wrong client numbers because of a misleadingly-named field and a duplicated derivation path, with no way for the adviser to verify what the report carried. Engine math untouched: **115/115 Python (was 108) + 41/41 JS (was 19) pass.**

1. **Compliance appendix slides A–E** in `retirement_drawdown_report.html`. Five new dense year-by-year verification tables append at the end of every export — Income chart data (year/age/LA-net/Disc-net/Other-net/Tax/Net total/Target need), Capital chart data (balances + withdrawal rate %), Spouse A tax breakdown (LA draw / Other taxable / Gain / Inclusion / Taxable / Pre-rebate / Rebate / Tax / Eff%), Spouse B tax (dropped in single-client mode), and Plan inputs verbatim (every spouse / goal / event / income stream as written). Coral header bar carries "STRIP BEFORE SENDING TO CLIENT" — the slides are designed to be visibly internal so they can never be mistaken for client material. Adviser saves the full PDF to compliance archive and strips appendix pages before sending the client copy. **In dual-run mode each appendix is cloned per-run** (10 slides total: 5 baseline + 5 scenario, with a "Baseline run" / "Scenario run" tag injected into the eyebrow during cloning) so both runs are independently verifiable. Setup wiring lives in `setupSingleRun()` (reveal + drop-D-if-single) and `setupDualRun()` (KEEP-set + clone via `cloneAppendix(suffix)` mirroring the existing `makeRun(suffix)` pattern). `renumberSlides()` extended: appendix slides keep their static lettered labels (`Appendix A` etc.) — the rn walker explicitly skips them and subtracts `appendixCount` from `i` so client-facing slides retain natural Roman numbering.

2. **`validateSnapshot(proj, plan, label)` in the calculator.** 11 identity assertions, runs inside `buildReportSnapshot` before the snapshot is returned. Each captures a Session-22 / Session-25 class of bug:
   - I1: `totalIncome === laDraw + discDraw + otherIncome` (within R1).
   - I2: `totalIncome - tax >= 0` (net never negative).
   - I3: `shortfall === ((totalIncome - tax) < requiredNom - 1)` (Session-25 net-vs-net comparison).
   - I4: `laBalance >= 0 && discBalance >= 0`.
   - I5: `sustainableTo` (when not null) lies in `[startAge, horizonAge]`.
   - I6: `taxByPerson.length === (single ? 1 : 2)`.
   - I7: `hhTax === taxA.tax + (single ? 0 : taxB.tax)` (within R1).
   - I8: `year1.age === startAge`.
   - I9: `requiredNom > 0` for the first 10 rows.
   - I10: every `event.year === row.year`.
   - I11: `netTotal === totalIncome - tax` (when present — locks Component 4's contract).

   On any failure: `console.error()` the offending values + throw with a `label / code — msg` message. The export-click handler at line ~6586 already wraps `buildReportSnapshot()` in `try/catch` + `alert(...)` so the failure surfaces visibly to the adviser. Both halves validated when a baseline is locked. JS tests cover happy path + each invariant trip individually.

3. **Snapshot fingerprint** (`fingerprint6` + `fingerprintFromProjection`). 6-char base36 hash via synchronous djb2 — chosen over `crypto.subtle.digest` because the latter is async and would force the export-click into a Promise chain. Anchors: Y1 gross income, Y1 net income, `sustainableTo`, household gross, mid-horizon gross income, end-horizon total capital. Values rounded to rand precision so float wobble between Chart.js paints doesn't change the hash. Same hash function is called from `refresh()` (using the cached `lastProjection` — no extra `project()` call) to paint `fp:abc123` into a new mono span inside `.tab-nav-actions` next to the Export-report button, AND inside `buildReportSnapshot()` to emit `snapshot.fingerprint`. Report's cover slide cover-foot gained a 5th cell with `data-field="fingerprint"`; `renderShared()` paints it. Adviser glances at both surfaces — match means the PDF in hand was produced from the screen state currently visible. Mismatch means someone exported, then changed an input, then printed a stale tab.

4. **`netParts` duplication collapsed.** `incomeBarSeries()` (calculator line ~4348) and `netParts(r)` (report line ~2798) were two implementations of one tax-apportionment rule (LA/Disc/Other split household tax in proportion to gross share). The report's `netParts(r)` is now a 4-line lookup that reads pre-computed `r.netLA / netDisc / netOther / netTotal` from the snapshot, with a legacy fallback to gross stacking for old localStorage snapshots. The formula now lives once on the calculator side, in `buildProjectionPayload`. Calculator UI's `incomeBarSeries` retains its `realMode` deflation branch — the calculator UI supports a Real|Nominal toggle; the snapshot is nominal-only by design (Session 24 settled the report on nominal). New Python parity test `tests/python/test_net_apportionment.py` (7 cases) locks the formula so future drift between calculator JS and Python port surfaces as a test failure, not a wrong client PDF.

**Architectural decisions**
- **Appendix per-run in dual-run, not side-by-side.** Considered shared 5-slide appendix with baseline + scenario columns side-by-side (~16 cols at A4 landscape). Rejected: column density would force fonts below 10px to fit, and verification is cleaner when each table maps 1:1 to a chart in the deck above. Per-run produces 10 slides but each is straightforwardly readable.
- **`taxA_objs / taxB_objs` added to snapshot, not just to engine result.** Appendix C/D needs per-year per-spouse tax breakdown. The engine's `taxA_obj_series` already exists (Session 16); previously only Y1 (`taxA`/`taxB`) was on the snapshot. Lifting the full arrays adds ~6 lines + ~1 KB per export — small cost for the most diagnostically valuable verification table in the appendix.
- **Fingerprint is djb2, not SHA.** SubtleCrypto is async; converting the export flow to a Promise chain would touch every consumer. djb2 is 10 lines, deterministic, no deps. The fingerprint's job is "did the same numbers go in?" — collision resistance against adversarial inputs is not part of the threat model.
- **Fingerprint computed from `lastProjection`, not from a full snapshot rebuild.** `refresh()` runs on every input change; rebuilding the full snapshot (deep-clone of plan inputs + per-row payload + validation) every keystroke would be wasteful. Reading anchors directly off `p.table` and `p.nominal` is essentially free.
- **Invariants throw, not warn.** Pierre wants loud failure, not silent corruption. The existing click-handler `try/catch + alert` was already the right shape — invariants ride that path without modifying the handler.
- **Misleading `p.nominal.total` not renamed.** Architecture doc has flagged it as a trap twice; cost-benefit may shift again. Each component above closes the immediate verification gap without the rename sweep, which would touch the calculator + Python tests + every consumer.
- **Engine untouched.** 115/115 Python + 41/41 JS pass. `project()`, `solveTopUp`, `stepPerson` byte-for-byte identical. Only the snapshot shape (additive: `netLA / netDisc / netOther / netTotal / taxA_objs / taxB_objs / fingerprint`) and presentation grew.

**Smoke check**
JS test suite: `node tests/js/run.js` — 41/41 pass (was 19), covering fingerprint determinism + sensitivity + format, all 11 invariants with happy-path + per-invariant-trip, plus the existing solver tests.
Python test suite: `pytest` — 115/115 pass (was 108), with 7 new `test_net_apportionment.py` cases.
Both inline scripts parse cleanly under `new Function()`. Browser walkthrough at A4 landscape print preview deferred to user — the calculator's `tab-nav-actions` + report's cover-foot are both visible on first load; appendix slides paginate one-per-page via the existing `.slide { page-break-after: always }` rule.

**Follow-ups**
- Browser walkthrough at 1366×768: open `retirement_drawdown.html`, watch the `fp:` string in the top-nav change as sliders move. Click Export Report. Cover slide of the new tab should display the same fingerprint. Scroll to the end — 5 coral-headered appendix slides (or 10 in dual-run) with dense tables. Spot-check Appendix A's first row against the income chart's year-1 bar in the deck above.
- DevTools verification of invariants: in console after a successful export, `var s = JSON.parse(localStorage['sw-drawdown-snapshot']); s.projection.rows[0].totalIncome = 999; localStorage.setItem('sw-drawdown-snapshot', JSON.stringify(s));` then click Export Report → should `alert("scenario / I1 — totalIncome != laDraw + discDraw + otherIncome")` instead of opening the report.
- Print preview: confirm the coral header bar of appendix slides survives `print-color-adjust: exact` (already on `.slide` via the existing print stylesheet).
- 40+ year horizon: the appendix tables fit ~35 rows at 10.5px font. If a longer horizon overflows A4, add a "(continued)" pattern. Defer until observed.
- Document the asymmetry that snapshot net is nominal-only (no Real-mode equivalent) — the relevant note is in `buildProjectionPayload` near the apportionment block.


_Sessions 1–25 archived in `docs/SESSION_LOG.md`._
