import { useEffect, useMemo } from 'react';
import { bestPortfolio, compareProfiles } from '@polku/sim';
import { model, useSim } from '../state/sim';
import { STORY_STEPS, useStore } from '../state/store';
import { StepTimeline } from './StepTimeline';
import { openPlan } from '../state/plan';
import { d0, FACTOR_COLOR, ROUTE_LABEL, SHORT } from './ui';

const WHY: Record<string, string> = {
  public_fast_lane: 'Suspected cancer goes straight onto the fast track from the public health centre.',
  navigator: 'A named nurse guides patients who live alone or find the system hard to navigate.',
  travel_cost_support: 'Organised, reimbursed travel for patients far from hospital.',
  awareness: 'Multilingual campaign so symptoms are not dismissed or stigmatised.',
  fast_track: 'A standardised, Nordic-style diagnostic pathway.',
  econsult: 'The GP asks the lung specialist online instead of waiting for a referral.',
  remote_care: 'Remote oncology visits, so fewer long trips.',
  gp_continuity: 'The same family doctor every time.',
  direct_ct: 'The GP can order a CT scan directly.',
};

function Card({ eyebrow, title, children, foot }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="story-card glass fade-in">
      <div className="eyebrow">{eyebrow}</div>
      <div className="story-title">{title}</div>
      {children}
      {foot && <div className="story-foot">{foot}</div>}
    </div>
  );
}

function NumberBar({ label, value, max, color, strong }: { label: string; value: number; max: number; color: string; strong?: boolean }) {
  return (
    <div className="nbar">
      <div className="nbar-label" style={{ fontWeight: strong ? 800 : 600 }}>{label}</div>
      <div className="nbar-track">
        <div className="nbar-fill" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <div className="nbar-val" style={{ color }}>
        {d0(value)} <span>days</span>
      </div>
    </div>
  );
}

function StepGap() {
  const sim = useSim();
  const fi = sim.national.base;
  return (
    <Card
      eyebrow="Lung cancer in Finland"
      title={<>Five months from first symptom to treatment.</>}
      foot={<>Preliminary national averages (Kuittinen study, Yle 2025). Map colour: estimated days per wellbeing county from public THL data. Click a county to raise it.</>}
    >
      <NumberBar label="Finland" value={fi} max={170} color="#fb7185" strong />
      <NumberBar label="Sweden" value={107} max={170} color="#60a5fa" />
      <NumberBar label="Denmark" value={67} max={170} color="#2dd4bf" />
    </Card>
  );
}

function StepTwoPatients() {
  const sim = useSim();
  const a = useStore((s) => s.profileA);
  const b = useStore((s) => s.profileB);
  const c = sim.comparisonBase;
  const desc = (p: typeof a) => `${model.byId.get(p.regionId)!.nameEn} · ${ROUTE_LABEL[p.route].toLowerCase()}${p.navigationBarrier ? ' · lives alone' : ''}`;
  return (
    <Card
      eyebrow="Same cancer. Same chance?"
      title={
        <>
          Matti B starts treatment <span style={{ color: 'var(--b)' }}>{d0(c.gapDays)} days later</span>.
        </>
      }
      foot={<>Two fictional patients, same lung cancer, same symptoms. Map: the days Matti B would wait in each municipality. Estimate.</>}
    >
      <div className="duo">
        <div className="duo-item">
          <div className="duo-name" style={{ color: 'var(--a)' }}>Matti A</div>
          <div className="duo-num" style={{ color: 'var(--a)' }}>{d0(c.a.totalMeanDays)}<span>days</span></div>
          <div className="duo-desc">{desc(a)}</div>
        </div>
        <div className="duo-item">
          <div className="duo-name" style={{ color: 'var(--b)' }}>Matti B</div>
          <div className="duo-num" style={{ color: 'var(--b)' }}>{d0(c.b.totalMeanDays)}<span>days</span></div>
          <div className="duo-desc">{desc(b)}</div>
        </div>
      </div>
      <div className="story-line">
        <b>{Math.round(c.shareBeforeReferral * 100)}%</b> of the gap opens before a specialist ever sees him.
      </div>
      <StepTimeline a={c.a} b={c.b} compact />
    </Card>
  );
}

