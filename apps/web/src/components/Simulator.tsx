import { useMemo, useState, type ReactNode } from 'react';
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
  return (
    <>
      <p className="sec-intro">Describe a lung cancer patient. Each choice shows how many days it adds or saves, and why.</p>
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

      <Factor title="Where do they go first?" delta={d('route')} why={<>People with work health care see a doctor sooner. In Finnish lymphoma patients, treatment started after 123 days through work health care and 207 through the public route.</>}>
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
  return (
    <>
      <p className="sec-intro">
        Actions from Finland's national cancer roadmap. Gemini estimated each one from the evidence; the simulator computes the days for this patient. The best
        combination for {region.nameEn} comes first.
      </p>
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
              detail={ACTION_DESC[id]}
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
        Describe any action in plain words. Gemini reads the strategy, the roadmap and the evidence, estimates what it would change, and says honestly when an idea is
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
  { id: 'dk_cpp', flag: '🇩🇰', country: 'Denmark', name: 'Cancer patient pathways', line: 'Standard GP referral criteria, pre-booked tests and maximum times for each step.' },
  { id: 'no_pakkeforlop', flag: '🇳🇴', country: 'Norway', name: 'Pakkeforløp', line: 'Fixed maximum times from referral to treatment, with named coordinators.' },
  { id: 'se_svf', flag: '🇸🇪', country: 'Sweden', name: 'Standardised care pathways', line: 'A pathway starts at "well-founded suspicion", with lead-time targets.' },
  { id: 'dk_direct_ct', flag: '🇩🇰', country: 'Denmark', name: 'Direct CT for GPs', line: 'Family doctors order a CT scan without a specialist referral.' },
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

  const pick = async (id: string) => {
    setOpen(id);
    setError(null);
    if (replies[id] || busy) return;
    const use = (r: NordicReply) => {
      registerIntervention(model, interventionFromAi(r.estimate, { model: r.model, custom: true }));
      setReplies((x) => ({ ...x, [id]: r }));
    };
    // the four practices were analysed by Gemini in advance and ship with the app: instant, works offline
    const recorded = offlineNordic(id);
    if (recorded) return use(recorded);
    setBusy(id);
    try {
      use(await compareNordic(id));
    } catch (e) {
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
        Pick something a Nordic neighbour already does. Gemini summarises what it achieved there, and estimates what it would change in {region.nameEn} for this
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

      {busy && <AiTrail steps={[]} running />}
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

const BUILD_LABEL = (k: BuildUpKey, p: PatientProfile, regionName: string, km: number) =>
  ({
    national: "Finland's average",
    region: `Lives in ${regionName}`,
    distance: `${d0(km)} km from hospital`,
    route: p.route === 'public' ? 'Goes to the public health centre' : 'Uses work health care',
    education: p.education === 'basic' ? 'Basic education' : p.education === 'secondary' ? 'Secondary education' : 'University education',
    support: p.navigationBarrier ? 'Lives alone, 75+ or other language' : 'Has support',
  })[k];

/** Right-hand result: the running sum, the effect of the plan, and how it compares with the Nordics. */
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
  const referralToTreatment = r.phases[2].meanDays + r.phases[3].meanDays + r.phases[4].meanDays;

  const max = Math.max(240, base + 10);
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const marks = [
    { label: 'Denmark', v: 67, cls: 'dk' },
    { label: 'Sweden', v: 107, cls: 'se' },
    { label: 'Finland avg', v: sim.national.base, cls: 'fi' },
  ];

  return (
    <section className="sim-result glass fade-in" aria-live="polite" aria-label="Result">
      <div className="eyebrow">This patient waits</div>
      <div className="big-num">
        {d0(r.totalMeanDays)} <span>days from first symptom to treatment</span>
      </div>

      <div className="buildup" aria-label="How the days add up">
        {steps.map((s) => (
          <div key={s.key} className={`bu-row ${s.key === 'national' ? 'first' : ''}`}>
            <span>{BUILD_LABEL(s.key, patient, region.nameEn, km)}</span>
            <b className={s.key === 'national' ? '' : s.delta >= 0.5 ? 'up' : s.delta <= -0.5 ? 'down' : ''}>{s.key === 'national' ? d0(s.total) : sign(s.delta)}</b>
          </div>
        ))}
        {saved > 0.5 && (
          <div className="bu-row">
            <span>
              {active.length} action{active.length > 1 ? 's' : ''} in the plan
            </span>
            <b className="down">−{d0(saved)}</b>
          </div>
        )}
        <div className="bu-row total">
          <span>This patient</span>
          <b>{d0(r.totalMeanDays)} days</b>
        </div>
      </div>

      <div className="bench">
        <div className="bench-title">Compared with the Nordics</div>
        <div className="ruler" role="img" aria-label={`This patient ${d0(r.totalMeanDays)} days; Denmark 67, Sweden 107, Finland average ${d0(sim.national.base)}`}>
          <div className="ruler-track" />
          {marks.map((m) => (
            <div key={m.label} className={`mark ${m.cls}`} style={{ left: pos(m.v) }}>
              <i />
              <span>
                {m.label}
                <br />
                {d0(m.v)}
              </span>
            </div>
          ))}
          {saved > 0.5 && <div className="patient-dot ghost" style={{ left: pos(base) }} />}
          <div className="patient-dot" style={{ left: pos(r.totalMeanDays) }} />
        </div>
        <div className="bench-note">
          From referral to treatment this patient waits <b>{d0(referralToTreatment)} days</b>. Norway's target is <b>42 days or less</b>.
        </div>
      </div>

      <div className="plan-btns">
        <button className="btn primary" onClick={() => set({ askOpen: true })}>
          Ask the AI
        </button>
        <button className="btn" onClick={() => openPlan(patient.regionId, 'en')}>
          ⬇ Plan for {region.nameEn}
        </button>
      </div>
    </section>
  );
}
