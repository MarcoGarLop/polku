import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { bestPortfolio, buildModel, compareProfiles, parseParams, parseRegions, profileTotal } from '@polku/sim';
import { rawIndicators, rawParams, rawRegions } from '@polku/sim/data';
import { askAgent, type AgentReply } from '../state/api';
import { openPlan } from '../state/plan';
import { model, useSim } from '../state/sim';
import { applyWhatIf, TOUR_STEPS, useStore, type WhatIf } from '../state/store';
import { StepTimeline } from './StepTimeline';
import { AnswerBody } from './AskPanel';
import { d0, SHORT } from './ui';

/* ---------------- shared bits ---------------- */

function Card({ title, children, mapNote, foot }: { title: ReactNode; children?: ReactNode; mapNote?: ReactNode; foot?: ReactNode }) {
  const step = useStore((s) => s.step);
  const goStep = useStore((s) => s.goStep);
  const setMode = useStore((s) => s.setMode);
  const last = step === TOUR_STEPS.length - 1;
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => headRef.current?.focus({ preventScroll: true }), [step]);
  return (
    <section className="tour-card glass fade-in" aria-live="polite" aria-labelledby="tour-title">
      <div className="tour-meta">
        <span className="tour-count">
          Step {step + 1} of {TOUR_STEPS.length}
        </span>
        <span className="tour-ask" title="What the AstraZeneca challenge asks for">
          ✓ Challenge: {TOUR_STEPS[step].ask}
        </span>
      </div>
      <h2 id="tour-title" className="tour-title" tabIndex={-1} ref={headRef}>
        {title}
      </h2>
      <div className="tour-body">{children}</div>
      {mapNote && (
        <div className="map-note">
          <span aria-hidden>🗺</span> <span>{mapNote}</span>
        </div>
      )}
      {foot && <div className="tour-foot">{foot}</div>}
      <div className="tour-nav">
        <button className="btn" onClick={() => goStep(step - 1)} disabled={step === 0}>
          ← Back
        </button>
        {last ? (
          <button className="btn primary big" onClick={() => setMode('sim')}>
            Open the simulator →
          </button>
        ) : (
          <button className="btn primary big" onClick={() => goStep(step + 1)}>
            Next: {TOUR_STEPS[step + 1].label} →
          </button>
        )}
      </div>
    </section>
  );
}

function NumberBar({ label, value, max, color, strong }: { label: string; value: number; max: number; color: string; strong?: boolean }) {
  return (
    <div className="nbar" role="img" aria-label={`${label}: ${d0(value)} days`}>
      <div className="nbar-label" style={{ fontWeight: strong ? 800 : 600 }}>{label}</div>
      <div className="nbar-track">
        <div className="nbar-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
      <div className="nbar-val" style={{ color }}>
        {d0(value)} <span>days</span>
      </div>
    </div>
  );
}

