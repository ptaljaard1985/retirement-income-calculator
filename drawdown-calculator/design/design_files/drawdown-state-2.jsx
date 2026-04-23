/* global React, Field, Slider, DrawdownChart, IncomeChart, LongevityMeter, TogglePill, DrawdownPlanInputs */

// ─── State 2 · FILLED (single scenario, no baseline) ─────────
// Hero reframes around "is this sustainable, and for how long?"
// Default view = Income chart (sources vs target). Capital toggle available.
const DrawdownFilled = () => {
  const [autoTopUp, setAutoTopUp] = React.useState(true);
  const [mode, setMode] = React.useState('real'); // real | nominal
  const [view, setView] = React.useState('income'); // income | capital | table

  return (
    <main className="canvas canvas-norail">
      <DrawdownPlanInputs autoTopUp={autoTopUp} />

      <div className="canvas-head" style={{ marginTop: 24 }}>
        <div>
          <div className="canvas-head-eyebrow">Sustainability projection · today's money</div>
          <h1 className="headline">
            <span className="num">R 50 000</span> a month is <em>sustainable</em> until{' '}
            <span className="gold-under">age <span className="num">94</span></span>.
          </h1>
          <p className="headline-sub">
            The couple's target lifestyle can be funded from living annuities, the discretionary portfolio
            and other income for <strong>29 years</strong>. After age 94 the capital runs dry — income drops
            to other sources alone (roughly R 9 000/mo in today's money).
          </p>
        </div>
        <div className="canvas-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 340 }}>
          <TogglePill on={autoTopUp} label="Auto-top-up" onToggle={() => setAutoTopUp(v => !v)} />
          <div className="seg mini">
            <span className={mode === 'real' ? 'on' : ''} onClick={() => setMode('real')}>Real</span>
            <span className={mode === 'nominal' ? 'on' : ''} onClick={() => setMode('nominal')}>Nominal</span>
          </div>
          <button className="btn primary">Lock as baseline →</button>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card-head">
          <div className="chart-legend">
            <span className="k"><span className="sw" style={{ background: 'var(--teal)' }} /> LA draw</span>
            <span className="k"><span className="sw" style={{ background: 'var(--gold)' }} /> Discretionary draw</span>
            <span className="k"><span className="sw" style={{ background: 'var(--navy-soft)' }} /> Other income</span>
            <span className="k" style={{ color: 'var(--coral)' }}>
              <span className="sw line" style={{ color: 'var(--coral)' }} /> Target need
            </span>
          </div>
          <div className="seg mini">
            <span className={view === 'income' ? 'on' : ''} onClick={() => setView('income')}>Income</span>
            <span className={view === 'capital' ? 'on' : ''} onClick={() => setView('capital')}>Capital</span>
            <span className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</span>
          </div>
        </div>
        {view === 'income' && (
          <IncomeChart height={300} years={36} startAge={65} depleteAt={94} />
        )}
        {view === 'capital' && (
          <DrawdownChart height={300} years={36} startAge={65} depleteAt={94} capMark={90} />
        )}
        {view === 'table' && (
          <div style={{ padding: 28, color: 'var(--mute)', textAlign: 'center', fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
            Year-by-year table appears here.
          </div>
        )}
        <div style={{ height: 28 }} />
      </div>

      <div className="outcome-strip">
        <div className="outcome-cell primary teal">
          <div className="ocap">Lifestyle sustainable until age</div>
          <div className="oval longev num">
            94 <span className="unit">· 29 years</span>
          </div>
          <div className="osub">youngest spouse · target fully met</div>
        </div>
        <div className="outcome-cell">
          <div className="ocap">Year-1 income need</div>
          <div className="oval num">R 50 000</div>
          <div className="osub">per month · after tax</div>
        </div>
        <div className="outcome-cell">
          <div className="ocap">Funded by</div>
          <div className="oval num" style={{ fontSize: 18, letterSpacing: 0.4 }}>
            LA 66% · Disc 23% · Other 11%
          </div>
          <div className="osub">year-1 income mix</div>
        </div>
      </div>

      {/* Condensed year-1 tax strip */}
      <div className="tax-strip">
        <div className="tax-strip-head">
          <div className="tax-strip-title">
            <span className="rom">vi.</span>Year 1 tax · 2026/27 tables
          </div>
          <div style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
            computed per spouse · before bracket creep
          </div>
        </div>
        <div className="tax-strip-grid">
          <div className="tax-spouse">
            <div className="tax-spouse-name">Marilyn · 65</div>
            <div className="tax-spouse-rows">
              <div><div className="cell-label">Gross income</div><div className="cell-val dim">R 226 000</div></div>
              <div><div className="cell-label">Tax payable</div><div className="cell-val">R 22 400</div></div>
              <div><div className="cell-label">Effective rate</div><div className="cell-val">9.9%</div></div>
            </div>
          </div>
          <div className="tax-strip-divider" />
          <div className="tax-spouse">
            <div className="tax-spouse-name">James · 65</div>
            <div className="tax-spouse-rows">
              <div><div className="cell-label">Gross income</div><div className="cell-val dim">R 226 000</div></div>
              <div><div className="cell-label">Tax payable</div><div className="cell-val">R 22 400</div></div>
              <div><div className="cell-label">Effective rate</div><div className="cell-val">9.9%</div></div>
            </div>
          </div>
        </div>
        <div className="tax-strip-foot">
          <span>Household tax · <span className="num" style={{ fontFamily: 'var(--mono)', color: 'var(--ink)', fontWeight: 500 }}>R 44 800</span> · on gross of R 452 000</span>
          <span className="drawer-link">See full tax breakdown ↓</span>
        </div>
      </div>

      <div className="narrative">
        <div className="narrative-eyebrow">Is this sustainable?</div>
        <div className="narrative-body">
          <p>
            For the first decade the target is met comfortably — <strong>LA draws at 5%</strong> plus a
            modest discretionary top-up and <strong>R 9 000/mo in other income</strong> cover the R 50 000
            target, with room to spare.
          </p>
          <p>
            By <span className="callout warn">age 83 the discretionary pot is exhausted</span> and the
            living annuities must carry almost the full need. From <span className="callout warn">age 90
            the LA draw is pushed against the 17.5% ceiling</span> — any further inflation eats into
            lifestyle rather than capital.
          </p>
          <p>
            If returns fall to 7% instead of 9%, sustainability pulls back to{' '}
            <span className="callout neg">around age 88</span>. Conversely, trimming the target by
            R 3 000/mo or delaying retirement two years extends it well past 100.
          </p>
        </div>
      </div>

      <div className="canvas-foot">
        <span>Illustrative only · 2026/27 SARS tables · auto-top-up on · real terms</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn ghost">Year-by-year table</button>
          <button className="btn">One-page summary ↓</button>
        </div>
      </div>
    </main>
  );
};

Object.assign(window, { DrawdownFilled });
