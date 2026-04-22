"""
SARS 2026/27 income tax + CGT calculation tests.

Tax tables verified against:
  - SARS published 2026/27 tables (Budget Speech February 2026)
  - Old Mutual and SARS online calculators for spot checks
"""
from conftest import (
    income_tax_pre_rebate_year, income_tax_year, rebate_year,
    cgt_exclusion_year, approx,
)


# ============================================================
# Pre-rebate tax at the 2026/27 tables
# ============================================================

class TestIncomeTaxPreRebate:
    """Base tax before any rebates are applied."""

    def test_zero_taxable(self):
        assert income_tax_pre_rebate_year(0, 0) == 0

    def test_negative_taxable(self):
        assert income_tax_pre_rebate_year(-1000, 0) == 0

    def test_first_bracket_midpoint(self):
        # R100 000 is in the 18% bracket (up to R245 100)
        # Expected: 100000 * 0.18 = 18000
        assert approx(income_tax_pre_rebate_year(100_000, 0), 18_000)

    def test_first_bracket_upper_edge(self):
        # R245 100 is the exact edge of the 18% bracket
        # Expected: 245100 * 0.18 = 44118
        assert approx(income_tax_pre_rebate_year(245_100, 0), 44_118)

    def test_second_bracket_midpoint(self):
        # R300 000 is in the 26% bracket
        # Expected: 44118 + (300000 - 245100) * 0.26 = 44118 + 14274 = 58392
        assert approx(income_tax_pre_rebate_year(300_000, 0), 58_392)

    def test_third_bracket_midpoint(self):
        # R500 000 is in the 31% bracket
        # Expected: 79998 + (500000 - 383100) * 0.31 = 79998 + 36239 = 116237
        assert approx(income_tax_pre_rebate_year(500_000, 0), 116_237)

    def test_top_bracket(self):
        # R2m is in the 45% bracket
        # Expected: 666339 + (2000000 - 1878600) * 0.45 = 666339 + 54630 = 720969
        assert approx(income_tax_pre_rebate_year(2_000_000, 0), 720_969)


class TestRebates:
    """Age-dependent rebates at 2026/27."""

    def test_under_65(self):
        # Only primary rebate R17 820
        assert approx(rebate_year(40, 0), 17_820)
        assert approx(rebate_year(64, 0), 17_820)

    def test_age_65(self):
        # Primary + secondary: R17 820 + R9 765 = R27 585
        assert approx(rebate_year(65, 0), 27_585)

    def test_age_70(self):
        assert approx(rebate_year(70, 0), 27_585)

    def test_age_75(self):
        # Primary + secondary + tertiary: R17 820 + R9 765 + R3 249 = R30 834
        assert approx(rebate_year(75, 0), 30_834)

    def test_age_100(self):
        assert approx(rebate_year(100, 0), 30_834)


class TestIncomeTaxNet:
    """Net tax after rebates."""

    def test_below_threshold_under_65(self):
        # Threshold for under-65 is R99 000
        # At R99 000: pre-rebate tax = 17 820, rebate = 17 820, net = 0
        assert approx(income_tax_year(99_000, 40, 0), 0)

    def test_below_threshold_65_plus(self):
        # Threshold for 65+ is R153 250
        # At R153 250: pre-rebate = 27 585 (0.18 × 153250), rebate = 27 585, net = 0
        assert approx(income_tax_year(153_250, 65, 0), 0)

    def test_modest_income_age_65(self):
        # R200 000 at age 65
        # Pre-rebate: 200000 * 0.18 = 36000
        # Rebate: 27 585
        # Net: 8415
        assert approx(income_tax_year(200_000, 65, 0), 8_415)

    def test_modest_income_age_40(self):
        # R200 000 at age 40 — no secondary rebate
        # Pre-rebate: 36000, rebate: 17820, net: 18180
        assert approx(income_tax_year(200_000, 40, 0), 18_180)

    def test_high_income_age_68(self):
        # R500 000 at age 68
        # Pre-rebate: 116 237, rebate: 27 585, net: 88 652
        assert approx(income_tax_year(500_000, 68, 0), 88_652)


# ============================================================
# Bracket creep — projected tax in future years
# ============================================================

class TestBracketCreep:
    """Tax in future years assuming 3% annual bracket/rebate growth."""

    def test_year_1_scaling(self):
        # In year 1 (yearIdx=1), brackets and rebates grow by 3%
        # First bracket upper: 245100 * 1.03 = 252453
        # R250 000 would still be in the 18% bracket
        # Pre-rebate: 250000 * 0.18 = 45000
        # Rebate at age 65: 27 585 * 1.03 = 28412.55
        # Net: 45000 - 28412.55 = 16587.45
        assert approx(income_tax_year(250_000, 65, 1), 16_587.45, tol=0.5)

    def test_bracket_creep_neutral_income(self):
        """
        If income also grows at 3%, real tax should be unchanged across years.

        R250 000 taxable at year 0 produces tax X.
        R250 000 × 1.03 taxable at year 1 should produce tax X × 1.03 (same
        in real terms).
        """
        tax_y0 = income_tax_year(250_000, 65, 0)
        tax_y1 = income_tax_year(250_000 * 1.03, 65, 1)
        # tax_y1 should equal tax_y0 × 1.03 (both nominal)
        assert approx(tax_y1, tax_y0 * 1.03, tol=0.5)

    def test_year_30_high_income(self):
        # Just a sanity check that year 30 doesn't produce anything absurd
        tax = income_tax_year(2_000_000, 70, 30)
        assert tax > 0
        # With 3% creep over 30 years, effective real tax should be reasonable
        real_tax = tax / (1.03 ** 30)
        # Real tax on R2m at age 70 year 0 is...
        # pre-rebate 720969, rebate 27585, net 693384
        # In year 30 with R2m nominal (not CPI-adjusted in income)...
        # Honestly just check it's bounded
        assert 0 < tax < 2_000_000  # can't be more than the income itself


# ============================================================
# CGT annual exclusion
# ============================================================

class TestCGTExclusion:
    def test_year_0(self):
        assert approx(cgt_exclusion_year(0), 50_000)

    def test_year_1(self):
        assert approx(cgt_exclusion_year(1), 50_000 * 1.03)

    def test_year_20(self):
        assert approx(cgt_exclusion_year(20), 50_000 * (1.03 ** 20), tol=0.5)
