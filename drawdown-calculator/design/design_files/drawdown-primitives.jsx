/* global React */
// Drawdown-calc primitives — chart, field, slider, longevity meter.

// ─── Drawdown chart ────────────────────────────────────────
// Stacked bar of household capital over lifetime, teal=LA + gold=disc.
// Optional withdrawal-rate line overlay, depletion marker, faded mode for baseline card.
const DrawdownChart = ({
  height = 280,
  years = 36,           // age 65 → 100
  startAge = 65,
  depleteAt,            // age at which capital hits zero (optional)
  faded = false,
  showRate = true,
  capMark,              // age where 17.5% LA cap is hit (optional)
  mode = 'single',      // 'single' | 'baseline' (baseline uses lower trajectory)
}) => {
  const data = React.useMemo(() => {
    const out = [];
    const depIdx = depleteAt != null ? (depleteAt - startAge) : years;
    for (let i = 0; i < years; i++) {
      if (i >= depIdx) { out.push({ la: 0, disc: 0, rate: 0.175, depleted: true }); continue; }
      const t = i / (depIdx || 1);
      // capital starts near peak, decays; LA decays faster than disc early, disc runs out mid-horizon.
      const shape = Math.pow(1 - t, 1.25);
      const discShape = Math.max(0, 1 - t * 1.55);   // disc exhausts earlier
      const la   = 80 * shape + 2;
      const disc = 22 * discShape;
      // withdrawal rate creeps up as balance declines
      const rate = 0.05 + t * 0.09 + (disc < 1 ? 0.02 : 0);
      out.push({ la, disc, rate: Math.min(0.175, rate), depleted: false });
    }
    return out;
  }, [years, startAge, depleteAt]);

  const max = Math.max(...data.map(d => d.la + d.disc)) * 1.1;
  const W = 100, H = 100;
  const padT = 4, padB = 0;
  const innerH = H - padT - padB;
  const barW = W / years;
  const gap = barW * 0.18;
  const bw = barW - gap;

  return (
    <div style={{ display: 'flex', height, width: '100%' }}>
      {/* Y axis */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)',
        paddingRight: 8, textAlign: 'right', width: 44, paddingTop: 4, paddingBottom: 4,
      }}>
        {[1, 0.75, 0.5, 0.25, 0].map(p => (
          <span key={p}>R{((max * p) / 10).toFixed(1)}m</span>
        ))}
      </div>

      {/* Plot */}
      <div style={{
        flex: 1, position: 'relative',
        borderLeft: '1px solid var(--hairline)',
        borderBottom: '1px solid var(--hairline)',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {[0.25, 0.5, 0.75].map(p => (
            <line key={p} x1="0" x2={W} y1={padT + innerH * p} y2={padT + innerH * p}
              stroke="var(--hairline)" strokeWidth="0.15" />
          ))}

          {/* Stacked bars */}
          {data.map((d, i) => {
            const x = i * barW + gap / 2;
            const totalH = ((d.la + d.disc) / max) * innerH;
            const laH   = (d.la / max) * innerH;
            const discH = (d.disc / max) * innerH;
            const yTop = padT + innerH - totalH;
            const opacity = faded ? 0.35 : 1;
            if (d.depleted) return null;
            return (
              <g key={i} opacity={opacity}>
                {/* Disc sits on top (gold) of LA (teal) — gold on top reads the disc exhausting */}
                <rect x={x} y={yTop + laH} width={bw} height={discH} fill="var(--gold)" />
                <rect x={x} y={yTop} width={bw} height={laH} fill="var(--teal)" />
              </g>
            );
          })}

          {/* Withdrawal rate overlay (percent, dashed coral) — scale 0-20% → 0 to innerH */}
          {showRate && (
            <polyline
              points={data.map((d, i) => {
                const x = i * barW + barW / 2;
                const r = d.rate / 0.20; // 20% of total as ceiling
                const y = padT + innerH - r * innerH;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="var(--coral)"
              strokeWidth="0.45"
              strokeDasharray="1.4 1.2"
              opacity={faded ? 0.4 : 0.85}
            />
          )}

          {/* LA cap marker (17.5% hit) */}
          {capMark != null && (() => {
            const i = capMark - startAge;
            if (i < 0 || i >= years) return null;
            const x = i * barW + barW / 2;
            return (
              <g opacity={faded ? 0.5 : 1}>
                <line x1={x} x2={x} y1={padT} y2={padT + innerH} stroke="var(--coral)" strokeWidth="0.3" strokeDasharray="0.8 0.8" />
              </g>
            );
          })()}

          {/* Depletion marker (vertical rule + "depleted at" label position) */}
          {depleteAt != null && (() => {
            const i = depleteAt - startAge;
            if (i < 0 || i >= years) return null;
            const x = i * barW;
            return (
              <g opacity={faded ? 0.5 : 1}>
                <rect x={x} y={padT} width={W - x} height={innerH} fill="var(--coral-pale)" opacity="0.35" />
                <line x1={x} x2={x} y1={padT} y2={padT + innerH} stroke="var(--coral)" strokeWidth="0.4" />
              </g>
            );
          })()}
        </svg>

        {/* Depletion age label */}
        {depleteAt != null && (() => {
          const i = depleteAt - startAge;
          if (i < 0 || i >= years) return null;
          const pct = (i / years) * 100;
          return (
            <div style={{
              position: 'absolute',
              left: `${pct}%`,
              top: 4,
              transform: 'translateX(4px)',
              fontSize: 10,
              color: 'var(--coral)',
              fontFamily: 'var(--sans)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              letterSpacing: 0.3,
              opacity: faded ? 0.6 : 1,
            }}>depletes · age {depleteAt}</div>
          );
        })()}

        {/* Right-hand rate axis */}
        {showRate && !faded && (
          <div style={{
            position: 'absolute', right: -30, top: 4, bottom: 4,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--coral)',
          }}>
            <span>20%</span>
            <span>15%</span>
            <span>10%</span>
            <span>5%</span>
            <span>0%</span>
          </div>
        )}

        {/* X axis */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: -20,
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)',
        }}>
          {[0, 5, 10, 15, 20, 25, 30, 35].filter(y => y < years).map(y => (
            <span key={y}>age {startAge + y}</span>
          ))}
        </div>
      </div>

      {showRate && !faded && <div style={{ width: 30 }} />}
    </div>
  );
};

