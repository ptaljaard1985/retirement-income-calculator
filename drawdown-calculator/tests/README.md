# Tests

Two separate test suites, both of which must pass before any change ships.

## Python tests — math audits

Location: `tests/python/`.

These implement the SARS tax rules, CGT mechanics, LA clamp logic, and the three-phase top-up solver from scratch in Python (`conftest.py`). They then assert that specific inputs produce specific outputs, checked against closed-form financial formulas where possible.

The point is **cross-implementation validation**. A bug in the JS where a formula is wrong will produce a number that matches no closed-form calculation. The Python tests will catch this. A bug in the JS where the spec was misunderstood will produce numbers consistent with the misunderstood spec — but the Python port will replicate the same bug, so these tests *won't* catch it. That's fine; the JS tests catch the other class of bug.

Run them with:

```bash
cd tests/python
pip install pytest       # one-time
pytest                   # or `pytest -v` for verbose output
```

Current count: **498 passing** (450 + 48 parity).

## JS tests — solver behaviour

Location: `tests/js/`.

These exercise the actual JS `solveTopUp` function (and a handful of helpers) by extracting it from `retirement_drawdown.html` and running it under Node. No Jest dependency — just `node run.js` and the built-in `assert` module.

The point is **real-code validation**. Anything the JS actually does is what these tests exercise. Scope issues, closure bugs, iteration count regressions — these show up here.

Run them with:

```bash
cd tests/js
node run.js
```

Exit code 0 = all pass. Any failure prints a stack trace and exits non-zero.

Current count: **45 passing**.

## When to add a test

- **Adding a new calculation**: add a Python test that implements the same math in Python and asserts both agree.
- **Fixing a bug**: add a test that fails before the fix and passes after. If it's an algorithmic bug (e.g. the Phase 3 compounding issue), the JS test catches it. If it's a spec bug (e.g. wrong tax bracket), the Python test catches it.
- **Updating SARS tables**: update the expected numbers in the tax tests. See `docs/SARS_UPDATES.md`.
- **Adding a UI feature**: usually no test needed. UI is verified by eye.

## Testing strategy — five tiers

The suite is organised into five tiers, ordered by what they protect against. The current tiers in place are 1 (closed-form units) and 3 (property invariants). Tiers 2, 4, and 5 are documented here as the planned roadmap.

| Tier | Status | What it protects against |
|---|---|---|
| 1. Closed-form unit tests | **In place** (115 cases) | A formula is wrong against SARS, CGT, or clamp regulation. |
| 2. JS ↔ Python parity | **In place** (48 cases) | The two implementations have drifted from each other. |
| 3. Property-based invariants | **In place** (335 cases) | Engine produces NaN, negative balances, violates regulation, or drifts in cost-basis arithmetic in any input region. |
| 4. SARS-table refresh battery | **Planned** | The annual Feb-budget refresh quietly breaks a bracket-edge case. |
| 5. Snapshot tests | **Planned** | The full trajectory drifts silently between sessions. |

### Tier 1 — Closed-form unit tests (in place)

Files: `test_tax.py`, `test_la_draws.py`, `test_topup.py`, `test_boost.py`, `test_events.py`, `test_goals.py`, `test_other_income.py`, `test_other_income_taxable.py`, `test_single_spouse.py`, `test_cap_flag_propagation.py`, `test_net_apportionment.py`.

These test the *building blocks* of the engine against closed-form expectations. Pre-rebate tax, rebate-by-age, CGT inclusion, LA clamp band, CPI escalation, and the three-phase solver convergence on representative inputs. Every expected number has either a closed-form derivation, a SARS-table lookup, or a hand-traced calculation behind it.

This is the "the formula is right" tier. Externally verifiable in TaxTim, SARS eFiling, or pen-and-paper.

### Tier 2 — JS ↔ Python parity (in place)

Files: `tests/js/parity_runner.js` (Node harness), `tests/python/test_js_parity.py` (pytest).

For every scenario in the Tier-3 grid, runs `project()` through both engines and asserts row-by-row equality on every series:

- The Python port via `conftest.py::project()`.
- The actual JS engine: a Node harness loads `retirement_drawdown.html`'s inline `<script>`, injects a `globalThis.__pari` exposure right before the IIFE close, runs the script under a DOM stub, then calls `project()` once per scenario with controlled inputs.

The harness's DOM stub backs `getElementById(...).value` reads with a per-scenario `DOM_VALUES` map. Stores (`eventsStore` / `incomeStore` / `goalsStore`) are mutated in place via the exposed closure refs so each scenario's events / income schedule / goals override the seeded defaults.

The parity layer catches the bug class neither Tier 1 nor Tier 3 covers: drift between two implementations of the same spec. The Session-22 (`totalIncome` reading the capital series), Session-25 (`sustainableTo` net-vs-gross), and Session-30 (chart-data dataset swap) bugs were all JS-only — they would have surfaced under parity rather than being caught by Pierre A/B'ing the printed report.

