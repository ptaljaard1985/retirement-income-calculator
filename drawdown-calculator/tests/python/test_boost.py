"""
Phase 3 of solve_topup: boost LA draws toward 17.5% ceiling when
discretionary is exhausted.

Regression guard: the boost must always be measured against the Phase-1 LA
baseline, not cumulatively. An earlier JS version compounded boosts across
iterations and overshot target by ~R320k — test_boost_single_iteration_does_not_compound
guards against that.
"""
from conftest import solve_topup, person, approx


class TestBoostNotTriggered:
    """Boost should only fire when disc is exhausted AND gap remains."""

    def test_no_boost_when_disc_available(self):
        # Disc can cover the gap → LA draws should stay at Phase-1 target
        sA = person(la=4_000_000, disc=1_000_000, base=500_000)
        sB = person(la=4_000_000, disc=1_000_000, base=500_000)
        r = solve_topup(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000)
        assert r['la_draw_A'] == 200_000  # unchanged from target
        assert r['la_draw_B'] == 200_000
        assert r['clamp_A'] == 'ok'
        assert r['clamp_B'] == 'ok'

    def test_no_boost_when_la_covers(self):
        sA = person(la=8_000_000, disc=0, base=0)
        sB = person(la=8_000_000, disc=0, base=0)
        # LA 500k each = 1m gross, tax ~200k total, net ~800k > target 700k
        r = solve_topup(sA, sB, 500_000, 500_000, 65, 65, 0, 700_000)
        assert r['la_draw_A'] == 500_000
        assert r['la_draw_B'] == 500_000


class TestBoostTriggered:
    """Boost activates when disc is exhausted/absent."""

    def test_no_disc_boost_to_meet_target(self):
        # No disc, LA 200k each, target 700k → boost LA to ~411k each
        sA = person(la=4_000_000, disc=0, base=0)
        sB = person(la=4_000_000, disc=0, base=0)
        r = solve_topup(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000)
        assert r['la_draw_A'] > 200_000
        assert r['la_draw_B'] > 200_000
        # Must be below the 17.5% ceiling (R700k on R4m)
        assert r['la_draw_A'] <= 700_000 + 1
        assert r['la_draw_B'] <= 700_000 + 1
        # Symmetric pots → symmetric draws
        assert approx(r['la_draw_A'], r['la_draw_B'])
        assert approx(r['net'], 700_000, tol=200)

    def test_unequal_la_proportional_boost(self):
        # 75/25 split in LA balance → boost should be ~75/25
        sA = person(la=6_000_000, disc=0, base=0)  # 75%
        sB = person(la=2_000_000, disc=0, base=0)  # 25%
        r = solve_topup(sA, sB, 300_000, 100_000, 65, 65, 0, 700_000)
        boost_A = r['la_draw_A'] - 300_000
        boost_B = r['la_draw_B'] - 100_000
        total_boost = boost_A + boost_B
        if total_boost > 1:
            # Weights 75/25 applied to boost (both under ceiling)
            assert 0.70 < boost_A / total_boost < 0.80

    def test_both_ceilings_hit_real_shortfall(self):
        # Tiny pots can't cover target even at 17.5%
        # Ceilings: R1m × 0.175 × 2 = R350k gross LA max. Net < R350k << 700k.
        sA = person(la=1_000_000, disc=0, base=0)
        sB = person(la=1_000_000, disc=0, base=0)
        r = solve_topup(sA, sB, 50_000, 50_000, 65, 65, 0, 700_000)
        assert approx(r['la_draw_A'], 175_000, tol=1)  # 17.5% × R1m
        assert approx(r['la_draw_B'], 175_000, tol=1)
        assert r['clamp_A'] == 'cap'
        assert r['clamp_B'] == 'cap'
        assert r['net'] < 700_000  # REAL shortfall preserved


class TestBoostDoesNotCompound:
    """
    Regression guard: an earlier JS version mutated la_draw_A inside the boost
    iteration and computed next iteration's boost against the already-boosted
    value. Result: boosts compounded, net overshot target by hundreds of thousands.

    The correct behaviour: always measure boost against the Phase-1 baseline.
    """

    def test_boost_converges_to_target_not_past(self):
        # No disc, target 700k. Correct answer: LA ~411k each → net R699,940.
        # If compounding bug recurs, net will be >R1m.
        sA = person(la=4_000_000, disc=0, base=0)
        sB = person(la=4_000_000, disc=0, base=0)
        r = solve_topup(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000)
        # Net must NOT overshoot by more than R1000
        assert r['net'] <= 700_000 + 1000, \
            f"Boost compounded: net={r['net']:,.0f} (expected close to 700,000)"
        assert r['net'] > 699_000

    def test_disc_empty_after_partial_use_then_boost(self):
        # Disc runs out partway, then LA must boost
        sA = person(la=3_000_000, disc=50_000, base=25_000)
        sB = person(la=3_000_000, disc=50_000, base=25_000)
        r = solve_topup(sA, sB, 150_000, 150_000, 65, 65, 0, 700_000)
        # Disc should be near 50k each (used up)
        assert r['disc_A'] > 40_000
        assert r['disc_B'] > 40_000
        # LA should be boosted
        assert r['la_draw_A'] > 150_000
        assert r['la_draw_B'] > 150_000
        # Ceiling not hit (3m × 0.175 = 525k each)
        assert r['la_draw_A'] < 525_001
        # Net on target
        assert approx(r['net'], 700_000, tol=500)
