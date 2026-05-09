# Tax-free pots — TFSA + Endowment integration plan

**Status:** Research / proposal. Not scheduled. Revisit when a real client case needs it.

**Audience:** Future-Pierre or future-Claude considering whether and how to add Tax-Free Savings Accounts and Endowment Funds to the calculator's pot model.

## Why this plan exists

The calculator currently models two pots per spouse: **Living Annuity** (regulated 2.5–17.5% band, withdrawals taxable as income) and **Discretionary** (proportional CGT on partial disposals). Real-world advisory cases regularly involve two more SA-specific product types:

- **Tax-Free Savings Account (TFSA / TFIA)**: insurance-cap-limited tax-free wrapper. Annual cap R 36 000, lifetime cap R 500 000. All growth (interest, dividends, gains) is exempt; all withdrawals are tax-free. Withdrawal does not restore the contribution allowance.
- **Endowment Fund**: insurance-policy investment wrapper. Subject to a 5-year withdrawal restriction (one partial loan ≤ contributions during the first 5 years). Growth is taxed *inside* the fund at the policy rate (~30% on interest, ~12% effective on capital gains). Payouts to the policyholder are tax-free at household level.

For retirement projection at the household cash-flow level, both behave identically: **growth and withdrawals create no tax event for the client**. The only difference is internal — TFSA has true 0% internal tax, endowment has a non-zero internal tax that must either be modelled explicitly (engine deducts it from growth) or absorbed into a net-of-internal-tax return assumption supplied by the adviser.

## Why a plan and not an implementation

This is not a one-afternoon change. Every consumer of `pA.discBalance` would need new sibling fields; the income chart's stacked-bar layout and the report's appendix gain new columns; the solver gains a new phase; tests need new closed-form anchors and new property invariants. Estimated 4-6 hours for the simplest path, 15-25 for the cleanest. The current model serves the "LA + Disc" client pattern (the 80% case) well; this plan documents the design for the day a specific client case demonstrates the cost is justified.

## Recommended approach — Option A: combined "Tax-free pot" per spouse

After evaluating three integration paths (see "Alternatives" below), the recommendation is:

**Add one combined "Tax-free pot" per spouse.** A single balance, no base cost, zero withdrawal-tax flag. The adviser enters the COMBINED TFSA + Endowment balance and a return assumption that's already net of any endowment internal tax. The solver pulls from this pot before discretionary in the auto-top-up path, because tax-free draws extend sustainability further than CGT-bearing draws.

The advisor loses the ability to differentiate TFSA from Endowment in the model. That distinction matters for tax-strategy *recommendations* the adviser makes outside the calculator (when to fund which wrapper, beneficiary nominations on the endowment, contribution headroom on the TFSA), but it does NOT change the projected sustainability — both pots produce indistinguishable cash flow effects at the household level. Modelling them separately would double the input surface and the chart complexity for no projection-side gain.

If after using this in real meetings the differentiation matters, Option B (split into two pots) is a graceful upgrade that doesn't change the engine's fundamental shape.

## Engine changes (Option A)

### State shape

Each spouse gains one new field:
- `tfBalance` (rand) — combined TFSA + endowment value at start of year.

No `tfBaseCost` (tax-free withdrawals don't trigger CGT). No `tfRate` (uses household `r_nom`; if Pierre wants per-pot return assumptions, that's a separate refactor).

### Year loop

Add immediately after the existing disc draw step in `step_person`:

```
tf_draw = min(p.tfDraw, p.tfBalance)        # capped at balance
tf_after = (p.tfBalance - tf_draw) * (1 + r_nom)
```

No tax math. No base cost adjustment.

In `project()`, append:
```
sA['tfBalance'] = rA.tf_after
```
And add `tfA_bal` / `tfA_draw` / `tfB_bal` / `tfB_draw` series to the result.

### Solver phase order

Current: Phase 1 LA at target → Phase 2 disc top-up (with CGT) → Phase 3 LA boost.

New: Phase 1 LA at target → **Phase 2a tax-free top-up** (no tax bite) → Phase 2b disc top-up (CGT bite) → Phase 3 LA boost.

In `solve_topup`, after Phase 1 computes the shortfall, before pulling from disc, attempt to fill from `tfBalance` first. Distribute proportionally to each spouse's tax-free balance, capped at each balance. Recompute the shortfall after. Only then enter the disc loop.

The solver's iteration logic stays identical — disc still iterates because each disc draw changes the tax bill. Tax-free draws don't change tax, so Phase 2a converges in one step.

### Tax base

