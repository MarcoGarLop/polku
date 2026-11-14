import type { PhaseId } from '@polku/sim';
import { useSim } from '../state/sim';
import { useStore, type MapMetric } from '../state/store';
import { rgbCss } from '../map/colors';
import type { MetricSpec } from '../map/MapView';
import { d0 } from './ui';

function Brand() {
  return (
    <div className="brand">
      <svg className="brand-mark" viewBox="0 0 32 32">
        <defs>
          <linearGradient id="pg" x1="0" x2="1">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="1" stopColor="#fb7185" />
          </linearGradient>
        </defs>
        <path d="M5 25 C 11 6, 21 6, 27 25" stroke="url(#pg)" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <circle cx="5" cy="25" r="3" fill="#22d3ee" />
        <circle cx="27" cy="25" r="3" fill="#fb7185" />
      </svg>
      <div>
        <div className="brand-name">Polku</div>
        <div className="brand-sub">Equal lung cancer care across Finland</div>
      </div>
    </div>
  );
}

/** Story mode: just the brand and a way into the full tool. */
export function Header() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <>
      <div className="header-left">
        <Brand />
      </div>
      <div className={`header-right ${mode === 'explore' ? 'explore' : ''}`}>
        {mode === 'story' ? (
          <button className="btn ghost" onClick={() => setMode('explore')}>
            Explore all data ⤢
          </button>
        ) : (
          <button className="btn ghost" onClick={() => setMode('story')}>
            ← Back to story
          </button>
        )}
      </div>
    </>
  );
}

/** Explore mode only: what the map shows. */
export function ExploreBar() {
  const metric = useStore((s) => s.metric);
  const phase = useStore((s) => s.phase);
  const lens = useStore((s) => s.lens);
  const showFlows = useStore((s) => s.showFlows);
  const set = useStore((s) => s.set);
  const metrics: { id: MapMetric; label: string; lens?: 'A' | 'B' }[] = [
    { id: 'days', label: 'Days by county' },
    { id: 'gap', label: 'Equity gap' },
    { id: 'patient', label: "Matti B's Finland", lens: 'B' },
    { id: 'patient', label: "Matti A's Finland", lens: 'A' },
  ];
  const phases: { id: PhaseId | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'P1', label: 'Patient' },
    { id: 'P2', label: 'Primary care' },
    { id: 'P3', label: 'Specialist' },
    { id: 'P4', label: 'Diagnostics' },
    { id: 'P5', label: 'Treatment' },
  ];
  return (
    <div className="explore-bar">
      <div className="chipbar glass">
        {metrics.map((m) => {
          const on = metric === m.id && (!m.lens || lens === m.lens);
          return (
            <button key={m.label} className={`chip ${on ? 'on' : ''}`} onClick={() => set({ metric: m.id, ...(m.lens ? { lens: m.lens } : {}) })}>
              {m.label}
            </button>
          );
        })}
      </div>
      {(metric === 'days' || metric === 'patient') && (
        <div className="chipbar glass">
          {phases.map((p) => (
            <button key={p.id} className={`chip small ${phase === p.id ? 'on' : ''}`} onClick={() => set({ phase: p.id })}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="chipbar glass">
        <button className={`chip small toggle-chip ${showFlows ? 'on' : ''}`} onClick={() => set({ showFlows: !showFlows })}>
          Journeys
        </button>
      </div>
    </div>
  );
}

export function Legend({ domain, spec }: { domain: [number, number]; spec: MetricSpec }) {
  const stops = spec.ramp.map((c, i) => `${rgbCss(c)} ${(i / (spec.ramp.length - 1)) * 100}%`).join(',');
  return (
    <div className="legend glass">
      <div className="legend-title">{spec.label}</div>
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${stops})` }} />
      <div className="legend-scale">
        <span>{d0(domain[0])}</span>
        <span className="badge est">Estimate</span>
        <span>{d0(domain[1])}</span>
      </div>
    </div>
  );
}

/** Explore mode: national impact of the active actions. */
export function Counter() {
  const sim = useSim();
  const interventions = useStore((s) => s.interventions);
  const n = sim.national;
  if (!interventions.length) return null;
  return (
    <div className="counter glass fade-in">
      <div className="counter-head">
        <span>{interventions.length} action{interventions.length > 1 ? 's' : ''} · all of Finland</span>
        <span className="badge est">Estimate</span>
      </div>
      <div>
        <div className="c-label">Average patient</div>
        <div className="c-val">
          {d0(n.current)}
          <small>days</small>
        </div>
        <div className="c-delta">−{(n.base - n.current).toFixed(0)} days</div>
      </div>
      <div>
        <div className="c-label">Equity gap</div>
        <div className="c-val" style={{ color: '#f0abfc' }}>
          {d0(n.gapCurrent)}
          <small>days</small>
        </div>
        <div className="c-delta">−{(n.gapBase - n.gapCurrent).toFixed(0)} days</div>
      </div>
      <div>
        <div className="c-label">Within 42 days</div>
        <div className="c-val">
          {Math.round(n.withinCurrent * 100)}
          <small>%</small>
        </div>
        <div className="c-delta">+{Math.round((n.withinCurrent - n.withinBase) * 100)} pp</div>
      </div>
    </div>
  );
}
