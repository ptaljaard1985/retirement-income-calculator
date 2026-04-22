"""
Auto-top-up from discretionary (Phase 2 of solve_topup).

Verifies:
  - No shortfall → no disc draws
  - Shortfall with equal disc pots → 50/50 split
  - Shortfall with unequal pots → proportional split
  - Spouse cap on disc → overflow redistributes
  - Both pots exhausted → shortfall preserved (handled in boost tests)
  - Convergence to R100 tolerance
"""
from conftest import solve_topup, person, approx


class TestTopUpNoShortfall:
    """When LA covers the target, no disc should be drawn."""

    def test_big_la_no_disc_needed(self):
        # R500k LA each at age 65
        # Pre-rebate tax: 116237; rebate 27585; net tax 88652/spouse = 177304
        # Gross 1m, net = 1m - 177304 = 822696. Target R700k easily met.
        sA = person(la=8_000_000, disc=0, base=0)
        sB = person(la=8_000_000, disc=0, base=0)
        r = solve_topup(sA, sB, 500_000, 500_000, 65, 65, 0, 700_000)
        assert r['disc_A'] == 0 and r['disc_B'] == 0
        assert r['net'] > 700_000
        assert r['clamp_A'] == 'ok' and r['clamp_B'] == 'ok'


class TestTopUpEqualPots:
    """Symmetric scenarios should produce symmetric draws."""

    def test_equal_pots_equal_draws(self):
        sA = person(la=4_000_000, disc=1_000_000, base=500_000)
        sB = person(la=4_000_000, disc=1_000_000, base=500_000)
        # LA 250k each = 500k gross, tax leaves ~460k net. Shortfall ~R120k.
        r = solve_topup(sA, sB, 250_000, 250_000, 65, 65, 0, 580_000)
        assert approx(r['disc_A'], r['disc_B'], tol=1.0)
        assert approx(r['net'], 580_000, tol=200)

    def test_converges_to_target(self):
        sA = person(la=4_000_000, disc=1_000_000, base=500_000)
        sB = person(la=4_000_000, disc=1_000_000, base=500_000)
        r = solve_topup(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000)
        assert approx(r['net'], 700_000, tol=200)


class TestTopUpProportionalSplit:
    """Unequal pots should produce unequal draws, proportional to balance."""

    def test_80_20_split(self):
        sA = person(la=4_000_000, disc=800_000, base=400_000)   # 80% of disc
        sB = person(la=4_000_000, disc=200_000, base=100_000)   # 20%
        r = solve_topup(sA, sB, 200_000, 200_000, 65, 65, 0, 550_000)
        total = r['disc_A'] + r['disc_B']
        assert total > 0
        # Allow small drift because of CGT nonlinearity
        assert 0.75 < r['disc_A'] / total < 0.85

    def test_99_1_split(self):
        sA = person(la=4_000_000, disc=990_000, base=495_000)
        sB = person(la=4_000_000, disc=10_000, base=5_000)
        r = solve_topup(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000)
        total = r['disc_A'] + r['disc_B']
        assert r['disc_A'] / total > 0.9


class TestTopUpCaps:
    """One spouse's disc exhausted → other takes the remainder."""

    def test_tiny_disc_hits_cap(self):
        # Spouse A has only R5000 disc. Any significant top-up will cap it,
        # and B should absorb the rest.
        sA = person(la=4_000_000, disc=5_000, base=2_500)
        sB = person(la=4_000_000, disc=2_000_000, base=1_000_000)
        r = solve_topup(sA, sB, 150_000, 150_000, 65, 65, 0, 600_000)
        # A's draw might be capped near R5000 (if proportional weight exceeds slack)
        # or smaller (if the weight × gross gives a smaller number).
        # Either way it cannot exceed the disc balance.
        assert r['disc_A'] <= 5_001
        # And the result should still meet target
        assert approx(r['net'], 600_000, tol=500)

    def test_both_disc_exhausted_shortfall_remains(self):
        # Both R10k disc, both LA draws small, huge target
        sA = person(la=1_000_000, disc=10_000, base=5_000)
        sB = person(la=1_000_000, disc=10_000, base=5_000)
        r = solve_topup(sA, sB, 100_000, 100_000, 65, 65, 0, 500_000)
        assert r['disc_A'] <= 10_001
        assert r['disc_B'] <= 10_001
        # Can't close the gap — should show real shortfall
        # (boost phase will also try; if LA can boost, it might cover; let's see)
        # With 1m LA each, ceiling is 175k each = 350k total
        # Plus 20k disc, minus tax = net is much less than 500k
        assert r['net'] < 500_000


class TestTopUpCGTIntegration:
    """Solver should account for CGT on gains."""

    def test_higher_base_cost_lower_tax(self):
        # Two scenarios with same balance but different base cost
        sA_high_base = person(la=4_000_000, disc=1_000_000, base=900_000)
        sB_high_base = person(la=4_000_000, disc=1_000_000, base=900_000)
        r_high = solve_topup(sA_high_base, sB_high_base,
                             200_000, 200_000, 65, 65, 0, 700_000)

        sA_low_base = person(la=4_000_000, disc=1_000_000, base=100_000)
        sB_low_base = person(la=4_000_000, disc=1_000_000, base=100_000)
        r_low = solve_topup(sA_low_base, sB_low_base,
                            200_000, 200_000, 65, 65, 0, 700_000)

        # Both should hit target
        assert approx(r_high['net'], 700_000, tol=200)
        assert approx(r_low['net'], 700_000, tol=200)

        # Low base case should require MORE gross disc draw to net the same
        # (because more of it is taxable gain)
        assert (r_low['disc_A'] + r_low['disc_B']) > (r_high['disc_A'] + r_high['disc_B'])


class TestTopUpLifecycle:
    """Integration: default Hayes scenario Y1 with top-up on should net ~target."""

    def test_hayes_y1(self):
        # R4m LA each, R1m disc each, R500k base each, 5% rate, age 65, target 700k
        sA = person(la=4_000_000, disc=1_000_000, base=500_000)
        sB = person(la=4_000_000, disc=1_000_000, base=500_000)
        # Y1 LA target = 5% × R4m = R200k each
        r = solve_topup(sA, sB, 200_000, 200_000, 65, 65, 0, 700_000)
        assert approx(r['net'], 700_000, tol=100)
        assert r['disc_A'] > 0 and r['disc_B'] > 0
        assert r['clamp_A'] == 'ok' and r['clamp_B'] == 'ok'