Withdrawals from the tax-free pot do NOT add to either spouse's `taxable` field. They flow to net income directly, identically to a `pctTaxable: 0` other-income stream.

### Capital event handling

Capital events currently land in `discBalance` + `discBaseCost`. Decision needed: should the calculator support events landing in the tax-free pot? Probably yes for inheritance-into-endowment scenarios, but the UI cost (new "destination pot" selector on every event row) may not be worth it for the few cases. Default: events keep landing in disc. Adviser can simulate a tax-free inheritance by manually bumping `tfBalance` in inputs.

## UI changes (Option A)

### State 1 — Spouse setup

One new field per spouse, between Discretionary and "Disc base cost":
```
LA balance         R [        ]
Discretionary      R [        ]
Disc base cost     R [        ]   CGT
Tax-free pot       R [        ]   TFSA + endowment combined
```

The `Tax-free pot` field gets a small hint label noting the combined-pot convention and the net-of-internal-tax return convention.

### Planning rail

The rail's existing "Drawdown levers" section currently has per-spouse LA-rate + disc-draw sliders. Add per-spouse `Tax-free draw` slider when tfBalance > 0. Hide via CSS when both spouses have zero tax-free balances (avoid clutter for clients who don't have these products).

### Income chart

Stack order today (bottom → top): LA → Other → Disc → Tax (Session 29 reorder).

Proposed order with tax-free: LA → Other → **Tax-free** → Disc → Tax. Slot the new layer between Other and Disc. Colour proposal: a soft sage `#7ba892` (distinct from teal LA, navy-soft Other, and gold Disc) — needs DESIGN.md sign-off before painting.

