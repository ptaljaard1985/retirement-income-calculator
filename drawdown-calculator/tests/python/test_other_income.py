"""
Other taxable income schedule:
  - Items have spouse, amountPV, startAge, duration, escalates (CPI flag)
  - Active when age in [startAge, startAge + duration)
  - Nominal per year = amountPV × (1+cpi)^year_idx if escalates else amountPV
  - Per-spouse filter: only items matching the queried suffix contribute
  - Multiple active streams on the same spouse sum

When the schedule is wired through project(), the per-spouse `sA['otherIncome']`
is set each year from the resolver. Old tests that pass a scalar via person(other=X)
without a schedule continue to work (legacy path).
"""
from conftest import other_income_for_year, project, person, approx


# ============================================================
# Pure resolver
# ============================================================

class TestResolverEmpty:
    def test_empty_schedule_returns_zero(self):
        for suffix in ('A', 'B'):
            for y in range(0, 35):
                assert other_income_for_year([], suffix, 70, y, 0.05) == 0


class TestResolverFlat:
    """escalates=False → constant nominal while active."""

    def test_flat_active_constant_nominal(self):
        sched = [{
            'label': 'Pension', 'spouse': 'A', 'amountPV': 100_000,
            'startAge': 65, 'duration': 10, 'escalates': False,
        }]
        for y, age in enumerate(range(65, 75)):
            assert other_income_for_year(sched, 'A', age, y, 0.05) == 100_000

    def test_flat_zero_outside_window(self):
        sched = [{
            'label': 'Pension', 'spouse': 'A', 'amountPV': 100_000,
            'startAge': 70, 'duration': 5, 'escalates': False,
        }]
        # Before startAge
        assert other_income_for_year(sched, 'A', 65, 0, 0.05) == 0
        assert other_income_for_year(sched, 'A', 69, 4, 0.05) == 0
        # Active window
        assert other_income_for_year(sched, 'A', 70, 5, 0.05) == 100_000
        assert other_income_for_year(sched, 'A', 74, 9, 0.05) == 100_000
        # After window (age == startAge + duration)
        assert other_income_for_year(sched, 'A', 75, 10, 0.05) == 0


class TestResolverEscalating:
    """escalates=True → amountPV × (1+cpi)^year_idx while active."""

    def test_escalating_grows_at_cpi(self):
        sched = [{
            'label': 'Rental', 'spouse': 'B', 'amountPV': 144_000,
            'startAge': 65, 'duration': 30, 'escalates': True,
        }]
        cpi = 0.05
        for y in range(0, 30):
            age = 65 + y
            expected = 144_000 * (1 + cpi) ** y
            assert approx(other_income_for_year(sched, 'B', age, y, cpi),
                          expected, tol=0.01)

    def test_escalating_uses_year_idx_not_years_since_start(self):
        """Stream that starts later still escalates from today's rands, so year_idx
        at first activation already reflects accumulated CPI — preserving real value."""
        sched = [{
            'label': 'Deferred', 'spouse': 'A', 'amountPV': 50_000,
            'startAge': 70, 'duration': 10, 'escalates': True,
        }]
        # Current age 65, kicks in at age 70 (y=5). At y=5 the nominal should be
        # 50_000 × 1.05^5 — i.e. today's R50 000 preserved in real terms.
        nominal_at_start = other_income_for_year(sched, 'A', 70, 5, 0.05)
        assert approx(nominal_at_start, 50_000 * (1.05 ** 5), tol=0.01)


class TestResolverGates:
    def test_start_age_gate(self):
        sched = [{
            'label': 'x', 'spouse': 'A', 'amountPV': 10_000,
            'startAge': 70, 'duration': 5, 'escalates': False,
        }]
        assert other_income_for_year(sched, 'A', 69, 4, 0.05) == 0
        assert other_income_for_year(sched, 'A', 70, 5, 0.05) == 10_000

    def test_duration_gate(self):
        sched = [{
            'label': 'x', 'spouse': 'A', 'amountPV': 10_000,
            'startAge': 65, 'duration': 5, 'escalates': False,
        }]
        # Active ages: 65, 66, 67, 68, 69 (5 years)
        assert other_income_for_year(sched, 'A', 69, 4, 0.05) == 10_000
        # Age 70 is startAge + duration → inactive
        assert other_income_for_year(sched, 'A', 70, 5, 0.05) == 0


class TestResolverSpouseFilter:
    def test_only_matching_spouse_contributes(self):
        sched = [
            {'label': 'A-stream', 'spouse': 'A', 'amountPV': 50_000,
             'startAge': 65, 'duration': 20, 'escalates': False},
            {'label': 'B-stream', 'spouse': 'B', 'amountPV': 75_000,
             'startAge': 65, 'duration': 20, 'escalates': False},
        ]
        assert other_income_for_year(sched, 'A', 65, 0, 0.05) == 50_000
        assert other_income_for_year(sched, 'B', 65, 0, 0.05) == 75_000


