"""
Shared test fixtures and Python port of the calculator's core logic.

This module reimplements the SARS tax rules, CGT mechanics, LA clamp logic,
and the three-phase top-up solver in plain Python. Tests in this directory
compare the output of these Python functions against expected values derived
from closed-form formulas or hand calculations — NOT against the JS directly.

The design principle is "second implementation as audit": if both the JS and
the Python port produce the same number, and that number matches a closed-form
result, we have high confidence the calculation is correct. If they disagree,
one of them has a bug.

When SARS tables update, update both the constants here AND the JS in one
commit.
"""
import math

# ============================================================
# SARS 2026/27 constants (keep in sync with retirement_drawdown.html)
# ============================================================

BRACKETS = [
    # (upper_bound, rate, base_tax_at_bracket, lower_bound)
    (245100,      0.18,      0,       0),
    (383100,      0.26,  44118,  245100),
    (530200,      0.31,  79998,  383100),
    (695800,      0.36, 125599,  530200),
    (887000,      0.39, 185215,  695800),
    (1878600,     0.41, 259783,  887000),
    (float('inf'), 0.45, 666339, 1878600),
]

REBATE = {
    'primary':   17820,  # all ages
    'secondary':  9765,  # age 65+
    'tertiary':   3249,  # age 75+
}

CGT = {
    'inclusion': 0.40,
    'exclusion': 50000,
}

BRACKET_CREEP = 0.03  # annual scaling of brackets + rebates + CGT exclusion


# ============================================================
# Year-aware tax helpers
# ============================================================

def income_tax_pre_rebate_year(taxable, year_idx):
    """SARS income tax before rebates, with brackets scaled by bracket creep."""
    if taxable <= 0:
        return 0
    f = (1 + BRACKET_CREEP) ** year_idx
    for upper, rate, base, lower in BRACKETS:
        if taxable <= upper * f:
            return base * f + (taxable - lower * f) * rate
    return 0


def rebate_year(age, year_idx):
    """Age-dependent rebate, scaled by bracket creep."""
    f = (1 + BRACKET_CREEP) ** year_idx
    r = REBATE['primary'] * f
    if age >= 65:
        r += REBATE['secondary'] * f
    if age >= 75:
        r += REBATE['tertiary'] * f
    return r


def income_tax_year(taxable, age, year_idx):
    """Net income tax: pre-rebate tax minus age-dependent rebate, floored at 0."""
    return max(0, income_tax_pre_rebate_year(taxable, year_idx) - rebate_year(age, year_idx))


def cgt_exclusion_year(year_idx):
    """CGT annual exclusion, scaled by bracket creep."""
    return CGT['exclusion'] * ((1 + BRACKET_CREEP) ** year_idx)


# ============================================================
# Other taxable income schedule
# ============================================================

def other_income_for_year(schedule, suffix, age, year_idx, cpi):
    """
    Resolve a schedule of other-income streams to a single nominal rand amount
    for one spouse in year (year_idx + 1).

    Each stream: {label, spouse ('A'|'B'), amountPV, startAge, duration, escalates}.
    Active when age in [startAge, startAge + duration). While active, nominal is
    amountPV × (1+cpi)^year_idx if escalates else amountPV.
    """
    total = 0
    for item in (schedule or []):
        if item['spouse'] != suffix:
            continue
        if age < item['startAge']:
            continue
        if age >= item['startAge'] + item['duration']:
            continue
        if item.get('escalates'):
            total += item['amountPV'] * ((1 + cpi) ** year_idx)
        else:
            total += item['amountPV']
    return total


# ============================================================
# LA draw clamping
# ============================================================

def clamp_la(balance, rand_target):
    """
    Clamp an LA rand target to the legislated 2.5%-17.5% band.

    Returns (draw, flag) where flag is one of 'ok', 'floor', 'cap', 'empty'.
    """
    if balance <= 0:
        return 0, 'empty'
    floor = balance * 0.025
    ceil  = balance * 0.175
    if rand_target < floor:
        return floor, 'floor'
    if rand_target > ceil:
        return ceil, 'cap'
    return rand_target, 'ok'


# ============================================================
# One-year step for a single spouse
# ============================================================