Skipped automatically when Node is not on PATH or the harness fails. Tolerance is R 1 (the two engines run the same arithmetic on the same inputs and should be bit-identical; R 1 covers ordering noise in the proportional-cost CGT calculation).

**Note on base-cost coverage:** The parity test compares balance, draw, tax, net, and clamp series — not the base-cost series, because the JS engine doesn't expose `discA_base` / `discB_base` outwardly. This is sound: if the Python base trajectory is correct (locked by the Tier-3 base-cost identity invariant) AND the JS produces identical tax (which is computed from gain = draw − cost_used), then JS's internal base trajectory must also be correct.

### Tier 3 — Property-based invariants (in place)

File: `test_invariants.py`. **335 cases** across ~25 named scenarios.

Where unit tests check specific numbers, property tests assert structural promises that must hold for ANY input within the calculator's domain:

- **I-FIN** — no NaN, no Inf in any series cell of any scenario.
- **I-NEG** — LA and disc balances stay ≥ 0 across the entire horizon.
- **I-LA-PCT** — `la_draw / la_balance_start ∈ [0.025, 0.175]` whenever balance > 0 (the legislated band).
- **I-TAX-POS / I-TAX-MAX** — tax ≥ 0 (rebate floor) AND tax ≤ gross × 45% (top marginal rate).
- **I-NET-POS** — net = gross − tax never negative.
- **I-EVOL** — strict per-year capital-evolution identity: `bal_start[y+1] = (bal_start[y] − draw[y]) × (1 + r) ± events_y+1`. The most powerful invariant: if the per-year balance arithmetic holds for every year of every scenario, the year-loop has no silent bugs (events landing in the wrong year, growth applied twice, draws applied at the wrong point). Includes a parallel **base-cost** identity: `base[y+1] = base[y] − base[y] × (draw[y] / bal[y]) + events_y+1` — locks the proportional / weighted-average cost-basis method against drift to FIFO or specific-ID.
- **I-CONV** — when Phase 2 is active, the solver may converge or under-shoot (insufficient pots) but never over-shoots beyond tolerance. Phase-3 boost-compounding regression is covered separately by `test_boost.py`.
- **I-FEAT** — feature-specific consistency: capital events bump disc by exact nominal; goals bump targets in qualifying years only; tax-free streams flow to net without raising tax.

Scenario grid spans ~25 cases: representative couples (Hayes baseline, HNW, disc-heavy, single widow, age 80+), pathological edges (zero balances, top-bracket inputs, forced depletion, base-cost > balance), and feature-rich combinations (events + goals + mixed-taxability income on the same plan).

This catches a different class of bug than Tier 1 — the "engine produces nonsense for some input region" class. Fuzz-tester-style coverage without `hypothesis` (kept dependency-free).

### Tier 4 — SARS-table refresh battery (planned)

Extension of `test_tax.py` to ~25 anchor points across every SARS bracket boundary, every rebate threshold, just-above and just-below each boundary, and a creep-against-CPI matrix at years 5/10/20/30. Makes the annual SARS update playbook (`docs/SARS_UPDATES.md`) safer — the test diff after a Feb-budget refresh tells you exactly which numbers shifted and by how much.

Estimated effort: ~1.5 hours.

### Tier 5 — Snapshot tests (planned)

For 3-5 representative scenarios, store the full `project()` output (every series, every year) as a JSON snapshot in `tests/python/snapshots/`. Future runs compare against the snapshot. Trajectory cannot be externally verified by any single tool (assumptions in tax-timing, CGT base-cost method, and solver tolerance vary tool-by-tool, shifting milestones by 1-2 years across "correct" implementations) — so the snapshot freezes "the version we and the adviser agreed was right" and alerts on any subsequent drift.

When the SARS tables update or the engine intentionally changes, the snapshot is regenerated deliberately as part of the change. Otherwise, drift = test failure.

Combined with Tier 1 (building blocks externally correct) + Tier 2 (JS ↔ Python parity) + Tier 3 (engine doesn't produce nonsense), the snapshot tier locks down the trajectory without claiming an external authority over numbers that no tool can authoritatively resolve.

Estimated effort: ~2 hours.

## What the tests *don't* do

- **Rendering.** No headless browser, no visual regression. The UI is simple enough that a developer can spot regressions by opening the file and looking at it.
- **Print preview.** Printed output is checked manually before shipping.
- **Chart.js interactions.** The chart library is trusted.
- **Performance.** The calculator is fast enough that any observable slowdown would be caused by an infinite loop or similar, not a gradual regression.
- **Year-N trajectory anchors against external tools.** Year-N magnitudes (capital balance at year 20, sustainable-to-age) cannot be externally verified — tools differ on tax-timing assumptions, CGT base-cost method, and solver tolerance, shifting milestones by 1-2 years across "correct" implementations. Tier 5 (planned) handles this via internal snapshot tests rather than external authority.

## CI

GitHub Actions workflow at `.github/workflows/tests.yml` runs on every push to `main` and every PR. It installs Python 3.12 + Node 20, runs an inline-script syntax check on both HTML files, then executes the full Python suite and the JS solver suite. Any non-zero exit fails the workflow.
