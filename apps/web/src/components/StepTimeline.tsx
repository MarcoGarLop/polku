import type { ProfileResult } from '@polku/sim';

const W = 412;
const LANE_H = 16;
const PAD_L = 22;
const PAD_R = 40;

/** Two patients' journeys across AstraZeneca's 8-step pathway (slide 10), on one day axis. */
export function StepTimeline({ a, b, compact = false }: { a: ProfileResult; b: ProfileResult; compact?: boolean }) {
  const max = Math.max(a.totalMeanDays, b.totalMeanDays) * 1.04;
  const x = (d: number) => PAD_L + (d / max) * (W - PAD_L - PAD_R);
  const lanes = [
    { r: a, y: 30, color: '#22d3ee', id: 'A' },
    { r: b, y: 78, color: '#fb7185', id: 'B' },
  ];
  const ticks = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270].filter((t) => t <= max);
  return (
    <div className="timeline">
      <svg viewBox={`0 0 ${W} 128`} role="img" aria-label="Two patient journeys over the 8-step pathway">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={14} y2={104} stroke="rgba(148,163,184,0.12)" />
            <text x={x(t)} y={118} fontSize="9.5" fill="#5b6b86" textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        <text x={W - PAD_R + 4} y={118} fontSize="9.5" fill="#5b6b86">
          days
        </text>
        {lanes.map(({ r, y, color, id }) => {
          const pts = r.steps.filter((s) => s.cumulativeDays != null) as { step: number; kind: string; cumulativeDays: number; label: string }[];
          return (
            <g key={id}>
              <text x={4} y={y + 4} fontSize="11" fontWeight="800" fill={color}>
                {id}
              </text>
              {pts.slice(1).map((p, i) => {
                const prev = pts[i];
                const patient = p.step <= 3;
                const x0 = x(prev.cumulativeDays) + 1;
                const x1 = Math.max(x0 + 1, x(p.cumulativeDays) - 1);
                return (
                  <rect key={p.step} x={x0} y={y - LANE_H / 2} width={x1 - x0} height={LANE_H} rx={4} fill={patient ? '#f59e0b' : '#60a5fa'} opacity={0.88}>
                    <title>
                      {prev.label} → {p.label}: {Math.round(p.cumulativeDays - prev.cumulativeDays)} days ({patient ? 'patient-related' : 'system-related'} delay)
                    </title>
                  </rect>
                );
              })}
              {pts.map((p) => (
                <g key={`s${p.step}`}>
                  <circle cx={x(p.cumulativeDays)} cy={y} r={6.5} fill="#050912" stroke={color} strokeWidth={1.6} />
                  <text x={x(p.cumulativeDays)} y={y + 3.2} fontSize="8.5" fontWeight="800" fill="#e6edf7" textAnchor="middle">
                    {p.step}
                  </text>
                </g>
              ))}
              <text x={x(r.totalMeanDays) + 10} y={y + 4} fontSize="12" fontWeight="800" fill={color}>
                {Math.round(r.totalMeanDays)}
              </text>
            </g>
          );
        })}
        {b.totalMeanDays > a.totalMeanDays + 1 && (
          <g>
            <line x1={x(a.totalMeanDays)} x2={x(b.totalMeanDays)} y1={54} y2={54} stroke="#fb7185" strokeDasharray="3 3" />
            <line x1={x(a.totalMeanDays)} x2={x(a.totalMeanDays)} y1={38} y2={58} stroke="#fb7185" strokeDasharray="2 2" />
            <text x={(x(a.totalMeanDays) + x(b.totalMeanDays)) / 2} y={50} fontSize="10.5" fontWeight="800" fill="#fda4af" textAnchor="middle">
              +{Math.round(b.totalMeanDays - a.totalMeanDays)} days
            </text>
          </g>
        )}
      </svg>
      <div className="row tiny muted" style={{ gap: 14, marginTop: 2 }}>
        <span className="row" style={{ gap: 5 }}>
          <span className="k-dot" style={{ background: '#f59e0b' }} /> Patient-related delay
        </span>
        <span className="row" style={{ gap: 5 }}>
          <span className="k-dot" style={{ background: '#60a5fa' }} /> System-related delay
        </span>
        {!compact && <span className="faint">8 steps: AstraZeneca briefing, slide 10</span>}
      </div>
      {!compact && (
        <div className="steps-legend">
          {a.steps.map((s) => (
            <div key={s.step}>
              <b>{s.step}</b>
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
