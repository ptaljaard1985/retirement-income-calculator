# Design

The visual system for the drawdown calculator. These choices are deliberate — don't drift from them without a conversation.

## Philosophy

**The calculator is a conversation tool, not a dashboard.** It gets opened during a client meeting, the adviser moves sliders while the client watches, and a PDF is printed and emailed. That context dictates every visual choice:

- Legible at 2m on a shared laptop, printable to A4 without cropping.
- Professional advisory-firm aesthetic, not fintech-startup.
- No unnecessary motion, no loading states, no "oh did you see that?" animations.
- Everything that matters fits above the fold on a 13-inch screen.

## Design tokens

All colours, spacing, and radii are CSS variables in `:root`. If you need to change the palette, change it there, not in component rules.

```css
:root {
  --ink: #1a1a1a;
  --ink-muted: #5a5a5a;
  --ink-faint: #8a8a8a;
  --line: #e5e5e0;
  --line-strong: #c8c8c0;
  --surface: #ffffff;
  --surface-alt: #faf9f5;      /* warm off-white page background */
  --surface-warm: #f3f1e8;     /* toggle background, assumptions panel */
  --brand: #2d3e50;            /* Simple Wealth navy */
  --brand-accent: #c89a3c;     /* gold, used sparingly */
  --success: #3b6d11;
  --danger: #a32d2d;
  --blue: #185fa5;             /* chart: projected fund */
  --coral: #993c1d;            /* chart: target, cap alerts */
  --radius: 8px;
  --radius-lg: 12px;
}
```

The warm off-white page background (`--surface-alt`) is the most important colour choice in the system. It makes the page read like paper rather than a web app. Do not drift toward `#f8f9fa` or any cold grey.

## Typography

System font stack:

```css
-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif
```

Base size: 15px, line-height 1.55. Two weights only: 400 (regular) and 500 (medium). Never 600 or 700 anywhere in the UI.

Any number that updates live (slider readouts, summary cards, table cells) uses `font-variant-numeric: tabular-nums`. This stops the layout jittering as sliders move.

Scale:

- H1: 26px / 500 / letter-spacing -0.3px
- Summary card value: 28px / 500
- Section headers: 11px uppercase, letter-spacing 1.5px, weight 600
- Body: 15px
- Slider label: 13px muted
- Slider readout: 14px / 500 / tabular
- Field label: 11px uppercase, letter-spacing 1px

## Layout

- Max width 960px, centred, 32px horizontal padding.
- Radii: 8px for inputs and toggles, 12px for cards.
- Hairlines: 1px solid `--line`. The 2px navy line under the header is the only thicker border.
- Card padding: 18–22px.
- Grid gaps: 14–18px between cards.

## Component conventions

### Summary cards

Four across (three on older builds, now four). The first is filled navy with white text — the "primary answer" card. The rest are white with hairline borders.

Structure per card: tiny muted label (12px), big value (28px / 500), optional sub-value (12px muted). The gap card uses green/red on the value depending on sign.

### Sliders

Custom-styled range inputs:

- Track: 4px tall, `--line-strong`, radius 2px
- Thumb: 18px circle, navy, 2px white border, subtle shadow
- Both `::-webkit-slider-thumb` and `::-moz-range-thumb` defined

Each slider sits inside a `.lever` block: muted 13px label on the left, 14px tabular value on the right, range input full width below. Sliders are grouped under section titles with top borders.

### Toggles

The Capital/Income/Table view toggle, the Real/Nominal toggle, and the solve button all sit in a `.controls-row` above the chart card. Active state is a white pill with brand navy outline; inactive is muted grey.

### Chart

Chart.js with heavy default overrides. Capital view:

- Stacked bars, LA in teal (#2a6b6b), Disc in gold (#c89a3c)
- A secondary-axis line for the household withdrawal rate, dashed in coral
- Custom HTML legend (buttons that toggle `dataset.hidden`)

Income view:

- Navy-blue line for gross, coral for tax, green for net (with fill), navy-dashed for target

Table view:

- Sticky Year column (left), sticky header rows (top)
- Per-spouse columns grouped with coloured separators
- Green/red gap column, red ▲ / green ▼ markers on LA draw cells when clamped

### Alerts bar

Between the chart legend and the canvas, populated when the plan hits constraints. Three pill variants:

- `.chart-alert.cap` — red background, ▲ icon
- `.chart-alert.disc` — amber background, ● icon
- `.chart-alert.shortfall` — dark red background, ⚠ icon

Hidden entirely when there are no alerts.

### Events section

One row per event: year input, amount input, spouse selector, delete button (36×36 square with ×). An "Add capital event" button in dashed-border style at the bottom. Empty state reads "No capital events. Click below to add one."

## Interactions

Everything recalculates on every `input` event. No debouncing. The whole projection runs in single-digit milliseconds; you cannot drag a slider fast enough to lag the chart.

Sliders use direct manipulation: move the thumb, see the number change at the top-right, see the chart redraw, see the summary cards update. The feedback loop is immediate.

The "Solve LA rates to target" button does a binary search for the equal LA rate that hits the target and snaps both sliders. It's the most valuable single interaction in a meeting.

## Print

```css
@media print { ... }
```

Hides: toggles, buttons, solver button, tax panel (too dense for paper), chart series-toggle buttons.

Shows: everything else. The print summary block is pushed to a new page with `page-break-before: always` to keep the interactive chrome separate from the compliance document.

Every calculator must be reviewed in print preview before shipping. Print-only regressions are subtle and common — a button that accidentally prints, a header that doesn't repeat on page 2, a table cut off mid-row.

## Don't

- Don't use pure black or pure white. Both read as cold and out of character.
- Don't add hover animations on cards, sliders, or buttons beyond the colour transitions already in place.
- Don't introduce a second accent colour. Gold exists but is reserved — the navy does the heavy lifting.
- Don't use weight 700. Medium (500) is the boldest weight in this system.
- Don't use emoji. Not in the UI, not in tooltips, not in print.
- Don't replace Chart.js defaults with chart.js plugins. Stock Chart.js is capable enough.

## References

The aesthetic is closer to a Bain or McKinsey deliverable than a SaaS dashboard. If you need a reference, look at:

- Private bank annual reports (Julius Bär, Rothschild)
- The Economist / FT Lex columns (confident density, muted two-colour charts)
- Edward Tufte's spark charts and small multiples (every ink mark earns its place)

Not at: Robinhood, Wealthfront, any consumer budgeting app.
