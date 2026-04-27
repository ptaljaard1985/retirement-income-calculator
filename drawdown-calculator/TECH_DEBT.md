# Tech debt

Small, deliberate debts accumulated while building the calculator. Not a to-do list — just things a future session should know about before changing the surrounding code.

## Open

### Report capital chart still renders in nominal terms
**Where:** `retirement_drawdown_report.html` — `renderCapitalChart` (line ~2889) call site at line ~3271
**Why:** Session 21 fixed the income-chart y-axis blow-up by deflating per-row income/draw values to today's-rand via `toRealRows()`. The capital chart was deliberately left in nominal because (a) its y-axis represents capital balances rather than expenses (the user's diagnosis was specifically about "max annual expenses"), and (b) capital-balance nominal growth is part of the story being told (real value in year 30 is intuitively smaller than nominal). If Pierre flags the capital chart as visually similar — early-year stubs, peak balance dominating the y-axis — apply the same `toRealRows` pattern, but extend the helper to also deflate `laBalance / discBalance / totalCapital` (currently it only handles the four income/draw fields).
**Cleanup:** Either extend `toRealRows` to take an optional field-list, or add a sibling `toRealCapitalRows` helper. Wrap the `renderCapitalChart` call in `renderRun` (line ~3271) the same way income calls are wrapped.

### Goal `breached at age N` status flag is not computed
**Where:** `retirement_drawdown_report.html` — `renderGoalsCol` notes (v2 dual-run)
**Why:** The v2 design mock shows an Estate-floor goal flagged "Breached at age 87 in this projection — flagged for review." in coral italic. Detecting a breach requires running the projection's terminal capital against `goal.amountPV` per year, which is engine work — out of scope for the v2 GE diff cut (Session 20). The current `renderGoalsCol` writes a generic note ("Drawn from discretionary, ages X–Y.") for non-Lifestyle goals.
**Cleanup:** Add a `goalStatus(goal, projection)` helper that walks `projection.rows` and flags the first year where remaining `totalCapital < goal.amountPV` (per goal type). Surface the result on the snapshot as `plan.goals[i].status: 'ok' | 'risk'` + `breachedAt: number | null` so the report's renderer can paint coral notes without re-running math. Calculator-side change.

### `readPerson` returns `otherIncome: 0` as a placeholder
**Where:** `retirement_drawdown.html` — `readPerson(suffix)` helper
**Why:** After the schedule refactor (session 1), `sA.otherIncome` is overwritten on every iteration of the projection loop from `otherIncomeForYear(...)`. The placeholder on `readPerson`'s return object is defensive — not required for correctness.
**Cleanup:** Remove the `otherIncome: 0` key from `readPerson` once nothing outside the year loop reads `pA.otherIncome` / `pB.otherIncome`. A grep already confirms nothing does today; the placeholder is belt-and-braces.

### Python `project()` supports two paths for other income
**Where:** `tests/python/conftest.py` — `project(pA, pB, ..., incomes=None)`
**Why:** When `incomes=None`, the legacy scalar-baseline path uses `person(other=X)` as-is (matches old tests). When `incomes=[]` or a list, the schedule resolver overrides `sA['otherIncome']` per year (matches the JS).
**Cleanup:** Migrate the few remaining tests that rely on `person(other=...)` to pass `incomes=[...]` instead, then drop the dual-path. Today: `test_la_draws.py` uses `other=0` only (no real dependency); `test_topup.py` and `test_boost.py` don't pass `other` at all. Low-risk removal.

### JS-side `otherIncomeForYear` has no direct unit test
**Where:** `retirement_drawdown.html` JS helper; `tests/js/run.js`
**Why:** The function is pure and the Python port in `conftest.py` is audited by `test_other_income.py`. JS tests would duplicate logic already covered, so the audit relies on the "second implementation" discipline.
**Cleanup:** Optional. If you add any feature that changes the resolver semantics (e.g. mid-year proration, escalation from `startAge` instead of today), add a JS smoke test at the same time.

