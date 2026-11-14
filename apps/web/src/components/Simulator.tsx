import { useMemo } from 'react';
import { bestPortfolio, simulateProfile, type EducationId, type RouteId } from '@polku/sim';
import { openPlan } from '../state/plan';
import { model, useSim } from '../state/sim';
import { MATTI_A, MATTI_B, useStore } from '../state/store';
import { ACTION_DESC, d0, SHORT } from './ui';
import { DesignBox } from './AiDesign';

const regionsSorted = [...model.regions].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
const KEY_ACTIONS = ['public_fast_lane', 'navigator', 'fast_track', 'travel_cost_support', 'awareness'];

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="chips">
      <legend>{label}</legend>
      <div className="chip-row" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={value === o.id} className={`pick ${value === o.id ? 'on' : ''}`} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SimulatorPanel() {
  const patient = useStore((s) => s.patient);
  const setPatient = useStore((s) => s.setPatient);
  const set = useStore((s) => s.set);
  const active = useStore((s) => s.interventions);
  const toggle = useStore((s) => s.toggleIntervention);
  const customActions = useStore((s) => s.customActions);
  const region = model.byId.get(patient.regionId)!;
  const plan = useMemo(() => bestPortfolio(model, patient.regionId, { priority: 'equity', budget: 'medium' }), [patient.regionId]);

  return (
    <section className="sim-panel glass fade-in" aria-label="Simulator">
      <h2 className="sim-h">Simulator</h2>
      <p className="small muted" style={{ margin: '2px 0 0' }}>
        Build a patient, pick actions, and see how long they wait.
      </p>

      <h3 className="sim-sub">1 · The patient</h3>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn small-btn" onClick={() => set({ patient: MATTI_A, selectedRegion: MATTI_A.regionId })}>
          Load Patient A
        </button>
        <button className="btn small-btn" onClick={() => set({ patient: MATTI_B, selectedRegion: MATTI_B.regionId })}>
          Load Patient B
        </button>
      </div>
      <div className="field">
        <label htmlFor="sim-region">Lives in (or click the map)</label>
        <select id="sim-region" value={patient.regionId} onChange={(e) => setPatient({ regionId: e.target.value, distanceKm: model.byId.get(e.target.value)!.kmCentral })}>
          {regionsSorted.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nameEn}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="sim-km">
          Distance to hospital: <b>{d0(patient.distanceKm ?? region.kmCentral)} km</b>
        </label>
        <input id="sim-km" type="range" min={5} max={400} step={5} value={patient.distanceKm ?? region.kmCentral} onChange={(e) => setPatient({ distanceKm: +e.target.value })} />
      </div>
      <Chips<RouteId>
        label="First goes to"
        value={patient.route}
        onChange={(v) => setPatient({ route: v })}
        options={[
          { id: 'public', label: 'Public health centre' },
          { id: 'occupational_private', label: 'Work health care' },
        ]}
      />
      <Chips<EducationId>
        label="Education"
        value={patient.education}
        onChange={(v) => setPatient({ education: v })}
        options={[
          { id: 'basic', label: 'Basic' },
          { id: 'secondary', label: 'Secondary' },
          { id: 'tertiary', label: 'University' },
        ]}
      />
      <label className="check">
        <input type="checkbox" checked={patient.navigationBarrier} onChange={(e) => setPatient({ navigationBarrier: e.target.checked })} />
        Lives alone, speaks another language or is over 75
      </label>

      <h3 className="sim-sub">2 · Actions in {region.nameEn}</h3>
      {KEY_ACTIONS.map((id) => {
        const iv = model.interventionsById.get(id)!;
        const on = active.includes(id);
        return (
          <button key={id} className={`switch-row compact ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => toggle(id)}>
            <span className={`sw ${on ? 'on' : ''}`} aria-hidden />
            <span className="switch-text">
              <b>{SHORT[id]}</b>
              <span className="switch-detail">{ACTION_DESC[id]}</span>
            </span>
          </button>
        );
      })}
      {customActions.map((id) => {
        const iv = model.interventionsById.get(id);
        if (!iv) return null;
        const on = active.includes(id);
        return (
          <button key={id} className={`switch-row compact ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => toggle(id)}>
            <span className={`sw ${on ? 'on' : ''}`} aria-hidden />
            <span className="switch-text">
              <b>{iv.label}</b>
              <span className="switch-detail">Your idea, estimated by the AI</span>
            </span>
          </button>
        );
      })}
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <button className="btn small-btn" onClick={() => set({ interventions: plan.interventions })}>
          Use the AI's recommended plan
        </button>
        <button className="btn small-btn" onClick={() => set({ interventions: [] })} disabled={!active.length}>
          Clear
        </button>
      </div>

      <h3 className="sim-sub">3 · Design your own action with AI</h3>
      <DesignBox regionId={patient.regionId} compact />
    </section>
  );
}

export function SimulatorResult() {
  const sim = useSim();
  const patient = useStore((s) => s.patient);
  const active = useStore((s) => s.interventions);
  const set = useStore((s) => s.set);
  const r = useMemo(() => simulateProfile(model, patient, active), [patient, active]);
  const r0 = useMemo(() => simulateProfile(model, patient, []), [patient]);
  const saved = r0.totalMeanDays - r.totalMeanDays;
  const max = Math.max(240, r0.totalMeanDays);
  const rows = [
    { label: 'This patient', v: r.totalMeanDays, color: '#fb7185', strong: true },
    { label: 'Finland average', v: sim.national.current, color: '#94a3b8' },
    { label: 'Sweden', v: 107, color: '#60a5fa' },
    { label: 'Denmark', v: 67, color: '#2dd4bf' },
  ];
  const before = r.phases[0].meanDays + r.phases[1].meanDays;
  return (
    <section className="sim-result glass fade-in" aria-live="polite" aria-label="Result">
      <div className="eyebrow">This patient waits</div>
      <div className="big-num">
        {d0(r.totalMeanDays)} <span>days</span>
      </div>
      <div className={`impact-d ${saved > 0.5 ? '' : 'idle'}`}>{saved > 0.5 ? `−${d0(saved)} days thanks to the actions` : 'from first symptom to first treatment (estimate)'}</div>
      <div style={{ marginTop: 10 }}>
        {rows.map((x) => (
          <div key={x.label} className="nbar small-nbar" role="img" aria-label={`${x.label}: ${d0(x.v)} days`}>
            <div className="nbar-label" style={{ fontWeight: x.strong ? 800 : 600 }}>
              {x.label}
            </div>
            <div className="nbar-track">
              <div className="nbar-fill" style={{ width: `${(x.v / max) * 100}%`, background: x.color }} />
            </div>
            <div className="nbar-val" style={{ color: x.color }}>
              {d0(x.v)}
            </div>
          </div>
        ))}
      </div>
      <div className="facts">
        <div>
          <b>{d0(before)} days</b> pass before the referral is even sent.
        </div>
        <div>
          <b>{Math.round(r.distribution.pctWithinTarget * 100)}%</b> of patients like this start treatment within 42 days of referral (Nordic target).
        </div>
      </div>
      <div className="plan-btns">
        <button className="btn primary" onClick={() => set({ askOpen: true })}>
          Ask the AI
        </button>
        <button className="btn" onClick={() => openPlan(patient.regionId, 'en')}>
          ⬇ Plan for {model.byId.get(patient.regionId)!.nameEn}
        </button>
      </div>
    </section>
  );
}
