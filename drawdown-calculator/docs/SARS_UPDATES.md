# SARS annual update playbook

The SARS tax tables update every February with the Budget Speech. This document is the checklist for refreshing the calculator each year.

## When to do this

Within two weeks of the annual Budget Speech (typically late February). Earlier if the Minister signals significant rate changes in advance.

## What to update

There are **three** places in `retirement_drawdown.html` that hold SARS data:

### 1. The BRACKETS constant

Search for `var BRACKETS =` in the JS. The array holds 7 brackets. Each row is `[upper_bound, rate, base_tax_at_this_bracket, lower_bound]`. Update the upper bounds, base tax amounts, and (rarely) the rates.

Double-check: the `base_tax` at each row equals `(prev_row_upper − prev_row_lower) × prev_row_rate + prev_row_base`. A spreadsheet calculation sanity-checks the announced figures.

### 2. The REBATE constant

Search for `var REBATE =`. Three rebates:

- `primary`: under-65 rebate (applies to everyone)
- `secondary`: 65+ additional rebate
- `tertiary`: 75+ additional rebate

Each one usually grows by ~2–5% per year.

### 3. The CGT constants

Search for `var CGT =`. Two fields:

- `inclusion: 0.40` — the 40% inclusion rate for individuals. Very rarely changes (last change was to 40% in 2016).
- `exclusion: 50000` — the annual CGT exclusion amount. This grew to R50 000 in 2023 and has been stable since.

## What to consider updating but probably won't

### Bracket creep factor

`var BRACKET_CREEP = 0.03;` reflects the assumed annual growth in brackets and rebates in the *projected* future. It's used to avoid wildly overstated real tax in year 35 of a projection.

Historical average over the last decade: ~3%. Don't update this every year. Revisit if Treasury publicly changes its fiscal drag policy or inflation expectations drift materially.

### Bracket creep start year

The tables as entered are the "year 0" tables. Every projected year `y` applies `(1 + 0.03)^y` to the brackets. This means the year the user is *actually in today* should be treated as year 0 — i.e. when you update the tables, you're resetting year 0 to the new tax year.

No code change is needed for this — it's implicit in the annual refresh.

## The process

1. **Read the Budget speech.** Treasury publishes the new tables on budget.gov.za under "Annexure C". The key figures are under "Personal Income Tax" and "Capital Gains Tax".

2. **Update `BRACKETS`** with the new upper bounds and base tax amounts. Rates almost never change, but check them anyway.

3. **Update `REBATE`** with the new primary/secondary/tertiary amounts.

4. **Update the methodology note** in the print summary. Search for "2026/27 SARS framework" — update the year.

5. **Update the disclaimer**. Search for "as announced in the February 2026 Budget" — update the date.

6. **Run the Python tests**:
   ```bash
   cd tests/python
   pytest -v
   ```
   Several tests will fail because they hardcode expected tax numbers for specific incomes. Update the expected numbers in the tests to match the new tables. This is a *check* — compute the expected tax manually from the new tables and confirm the test's expectation matches.

7. **Spot-check with a real case.** Pick one bracket in the middle (say, R500 000 income for a 68-year-old). Compute the tax by hand. Load the calculator with the relevant LA-only scenario that produces that taxable income. Verify the calculator gives the same tax. If it's off by a rand, something's wrong in the update.

8. **Update the year label in tests**. Each test file has a header comment referencing the tax year. Update it.

9. **Commit with a clear message**: `SARS tables: update to 2027/28 (Budget speech 2027-02-XX)`.

## Verification: key scenarios to try manually

After updating, load the calculator and check these are reasonable:

- **Scenario A**: Spouse A age 68, LA balance R4m, 5% initial rate, no disc, CPI 5%, return 9%. Expected Y1 tax is roughly the tax on R200k at age 65+ under the new tables. Sanity-check against your own hand calculation.

- **Scenario B**: Same as A but add R100k disc withdrawal from a R1m disc pot with R500k base. Expected CGT: (100k − 50k_gain_under_inclusion) × 0.4 = small number, added to taxable income. The effective tax should rise only a few hundred rand.

- **Scenario C**: Load the default Hayes-family scenario (both 65, R4m LA + R1m disc each, R700k target, top-up on). Confirm the Y1 summary card shows net income close to R700k and the chart is qualitatively unchanged from the prior year (slightly different shape due to new tax numbers, but not dramatically different).

If any of these look wrong, stop and check the update. Don't ship a broken tax year.

## Testing checklist

- [ ] All Python tests pass
- [ ] All JS solver tests pass (`node tests/js/run.js`)
- [ ] Y1 tax in default scenario differs from last year in the direction you'd expect from the rate changes
- [ ] Print preview renders cleanly
- [ ] Methodology note mentions the correct tax year
- [ ] Disclaimer mentions the correct budget date

## What about mid-year changes?

SARS occasionally announces mid-year tax changes (very rarely for personal income tax; more often for CGT or VAT). If this happens, update the relevant constant, bump the methodology note, and ship. Don't wait for the February cycle.

## Edge cases

- **New bracket added.** In 2023 a new top bracket was added at 45%. The `BRACKETS` array grew from 6 to 7 entries. Be prepared to add rows if this happens again.
- **Rebate age changed.** If the secondary/tertiary age thresholds shift (e.g. from 65 to 67), update `rebateYear` in addition to the `REBATE` constant. This is historically rare.
- **CGT inclusion rate changed.** Update `CGT.inclusion`. Also update the methodology note's "40% inclusion rate" text.