function StepWhy() {
  const sim = useSim();
  const c = sim.comparisonBase;
  const top = [...c.attribution].filter((f) => f.days > 0.5).sort((x, y) => y.days - x.days).slice(0, 3);
  const max = Math.max(...top.map((f) => f.days));
  return (
    <Card
      eyebrow="Why?"
      title={<>None of it is medical.</>}
      foot={<>Entry-route effect from Finnish lymphoma data (Kuitunen 2026), applied to lung cancer as an assumption. Every assumption is listed and editable.</>}
    >
      <div className="story-line" style={{ marginTop: 0 }}>It is about how Matti B enters care, how far he lives, and how easily he can navigate the system.</div>
      {top.map((f) => (
        <div key={f.factor} className="why-row">
          <div className="why-label">{f.label}</div>
          <div className="nbar-track">
            <div className="nbar-fill" style={{ width: `${(f.days / max) * 100}%`, background: FACTOR_COLOR[f.factor] }} />
          </div>
          <div className="why-val">+{d0(f.days)} d</div>
        </div>
      ))}
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
  const savedB = c0.b.totalMeanDays - c.b.totalMeanDays;
  const gapClosed = c0.gapDays - c.gapDays;
  const allOn = plan.interventions.every((id) => active.includes(id));

  return (
    <Card
      eyebrow={`What should ${region.nameEn} do first?`}
      title={<>Three actions from the national roadmap.</>}
      foot={<>Chosen to close the gap within a medium effort budget. Effects are estimates with evidence ranges; every number has a source.</>}
    >
      <div className="act-zero">
        <span className="act-num">0</span>
        <div>
          <b>Start measuring.</b> <span className="muted">Finland doesn't record these times. Three dates, entry route and education per patient.</span>
        </div>
      </div>
      {plan.interventions.map((id, i) => {
        const on = active.includes(id);
        const iv = model.interventionsById.get(id)!;
        return (
          <button key={id} className={`act-item ${on ? 'on' : ''}`} onClick={() => toggle(id)}>
            <span className="act-num">{i + 1}</span>
            <div style={{ textAlign: 'left' }}>
              <b>{SHORT[id]}</b>
              <div className="act-why">{WHY[id]}</div>
              <span className="tag roadmap">Roadmap {iv.roadmapActions[0]?.id} · p.{iv.roadmapActions[0]?.page}</span>
            </div>
            <span className={`sw ${on ? 'on' : ''}`} />
          </button>
        );
      })}
      <div className="impact">
        <div>
          <div className="impact-k">Matti B</div>
          <div className="impact-v">
            {d0(c.b.totalMeanDays)}<span> days</span>
          </div>
          <div className={`impact-d ${savedB > 0.5 ? '' : 'idle'}`}>{savedB > 0.5 ? `−${d0(savedB)} days` : 'no change yet'}</div>
        </div>
        <div>
          <div className="impact-k">Gap to Matti A</div>
          <div className="impact-v" style={{ color: '#f0abfc' }}>
            {d0(c.gapDays)}<span> days</span>
          </div>
          <div className={`impact-d ${gapClosed > 0.5 ? '' : 'idle'}`}>{gapClosed > 0.5 ? `−${d0(gapClosed)} days` : '—'}</div>
        </div>
      </div>
      {!allOn ? (
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={() => set({ interventions: Array.from(new Set([...active, ...plan.interventions])) })}>
          Apply all three
        </button>
      ) : (
        <div className="plan-btns">
          <button className="btn primary" onClick={() => openPlan(b.regionId, 'en')}>
            1-page plan
          </button>
          <button className="btn" onClick={() => openPlan(b.regionId, 'fi')} title="Toimintasuunnitelma suomeksi">
            Suomeksi
          </button>
          <button className="btn" onClick={() => set({ mode: 'explore', tab: 'ask' })}>
            Ask Polku
          </button>
        </div>
      )}
    </Card>
  );
}

export function Story() {
  const step = useStore((s) => s.step);
  const goStep = useStore((s) => s.goStep);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
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

  return (
    <>
      <div className="story-col">
        {step === 0 && <StepGap key="0" />}
        {step === 1 && <StepTwoPatients key="1" />}
        {step === 2 && <StepWhy key="2" />}
        {step === 3 && <StepAct key="3" />}
      </div>
      <nav className="stepper glass">
        <button className="step-arrow" onClick={() => goStep(step - 1)} disabled={step === 0} aria-label="Previous">
          ‹
        </button>
        {STORY_STEPS.map((label, i) => (
          <button key={label} className={`step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`} onClick={() => goStep(i)}>
            <span className="step-n">{i + 1}</span>
            {label}
          </button>
        ))}
        <button className="step-arrow" onClick={() => goStep(step + 1)} disabled={step === STORY_STEPS.length - 1} aria-label="Next">
          ›
        </button>
      </nav>
    </>
  );
}