### Year-table has 17 data columns
**Where:** `retirement_drawdown.html` — `buildYearTable`
**Why:** Adding the per-spouse `Other` column pushed each spouse group to 6 sub-columns (12 + 5 household = 17, plus Year). Existing `.year-table-wrap` has `overflow-x: auto` so it scrolls, but print-preview gets tight on A4 portrait.
**Cleanup:** If print ever wraps ugly, consider landscape `@page` for the print summary's table section, or a "print-compressed" CSS that hides `LA bal` / `Disc bal` (draws are the useful numbers on paper).

### Dead `.narrative-*`, `.headline-sub`, and State-2 canvas-head-eyebrow print CSS
**Where:** `retirement_drawdown.html` — `.narrative-*` selectors around lines 931, 1531, 1541, 1550, 1551 (Session 7); `.headline-sub` selectors around lines 96 and 1382 (Session 8); print rules `.canvas-head .headline { font-size: 28px; ... }` and `.canvas-head-eyebrow { margin-bottom: 6px; }` around lines 915, 917 (Session 9).
**Why:** Successive UI passes removed the "Is this sustainable?" narrative card (S7), the State-2 editorial headline + subtitle (S8), and the State-2 eyebrow (S9). Each left its CSS behind because the "don't reformat the whole file" rule discouraged a broad sweep in the same pass. State 3 still uses `.headline` (no `-sub`) and `.canvas-head-left`, so those selectors are NOT dead — only the ones listed above.
**Cleanup:** Grep-and-delete unreferenced `.narrative*`, `.headline-sub`, and the canvas-head-eyebrow print rule in a future pass. Low risk — confirmed no HTML references.

### `.collapsible-body` has no explicit expanded max-height
**Where:** `retirement_drawdown.html` — `.collapsible-body` CSS
**Why:** The rule transitions `max-height` between `0` (collapsed) and effectively `none` (open). CSS cannot interpolate from `0` to `none`, so the Scenario-adjustments sub-sections snap open instead of sliding. Cosmetic only — the feature works.
**Cleanup:** Either (a) set an explicit numeric max-height like `1200px` on the open class, or (b) measure `scrollHeight` in JS and set `max-height: {N}px` on toggle. Option (b) is nicer but adds ~10 lines of JS.

## Closed (session 8)

- **Income-bar colored stack overshot true net-to-bank.** `incomeBarSeries()` excluded Disc from the tax apportionment and pushed it at gross. Because household tax already includes CGT on disc gains, the colored stack was `gross − tax + discShare` (too high by the disc CGT). Real shortfall years under-reported the gap. Fixed by apportioning tax across all three sources proportionally. Bar total now equals gross exactly; colored sum equals true net.
- **17.5% LA-cap flag never fired when auto-top-up was on.** `stepPerson` uses strict `target > laCeil` to flag `'cap'`. `solveTopUp` pre-clamps the target to `=== laCeil` (Phase 1) or boosts LA up to `=== laCeil` (Phase 3); `project()` then passed that value to `stepPerson` whose strict `>` missed the equality and flagged `'ok'`. The `"Both LAs at 17.5% ceiling"` chart alert and the ▲ year-table marker therefore never surfaced in auto-top-up mode. Fixed by threading `solveTopUp`'s own authoritative `clampA` / `clampB` into the series when auto-top-up is on; non-auto-top-up mode still uses `stepPerson`'s strict semantic. Regression covered by `tests/python/test_cap_flag_propagation.py`.

## Closed (session 7)

- **Income-legend routing bug** (Session 5 follow-up): `LA draw` / `Discretionary` / `Other income` pills in the income legend were silently routed through `CAPITAL_KEYS` because of overlapping `data-series` values. Fixed by discriminating on the parent legend container (`btn.closest('#legend-income')`) in the `.series-toggle` click handler at `retirement_drawdown.html:4462+`.
- **Tax slice stacked at the bottom instead of the top**: `buildIncomeChart` and `buildCompareMiniChart` set explicit `order:` properties on each dataset that inverted the stack order. Fixed by removing the `order:` properties entirely — Chart.js now stacks by array index (LA at bottom, Tax on top), matching the documented intent.

## Closed (session 1)

- _(placeholder — no items closed this session)_
