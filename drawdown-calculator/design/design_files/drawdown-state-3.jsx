/* global React, Field, Slider, DrawdownChart, IncomeChart, LongevityMeter, TogglePill, DrawdownPlanInputs */

// ─── State 3 · COMPARE (baseline locked) ─────────────────────
// Two-up: baseline (muted) vs scenario (navy-ringed). Scenario levers beneath,
// grouped by spouse. Shared-market/needs levers sit in a thin row below.
const DrawdownCompare = () => {
  const [autoTopUp, setAutoTopUp] = React.useState(true);
  const [mode, setMode] = React.useState('real');

  return (
    <main className="canvas canvas-norail canvas-compare">
      <DrawdownPlanInputs autoTopUp={autoTopUp} />

      <div className="canvas-head compact" style={{ marginTop: 24 }}>
        <div>
          <div className="canvas-head-eyebrow">Scenario compare · baseline locked</div>
          <h1 className="headline" style={{ fontSize: 42, lineHeight: 1.08 }}>
            What if we <span className="gold-under">draw <span className="num">R 5 000 more</span></span>?
          </h1>
        </div>
        <div className="canvas-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <TogglePill on={autoTopUp} label="Auto-top-up" onToggle={() => setAutoTopUp(v => !v)} />
          <div className="seg mini">
            <span className={mode === 'real' ? 'on' : ''} onClick={() => setMode('real')}>Real</span>
            <span className={mode === 'nominal' ? 'on' : ''} onClick={() => setMode('nominal')}>Nominal</span>
          </div>
          <button className="btn ghost">Clear baseline</button>
          <button className="btn primary">Re-lock as new baseline</button>
        </div>
      </div>

      <div className="compare big">
        {/* ─── Baseline ─── */}
        <div className="compare-card baseline">
          <div className="compare-card-head">
            <span className="compare-tag">Baseline · current plan</span>
            <span style={{ fontSize: 10, color: 'var(--mute)', letterSpacing: 1.2, textTransform: 'uppercase' }}>locked</span>
          </div>
          <div className="compare-val longev num">
            age 94 <span className="unit">· 29 years</span>
          </div>
          <div className="compare-sub">R 50 000 / mo · R 10.0m starting capital</div>
          <div style={{ margin: '18px -4px 14px' }}>
            <IncomeChart height={220} years={36} startAge={65} depleteAt={94} faded />
          </div>
          <div style={{ height: 22 }} />
          <div className="compare-meta">
            <div className="row"><span>LA draw · Marilyn</span><span>5.00%</span></div>
            <div className="row"><span>LA draw · James</span><span>5.00%</span></div>
            <div className="row"><span>Disc. draw · household</span><span>R 100 000 / yr</span></div>
            <div className="row"><span>Monthly need (after tax)</span><span>R 50 000</span></div>
            <div className="row"><span>Return · CPI</span><span>9% · 5%</span></div>
          </div>
        </div>

        {/* ─── Scenario ─── */}
        <div className="compare-card scenario">
          <div className="compare-card-head">
            <span className="compare-tag">Planned scenario</span>
            <span className="delta-chip neg-years">− 5 years · depletes at 89</span>
          </div>
          <div className="compare-val longev num">
            age 89 <span className="unit">· 24 years</span>
          </div>
          <div className="compare-sub">R 55 000 / mo · auto-top-up covers R 3 500 shortfall</div>
          <div style={{ margin: '18px -4px 14px' }}>
            <IncomeChart height={220} years={36} startAge={65} depleteAt={89} shortfallFrom={86} />
          </div>
          <div style={{ height: 22 }} />
          <div className="compare-meta">
            <div className="row">
              <span>LA draw · Marilyn</span>
              <span>5.75% <em style={{ color: 'var(--gold-2)', fontStyle: 'normal', marginLeft: 4 }}>+0.75</em></span>
            </div>
            <div className="row">
              <span>LA draw · James</span>
              <span>5.75% <em style={{ color: 'var(--gold-2)', fontStyle: 'normal', marginLeft: 4 }}>+0.75</em></span>
            </div>
            <div className="row">
              <span>Disc. draw · household</span>
              <span>R 160 000 / yr <em style={{ color: 'var(--gold-2)', fontStyle: 'normal', marginLeft: 4 }}>+60k</em></span>
            </div>
            <div className="row"><span>Monthly need (after tax)</span><span>R 55 000 <em style={{ color: 'var(--gold-2)', fontStyle: 'normal', marginLeft: 4 }}>+5k</em></span></div>
            <div className="row"><span>Return · CPI</span><span>9% · 5%</span></div>
          </div>
        </div>
      </div>

      <div className="chart-legend" style={{ margin: '10px 0 18px', justifyContent: 'center' }}>
        <span className="k"><span className="sw" style={{ background: 'var(--teal)' }} /> LA draw</span>
        <span className="k"><span className="sw" style={{ background: 'var(--gold)' }} /> Discretionary draw</span>
        <span className="k"><span className="sw" style={{ background: 'var(--navy-soft)' }} /> Other income</span>
        <span className="k" style={{ color: 'var(--coral)' }}>
          <span className="sw line" style={{ color: 'var(--coral)' }} /> Target need
        </span>
      </div>

      {/* Scenario levers — grouped by spouse, plus a shared row underneath */}
      <div className="scenario-levers">
        <div className="scenario-levers-head">
          <span className="scenario-levers-title">
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--gold-2)', fontSize: 13, textTransform: 'none', letterSpacing: 0, marginRight: 6, fontWeight: 500 }}>vii.</span>
            Scenario levers
          </span>
          <span>
            <span className="scenario-levers-hint">centred on the locked baseline — nudge to explore</span>
            <a className="solve-link">Solve to target →</a>
          </span>
        </div>

        <div className="levers-per-spouse">
          <div className="lever-spouse-panel">
            <div className="lever-spouse-head">
              <span className="lever-spouse-name">Marilyn</span>
              <span className="lever-spouse-tag">Spouse A · age 65</span>
            </div>
            <Slider label="LA drawdown rate" value="5.75%" fill={0.21} delta="+0.75" />
            <Slider label="Annual discretionary draw" value="R 80 000" fill={0.6} delta="+30k" />
          </div>

          <div className="lever-spouse-panel">
            <div className="lever-spouse-head">
              <span className="lever-spouse-name">James</span>
              <span className="lever-spouse-tag">Spouse B · age 65</span>
            </div>
            <Slider label="LA drawdown rate" value="5.75%" fill={0.21} delta="+0.75" />
            <Slider label="Annual discretionary draw" value="R 80 000" fill={0.6} delta="+30k" />
          </div>
        </div>

        <div className="levers-shared">
          <div className="lever-shared-col">
            <div className="lever-shared-head">Markets</div>
            <Slider label="Expected return" value="9.00%" fill={0.45} />
            <Slider label="Inflation (CPI)" value="5.00%" fill={0.37} />
          </div>
          <div className="lever-shared-col">
            <div className="lever-shared-head">Household need</div>
            <Slider label="Monthly after-tax expenses" value="R 55 000" fill={0.55} delta="+5k" />
            <Slider label="Annual lump sums" value="R 100 000" fill={0.25} />
          </div>
          <div className="lever-shared-col">
            <div className="lever-shared-head">Capital events</div>
            <div className="ledger-row"><span className="lbl">Property sale · 2028</span><span className="amt">+ R 2.5m</span></div>
            <div className="ledger-row"><span className="lbl">DB pension · Marilyn</span><span className="amt">R 6 500/mo</span></div>
            <button className="add-btn" style={{ marginTop: 8 }}>＋ Add an event</button>
          </div>
        </div>
      </div>
    </main>
  );
};

Object.assign(window, { DrawdownCompare });
