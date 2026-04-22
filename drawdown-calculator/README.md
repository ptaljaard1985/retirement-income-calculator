# Retirement Drawdown Calculator

An interactive retirement drawdown projection tool for two-spouse South African households, built for use in client advisory meetings by Simple Wealth (Pty) Ltd, FSP 50637.

## What it does

Given two spouses' starting living annuity and discretionary capital, an annual expense target, and a set of market assumptions, the calculator projects year-by-year to age 100:

- Living annuity draws, escalating in rand terms at CPI and clamped to the legislated 2.5%–17.5% band
- Discretionary top-up when LA income falls short (optional; proportional to disc balance, CGT-aware)
- LA boost toward the 17.5% ceiling when discretionary is exhausted (optional; proportional to LA balance)
- Income tax per spouse on SARS 2026/27 tables with bracket creep
- Capital gains tax on discretionary draws (base-cost-aware)
- Future capital events — property sales, inheritances — landing in the selected spouse's discretionary

Results are visible in three chart views (capital, income, year-by-year table), in both today's-money and future-rand framings, with plan-health alerts that surface when the strategy hits constraints.

The print button produces a compliance-ready PDF summary including inputs, outputs, methodology, and the FAIS/POPIA disclaimer.

## Running it

Open `retirement_drawdown.html` in a browser. That's it — no build, no server, no install.

Chart.js loads from `cdnjs.cloudflare.com`; everything else is inline. The file works offline if Chart.js is cached.

Tested on recent Safari and Chrome.

## Project structure

```
retirement_drawdown.html    the deliverable (single file)

CLAUDE.md                   read first by Claude Code
README.md                   this file
docs/
  ARCHITECTURE.md           code structure
  CALCULATIONS.md           maths and tax rules
  DESIGN.md                 visual system
  SARS_UPDATES.md           annual update playbook
tests/
  README.md                 how to run tests
  python/                   math audits (pytest)
  js/                       JS solver tests (node)
```

## Running the tests

Python audits (closed-form cross-checks):

```bash
cd tests/python
pip install pytest
pytest -v
```

JS behaviour tests (exercises the actual solver):

```bash
cd tests/js
node run.js
```

Both must pass before any change ships. See `tests/README.md` for details.

## Annual maintenance

SARS tax tables update in February with the Budget Speech. The calculator hardcodes 2026/27 tables and applies a 3% p.a. bracket creep assumption. When the next Budget lands, follow `docs/SARS_UPDATES.md` — it's a short playbook with a checklist.

## License

Proprietary. © Simple Wealth (Pty) Ltd 2026.

## Contact

Questions: pierre@simplewealth.co.za.
