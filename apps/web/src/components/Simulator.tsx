import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  bestPortfolio,
  interventionFromAi,
  profileBuildUp,
  profileTotal,
  registerIntervention,
  simulateProfile,
  type BuildUpKey,
  type EducationId,
  type PatientProfile,
  type RouteId,
} from '@polku/sim';
import { aiErrorText, compareNordic, type NordicReply } from '../state/api';
import { offlineNordic } from '../state/offline';
import { openPlan } from '../state/plan';
import { model, useSim } from '../state/sim';
import { MATTI_A, MATTI_B, SECTIONS, useStore } from '../state/store';
import { AiTrail, DesignBox, plainText } from './AiDesign';
import { ACTION_DESC, d0, SHORT } from './ui';

const regionsSorted = [...model.regions].sort((a, b) => a.nameEn.localeCompare(b.nameEn));
const sign = (x: number) => (x >= 0.5 ? `+${d0(x)}` : x <= -0.5 ? `−${d0(-x)}` : '±0');

/* ------------------------------------------------------------------ */
/* shared bits                                                          */
/* ------------------------------------------------------------------ */

function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chip-row" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id} className={`pick ${value === o.id ? 'on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** One question about the patient: the control, why it matters, and how many days it adds. */
function Factor({ title, why, delta, children }: { title: string; why: ReactNode; delta: number; children: ReactNode }) {
  return (
    <div className="factor">
      <div className="factor-head">
        <b>{title}</b>
        <span className={`delta ${delta >= 0.5 ? 'up' : delta <= -0.5 ? 'down' : ''}`}>{sign(delta)} days</span>
      </div>
      {children}
      <p className="factor-why">{why}</p>
    </div>
  );
}

