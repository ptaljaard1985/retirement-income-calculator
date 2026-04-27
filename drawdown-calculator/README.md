# Retirement Drawdown Calculator

An interactive retirement drawdown projection tool for one- or two-spouse South African households, built for use in client advisory meetings by Simple Wealth (Pty) Ltd, FSP 50637.

## What it does

Given each spouse's starting living annuity and discretionary capital, an annual expense target, recurring household goals, external income streams, and a set of market assumptions, the calculator projects year-by-year to age 100:

- Living annuity draws, escalating in rand terms at CPI and clamped to the legislated 2.5%–17.5% band
- Discretionary top-up when LA income falls short (optional; proportional to disc balance, CGT-aware)
- LA boost toward the 17.5% ceiling when discretionary is exhausted (optional; proportional to LA balance)
- Income tax per spouse on SARS 2026/27 tables with bracket creep
- Capital gains tax on discretionary draws (base-cost-aware)
- Future capital events — property sales, inheritances, one-off outflows — landing in the selected spouse's discretionary
- Recurring goals (travel funds, periodic gifts) bumping the target need in qualifying years

Results are visible across four chart views (Income, Capital, Year-by-year table, Tax breakdown), in both today's-money and future-rand framings, with plan-health alerts that surface when the strategy hits constraints. Adviser flow is organised into five tabs: **Info** (setup), **Planning** (live levers + chart), **Scenarios** (locked baseline vs. live what-if), **Comparison Summary** (decision page), and **Assumptions** (read-only methodology + SARS reference).

## Editorial client report

A second file, `retirement_drawdown_report.html`, is the editorial A4-landscape PDF the adviser hands the client after the meeting. The calculator's **Export report** button serialises the current plan + projection into `localStorage['sw-drawdown-snapshot']` and opens the report in a new tab, which auto-prints. The report runs no math — it formats and renders only.

Two layouts ship in the same file and switch automatically:

- **Single-run** (no baseline locked): the original 12-slide editorial flow — Cover, Answer, Household, Assumptions, Levers, Projection, Capital, Tax, [Events], [Compare], Year-table, Methodology, Compliance, Next steps.
- **Dual-run** (baseline locked): an 8-slide layout — Cover, Baseline-income, Baseline-goals-events, Scenario-income, Scenario-goals-events, Side-by-side assumptions, Levers, Compliance. The scenario goals/events column visibly diffs against the locked baseline (added/changed badges, gold-tinted rows, coral "uplifted" lifestyle).

The calculator itself also produces a compliance-ready print summary on Cmd+P (inputs, outputs, methodology, FAIS/POPIA disclaimer).

## Running it

Open `retirement_drawdown.html` in a browser. That's it — no build, no server, no install.

Chart.js loads from `cdnjs.cloudflare.com`; everything else is inline. The file works offline if Chart.js is cached.

Tested on recent Safari and Chrome.

## Project structure

```
retirement_drawdown.html         the calculator (single file, the deliverable)
retirement_drawdown_report.html  the editorial export-report sibling (single + dual-run)

CLAUDE.md                        read first by Claude Code
README.md                        this file
TECH_DEBT.md                     known small debts
docs/
  ARCHITECTURE.md                code structure (calculator + report)
  CALCULATIONS.md                maths and tax rules
  DESIGN.md                      visual system
  SARS_UPDATES.md                annual SARS-table refresh playbook
  CI.md                          CI configuration
  PLATFORM_ROADMAP.md            longer-arc product direction
  REPORT_DESIGN_BRIEF.md         brief that drove the v2 dual-run design
  SESSION_LOG.md                 archived session entries
tests/
  README.md                      how to run tests
  python/                        math audits (pytest, 108 cases)
  js/                            JS solver tests (node, 19 cases)
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
