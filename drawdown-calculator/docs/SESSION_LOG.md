# Session log archive

Older session entries live here. The most recent ~5 stay in `CLAUDE.md`.

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
