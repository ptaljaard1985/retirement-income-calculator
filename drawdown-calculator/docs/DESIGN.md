# Design

The visual system for the drawdown calculator. These choices are deliberate — don't drift from them without a conversation.

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

A **shared chrome** block (`#shared-chrome`) holds the per-spouse drawdown levers and the full tax panel. It's visible in Single + Compare, hidden in Empty (`body[data-app-state="empty"] #shared-chrome { display: none; }`).

Crossfade on state change is a simple `opacity` + `display` swap via `.state.is-hidden`. The `setAppState(next)` helper writes to `localStorage` so the last state survives reloads.

## Layout

- Page max-width is content-driven; each state canvas constrains internally (`.empty-canvas` at 920px).
- Radii: `--r-sm: 4px` (small inputs), `--r: 6px` (standard), `--r-lg: 10px` (cards + panels).
- Hairlines: `--hairline` (#e4e1d8) 1px solid for dividers; `--line` (#d4cfc2) for slightly stronger borders.
- Card padding: 18–26px depending on density.
- Vertical rhythm: 22–40px between major sections, 10–18px between field groups.

## Component conventions

### Title plate (State 1)
Centred. Eyebrow above a Fraunces 44px headline with two `contenteditable` spans (`#hl-family`, `#hl-monthly-empty`). Dashed underline when empty; on focus, `--paper-2` background. Monospace "Prepared DD Month YYYY" below.

### Plan-bar
Paper-2 background, hairline border, 8px radius. Left side = brand eyebrow + key facts (household, capital, target, date). Right side = `Edit plan ↓` ghost button that flips to State 1.

### Canvas head (State 2)
Left: eyebrow + editorial headline + sub-paragraph. Right action cluster:
- `.toggle-pill` (Auto-top-up) — default ON
- `.seg.mini` (Real | Nominal) — default Real
- Ghost `Print ↓` button
- Primary `Lock as baseline →` (flips to State 3 with a frozen snapshot)

### Outcome strip
Three cells, first is teal primary (white text). Cells: `Lifestyle sustainable until age N · K years`, `Year-1 income need`, `Funded by LA X% · Disc Y% · Other Z%`. The primary cell flips from teal (verdict sustainable) to plain navy (stretched) automatically.

### Compare two-up (State 3)
Grid `1fr 1fr`, 22px gap.
- **Baseline** card: `--paper-2` background, muted. "Locked" label. Big italic longev value. Meta rows (LA draws, disc draw, needs, markets).
- **Scenario** card: navy 1px border + shadow ring. Delta chip top-right: gold for ≥0, coral for negative. Meta rows repeat with inline italic `--gold-2` delta deltas.

### Chart

Chart.js only — no plugins from npm, no other libraries. Two inline plugins are registered:

- **Income chart (default)**: stacked bars (teal LA + gold Disc + navy-soft Other) plus a dashed coral line dataset for the target need. The `shortfallShadingPlugin` fills coral rectangles between bar-top and need-line for shortfall years, plus a dashed vertical at the first shortfall age with a 10px Inter Tight label.
- **Capital chart**: stacked LA + Disc bars with a secondary-axis dashed coral withdrawal-rate line. New tokens applied (teal unchanged, gold shifts to `#b8893c`, coral shifts to `#a04438`).
- **Table view**: the existing year-by-year table, with per-spouse clamp flags in coral (▲ cap) / green (▼ floor).

### Alerts bar
Above the chart body, populated when the plan hits constraints. Hidden entirely when quiet. Variants: `.chart-alert.cap` (LA ceiling), `.chart-alert.disc` (discretionary exhausted), `.chart-alert.shortfall` (real shortfall vs target).

### Narrative
White card with a 2px gold left-bar. Fraunces italic prose in `<p>` blocks. Inline callouts (`.callout` / `.warn` / `.neg`) woven through sentences. Content is selected by `narrativeForProjection(p, an)` based on verdict and clamp events — no math, just sentence selection.

### Canvas footer
Thin row: `Illustrative only · 2026/27 SARS tables · auto-top-up on · real terms` on the left; `Year-by-year table` + `One-page summary ↓` buttons on the right.

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

Editable title-plate spans are `contenteditable`. `#hl-monthly-empty` is bi-directionally bound to `#needs-monthly` — edits propagate both ways on blur. `#hl-family` is free-text editorial only (does not feed the engine).

## Print

`@media print` forces `state-single` visible on paper regardless of the on-screen state and hides every interactive chrome (plan-bar, toggles, buttons, chart legend, canvas-head-actions, canvas-foot, State-1, State-3, and the shared-chrome control buttons). The `.print-summary` block remains the compliance document on a new page (`page-break-before: always`).

Print colours use `-webkit-print-color-adjust: exact` on the outcome-primary cell, narrative, chart card, and tax panel so gold/teal/coral survive the print driver.

A `beforeprint` listener also force-switches `appState` to `single`, resizes Chart.js canvases, and restores the previous state on `afterprint` — belt-and-braces to the CSS rules.

Every calculator must still be reviewed in print preview before shipping. Print-only regressions are subtle and common.

## Don't

- Don't use pure black or pure white. Both read as cold and out of character.
- Don't add hover animations on cards, sliders, or buttons beyond the colour / scale transitions already in place.
- Don't introduce a third accent colour. Gold and coral carry the accents; teal is reserved for LA.
- Don't replace Chart.js with a different charting library.
- Don't use emoji.
- Don't break the `contenteditable` title-plate binding. If you change `#needs-monthly`, re-test the headline sync.
- Don't hide the shared chrome outside of State 1.

## References

The aesthetic is closer to a Bain or McKinsey deliverable than a SaaS dashboard. If you need a reference, look at:

- Private bank research notes (Julius Bär, Rothschild)
- The Economist / FT Lex columns
- Edward Tufte's small multiples

Not at: Robinhood, Wealthfront, any consumer budgeting app.
