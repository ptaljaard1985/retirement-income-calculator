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
  --coral:     #a04438;     /* Shortfall dashed vertical + label; Capital chart withdrawal-rate line */
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

The app is a single HTML file; the visible content is driven by `body[data-tab="..."]` and one of five tab panels. (Pre-Session-15 the same file used a 3-state `data-app-state` flow; that machinery is retired but `setAppState()` survives as a back-compat shim.)

| Tab | Container | Content |
|---|---|---|
| Info | `#state-empty` (`data-tab-panel="info"`) | Editorial title plate, spouse setup, household needs strip, other-income + capital-events ledgers, centered `Build the projection →` CTA. **Kept as-is** from the pre-Session-15 State 1. |
| Planning | `#state-single` (`data-tab-panel="planning"`) | Chart-controls row (Income / Capital / Table / Tax views + Real/Nominal seg) + chart-card + canvas-foot. Lives inside `.rail-canvas-shell` alongside the shared rail. |
| Scenarios | `#state-compare` (`data-tab-panel="scenarios"`) | Compact head + baseline-vs-scenario two-up mini-charts with delta chip + tax strip + Re-lock/Clear buttons. Same rail-canvas-shell home. |
| Comparison Summary | `[data-tab-panel="comparison"]` | Static decision page: Baseline/Scenario one-line summaries, bulleted Key Changes (computed by `diffPlanForSummary`), verdict line, Export-PDF + Re-open-Scenarios CTAs. New screen. |
| Assumptions | `[data-tab-panel="assumptions"]` | Read-only readouts of live Return / CPI / Auto-top-up + SARS 2026/27 reference table + methodology prose + FSP disclaimer. New screen. |

A **shared rail** (`<aside class="rail">`) lives inside `.rail-canvas-shell` (a 2-col grid `[240px 1fr]`) and is visible only on Planning + Scenarios. Top-to-bottom the rail holds: (1) **Drawdown levers** — per-spouse LA-rate + disc-draw sliders, with `Solve to target` in the head; (2) **Markets** — Return slider (`#return-c`, mirror of canonical `#return` on Info); (3) **Spending** — `Monthly need` and `Annual lumps` ±-swing sliders that anchor to Info-tab values via `setupRailSpendingSlider`; (4) **Display** — Auto-top-up pill; (5) **Schedules** — collapsible Other income + Capital events sub-sections (count badges in headers, internal-scroll-capped bodies); (6) **Lock as baseline →** / **Continue → Summary** CTA pair (visibility CSS swaps which is shown per tab). The rail is `position: sticky; top: 14px; max-height: calc(100vh - 40px); overflow-y: auto` so its content scrolls internally when ledgers expand — the page itself never scrolls.

Visibility on tab change is a simple `display` swap via `body[data-tab="..."] [data-tab-panel]:not([data-tab-panel="..."]) { display: none !important }`. The `setTab(next)` helper does **not** persist to `localStorage` — every page refresh resets to `info`, so an adviser opening the calculator always lands on the blank setup view. Three layers of scroll-snap-to-top (`history.scrollRestoration = 'manual'`, `overflow-anchor: none`, triple-fired `scrollTo(0,0)`) ensure no rebuild ever lands the viewport mid-page.

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

Above the spouse setup sits a **Couple | Single client** segmented control (right-aligned, `.seg.mini` style, matching the Real|Nominal and Income|Capital|Table toggles). `Couple` is the default. Flipping to `Single client` writes `data-client-mode="single"` on `<body>`, which collapses the Spouse B card via `body[data-client-mode="single"] .spouse-b-only { display: none !important; }` and triggers a `refresh()`. The same `.spouse-b-only` class is tagged onto every downstream Spouse-B affordance — the Financial-levers Spouse-B column, the tax-panel Spouse-B card, the Spouse-B block in the print summary, and every Spouse-B cell (header + body) in the year table — so one CSS rule owns the entire collapse. The Spouse A card's editorial label uses a pair of `.label-couple` / `.label-single` spans so "I. Spouse A" swaps to "I. Client" under the single attribute. Copy elsewhere that assumed a couple ("youngest spouse", "Both LAs at 17.5% ceiling", "Prepared for Jane Smith & Spouse B") branches on the `p.single` flag that `project()` returns. Single mode is never persisted — a cold reload always opens in Couple.

