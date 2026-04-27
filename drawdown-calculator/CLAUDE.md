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

_Sessions 1–15 archived in `docs/SESSION_LOG.md`._