function Switch({ on, onClick, title, detail, effect }: { on: boolean; onClick: () => void; title: ReactNode; detail?: ReactNode; effect?: ReactNode }) {
  return (
    <button className={`switch-row ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={onClick}>
      <span className={`sw ${on ? 'on' : ''}`} aria-hidden />
      <span className="switch-text">
        <b>{title}</b>
        {detail && <span className="switch-detail">{detail}</span>}
        {effect && <span className="switch-effect-line">{effect}</span>}
      </span>
    </button>
  );
}

/** Effect of one action on its own for this patient (best estimate and evidence range). */
function effectFor(patient: PatientProfile, id: string) {
  const base = profileTotal(model, patient);
  const at = (lvl: 'low' | 'mid' | 'high') => base - profileTotal(model, patient, [id], lvl);
  const [lo, hi] = [at('low'), at('high')].sort((a, b) => a - b);
  return { mid: at('mid'), lo, hi };
}

/* ------------------------------------------------------------------ */
/* 1 · the patient                                                      */
/* ------------------------------------------------------------------ */

function PatientSection() {
  const patient = useStore((s) => s.patient);
  const setPatient = useStore((s) => s.setPatient);
  const set = useStore((s) => s.set);
  const region = model.byId.get(patient.regionId)!;
  const km = patient.distanceKm ?? region.kmCentral;
  const steps = useMemo(() => profileBuildUp(model, patient), [patient]);
  const d = (k: BuildUpKey) => steps.find((s) => s.key === k)!.delta;
  /** The same patient on the other entry route: how many days apart. */
  const routeSwitch = useMemo(
    () => Math.abs(profileTotal(model, patient) - profileTotal(model, { ...patient, route: patient.route === 'public' ? 'occupational_private' : 'public' })),
    [patient],
  );
  return (
    <>
      <p className="sec-intro">Describe a lung cancer patient. Each choice shows how many days it adds or saves compared with Finland's average patient, and why.</p>
      <div className="row presets">
        <span className="muted small">Examples:</span>
        <button className="btn small-btn" onClick={() => set({ patient: MATTI_B, selectedRegion: MATTI_B.regionId })}>
          Retired, rural Lapland
        </button>
        <button className="btn small-btn" onClick={() => set({ patient: MATTI_A, selectedRegion: MATTI_A.regionId })}>
          Working, near Oulu
        </button>
      </div>

      <Factor title="Where do they live?" delta={d('region')} why={<>Waiting times for a family doctor and for specialists differ between wellbeing counties (THL data, 2025).</>}>
        <select aria-label="Wellbeing county" value={patient.regionId} onChange={(e) => setPatient({ regionId: e.target.value, distanceKm: undefined })}>
          {regionsSorted.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nameEn}
            </option>
          ))}
        </select>
        <span className="hint">or click a region on the map</span>
      </Factor>

      <Factor title={`How far from hospital? ${d0(km)} km`} delta={d('distance')} why={<>Every test means a trip. In Finland, living more than 50 km from hospital is linked to worse lung cancer outcomes.</>}>
        <input type="range" aria-label="Distance to hospital in km" min={5} max={400} step={5} value={km} onChange={(e) => setPatient({ distanceKm: +e.target.value })} />
      </Factor>

      <Factor
        title="Where do they go first?"
        delta={d('route')}
        why={
          <>
            People with work health care see a doctor sooner (Finnish lymphoma data: 123 vs 207 days to treatment).{' '}
            {patient.route === 'public' ? (
              <>
                Most patients use the public route, so it adds little compared with the average, but <b>with work health care this patient would wait {d0(routeSwitch)} days less</b>.
              </>
            ) : (
              <>
                <b>On the public route, this patient would wait {d0(routeSwitch)} days more.</b>
              </>
            )}
          </>
        }
      >
        <Chips<RouteId>
          label="First point of care"
          value={patient.route}
          onChange={(v) => setPatient({ route: v })}
          options={[
            { id: 'public', label: 'Public health centre' },
            { id: 'occupational_private', label: 'Work health care' },
          ]}
        />
      </Factor>

      <Factor title="Education" delta={d('education')} why={<>Health literacy affects how soon symptoms are noticed and acted on. Nordic studies link lower education to later diagnosis.</>}>
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
      </Factor>

      <Factor title="Support" delta={d('support')} why={<>Living alone, being over 75 or speaking another language makes appointments and referrals harder to follow through.</>}>
        <Chips<'alone' | 'support'>
          label="Support"
          value={patient.navigationBarrier ? 'alone' : 'support'}
          onChange={(v) => setPatient({ navigationBarrier: v === 'alone' })}
          options={[
            { id: 'alone', label: 'Lives alone, 75+ or other language' },
            { id: 'support', label: 'Has support' },
          ]}
        />
      </Factor>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · actions in the region (estimated by the AI)                      */
/* ------------------------------------------------------------------ */

function RegionSection() {
  const patient = useStore((s) => s.patient);
  const active = useStore((s) => s.interventions);
  const toggle = useStore((s) => s.toggleIntervention);
  const set = useStore((s) => s.set);
  const region = model.byId.get(patient.regionId)!;
  const plan = useMemo(() => bestPortfolio(model, patient.regionId, { priority: 'equity', budget: 'medium' }), [patient.regionId]);
  const ids = useMemo(() => {
    const all = model.params.interventions.filter((i) => i.estimatedBy === 'ai' && !i.custom).map((i) => i.id);
    return [...plan.interventions, ...all.filter((id) => !plan.interventions.includes(id))];
  }, [plan]);
  const effects = useMemo(() => Object.fromEntries(ids.map((id) => [id, effectFor(patient, id)])), [ids, patient]);
  // the strongest single action that is NOT in the plan, and why (effort)
  const strongestOutside = useMemo(() => {
    const out = ids.filter((id) => !plan.interventions.includes(id)).sort((a, b) => effects[b].mid - effects[a].mid)[0];
    const bestIn = Math.max(...plan.interventions.map((id) => effects[id]?.mid ?? 0));
    return out && effects[out].mid > bestIn + 0.5 ? out : null;
  }, [ids, plan, effects]);
  return (
    <>
      <p className="sec-intro">
        Actions from Finland's national cancer roadmap. Polku's AI estimated each one from the evidence and simulates its effect for this patient.
      </p>
      <div className="plan-why">
        <b>Recommended: the best combination for {region.nameEn} within a medium effort budget</b>, chosen to close the gap between patients.
        {strongestOutside && (
          <>
            {' '}
            {SHORT[strongestOutside]} saves the most on its own (−{d0(effects[strongestOutside].mid)} days) but needs a{' '}
            {model.interventionsById.get(strongestOutside)!.effort} effort budget.
          </>
        )}
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <button className="btn small-btn primary" onClick={() => set({ interventions: Array.from(new Set([...active, ...plan.interventions])) })}>
          Apply the AI's recommendation
        </button>
        <button className="btn small-btn" onClick={() => set({ interventions: [] })} disabled={!active.length}>
          Clear
        </button>
      </div>
      {ids.map((id, i) => {
        const iv = model.interventionsById.get(id)!;
        const e = effects[id];
        const recommended = plan.interventions.includes(id);
        return (
          <div key={id} className={`act-wrap ${recommended ? 'recommended' : ''}`}>
            {i === plan.interventions.length && <div className="list-sep">Other actions</div>}
            <Switch
              on={active.includes(id)}
              onClick={() => toggle(id)}
              title={SHORT[id] ?? iv.label}
              detail={`${ACTION_DESC[id] ?? ''} ${iv.effort[0].toUpperCase()}${iv.effort.slice(1)} effort.`}
              effect={
                <>
                  {recommended && <>Recommended by the AI · </>}
                  On its own, for this patient: <b>{e.mid >= 0.5 ? `−${d0(e.mid)} days` : 'little or no change'}</b>
                  {e.hi >= 1 && (
                    <>
                      {' '}
                      (range {d0(e.lo)}–{d0(e.hi)})
                    </>
                  )}
                </>
              }
            />
            {iv.rationale && (
              <details className="why-est">
                <summary>Why the AI expects this</summary>
                <p>{plainText(iv.rationale)}</p>
                {iv.roadmapActions[0] && <p>Part of national roadmap action {iv.roadmapActions[0].id} (page {iv.roadmapActions[0].page}).</p>}
              </details>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 3 · your own idea                                                    */
/* ------------------------------------------------------------------ */

function IdeaSection() {
  const patient = useStore((s) => s.patient);
  const active = useStore((s) => s.interventions);
  const toggle = useStore((s) => s.toggleIntervention);
  const customActions = useStore((s) => s.customActions);
  return (
    <>
      <p className="sec-intro">
        Describe any action in plain words. Polku's AI reads the strategy, the roadmap and the evidence, estimates what it would change, and says honestly when an idea is
        unlikely to help.
      </p>
      <DesignBox regionId={patient.regionId} compact />
      {customActions.length > 0 && (
        <>
          <div className="list-sep">Your ideas</div>
          {customActions.map((id) => {
            const iv = model.interventionsById.get(id);
            if (!iv) return null;
            const e = effectFor(patient, id);
            return (
              <Switch
                key={id}
                on={active.includes(id)}
                onClick={() => toggle(id)}
                title={iv.label}
                effect={
                  <>
                    For this patient: <b>{e.mid >= 0.5 ? `−${d0(e.mid)} days` : 'little or no change'}</b>
                  </>
                }
              />
            );
          })}
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4 · learn from the Nordics                                           */
/* ------------------------------------------------------------------ */

const PRACTICES = [
  { id: 'dk_cpp', iso: 'DNK' as const, flag: '🇩🇰', country: 'Denmark', name: 'Cancer patient pathways', line: 'Standard GP referral criteria, pre-booked tests and maximum times for each step.' },
  { id: 'no_pakkeforlop', iso: 'NOR' as const, flag: '🇳🇴', country: 'Norway', name: 'Pakkeforløp', line: 'Fixed maximum times from referral to treatment, with named coordinators.' },
  { id: 'se_svf', iso: 'SWE' as const, flag: '🇸🇪', country: 'Sweden', name: 'Standardised care pathways', line: 'A pathway starts at "well-founded suspicion", with lead-time targets.' },
  { id: 'dk_direct_ct', iso: 'DNK' as const, flag: '🇩🇰', country: 'Denmark', name: 'Direct CT for GPs', line: 'Family doctors order a CT scan without a specialist referral.' },
];

function NordicSection() {
  const patient = useStore((s) => s.patient);
  const active = useStore((s) => s.interventions);
  const set = useStore((s) => s.set);
  const nordicActions = useStore((s) => s.nordicActions);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, NordicReply>>({});
  const [error, setError] = useState<string | null>(null);
  const region = model.byId.get(patient.regionId)!;

  // leaving the section switches the light off
  useEffect(() => () => set({ nordicFocus: null }), [set]);

  const pick = async (id: string) => {
    if (busy) return;
    setOpen(id);
    setError(null);
    set({ nordicFocus: PRACTICES.find((p) => p.id === id)!.iso });
    if (replies[id]) return;
    const use = (r: NordicReply) => {
      registerIntervention(model, interventionFromAi(r.estimate, { model: r.model, custom: true }));
      setReplies((x) => ({ ...x, [id]: r }));
    };
    setBusy(id);
    const minThink = new Promise((res) => setTimeout(res, 1800)); // let the analysis be seen, even when instant
    try {
      // the AI analysed the four practices in advance (shipped with the app); otherwise ask it live
      const recorded = offlineNordic(id);
      const r = recorded ?? (await compareNordic(id));
      await minThink;
      use(r);
    } catch (e) {
      await minThink;
      setError(aiErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  const reply = open ? replies[open] : undefined;
  const ivId = reply?.estimate.id;
  const on = !!ivId && active.includes(ivId);
  const e = useMemo(() => (ivId ? effectFor(patient, ivId) : null), [ivId, patient]);

  return (
    <>
      <p className="sec-intro">
        Pick something a Nordic neighbour already does. Polku's AI analyses what it achieved there, and estimates what it would change in {region.nameEn} for this
        patient.
      </p>
      <div className="nordic-grid">
        {PRACTICES.map((p) => (
          <button key={p.id} className={`nordic ${open === p.id ? 'on' : ''}`} onClick={() => pick(p.id)} disabled={!!busy && busy !== p.id}>
            <span className="nordic-flag" aria-hidden>
              {p.flag}
            </span>
            <span>
              <b>
                {p.country}: {p.name}
              </b>
              <span className="nordic-line">{p.line}</span>
            </span>
          </button>
        ))}
      </div>

      {busy && <AiTrail steps={[]} running runningSteps={['Reading what this practice achieved in its country', 'Comparing it with where Finland loses its days', 'Estimating its effect in ' + region.nameEn + ' and simulating this patient']} />}
      {error && <p className="muted">{error}</p>}

      {reply && e && (
        <div className="nordic-result fade-in">
          <p className="nordic-what">{reply.whatTheyDid}</p>
          <div className="there-here">
            <div>
              <div className="th-label">In {reply.country}</div>
              <ul>
                {/* the direct-CT trial (S17) is its own practice; keep it out of the pathway comparisons */}
                {reply.resultsThere.filter((t) => reply.practiceId === 'dk_direct_ct' || !/S17/.test(t)).map((t) => (
                  <li key={t}>{plainText(t)}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="th-label">In {region.nameEn}, for this patient</div>
              <div className="th-big">{e.mid >= 0.5 ? `−${d0(e.mid)} days` : 'little or no change'}</div>
              {e.hi >= 1 && (
                <div className="muted small">
                  range {d0(e.lo)}–{d0(e.hi)} days · {reply.estimate.confidence} confidence
                </div>
              )}
            </div>
          </div>
          <p className="design-why">{plainText(reply.whyDifferent)}</p>
          {reply.unverified.length > 0 && <p className="verify warn">⚠ Not found in our evidence notes: {reply.unverified.join(', ')}</p>}
          <button
            className={`btn ${on ? '' : 'primary'} wide`}
            aria-pressed={on}
            onClick={() =>
              set({
                interventions: on ? active.filter((x) => x !== ivId) : [...active, ivId!],
                nordicActions: nordicActions.includes(ivId!) ? nordicActions : [...nordicActions, ivId!],
              })
            }
          >
            {on ? '✓ Added to the plan (click to remove)' : `Try it in ${region.nameEn}`}
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* the panel                                                            */
/* ------------------------------------------------------------------ */

export function SimulatorPanel() {
  const section = useStore((s) => s.section);
  const goSection = useStore((s) => s.goSection);
  const last = section === SECTIONS.length - 1;
  return (
    <section className="sim-panel glass fade-in" aria-label="Simulator">
      <nav className="sec-tabs" aria-label="Simulator sections">
        {SECTIONS.map((s, i) => (
          <button key={s.id} className={`sec-tab ${i === section ? 'on' : ''} ${i < section ? 'done' : ''}`} onClick={() => goSection(i)} aria-current={i === section ? 'step' : undefined}>
            <span className="sec-n">{i < section ? '✓' : i + 1}</span>
            <span className="sec-label">{s.label}</span>
          </button>
        ))}
      </nav>
      <h2 className="sec-title">{SECTIONS[section].label}</h2>
      <div className="sec-body" key={section}>
        {section === 0 && <PatientSection />}
        {section === 1 && <RegionSection />}
        {section === 2 && <IdeaSection />}
        {section === 3 && <NordicSection />}
      </div>
      <div className="sec-nav">
        <button className="btn" onClick={() => goSection(section - 1)} disabled={section === 0}>
          ← Back
        </button>
        {!last && (
          <button className="btn primary big" onClick={() => goSection(section + 1)}>
            Next: {SECTIONS[section + 1].label} →
          </button>
        )}
      </div>
    </section>
  );
}

/** AstraZeneca's pathway steps, grouped from the model's five phases. */
const STRETCHES = [
  { key: 'detection', label: 'Detection', color: '#f59e0b', what: 'First symptom to first doctor' },
  { key: 'referral', label: 'Referral', color: '#fbbf24', what: 'Primary care until the referral is sent' },
  { key: 'hospital', label: 'Hospital', color: '#60a5fa', what: 'Specialist, diagnosis and first treatment' },
] as const;

const BUILD_LABEL = (k: BuildUpKey, p: PatientProfile, regionName: string, km: number) =>
  ({
    national: "Finland's average",
    region: `Lives in ${regionName}`,
    distance: `${d0(km)} km from hospital`,
    route: p.route === 'public' ? 'Goes to the public health centre' : 'Uses work health care',
    education: p.education === 'basic' ? 'Basic education' : p.education === 'secondary' ? 'Secondary education' : 'University education',
    support: p.navigationBarrier ? 'Lives alone, 75+ or other language' : 'Has support',
  })[k];

/** Right-hand result: where in the pathway the days are lost, and why (a waterfall from Finland's average). */
export function SimulatorResult() {
  const sim = useSim();
  const patient = useStore((s) => s.patient);
  const active = useStore((s) => s.interventions);
  const set = useStore((s) => s.set);
  const region = model.byId.get(patient.regionId)!;
  const km = patient.distanceKm ?? region.kmCentral;
  const steps = useMemo(() => profileBuildUp(model, patient), [patient]);
  const r = useMemo(() => simulateProfile(model, patient, active), [patient, active]);
  const base = steps.at(-1)!.total;
  const saved = base - r.totalMeanDays;

  /* comparison with Patient A (same actions, so the gap is like for like) */
  const isA = (['regionId', 'route', 'education', 'navigationBarrier'] as const).every((k) => patient[k] === MATTI_A[k]) && Math.round(km) === MATTI_A.distanceKm;
  const a = useMemo(() => simulateProfile(model, MATTI_A, active), [active]);
  const gapA = r.totalMeanDays - a.totalMeanDays;

  /* ---- where in the pathway: detection / referral / diagnosis & treatment ---- */
  const avgPhases = useMemo(() => {
    const tp = sim.current.reduce((s, x) => s + x.population, 0);
    return [0, 1, 2, 3, 4].map((i) => sim.current.reduce((s, x) => s + x.population * x.phases[i].meanDays, 0) / tp);
  }, [sim.current]);
  const parts = (ph: number[]) => [ph[0], ph[1], ph[2] + ph[3] + ph[4]];
  const mine = parts(r.phases.map((x) => x.meanDays));
  const avg = parts(avgPhases);
  const pathRows = [
    { label: 'This patient', parts: mine, cls: 'me' },
    ...(isA ? [] : [{ label: 'Patient A', parts: parts(a.phases.map((x) => x.meanDays)), cls: 'a' }]),
    { label: 'Finland avg', parts: avg, cls: 'avg' },
  ];
  const pathMax = Math.max(...pathRows.map((x) => x.parts[0] + x.parts[1] + x.parts[2]));
  const extra = mine.map((v, i) => v - avg[i]);
  const extraTotal = extra[0] + extra[1] + extra[2];
  const biggest = extra.indexOf(Math.max(...extra));
  const beforeShare = extraTotal > 1 ? Math.round(Math.min(1, Math.max(0, (extra[0] + extra[1]) / extraTotal)) * 100) : null;

  /* ---- why: waterfall from Finland's average to this patient ---- */
  const water = [
    ...steps.slice(1).map((s) => ({ key: s.key as string, label: BUILD_LABEL(s.key, patient, region.nameEn, km), from: s.total - s.delta, to: s.total })),
    ...(saved > 0.5 ? [{ key: 'actions', label: `${active.length} action${active.length > 1 ? 's' : ''} in the plan`, from: base, to: r.totalMeanDays }] : []),
  ];
  // zoomed scale: start a little below the smallest running total so each factor's bar is readable
  const wVals = [steps[0].total, r.totalMeanDays, ...water.flatMap((w) => [w.from, w.to])];
  const wHi = Math.max(...wVals);
  const wLo = Math.min(...wVals);
  const wMin = Math.max(0, Math.floor((wLo - Math.max(20, (wHi - wLo) * 0.45)) / 10) * 10);
  const wSpan = wHi * 1.03 - wMin;
  const wx = (v: number) => `${(Math.max(0, v - wMin) / wSpan) * 100}%`;
  const ww = (f: number, t: number) => `${(Math.abs(t - f) / wSpan) * 100}%`;
  // the factor that moves this patient most in the direction of their result (adds days if slower, saves if faster)
  const slower = base >= steps[0].total;
  const biggestFactor = water
    .filter((w) => w.key !== 'actions' && (slower ? w.to - w.from > 0.5 : w.to - w.from < -0.5))
    .sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from))[0];

  return (
    <section className="sim-result glass fade-in" aria-live="polite" aria-label="Result">
      <div className="eyebrow ai-eyebrow">
        <span className="ai-spark" aria-hidden>✦</span> Polku AI · this patient waits
      </div>
      <div className="big-num">
        {d0(r.totalMeanDays)} <span>days from first symptom to treatment</span>
      </div>
      {saved > 0.5 && <div className="saved-pill">−{d0(saved)} days thanks to the plan</div>}
      {!isA && (
        <div className="vs-a">
          <span>
            vs <b className="hl-a">Patient A</b> (works, near Oulu): <b>{d0(a.totalMeanDays)} days</b>
          </span>
          <span className={`vs-gap ${gapA >= 0.5 ? 'up' : 'down'}`}>
            gap {gapA >= 0 ? '+' : '−'}
            {d0(Math.abs(gapA))} days
          </span>
        </div>
      )}

      {/* ---------------- where ---------------- */}
      <h3 className="res-h">
        <span className="res-n">1</span> Where the days are lost
      </h3>
      {beforeShare != null ? (
        <p className="res-lead">
          <b className="big-share">{beforeShare}%</b> of this patient's extra days are lost <b>before a specialist ever sees them</b>.
        </p>
      ) : (
        <p className="res-lead">
          This patient waits <b>{d0(Math.max(0, -extraTotal))} days less</b> than Finland's average patient. The longest stretch is still <b>{STRETCHES[mine.indexOf(Math.max(...mine))].label.toLowerCase()}</b>.
        </p>
      )}
      {pathRows.map((row) => (
        <div key={row.label} className={`pw-row ${row.cls}`}>
          <span className="pw-name">{row.label}</span>
          <div className="pw-track">
            {row.parts.map((v, i) => (
              <div key={i} className="pw-seg" style={{ width: `${(v / pathMax) * 100}%`, background: STRETCHES[i].color }} title={`${STRETCHES[i].label}: ${d0(v)} days`}>
                {(v / pathMax) * 100 > 10 ? d0(v) : ''}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="stretch-cards">
        {STRETCHES.map((s, i) => (
          <div key={s.key} className={`stretch ${i === biggest && extra[i] > 1 ? 'hot' : ''}`} style={{ ['--c' as any]: s.color }}>
            {i === biggest && extra[i] > 1 && <span className="hot-tag">Biggest gap</span>}
            <div className="st-label">{s.label}</div>
            <div className="st-days">
              {d0(mine[i])}
              <span> d</span>
            </div>
            <div className={`st-delta ${extra[i] >= 0.5 ? 'up' : extra[i] <= -0.5 ? 'down' : ''}`}>
              {extra[i] >= 0.5 ? '+' : extra[i] <= -0.5 ? '−' : '±'}
              {d0(Math.abs(extra[i]))} vs avg
            </div>
            <div className="st-what">{s.what}</div>
          </div>
        ))}
      </div>

      {/* ---------------- why ---------------- */}
      <h3 className="res-h">
        <span className="res-n">2</span> Why: how the days add up
      </h3>
      {biggestFactor && (
        <p className="res-lead">
          {slower ? 'What adds the most' : 'What saves the most'}: <b>{biggestFactor.label}</b>{' '}
          <b className={slower ? 'txt-up' : 'txt-down'}>({sign(biggestFactor.to - biggestFactor.from)} days)</b>.
        </p>
      )}
      <div className="waterfall" role="img" aria-label={`From Finland's average of ${d0(steps[0].total)} days to this patient's ${d0(r.totalMeanDays)} days`}>
        <div className="wf-row base">
          <span className="wf-label">Finland's average</span>
          <div className="wf-track">
            <div className="wf-bar neutral" style={{ left: 0, width: wx(steps[0].total) }} />
          </div>
          <b className="wf-val">{d0(steps[0].total)}</b>
        </div>
        {water.map((w) => {
          const up = w.to >= w.from;
          return (
            <div key={w.key} className="wf-row">
              <span className="wf-label">{w.label}</span>
              <div className="wf-track">
                <div className="wf-guide" style={{ left: wx(Math.min(w.from, w.to)) }} />
                <div className={`wf-bar ${Math.abs(w.to - w.from) < 0.5 ? 'flat' : up ? 'up' : 'down'}`} style={{ left: wx(Math.min(w.from, w.to)), width: ww(w.from, w.to) }} />
              </div>
              <b className={`wf-val ${Math.abs(w.to - w.from) < 0.5 ? '' : up ? 'up' : 'down'}`}>{sign(w.to - w.from)}</b>
            </div>
          );
        })}
        <div className="wf-row total">
          <span className="wf-label">This patient</span>
          <div className="wf-track">
            <div className="wf-bar total" style={{ left: 0, width: wx(r.totalMeanDays) }} />
          </div>
          <b className="wf-val">{d0(r.totalMeanDays)}</b>
        </div>
      </div>
      <p className="wf-note">
        Start from Finland's average patient, then add each factor in turn: <span className="up">red</span> adds days, <span className="down">green</span> saves days.
        {wMin > 0 && <> The scale starts at {wMin} days.</>}
      </p>

      <div className="plan-btns">
        <button className="btn primary" onClick={() => set({ askOpen: true })}>
          Ask the AI
        </button>
        <button className="btn" onClick={() => openPlan(patient.regionId, 'en')}>
          ⬇ Region plan
        </button>
      </div>
    </section>
  );
}
