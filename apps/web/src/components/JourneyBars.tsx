import type { ProfileResult } from '@polku/sim';
import { d0 } from './ui';

/** Three plain-language stretches of the pathway (the 8 AZ steps grouped so anyone can read them). */
const STRETCHES = [
  { key: 'before', label: 'Before seeing a doctor', color: '#f59e0b', phases: [0] },
  { key: 'primary', label: 'In primary care', color: '#fbbf24', phases: [1] },
  { key: 'hospital', label: 'In hospital', color: '#60a5fa', phases: [2, 3, 4] },
] as const;

const days = (r: ProfileResult, phases: readonly number[]) => phases.reduce((s, i) => s + r.phases[i].meanDays, 0);

function Bar({ name, color, r, max }: { name: string; color: string; r: ProfileResult; max: number }) {
  return (
    <div className="jb-row">
      <div className="jb-name" style={{ color }}>
        {name}
        <span>{d0(r.totalMeanDays)} days</span>
      </div>
      <div className="jb-track" role="img" aria-label={`${name}: ${STRETCHES.map((s) => `${s.label} ${d0(days(r, s.phases))} days`).join(', ')}`}>
        {STRETCHES.map((s) => {
          const v = days(r, s.phases);
          const w = (v / max) * 100;
          return (
            <div key={s.key} className="jb-seg" style={{ width: `${w}%`, background: s.color }} title={`${s.label}: ${d0(v)} days`}>
              {w > 9 ? d0(v) : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Two patients' journeys as two big stacked bars, plus where patient B's extra days pile up. */
export function JourneyBars({ a, b }: { a: ProfileResult; b: ProfileResult }) {
  const max = Math.max(a.totalMeanDays, b.totalMeanDays);
  return (
    <div className="jb">
      <Bar name="Patient A" color="var(--a)" r={a} max={max} />
      <Bar name="Patient B" color="var(--b)" r={b} max={max} />
      <div className="jb-legend">
        {STRETCHES.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="jb-extra-title">Patient B's extra days</div>
      <div className="jb-extra">
        {STRETCHES.map((s) => {
          const extra = days(b, s.phases) - days(a, s.phases);
          return (
            <div key={s.key} style={{ borderColor: s.color }}>
              <b style={{ color: s.color }}>+{d0(extra)}</b>
              <span>{s.label.toLowerCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
