"""
Living annuity draw mechanics:
  - CPI-escalating rand targets
  - Clamping to the 2.5%-17.5% band
  - Clamp flags: 'ok', 'floor', 'cap', 'empty'
"""
from conftest import clamp_la, step_person, approx


class TestClampBasics:
    def test_zero_balance(self):
        draw, flag = clamp_la(0, 100_000)
        assert draw == 0 and flag == 'empty'

    def test_negative_balance(self):
        draw, flag = clamp_la(-1000, 100_000)
        assert draw == 0 and flag == 'empty'

    def test_target_inside_band(self):
        # R200 000 target on R4m = 5% — well within band
        draw, flag = clamp_la(4_000_000, 200_000)
        assert draw == 200_000 and flag == 'ok'

    def test_target_below_floor(self):
        # 1% on R4m = R40 000, floor is R100 000 (2.5%)
        draw, flag = clamp_la(4_000_000, 40_000)
        assert approx(draw, 100_000) and flag == 'floor'

    def test_target_above_ceiling(self):
        # 20% on R4m = R800 000, ceiling is R700 000 (17.5%)
        draw, flag = clamp_la(4_000_000, 800_000)
        assert approx(draw, 700_000) and flag == 'cap'

    def test_exact_floor(self):
        # 2.5% on R1m = R25 000
        draw, flag = clamp_la(1_000_000, 25_000)
        assert approx(draw, 25_000) and flag == 'ok'

    def test_exact_ceiling(self):
        # 17.5% on R1m = R175 000
        draw, flag = clamp_la(1_000_000, 175_000)
        assert approx(draw, 175_000) and flag == 'ok'


class TestCPIEscalation:
    """Rand draw escalates at CPI; check that clamps fire correctly over time."""

    def test_year_1_is_rate_times_balance(self):
        # 5% rate on R4m = R200k Y1
        bal = 4_000_000
        rate = 0.05
        y1 = bal * rate
        draw, flag = clamp_la(bal, y1)
        assert approx(draw, 200_000) and flag == 'ok'

    def test_escalated_year_10(self):
        # After 9 years of 5% CPI escalation from R200k: 200000 * 1.05^9 = 310266
        cpi = 0.05
        y1 = 200_000
        y10_target = y1 * (1 + cpi) ** 9
        assert approx(y10_target, 310_265.64, tol=0.1)

    def test_ceiling_fires_when_pot_shrinks(self):
        # R1m LA, 10% rate (Y1 = R100k), growth = 2% (below 5% CPI so pot shrinks),
        # CPI = 5%. Trace until the cap fires.
        bal = 1_000_000
        y1_target = 100_000
        growth = 0.02
        cpi = 0.05
        current_target = y1_target
        year_cap_fires = None
        for y in range(1, 20):
            draw, flag = clamp_la(bal, current_target)
            if flag == 'cap':
                year_cap_fires = y
                assert approx(draw, bal * 0.175)
                break
            bal = (bal - draw) * (1 + growth)
            current_target *= (1 + cpi)
        assert year_cap_fires is not None
        assert year_cap_fires <= 10  # should fire within 10 years at these assumptions


class TestStepPerson:
    """One-year balance evolution for a single spouse."""

    def test_no_draw_all_growth(self):
        p = dict(
            laBalance=1_000_000, discBalance=500_000,
            discBaseCost=250_000, otherIncome=0, discDraw=0,
        )
        # Force a very low LA target so it clamps to floor (2.5%)
        r = step_person(p, 0.09, 0)
        assert approx(r['la_draw'], 25_000)  # 2.5% floor
        assert approx(r['la_after'], (1_000_000 - 25_000) * 1.09)
        assert r['disc_draw'] == 0
        assert approx(r['disc_after'], 500_000 * 1.09)

    def test_disc_draw_gain_calculation(self):
        # 50% base cost ratio, R100k draw → R50k gain (proportional)
        p = dict(
            laBalance=1_000_000, discBalance=1_000_000,
            discBaseCost=500_000, otherIncome=0, discDraw=100_000,
        )
        r = step_person(p, 0.09, 50_000)  # 50k is 5% of LA, no clamp
        assert approx(r['disc_draw'], 100_000)
        # proportion = 100k / 1m = 0.10
        # cost_used = 500k * 0.10 = 50k
        # gain = 100k - 50k = 50k
        assert approx(r['gain_realised'], 50_000)
        assert approx(r['new_base'], 450_000)
        # disc_after = (1m - 100k) * 1.09
        assert approx(r['disc_after'], 900_000 * 1.09)

    def test_disc_draw_fully_at_cost(self):
        # If base cost == balance, any draw is pure cost, no gain
        p = dict(
            laBalance=1_000_000, discBalance=500_000,
            discBaseCost=500_000, otherIncome=0, discDraw=100_000,
        )
        r = step_person(p, 0.09, 50_000)
        assert approx(r['gain_realised'], 0, tol=0.01)


class TestDefaultScenarioTrajectory:
    """Baseline 'Hayes' scenario: R4m LA × 2, 5% rate, 5% CPI, 9% growth, no disc draws."""

    def test_year_1_draw(self):
        bal = 4_000_000
        rate = 0.05
        y1 = bal * rate
        draw, flag = clamp_la(bal, y1)
        assert approx(draw, 200_000)
        assert flag == 'ok'

    def test_year_1_end_balance(self):
        # Y1 draws R200k, balance grows (R4m - R200k) * 1.09
        bal = 4_000_000
        draw = 200_000
        growth = 0.09
        end = (bal - draw) * (1 + growth)
        assert approx(end, 4_142_000)

    def test_year_2_target(self):
        y1 = 200_000
        cpi = 0.05
        y2_target = y1 * (1 + cpi)
        assert approx(y2_target, 210_000)

    def test_year_2_draw_as_pct_of_start_balance(self):
        # Y2 target R210k on Y2-start balance R4.142m = 5.07%
        y2_target = 210_000
        y2_start = 4_142_000
        pct = y2_target / y2_start
        assert approx(pct, 0.0507, tol=0.0001)