function Switch({ on, onClick, label, detail, effect }: { on: boolean; onClick: () => void; label: ReactNode; detail?: ReactNode; effect?: ReactNode }) {
  return (
    <button className={`switch-row ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={onClick}>
      <span className={`sw ${on ? 'on' : ''}`} aria-hidden />
      <span className="switch-text">
        <b>{label}</b>
        {detail && <span className="switch-detail">{detail}</span>}
      </span>
      {effect && <span className="switch-effect">{effect}</span>}
    </button>
  );
}

/* ---------------- steps ---------------- */

function StepGap() {
  const sim = useSim();
  return (
    <Card
      title="In Finland, lung cancer treatment starts about five months after the first symptom."
      mapNote="Each region is coloured by its average wait: green is faster, red is slower. Hover or click any region."
      foot="Preliminary national averages from a Finnish study (Kuittinen, reported by Yle, 2025). Regional colours are estimates built from public THL waiting-time data."
    >
      <NumberBar label="Finland" value={sim.national.base} max={170} color="#fb7185" strong />
      <NumberBar label="Sweden" value={107} max={170} color="#60a5fa" />
      <NumberBar label="Denmark" value={67} max={170} color="#2dd4bf" />
      <p className="tour-text">
        Finland is almost <b>three months behind Denmark</b>. But the national average hides something bigger.
      </p>
    </Card>
  );
}

function StepPatients() {
  const sim = useSim();
  const c = sim.comparisonBase;
  return (
    <Card
      title={
        <>
          Two men, same lung cancer. One waits <span className="hl-b">{d0(c.gapDays)} days longer</span>.
        </>
      }
      mapNote="Now the map shows how long Matti B would wait in each municipality. Lapland, where he lives, is raised."
      foot="Matti A and Matti B are fictional examples. AstraZeneca's question: “Do two patients with the same cancer have an equal chance, regardless of where they live, their income, education or ability to navigate the system?”"
    >
      <div className="duo">
        <div className="duo-item">
          <div className="duo-name" style={{ color: 'var(--a)' }}>Matti A</div>
          <div className="duo-num" style={{ color: 'var(--a)' }}>
            {d0(c.a.totalMeanDays)}
            <span>days</span>
          </div>
          <div className="duo-desc">Works, uses his work health care, lives 8 km from Oulu University Hospital.</div>
        </div>
        <div className="duo-item">
          <div className="duo-name" style={{ color: 'var(--b)' }}>Matti B</div>
          <div className="duo-num" style={{ color: 'var(--b)' }}>
            {d0(c.b.totalMeanDays)}
            <span>days</span>
          </div>
          <div className="duo-desc">Retired, uses the public health centre, lives alone 180 km from hospital in Lapland.</div>
        </div>
      </div>
    </Card>
  );
}

function StepWhere() {
  const sim = useSim();
  const c = sim.comparisonBase;
  return (
    <Card
      title={
        <>
          <span className="hl-b">{Math.round(c.shareBeforeReferral * 100)}%</span> of the difference happens before a specialist ever sees him.
        </>
      }
      mapNote="Matti B's Finland: almost every municipality is orange or red for him."
      foot="The 8 steps are the patient pathway AstraZeneca shared with all teams (briefing, slide 10)."
    >
      <p className="tour-text" style={{ marginTop: 0 }}>
        The delay is not inside the hospital. It is in <b>getting there</b>: noticing the symptoms, getting a doctor's appointment, getting referred.
      </p>
      <StepTimeline a={c.a} b={c.b} compact />
    </Card>
  );
}

const WHATIF_ROWS: { k: keyof WhatIf; label: string; detail: string }[] = [
  { k: 'route', label: 'Give him work health care', detail: 'instead of the public health centre' },
  { k: 'near', label: 'Move him near the hospital', detail: '10 km instead of 180 km' },
  { k: 'help', label: 'Someone helps him through the system', detail: 'no longer alone with appointments and referrals' },
  { k: 'edu', label: 'Give him a university degree', detail: 'better at recognising symptoms early' },
];

function StepWhy() {
  const sim = useSim();
  const b = useStore((s) => s.profileB);
  const whatIf = useStore((s) => s.whatIf);
  const toggle = useStore((s) => s.toggleWhatIf);
  const now = useMemo(() => profileTotal(model, applyWhatIf(b, whatIf)), [b, whatIf]);
  const base = sim.comparisonBase.b.totalMeanDays;
  const aDays = sim.comparisonBase.a.totalMeanDays;
  const none: WhatIf = { route: false, near: false, edu: false, help: false };
  const alone = useMemo(() => Object.fromEntries(WHATIF_ROWS.map((r) => [r.k, base - profileTotal(model, applyWhatIf(b, { ...none, [r.k]: true }))])), [b, base]);
  return (
    <Card
      title="None of it is medical. Change one thing about Matti B and watch."
      mapNote="Every switch you flip recolours Matti B's Finland."
      foot="The work-health-care effect comes from Finnish lymphoma data (Kuitunen 2026), applied to lung cancer as an assumption. Education and support effects are our stated assumptions."
    >
      {WHATIF_ROWS.map((r) => (
        <Switch key={r.k} on={whatIf[r.k]} onClick={() => toggle(r.k)} label={r.label} detail={r.detail} effect={<>−{d0(alone[r.k])} d</>} />
      ))}
      <div className="live-compare" aria-live="polite">
        <NumberBar label="Matti B" value={now} max={240} color="#fb7185" strong />
        <NumberBar label="Matti A" value={aDays} max={240} color="#22d3ee" />
        {now < base - 0.5 && (
          <div className="live-delta">
            Matti B now waits <b>{d0(base - now)} days less</b>.
          </div>
        )}
      </div>
    </Card>
  );
}

const WHY_ACTION: Record<string, string> = {
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

function StepAct() {
  const sim = useSim();
  const a = useStore((s) => s.profileA);
  const b = useStore((s) => s.profileB);
  const active = useStore((s) => s.interventions);
  const toggle = useStore((s) => s.toggleIntervention);
  const set = useStore((s) => s.set);
  const region = model.byId.get(b.regionId)!;
  const plan = useMemo(() => bestPortfolio(model, b.regionId, { priority: 'equity', budget: 'medium' }), [b.regionId]);
  const c0 = sim.comparisonBase;
  const c = useMemo(() => compareProfiles(model, a, b, active), [a, b, active]);
  const allOn = plan.interventions.every((id) => active.includes(id));
  return (
    <Card
      title={`Three actions from the national roadmap that close the gap in ${region.nameEn}.`}
      mapNote={`Switch them on and watch ${region.nameEn} turn greener.`}
      foot="Chosen by the simulator among 512 combinations to close the gap within a medium effort budget. Effects are estimates with evidence ranges."
    >
      <div className="act-zero">
        <span className="act-num">0</span>
        <div>
          <b>Start measuring.</b> <span className="muted">Finland does not record these waiting times today. Record three dates, the entry route and education for every patient.</span>
        </div>
      </div>
      {plan.interventions.map((id) => {
        const iv = model.interventionsById.get(id)!;
        return (
          <Switch
            key={id}
            on={active.includes(id)}
            onClick={() => toggle(id)}
            label={SHORT[id]}
            detail={
              <>
                {WHY_ACTION[id]} <span className="tag roadmap">Roadmap {iv.roadmapActions[0]?.id} · p.{iv.roadmapActions[0]?.page}</span>
              </>
            }
          />
        );
      })}
      <div className="impact">
        <div>
          <div className="impact-k">Matti B waits</div>
          <div className="impact-v">
            {d0(c.b.totalMeanDays)}
            <span> days</span>
          </div>
          <div className={`impact-d ${c0.b.totalMeanDays - c.b.totalMeanDays > 0.5 ? '' : 'idle'}`}>
            {c0.b.totalMeanDays - c.b.totalMeanDays > 0.5 ? `−${d0(c0.b.totalMeanDays - c.b.totalMeanDays)} days` : 'switch an action on'}
          </div>
        </div>
        <div>
          <div className="impact-k">Gap to Matti A</div>
          <div className="impact-v" style={{ color: '#f0abfc' }}>
            {d0(c.gapDays)}
            <span> days</span>
          </div>
          <div className={`impact-d ${c0.gapDays - c.gapDays > 0.5 ? '' : 'idle'}`}>{c0.gapDays - c.gapDays > 0.5 ? `−${d0(c0.gapDays - c.gapDays)} days` : '—'}</div>
        </div>
      </div>
      {!allOn ? (
        <button className="btn wide" onClick={() => set({ interventions: Array.from(new Set([...active, ...plan.interventions])) })}>
          Switch on all three
        </button>
      ) : (
        <div className="plan-btns">
          <button className="btn" onClick={() => openPlan(b.regionId, 'en')}>
            ⬇ 1-page plan
          </button>
          <button className="btn" onClick={() => openPlan(b.regionId, 'fi')} lang="fi">
            ⬇ Suomeksi
          </button>
        </div>
      )}
    </Card>
  );
}

const AI_QUESTION = 'Who is being left behind in Lapland, and what should the county do first?';

function StepAI() {
  const a = useStore((s) => s.profileA);
  const b = useStore((s) => s.profileB);
  const set = useStore((s) => s.set);
  const [reply, setReply] = useState<AgentReply | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    askAgent([{ role: 'user', text: AI_QUESTION }], { regionId: b.regionId, interventions: [], profileA: a, profileB: b })
      .then((r) => alive && setReply(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [a, b]);
  return (
    <Card
      title="An AI analyst that reads the whole national cancer strategy, and never invents a number."
      foot="Gemini reads the full strategy and roadmap (about 150,000 words of Finnish), runs Polku's simulator as tools, cites the page, and Polku checks every number in the answer."
    >
      <div className="bubble-user">{AI_QUESTION}</div>
      <div className="answer card compact">
        {reply ? (
          <AnswerBody reply={reply} />
        ) : failed ? (
          <p className="muted">The AI server is offline right now. Open the simulator to see the same analysis computed locally.</p>
        ) : (
          <div className="thinking">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            Reading the roadmap and running simulations…
          </div>
        )}
      </div>
      <button className="btn wide" onClick={() => set({ askOpen: true })}>
        Ask your own question
      </button>
    </Card>
  );
}

function StepTrust() {
  const sim = useSim();
  const set = useStore((s) => s.set);
  const a = useStore((s) => s.profileA);
  const b = useStore((s) => s.profileB);
  const cautiousGap = useMemo(() => {
    const p = JSON.parse(JSON.stringify(rawParams));
    const occ = p.entry_routes.routes[1].multipliers;
    for (const k in occ) occ[k] = 1 - (1 - occ[k]) / 2; // entry-route effect halved
    for (const l of p.patient_factors.education.levels) l.multipliers = {}; // no education effect
    p.patient_factors.navigation_barrier.multipliers = {}; // no navigation effect
    const m = buildModel(parseParams(p), parseRegions(rawRegions, rawIndicators));
    return compareProfiles(m, a, b).gapDays;
  }, [a, b]);
  return (
    <Card
      title="Can you trust these numbers? Here is exactly how far."
      foot="Decision support for planners. Public aggregated data only, no patient records. Not a medical device."
    >
      <ul className="trust">
        <li>
          <b>Real public data</b> for all 22 wellbeing counties and 292 municipalities: THL waiting times, education and Statistics Finland population and distances.
        </li>
        <li>
          <b>Every number has a source</b> and a confidence level. Anything modelled is labelled “Estimate”.
        </li>
        <li>
          <b>Honest about uncertainty:</b> Matti B's gap is <b>{d0(sim.comparisonBase.gapDays)} days</b> with our assumptions, and still <b>{d0(cautiousGap)} days</b> with very cautious ones.
        </li>
        <li>
          <b>The first recommendation is to measure.</b> Finland does not record these times yet, so a pilot with one wellbeing county (for example North Ostrobothnia) would calibrate Polku with real data through Findata.
        </li>
      </ul>
      <div className="plan-btns">
        <button className="btn" onClick={() => set({ showAssumptions: true })}>
          See all sources
        </button>
        <button className="btn" onClick={() => set({ showTable: true })}>
          All regions as a table
        </button>
      </div>
    </Card>
  );
}

const STEPS = [StepGap, StepPatients, StepWhere, StepWhy, StepAct, StepAI, StepTrust];

export function Tour() {
  const step = useStore((s) => s.step);
  const goStep = useStore((s) => s.goStep);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || useStore.getState().askOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goStep(useStore.getState().step + 1);
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goStep(useStore.getState().step - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goStep]);
  const Step = STEPS[step];
  return (
    <>
      <div className="tour-col">
        <Step key={step} />
      </div>
      <nav className="stepper glass" aria-label="Tour steps">
        {TOUR_STEPS.map((s, i) => (
          <button key={s.id} className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} onClick={() => goStep(i)} aria-current={i === step ? 'step' : undefined}>
            <span className="step-n">{i < step ? '✓' : i + 1}</span>
            <span className="step-label">{s.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
