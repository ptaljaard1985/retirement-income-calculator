"""
Tier-2 — JS ↔ Python engine parity.

Runs every scenario from test_invariants.py through both engines:
  - Python port: tests/python/conftest.py::project()
  - JS engine:   tests/js/parity_runner.js exercises the actual project()
                 inside retirement_drawdown.html under a Node DOM stub.

Asserts row-by-row equality on every series. Tight tolerance because both
implementations should produce bit-identical IEEE-754 results from the same
inputs — small float drift (R 1) covers any ordering differences.

The Python tests catch spec bugs (where the math doesn't match SARS / CGT
regulation). The JS tests catch implementation bugs (scope, closure,
iteration). Parity tests catch the third class: drift between the two
implementations of the same spec. The Session-22 totalIncome=capital, the
Session-25 sustainableTo, and the Session-30 chart-data swap were all
JS-only bugs that would have surfaced under parity.

Skipped automatically when Node is not on PATH or the harness fails.
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from conftest import project, approx
from test_invariants import ALL_SCENARIOS, ALL_IDS


REPO_ROOT = Path(__file__).resolve().parents[2]
HARNESS = REPO_ROOT / "tests" / "js" / "parity_runner.js"


def _to_js_scenario(scn):
    """Convert a Python scenario dict to the JSON shape the JS harness reads."""
    return {
        "name": scn["_name"],
        "pA": {
            "laBalance": scn["pA"]["laBalance"],
            "laRate": scn["pA"]["laRate"],
            "discBalance": scn["pA"]["discBalance"],
            "discBaseCost": scn["pA"]["discBaseCost"],
            "discDraw": scn["pA"].get("discDraw", 0),
        },
        "pB": {
            "laBalance": scn["pB"]["laBalance"],
            "laRate": scn["pB"]["laRate"],
            "discBalance": scn["pB"]["discBalance"],
            "discBaseCost": scn["pB"]["discBaseCost"],
            "discDraw": scn["pB"].get("discDraw", 0),
        },
        "ageA": scn["age_A"],
        "ageB": scn["age_B"],
        "rNom": scn["r_nom"],
        "cpi": scn["cpi"],
        "targetPVAnnual": scn["target_pv_annual"],
        "autoTopup": scn["auto_topup"],
        "single": False,  # All Python scenarios pass pB explicitly; JS single
                          # mode would zero out pB internally and break parity.
        "events": scn.get("events") or [],
        "incomes": scn.get("incomes") or [],
        "goals": scn.get("goals") or [],
    }


@pytest.fixture(scope="module")
def js_results(tmp_path_factory):
    """Run the JS parity harness once for the whole module. Returns a dict
    keyed by scenario name. Skips the entire module if Node isn't available
    or the harness fails."""
    if shutil.which("node") is None:
        pytest.skip("node not on PATH — skipping JS parity tests")

    if not HARNESS.exists():
        pytest.skip(f"parity harness not found at {HARNESS}")

    tmp = tmp_path_factory.mktemp("parity")
    scenarios_path = tmp / "scenarios.json"
    results_path = tmp / "results.json"

    js_scenarios = [_to_js_scenario(s) for s in ALL_SCENARIOS]
    scenarios_path.write_text(json.dumps(js_scenarios))

    proc = subprocess.run(
        ["node", str(HARNESS), str(scenarios_path), str(results_path)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if proc.returncode != 0:
        pytest.fail(
            f"parity_runner.js failed (rc={proc.returncode}):\n"
            f"stdout: {proc.stdout}\nstderr: {proc.stderr}"
        )

    if not results_path.exists():
        pytest.fail("parity_runner.js did not write results.json")

    return json.loads(results_path.read_text())


def _run_py(scn):
    """Run the Python port for a scenario; returns the series dict."""
    kwargs = {k: v for k, v in scn.items() if not k.startswith("_")}
    return project(**kwargs)


# Series we compare row-by-row. Same shape as both engines emit.
NUMERIC_SERIES = (
    "la", "disc", "total", "draw", "tax", "net", "target",
    "laA_bal", "laA_draw", "laB_bal", "laB_draw",
    "discA_bal", "discA_draw", "discB_bal", "discB_draw",
    "otherA", "otherB", "tax_A", "tax_B", "draw_rate_pct",
)
STRING_SERIES = ("clamp_A", "clamp_B", "labels")


# Tolerance for float comparison. The two engines run the same arithmetic
# on the same inputs — should be bit-identical. R 1 of slack absorbs any
# ordering differences in the proportional-cost CGT calculation.
TOL_RAND = 1.0


@pytest.mark.parametrize("scn", ALL_SCENARIOS, ids=ALL_IDS)
def test_js_python_parity_numeric(scn, js_results):
    """Every numeric series — household totals, per-spouse balances and
    draws, per-spouse tax, draw-rate percentage — must agree row-by-row
    between the Python port and the JS engine."""
    name = scn["_name"]
    js = js_results.get(name)
    assert js is not None, f"no JS result for scenario {name}"
    if "__error" in js:
        pytest.fail(f"JS harness errored on {name}: {js['__error']}")

    py = _run_py(scn)

    # Same horizon length.
    assert len(js["labels"]) == len(py["labels"]), \
        f"{name}: horizon mismatch — JS {len(js['labels'])} vs Py {len(py['labels'])}"

    for key in NUMERIC_SERIES:
        py_series = py[key]
        js_series = js[key]
        assert len(py_series) == len(js_series), \
            f"{name}: series {key} length mismatch ({len(py_series)} vs {len(js_series)})"
        for i, (a, b) in enumerate(zip(py_series, js_series)):
            assert abs(a - b) <= TOL_RAND, (
                f"{name}: series {key}[{i}] differs — "
                f"Py={a:.4f} JS={b:.4f} delta={a - b:.4f}"
            )


@pytest.mark.parametrize("scn", ALL_SCENARIOS, ids=ALL_IDS)
def test_js_python_parity_strings(scn, js_results):
    """String-typed series (clamp flags, age labels) must match exactly."""
    name = scn["_name"]
    js = js_results.get(name)
    assert js is not None, f"no JS result for scenario {name}"
    if "__error" in js:
        pytest.fail(f"JS harness errored on {name}: {js['__error']}")

    py = _run_py(scn)
    for key in STRING_SERIES:
        py_series = py[key]
        js_series = js[key]
        assert len(py_series) == len(js_series), \
            f"{name}: series {key} length mismatch"
        for i, (a, b) in enumerate(zip(py_series, js_series)):
            assert a == b, (
                f"{name}: series {key}[{i}] differs — "
                f"Py={a!r} JS={b!r}"
            )
