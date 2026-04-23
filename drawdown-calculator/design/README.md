# Handoff: Retirement Drawdown — Sustainability Redesign

## Overview

A redesign of the Simple Wealth retirement drawdown calculator. The tool helps a couple (two spouses) understand **whether their desired monthly lifestyle is sustainable in retirement, and until what age** — given their living-annuity balances, discretionary portfolios, other retirement income (DB pensions, rental), and one-off family capital events.

The core adviser question the tool must answer out loud, in one sentence:
> "R 50 000 a month is **sustainable** until age 94."

If that sentence isn't true, the UI guides the couple to adjust one of four levers:
1. **Expenses** (lower the monthly target)
2. **Investment returns** (change risk profile)
3. **Retirement age** (work longer, or start drawing later)
4. **Income** (add pension, rental, reduce LA draw, etc.)

The design is delivered as **three connected states**:
- **State 1 — Empty (Title plate + Setup):** captures couple, balances, other income, needs, and capital events
- **State 2 — Single scenario:** the projection, framed around sustainability
- **State 3 — Compare:** baseline locked vs tweaked scenario, side-by-side

---

## About the Design Files

The files in `design_files/` are **design references — HTML/CSS/JSX prototypes** showing intended look, layout, typography, and behavior. They are **not production code to copy directly.**

Your task is to **recreate these designs in the existing Simple Wealth drawdown codebase** — matching its framework (React / Vue / Svelte / vanilla — whichever it uses), its component conventions, its styling approach (CSS modules, Tailwind, styled-components, etc.), and its data layer.

**Critical constraint:** the existing drawdown calculator already has calc logic and data hooks wired up. **Preserve them.** This is a re-skin + UX reframing, not a rewrite of the math. The new UI should call the same projection engine, read the same inputs, and render the same year-by-year data — just presented differently.

### What to do first
1. Read the existing drawdown calculator source to understand the framework and data contract.
2. Open `design_files/Retirement Drawdown Hi-Fi.html` in a browser to see all three states live.
3. Cross-reference the individual JSX state files against the CSS tokens in `drawdown-calc.css` for exact values.
4. Map the existing data/state to the new components before writing any markup.

---

## Fidelity

**High-fidelity.** Final colors, typography, spacing, interactions. Pixel-perfect recreation expected. Every hex value, px measurement, and CSS variable below is intentional. Before deviating, check the CSS file.

---

## Design System / Tokens

All tokens are defined as CSS variables at the top of `design_files/drawdown-calc.css`. Port them to the target codebase's token system (Tailwind config, CSS variables, theme object — whatever the codebase uses).

### Colors

| Token | Hex | Usage |
|---|---|---|
| `--ink` | `#1a1f26` | Primary body text, headlines |
| `--ink-2` | `#3a4250` | Secondary text, baseline card values |
| `--mute` | `#7a8292` | Eyebrows, captions, labels |
| `--faint` | `#b4bac4` | Placeholder / disabled text |
| `--hairline` | `#e4e1d8` | Dashed dividers, subtle borders |
| `--line` | `#d4cfc2` | Solid borders |
| `--paper` | `#faf7f0` | Primary warm-white page background |
| `--paper-2` | `#f2ede2` | Rail + inset panel background |
| `--paper-3` | `#ebe4d3` | Deeper inset (ledger rows) |
| `--surface` | `#ffffff` | Pure white surfaces (rare) |
| `--navy` | `#1f2d3d` | Brand primary, CTA bg, scenario ring |
| `--navy-2` | `#2d3e50` | Hover/alt navy |
| `--navy-soft` | `#38495b` | "Other income" bar fill in income chart |
| `--gold` | `#b8893c` | Brand accent, discretionary bars, CTA fg |
| `--gold-2` | `#9c7226` | Serif italic numerals, gold-underline |
| `--gold-soft` | `#e3c987` | CTA sub-text on navy, soft accents |
| `--gold-pale` | `#f5ebd1` | Gold wash backgrounds |
| `--teal` | (defined in primitives) | Living annuity bars |
| `--coral` | (defined in primitives) | Target-need line, shortfall, warnings |
| `--coral-pale` | (defined in primitives) | Depletion-zone shading |
| `--pos` | `#2f6b3a` | Positive amounts (capital inflows) |
| `--neg` | `#a64236` | Negative amounts (outflows), coral-adjacent |