class TestResolverSum:
    def test_multiple_active_streams_sum(self):
        sched = [
            {'label': 'one', 'spouse': 'A', 'amountPV': 30_000,
             'startAge': 65, 'duration': 10, 'escalates': False},
            {'label': 'two', 'spouse': 'A', 'amountPV': 20_000,
             'startAge': 65, 'duration': 10, 'escalates': False},
        ]
        assert other_income_for_year(sched, 'A', 65, 0, 0.05) == 50_000

    def test_mixed_escalating_and_flat_sum(self):
        sched = [
            {'label': 'rental', 'spouse': 'A', 'amountPV': 100_000,
             'startAge': 65, 'duration': 30, 'escalates': True},
            {'label': 'maintenance', 'spouse': 'A', 'amountPV': 50_000,
             'startAge': 65, 'duration': 30, 'escalates': False},
        ]
        cpi = 0.05
        # Year 5 (age 70): 100_000 × 1.05^5 + 50_000
        expected = 100_000 * (1.05 ** 5) + 50_000
        assert approx(other_income_for_year(sched, 'A', 70, 5, cpi), expected, tol=0.01)


# ============================================================
# End-to-end: schedule flows through project()
# ============================================================

class TestProjectionWiring:
    """With a schedule, sA['otherIncome'] per year reflects resolver output, and
    the Y1 net / tax reflect the new income stream."""

    def test_empty_schedule_matches_legacy_zero(self):
        """Passing incomes=[] should match passing no schedule when baseline is zero."""
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        p_legacy = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=False)
        p_sched = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=False, incomes=[])
        for i in range(len(p_legacy['total'])):
            assert approx(p_legacy['total'][i], p_sched['total'][i])
            assert approx(p_legacy['net'][i], p_sched['net'][i])

    def test_schedule_lands_on_correct_spouse_and_year(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        sched = [{'label': 'Rental', 'spouse': 'B', 'amountPV': 120_000,
                  'startAge': 67, 'duration': 10, 'escalates': True}]
        p = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=False, incomes=sched)
        # Spouse A: always zero
        for v in p['otherA']:
            assert v == 0
        # Spouse B before startAge (y=0,1 → age 65,66): zero
        assert p['otherB'][0] == 0
        assert p['otherB'][1] == 0
        # Spouse B at y=2 (age 67): 120_000 × 1.05^2
        assert approx(p['otherB'][2], 120_000 * (1.05 ** 2), tol=0.01)
        # Last active year: age 76 (y=11) — window is [67, 77)
        assert approx(p['otherB'][11], 120_000 * (1.05 ** 11), tol=0.01)
        # Spouse B at y=12 (age 77, past window): zero
        assert p['otherB'][12] == 0

    def test_y1_net_includes_schedule_income(self):
        """A Y1-active stream must show up in year-1 gross/net income."""
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)

        p_base = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                         auto_topup=False, incomes=[])
        sched = [{'label': 'Rental', 'spouse': 'A', 'amountPV': 60_000,
                  'startAge': 65, 'duration': 20, 'escalates': False}]
        p_with = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                         auto_topup=False, incomes=sched)

        # Gross Y1 with schedule ≥ gross Y1 baseline + 60_000 (exact)
        assert approx(p_with['draw'][0] - p_base['draw'][0], 60_000, tol=1)
        # Net income rises too (less than gross rise because of tax on the new R60k)
        delta_net = p_with['net'][0] - p_base['net'][0]
        assert 30_000 < delta_net < 60_000  # some tax bite, but most flows to net

    def test_escalating_vs_flat_divergence_over_time(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        flat = [{'label': 'x', 'spouse': 'A', 'amountPV': 100_000,
                 'startAge': 65, 'duration': 35, 'escalates': False}]
        esc = [{'label': 'x', 'spouse': 'A', 'amountPV': 100_000,
                'startAge': 65, 'duration': 35, 'escalates': True}]
        p_flat = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                         auto_topup=False, incomes=flat)
        p_esc = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                        auto_topup=False, incomes=esc)
        # Year 1: identical nominal
        assert approx(p_flat['otherA'][0], p_esc['otherA'][0])
        # Year 10: escalating ~63% higher (1.05^10 ≈ 1.6289)
        assert approx(p_esc['otherA'][10] / p_flat['otherA'][10], 1.05 ** 10, tol=0.001)

    def test_topup_solver_sees_schedule_income(self):
        """With auto-top-up on, a large Y1 stream reduces discretionary pull because
        net LA + other already covers more of the target."""
        pA = person(la=4_000_000, la_rate=0.04, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, la_rate=0.04, disc=1_000_000, base=500_000, other=0)

        p_no = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                       auto_topup=True, incomes=[])
        # A big schedule stream (R200k on each spouse, flat) should relieve disc draws
        sched = [
            {'label': 'x', 'spouse': 'A', 'amountPV': 200_000,
             'startAge': 65, 'duration': 35, 'escalates': False},
            {'label': 'y', 'spouse': 'B', 'amountPV': 200_000,
             'startAge': 65, 'duration': 35, 'escalates': False},
        ]
        p_with = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                         auto_topup=True, incomes=sched)
        # Disc draw at Y1 should be lower with the schedule (target more easily met)
        disc_y1_no = p_no['discA_draw'][0] + p_no['discB_draw'][0]
        disc_y1_with = p_with['discA_draw'][0] + p_with['discB_draw'][0]
        assert disc_y1_with < disc_y1_no