### Plan-bar
Paper-2 background, hairline border, 8px radius, 18px top margin so the bar doesn't butt against the browser chrome. Left side = brand eyebrow (`Simple Wealth · Retirement Drawdown`) + `Family <surname>` + `Prepared <date>`. Right side (`.plan-bar-lite-actions`, `display: inline-flex; gap: 10px;`) = `Export report →` ghost + `Edit plan ↓` ghost. The plan-bar is the State-2 top-nav: plan-level navigation (Edit) and the canonical client-PDF action (Export report) both live here. `#pb-family` reads from the State-1 title-plate span `#hl-family`; it updates whenever `refresh()` fires, so flipping between states keeps it current.

### Canvas head (State 2)
Removed in Session 11. Every action it used to carry is now either in the plan-bar (`Export report`) or on the chart-controls row (`Auto-top-up`, `Lock as baseline`). The outcome strip sits directly below the plan-bar with the standard 20px plan-bar margin-bottom as its only breathing room. State 3 still uses `.canvas-head.compact` for the compact "What if we nudge the levers?" headline + action cluster — that variant is unchanged.

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

Sits below the plan-bar. Controls row (`.controls-row`) above the chart card: `Income | Capital | Table` segmented selector on the left; on the right, a `.controls-row-right` cluster holds `[Auto-top-up pill] [Real | Nominal] [Lock as baseline →]` (`display: flex; justify-content: space-between;` on the outer row, `display: inline-flex; gap: 12px;` on the cluster). The pill moved here from the canvas-head action cluster in Session 10; `Lock as baseline` joined the cluster in Session 11 when the canvas-head was retired entirely. Lock is a scenario-level CTA tied to the current projection (it freezes `project()` into the baseline), so sitting on the chart-controls row alongside the view mode switches is semantically correct — plan-level navigation (Export report, Edit plan) lives on the plan-bar above.

Chart.js only — no plugins from npm, no other libraries. Two inline plugins are registered for the Income chart:

- **Income chart (default)**: five datasets, four of them stacked bars in stack `'income'`. **No explicit `order:` values** — stacking follows array index, so the visual top-to-bottom is Tax → Other → Disc → LA (and the transparent Target line is behind them):
  1. **LA (net)** — teal `#2a6b6b`, LA rand draw minus its share of household tax.
  2. **Disc (net)** — gold `#b8893c`, disc draw minus its share of household tax (which is mostly the CGT on the realised gain for that draw, but is apportioned from the single household tax total).
  3. **Other (net)** — navy-soft `#38495b`, other taxable income minus its share of household tax.
  4. **Target need** — invisible `line` dataset (transparent border/fill) retained as the per-year data carrier for both plugins and as the legend toggle target.
  5. **Tax** — dusty rose `--pink` `#d27a88`, stacks **on top** of 1–3 so the bar TOTAL = gross income. Colored portion = net to bank; pink cap = household tax bite. On-target years: colored sum lands exactly on the target line. Shortfall years: the gap between colored top and target line is the actual shortfall. This is deliberate (Option B) — the client sees the tax slice rather than a target line floating below the gross-bar tops. The pink is loud on purpose; the tax bite is the single most resonant figure in a client meeting.
  - Tax apportionment (per year): `laTax = tax × la/gross`, `discTax = tax × disc/gross`, `otherTax = tax × other/gross`, where `gross = la + disc + other`. All three sources bear their proportional share of the household tax total (which already includes CGT on disc gains). Bar total = gross; colored sum = gross − tax = net to bank. See `incomeBarSeries()` in the engine.
  - Bar datasets are flush: every bar dataset carries `categoryPercentage: 1.0, barPercentage: 1.0` so adjacent years touch with zero horizontal gap (Session 12). Chart.js defaults (0.8 × 0.9 ≈ 0.72) would leave ~28% whitespace between bars, which is too loose for the private-bank-note density the rest of the page aims for.
  - **Year dividers**: each bar dataset also carries `borderColor: '#ffffff'` + `borderWidth: { top: 0, right: 1, bottom: 0, left: 0 }` + `borderSkipped: false` (Session 13). Renders a 1px white line on the right edge of every bar, producing a faint vertical divider between adjacent years. Top/bottom/left borders stay at 0 so the stacked LA→Disc→Other→Tax segments read as continuous colour blocks — no horizontal lines inside the stack.
  - `targetBoxPlugin` (afterDatasetsDraw) draws the target as a **solid bold stepped top line** (navy `#1f2d3d`, 2.5px, no dash — shifted from coral in Session 13 so the target reads as an editorial ink line and the coral signals stay reserved for shortfall narration): per-year horizontal segments spanning the full x-slot (adjacent years touch at the slot boundary) joined by vertical step segments only where `target[i+1] !== target[i]`. No left/right sides, no bottom edge, no hairlines falling to the x-axis. Real mode → flat line; Nominal mode → staircase.
  - `shortfallShadingPlugin` (afterDatasetsDraw, registered second) paints a coral wash between the colored-bar-top and the need-line for shortfall years, plus a dashed vertical at the first shortfall age with a 10px Inter Tight label. Shortfall is detected by `net < target`, correctly now that bars represent net.
  - Both plugins compute a uniform `slot = xScale.getPixelForValue(1) - xScale.getPixelForValue(0)` once and use it for every year, including the last. The earlier `xNext = xScale.right` fallback for `i === N-1` collapsed the final year's target segment and shortfall wash to a half-slot, which appeared as white vertical stripes at the right edge of the chart during the depleted-years region. Fixed in Session 12.
