# Design

The visual system for the drawdown calculator. These choices are deliberate — don't drift from them without a conversation. The sibling `retirement_drawdown_report.html` (the editorial client-report export) shares this token system; if you change a token in one file, mirror it in the other.

## Philosophy

**The calculator is a conversation tool, not a dashboard.** It gets opened during a client meeting, the adviser moves sliders while the client watches, and a PDF is printed and emailed. That context dictates every visual choice:

- Editorial over dashboard. The page reads like a private-bank research note, not a fintech app.
- Legible at 2m on a shared laptop, printable to A4 without cropping.
- No unnecessary motion, no loading states, no "oh did you see that?" animations.
- Three states — *Empty* (setup), *Single* (projection), *Compare* (baseline vs scenario) — crossfade on the same page.

## Design tokens

All colours, radii, and typography are CSS variables in `:root`. Change the palette there, never in component rules.

```css
:root {
  /* Ink / paper */
  --ink:       #1a1f26;
  --ink-2:     #3a4250;
  --mute:      #7a8292;
  --faint:     #b4bac4;
  --hairline:  #e4e1d8;
  --line:      #d4cfc2;
  --paper:     #faf7f0;     /* warm off-white page background */
  --paper-2:   #f2ede2;     /* inset panels, baseline compare card */
  --paper-3:   #ebe4d3;     /* deeper inset */
  --surface:   #ffffff;

  /* Brand — navy + gold, refined */
  --navy:      #1f2d3d;
  --navy-2:    #2d3e50;
  --navy-soft: #38495b;     /* Other-income bars, soft navy fills */
  --gold:      #b8893c;     /* Discretionary bars, slider fill */
  --gold-2:    #9c7226;     /* Italic roman numerals, deltas */
  --gold-soft: #e3c987;     /* Headline underline background */
  --gold-pale: #f5ebd1;     /* Neutral callout wash, delta chip bg */

  /* Charts / states */
  --teal:      #2a6b6b;     /* Living-annuity bars */
  --coral:     #a04438;     /* Target need line, shortfall, warnings */
  --coral-pale:#f4e0da;     /* Depletion zone, negative-delta chip */
  --amber-pale:#f5ebd1;     /* Warn callout wash */
  --pos:       #2f6b3a;
  --neg:       #a64236;
  --pink:      #d27a88;     /* Tax slice on the income chart */
}
```