// Field — label + pill input. Same shape as projection calc.
const Field = ({ label, prefix = 'R', value, empty = false, hint, placeholder = '—' }) => (
  <div className="field">
    <div className="field-label">
      <span>{label}</span>
      {hint && <span className="muted">{hint}</span>}
    </div>
    <div className={`field-input ${empty ? 'empty' : ''}`}>
      {prefix && <span className="pfx">{prefix}</span>}
      <input defaultValue={value} placeholder={empty ? placeholder : ''} />
    </div>
  </div>
);

const Slider = ({ label, value, fill = 0.5, delta }) => (
  <div className="slider">
    <div className="slider-head">
      <span className="slider-label">{label}</span>
      <span className="slider-value">
        {value}
        {delta && <span className={`delta ${delta.startsWith('-') ? 'neg' : ''}`}>{delta}</span>}
      </span>
    </div>
    <div className="slider-rail" style={{ '--fill': `${fill * 100}%` }}>
      <div className="slider-thumb" />
    </div>
  </div>
);

// Longevity meter — hero-adjacent timeline showing today → capital depletion → age 100.
const LongevityMeter = ({ fromAge = 65, toAge = 100, depleteAt = 94, label }) => {
  const pct = ((depleteAt - fromAge) / (toAge - fromAge)) * 100;
  return (
    <div className="longevity">
      <div className="longevity-head">
        <span className="longevity-eyebrow">Capital longevity</span>
        <span className="longevity-key">{label || `lasts until the youngest is ${depleteAt}`}</span>
      </div>
      <div className="longevity-rail">
        <div className="longevity-track" />
        <div className="longevity-fill" style={{ width: `${pct}%` }} />
        <div
          className="longevity-depleted"
          style={{ left: `${pct}%`, width: `${100 - pct}%` }}
        />
        <div className="longevity-mark now" style={{ left: 0 }} />
        <span className="longevity-mark-label" style={{ left: 0, transform: 'translateX(0)' }}>age {fromAge} · today</span>

        <div className="longevity-mark" style={{ left: `${pct}%` }} />
        <span className="longevity-mark-label end" style={{ left: `${pct}%` }}>age {depleteAt}</span>

        <span className="longevity-mark-label" style={{ left: '100%', transform: 'translateX(-100%)' }}>age {toAge}</span>
      </div>
    </div>
  );
};

// Toggle pill (Auto-top-up, Real/Nominal)
const TogglePill = ({ on, label, onToggle }) => (
  <button className={`toggle-pill ${on ? 'on' : ''}`} onClick={onToggle} type="button">
    <span className="sw" />
    <span className="toggle-pill-label">{label}</span>
  </button>
);

