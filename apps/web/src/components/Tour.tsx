import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { bestPortfolio, buildModel, compareProfiles, parseParams, parseRegions, profileTotal } from '@polku/sim';
import { rawAiEffects, rawIndicators, rawParams, rawRegions } from '@polku/sim/data';
import { openPlan } from '../state/plan';
import { model, useSim } from '../state/sim';
import { applyWhatIf, TOUR_STEPS, useStore, type WhatIf } from '../state/store';
import { JourneyBars } from './JourneyBars';
import { AiTrail, DesignBox, plainText } from './AiDesign';
import { ACTION_DESC, d0, SHORT } from './ui';

/* ---------------- shared bits ---------------- */

function Card({ title, children, mapNote, howKnow }: { title: ReactNode; children?: ReactNode; mapNote?: ReactNode; howKnow?: ReactNode }) {
  const step = useStore((s) => s.step);
  const goStep = useStore((s) => s.goStep);
  const setMode = useStore((s) => s.setMode);
  const [open, setOpen] = useState(false);
  const last = step === TOUR_STEPS.length - 1;
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headRef.current?.focus({ preventScroll: true }), [step]);
  return (
    <section className="tour-card glass fade-in" aria-live="polite" aria-labelledby="tour-title">
      <div className="tour-meta">
        <span className="tour-count">
          Step {step + 1} of {TOUR_STEPS.length}
        </span>
        <span className="tour-ask" title="What the AstraZeneca challenge asks for">
          ✓ {TOUR_STEPS[step].ask}
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
      {howKnow && (
        <div className="how">
          <button className="how-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? '▾' : '▸'} How do we know?
          </button>
          {open && <div className="how-body fade-in">{howKnow}</div>}
        </div>
      )}
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
      howKnow={
        <>
          The national averages come from a Finnish study of four hospital districts (Kuittinen, reported by Yle in 2025). The results are preliminary. The colours for each
          region are estimated from public data: waiting times in primary and specialist care (THL), education levels and distance to hospital for every municipality
          (Statistics Finland).
        </>
      }
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
          Two people, same lung cancer. One waits <span className="hl-b">{d0(c.gapDays)} days longer</span>.
        </>
      }
      mapNote="Now the map shows how long Patient B would wait in each municipality. Lapland, where Patient B lives, is raised."
      howKnow={
        <>
          Patient A and Patient B are fictional. AstraZeneca asked: “Do two patients with the same cancer have an equal chance, regardless of where they live, their income,
          education or ability to navigate the system?” Polku simulates 4,000 patients like each of them, using public data for their region and published Finnish evidence
          for the effect of their entry route.
        </>
      }
    >
      <div className="duo">
        <div className="duo-item">
          <div className="duo-name" style={{ color: 'var(--a)' }}>Patient A</div>
          <div className="duo-num" style={{ color: 'var(--a)' }}>
            {d0(c.a.totalMeanDays)}
            <span>days</span>
          </div>
          <div className="duo-desc">Works, uses work health care, lives near Oulu University Hospital.</div>
        </div>
        <div className="duo-item">
          <div className="duo-name" style={{ color: 'var(--b)' }}>Patient B</div>
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
          <span className="hl-b">{Math.round(c.shareBeforeReferral * 100)}%</span> of the difference happens before a specialist ever sees them.
        </>
      }
      mapNote="Patient B's Finland: almost every municipality is orange or red."
      howKnow={<>The three stretches group the 8-step patient pathway AstraZeneca shared with all teams: from the first symptom to the first doctor, the time in primary care until the referral is sent, and the time in hospital from the referral to the first treatment.</>}
    >
      <p className="tour-text" style={{ marginTop: 0 }}>
        The delay is not inside the hospital. It is in <b>getting there</b>: noticing the symptoms, getting a doctor's appointment, getting referred.
      </p>
      <JourneyBars a={c.a} b={c.b} />
    </Card>
  );
}

const WHATIF_ROWS: { k: keyof WhatIf; label: string; detail: string }[] = [
  { k: 'route', label: 'Give them work health care', detail: 'instead of the public health centre' },
  { k: 'near', label: 'Move them near the hospital', detail: '10 km instead of 180 km' },
  { k: 'help', label: 'Someone helps them through the system', detail: 'no longer alone with appointments and referrals' },
  { k: 'edu', label: 'Give them a university degree', detail: 'better at recognising symptoms early' },
];
const NONE: WhatIf = { route: false, near: false, edu: false, help: false };

