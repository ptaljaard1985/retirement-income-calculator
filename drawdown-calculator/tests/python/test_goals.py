"""
Recurring household goals (e.g. travel every 5 years for R200k in today's money).

Each goal: { label, amountPV, everyNYears, startAge, endAge }.
- Household-wide (no spouse field).
- Active when youngest age ∈ [startAge, endAge] AND (age - startAge) % everyN == 0.
- Nominal that year = amountPV × (1 + cpi)^year_idx (today's money escalates with CPI).
- Effect on engine: adds to that year's after-tax target. With auto-top-up on,
  the solver pulls more from disc / boosts LA to cover. Target line in the
  Income chart steps up that year.

Goals are list-of-dict, separate from incomes/events. Backward compat: passing
None or [] produces identical projections to a run without goals.
"""
from conftest import project, person, approx, goals_for_year


# ============================================================
# Resolver
# ============================================================

class TestGoalsResolver:
    def test_empty_returns_zero(self):
        assert goals_for_year([], 65, 0, 0.05) == 0
        assert goals_for_year(None, 65, 0, 0.05) == 0

    def test_lands_in_first_qualifying_year(self):
        goals = [{'label': 'travel', 'amountPV': 200_000,
                  'everyNYears': 5, 'startAge': 65, 'endAge': 90}]
        # y=0 (age 65) is the first qualifying year — lands exactly amountPV.
        assert approx(goals_for_year(goals, 65, 0, 0.05), 200_000)

    def test_does_not_land_in_non_qualifying_year(self):
        goals = [{'label': 'travel', 'amountPV': 200_000,
                  'everyNYears': 5, 'startAge': 65, 'endAge': 90}]
        # y=1 (age 66) is mid-cycle — no land.
        assert goals_for_year(goals, 66, 1, 0.05) == 0
        assert goals_for_year(goals, 67, 2, 0.05) == 0
        assert goals_for_year(goals, 68, 3, 0.05) == 0
        assert goals_for_year(goals, 69, 4, 0.05) == 0

    def test_lands_again_at_cadence(self):
        goals = [{'label': 'travel', 'amountPV': 200_000,
                  'everyNYears': 5, 'startAge': 65, 'endAge': 90}]
        # y=5 (age 70) — second occurrence, escalated by CPI^5.
        assert approx(goals_for_year(goals, 70, 5, 0.05),
                      200_000 * (1.05 ** 5), tol=0.5)
        # y=10 (age 75) — third occurrence.
        assert approx(goals_for_year(goals, 75, 10, 0.05),
                      200_000 * (1.05 ** 10), tol=0.5)

    def test_silent_before_start_age(self):
        goals = [{'label': 'travel', 'amountPV': 200_000,
                  'everyNYears': 5, 'startAge': 70, 'endAge': 90}]
        # Ages before 70: zero (even at y=0 if user is younger than startAge).
        assert goals_for_year(goals, 65, 0, 0.05) == 0
        assert goals_for_year(goals, 69, 4, 0.05) == 0
        # First qualifying year is age 70 (y=5).
        assert approx(goals_for_year(goals, 70, 5, 0.05),
                      200_000 * (1.05 ** 5), tol=0.5)

    def test_silent_after_end_age(self):
        goals = [{'label': 'travel', 'amountPV': 200_000,
                  'everyNYears': 5, 'startAge': 65, 'endAge': 80}]
        # Age 80 is endAge (inclusive) — qualifies if cadence aligns.
        # 80 - 65 = 15, 15 % 5 == 0, so yes.
        assert approx(goals_for_year(goals, 80, 15, 0.05),
                      200_000 * (1.05 ** 15), tol=0.5)
        # Age 85 — past endAge, no land.
        assert goals_for_year(goals, 85, 20, 0.05) == 0

    def test_multiple_goals_sum_in_overlap_year(self):
        goals = [
            {'label': 'travel', 'amountPV': 200_000,
             'everyNYears': 5, 'startAge': 65, 'endAge': 90},
            {'label': 'car', 'amountPV': 600_000,
             'everyNYears': 10, 'startAge': 65, 'endAge': 90},
        ]
        # y=0: both land (both at startAge 65).
        assert approx(goals_for_year(goals, 65, 0, 0.05), 800_000)
        # y=5: only travel (car cadence is 10, next at age 75).
        assert approx(goals_for_year(goals, 70, 5, 0.05),
                      200_000 * (1.05 ** 5), tol=0.5)
        # y=10: both land.
        assert approx(goals_for_year(goals, 75, 10, 0.05),
                      (200_000 + 600_000) * (1.05 ** 10), tol=1.0)


# ============================================================
# End-to-end: target line bumps in goal years
# ============================================================

class TestProjectionGoals:
    def test_empty_goals_matches_legacy(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        baseline = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=False)
        with_empty = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                             auto_topup=False, goals=[])
        for k in ('target', 'draw', 'tax', 'net'):
            for i in range(len(baseline[k])):
                assert approx(baseline[k][i], with_empty[k][i], tol=1)

    def test_target_steps_up_in_goal_years(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        goals = [{'label': 'travel', 'amountPV': 200_000,
                  'everyNYears': 5, 'startAge': 65, 'endAge': 90}]
        baseline = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=False)
        p = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                    auto_topup=False, goals=goals)
        # y=0: target rises by 200_000 (Y1 nominal == amountPV).
        assert approx(p['target'][0] - baseline['target'][0], 200_000, tol=1)
        # y=1..4: target unchanged.
        for y in range(1, 5):
            assert approx(p['target'][y], baseline['target'][y], tol=1)
        # y=5: target rises by 200_000 × 1.05^5.
        assert approx(p['target'][5] - baseline['target'][5],
                      200_000 * (1.05 ** 5), tol=0.5)

    def test_topup_solver_pulls_more_in_goal_years(self):
        """With auto-top-up on, a goal year forces extra disc draw / LA boost."""
        pA = person(la=4_000_000, la_rate=0.05, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, la_rate=0.05, disc=1_000_000, base=500_000, other=0)
        goals = [{'label': 'travel', 'amountPV': 300_000,
                  'everyNYears': 5, 'startAge': 65, 'endAge': 90}]
        baseline = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=True)
        p = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                    auto_topup=True, goals=goals)
        # Y1 (goal year): combined disc draw should rise — target is higher.
        disc_baseline_y1 = baseline['discA_draw'][0] + baseline['discB_draw'][0]
        disc_with_y1 = p['discA_draw'][0] + p['discB_draw'][0]
        assert disc_with_y1 > disc_baseline_y1
        # Y2 (no goal): disc draw should match baseline (target same).
        disc_baseline_y1_off = baseline['discA_draw'][1] + baseline['discB_draw'][1]
        disc_with_y1_off = p['discA_draw'][1] + p['discB_draw'][1]
        assert approx(disc_with_y1_off, disc_baseline_y1_off, tol=1)

    def test_goal_bounded_by_end_age(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        goals = [{'label': 'travel', 'amountPV': 200_000,
                  'everyNYears': 5, 'startAge': 65, 'endAge': 80}]
        baseline = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=False)
        p = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                    auto_topup=False, goals=goals)
        # y=15 (age 80): qualifies (last occurrence).
        assert approx(p['target'][15] - baseline['target'][15],
                      200_000 * (1.05 ** 15), tol=1)
        # y=20 (age 85): past endAge, no bump.
        assert approx(p['target'][20], baseline['target'][20], tol=1)