### Typography

Three families — **do not substitute**:

```css
--serif: 'Fraunces', Georgia, serif;   /* editorial headlines, italic numerals, captions */
--sans:  'Inter Tight', sans-serif;    /* body, labels, UI */
--mono:  'JetBrains Mono', monospace;  /* all numeric values, tabular data */
```

Load via `@import` from Google Fonts. Fraunces is used **with optical sizing** (`opsz`) — respect the font's variable axes.

**Type scale:**
- Editorial headline (`.headline`): Fraunces, 44px / 1.1, weight 400, italic numerals inline
- Hero outcome value: Fraunces, italic, 56–60px
- Section title: Inter Tight, 14px, weight 500
- Eyebrow / uppercase label: Inter Tight, 10–11px, uppercase, letter-spacing 1.6–1.8px, weight 600, `--mute`
- Body: Inter Tight, 13.5–14px / 1.5
- Numeric value: JetBrains Mono, tabular-nums, weight 400–500
- Callout inline: Inter Tight, 13.5px, subtle background wash (see inline-callout styles)

### Spacing & radii

```css
--r-sm: 4px;
--r:    6px;
--r-lg: 10px;
```
Standard vertical rhythm: sections separated by 28–40px, field groups 10–18px.

---

## State 1 — Empty (Title plate + Setup)

**Purpose:** Capture the couple's opening position before running the projection. This is the "blank scorecard" the adviser fills in with the client.

**Source file:** `design_files/drawdown-state-1.jsx`

### Layout (top → bottom)

1. **Title plate** (centred)
   - Eyebrow: `SIMPLE WEALTH · RETIREMENT DRAWDOWN` (uppercase, letter-spacing 1.8px)
   - Headline (Fraunces, 44px/1.21): `A plan for [the _____ family], living off [R _____ a month].`
   - The two bracketed spans are **contenteditable inline** (behavior: click-to-edit, save on blur, persist to the plan model). Placeholder text is underlined with an extended em-dash. If contenteditable is too brittle in your stack, fall back to click-to-edit that swaps the span for a `<input>` while focused.
   - Hairline rule beneath, then monospace date: `Prepared 23 April 2026`.

2. **Spouse setup** — two columns, `1fr [divider] 1fr`, ~40–52px gap
   - Each column:
     - Step label: `I. Spouse A` (serif italic roman numeral in gold-2, rest in ink)
     - Name + age row: `<input placeholder="First name">` + "age" label + age input
     - Subhead: `RETIREMENT CAPITAL` (uppercase 10px)
       - Three fields: `LA balance`, `Discretionary`, `Disc. base cost` (hint: "CGT")
     - Subhead: `OTHER INCOME`
       - Two-column inner row: `DB pension (/ month)`, `Rental / other (/ month)`
       - `＋ Add income source` button (soft dashed outline)
   - Vertical hairline divider between columns

3. **Household needs strip** — three columns, same width each
   - `III. Monthly household need` — big numeric with R prefix; hint "after tax · today's money"
   - `IV. Annual lump sums` — same styling; hint "holidays, car, home"
   - `V. Market assumptions` — `9% · 5%`; hint "return · CPI"

