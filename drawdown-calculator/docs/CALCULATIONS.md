# Calculations

The maths and tax rules the calculator implements. This is the document to check when you disagree with a number the calculator produces; the test suite in `tests/python/` exercises every rule in here against a fresh Python implementation.

## Overall structure

- Projections are annual, starting at year 1 (the first year of retirement) and running through year N where N = 100 − min(ageA, ageB).
- Each year: draw income at the start of the year, grow the remaining balance at the nominal return for the rest of the year, then apply any scheduled capital events at year-end.
- Position `i` in every series represents year `i + 1`. Balance at position `i` is the start-of-year-(i+1) balance (before that year's draw). Income at position `i` is the income earned during year `i+1`.

## Growth

LA and discretionary balances both grow at the same nominal rate `rNom` (user-selectable). No stochastic modelling. No split between asset classes. One knob.

```
balance_after_growth = (balance_at_start - draw) × (1 + rNom)
```

Note that the draw happens *before* the remainder grows — a simplification that errs slightly conservative vs a smooth in-year draw.

## Living annuity draws

The calculator models LA draws the way South African living annuities actually work:

- Year 1: rand draw = (initial rate × starting LA balance), clamped to [2.5%, 17.5%] of the starting balance.
- Every subsequent year: rand draw = (year 1 rand draw) × (1 + CPI)^(year − 1), then clamped to [2.5%, 17.5%] of *that year's starting LA balance*.

The key insight is that the rand amount, not the percentage, is what escalates. If the pot grows faster than CPI, the effective rate falls. If the pot shrinks, the effective rate rises until it hits the 17.5% ceiling — at which point the rand draw is capped.

The clamp returns a flag:

- `'ok'` — rand draw is within the band
- `'floor'` — rand target was below 2.5%, pushed up to floor (surfaces as ▼ in the table)
- `'cap'` — rand target was above 17.5%, capped at ceiling (surfaces as ▲ in the table)
- `'empty'` — LA balance is zero (can't draw)

## Discretionary draws and CGT

Draws from a discretionary portfolio trigger a realised capital gain. The gain is a proportional share of the unrealised gain in the whole pot:

```
proportion    = draw / balance
cost_used     = base_cost × proportion
gain_realised = draw − cost_used
new_base      = base_cost − cost_used
```

Over time the base cost is drawn down pro-rata, so later draws have progressively lower cost basis per rand and larger gains. This matches how SARS actually treats partial disposals.

The gain feeds into the income tax calculation via the 2026/27 CGT framework:

- Annual exclusion: R50 000 per individual (scaled by bracket creep).
- Inclusion rate: 40% of the excess gain is added to taxable income.
- Taxed at the individual's marginal rate (effectively capped at 18% at the top bracket).

## Income tax

SARS 2026/27 personal income tax, applied per individual (not joint assessment). The calculator uses the announced budget 2026/27 tables:

| Upper bound | Rate | Base tax at this band |
|---|---|---|
| R245 100 | 18% | R0 |
| R383 100 | 26% | R44 118 |
| R530 200 | 31% | R79 998 |
| R695 800 | 36% | R125 599 |
| R887 000 | 39% | R185 215 |
| R1 878 600 | 41% | R259 783 |
| above | 45% | R666 339 |

Rebates (per individual):

- Primary: R17 820 (all ages)
- Secondary: R9 765 (age 65+)
- Tertiary: R3 249 (age 75+)

Tax thresholds (income below which no tax): R99 000 under 65, R153 250 at 65–74, R171 300 at 75+. The calculator does not need these directly because the rebate mechanism produces the same effect: `tax = max(0, pre_rebate_tax − rebate)`.

### Bracket creep

SARS adjusts bracket boundaries and rebates annually, roughly in line with inflation but slower in recent years. The calculator applies a flat 3% per annum growth factor to all brackets, base tax amounts, rebates, and the CGT annual exclusion. The factor is `(1 + 0.03)^yearIdx` where `yearIdx` is the zero-indexed year (year 1 = 0).

This is an approximation — the actual creep has been closer to 0% some years and 6% others. 3% reflects Treasury's stated intention of partial fiscal drag relief.

### Per-spouse age

Each spouse's tax is computed at their own age. Rebates step at 65 and 75 — a spouse turning 65 in year 3 picks up the secondary rebate from year 3 onwards independently of the other spouse.

## Auto-top-up (the three-phase solver)

When the "Auto-top-up to meet target" checkbox is on, each year's income is constructed in three phases:

### Phase 1 — LA at CPI target

Both spouses' LA rand draw = year 1 rand × (1 + CPI)^(year − 1), clamped. Compute LA-only tax. If net LA income ≥ target, stop. Done.

### Phase 2 — fill gap with discretionary

If net LA < nominal target, there's a shortfall. Each spouse contributes to the discretionary top-up in proportion to their discretionary balance:

```
weightA = discBalance_A / (discBalance_A + discBalance_B)
weightB = 1 − weightA
drawA   = min(discBalance_A, grossDraw × weightA)
drawB   = min(discBalance_B, grossDraw × weightB)
```

If one spouse's cap bites, the overflow is redistributed to the other's available slack.

The `grossDraw` starts at `shortfall` but the solver iterates: the disc draw itself generates CGT which increases tax which widens the gap. Each iteration adds the remaining shortfall to `grossDraw`. The solver converges to within R100 in 2–3 iterations, capped at 8. Convergence is guaranteed because max effective CGT is 18% — the amplification factor is bounded at 1/(1−0.18) ≈ 1.22×.

### Phase 3 — boost LA toward 17.5% ceiling

If both disc pots are exhausted AND a gap remains, the solver boosts each spouse's LA draw beyond the CPI target. The boost is proportional to LA balance:

```
weightA = laBalance_A / (laBalance_A + laBalance_B)
headroomA = laBalance_A × 0.175 − laDrawA_phase1
```

The boost is always measured against the Phase-1 baseline LA draw. Mutating `laDrawA` inside the iteration and computing `newLA = laDrawA + boost` compounds boosts across rounds — this was a real bug and the audit in `tests/python/test_boost.py` guards against it.

If both spouses hit the 17.5% ceiling, the ceiling bites: LA draws are capped, the real shortfall is preserved, clamp flags are set to `'cap'`, and the "Real shortfall vs target" alert fires.

## Other taxable income streams

The user can enter an arbitrary list of "other income" streams — rental income, a DB pension, trust distributions, a maintenance order, whatever is taxable alongside living-annuity income. Each stream has:

- `label` — free text, for print-summary readability only
- `spouse` — `A` or `B`
- `amountPV` — annual rand in today's money
- `startAge` — integer age at which the stream begins (for that spouse)
- `duration` — years the stream is active
- `escalates` — boolean; `true` = grow with CPI, `false` = stay flat in nominal terms
- `pctTaxable` — integer 0–100. Portion of the stream that enters the tax base. Default 100. Use 0 for genuinely tax-free flows (a structured trust distribution, certain maintenance orders); use partial values when only a fraction is taxable. Items missing the field behave as fully taxable (legacy parity).

For year `y` of the projection (zero-indexed, `y = 0` is the first year of retirement), the helper `otherIncomeForYear(schedule, suffix, age, y, cpi)` resolves the schedule to three rand amounts:

```
active        = (age >= startAge) AND (age < startAge + duration)
nominal_year  = escalates ? amountPV × (1 + cpi)^y : amountPV   # if active, else 0
taxable_part  = nominal_year × (pctTaxable / 100)
tax_free_part = nominal_year − taxable_part

total         = Σ nominal_year       over all active streams for that spouse
taxable       = Σ taxable_part       over all active streams for that spouse
taxFree       = Σ tax_free_part      over all active streams for that spouse
```

Key points:

- The active window is **half-open**: `[startAge, startAge + duration)`. A stream with `startAge=65, duration=10` is active at ages 65 through 74 inclusive.
- The escalation exponent is the **year index**, not "years since this stream started". A deferred stream entered as R50 000 today's money with `startAge = current_age + 5` and `escalates = true` starts at `50 000 × (1+cpi)^5` — preserving the real value the adviser typed.
- The resolver is evaluated **before** the solver and tax calculations each year. Three fields land on each spouse: `sA['otherIncome']` (= total cash flow), `sA['otherTaxable']` (enters the tax base), `sA['otherTaxFree']` (cash flow only).
- The tax base for spouse A in year `y` is `taxable = laDraw + sA.otherTaxable + cgt_inclusion`. Gross income / yearDraw / net all use the **total** (`sA.otherIncome`), so a fully tax-free stream still adds to net income, just without a tax bite.
- The tax view splits the breakdown into two rows: "Other income · taxable" and "Other income · tax-free", so the adviser can read the contributions at a glance.
- Multiple streams on the same spouse sum independently per portion. A 100%-taxable rental and a 0%-taxable maintenance order can coexist on the same spouse.
- When the schedule is empty (or no item carries `pctTaxable`), the resolver behaves identically to the pre-`pctTaxable` engine.

## Household goals (recurring expenses)

Goals model recurring household expenses that recur on a fixed cadence — travel every 5 years, a car every 8 years, a holiday every year. They are **household-wide** (no spouse field). Each goal has:

- `label` — free text
- `amountPV` — rand in today's money
- `everyNYears` — cadence (1 = every year)
- `startAge` — integer age at which the cadence begins
- `endAge` — integer age at which the cadence ends (inclusive)

For year `y` of the projection, the helper `goalsForYear(store, age, y, cpi)` (where `age` = youngest spouse's age) returns the sum of every goal that lands in that year:

```
active   = (age >= startAge) AND (age <= endAge) AND ((age − startAge) % everyN == 0)
nominal  = amountPV × (1 + cpi)^y      # if active, else 0
total    = Σ nominal over all goals
```

Key points:

- The cadence anchor is `startAge`. A goal with `startAge: 65, endAge: 90, everyN: 5` lands at the youngest's age 65, 70, 75, 80, 85, 90 — six occurrences. The endAge is **inclusive** (unlike other-income's half-open window), because cadence-anchored events are easier to reason about with closed bounds.
- The escalation exponent is the year index, same convention as other income — the adviser-entered `amountPV` is in today's rands and preserves real value across decades.
- A goal in year `y` **bumps the after-tax target need**: `yearTargetNom = targetPVAnnual × (1+cpi)^y + goalsForYear(...)`. With auto-top-up on, the three-phase solver pulls more from discretionary or boosts the LA draw to cover; the chart's stepped target line visibly steps up that year. With auto-top-up off, the projection makes no attempt to fund the goal — the gap surfaces as a real shortfall.
- Goals are anchored on the **youngest** spouse's age (the same anchor as the projection horizon). This way couple mode and single mode produce the same cadence on the same calendar years.
- Goals do NOT inject capital. They are pure spending events. Capital injections (inheritances, property sales) belong in **Capital events**, which add to `discBalance` and `discBaseCost` and compound forward.
- When the goal store is empty (`goals=None` or `goals=[]`), the projection is byte-identical to a run without goals. Verified by `tests/python/test_goals.py`.

## Capital events

The user can enter one-off capital inflows: property sales, inheritances, maturing policies. Each event has:

- Year from now (1 = end of year 1)
- Amount in today's money
- Destination spouse (A or B)

At the end of the designated year (after draws and growth), the event applies:

```
nominal_amount = amount_PV × (1 + CPI)^(year − 1)
sA.discBalance  += nominal_amount
sA.discBaseCost += nominal_amount
```

Both balance AND base cost increase by the same amount, so no unrealised gain is assumed on arrival. This reflects the reality of, say, a property sale: the proceeds are cash with no tax basis to carry forward. Future growth on the inflow will accumulate gain in the usual way.

Events are sorted by year in the print summary but applied in input order (order doesn't matter because each event affects a single spouse's state independently).

## Real vs nominal

All projections are computed in nominal terms and stored in `p.nominal.*`. A deflate step produces `p.real.*`:

```
real[i] = nominal[i] / (1 + CPI)^i
```

The real expense target is flat at `targetPVAnnual` by definition (since we defined today's money as target × (1+CPI)^0).

## What's *not* modelled

- **Platform fees, advice fees.** The effective return should be adjusted downward by the user if they want to account for these.
- **Dividend withholding tax** (20%) on discretionary dividend income. Assumed implicit in the net nominal return.
- **Interest income exemption** (R23 800 under 65, R34 500 at 65+). Ignored — would modestly reduce tax for clients with significant interest-bearing holdings.
- **Medical tax credits.** Not included.
- **Estate duty** at death. Not modelled.
- **Donations tax.**
- **Foreign income, tax treaties, section 10 exemptions.**
- **Retirement annuity (RA) contributions or withdrawals.** The calculator assumes retirement has already happened and capital is stationary.
- **LA beneficiary nominations on death.** The calculator runs to age 100 and does not model transitions on death.

These omissions are by design. Every one represents a feature we deliberately chose not to build into the tool. When a real client case needs one of them, it's a conversation outside the calculator — not a justification for adding complexity inside it.
