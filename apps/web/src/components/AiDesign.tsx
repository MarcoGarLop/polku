import { useEffect, useMemo, useRef, useState } from 'react';
import { compareProfiles, interventionFromAi, registerIntervention, type AiEstimate } from '@polku/sim';
import { designAction, type DesignReply } from '../state/api';
import { model } from '../state/sim';
import { useStore } from '../state/store';
import { d0 } from './ui';

const PHASE_WORDS: Record<string, string> = {
  P1: 'noticing symptoms',
  P2: 'primary care',
  P3: 'getting to a specialist',
  P4: 'diagnosis',
  P5: 'starting treatment',
};
const WHO: Record<string, string> = {
  all: 'all patients',
  public_route: 'public health centre patients',
  basic_education: 'patients with basic education',
  navigation_barrier: 'patients who live alone or are over 75',
};

/** Replace model-internal tokens with plain words. */
export const plainText = (t: string) =>
  t
    .replace(/\s*\(public_route\)/g, '')
    .replace(/public_route/g, 'public route')
    .replace(/\s*\(navigation_barrier\)/g, '')
    .replace(/navigation_barrier/g, 'people who live alone or are over 75')
    .replace(/\s*\(basic_education\)/g, '')
    .replace(/basic_education/g, 'basic education')
    .replace(/share_of_(phase|distance)_days/g, 'days')
    .replace(/\s{2,}/g, ' ');

/** One line of plain English per estimated effect. */
export function describeEffects(e: AiEstimate): string[] {
  return e.effects.map(
    (f) =>
      `${Math.round(f.mid * 100)}% fewer ${f.kind === 'share_of_distance_days' ? 'travel-related ' : ''}days in ${PHASE_WORDS[f.phase]} for ${WHO[f.appliesTo]} (range ${Math.round(f.low * 100)}–${Math.round(f.high * 100)}%)`,
  );
}

/** The AI's reasoning steps, revealed one after another. */
export function AiTrail({ steps, running }: { steps: string[]; running: boolean }) {
  const [shown, setShown] = useState(running ? 0 : steps.length);
  useEffect(() => {
    if (running) {
      setShown(0);
      const t = setInterval(() => setShown((n) => Math.min(n + 1, 3)), 2200);
      return () => clearInterval(t);
    }
    setShown(0);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= steps.length) clearInterval(t);
    }, 380);
    return () => clearInterval(t);
  }, [running, steps]);
  const placeholder = ['Reading the strategy, the roadmap and the evidence', 'Matching the idea to the national roadmap', 'Estimating the effect on each phase of the pathway'];
  const list = running ? placeholder : steps;
  return (
    <ol className="trail" aria-live="polite">
      {list.slice(0, Math.max(1, shown)).map((s, i) => {
        const done = !running || i < shown - 1;
        return (
          <li key={i} className={done ? 'done' : 'doing'}>
            <span className="trail-dot" aria-hidden>
              {done ? '✓' : ''}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

const IDEAS = [
  'A same-day phone line where public health centre doctors can book a lung specialist assessment for suspected cancer',
  'Volunteer drivers and a named contact person for lung cancer patients who live alone',
  'A mobile CT unit that visits northern Lapland every month',
];

/** Type an idea → the AI estimates it from the evidence → the simulator computes the days → add it to the plan. */
export function DesignBox({ regionId, autoRun = false, compact = false }: { regionId: string; autoRun?: boolean; compact?: boolean }) {
  const profileA = useStore((s) => s.profileA);
  const profileB = useStore((s) => s.profileB);
  const active = useStore((s) => s.interventions);
  const set = useStore((s) => s.set);
  const customActions = useStore((s) => s.customActions);
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<DesignReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const region = model.byId.get(regionId)!;

  const run = async (text: string) => {
    if (busy || text.trim().length < 6) return;
    setIdea(text);
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const r = await designAction(text.trim(), regionId, profileA, profileB);
      registerIntervention(model, interventionFromAi(r.estimate, { model: r.model, custom: true }));
      setReply(r);
    } catch (e: any) {
      setError('The AI is not reachable right now. The recorded examples still work.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      run(IDEAS[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  const id = reply?.estimate.id;
  // Matti B before/after computed here with the same engine and rounding as the rest of the page
  const matti = useMemo(() => (reply ? { before: compareProfiles(model, profileA, profileB, []).b.totalMeanDays, after: compareProfiles(model, profileA, profileB, [reply.estimate.id]).b.totalMeanDays } : null), [reply, profileA, profileB]);
  const on = !!id && active.includes(id);
  const toggle = () => {
    if (!id) return;
    set({
      interventions: on ? active.filter((x) => x !== id) : [...active, id],
      customActions: customActions.includes(id) ? customActions : [...customActions, id],
    });
  };

  return (
    <div className={`design ${compact ? 'compact' : ''}`}>
      <div className="idea-chips" role="list" aria-label="Example ideas">
        {IDEAS.map((t) => (
          <button key={t} role="listitem" className={`idea ${idea === t ? 'on' : ''}`} onClick={() => run(t)} disabled={busy}>
            {t}
          </button>
        ))}
      </div>
      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          run(idea);
        }}
      >
        <label htmlFor={`idea-${compact ? 's' : 't'}`} className="sr-only">
          Describe an action
        </label>
        <input id={`idea-${compact ? 's' : 't'}`} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={`Your idea for ${region.nameEn}…`} disabled={busy} />
        <button className="btn primary" disabled={busy || idea.trim().length < 6}>
          Estimate
        </button>
      </form>

      {(busy || reply) && <AiTrail steps={reply?.trail ?? []} running={busy} />}
      {error && <p className="muted">{error}</p>}

      {reply && (
        <div className="design-result fade-in">
          <div className="row between">
            <b className="design-title">{reply.estimate.label ?? 'New action'}</b>
            <span className={`badge conf-${reply.estimate.confidence}`}>{reply.estimate.confidence} confidence</span>
          </div>
          <ul className="effects">
            {describeEffects(reply.estimate).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="design-why">{plainText(reply.estimate.rationale)}</p>
          <div className="design-numbers">
            <div>
              <span>Matti B</span>
              <b>
                {d0(matti?.before ?? reply.results.mattiB.before)} → {d0(matti?.after ?? reply.results.mattiB.after)} days
              </b>
            </div>
            <div>
              <span>{region.nameEn} average</span>
              <b>
                −{reply.results.regionDaysSaved.mid.toFixed(1)} days{' '}
                <em>
                  ({reply.results.regionDaysSaved.low.toFixed(0)}–{reply.results.regionDaysSaved.high.toFixed(0)})
                </em>
              </b>
            </div>
            <div>
              <span>Gap between patients</span>
              <b>−{reply.results.equityGapClosed.toFixed(1)} days</b>
            </div>
          </div>
          <div className="design-src">
            Roadmap {reply.estimate.roadmapAction || '—'}
            {reply.estimate.roadmapPage ? ` · p.${reply.estimate.roadmapPage}` : ''} · Evidence: {reply.estimate.evidence.join(', ') || 'none found'}
          </div>
          <button className={`btn ${on ? '' : 'primary'} wide`} onClick={toggle} aria-pressed={on}>
            {on ? '✓ Added to the plan (click to remove)' : `Add to ${region.nameEn}'s plan`}
          </button>
        </div>
      )}
    </div>
  );
}