function StepWhy() {
  const sim = useSim();
  const b = useStore((s) => s.profileB);
  const whatIf = useStore((s) => s.whatIf);
  const toggle = useStore((s) => s.toggleWhatIf);
  const now = useMemo(() => profileTotal(model, applyWhatIf(b, whatIf)), [b, whatIf]);
  const base = sim.comparisonBase.b.totalMeanDays;
  const aDays = sim.comparisonBase.a.totalMeanDays;
  const alone = useMemo(() => Object.fromEntries(WHATIF_ROWS.map((r) => [r.k, base - profileTotal(model, applyWhatIf(b, { ...NONE, [r.k]: true }))])), [b, base]);
  return (
    <Card
      title="None of it is medical. Change one thing about Patient B and watch."
      mapNote="Every switch you flip recolours Patient B's Finland."
      howKnow={
        <>
          The effect of work health care comes from Finnish lymphoma patients (123 vs 207 days, Kuitunen 2026) and is applied to lung cancer as an assumption. The effects of
          education and of living alone are assumptions based on Finnish and Nordic studies of social inequality in cancer care. All of them can be edited in the sources panel.
        </>
      }
    >
      {WHATIF_ROWS.map((r) => (
        <Switch key={r.k} on={whatIf[r.k]} onClick={() => toggle(r.k)} label={r.label} detail={r.detail} effect={<>−{d0(alone[r.k])} d</>} />
      ))}
      <div className="live-compare" aria-live="polite">
        <NumberBar label="Patient B" value={now} max={240} color="#fb7185" strong />
        <NumberBar label="Patient A" value={aDays} max={240} color="#22d3ee" />
        {now < base - 0.5 && (
          <div className="live-delta">
            Patient B now waits <b>{d0(base - now)} days less</b>.
          </div>
        )}
      </div>
    </Card>
  );
}



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
  const aiModel = (rawAiEffects as any).model ?? 'Gemini';
  return (
    <Card
      title={`The AI recommends three actions from the national roadmap for ${region.nameEn}.`}
      mapNote={`Switch them on and watch ${region.nameEn} turn greener.`}
      howKnow={
        <>
          <AiTrail
            running={false}
            steps={[
              'Read the national cancer strategy and its roadmap (Finnish, about 150,000 words)',
              'Read the evidence: Nordic fast-track pathways, nurse navigators, e-consultation, distance studies',
              'Estimated how much each of the 9 actions shortens each phase, with a range and a confidence level',
              `Simulated 512 combinations for ${region.nameEn} and chose the one that closes the gap most within a medium effort`,
            ]}
          />
          The effect sizes were estimated by {aiModel} from the evidence and are shown with their range. Open “Why?” under each action to read its reasoning.
        </>
      }
    >
      <div className="act-zero">
        <span className="act-num">0</span>
        <div>
          <b>Start measuring.</b> <span className="muted">Finland does not record these waiting times today.</span>
        </div>
      </div>
      {plan.interventions.map((id) => {
        const iv = model.interventionsById.get(id)!;
        return (
          <div key={id} className="act-wrap">
            <Switch
              on={active.includes(id)}
              onClick={() => toggle(id)}
              label={SHORT[id] ?? iv.label}
              detail={ACTION_DESC[id]}
            />
            {iv.rationale && (
              <details className="why-est">
                <summary>Why the AI expects this effect</summary>
                <p>{plainText(iv.rationale)}</p>
                {iv.roadmapActions[0] && (
                  <p>
                    Part of national roadmap action {iv.roadmapActions[0].id} (page {iv.roadmapActions[0].page}).
                  </p>
                )}
              </details>
            )}
          </div>
        );
      })}
      <div className="impact">
        <div>
          <div className="impact-k">Patient B waits</div>
          <div className="impact-v">
            {d0(c.b.totalMeanDays)}
            <span> days</span>
          </div>
          <div className={`impact-d ${c0.b.totalMeanDays - c.b.totalMeanDays > 0.5 ? '' : 'idle'}`}>
            {c0.b.totalMeanDays - c.b.totalMeanDays > 0.5 ? `−${d0(c0.b.totalMeanDays - c.b.totalMeanDays)} days` : 'switch an action on'}
          </div>
        </div>
        <div>
          <div className="impact-k">Gap to Patient A</div>
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

function StepAI() {
  const b = useStore((s) => s.profileB);
  return (
    <Card
      title="Have your own idea? The AI estimates it from the evidence and simulates it."
      mapNote="Add the action to the plan and the map updates."
      howKnow={
        <>
          Gemini reads the national strategy, the roadmap and our evidence notes, decides which part of the pathway the idea would change and by how much, and gives a
          range and a confidence level. The days are then calculated by Polku's simulator, never by the language model, so every number can be traced. The AI also says
          when an idea is unlikely to help.
        </>
      }
    >
      <DesignBox regionId={b.regionId} autoRun />
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
    const m = buildModel(parseParams(p, rawAiEffects as any), parseRegions(rawRegions, rawIndicators));
    return compareProfiles(m, a, b).gapDays;
  }, [a, b]);
  return (
    <Card title="Can you trust it? Here is exactly how far.">
      <ul className="trust">
        <li>
          <b>Real public data</b> for all 22 wellbeing counties and 292 municipalities.
        </li>
        <li>
          <b>The AI never invents a number.</b> It estimates effects from cited evidence; the simulator calculates the days; Polku checks every figure.
        </li>
        <li>
          <b>Honest about uncertainty:</b> Patient B's gap is <b>{d0(sim.comparisonBase.gapDays)} days</b>, and still <b>{d0(cautiousGap)} days</b> with very cautious
          assumptions.
        </li>
        <li>
          <b>Next step:</b> a pilot with one wellbeing county, starting to measure these times and calibrating Polku with real data through Findata.
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