Apportionment formula in `incomeBarSeries()` extends naturally — gross share excludes Tax-free (it's already net), tax is apportioned only across LA + Other + Disc.

### Capital chart

Currently shows LA + Disc stacked with a withdrawal-rate line. Add a tax-free layer between LA and Disc.

## Report changes (Option A)

### Snapshot schema

Bump to `schemaVersion: 3`. Each row in `projection.rows[]` gains:
- `tfA_bal`, `tfA_draw`
- `tfB_bal`, `tfB_draw`
- `netTF` (in the per-source net apportionment block — always equal to `tfA_draw + tfB_draw` since no tax)

`plan.spouses[i]` gains `taxFreeBalance`.

The existing v2 binder's per-spouse and household renderers need extending — household card adds a "Tax-free" row, year-table adds a "TF" column per spouse, capital chart adds a layer.

### Appendix

Appendix A (Income chart data) gains a TF column. Appendix B (Capital data) gains a TF column. Appendix E (Plan inputs) gains a `tax-free balance` row per spouse.

### Methodology slide

One paragraph: "The tax-free pot combines TFSA and endowment values. Growth is at the assumed return; withdrawals are tax-free at household level. For endowment portions the return assumption should be entered net of the policy's internal tax (~12% effective on capital gains, 30% on interest)."

## Test changes (Option A)

### Closed-form units (Tier 1)

New file `tests/python/test_tax_free.py`:
- TFSA growth: balance grows at `r_nom` regardless of return composition (interest vs gains).
- TFSA withdrawal: doesn't add to tax base; net-to-bank == draw.
- TFSA balance bounded ≥ 0.
- Endowment-as-tax-free: identical to TFSA at household level when adviser supplies net return.

### Property invariants (Tier 3)

Extend `test_invariants.py` scenarios to include cases with tax-free pots (couple_with_tfsa, single_with_endowment, mixed). New invariants:
- Tax-free balance evolves correctly: `tfBal[y+1] = (tfBal[y] − tfDraw[y]) × (1 + r_nom)`.
- Tax-free withdrawal contributes to gross AND to net (no tax bite); confirm `netTF == tfDraw`.
- Solver Phase 2a converges in single iteration when shortfall ≤ tfBalance.

### Parity (Tier 2)

`parity_runner.js` needs the new DOM IDs (`hp-tf-A`, `hp-tf-B`) added to `SAFE_DEFAULTS` and to the per-scenario state setter. The harness's `toPyShape` mapping extends to expose the new series.

Total new test surface: ~30 closed-form + ~15 invariants × 5 scenarios = ~75 cases.

### CI

No workflow changes — `tests.yml` runs `pytest -q` and `node run.js`, both of which automatically pick up new tests.

## Alternatives evaluated

### Option B: Two distinct pots (TFSA + Endowment)

Same engine architecture as Option A but two separate balances per spouse, with an optional internal-tax-rate input for endowment. Engine applies internal tax to endowment growth each year. Solver respects priority (TFSA first because it's more flexible and has hard contribution caps; endowment second because internal tax has already been paid).

**Cost:** ~8-12 hours. Real overhead in the report (chart legend, year-table columns, snapshot schema).

**When it becomes worthwhile:** if the adviser's typical conversation distinguishes "draw from TFSA first to preserve endowment for legacy" vs "treat them as one tax-free bucket." Today that conversation happens outside the calculator.

### Option C: Generalized N-pot architecture

Refactor pots into a list of `{type, balance, baseCost?, internalTaxRate, withdrawalTaxTreatment, drawPriority}`. Future products (RAs that aren't yet annuitised, offshore wrappers, sec-12J, hedge fund partnership interests) plug in by adding a config row.

**Cost:** ~15-25 hours. Touches the engine root, the snapshot schema, every consumer (calculator UI, report binder, all tests).

**When it becomes worthwhile:** when a third or fourth product type comes up. Today the calculator handles 2; one more (Option A) keeps the same hand-coded shape; two more would tip the balance toward generalisation. Holding off until then avoids over-engineering.

## Migration path

Option A does NOT preclude future upgrade to B or C. The engine's pot-handling code is small (a few dozen lines per pot in `step_person`, `solve_topup`, and the `project` year loop). When upgrade time comes:

- **A → B**: split `tfBalance` into `tfsaBalance` + `endowmentBalance`. Add per-pot return rate. Engine math is mostly the same; the solver's Phase 2a becomes Phase 2a (TFSA) + Phase 2b (Endowment). Snapshot schema bumps to v4.
- **A → C** (or B → C): refactor `pA.{laBalance, discBalance, tfBalance}` into `pA.pots = [{...}, {...}, {...}]`. Extract phase logic into per-pot handlers. Big diff but mechanical.

The intermediate-state risk is low because each step is a refactor with clear before/after behavior.

## Open questions to resolve before implementation

1. **Endowment return convention.** Does the adviser enter gross-of-internal-tax (engine deducts) or net (engine takes at face value)? Net is simpler; gross is more "accurate" but requires a separate rate input. **Default recommendation: net.** Document the convention prominently.

2. **Capital event destination.** Should events be allowed to land in the tax-free pot? Adds a "destination" selector to every event row. **Default recommendation: no** (events stay disc-only). Adviser bumps initial tax-free balance manually for inheritance-into-endowment cases. Revisit if the use case is common.

3. **Solver tax-free priority.** Pulling tax-free before disc is the tax-optimal default. But some advisers prefer to preserve tax-free pots for legacy or for late-life flexibility. **Default recommendation: tax-free first** (matches optimal sustainability). Add an "advanced" preference toggle later if needed.

4. **TFSA contribution-cap warning.** If the adviser enters a tax-free balance that implies the client has been over-contributing (cumulative > R 500k), flag it? Not strictly the calculator's job, but a non-blocking warning would be a small kindness. **Default recommendation: skip for now** (out of scope for projection).

5. **Chart colour.** Sage `#7ba892` proposed but unverified against the design palette. Need a DESIGN.md review pass.

6. **Single-client mode.** When `body[data-client-mode="single"]` is set, Spouse B's tax-free balance should be zeroed alongside the rest (matches existing single-mode collapse). Trivial to extend.

## Estimated effort breakdown

| Area | Hours |
|---|---|
| Engine changes (Python port + JS) | 1.5 |
| UI changes (State 1, Planning rail, Income + Capital charts) | 1.5 |
| Report changes (snapshot schema bump, year-table, appendix, methodology) | 1.0 |
| Test additions (Tier 1 + Tier 3 + parity DOM stubs) | 1.5 |
| Documentation (CLAUDE.md session entry, ARCHITECTURE.md update, CALCULATIONS.md tax-free section) | 0.5 |
| **Total Option A** | **~6 hours** |

Add ~4 hours if upgrading to Option B during the same change. Add ~15 hours for Option C.

## Decision deferred

This document captures the design at the point Pierre first asked about it. Implementation is not scheduled. Revisit when:
- A real client case demonstrates that the tax-free distinction would change a recommendation
- An adviser-facing competitor calculator differentiates these pots and Pierre wants parity
- The platform roadmap (`PLATFORM_ROADMAP.md`) calls for a broader product-type expansion

Until then, advisers can model TFSA + endowment values approximately by entering their balance as additional discretionary with `pctTaxable: 0` on a corresponding zero-amount other-income stream — clunky but functional.