def step_person(p, growth, target_la_draw):
    """
    Apply one year's LA + discretionary draws to a spouse, then grow the
    remaining balance. Pure function — does not mutate p.

    p is a dict with: laBalance, discBalance, discBaseCost, otherIncome, discDraw

    Returns a dict with: la_draw, la_after, la_clamp, disc_draw, disc_after,
                         gain_realised, new_base
    """
    la_draw, la_clamp = clamp_la(p['laBalance'], target_la_draw)
    la_after = (p['laBalance'] - la_draw) * (1 + growth)

    disc_draw = min(p.get('discDraw', 0), p['discBalance'])
    gain_realised = 0
    new_base = p['discBaseCost']
    if p['discBalance'] > 0 and disc_draw > 0:
        proportion = disc_draw / p['discBalance']
        cost_used = p['discBaseCost'] * proportion
        gain_realised = max(0, disc_draw - cost_used)
        new_base = p['discBaseCost'] - cost_used

    disc_after = (p['discBalance'] - disc_draw) * (1 + growth)

    return dict(
        la_draw=la_draw, la_after=la_after, la_clamp=la_clamp,
        disc_draw=disc_draw, disc_after=disc_after,
        gain_realised=gain_realised, new_base=new_base,
    )


# ============================================================
# Three-phase top-up solver (mirrors JS solveTopUp)
# ============================================================

def solve_topup(sA, sB, la_target_A, la_target_B, age_A, age_B, year_idx, target_nom):
    """
    Solve the year's draws to meet an after-tax target. Three phases:
      1. LA at CPI-escalated target (clamped to 2.5%-17.5%)
      2. Fill shortfall from discretionary (proportional to disc balance, CGT-aware)
      3. If disc exhausted, boost LA toward 17.5% (proportional to LA balance)

    Returns a dict with: la_draw_A, la_draw_B, disc_A, disc_B, gain_A, gain_B,
                         tax_A, tax_B, net, clamp_A, clamp_B
    """
    def tax_for(p, age, la_draw, disc_draw):
        gain = 0
        if p['discBalance'] > 0 and disc_draw > 0:
            prop = min(1, disc_draw / p['discBalance'])
            gain = max(0, disc_draw - p['discBaseCost'] * prop)
        inclusion = max(0, (gain - cgt_exclusion_year(year_idx)) * CGT['inclusion'])
        taxable = la_draw + p['otherIncome'] + inclusion
        return income_tax_year(taxable, age, year_idx), gain

    # Phase 1
    la_draw_A, clamp_A = clamp_la(sA['laBalance'], la_target_A)
    la_draw_B, clamp_B = clamp_la(sB['laBalance'], la_target_B)

    tax_A, _ = tax_for(sA, age_A, la_draw_A, 0)
    tax_B, _ = tax_for(sB, age_B, la_draw_B, 0)
    net_la = la_draw_A + la_draw_B + sA['otherIncome'] + sB['otherIncome'] - tax_A - tax_B
    shortfall = target_nom - net_la

    if shortfall <= 0:
        return dict(la_draw_A=la_draw_A, la_draw_B=la_draw_B,
                    disc_A=0, disc_B=0, gain_A=0, gain_B=0,
                    tax_A=tax_A, tax_B=tax_B, net=net_la,
                    clamp_A=clamp_A, clamp_B=clamp_B)

    # Phase 2
    disc_avail = max(0, sA['discBalance']) + max(0, sB['discBalance'])
    draw_A = 0
    draw_B = 0
    gain_A = 0
    gain_B = 0
    grossIncome = la_draw_A + la_draw_B + sA['otherIncome'] + sB['otherIncome']
    total_tax = tax_A + tax_B
    net = net_la

    if disc_avail > 0:
        wA = sA['discBalance'] / disc_avail
        wB = sB['discBalance'] / disc_avail
        gross_draw = shortfall
        for _ in range(8):
            draw_A = min(sA['discBalance'], gross_draw * wA)
            draw_B = min(sB['discBalance'], gross_draw * wB)
            cap_excess = (gross_draw * wA - draw_A) + (gross_draw * wB - draw_B)
            if cap_excess > 0:
                slackA = sA['discBalance'] - draw_A
                slackB = sB['discBalance'] - draw_B
                if slackA > 0:
                    a = min(slackA, cap_excess)
                    draw_A += a
                    cap_excess -= a
                if slackB > 0 and cap_excess > 0:
                    draw_B += min(slackB, cap_excess)
            tax_A, gain_A = tax_for(sA, age_A, la_draw_A, draw_A)
            tax_B, gain_B = tax_for(sB, age_B, la_draw_B, draw_B)
            total_tax = tax_A + tax_B
            grossIncome = la_draw_A + la_draw_B + draw_A + draw_B + sA['otherIncome'] + sB['otherIncome']
            net = grossIncome - total_tax
            new_shortfall = target_nom - net
            if abs(new_shortfall) < 100:
                break
            if draw_A >= sA['discBalance'] - 0.01 and draw_B >= sB['discBalance'] - 0.01:
                break
            gross_draw += new_shortfall
            if gross_draw < 0:
                gross_draw = 0

    # Phase 3: disc exhausted and gap remains -> boost LA
    remaining = target_nom - net
    disc_capped = (sA['discBalance'] > 0 or sB['discBalance'] > 0) and \
                  draw_A >= sA['discBalance'] - 0.01 and \
                  draw_B >= sB['discBalance'] - 0.01
    no_disc = disc_avail <= 0
    if remaining > 100 and (disc_capped or no_disc):
        ceil_A = sA['laBalance'] * 0.175
        ceil_B = sB['laBalance'] * 0.175
        head_A = max(0, ceil_A - la_draw_A)
        head_B = max(0, ceil_B - la_draw_B)
        if head_A + head_B > 0:
            total_la = sA['laBalance'] + sB['laBalance']
            wA2 = sA['laBalance'] / total_la if total_la > 0 else 0
            wB2 = sB['laBalance'] / total_la if total_la > 0 else 0
            # Baseline = Phase-1 draws; boost always relative to baseline (not cumulative)
            base_A = la_draw_A
            base_B = la_draw_B
            gross_boost = remaining
            for _ in range(8):
                boost_A = min(head_A, gross_boost * wA2)
                boost_B = min(head_B, gross_boost * wB2)
                over = (gross_boost * wA2 - boost_A) + (gross_boost * wB2 - boost_B)
                if over > 0:
                    s2 = head_A - boost_A
                    s3 = head_B - boost_B
                    if s2 > 0:
                        a = min(s2, over)
                        boost_A += a
                        over -= a
                    if s3 > 0 and over > 0:
                        boost_B += min(s3, over)
                new_la_A = base_A + boost_A
                new_la_B = base_B + boost_B
                tax_A, _ = tax_for(sA, age_A, new_la_A, draw_A)
                tax_B, _ = tax_for(sB, age_B, new_la_B, draw_B)
                total_tax = tax_A + tax_B
                grossIncome = new_la_A + new_la_B + draw_A + draw_B + sA['otherIncome'] + sB['otherIncome']
                net = grossIncome - total_tax
                new_remaining = target_nom - net
                la_draw_A, la_draw_B = new_la_A, new_la_B
                if boost_A >= head_A - 0.01 and sA['laBalance'] > 0:
                    clamp_A = 'cap'
                if boost_B >= head_B - 0.01 and sB['laBalance'] > 0:
                    clamp_B = 'cap'
                if abs(new_remaining) < 100:
                    break
                if boost_A >= head_A - 0.01 and boost_B >= head_B - 0.01:
                    break
                gross_boost += new_remaining
                if gross_boost < 0:
                    gross_boost = 0

    return dict(la_draw_A=la_draw_A, la_draw_B=la_draw_B,
                disc_A=draw_A, disc_B=draw_B,
                gain_A=gain_A, gain_B=gain_B,
                tax_A=tax_A, tax_B=tax_B, net=net,
                clamp_A=clamp_A, clamp_B=clamp_B)


