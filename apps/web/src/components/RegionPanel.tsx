import { useMemo } from 'react';
import { findLeftBehind, PHASES } from '@polku/sim';
import { rawIndicators } from '@polku/sim/data';
import { model, useSim } from '../state/sim';
import { useStore } from '../state/store';
import { Bar, Conf, d0, EDU_LABEL, Est, PHASE_COLOR, PHASE_LABEL, Real, Src } from './ui';

const DRIVER_LABEL: Record<string, { label: string; src: string }> = {
  pc_access: { label: 'GP waiting times', src: 'S11' },
  spec_wait: { label: 'Specialist waiting lists', src: 'S11' },
  dist_central: { label: 'Distance to central hospital', src: 'S12' },
  dist_rt: { label: 'Distance to radiotherapy', src: 'S12' },
  ses: { label: 'Education level', src: 'S13' },
};

export function RegionPanel() {
  const sim = useSim();
  const selected = useStore((s) => s.selectedRegion);
  const selectRegion = useStore((s) => s.selectRegion);
  const set = useStore((s) => s.set);
  const interventions = useStore((s) => s.interventions);
  const id = selected ?? sim.focusRegion;
  const r = sim.byId.get(id)!;
  const r0 = sim.baseById.get(id)!;
  const raw = (rawIndicators as any).raw?.[id];
  const left = useMemo(() => findLeftBehind(model, id, interventions, 3), [id, interventions]);
  const ranked = [...sim.current].sort((a, b) => b.totalMeanDays - a.totalMeanDays);
  const rank = ranked.findIndex((x) => x.regionId === id) + 1;
  const comps = model.params.comparators;
  const maxBar = Math.max(r.totalMeanDays, sim.national.current, 160);

  return (
    <div className="fade-in">
      <div className="row between">
        <div>
          <h2>{r.nameEn}</h2>
          <div className="small muted">
            {d0(r.population)} people · ~{d0(r.annualCases)} lung cancer cases a year · #{rank} slowest of 22
          </div>
        </div>
        {selected && (
          <button className="btn" onClick={() => selectRegion(null)}>
            All Finland
          </button>
        )}
      </div>

      <div className="kpis" style={{ marginTop: 12 }}>
        <div className="kpi">
          <div className="k">Symptom → treatment</div>
          <div className="v">
            {d0(r.totalMeanDays)} <small>days</small>
          </div>
          <div className="tiny faint">
            P10–P90: {d0(r.distribution.p10)}–{d0(r.distribution.p90)}
          </div>
        </div>
        <div className="kpi">
          <div className="k">Equity gap</div>
          <div className="v" style={{ color: '#f0abfc' }}>
            {d0(r.equityGapDays)} <small>days</small>
          </div>
          <div className="tiny faint">most vs least advantaged</div>
        </div>
        <div className="kpi">
          <div className="k">Patient-days lost</div>
          <div className="v">{d0(r.patientDaysLostPerYear)}</div>
          <div className="tiny faint">per year vs Finland avg</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <Est />
        <Conf c={r.confidence} />
        {r0.totalMeanDays - r.totalMeanDays > 0.5 && <span className="badge real">−{d0(r0.totalMeanDays - r.totalMeanDays)} days with actions</span>}
      </div>

      <h3>Compared with the Nordics</h3>
      <Bar label={<span className="small"><b>{r.nameEn}</b></span>} value={r.totalMeanDays} max={maxBar} color="#fb7185" />
      <Bar label={<span className="small">Finland (average)</span>} value={sim.national.current} max={maxBar} color="#94a3b8" />
      <Bar label={<span className="small">Sweden</span>} value={comps.sweden.value} max={maxBar} color="#60a5fa" />
      <Bar label={<span className="small">Denmark</span>} value={comps.denmark.value} max={maxBar} color="#2dd4bf" />
      <div className="tiny faint">National totals are preliminary (Kuittinen study, Yle MOT 2025) <Src ids={['S01']} />.</div>

      <h3>Where the days go</h3>
      <div className="stack">
        {r.phases.map((p) => (
          <div key={p.phase} style={{ flexGrow: p.meanDays, background: PHASE_COLOR[p.phase] }} title={`${PHASE_LABEL[p.phase]}: ${d0(p.meanDays)} days`}>
            {d0(p.meanDays)}
          </div>
        ))}
      </div>
      <div className="row tiny muted" style={{ flexWrap: 'wrap', gap: 10 }}>
        {PHASES.map((p) => (
          <span key={p} className="row" style={{ gap: 4 }}>
            <span className="k-dot" style={{ background: PHASE_COLOR[p] }} />
            {PHASE_LABEL[p]}
          </span>
        ))}
      </div>
      <div className="tiny faint" style={{ marginTop: 4 }}>
        {d0(r.phases.reduce((s, p) => s + p.distanceDays, 0))} days of this are attributable to distance. National phase means <Src ids={['S01', 'S04', 'S05']} />.
      </div>

      <h3>What drives the difference</h3>
      {r.drivers.length === 0 && <div className="small muted">No regional indicators available.</div>}
      {r.drivers.map((d) => (
        <div key={d.driver} className="row between small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
          <span>
            {DRIVER_LABEL[d.driver]?.label ?? d.driver} <Src ids={[DRIVER_LABEL[d.driver]?.src ?? '']} />
          </span>
          <b style={{ color: d.extraDays > 0.5 ? '#fb923c' : d.extraDays < -0.5 ? 'var(--good)' : 'var(--muted)' }}>
            {d.extraDays >= 0 ? '+' : '−'}
            {Math.abs(d.extraDays).toFixed(1)} d
          </b>
        </div>
      ))}

      <h3>
        Who is left behind here <span className="badge est">Synthetic profiles</span>
      </h3>
      {left.map((row, i) => (
        <div key={i} className="lb-row">
          <div>
            <b>
              {row.profile.route === 'public' ? 'Public route' : 'Occupational/private'} · {EDU_LABEL[row.profile.education]}
              {row.profile.navigationBarrier ? ' · lives alone / 75+' : ''}
            </b>
            <div className="tiny muted">
              {row.distanceBand} ({d0(row.profile.distanceKm)} km) · ~{row.patientsPerYear.toFixed(1)} patients/yr · biggest lever:{' '}
              {row.topFactors[0]?.label.toLowerCase() ?? '—'}
            </div>
          </div>
          <div className="d">
            {d0(row.totalMeanDays)} d<div className="tiny faint">+{d0(row.extraDaysVsBest)} vs best</div>
          </div>
        </div>
      ))}
      <div className="btn-row">
        <button className="btn primary" onClick={() => set({ tab: 'act' })}>
          What should {r.nameEn} do first? →
        </button>
      </div>

      {raw && (
        <>
          <h3>
            Public data behind this county <Real />
          </h3>
          <div className="small" style={{ lineHeight: 1.7 }}>
            {raw.gpWaitOver7dPct && (
              <div>
                GP non-urgent visits waiting &gt;7 days: <b>{raw.gpWaitOver7dPct.value}%</b> ({raw.gpWaitOver7dPct.year}) <Src ids={['S11']} />
              </div>
            )}
            {raw.specialistOver6mPer10k ? (
              <div>
                Waited &gt;6 months for specialist care: <b>{raw.specialistOver6mPer10k.value}</b> per 10 000 ({raw.specialistOver6mPer10k.year}) <Src ids={['S11']} />
              </div>
            ) : (
              <div className="muted">Specialist waiting data: not reported for this county (lower confidence)</div>
            )}
            {raw.tertiaryEduPct && (
              <div>
                Higher education (20+): <b>{raw.tertiaryEduPct.value}%</b> ({raw.tertiaryEduPct.year}) <Src ids={['S13']} />
              </div>
            )}
            <div>
              Aged 65+: <b>{raw.pct65}%</b> · foreign-language speakers: <b>{raw.foreignPct}%</b> <Src ids={['S12']} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
