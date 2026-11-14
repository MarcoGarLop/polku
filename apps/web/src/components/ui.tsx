import type { ReactNode } from 'react';
import type { Confidence, EducationId, GapFactor, PhaseId, RouteId } from '@polku/sim';
import { SOURCES } from '../state/sources';

export const PHASE_LABEL: Record<PhaseId, string> = {
  P1: 'Patient',
  P2: 'Primary care',
  P3: 'Specialist access',
  P4: 'Diagnostics',
  P5: 'Treatment start',
};
export const PHASE_COLOR: Record<PhaseId, string> = {
  P1: '#f59e0b',
  P2: '#fbbf24',
  P3: '#60a5fa',
  P4: '#818cf8',
  P5: '#a78bfa',
};
export const FACTOR_COLOR: Record<GapFactor, string> = {
  route: '#fb7185',
  distance: '#f59e0b',
  education: '#c084fc',
  navigation: '#38bdf8',
  region: '#94a3b8',
};
export const SHORT: Record<string, string> = {
  fast_track: 'Fast-track pathway',
  econsult: 'e-consultation',
  navigator: 'Nurse navigator',
  direct_ct: 'Direct CT from GP',
  gp_continuity: 'Named GP',
  awareness: 'Awareness campaign',
  remote_care: 'Remote oncology',
  public_fast_lane: 'Public fast lane',
  travel_cost_support: 'Travel support',
  min_dataset: 'Minimum dataset',
};
export const ROUTE_LABEL: Record<RouteId, string> = { public: 'Public primary care', occupational_private: 'Occupational / private' };
export const EDU_LABEL: Record<EducationId, string> = { basic: 'Basic education', secondary: 'Secondary', tertiary: 'Higher education' };

export const d0 = (x: number) => Math.round(x).toLocaleString('en');
export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function Est({ children = 'Estimate' }: { children?: ReactNode }) {
  return <span className="badge est" title="Modelled from public aggregated data and stated assumptions">{children}</span>;
}
export function Real({ children = 'Published data' }: { children?: ReactNode }) {
  return <span className="badge real">{children}</span>;
}
export function Conf({ c }: { c: Confidence }) {
  return <span className={`badge conf-${c}`}>{c === 'assumption' ? 'assumption' : `${c} confidence`}</span>;
}
export function Src({ ids }: { ids: string[] }) {
  return (
    <span className="tiny faint">
      {ids.map((id, i) => (
        <span key={id} title={SOURCES[id]?.label ?? id}>
          {i > 0 && ' · '}
          {SOURCES[id]?.url ? (
            <a href={SOURCES[id].url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
              {id}
            </a>
          ) : (
            id
          )}
        </span>
      ))}
    </span>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Bar({ label, value, max, color, right }: { label: ReactNode; value: number; max: number; color: string; right?: ReactNode }) {
  return (
    <div className="bar-row">
      <div>{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
      </div>
      <div className="bar-val">{right ?? d0(value)}</div>
    </div>
  );
}

/** One plain-English line per action. */
export const ACTION_DESC: Record<string, string> = {
  public_fast_lane: 'Suspected cancer goes straight onto the fast track from the public health centre.',
  navigator: 'A named nurse guides patients who live alone or find the system hard to navigate.',
  travel_cost_support: 'Organised, reimbursed travel for patients far from hospital.',
  awareness: 'A campaign in several languages so symptoms are not ignored.',
  fast_track: 'A standard Nordic-style fast diagnostic pathway.',
  econsult: 'The family doctor asks the lung specialist online instead of waiting for a referral.',
  remote_care: 'Remote cancer appointments, so fewer long trips.',
  gp_continuity: 'The same family doctor every time.',
  direct_ct: 'The family doctor can order a CT scan directly.',
};
