/* global React, Field, Slider, DrawdownChart, LongevityMeter, TogglePill */

// ─── Shared: Plan inputs top bar (drawdown-flavoured) ───────────
// Same pattern as projection calc — collapsible drawer with household / needs / assumptions.
// Drawdown twist: adds an Auto-top-up indicator in the facts row.
const DrawdownPlanInputs = ({ empty = false, editing = false, autoTopUp = true, showEvents = false }) => {
  const [open, setOpen] = React.useState(editing);
  return (
    <div className={`plan-bar ${open ? 'open' : ''} ${empty ? 'empty' : ''}`}>
      <div className="plan-bar-row">
        <div className="plan-bar-logo">
          <span className="logo-mark">SW</span>
          <div>
            <div className="plan-bar-brand">Simple Wealth</div>
            <div className="plan-bar-for">
              {empty
                ? <span style={{ color: 'var(--mute)', fontStyle: 'italic' }}>Client name</span>
                : <span>M. &amp; J. Pillay</span>}
            </div>
          </div>
        </div>

        <div className="plan-bar-facts">
          <div className="fact">
            <span className="fact-label">Household</span>
            <span className="fact-val">{empty ? '— / —' : '2 spouses · age 65'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Household capital</span>
            <span className="fact-val num">{empty ? 'R —' : 'R 10.0m'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Monthly need · after tax</span>
            <span className="fact-val num">{empty ? 'R —' : 'R 50 000'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">LA draw · A · B</span>
            <span className="fact-val num">{empty ? '—' : '5.00% · 5.00%'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Return · CPI</span>
            <span className="fact-val num">
              9% · 5%
              {autoTopUp && !empty && <span className="tag-auto">Auto-top-up</span>}
            </span>
          </div>
        </div>

        <button className="btn ghost plan-bar-edit" onClick={() => setOpen(v => !v)}>
          {open ? 'Close ↑' : 'Edit plan ↓'}
        </button>
      </div>

      {open && (
        <div className="plan-bar-drawer">
          <div className="plan-drawer-col">
            <div className="plan-drawer-head">
              <span className="rom">I.</span> Household
              <span className="plan-drawer-meta">
                <span className={`dot ${empty ? 'incomplete' : ''}`} />
                {empty ? '0 / 2' : '2 / 2'}
              </span>
            </div>
            <div className="spouse-mini">
              <div className="spouse-mini-name">Marilyn <span>age {empty ? '—' : '65'}</span></div>
              <Field label="Living annuity balance" value={empty ? '' : '4 000 000'} empty={empty} />
              <Field label="Discretionary balance" value={empty ? '' : '1 000 000'} empty={empty} />
              <Field label="Discretionary base cost" value={empty ? '' : '500 000'} empty={empty} hint="for CGT" />
            </div>
            <div className="spouse-mini">
              <div className="spouse-mini-name">James <span>age {empty ? '—' : '65'}</span></div>
              <Field label="Living annuity balance" value={empty ? '' : '4 000 000'} empty={empty} />
              <Field label="Discretionary balance" value={empty ? '' : '1 000 000'} empty={empty} />
              <Field label="Discretionary base cost" value={empty ? '' : '500 000'} empty={empty} hint="for CGT" />
            </div>
          </div>

          <div className="plan-drawer-col">
            <div className="plan-drawer-head">
              <span className="rom">II.</span> Household needs
              <span className="plan-drawer-meta">
                <span className={`dot ${empty ? 'incomplete' : ''}`} />
                {empty ? '—' : 'R 700 000 / yr'}
              </span>
            </div>
            <Field label="Monthly after-tax expenses" value={empty ? '' : '50 000'} empty={empty} />
            <Field label="Annual lump sums" value={empty ? '' : '100 000'} empty={empty} hint="holidays, replacements" />
            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--paper-3)', borderRadius: 6, fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>Auto-top-up {autoTopUp ? 'on' : 'off'}.</strong>
              {' '}Shortfall is drawn from discretionary first, then pushed into the LA up to 17.5%.
            </div>

            {showEvents && (
              <>
                <div className="plan-drawer-head" style={{ marginTop: 20 }}>
                  <span className="rom">IV.</span> Capital events + income
                  <span className="plan-drawer-meta">2 entries</span>
                </div>
                <div className="ledger-row"><span className="lbl">Property sale · 2028</span><span className="amt">+ R 2.5m</span></div>
                <div className="ledger-row"><span className="lbl">DB pension · Marilyn</span><span className="amt">R 6 500/mo</span></div>
                <button className="add-btn" style={{ marginTop: 10 }}>＋ Add an event</button>
              </>
            )}
          </div>

          <div className="plan-drawer-col">
            <div className="plan-drawer-head">
              <span className="rom">III.</span> Market assumptions
              <span className="plan-drawer-meta"><span className="dot" /> defaults</span>
            </div>
            <Slider label="Expected return (nominal)" value="9.00%" fill={0.45} />
            <Slider label="Inflation (CPI)" value="5.00%" fill={0.37} />
            <div className="plan-drawer-head" style={{ marginTop: 18 }}>
              <span className="rom">V.</span> Horizon
              <span className="plan-drawer-meta">age 100</span>
            </div>
            <div className="anchor">
              <div className="anchor-age">
                <span>Project until the</span>
                <div className="seg"><span className="on">youngest</span><span>oldest</span></div>
                <span>reaches</span>
                <input defaultValue="100" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { DrawdownPlanInputs });
