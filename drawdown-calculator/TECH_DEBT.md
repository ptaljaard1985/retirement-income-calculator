# Tech debt

Small, deliberate debts accumulated while building the calculator. Not a to-do list — just things a future session should know about before changing the surrounding code.

## Open

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

### Dead `.narrative-*` CSS after narrative block removal
**Where:** `retirement_drawdown.html` — CSS selectors around lines 931, 1531, 1541, 1550, 1551
**Why:** Session 7 removed the "Is this sustainable?" narrative card, its `updateNarrative()` function, and the `refresh()` call. The `.narrative`, `.narrative-eyebrow`, `.narrative-body` selectors are no longer referenced by any HTML but remain in the stylesheet. CLAUDE.md's "don't reformat the whole file" rule discouraged a broad sweep in the same pass.
**Cleanup:** Grep-and-delete all `.narrative*` selectors in a future pass. Low risk — confirmed no HTML references.

### `.collapsible-body` has no explicit expanded max-height
**Where:** `retirement_drawdown.html` — `.collapsible-body` CSS
**Why:** The rule transitions `max-height` between `0` (collapsed) and effectively `none` (open). CSS cannot interpolate from `0` to `none`, so the Scenario-adjustments sub-sections snap open instead of sliding. Cosmetic only — the feature works.
**Cleanup:** Either (a) set an explicit numeric max-height like `1200px` on the open class, or (b) measure `scrollHeight` in JS and set `max-height: {N}px` on toggle. Option (b) is nicer but adds ~10 lines of JS.

## Closed (session 7)

- **Income-legend routing bug** (Session 5 follow-up): `LA draw` / `Discretionary` / `Other income` pills in the income legend were silently routed through `CAPITAL_KEYS` because of overlapping `data-series` values. Fixed by discriminating on the parent legend container (`btn.closest('#legend-income')`) in the `.series-toggle` click handler at `retirement_drawdown.html:4462+`.
- **Tax slice stacked at the bottom instead of the top**: `buildIncomeChart` and `buildCompareMiniChart` set explicit `order:` properties on each dataset that inverted the stack order. Fixed by removing the `order:` properties entirely — Chart.js now stacks by array index (LA at bottom, Tax on top), matching the documented intent.

## Closed (session 1)

- _(placeholder — no items closed this session)_
