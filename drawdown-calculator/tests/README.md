# Tests

Two separate test suites, both of which must pass before any change ships.

## Python tests — math audits

Location: `tests/python/`.

These implement the SARS tax rules, CGT mechanics, LA clamp logic, and the three-phase top-up solver from scratch in Python. They then assert that specific inputs produce specific outputs, checked against closed-form financial formulas where possible.

The point is **cross-implementation validation**. A bug in the JS where a formula is wrong will produce a number that matches no closed-form calculation. The Python tests will catch this. A bug in the JS where the spec was misunderstood will produce numbers consistent with the misunderstood spec — but the Python port will replicate the same bug, so these tests *won't* catch it. That's fine; the JS tests catch the other class of bug.

Run them with:

```bash
cd tests/python
pip install pytest       # one-time
pytest                   # or `pytest -v` for verbose output
```

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

## When to add a test

- **Adding a new calculation**: add a Python test that implements the same math in Python and asserts both agree.
- **Fixing a bug**: add a test that fails before the fix and passes after. If it's an algorithmic bug (e.g. the Phase 3 compounding issue), the JS test catches it. If it's a spec bug (e.g. wrong tax bracket), the Python test catches it.
- **Updating SARS tables**: update the expected numbers in the tax tests. See `docs/SARS_UPDATES.md`.
- **Adding a UI feature**: usually no test needed. UI is verified by eye.

## What the tests *don't* do

- **Rendering.** No headless browser, no visual regression. The UI is simple enough that a developer can spot regressions by opening the file and looking at it.
- **Print preview.** Printed output is checked manually before shipping.
- **Chart.js interactions.** The chart library is trusted.
- **Performance.** The calculator is fast enough that any observable slowdown would be caused by an infinite loop or similar, not a gradual regression.

## CI

No CI configured in this repo. If you add one, run `pytest` (Python) and `node tests/js/run.js` (Node). Both should exit 0.
