# Report design brief — dual-run editorial PDF

Prompt-ready handoff for a Claude Design session (or any visual designer).
Pasteable as-is.

---

I'm working on a single-file HTML retirement-drawdown calculator for Simple Wealth (Pty) Ltd, a South African financial services provider. The adviser (Pierre) uses it in client meetings, then exports an editorial A4-landscape PDF the client takes home. The calculator is `retirement_drawdown.html`; the report is `retirement_drawdown_report.html` — both single files, no build step, vanilla JS, inline SVG charts, served via `file://`. Brand voice is editorial / restrained / "warm paper, not SaaS".

I just shipped a feature where the exported report contains BOTH a locked baseline and an explored scenario when the adviser locks one before exporting. The mechanic works — snapshot v2 carries `baseline: {plan, projection}` alongside the live `plan + projection`, the report clones the seven data slides for the baseline run, and reorders into:

```
Cover
[Baseline divider]
Baseline: Answer · Household · Projection · Capital · Tax · [Events] · Year-table
Compare (bridge slide between runs)
[Scenario divider]
Scenario: Answer · Household · Projection · Capital · Tax · [Events] · Year-table
Assumptions ref · Levers · Methodology · Compliance · Next-steps
```

But it's structurally correct, not designerly. **Your job is to make this PDF land.**

## What's wrong with what I shipped

1. **No run identity at a glance.** Slide-tops read `Smith · 27 April 2026 · 03` — nowhere does it say "Baseline" or "Scenario". A client mid-PDF can't tell which run they're looking at without scrolling back to a divider.
2. **The dividers are flat cover-clones** with one-paragraph subtitles. They should carry editorial weight — they're the narrative pivots of the document.
3. **The Compare slide sits awkwardly** between two full runs. Its role shifted from "delta summary" to "bridge", but its DOM is still a side-by-side delta layout.
4. **Repetition fatigue.** 7 slides × 2 = 14 near-identical slides. Open question: should the scenario run be a full repeat, or a "what changed" overlay where unchanged fields mute and deltas highlight?
5. **Cover ignores the dual structure.** Same cover as a no-baseline export. A "Sections: I. Baseline · II. Scenario" cue would help.
6. **Assumptions slide is single** but shows scenario's return/CPI only — baseline values invisible there if they differ. Design call: split, add a baseline column, or leave.

## Brand & visual constraints (non-negotiable)

- Background `#faf9f5` (warm paper). Brand navy `#2d3e50`. No gradients, no shadows, no animations, no emoji.
- Typography: Fraunces (serif, headings + editorial italics), Inter Tight (sans, body + UI), JetBrains Mono (numerics).
- Print: A4 landscape, 1588×1123 px per slide. `@media print` must produce a clean one-slide-per-page PDF in Chrome.
- Currency: rands with space separators (`R 6 000 000`), SARS 2026/27 tax tables, FSP 50637 disclaimer.
- Single HTML file. No new external deps. Inline SVG only — no Chart.js.
- South African context. The full design system is in `docs/DESIGN.md`.

## Data you have to work with

Snapshot shape (full contract in `docs/ARCHITECTURE.md`):

```
{
  schemaVersion: 2,
  plan: {                          // the SCENARIO
    familyName, preparedFor, preparedOn, adviser, single,
    spouses: [{name, age, laBalance, discretionary, discBaseCost,
               otherIncome: [{kind, monthly}]}],
    monthlyNeed, annualLumpSums, returnPct, cpiPct, autoTopUp,
    capitalEvents: [{year, label, forWhom, amount}]
  },
  projection: {                    // the SCENARIO projection
    startAge, horizonAge, years, rNom, cpi,
    rows: [{year, age, laDraw, discDraw, otherIncome, totalIncome,
            requiredReal, laBalance, discBalance, totalCapital, shortfall, events}],
    sustainableTo, depletesAt, laCapHitAt, discExhaustsAt,
    year1, taxA, taxB, taxByPerson, hhGross, hhTax, hhNet, hhEff
  },
  baseline: {plan, projection}     // same shape, frozen at lock time
}
```

What's same vs different between the two runs:

| Usually **same** | Often **different** | Always **different** |
|---|---|---|
| `familyName`, `preparedFor`, `adviser`, spouse names + ages, spouse capital balances | `monthlyNeed`, `annualLumpSums`, `returnPct`, `cpiPct`, `autoTopUp`, `capitalEvents[]`, spouse `otherIncome[]` | every `projection.*` field — `sustainableTo`, every `rows[i]`, all tax outputs |

Capital balances rarely change between baseline and scenario (advisers tweak income / events / drawdown, not the household's existing pots). Worth designing for that asymmetry.

## What's in the codebase already

- DOM uses `[data-field="name"]` placeholders + a `setField(name, value)` global painter for shared fields.
- Per-run fields use `[data-field="name-baseline"]` / `[data-field="name-scenario"]` and a scoped `setRunField(suffix, name, value)`.
- Container ids on doubled slides also get suffixed: `chart-answer-baseline`, `household-grid-scenario`, etc.
- `SHARED_FIELDS` exemption set covers names that should NOT be suffixed (`familyName`, `familyNamePoss`, `preparedOn`, `pageNum`, `pageTotal`).
- New data-fields require populating in `renderRun(plan, projection, suffix)` in the report's IIFE — that's a small JS edit.
- New snapshot fields require a calculator change in `buildReportSnapshot` / `captureCurrentPlanInputs` / `buildProjectionPayload` — a bigger surface but tractable.

## What I want from you

1. **Read these files first**: `retirement_drawdown_report.html`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md` (especially the Session 19 entry).
2. **Print the current dual-run PDF** to see the actual paper output (use `?noprint` on the URL for iteration without auto-print).
3. **Propose a design** for the dual-run report that addresses the six problems above. Specifically:
   - How does each slide signal "Baseline" vs "Scenario" at a glance? (Eyebrow chip? Coloured paper edge? Slide-top badge?)
   - Should the dividers stay as full cover-style slides, or become slimmer section headers? Editorial copy?
   - Does the Compare slide stay where it is (mid-report bridge), get redesigned, or get folded into the dividers / cover?
   - Should the scenario run be a full repeat or a "what changed" overlay? If overlay: what's the visual treatment for unchanged-vs-changed fields?
   - Cover-slide treatment when dual-run: any addition to signal the two-section structure?
   - Assumptions slide — split for both runs, augment with a delta row, or leave?
4. **Show, don't tell.** Mock up the proposed slides as actual HTML/CSS edits to `retirement_drawdown_report.html`, or as standalone HTML if you want a faster iteration loop. Either way I want runnable artifacts, not Figma.
5. **Stay inside the constraints.** No new fonts, no Chart.js, no shadows / gradients / animations / emoji. Pierre's design discipline is real: restrained beats decorated.

If a design needs new data fields or a snapshot-shape change, flag it explicitly with the calculator-side edit required — but don't propose changes that need a backend, or that break the print path.

The file is at `drawdown-calculator/retirement_drawdown_report.html`. The repo is `ptaljaard1985/retirement-income-calculator`, branch `claude/scenario-planning-feature-hrU5T` (PR #21).
