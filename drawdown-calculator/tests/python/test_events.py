"""
Future capital events:
  - Land at end of designated year
  - Amount inflates PV → nominal at CPI
  - Added to both discBalance AND discBaseCost (no unrealised gain on arrival)
  - Empty list → no change vs baseline
"""
from conftest import project, person, approx


class TestEventsEmpty:
    """No events → identical trajectory to baseline."""

    def test_no_events_equals_baseline(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000)
        p0 = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=False, events=[])
        p1 = project(pA, pB, 65, 65, 0.09, 0.05, 700_000, auto_topup=False, events=None)
        # Same trajectories (within float noise)
        for i in range(len(p0['total'])):
            assert approx(p0['total'][i], p1['total'][i])


class TestEventsStepUp:
    """An event should produce a visible step-up on the destination spouse's disc."""

    def test_year_5_event_nominal_value(self):
        # R5m PV at year 5, CPI 5% → nominal = 5m × 1.05^4 ≈ 6.077m
        pA = person(la=4_000_000, disc=1_000_000, base=500_000)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000)
        events = [{'year': 5, 'amountPV': 5_000_000, 'spouse': 'A'}]
        p = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                    auto_topup=False, events=events)
        # Position 4 = start of year 5 (before event). Position 5 = start of year 6 (after event).
        # The event is applied at end of year 5, so we see it at position 5.
        # The discA_bal series stores START-of-year balance. Position 5's value reflects
        # position 4's balance grown through year 5 PLUS the event amount.
        expected_nominal_amount = 5_000_000 * (1.05 ** 4)
        # Disc at position 4 (year 5 start) vs position 5 (year 6 start, after event)
        pos4 = p['discA_bal'][4]
        pos5 = p['discA_bal'][5]
        # No draws on disc in this baseline case, so growth is pure × 1.09
        grown_without_event = pos4 * 1.09
        actual_jump = pos5 - grown_without_event
        assert approx(actual_jump, expected_nominal_amount, tol=1)


class TestEventsBaseCost:
    """Event amount must be added to base cost too — no unrealised gain on arrival."""

    def test_event_amount_increments_base_cost(self):
        # Run projection, then verify implicit: a later draw on the post-event pot
        # should produce less CGT than the same draw on a no-event pot.
        # This is tested implicitly by checking the disc balance grew by the full
        # event amount — if base cost didn't grow, subsequent disc draws would
        # show much higher gains.
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, disc_draw=100_000)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, disc_draw=100_000)

        # Baseline: no events
        p_no_ev = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                          auto_topup=False, events=[])

        # With event: R5m to A at year 5
        events = [{'year': 5, 'amountPV': 5_000_000, 'spouse': 'A'}]
        p_with_ev = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                            auto_topup=False, events=events)

        # At year 6, the post-event tax for spouse A should be lower than pre-event baseline
        # (proportionally) because base cost absorbed R6m+ of inflow.
        # Tax_A at year 6 (index 5) in the with-event case must be less than or equal to
        # tax_A at year 6 in the no-event case — because the inflated base cost reduces
        # the gain fraction.
        # (LA draws are unchanged between the two cases; only disc CGT differs.)
        assert p_with_ev['tax_A'][5] <= p_no_ev['tax_A'][5] + 100


class TestEventsMultiple:
    """Multiple events: each lands at the correct year on the correct spouse."""

    def test_two_events_different_spouses(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000)
        events = [
            {'year': 3, 'amountPV': 2_000_000, 'spouse': 'A'},
            {'year': 10, 'amountPV': 3_000_000, 'spouse': 'B'},
        ]
        p = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                    auto_topup=False, events=events)
        # Year 3 event: R2m × 1.05^2 = R2.205m to A
        # Year 10 event: R3m × 1.05^9 = R4.654m to B
        expected_e1 = 2_000_000 * (1.05 ** 2)
        expected_e2 = 3_000_000 * (1.05 ** 9)
        # A's disc at pos 3 vs pos 2 × 1.09 (with no draws)
        jump_A = p['discA_bal'][3] - p['discA_bal'][2] * 1.09
        assert approx(jump_A, expected_e1, tol=1)
        # B's disc at pos 10 vs pos 9 × 1.09
        jump_B = p['discB_bal'][10] - p['discB_bal'][9] * 1.09
        assert approx(jump_B, expected_e2, tol=1)


class TestEventsTargetedSpouse:
    """Event to spouse A must not affect spouse B."""

    def test_event_to_A_only(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000)

        p_no_ev = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                          auto_topup=False, events=[])
        p_to_A = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                         auto_topup=False,
                         events=[{'year': 5, 'amountPV': 5_000_000, 'spouse': 'A'}])

        # Spouse B's disc trajectory should be identical
        for i in range(len(p_no_ev['discB_bal'])):
            assert approx(p_no_ev['discB_bal'][i], p_to_A['discB_bal'][i])

        # Spouse A's disc should diverge after year 5
        assert p_to_A['discA_bal'][5] > p_no_ev['discA_bal'][5]


class TestEventsInvalidIgnored:
    """Events outside the horizon should just not apply (no crash)."""

    def test_event_beyond_horizon(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000)
        # Age 65, horizon 100 → 35 years. Event at year 100 is past horizon.
        events = [{'year': 100, 'amountPV': 999_999_999, 'spouse': 'A'}]
        p_ev = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                       auto_topup=False, events=events)
        p_no = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                       auto_topup=False, events=[])
        # Trajectories should be identical (event never applies)
        for i in range(len(p_ev['total'])):
            assert approx(p_ev['total'][i], p_no['total'][i])