- **Capital chart**: stacked LA + Disc bars with a secondary-axis dashed coral withdrawal-rate line. Matches the Income chart's bar treatment from Session 13 — `categoryPercentage: 1.0, barPercentage: 1.0` (flush bars) plus `borderColor: '#ffffff'` + `borderWidth: { right: 1 }` + `borderSkipped: false` (1px white year dividers). The coral withdrawal-rate line and its y1-axis ticks/title stay coral — a ratio signal distinct from the navy target line on the Income chart.
- **Table view**: the existing year-by-year table, with per-spouse clamp flags in coral (▲ cap) / green (▼ floor).
- **Tax view**: per-spouse Y1 tax breakdown lifted into the chart-card slot from the old `#shared-chrome` panel. A `.tax-year-scrub` row at the top of the panel holds a paper-2 pill containing `Year N` (a numeric readout) and a range-input slider that scrubs across all projection years (`min: 1`, `max: p.years`, `step: 1`). The slider scrub repaints only the tax tables and the family-eff footer — no `project()` re-run, no other renderer touched. Per-spouse `<h4>` headings read `Spouse A · age 65` with the age driven by the year object. A `.tax-family-eff` row at the bottom (separated by a hairline) shows `EFFECTIVE FAMILY INCOME TAX RATE   X.X%` in `--coral` — the combined household effective rate `(taxA.tax + taxB.tax) / (taxA.grossIncome + taxB.grossIncome)` for the currently-selected year. Coral is the only red on the page that isn't a shortfall signal; here it's deliberate — the tax bite is the single most resonant figure in a meeting and earning a coral footer makes that point without overloading the shortfall vocabulary on the chart. Single-client mode hides the Spouse-B half via `body[data-client-mode="single"] .tax-grid { grid-template-columns: 1fr }`; the family-eff footer reduces to Spouse A's rate (taxB is zero-synthetic). Cold-load slider lands on Year 1, byte-identical to the old single-year tax panel.
- **State 3 mini charts**: `buildCompareMiniChart(which, p)` renders a 180px-tall Chart.js instance inside each `.compare-mini-chart` wrapper (`#cmp-chart-baseline` + `#cmp-chart-scenario`). Same 5-dataset layout and both plugins as the main chart, but tooltips off, y-ticks off, fewer x-ticks. Baseline wrapper sits at `opacity: 0.55` so the locked snapshot reads as muted against the vivid scenario.
- **Cold-load Income legend**: only the navy target staircase paints on first load. `incomeSeriesVisible` defaults `{la:false, disc:false, other:false, tax:false, target:true}` and the four bar-series legend buttons render with `class="series-toggle off"` + `aria-pressed="false"` so the muted-grey state matches engine state. Click any pill and its colour fades back in via an instant in-place `dataset.hidden` toggle (no destroy, no animation — same idiom as a slider drag). Editorial intent: open the conversation with "what's our target?" before introducing how it gets funded.
- **Card-height parity across all four views**: `.chart-card` is `display: flex; flex-direction: column; min-height: 600px` and `.chart-wrap` is `min-height: 480px; flex: 1 1 auto`. Income / Capital with legend strip + alerts strip → the wrap shrinks to ~480px (chart's natural target). Table / Tax with neither → the wrap expands to fill the freed ~120px so `tax-view-wrap` and `year-table-wrap` (positioned `inset: 0`) cover the larger box and the tax breakdown fits without internal scroll on a 14" viewport. All four cards render at the same outer footprint, no per-view branching.

### Alerts bar
Above the chart body, populated when the plan hits constraints. Hidden entirely when quiet AND on the Table / Tax views (the table itself shows clamp markers per cell; the tax view has no chart constraint to narrate). Variants: `.chart-alert.cap` (LA ceiling), `.chart-alert.disc` (discretionary exhausted), `.chart-alert.shortfall` (real shortfall vs target).

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