The warm `--paper` (#faf7f0) is load-bearing. It makes the page read like paper rather than a web app. Do not drift toward `#f8f9fa` or any cold grey.

A handful of legacy alias variables (`--brand`, `--surface-alt`, `--ink-muted`, etc.) remain inside `:root` — they re-point to the new tokens so pre-redesign component CSS keeps rendering. Treat those aliases as transitional; new code should reference the new names.

## Typography

Three families, all loaded from Google Fonts. Do not substitute:

```css
--serif: 'Fraunces', Georgia, 'Times New Roman', serif;     /* editorial headlines, italic numerals, prose */
--sans:  'Inter Tight', -apple-system, ..., sans-serif;     /* body, labels, UI */
--mono:  'JetBrains Mono', ui-monospace, monospace;         /* every numeric value, tabular */
```

Fraunces is used with optical sizing. All monospace numeric readouts carry `font-variant-numeric: tabular-nums` so layout doesn't jitter when sliders move.

**Scale:**

- Editorial headline (`.headline`): Fraunces 44px / 1.08, weight 300, letter-spacing −0.6px. Numerics carry `.num` (navy) or `.num-italic` (Fraunces italic, navy).
- Compact headline (State 3): 36px.
- Hero outcome value (italic longevity): Fraunces italic 34px+.
- Section / eyebrow label (`.eyebrow`): Inter Tight 10.5–11px, uppercase, letter-spacing 1.7–1.8px, weight 600, `--mute`.
- Body: Inter Tight 14px / 1.55.
- Narrative prose: Fraunces italic 15px / 1.65, `--ink-2`, max-width 720px.
- Numeric readout: JetBrains Mono 12–14px tabular, weight 400–500.
- Roman-numeral step marker (`.rom`): Fraunces italic, `--gold-2`.
- Emphasis on key words: `.gold-under` (soft gold background underline via `::after`).
- Inline callouts: `.callout` (gold pale), `.callout.warn` (amber pale), `.callout.neg` (coral pale). Background gradients; render in print.

## Three-state flow

The app is a single HTML file; state is driven by a `data-app-state` attribute on `<body>` and one of three `<section>` containers visible at a time.

| State | Container | Content |
|---|---|---|
| Empty | `#state-empty` | Editorial title plate, spouse setup, household needs strip, other-income + capital-events ledgers, CTA bar |
| Single | `#state-single` | Plan-bar (collapsed summary), canvas head (editorial headline + action cluster), chart card, outcome strip, narrative, canvas footer |
| Compare | `#state-compare` | Compact head, baseline vs scenario two-up cards with delta chips |

A **shared chrome** block (`#shared-chrome`) holds the Financial-levers block and the full tax panel. It's visible in Single + Compare, hidden in Empty (`body[data-app-state="empty"] #shared-chrome { display: none; }`). Financial levers contains, top-to-bottom: (1) **Drawdown levers** — per-spouse `Initial LA drawdown rate` + `Annual discretionary withdrawal` sliders, with the `Solve LA rates to target` button in the sub-heading (folded in at the top in Session 10); (2) Return slider; (3) Monthly household need + Annual lump sums; (4) collapsible Other-income and Capital-events ledgers. The scalar `-c`-suffixed inputs (`#return-c`, `#needs-monthly-c`, `#needs-lump-c`) are bi-directionally synced to their State-1 canonical counterparts. `project()` reads from the canonical IDs only — the mirror is purely a UX affordance so an adviser can strategise from Compare without bouncing back to Empty. The block's wrapper CSS class remains `.scenario-adjust` for internal identification.

Crossfade on state change is a simple `opacity` + `display` swap via `.state.is-hidden`. The `setAppState(next)` helper does **not** persist — every page refresh resets to State 1 (`appState = 'empty'`), so an adviser opening the calculator at the start of a meeting always lands on the blank setup view.

## Layout

- Page max-width is content-driven; each state canvas constrains internally (`.empty-canvas` at 920px).
- Radii: `--r-sm: 4px` (small inputs), `--r: 6px` (standard), `--r-lg: 10px` (cards + panels).
- Hairlines: `--hairline` (#e4e1d8) 1px solid for dividers; `--line` (#d4cfc2) for slightly stronger borders.
- Card padding: 18–26px depending on density.
- Vertical rhythm: 22–40px between major sections, 10–18px between field groups.

## Component conventions

### Title plate (State 1)
Centred. Eyebrow above a Fraunces 44px headline reading *"A retirement income plan for the [surname] family."* Only the surname span (`#hl-family`) is `contenteditable`; the surrounding "A retirement income plan for the" / "family." is plain static text. The span loads empty so the `.editable:empty::before` placeholder (em-dashes) reads as "the ——— family" on cold load. Dashed underline under the editable region when empty, `--paper-2` background on focus. The monthly figure does not appear in the headline — it lives only in the household-needs strip below (`#needs-monthly`). Monospace "Prepared DD Month YYYY" sits beneath the headline.

Spouse name inputs default to empty with `placeholder="Spouse A"` / `placeholder="Spouse B"`. `getName('A')` / `getName('B')` in JS fall back to the same strings when the input is blank, so every downstream label reads "Spouse A" / "Spouse B" until the adviser types a real name. This avoids planting "Marilyn" / "James" as suggestive example names in client meetings.

### Plan-bar
Paper-2 background, hairline border, 8px radius. Left side = brand eyebrow (`Simple Wealth · Retirement Drawdown`) + `Family <surname>` + `Prepared <date>`. Right side = `Edit plan ↓` ghost button that flips to State 1. Trimmed in Session 10: the old `Household`, `Capital`, and `Target` facts were removed because the outcome strip below already carries the target and the income mix, and the Household names aren't needed for a compact identifier — the surname does the job. `#pb-family` reads from the State-1 title-plate span `#hl-family`; it updates whenever `refresh()` fires, so flipping between states keeps it current.

### Canvas head (State 2)
Action cluster only. The editorial 44px headline and subtitle paragraph (removed in Session 8) and the section eyebrow (removed in Session 9) are all gone — the outcome strip directly below carries the summary (target-met age, Y1 need, income mix), the chart alert chips carry shortfall / LA-cap narration, and the Real|Nominal toggle on the chart-controls row signals the mode. There is no `updateHeadline()` any more; the function and its `refresh()` call site were deleted in Session 9.

Action cluster:
- Ghost `Export report →` button (canonical client-PDF path; opens `retirement_drawdown_report.html` in a new tab via `localStorage` snapshot)
- Primary `Lock as baseline →` (flips to State 3 with a frozen snapshot)

The `Auto-top-up` pill was moved out of the action cluster and onto the chart-controls row in Session 10 — see the Chart section.

`.canvas-head` is `display: flex; align-items: flex-end; justify-content: space-between;` — with no left-side child in State 2, `.canvas-head-actions` carries `margin-left: auto` to stay right-aligned. State 3's `.canvas-head.compact` still uses both a `.canvas-head-left` (with the compact headline) and the action cluster; the `margin-left: auto` is a no-op there because the two children already fill the row.

### Outcome strip

Three cells — teal primary (`TARGET MET UNTIL AGE`), plain (`YEAR-1 INCOME NEED`), plain (`FUNDED BY`). Each cell has three rows: label (`.ocap` — 10px uppercase), value (`.oval` — 22px, num-italic at 26px, unit at 12px), and sub (`.osub` — 10px italic Fraunces). Padding `14px 20px`, row-gap `4px`. Session 9 tightened all four dimensions (down from 18/22px padding, 6px gap, 28/34/14px oval fonts) to bring cell height down ~25–30px without dropping any content.

The primary teal cell flips on verdict: label `TARGET MET UNTIL AGE` + sub `youngest spouse · target fully met` when sustainable; label stays the same but sub flips to `shortfall emerges before the horizon` or `capital depletes at age N` when the plan can't meet the target. See `updateOutcomeStrip(p, an)`.

The `.seg.mini` (Real | Nominal) toggle lives one row down on the chart-controls row — see the Chart section. The in-page Print button and the canvas-foot One-page summary button were removed in Session 7; Cmd+P still works through the `@media print` rules.

### Outcome strip
Three cells, first is teal primary (white text). Cells: `Lifestyle sustainable until age N · K years`, `Year-1 income need`, `Funded by LA X% · Disc Y% · Other Z%`. The primary cell flips from teal (verdict sustainable) to plain navy (stretched) automatically.

### Compare two-up (State 3)
Grid `1fr 1fr`, 22px gap.
- **Baseline** card: `--paper-2` background, muted. "Locked" label. Big italic longev value. Meta rows (LA draws, disc draw, needs, markets).
- **Scenario** card: navy 1px border + shadow ring. Delta chip top-right: gold for ≥0, coral for negative. Meta rows repeat with inline italic `--gold-2` delta deltas.

### Chart

Sits below the canvas head. Controls row (`.controls-row`) above the chart card: `Income | Capital | Table` segmented selector on the left; on the right, a `.controls-row-right` cluster holds the `Auto-top-up` toggle pill followed by the `Real | Nominal` mini-segmented toggle (`display: flex; justify-content: space-between;` on the outer row, `display: inline-flex; gap: 12px;` on the cluster). The pill moved here from the canvas-head action cluster in Session 10 so the chart-controls row now carries every chart-level mode switch in one strip.

Chart.js only — no plugins from npm, no other libraries. Two inline plugins are registered for the Income chart:

- **Income chart (default)**: five datasets, four of them stacked bars in stack `'income'`. **No explicit `order:` values** — stacking follows array index, so the visual top-to-bottom is Tax → Other → Disc → LA (and the transparent Target line is behind them):
  1. **LA (net)** — teal `#2a6b6b`, LA rand draw minus its share of household tax.
  2. **Disc (net)** — gold `#b8893c`, disc draw minus its share of household tax (which is mostly the CGT on the realised gain for that draw, but is apportioned from the single household tax total).
  3. **Other (net)** — navy-soft `#38495b`, other taxable income minus its share of household tax.
  4. **Target need** — invisible `line` dataset (transparent border/fill) retained as the per-year data carrier for both plugins and as the legend toggle target.
  5. **Tax** — dusty rose `--pink` `#d27a88`, stacks **on top** of 1–3 so the bar TOTAL = gross income. Colored portion = net to bank; pink cap = household tax bite. On-target years: colored sum lands exactly on the target line. Shortfall years: the gap between colored top and target line is the actual shortfall. This is deliberate (Option B) — the client sees the tax slice rather than a target line floating below the gross-bar tops. The pink is loud on purpose; the tax bite is the single most resonant figure in a client meeting.
  - Tax apportionment (per year): `laTax = tax × la/gross`, `discTax = tax × disc/gross`, `otherTax = tax × other/gross`, where `gross = la + disc + other`. All three sources bear their proportional share of the household tax total (which already includes CGT on disc gains). Bar total = gross; colored sum = gross − tax = net to bank. See `incomeBarSeries()` in the engine.
  - `targetBoxPlugin` (afterDatasetsDraw) draws the target as a **solid bold stepped top line** (coral `#a04438`, 2.5px, no dash): per-year horizontal segments spanning the full x-slot (adjacent years touch at the slot boundary) joined by vertical step segments only where `target[i+1] !== target[i]`. No left/right sides, no bottom edge, no hairlines falling to the x-axis. Real mode → flat line; Nominal mode → staircase. Previously dashed + 1px — bumped for legibility from 2m across a meeting table.
  - `shortfallShadingPlugin` (afterDatasetsDraw, registered second) paints a coral wash between the colored-bar-top and the need-line for shortfall years, plus a dashed vertical at the first shortfall age with a 10px Inter Tight label. Shortfall is detected by `net < target`, correctly now that bars represent net.
- **Capital chart**: stacked LA + Disc bars with a secondary-axis dashed coral withdrawal-rate line. New tokens applied (teal unchanged, gold shifts to `#b8893c`, coral shifts to `#a04438`).
- **Table view**: the existing year-by-year table, with per-spouse clamp flags in coral (▲ cap) / green (▼ floor).
- **State 3 mini charts**: `buildCompareMiniChart(which, p)` renders a 180px-tall Chart.js instance inside each `.compare-mini-chart` wrapper (`#cmp-chart-baseline` + `#cmp-chart-scenario`). Same 5-dataset layout and both plugins as the main chart, but tooltips off, y-ticks off, fewer x-ticks. Baseline wrapper sits at `opacity: 0.55` so the locked snapshot reads as muted against the vivid scenario.

### Alerts bar
Above the chart body, populated when the plan hits constraints. Hidden entirely when quiet. Variants: `.chart-alert.cap` (LA ceiling), `.chart-alert.disc` (discretionary exhausted), `.chart-alert.shortfall` (real shortfall vs target).

### Canvas footer
Thin row: `Illustrative only · 2026/27 SARS tables · auto-top-up on · real terms` on the left; a single `Year-by-year table` ghost button on the right. (The narrative card and the One-page-summary print shortcut were removed in Session 7 — the chart now speaks for itself and the client-PDF path is `Export report`.)

### Sliders
- 4px track with a `linear-gradient` fill-up-to-value in `--gold`. Value % is pushed to a `--fill` CSS custom property on every `input` event via `updateSliderFill()`.
- 14px circular thumb, white background, 1.5px `--gold-2` border, subtle shadow. `transform: scale(1.15)` on hover.
- Focus ring uses `--navy` via `:focus-visible`.

### Buttons
`.btn` base. Variants:
- `.btn.primary` — navy bg, paper text
- `.btn.gold` — gold bg, white text (reserved for State-1 CTA)
- `.btn.ghost` — transparent, `--mute` text, `--paper-2` on hover
- `.btn.large` — 14px / 13×22 padding (CTA)
- `.add-btn` — dashed outline, centred `＋ Add …` label

### Segmented toggle + pill
- `.seg` + `.seg.mini`: surface bg, hairline border, 6px radius. Active span gets navy fill + paper text.
- `.toggle-pill`: rounded 999px border. Off state = paper. On state = navy fill + paper text, gold switch track. Switch dot translates 10px on toggle.

## Interactions

Everything recalculates on every `input` event. The projection runs in single-digit milliseconds; sliders feel instant.

Sliders use direct manipulation: move the thumb → number at the right updates → chart redraws → outcome strip + narrative re-render. The feedback loop is immediate.

The `Solve LA rates to target` button in shared chrome still binary-searches for the equal LA rate that hits the target. State 3's "Solve to target" placeholder link is out of scope for this pass.

The single editable title-plate span `#hl-family` is `contenteditable` — free-text editorial only, does not feed the engine. The monthly figure is sourced solely from the `#needs-monthly` input in the household-needs strip.

## Print

`@media print` forces `state-single` visible on paper regardless of the on-screen state and hides every interactive chrome (plan-bar, toggles, buttons, chart legend, canvas-head-actions, canvas-foot, State-1, State-3, and the shared-chrome control buttons). The `.print-summary` block remains the compliance document on a new page (`page-break-before: always`).

Print colours use `-webkit-print-color-adjust: exact` on the outcome-primary cell, chart card, and tax panel so gold/teal/coral survive the print driver.

The browser's Cmd+P is now the only trigger — the in-page Print button in the canvas-head actions and the canvas-foot One-page summary button were both removed in Session 7. The editorial client PDF is produced via `Export report` (opens the sibling `retirement_drawdown_report.html`); `@media print` on the calculator itself is retained for the ad-hoc compliance print-summary only.

A `beforeprint` listener also force-switches `appState` to `single`, resizes Chart.js canvases, and restores the previous state on `afterprint` — belt-and-braces to the CSS rules.

Every calculator must still be reviewed in print preview before shipping. Print-only regressions are subtle and common.

## Don't

- Don't use pure black or pure white. Both read as cold and out of character.
- Don't add hover animations on cards, sliders, or buttons beyond the colour / scale transitions already in place.
- Don't introduce a third accent colour. Gold and coral carry the accents; teal is reserved for LA.
- Don't replace Chart.js with a different charting library.
- Don't use emoji.
- Don't reintroduce a localStorage-restored app state. Refresh always lands on State 1 — that's the adviser's reset between client meetings.
- Don't hide the shared chrome outside of State 1.
- Don't move `#print-summary` back outside `#state-single`. It needs to be a child of state-single so it only shows in single mode on screen; print still works because `@media print` forces state-single visible.
- Don't reintroduce an editorial headline, subtitle paragraph, or section eyebrow above the outcome strip on State 2. The strip is the answer; a prose overlay or section label duplicates it, eats vertical real estate, and pushes the chart and levers below the fold. Headline + subtitle removed in Session 8; eyebrow removed in Session 9.
- Don't add a charting library to `retirement_drawdown_report.html`. Its three chart renderers are inline SVG by design — print fidelity at A4 is the reason. Chart.js is the calculator's dep, not the report's.

## The export-report sibling

`retirement_drawdown_report.html` is a separate single-file deliverable that produces the editorial client PDF. It mirrors this calculator's `:root` tokens and uses the same Fraunces / Inter Tight / JetBrains Mono families. Slide layout is fixed (12 always + 2 conditional), 1588 × 1123 px design size, A4 landscape, one slide per printed page.

The slide vocabulary — eyebrow + Roman numeral, Fraunces 52–92px headlines with italic emphasis, gold-underline once per slide, navy outcome cells, paper-warm cards with hairline borders, tabular mono figures everywhere — is identical to the calculator's State 2 and 3. If you reach for a new visual primitive in either file, check the other to see whether it already exists.

See `docs/ARCHITECTURE.md` for the snapshot contract that flows between the two files, the binder pipeline, and the SVG chart renderers.

## References

The aesthetic is closer to a Bain or McKinsey deliverable than a SaaS dashboard. If you need a reference, look at:

- Private bank research notes (Julius Bär, Rothschild)
- The Economist / FT Lex columns
- Edward Tufte's small multiples

Not at: Robinhood, Wealthfront, any consumer budgeting app.
