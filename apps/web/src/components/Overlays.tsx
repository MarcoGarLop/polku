import { useEffect, useRef } from 'react';
import { useSim } from '../state/sim';
import { useStore } from '../state/store';
import { rgbCss } from '../map/colors';
import type { MetricSpec } from '../map/MapView';
import { d0 } from './ui';

function Brand() {
  return (
    <div className="brand">
      <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
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

export function Header() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const set = useStore((s) => s.set);
  return (
    <header className="header">
      <button className="brand-btn" onClick={() => setMode('welcome')} aria-label="Polku, back to start">
        <Brand />
      </button>
      {mode !== 'welcome' && (
        <nav className="mode-switch glass" aria-label="Mode">
          <button className={mode === 'tour' ? 'on' : ''} aria-pressed={mode === 'tour'} onClick={() => setMode('tour')}>
            Guided tour
          </button>
          <button className={mode === 'sim' ? 'on' : ''} aria-pressed={mode === 'sim'} onClick={() => setMode('sim')}>
            Simulator
          </button>
        </nav>
      )}
      <div className="header-actions">
        {mode !== 'welcome' && (
          <button className="btn ghost" onClick={() => set({ askOpen: true })}>
            Ask the AI
          </button>
        )}
        <button className="btn ghost" onClick={() => set({ showAssumptions: true })}>
          Sources
        </button>
      </div>
    </header>
  );
}

export function Welcome() {
  const sim = useSim();
  const setMode = useStore((s) => s.setMode);
  const goStep = useStore((s) => s.goStep);
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => startRef.current?.focus(), []);
  const c = sim.comparisonBase;
  const months = (d: number) => Math.round(d / 30);
  return (
    <div className="welcome" role="dialog" aria-labelledby="welcome-title">
      <div className="welcome-card glass fade-in">
        <div className="eyebrow">Lung cancer in Finland</div>
        <h1 id="welcome-title">
          Two people get the same lung cancer.
          <br />
          One starts treatment after <span className="hl-a">{months(c.a.totalMeanDays)} months</span>. The other after <span className="hl-b">{months(c.b.totalMeanDays)}</span>.
        </h1>
        <p className="welcome-sub">Polku is an AI analyst. It reads Finland's national cancer strategy and public health data, estimates what each action would change, simulates it for every region, and recommends what to do first.</p>
        <div className="welcome-btns">
          <button ref={startRef} className="btn primary big" onClick={() => goStep(0)}>
            ▶ Start the guided tour <span className="muted-on-primary">· 7 short steps</span>
          </button>
          <button className="btn big" onClick={() => setMode('sim')}>
            Open the simulator
          </button>
        </div>
        <div className="welcome-foot">
          Built for AstraZeneca's “Equal Care Across Finland” challenge · Public aggregated data only · Every number has a source · Not a medical device
        </div>
      </div>
    </div>
  );
}

export function Legend({ domain, spec }: { domain: [number, number]; spec: MetricSpec }) {
  const stops = spec.ramp.map((c, i) => `${rgbCss(c)} ${(i / (spec.ramp.length - 1)) * 100}%`).join(',');
  return (
    <div className="legend glass" aria-label={`Map legend: ${spec.label}, from ${d0(domain[0])} to ${d0(domain[1])} days`}>
      <div className="legend-title">{spec.label}</div>
      <div className="legend-bar" style={{ background: `linear-gradient(90deg, ${stops})` }} />
      <div className="legend-scale">
        <span>
          {d0(domain[0])} d <em>faster</em>
        </span>
        <span>
          <em>slower</em> {d0(domain[1])} d
        </span>
      </div>
    </div>
  );
}

/** Accessible alternative to the 3D map. */
export function RegionTable() {
  const sim = useSim();
  const show = useStore((s) => s.showTable);
  const set = useStore((s) => s.set);
  if (!show) return null;
  const rows = [...sim.current].sort((a, b) => b.totalMeanDays - a.totalMeanDays);
  return (
    <div className="modal-back" onClick={() => set({ showTable: false })}>
      <div className="modal glass" role="dialog" aria-labelledby="table-title" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 id="table-title" style={{ margin: 0 }}>
            All wellbeing services counties
          </h2>
          <button className="btn" onClick={() => set({ showTable: false })}>
            Close
          </button>
        </div>
        <p className="small muted">Estimated days from first symptom to treatment for the average lung cancer patient, slowest first. Estimates from public data.</p>
        <table>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">Days to treatment</th>
              <th scope="col">Difference between best- and worst-placed patient</th>
              <th scope="col">Lung cancer cases per year</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.regionId}>
                <th scope="row">{r.nameEn}</th>
                <td>{d0(r.totalMeanDays)}</td>
                <td>{d0(r.equityGapDays)}</td>
                <td>~{d0(r.annualCases)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