4. **Family capital events ledger** (full-width section)
   - Title: `VI. Family capital events` + italic hint "one-off inflows and outflows along the timeline"
   - Ledger grid: `When | Event | For whom | Amount`
   - Ghost placeholder rows showing example events (Property sale 2028 +R___, Child's wedding 2031 −R___)
   - `＋ Add capital event` button inside the ledger
   - Amounts right-aligned, monospace, tabular-nums, green/red for pos/neg

5. **CTA bar** (navy background)
   - Left: serif italic eyebrow "Ready to see if this lifestyle is sustainable?" + grey-gold subtext explaining what happens
   - Right: **`Build the projection →`** button (gold bg, navy text, 14px, 14/22px padding)

### Editable-spans behavior (State 1 title)
Click-to-edit inline — span becomes contenteditable on click, saves on blur back to the model. Show the underline placeholder when empty. If your framework prefers controlled inputs, swap for an inline `<input>` that mimics the span's typography when focused.

### CTA behavior
Clicking **Build the projection →** transitions to State 2. Recommended: **same-page, 300–400ms crossfade** between State 1 and State 2 (State 1 content fades out, projection chart slides up). If your app is route-based, it's fine to navigate to a new route — but preserve the feeling that this is one continuous document, not a form-submit-then-reload flow.

---

## State 2 — Single scenario (Sustainability projection)

**Purpose:** Answer "is this lifestyle sustainable, and for how long?" in a single editorial sentence, backed by the chart.

**Source file:** `design_files/drawdown-state-2.jsx`

### Layout (top → bottom)

1. **Plan inputs bar** (collapsed summary of State 1 inputs with "Edit plan ↓" button — see `drawdown-plan-inputs.jsx`)

2. **Canvas head** (hero)
   - Eyebrow: `Sustainability projection · today's money`
   - Headline (Fraunces 44px/1.1): `R 50 000 a month is <em>sustainable</em> until age 94.` — numbers in mono-italic, "sustainable" in italic serif, "age 94" gold-underlined
   - Sub-paragraph (14px/1.5): explains the mechanism in plain language (~2 sentences)
   - Right-aligned actions cluster:
     - **Auto-top-up toggle pill** — **default ON**. Toggling off changes the projection to let disc-portfolio shortfalls flow through as actual income shortfalls
     - Real/Nominal segmented pill — default **Real** (today's money)
     - `Lock as baseline →` button (primary, navy)

3. **Chart card**
   - Head: legend on the left, view-toggle segmented (`Income | Capital | Table`) on the right — **default view is Income**
   - Chart body (300px tall)
   - **Income chart** (default): stacked bars per year — teal (LA draw) + gold (disc draw) + navy-soft (other income), with a dashed coral "target need" horizontal line. Shortfall years get a coral wash between the total bar top and the need line. See `IncomeChart` in `drawdown-primitives.jsx`.
   - **Capital chart**: stacked LA + disc capital over time, withdrawal-rate line overlay (dashed coral), LA-cap marker at age 90, depletion wash after depletion age
   - **Table view**: year-by-year table (not yet designed — show a placeholder for MVP)

4. **Outcome strip** — three cells, teal-bar first
   - Primary: `Lifestyle sustainable until age 94 · 29 years` (longev italic numeric, teal left-bar)
   - `Year-1 income need` — `R 50 000` — "per month · after tax"
   - `Funded by` — `LA 66% · Disc 23% · Other 11%` — "year-1 income mix"

5. **Year-1 tax strip** (condensed)
   - Title: `vi. Year 1 tax · 2026/27 tables`
   - Two spouse cells, each showing: Gross income, Tax payable, Effective rate
   - Footer: household tax total + "See full tax breakdown ↓" drawer link (opens full SARS-table detail)

6. **Narrative section** — editorial prose in `<p>` blocks
   - Eyebrow: `Is this sustainable?`
   - 3 paragraphs that walk through the story: comfortable early, disc exhausts mid-horizon, LA ceiling hit late, and a counter-factual ("if returns fall to 7%...")
   - Inline **callouts** woven into prose — three variants:
     - `.callout` — gold wash (neutral factual)
     - `.callout.warn` — amber (soft caution: "disc pot exhausted", "LA ceiling hit")
     - `.callout.neg` — coral (hard warning: depletion, shortfall)

7. **Canvas footer** — illustrative-only disclaimer + `Year-by-year table` + `One-page summary ↓` buttons

### Chart defaults
- **Default view:** Income
- **Default toggle:** Auto-top-up ON, Real (not nominal)
- Scale: y-axis is auto from max total income; x-axis ages from 65 → 100 (or couple's actual ages)

---

## State 3 — Compare (baseline locked)

**Purpose:** Let the adviser nudge levers from a locked baseline and show what changes in **sustainability horizon** and income mix.

**Source file:** `design_files/drawdown-state-3.jsx`

### Layout

1. **Plan inputs bar** — same as State 2, collapsed

2. **Canvas head** (compact)
   - Eyebrow: `Scenario compare · baseline locked`
   - Compact headline (42px): `What if we <gold-underline>draw R 5 000 more</gold-underline>?`
   - Right actions: Auto-top-up, Real/Nominal, `Clear baseline` (ghost), `Re-lock as new baseline` (primary)

3. **Compare two-up** — CSS grid, `1fr 1fr`, ~32px gap
   - **Baseline card** (muted, paper-2 bg, hairline border)
     - Tag: `Baseline · current plan` + `LOCKED` label
     - Big value: `age 94 · 29 years` (longev italic)
     - Subtitle: starting conditions
     - Income chart (220px, faded 35% opacity)
     - Meta rows: LA draw per spouse, disc draw household, monthly need, return·CPI
   - **Scenario card** (navy 2px border, paper bg)
     - Tag: `Planned scenario` + **delta chip** e.g. `− 5 years · depletes at 89` (coral)
     - Big value: `age 89 · 24 years`
     - Subtitle: "R 55 000/mo · auto-top-up covers R 3 500 shortfall"
     - Income chart with shortfall shading from age 86 onward
     - Same meta rows, with deltas in gold italic `+0.75`, `+60k`, `+5k`

4. **Chart legend** (centred beneath both cards)

5. **Scenario levers** panel
   - Head: `vii. Scenario levers` + italic hint "centred on the locked baseline — nudge to explore" + `Solve to target →` link (quiet, not a button)
   - **Per-spouse sub-panels** — two columns, each:
     - Head: spouse name + "Spouse A · age 65"
     - Slider: `LA drawdown rate` with % value + delta
     - Slider: `Annual discretionary draw` in R with delta
   - **Shared levers row** — three columns beneath
     - `Markets`: Expected return, Inflation (CPI)
     - `Household need`: Monthly after-tax expenses, Annual lump sums
     - `Capital events`: ledger rows (Property sale 2028 +R 2.5m, DB pension Marilyn R 6 500/mo) + `＋ Add an event`

### Slider component
- Rail 4–6px tall, `--hairline` track with `--gold` fill up to `--fill` %
- Thumb is a 14px circle with a subtle shadow
- Head row: label + value + optional delta (gold-2 italic)
- See `Slider` in `drawdown-primitives.jsx`

---

## Charts — detailed specs

Both charts are in `design_files/drawdown-primitives.jsx` — `DrawdownChart` and `IncomeChart`. They use inline SVG (no external libs). If your codebase already has a chart library (Recharts, VisX, etc.) you may port the visual language onto that — but **preserve these specifics**:

### IncomeChart (the default in States 2 & 3)
- Stacked bars, year-by-year from startAge → startAge+years
- Bar segments bottom-to-top: teal (LA) → gold (Disc) → navy-soft (Other income)
- Bar width: `W/years - gap`, gap = 18% of bar slot
- Horizontal dashed coral line at y = `need / max` representing the target income need
- **Shortfall shading:** when total bar height < need, a coral rectangle fills the gap between bar top and need line at 25% opacity
- Shortfall rule: dashed vertical coral line at `shortfallFrom` age, labelled "shortfall begins · age N"
- Y-axis: 5 tick labels in mono `R Xk`
- X-axis: 8 age tick labels in mono `age X`

### DrawdownChart (Capital view)
- Stacked bars: teal (LA) + gold (Disc) capital balance over time
- Shape: LA decays slower than disc; disc exhausts mid-horizon
- Optional withdrawal-rate polyline in coral, dashed, with a right-hand 0–20% axis
- LA-cap marker: dashed coral vertical rule at `capMark` age
- Depletion: coral-pale wash after `depleteAt`, labelled "depletes · age N"

---

## Interactions & Behavior

### Transitions
- State 1 → State 2: 300–400ms crossfade / vertical slide
- Clicking `Lock as baseline →` in State 2: 250ms cross-dissolve into State 3 two-up layout
- `Clear baseline` in State 3: reverse back to State 2

### Toggles & controls
- **Auto-top-up pill**: toggling recomputes projection immediately; default ON. When ON, discretionary shortfalls are topped up from LA until LA hits its 17.5% ceiling
- **Real / Nominal**: recomputes display values; does not re-run projection
- **Income / Capital / Table**: swaps the chart area only; no data re-fetch

### Sliders (State 3)
- Drag or click-to-position
- Debounce recompute ~100ms
- Delta vs baseline shown in gold italic, updated live
- `Solve to target →` link: opens a small inline panel where adviser picks the target outcome (e.g. "capital lasts to age 95") and the system back-solves the lever it's told to solve for

### Editable spans (State 1 title)
- Click to edit; Enter or blur to save; Esc cancels
- Persist to plan model on save
- Show underlined placeholder when empty

### Contenteditable age / name inputs
- Standard form fields wired to plan state
- No debounce — save on blur

### Hover states
- Buttons: darken 8% on hover, 12% on active
- Sliders: thumb scales 1.1× on hover
- Toggle pills: subtle background shift

---

## State Management

The following state variables (at minimum) drive the UI:

```ts
type Plan = {
  familyName: string;
  monthlyNeed: number;           // R / month, after tax, today's money
  annualLumpSums: number;
  returnPct: number;             // 0.09
  cpiPct: number;                // 0.05
  spouses: [Spouse, Spouse];
  capitalEvents: CapitalEvent[];
  autoTopUp: boolean;            // default true
  displayMode: 'real' | 'nominal'; // default 'real'
};

type Spouse = {
  name: string;
  age: number;
  laBalance: number;
  discretionary: number;
  discBaseCost: number;
  otherIncome: OtherIncome[];    // DB pension, rental, etc.
};

type OtherIncome = { kind: string; monthly: number };

type CapitalEvent = {
  year: number;
  label: string;
  forWhom: string;
  amount: number;                // +ve inflow, -ve outflow
};

type ViewState = {
  currentState: 'empty' | 'single' | 'compare';
  chartView: 'income' | 'capital' | 'table'; // default 'income'
  baseline: Projection | null;   // locked baseline in compare mode
};
```

Projection engine returns year-by-year breakdowns (LA draw, disc draw, other income, total capital, LA balance, disc balance, tax per spouse, sustainability flag). **This engine already exists in your codebase — do not rewrite it.**

---

## Files in this bundle

- `Retirement Drawdown Hi-Fi.html` — the full prototype, open in a browser to see all three states
- `drawdown-calc.css` — all CSS tokens + component styles (reference for exact values)
- `drawdown-primitives.jsx` — chart + field + slider + longevity + toggle components (reference implementation)
- `drawdown-plan-inputs.jsx` — the collapsed "plan summary" bar shown above States 2 & 3
- `drawdown-state-1.jsx` — Empty / setup state
- `drawdown-state-2.jsx` — Single scenario state
- `drawdown-state-3.jsx` — Compare state
- `design-canvas.jsx` — the layout shell that presents all three states side-by-side in the prototype (you do **not** need to port this — it's a design-review harness only)

### To view the prototype
Open `Retirement Drawdown Hi-Fi.html` in a modern browser. The prototype is a static HTML file that loads React + Babel via CDN — no build step.

---

## Accessibility notes

- All sliders must be keyboard-operable (arrow keys adjust, Home/End for min/max)
- Editable spans need `role="textbox"` + `aria-label`
- Colour is load-bearing — supplement coral shortfall shading with an icon/label for colour-blind users
- Ensure focus rings remain visible; don't `outline: none` without a replacement
- Editorial headline font sizes are generous — respect user zoom / reflow

---

## Open questions for the implementer

1. Does the existing projection engine return the `otherIncome` breakdown per year? If not, extend it — this is a new data requirement
2. Does the existing engine support capital events? If not, this is a new input that must flow into the math
3. Does the existing app have a toast/flash system for the "baseline locked" confirmation?
4. Where should the one-page PDF summary be generated — server-side or client (html2pdf)?

Raise these with the product owner before starting implementation.