# ============================================================
# Full projection (mirrors JS project())
# ============================================================

def project(pA, pB, age_A, age_B, r_nom, cpi, target_pv_annual,
            auto_topup=False, events=None, incomes=None, horizon_age=100):
    """
    Run a full year-by-year projection. Returns dict with series arrays.

    pA, pB: dicts with laBalance, laRate, discBalance, discBaseCost,
            otherIncome, discDraw (slider default)
    events: list of dicts {year, amountPV, spouse}
    incomes: optional list of other-income streams
             {label, spouse, amountPV, startAge, duration, escalates}.
             When provided (even as []), overrides sA/sB['otherIncome'] per year.
             When None, the scalar in pA/pB['otherIncome'] is used flat (legacy).
    """
    events = events or []
    use_schedule = incomes is not None
    youngest = min(age_A, age_B)
    years = max(0, horizon_age - youngest)

    rate_A = max(0.025, min(0.175, pA['laRate']))
    rate_B = max(0.025, min(0.175, pB['laRate']))
    la_target_A_Y1 = pA['laBalance'] * rate_A
    la_target_B_Y1 = pB['laBalance'] * rate_B

    sA = dict(pA)
    sB = dict(pB)

    series = dict(
        labels=[], la=[], disc=[], total=[], draw=[], tax=[], net=[], target=[],
        laA_bal=[], laA_draw=[], laB_bal=[], laB_draw=[],
        discA_bal=[], discA_draw=[], discB_bal=[], discB_draw=[],
        otherA=[], otherB=[],
        tax_A=[], tax_B=[], clamp_A=[], clamp_B=[],
        draw_rate_pct=[],
    )

    for y in range(years):
        la_start_A, la_start_B = sA['laBalance'], sB['laBalance']
        disc_start_A, disc_start_B = sA['discBalance'], sB['discBalance']
        cap_start = la_start_A + la_start_B + disc_start_A + disc_start_B

        age_this_A = age_A + y
        age_this_B = age_B + y
        target_A = la_target_A_Y1 * (1 + cpi) ** y
        target_B = la_target_B_Y1 * (1 + cpi) ** y
        year_target_nom = target_pv_annual * (1 + cpi) ** y

        if use_schedule:
            sA['otherIncome'] = other_income_for_year(incomes, 'A', age_this_A, y, cpi)
            sB['otherIncome'] = other_income_for_year(incomes, 'B', age_this_B, y, cpi)

        topup = None
        if auto_topup:
            topup = solve_topup(sA, sB, target_A, target_B,
                                age_this_A, age_this_B, y, year_target_nom)
            final_A = topup['la_draw_A']
            final_B = topup['la_draw_B']
            sA['discDraw'] = topup['disc_A']
            sB['discDraw'] = topup['disc_B']
        else:
            final_A = target_A
            final_B = target_B
            sA['discDraw'] = pA.get('discDraw', 0)
            sB['discDraw'] = pB.get('discDraw', 0)

        rA = step_person(sA, r_nom, final_A)
        rB = step_person(sB, r_nom, final_B)

        # Authoritative clamp flag: solver knows when it pre-clamped to ceil
        # (Phase 1) or boosted to ceil (Phase 3); step_person's strict `>`
        # check misses the equal-to-ceiling case. Fall back to step_person's
        # flag in non-auto-top-up mode, where the CPI-escalated target can
        # genuinely exceed ceil strictly.
        clamp_A_year = topup['clamp_A'] if auto_topup else rA['la_clamp']
        clamp_B_year = topup['clamp_B'] if auto_topup else rB['la_clamp']

        # Tax
        excl_y = cgt_exclusion_year(y)
        incl_A = max(0, (rA['gain_realised'] - excl_y) * CGT['inclusion'])
        incl_B = max(0, (rB['gain_realised'] - excl_y) * CGT['inclusion'])
        taxable_A = rA['la_draw'] + sA['otherIncome'] + incl_A
        taxable_B = rB['la_draw'] + sB['otherIncome'] + incl_B
        tax_Y_A = income_tax_year(taxable_A, age_this_A, y)
        tax_Y_B = income_tax_year(taxable_B, age_this_B, y)

        sA['laBalance'] = rA['la_after']
        sA['discBalance'] = rA['disc_after']
        sA['discBaseCost'] = rA['new_base']
        sB['laBalance'] = rB['la_after']
        sB['discBalance'] = rB['disc_after']
        sB['discBaseCost'] = rB['new_base']

        year_draw = rA['la_draw'] + rA['disc_draw'] + rB['la_draw'] + rB['disc_draw'] + sA['otherIncome'] + sB['otherIncome']
        year_tax = tax_Y_A + tax_Y_B
        year_net = year_draw - year_tax

        series['labels'].append(f"Age {youngest + y}")
        series['la'].append(la_start_A + la_start_B)
        series['disc'].append(disc_start_A + disc_start_B)
        series['total'].append(cap_start)
        series['draw'].append(year_draw)
        series['tax'].append(year_tax)
        series['net'].append(year_net)
        series['target'].append(year_target_nom)
        series['laA_bal'].append(la_start_A)
        series['laA_draw'].append(rA['la_draw'])
        series['laB_bal'].append(la_start_B)
        series['laB_draw'].append(rB['la_draw'])
        series['discA_bal'].append(disc_start_A)
        series['discA_draw'].append(rA['disc_draw'])
        series['discB_bal'].append(disc_start_B)
        series['discB_draw'].append(rB['disc_draw'])
        series['otherA'].append(sA['otherIncome'])
        series['otherB'].append(sB['otherIncome'])
        series['tax_A'].append(tax_Y_A)
        series['tax_B'].append(tax_Y_B)
        series['clamp_A'].append(clamp_A_year)
        series['clamp_B'].append(clamp_B_year)
        series['draw_rate_pct'].append((year_draw / cap_start * 100) if cap_start > 0 else 0)

        # Apply capital events at year-end
        for ev in events:
            if ev['year'] == y + 1:
                nominal_amt = ev['amountPV'] * (1 + cpi) ** y
                if ev['spouse'] == 'A':
                    sA['discBalance'] += nominal_amt
                    sA['discBaseCost'] += nominal_amt
                elif ev['spouse'] == 'B':
                    sB['discBalance'] += nominal_amt
                    sB['discBaseCost'] += nominal_amt

    return series


# ============================================================
# Helpers for tests
# ============================================================

def approx(a, b, tol=1.0):
    """Float-safe equality within tolerance."""
    return abs(a - b) <= tol


def person(la=4_000_000, la_rate=0.05, disc=1_000_000, base=500_000,
           other=0, disc_draw=0):
    """Shorthand spouse constructor for tests."""
    return dict(
        laBalance=la, laRate=la_rate,
        discBalance=disc, discBaseCost=base,
        otherIncome=other, discDraw=disc_draw,
    )
