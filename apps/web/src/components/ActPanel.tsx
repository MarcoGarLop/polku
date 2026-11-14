import { useState } from 'react';
import type { Effort, InterventionScore, Priority } from '@polku/sim';
import { model, useSim } from '../state/sim';
import { useStore } from '../state/store';
import { Conf, d0, Seg, SHORT, Src } from './ui';
import { openPlan } from '../state/plan';

const DEMO_SET = ['public_fast_lane', 'navigator', 'fast_track', 'travel_cost_support', 'min_dataset'];
const EFFORT_R: Record<Effort, number> = { low: 7, medium: 10, high: 13 };
const CONF_COLOR: Record<string, string> = { high: '#34d399', medium: '#60a5fa', low: '#fb923c', assumption: '#fbbf24' };

function Matrix({ rows }: { rows: InterventionScore[] }) {
  const active = useStore((s) => s.interventions);
  const toggle = useStore((s) => s.toggleIntervention);
  const [hover, setHover] = useState<string | null>(null);
  const W = 412;
  const H = 250;
  const P = { l: 34, r: 12, t: 14, b: 32 };
  const pts = rows.filter((r) => r.id !== 'min_dataset');
  const maxX = Math.max(5, ...pts.map((r) => r.daysSaved.mid)) * 1.15;
  const maxY = Math.max(5, ...pts.map((r) => r.gapClosed.mid)) * 1.15;
  const x = (v: number) => P.l + (v / maxX) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v / maxY) * (H - P.t - P.b);
  return (
    <div className="matrix">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <rect x={x(maxX / 2)} y={P.t} width={x(maxX) - x(maxX / 2)} height={y(maxY / 2) - P.t} fill="rgba(45,212,191,0.06)" rx={6} />
        <text x={x(maxX) - 6} y={P.t + 13} fontSize="10" fill="#5eead4" textAnchor="end" fontWeight="700">
          Faster AND fairer
        </text>
        <text x={P.l + 6} y={P.t + 13} fontSize="10" fill="#f0abfc" fontWeight="700">
          Mostly fairer
        </text>
        <text x={x(maxX) - 6} y={H - P.b - 6} fontSize="10" fill="#93c5fd" textAnchor="end" fontWeight="700">
          Mostly faster
        </text>
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="rgba(148,163,184,0.35)" />
        <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} stroke="rgba(148,163,184,0.35)" />
        <text x={(W + P.l) / 2} y={H - 8} fontSize="10.5" fill="#8a9ab5" textAnchor="middle">
          Days saved for the average patient →
        </text>
        <text x={11} y={(H - P.b + P.t) / 2} fontSize="10.5" fill="#8a9ab5" textAnchor="middle" transform={`rotate(-90 11 ${(H - P.b + P.t) / 2})`}>
          Equity gap closed (days) →
        </text>
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={x(maxX * f)} y={H - P.b + 12} fontSize="9" fill="#5b6b86" textAnchor="middle">
            {d0(maxX * f)}
          </text>
        ))}
        {pts.map((r) => {
          const on = active.includes(r.id);
          const cx = x(r.daysSaved.mid);
          const cy = y(r.gapClosed.mid);
          return (
            <g key={r.id} style={{ cursor: 'pointer' }} onClick={() => toggle(r.id)} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}>
              {/* evidence range */}
              <line x1={x(r.daysSaved.low)} x2={x(r.daysSaved.high)} y1={cy} y2={cy} stroke={CONF_COLOR[r.confidence]} strokeOpacity={0.35} strokeWidth={2} />
              <line x1={cx} x2={cx} y1={y(r.gapClosed.low)} y2={y(r.gapClosed.high)} stroke={CONF_COLOR[r.confidence]} strokeOpacity={0.35} strokeWidth={2} />
              <circle cx={cx} cy={cy} r={EFFORT_R[r.effort] + (hover === r.id ? 2 : 0)} fill={on ? CONF_COLOR[r.confidence] : 'rgba(10,16,30,0.9)'} stroke={CONF_COLOR[r.confidence]} strokeWidth={2} />
              <text x={cx} y={cy - EFFORT_R[r.effort] - 4} fontSize="10" fill="#e6edf7" textAnchor="middle" fontWeight={on ? 800 : 600}>
                {SHORT[r.id]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="row tiny muted" style={{ gap: 12, flexWrap: 'wrap' }}>
        <span>Size = effort</span>
        {Object.entries(CONF_COLOR).map(([k, c]) => (
          <span key={k} className="row" style={{ gap: 4 }}>
            <span className="k-dot" style={{ background: c }} />
            {k}
          </span>
        ))}
        <span>Lines = evidence range · click to apply</span>
      </div>
    </div>
  );
}

export function ActPanel() {
  const sim = useSim();
  const active = useStore((s) => s.interventions);
  const toggle = useStore((s) => s.toggleIntervention);
  const priority = useStore((s) => s.priority);
  const budget = useStore((s) => s.budget);
  const set = useStore((s) => s.set);
  const [showAll, setShowAll] = useState(false);
  const region = model.byId.get(sim.focusRegion)!;
  const p = sim.portfolio;
  const list = model.params.interventions.filter((i) => showAll || DEMO_SET.includes(i.id));
  const score = new Map(sim.ranking.map((r) => [r.id, r]));

  return (
    <div className="fade-in">
      <div className="row between">
        <h2>What should {region.nameEn} do first?</h2>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>
        Not everything for everyone, but the same evidence-based criteria for every county. You choose the priority; Polku does the arithmetic.
      </div>
      <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
        <Seg<Priority>
          value={priority}
          onChange={(v) => set({ priority: v })}
          options={[
            { id: 'speed', label: 'Speed for all' },
            { id: 'balanced', label: 'Balanced' },
            { id: 'equity', label: 'Close the gap' },
          ]}
        />
        <Seg<Effort>
          value={budget}
          onChange={(v) => set({ budget: v })}
          options={[
            { id: 'low', label: 'Low effort' },
            { id: 'medium', label: 'Medium' },
            { id: 'high', label: 'High' },
          ]}
        />
      </div>

      <div className="reco">
        <div className="row between">
          <b>Recommended plan</b>
          <span className="tiny muted">
            effort {p.effortUsed}/{p.budget}
          </span>
        </div>
        <ol>
          <li>
            <b>Start measuring</b>: symptom, referral and treatment dates + entry route + education <span className="tag roadmap">Roadmap 3.1.4 · p.58</span>
          </li>
          {p.interventions.map((id) => {
            const iv = model.interventionsById.get(id)!;
            return (
              <li key={id}>
                <b>{SHORT[id]}</b>{' '}
                {iv.roadmapActions.slice(0, 1).map((a) => (
                  <span key={a.id} className="tag roadmap">
                    Roadmap {a.id} · p.{a.page}
                  </span>
                ))}
              </li>
            );
          })}
        </ol>
        <div className="row between" style={{ marginTop: 8 }}>
          <span className="small">
            <b style={{ color: 'var(--good)' }}>−{d0(p.daysSaved)} days</b> average · <b style={{ color: '#f0abfc' }}>−{d0(p.gapClosed)} days</b> equity gap
          </span>
          <button className="btn primary" onClick={() => set({ interventions: [...p.interventions, 'min_dataset'] })}>
            Apply plan
          </button>
        </div>
        <div className="plan-btns">
          <button className="btn" onClick={() => openPlan(region.id, 'en')}>
            Download 1-page plan
          </button>
          <button className="btn" onClick={() => openPlan(region.id, 'fi')}>
            Suomeksi
          </button>
        </div>
      </div>

      <details className="fold">
        <summary>Compare every action: faster for the average vs fairer for the worst-off</summary>
        <Matrix rows={sim.ranking} />
      </details>

      <h3>
        Actions from the national roadmap
        <button className="linkish" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show key 5' : `Show all ${model.params.interventions.length}`}
        </button>
      </h3>
      {list.map((iv) => {
        const on = active.includes(iv.id);
        const s = score.get(iv.id);
        return (
          <div key={iv.id} className={`iv ${on ? 'on' : ''}`}>
            <button className={`sw ${on ? 'on' : ''}`} onClick={() => toggle(iv.id)} aria-label={`Toggle ${iv.label}`} />
            <div>
              <div className="iv-title">{iv.label}</div>
              <div className="iv-meta">
                {iv.roadmapActions.map((a) => (
                  <span key={a.id} className="tag roadmap">
                    Roadmap {a.id} · p.{a.page}
                  </span>
                ))}
                <span className="tag">{iv.effort} effort</span>
                <Conf c={iv.confidence} />
              </div>
              {s && iv.id !== 'min_dataset' && (
                <div className="iv-effect">
                  Alone in {region.nameEn}: <b>−{s.daysSaved.mid.toFixed(1)} d</b> average ({s.daysSaved.low.toFixed(0)}–{s.daysSaved.high.toFixed(0)}) ·{' '}
                  <b>−{s.gapClosed.mid.toFixed(1)} d</b> equity gap
                </div>
              )}
              {iv.id === 'min_dataset' && <div className="iv-effect">Saves no days: narrows uncertainty and turns our estimates into measurements.</div>}
              <details>
                <summary>Evidence</summary>
                {iv.evidence} <Src ids={iv.sourceIds} />
                <div className="faint">{iv.costNote}</div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}
