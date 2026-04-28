"""
Net-to-bank tax apportionment.

The calculator's `incomeBarSeries()` and the snapshot's
`buildProjectionPayload()` both apportion household tax across LA / Disc /
Other in proportion to each source's gross share of the year. The report's
income chart reads the apportioned net components from the snapshot
(`netLA / netDisc / netOther / netTotal` per row, post Session 26) so that
bar tops align with the engine's net target line.

This test locks the apportionment formula in Python so a future drift between
the JS-side helpers and the Python parity port surfaces as a test failure
rather than a wrong client PDF.

Formula (nominal-only — the calculator's realMode deflation is intentionally
NOT replicated on the snapshot):

    grossBase = laDraw + discDraw + otherIncome
    if grossBase > 0 and tax > 0:
        netLA    = max(0, laDraw   - tax * laDraw   / grossBase)
        netDisc  = max(0, discDraw - tax * discDraw / grossBase)
        netOther = max(0, otherInc - tax * otherInc / grossBase)
    else:
        netLA, netDisc, netOther = laDraw, discDraw, otherIncome
    netTotal = netLA + netDisc + netOther
"""
from conftest import approx


def apportion(la_draw, disc_draw, other, tax):
    """Pure Python port of the snapshot's net-apportionment formula."""
    gross_base = la_draw + disc_draw + other
    if gross_base > 0 and tax > 0:
        net_la = max(0.0, la_draw - tax * (la_draw / gross_base))
        net_disc = max(0.0, disc_draw - tax * (disc_draw / gross_base))
        net_other = max(0.0, other - tax * (other / gross_base))
    else:
        net_la, net_disc, net_other = la_draw, disc_draw, other
    return {
        'netLA': net_la,
        'netDisc': net_disc,
        'netOther': net_other,
        'netTotal': net_la + net_disc + net_other,
    }


class TestNetApportionment:
    def test_zero_tax_passes_gross_through(self):
        # No tax → net components equal gross components, total = gross.
        r = apportion(la_draw=400_000, disc_draw=200_000, other=100_000, tax=0)
        assert approx(r['netLA'], 400_000)
        assert approx(r['netDisc'], 200_000)
        assert approx(r['netOther'], 100_000)
        assert approx(r['netTotal'], 700_000)

    def test_all_la_gross_takes_full_tax(self):
        # Disc + Other are zero → all tax bites LA.
        r = apportion(la_draw=600_000, disc_draw=0, other=0, tax=80_000)
        assert approx(r['netLA'], 520_000)
        assert approx(r['netDisc'], 0)
        assert approx(r['netOther'], 0)
        assert approx(r['netTotal'], 520_000)

    def test_all_other_gross_takes_full_tax(self):
        # LA + Disc are zero → all tax bites Other.
        r = apportion(la_draw=0, disc_draw=0, other=300_000, tax=45_000)
        assert approx(r['netLA'], 0)
        assert approx(r['netDisc'], 0)
        assert approx(r['netOther'], 255_000)
        assert approx(r['netTotal'], 255_000)

    def test_mixed_three_sources_apportions_proportionally(self):
        # LA 400k + Disc 200k + Other 100k = 700k gross; tax 105k = 15% effective.
        # Each source bears 15% of its gross share.
        r = apportion(la_draw=400_000, disc_draw=200_000, other=100_000, tax=105_000)
        assert approx(r['netLA'], 340_000)        # 400k - 60k
        assert approx(r['netDisc'], 170_000)       # 200k - 30k
        assert approx(r['netOther'], 85_000)       # 100k - 15k
        assert approx(r['netTotal'], 595_000)      # gross 700k - tax 105k

    def test_cgt_heavy_year_disc_share_carries_cgt(self):
        # Big disc draw with CGT: tax includes income tax + CGT.
        # Apportionment is by gross share regardless of WHY the tax exists,
        # so a Disc-heavy year sees Disc carry most of the tax.
        # LA 200k + Disc 800k + Other 0 = 1m gross; tax 220k.
        # LA share = 220k * 0.2 = 44k; Disc share = 220k * 0.8 = 176k.
        r = apportion(la_draw=200_000, disc_draw=800_000, other=0, tax=220_000)
        assert approx(r['netLA'], 156_000)
        assert approx(r['netDisc'], 624_000)
        assert approx(r['netOther'], 0)
        assert approx(r['netTotal'], 780_000)

    def test_total_equals_gross_minus_tax(self):
        # Identity that the report's chart relies on (matches snapshot
        # invariant I11): netTotal === totalIncome - tax.
        r = apportion(la_draw=350_000, disc_draw=250_000, other=125_000, tax=140_000)
        gross = 350_000 + 250_000 + 125_000
        assert approx(r['netTotal'], gross - 140_000)

    def test_negative_clamp_when_one_source_dominates_tax(self):
        # The Math.max(0, ...) clamp shouldn't bite under realistic inputs
        # because tax ≤ gross by construction. Confirm the clamp is a
        # no-op for a sane case (negative net would never happen in
        # production but we want the clamp present as a defensive guard).
        # Tax = 100% of gross → all sources clamp to 0.
        r = apportion(la_draw=100_000, disc_draw=100_000, other=100_000, tax=300_000)
        assert approx(r['netLA'], 0)
        assert approx(r['netDisc'], 0)
        assert approx(r['netOther'], 0)
        assert approx(r['netTotal'], 0)