// ─── Income chart ───────────────────────────────────────────
// Stacked annual income sources (LA draw + Disc draw + Other pension/rental)
// plotted against the target need line. Coral shade where household falls short.
const IncomeChart = ({
  height = 280,
  years = 36,
  startAge = 65,
  depleteAt = 94,
  shortfallFrom,     // age at which sources + capital can't meet need
  faded = false,
  need = 50,         // relative target income per year (arbitrary units)
}) => {
  const data = React.useMemo(() => {
    const out = [];
    const depIdx = depleteAt - startAge;
    const shortIdx = shortfallFrom != null ? (shortfallFrom - startAge) : depIdx;
    for (let i = 0; i < years; i++) {
      const t = i / (depIdx || 1);
      if (i >= depIdx) {
        // post-depletion — only 'other' persists (DB pension)
        out.push({ la: 0, disc: 0, other: 9, need, depleted: true });
        continue;
      }
      // Other retirement income (DB pension etc) stays roughly flat in real terms
      const other = 9 + 0.4 * Math.sin(i / 3);
      // Discretionary draw: high early, decays to zero by ~mid horizon
      const discShape = Math.max(0, 1 - t * 1.6);
      const disc = 14 * discShape;
      // LA draw: fills the gap — ramps up as disc exhausts, then pushes toward ceiling
      const laBase = need - other - disc;
      const la = Math.max(0, laBase + (t > 0.7 ? (t - 0.7) * 6 : 0));
      out.push({ la, disc, other, need, depleted: false });
    }
    return out;
  }, [years, startAge, depleteAt, shortfallFrom, need]);

  const max = need * 1.35;
  const W = 100, H = 100;
  const padT = 4;
  const innerH = H - padT;
  const barW = W / years;
  const gap = barW * 0.18;
  const bw = barW - gap;

  const needY = padT + innerH - (need / max) * innerH;

  return (
    <div style={{ display: 'flex', height, width: '100%' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)',
        paddingRight: 8, textAlign: 'right', width: 52, paddingTop: 4, paddingBottom: 4,
      }}>
        {[1, 0.75, 0.5, 0.25, 0].map(p => (
          <span key={p}>R{((max * p) * 1.2).toFixed(0)}k</span>
        ))}
      </div>

      <div style={{
        flex: 1, position: 'relative',
        borderLeft: '1px solid var(--hairline)',
        borderBottom: '1px solid var(--hairline)',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
             style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {[0.25, 0.5, 0.75].map(p => (
            <line key={p} x1="0" x2={W} y1={padT + innerH * p} y2={padT + innerH * p}
              stroke="var(--hairline)" strokeWidth="0.15" />
          ))}

          {/* Stacked income bars — other (navy) + disc (gold) + LA (teal) */}
          {data.map((d, i) => {
            const x = i * barW + gap / 2;
            const total = d.la + d.disc + d.other;
            const totalH = (total / max) * innerH;
            const otherH = (d.other / max) * innerH;
            const discH = (d.disc / max) * innerH;
            const laH = (d.la / max) * innerH;
            const yTop = padT + innerH - totalH;
            const opacity = faded ? 0.35 : 1;
            const short = total < d.need - 0.3;
            return (
              <g key={i} opacity={opacity}>
                <rect x={x} y={yTop} width={bw} height={laH} fill="var(--teal)" />
                <rect x={x} y={yTop + laH} width={bw} height={discH} fill="var(--gold)" />
                <rect x={x} y={yTop + laH + discH} width={bw} height={otherH} fill="var(--navy-soft)" />
                {short && !d.depleted && (
                  <rect x={x} y={padT + innerH - (d.need / max) * innerH}
                        width={bw} height={(d.need / max) * innerH - totalH}
                        fill="var(--coral)" opacity="0.25" />
                )}
              </g>
            );
          })}

          {/* Target need line */}
          <line x1="0" x2={W} y1={needY} y2={needY}
            stroke="var(--coral)" strokeWidth="0.35"
            strokeDasharray="1.2 1.0"
            opacity={faded ? 0.5 : 0.9} />

          {/* Shortfall rule */}
          {shortfallFrom != null && (() => {
            const i = shortfallFrom - startAge;
            if (i < 0 || i >= years) return null;
            const x = i * barW;
            return (
              <g opacity={faded ? 0.5 : 1}>
                <line x1={x} x2={x} y1={padT} y2={padT + innerH}
                  stroke="var(--coral)" strokeWidth="0.35"
                  strokeDasharray="0.8 0.8" />
              </g>
            );
          })()}
        </svg>

        {/* Need line label */}
        <div style={{
          position: 'absolute', right: 6,
          top: `${(needY / H) * 100}%`,
          transform: 'translateY(-130%)',
          fontSize: 10, color: 'var(--coral)',
          fontFamily: 'var(--sans)', fontWeight: 500,
          letterSpacing: 0.2,
          opacity: faded ? 0.6 : 1,
        }}>
          target · R {(need * 1.2).toFixed(0)}k / yr
        </div>

        {/* Shortfall label */}
        {shortfallFrom != null && (() => {
          const i = shortfallFrom - startAge;
          if (i < 0 || i >= years) return null;
          const pct = (i / years) * 100;
          return (
            <div style={{
              position: 'absolute',
              left: `${pct}%`, top: 4,
              transform: 'translateX(4px)',
              fontSize: 10, color: 'var(--coral)',
              fontFamily: 'var(--sans)', fontWeight: 500,
              whiteSpace: 'nowrap',
              opacity: faded ? 0.6 : 1,
            }}>shortfall begins · age {shortfallFrom}</div>
          );
        })()}

        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: -20,
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)',
        }}>
          {[0, 5, 10, 15, 20, 25, 30, 35].filter(y => y < years).map(y => (
            <span key={y}>age {startAge + y}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { DrawdownChart, IncomeChart, Field, Slider, LongevityMeter, TogglePill });
