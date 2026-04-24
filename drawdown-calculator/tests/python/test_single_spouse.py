"""
Single-client mode: Spouse B is a synthetic zero person.

The JS `project()` zeroes out Spouse B (laBalance=0, discBalance=0,
discBaseCost=0, discDraw=0, otherIncome=0) and sets ageB=ageA before running
the projection. These tests exercise the same shape through the Python port
to confirm:

  1. No NaN leaks through the year loop (Phase 1 / Phase 2 / Phase 3 all
     stay finite when one spouse is zero).
  2. The horizon anchors on the real client's age, not the placeholder
     default.
  3. Spouse B's tax series is flat zero.
  4. Phase 3 LA boost fires correctly when Spouse A alone hits the cap.

Also: a pathological test where BOTH spouses are depleted mid-projection,
confirming the defensive `totalLA > 0` guard in Phase 3 prevents NaN even
if the outer `totalHead > 0` guard is ever loosened.
"""
import math

from conftest import project, solve_topup, person


def _zero_spouse():
    """Synthetic zero person — mirrors what JS project() builds in single mode."""
    return person(la=0, la_rate=0, disc=0, base=0)


class TestSingleSpouseHorizon:
    """Horizon anchors on the real client's age, not a default."""

    def test_horizon_years_match_client_age(self):
        sA = person(la=6_000_000, la_rate=0.05, disc=2_000_000, base=1_000_000)
        sB = _zero_spouse()
        s = project(sA, sB, age_A=68, age_B=68,
                    r_nom=0.08, cpi=0.05,
                    target_pv_annual=500_000,
                    auto_topup=True)
        # 100 - 68 = 32 years
        assert len(s['labels']) == 32
        assert len(s['la']) == 32

    def test_older_single_client_shorter_horizon(self):
        sA = person(la=4_000_000, la_rate=0.05, disc=1_000_000, base=500_000)
        sB = _zero_spouse()
        s = project(sA, sB, age_A=80, age_B=80,
                    r_nom=0.08, cpi=0.05,
                    target_pv_annual=400_000,
                    auto_topup=True)
        assert len(s['labels']) == 20


class TestSingleSpouseNoNaN:
    """Every output series stays finite when Spouse B is zero."""

    def test_phase1_only_no_nan(self):
        # Modest target — LA alone covers; Phase 2/3 never run.
        sA = person(la=6_000_000, la_rate=0.05, disc=0, base=0)
        sB = _zero_spouse()
        s = project(sA, sB, age_A=68, age_B=68,
                    r_nom=0.07, cpi=0.05,
                    target_pv_annual=250_000,
                    auto_topup=True)
        for key in ('la', 'disc', 'total', 'net', 'tax', 'draw'):
            for v in s[key]:
                assert not math.isnan(v), f"NaN in series[{key!r}]"

    def test_phase3_boost_with_single_client(self):
        # Force Phase 3: no disc, ambitious target → LA must boost.
        sA = person(la=4_000_000, la_rate=0.05, disc=0, base=0)
        sB = _zero_spouse()
        s = project(sA, sB, age_A=65, age_B=65,
                    r_nom=0.07, cpi=0.05,
                    target_pv_annual=550_000,
                    auto_topup=True)
        for v in s['net']:
            assert not math.isnan(v), "NaN in net after Phase 3 boost"
        # Somewhere in the horizon A should hit the cap.
        assert 'cap' in s['clamp_A'], "Phase 3 never boosted A to the cap"

    def test_spouse_b_tax_series_is_flat_zero(self):
        sA = person(la=5_000_000, la_rate=0.05, disc=1_000_000, base=500_000)
        sB = _zero_spouse()
        s = project(sA, sB, age_A=70, age_B=70,
                    r_nom=0.08, cpi=0.05,
                    target_pv_annual=400_000,
                    auto_topup=True)
        assert all(t == 0 for t in s['tax_B']), "Spouse B tax should be zero across the horizon"
        assert all(flag == 'empty' for flag in s['clamp_B']), "Spouse B clamp flag should be 'empty' always"


class TestBothDepletedGuard:
    """Defensive NaN guard for the pathological 'both LA balances zero' case."""

    def test_phase3_guards_against_zero_denominator(self):
        # Call solve_topup directly with both spouses at zero LA. Pre-fix the
        # outer `totalHead > 0` guard short-circuits Phase 3, but the inner
        # division wA2/wB2 would still divide 0/0 if that guard ever changed.
        # With the defensive guard, wA2/wB2 fall to 0 and no NaN can escape.
        sA = _zero_spouse()
        sB = _zero_spouse()
        r = solve_topup(sA, sB, la_target_A=0, la_target_B=0,
                        age_A=80, age_B=80, year_idx=15, target_nom=500_000)
        assert not math.isnan(r['net'])
        assert not math.isnan(r['la_draw_A'])
        assert not math.isnan(r['la_draw_B'])
        assert r['la_draw_A'] == 0
        assert r['la_draw_B'] == 0

    def test_full_projection_depleting_both_spouses_stays_finite(self):
        # Aggressive target, small capital, no disc → both depleted eventually.
        sA = person(la=1_000_000, la_rate=0.10, disc=0, base=0)
        sB = person(la=1_000_000, la_rate=0.10, disc=0, base=0)
        s = project(sA, sB, age_A=75, age_B=75,
                    r_nom=0.04, cpi=0.06,
                    target_pv_annual=600_000,
                    auto_topup=True)
        for key in ('la', 'disc', 'total', 'net', 'tax', 'draw'):
            for v in s[key]:
                assert not math.isnan(v), f"NaN in series[{key!r}] after depletion"
