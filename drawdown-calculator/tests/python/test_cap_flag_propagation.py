"""
Clamp-flag propagation through project().

Regression guard for Session 8: stepPerson's cap detection uses strict
`target > ceil`, which never fires when the auto-top-up solver pre-clamps
target === ceil (Phase 1) or boosts LA up to ceil exactly (Phase 3). The
solver owns the correct flag; project() must thread it through into
series['clamp_A'] / series['clamp_B'] when auto-top-up is on, so the
"17.5% ceiling" alert and the year-table ▲ marker reflect reality.
"""
from conftest import project, person


class TestCapFlagPhase1:
    """CPI-escalated target exceeds ceil → Phase-1 cap → series flag = 'cap'."""

    def test_phase1_cap_when_cpi_outruns_return(self):
        # Return 2% < CPI 8% → balance shrinks in real terms, rand target
        # inflates, rate crosses 17.5% eventually. No disc → Phase 2 skipped.
        sA = person(la=4_000_000, la_rate=0.17, disc=0, base=0)
        sB = person(la=4_000_000, la_rate=0.17, disc=0, base=0)
        s = project(sA, sB, age_A=65, age_B=65,
                    r_nom=0.02, cpi=0.08,
                    target_pv_annual=1_000_000,
                    auto_topup=True)
        # Somewhere in the horizon the cap must bite.
        assert 'cap' in s['clamp_A'], "Phase-1 cap never surfaced in clamp_A"
        assert 'cap' in s['clamp_B'], "Phase-1 cap never surfaced in clamp_B"

    def test_no_cap_when_return_outruns_cpi(self):
        # Balance grows faster than target → draw rate falls → cap never bites.
        sA = person(la=4_000_000, la_rate=0.05, disc=0, base=0)
        sB = person(la=4_000_000, la_rate=0.05, disc=0, base=0)
        s = project(sA, sB, age_A=65, age_B=65,
                    r_nom=0.10, cpi=0.04,
                    target_pv_annual=300_000,
                    auto_topup=True)
        assert 'cap' not in s['clamp_A']
        assert 'cap' not in s['clamp_B']


class TestCapFlagPhase3:
    """Disc exhausted + gap remains → Phase-3 boost reaches ceil → 'cap'."""

    def test_phase3_cap_when_disc_exhausted_and_gap_remains(self):
        # Modest disc, aggressive target → disc exhausts in a few years,
        # Phase 3 boosts LA into the ceiling.
        sA = person(la=4_000_000, la_rate=0.05, disc=500_000, base=250_000)
        sB = person(la=4_000_000, la_rate=0.05, disc=500_000, base=250_000)
        s = project(sA, sB, age_A=65, age_B=65,
                    r_nom=0.07, cpi=0.06,
                    target_pv_annual=800_000,
                    auto_topup=True)
        # After disc runs out the boost should hit the ceiling.
        assert 'cap' in s['clamp_A'], "Phase-3 cap never surfaced in clamp_A"
        assert 'cap' in s['clamp_B'], "Phase-3 cap never surfaced in clamp_B"


class TestCapFlagNonAutoTopup:
    """Without auto-top-up, stepPerson's strict `>` still catches the cap
       when CPI-escalation pushes the unclamped target above ceil."""

    def test_non_autotopup_cap_via_cpi_escalation(self):
        # Fixed rate 15% of initial R1m → target R150k in Y1. Low return,
        # high CPI → balance shrinks while target inflates; eventually
        # target / balance > 17.5% → cap bites via stepPerson.
        sA = person(la=1_000_000, la_rate=0.15, disc=0, base=0)
        sB = person(la=1_000_000, la_rate=0.15, disc=0, base=0)
        s = project(sA, sB, age_A=65, age_B=65,
                    r_nom=0.02, cpi=0.08,
                    target_pv_annual=300_000,
                    auto_topup=False)
        assert 'cap' in s['clamp_A']
        assert 'cap' in s['clamp_B']
