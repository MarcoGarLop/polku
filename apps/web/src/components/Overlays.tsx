import { useEffect, useRef, useState } from 'react';
import { useSim } from '../state/sim';
import { useStore } from '../state/store';
import { rgbCss } from '../map/colors';
import type { MetricSpec } from '../map/MapView';
import { d0 } from './ui';
import { LogoMark } from './Logo';

function Brand() {
  return (
    <div className="brand">
      <LogoMark size={34} />
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
  const startRef = useRef<HTMLButtonElement>(null);
  // in video mode the card waits for the opening title (4.2 s) before appearing
  // otherwise it waits for the intro animation, then lets the map fly in first
  const video = new URLSearchParams(location.search).has('video');
  const introDone = useStore((s) => s.introDone);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!introDone) return;
    const t = setTimeout(() => setShow(true), video ? 4200 : 1300);
    return () => clearTimeout(t);
  }, [video, introDone]);
  useEffect(() => {
    if (show) startRef.current?.focus({ preventScroll: true });
  }, [show]);
  const c = sim.comparisonBase;
  if (!show) return null;
  // rounded to the nearest half month (225 days → 7.5, not "8")
  const months = (d: number) => {
    const m = Math.round((d / 30.4) * 2) / 2;
    return Number.isInteger(m) ? String(m) : m.toFixed(1);
  };
  return (
    <div className="welcome" role="dialog" aria-labelledby="welcome-title">
      <div className="welcome-card glass fade-in hook">
        <h1 id="welcome-title">
          <span className="hook-line">Two people get the same lung cancer.</span>
          <span className="hook-line">
            One starts treatment after <span className="hl-a">{months(c.a.totalMeanDays)} months</span>.
          </span>
          <span className="hook-line">
            The other after <span className="hl-b">{months(c.b.totalMeanDays)}</span>.
          </span>
        </h1>
        <p className="welcome-sub">An AI-powered simulator that identifies the gap, locates it in the care pathway and recommends what to do.</p>
        <div className="welcome-btns">
          <button ref={startRef} className="btn primary big" onClick={() => setMode('sim')}>
            Start simulation
          </button>
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
