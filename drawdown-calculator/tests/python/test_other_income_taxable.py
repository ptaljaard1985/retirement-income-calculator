"""
Other-income items can be partially or fully tax-free.

Each schedule item now carries `pctTaxable` (0–100). Default 100 (legacy:
fully taxable). Items missing the field behave as before.

  - taxable portion = nominal × pctTaxable / 100   (enters tax base)
  - tax-free portion = nominal × (1 − pctTaxable/100)  (cash flow only)

The resolver returns three values: total, taxable, taxFree. The projection
keeps gross income / yearDraw unchanged (uses total) but the tax base only
sees the taxable portion.
"""
from conftest import other_income_for_year, project, person, approx


# ============================================================
# Resolver: pctTaxable splits the nominal stream
# ============================================================

class TestResolverPctTaxable:
    def test_default_full_taxable_when_field_missing(self):
        sched = [{'label': 'x', 'spouse': 'A', 'amountPV': 100_000,
                  'startAge': 65, 'duration': 10, 'escalates': False}]
        r = other_income_for_year(sched, 'A', 65, 0, 0.05)
        assert approx(r['total'], 100_000)
        assert approx(r['taxable'], 100_000)
        assert approx(r['taxFree'], 0)

    def test_pct_taxable_zero_is_fully_tax_free(self):
        sched = [{'label': 'x', 'spouse': 'A', 'amountPV': 100_000,
                  'startAge': 65, 'duration': 10, 'escalates': False,
                  'pctTaxable': 0}]
        r = other_income_for_year(sched, 'A', 65, 0, 0.05)
        assert approx(r['total'], 100_000)
        assert approx(r['taxable'], 0)
        assert approx(r['taxFree'], 100_000)

    def test_pct_taxable_50_splits_evenly(self):
        sched = [{'label': 'x', 'spouse': 'A', 'amountPV': 100_000,
                  'startAge': 65, 'duration': 10, 'escalates': False,
                  'pctTaxable': 50}]
        r = other_income_for_year(sched, 'A', 65, 0, 0.05)
        assert approx(r['total'], 100_000)
        assert approx(r['taxable'], 50_000)
        assert approx(r['taxFree'], 50_000)

    def test_multiple_streams_sum_per_class(self):
        sched = [
            {'label': 'rent', 'spouse': 'A', 'amountPV': 50_000,
             'startAge': 65, 'duration': 10, 'escalates': False, 'pctTaxable': 100},
            {'label': 'maint', 'spouse': 'A', 'amountPV': 30_000,
             'startAge': 65, 'duration': 10, 'escalates': False, 'pctTaxable': 0},
            {'label': 'mix', 'spouse': 'A', 'amountPV': 20_000,
             'startAge': 65, 'duration': 10, 'escalates': False, 'pctTaxable': 50},
        ]
        r = other_income_for_year(sched, 'A', 65, 0, 0.05)
        assert approx(r['total'], 100_000)
        assert approx(r['taxable'], 50_000 + 0 + 10_000)
        assert approx(r['taxFree'], 0 + 30_000 + 10_000)

    def test_escalates_applies_after_split(self):
        sched = [{'label': 'rent', 'spouse': 'B', 'amountPV': 60_000,
                  'startAge': 65, 'duration': 10, 'escalates': True,
                  'pctTaxable': 25}]
        cpi = 0.05
        r = other_income_for_year(sched, 'B', 70, 5, cpi)
        nominal = 60_000 * (1 + cpi) ** 5
        assert approx(r['total'], nominal, tol=0.5)
        assert approx(r['taxable'], nominal * 0.25, tol=0.5)
        assert approx(r['taxFree'], nominal * 0.75, tol=0.5)


# ============================================================
# End-to-end: tax base sees taxable portion only;
# total flows to net income.
# ============================================================

class TestProjectionTaxFree:
    def test_tax_free_stream_flows_to_net_with_no_tax_bite(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        baseline = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                           auto_topup=False, incomes=[])
        sched = [{'label': 'tf', 'spouse': 'A', 'amountPV': 60_000,
                  'startAge': 65, 'duration': 5, 'escalates': False,
                  'pctTaxable': 0}]
        with_tf = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                          auto_topup=False, incomes=sched)
        # Y1 gross income rises by exactly the stream amount
        assert approx(with_tf['draw'][0] - baseline['draw'][0], 60_000, tol=1)
        # Y1 net rises by full 60k (tax-free)
        assert approx(with_tf['net'][0] - baseline['net'][0], 60_000, tol=1)
        # Y1 tax unchanged
        assert approx(with_tf['tax'][0], baseline['tax'][0], tol=1)

    def test_legacy_item_without_pct_field_matches_explicit_100(self):
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        legacy = [{'label': 'rent', 'spouse': 'A', 'amountPV': 60_000,
                   'startAge': 65, 'duration': 5, 'escalates': False}]
        explicit = [{'label': 'rent', 'spouse': 'A', 'amountPV': 60_000,
                     'startAge': 65, 'duration': 5, 'escalates': False,
                     'pctTaxable': 100}]
        p_legacy = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                           auto_topup=False, incomes=legacy)
        p_explicit = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                             auto_topup=False, incomes=explicit)
        for k in ('draw', 'tax', 'net'):
            for i in range(len(p_legacy[k])):
                assert approx(p_legacy[k][i], p_explicit[k][i], tol=1)

    def test_partial_split_partial_tax_bite(self):
        """50% taxable → tax bites only on the taxable half."""
        pA = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, disc=1_000_000, base=500_000, other=0)
        baseline = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                           auto_topup=False, incomes=[])
        sched = [{'label': 'mix', 'spouse': 'A', 'amountPV': 100_000,
                  'startAge': 65, 'duration': 5, 'escalates': False,
                  'pctTaxable': 50}]
        p = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                    auto_topup=False, incomes=sched)
        # Gross Y1 rises by full 100k
        assert approx(p['draw'][0] - baseline['draw'][0], 100_000, tol=1)
        # Net delta strictly between 50k (full tax on half) and 100k (no tax)
        net_delta = p['net'][0] - baseline['net'][0]
        assert 50_000 < net_delta < 100_000
        # Tax bite is positive (some tax on the 50k taxable portion)
        assert p['tax'][0] - baseline['tax'][0] > 0

    def test_topup_solver_treats_tax_free_as_net_already(self):
        """With pctTaxable=0 and auto-top-up, net LA + tax-free other can cover
        target without disc draws — solver should not pull from disc."""
        pA = person(la=4_000_000, la_rate=0.04, disc=1_000_000, base=500_000, other=0)
        pB = person(la=4_000_000, la_rate=0.04, disc=1_000_000, base=500_000, other=0)
        # Big tax-free stream that comfortably covers any shortfall
        sched = [{'label': 'tf', 'spouse': 'A', 'amountPV': 600_000,
                  'startAge': 65, 'duration': 35, 'escalates': True,
                  'pctTaxable': 0}]
        p = project(pA, pB, 65, 65, 0.09, 0.05, 700_000,
                    auto_topup=True, incomes=sched)
        # Y1 disc draws should be zero (target already met)
        assert approx(p['discA_draw'][0], 0, tol=1)
        assert approx(p['discB_draw'][0], 0, tol=1)
