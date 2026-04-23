/* global React, Field, DrawdownChart, LongevityMeter, Slider, TogglePill, DrawdownPlanInputs */

// ─── State 1 · EMPTY (title-page setup) ─────────────────────
// Title plate → two spouse setup columns (each w/ balances + other income) →
// household needs strip → capital events ledger → CTA to build projection.
const DrawdownEmpty = () => {
  const spouseCol = (rom, label) => (
    <div className="empty-setup-col">
      <div className="empty-step-label"><span className="rom">{rom}</span> {label}</div>
      <div className="empty-name-input">
        <input placeholder="First name" defaultValue="" />
        <span className="empty-age">age <input defaultValue="" placeholder="—" /></span>
      </div>

      <div className="empty-subhead">Retirement capital</div>
      <Field label="LA balance" empty />
      <Field label="Discretionary" empty />
      <Field label="Disc. base cost" empty hint="CGT" />

      <div className="empty-subhead">Other income</div>
      <div className="other-income-row">
        <Field label="DB pension" empty hint="/ month" />
        <Field label="Rental / other" empty hint="/ month" />
      </div>
      <button className="add-btn soft">＋ Add income source</button>
    </div>
  );

  return (
    <main className="canvas canvas-norail canvas-empty">
      <div className="empty-titleplate">
        <div className="empty-eyebrow">Simple Wealth · Retirement drawdown</div>
        <h1 className="empty-title">
          A plan for{' '}
          <span className="empty-family" contentEditable suppressContentEditableWarning>
            the _______ family
          </span>
          , living off{' '}
          <span className="empty-family" contentEditable suppressContentEditableWarning>
            R _______ a month
          </span>
          .
        </h1>
        <div className="empty-date">Prepared 23 April 2026</div>
      </div>

      <div className="empty-setup">
        {spouseCol('I.', 'Spouse A')}
        <div className="empty-setup-divider" />
        {spouseCol('II.', 'Spouse B')}
      </div>

      <div className="empty-needs">
        <div className="empty-needs-cell">
          <div className="empty-needs-label"><span className="empty-rom">III.</span>Monthly household need</div>
          <div className="empty-needs-value">
            <span className="num">R</span>
            <span style={{ color: 'var(--faint)', fontStyle: 'italic' }}>_______</span>
          </div>
          <div className="empty-needs-hint">after tax · today's money</div>
        </div>
        <div className="empty-needs-cell">
          <div className="empty-needs-label"><span className="empty-rom">IV.</span>Annual lump sums</div>
          <div className="empty-needs-value">
            <span className="num">R</span>
            <span style={{ color: 'var(--faint)', fontStyle: 'italic' }}>_______</span>
          </div>
          <div className="empty-needs-hint">holidays, car, home</div>
        </div>
        <div className="empty-needs-cell">
          <div className="empty-needs-label"><span className="empty-rom">V.</span>Market assumptions</div>
          <div className="empty-needs-value">
            <span className="num">9%</span><span className="empty-dot">·</span>
            <span className="num">5%</span>
          </div>
          <div className="empty-needs-hint">return · CPI</div>
        </div>
      </div>

      {/* ─── Family capital events (full-width ledger) ─── */}
      <section className="empty-events">
        <div className="empty-events-head">
          <div className="empty-events-title">
            <span className="empty-rom">VI.</span>Family capital events
          </div>
          <div className="empty-events-hint">one-off inflows and outflows along the timeline</div>
        </div>
        <div className="empty-events-ledger">
          <div className="empty-events-row head">
            <span className="c-when">When</span>
            <span className="c-what">Event</span>
            <span className="c-who">For whom</span>
            <span className="c-amt">Amount</span>
          </div>
          <div className="empty-events-row ghost">
            <span className="c-when">2028</span>
            <span className="c-what">Property sale</span>
            <span className="c-who">Household</span>
            <span className="c-amt pos">+ R _______</span>
          </div>
          <div className="empty-events-row ghost">
            <span className="c-when">2031</span>
            <span className="c-what">Child's wedding</span>
            <span className="c-who">Household</span>
            <span className="c-amt neg">− R _______</span>
          </div>
          <button className="add-btn soft empty-events-add">＋ Add capital event</button>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <div className="empty-cta">
        <div className="empty-cta-text">
          <div className="empty-cta-eyebrow">Ready to see if this lifestyle is sustainable?</div>
          <div className="empty-cta-sub">We'll project year-by-year income and flag the age at which capital can no longer fund the target.</div>
        </div>
        <button className="btn primary large">Build the projection →</button>
      </div>
    </main>
  );
};

Object.assign(window, { DrawdownEmpty });
