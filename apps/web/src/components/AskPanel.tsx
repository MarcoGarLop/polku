import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { findLeftBehind } from '@polku/sim';
import { askAgent, getHealth, type AgentReply, type Health } from '../state/api';
import { model, useSim } from '../state/sim';
import { useStore } from '../state/store';
import { d0, EDU_LABEL } from './ui';

interface Turn { role: 'user' | 'assistant'; text: string; reply?: AgentReply; offline?: boolean; error?: string }

const TOOL_LABEL: Record<string, string> = {
  list_regions: 'compared all 22 counties',
  get_region_profile: 'read county profile',
  compare_patients: 'compared two patients',
  find_left_behind: 'searched 36 patient profiles',
  simulate_scenario: 'ran a scenario',
  rank_interventions: 'ranked 10 actions',
  best_plan: 'searched 512 action combinations',
  get_evidence: 'checked the evidence',
  ui_command: 'moved the map',
};

/** Minimal markdown: paragraphs, bullets, **bold**, and [ROADMAP p.N] citations as chips. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]*(?:ROADMAP|STRATEGY)[^\]]*\])/gi).map((part, i) => {
    if (/^\*\*.*\*\*$/.test(part)) return <b key={i}>{part.slice(2, -2)}</b>;
    if (/^\[.*(ROADMAP|STRATEGY).*\]$/i.test(part)) return <span key={i} className="cite">{part.slice(1, -1)}</span>;
    return <Fragment key={i}>{part.replace(/(^|\s)\*(\S[^*]*)\*(?=\s|$|[.,])/g, '$1$2')}</Fragment>;
  });
}
function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter(Boolean);
        if (lines.every((l) => /^\s*[*-]\s+/.test(l)))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[*-]\s+/, ''))}</li>
              ))}
            </ul>
          );
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l.replace(/^\s*[*-]\s+/, '• '))}</Fragment>)}</p>;
      })}
    </>
  );
}

export function AskPanel() {
  const sim = useSim();
  const set = useStore((s) => s.set);
  const selectRegion = useStore((s) => s.selectRegion);
  const selected = useStore((s) => s.selectedRegion);
  const interventions = useStore((s) => s.interventions);
  const profileA = useStore((s) => s.profileA);
  const profileB = useStore((s) => s.profileB);
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const region = model.byId.get(sim.focusRegion)!;

  useEffect(() => {
    getHealth().then(setHealth);
  }, []);
  useEffect(() => {
    // braces matter: newer browsers return a Promise from scrollIntoView, which React would treat as a cleanup
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  const applyCommands = (cmds: AgentReply['mapCommands']) => {
    for (const c of cmds) {
      if (c.action === 'flyTo' && c.regionId) selectRegion(c.regionId);
      if (c.action === 'overview') selectRegion(null);
      if (c.action === 'applyInterventions' && c.interventions) set({ interventions: c.interventions });
      if (c.metric === 'days' || c.metric === 'gap') set({ metric: c.metric });
      if (c.metric === 'patientB' || c.metric === 'patientA') set({ metric: 'patient', lens: c.metric === 'patientA' ? 'A' : 'B' });
    }
  };

  /** Offline: answer the left-behind question with the same deterministic tool the agent uses. */
  const offlineAnswer = (): string => {
    const top = findLeftBehind(model, region.id, interventions, 1)[0];
    return `Offline answer from the simulator. In ${region.nameEn} the most delayed profile is a patient on the public route with ${EDU_LABEL[top.profile.education].toLowerCase()}${
      top.profile.navigationBarrier ? ' who lives alone or is over 75' : ''
    }: about **${d0(top.totalMeanDays)} days** to treatment, ${d0(top.extraDaysVsBest)} more than the best-placed patient. Biggest levers: ${top.topFactors
      .slice(0, 2)
      .map((f) => f.label.toLowerCase())
      .join(' and ')}.`;
  };

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const history = [...turns, { role: 'user' as const, text: q.trim() }];
    setTurns(history);
    setInput('');
    setBusy(true);
    try {
      const reply = await askAgent(
        history.filter((t) => !t.error).map((t) => ({ role: t.role, text: t.text })),
        { regionId: selected ?? sim.focusRegion, interventions, profileA, profileB },
      );
      setTurns([...history, { role: 'assistant', text: reply.text, reply }]);
      applyCommands(reply.mapCommands);
    } catch (e: any) {
      setTurns([...history, { role: 'assistant', text: offlineAnswer(), offline: true, error: String(e?.message ?? e) }]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    `Who is being left behind in ${region.nameEn}, and what should the county do first?`,
    'Why does Matti B wait so much longer than Matti A?',
    `What does the national roadmap say about standardised referral criteria, and how much would they help ${region.nameEn}?`,
    'Which counties lose the most time, and is it a capacity or an equity problem?',
  ];

  return (
    <div className="fade-in ask">
      <div className="row between">
        <h2>Ask Polku</h2>
        {health === undefined ? null : health ? (
          <span className="badge real" title={`Model ${health.model}`}>Gemini · live</span>
        ) : (
          <span className="badge est">Offline mode</span>
        )}
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>
        Gemini reads the full national cancer strategy and roadmap{health?.context.tokens ? ` (${d0(health.context.tokens / 1000)}k tokens, Finnish)` : ''} and runs Polku's
        simulator. Every number must come from the simulator; Polku checks it.
      </div>

      {turns.length === 0 && (
        <div style={{ marginTop: 14 }}>
          {suggestions.map((s) => (
            <button key={s} className="ask-q" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="chat">
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="bubble-user">{t.text}</div>
          ) : (
            <div key={i} className="answer card fade-in">
              {t.reply && t.reply.toolCalls.length > 0 && (
                <div className="tools">
                  {Array.from(new Set(t.reply.toolCalls.map((c) => c.name))).map((n) => (
                    <span key={n}>⚙ {TOOL_LABEL[n] ?? n}</span>
                  ))}
                </div>
              )}
              <Markdown text={t.text} />
              <div className="answer-foot">
                {t.reply ? (
                  t.reply.verification.unverified.length === 0 ? (
                    <span className="verify ok">✓ {t.reply.verification.checked} numbers traced to the simulator or the documents</span>
                  ) : (
                    <span className="verify warn">⚠ Not traced: {t.reply.verification.unverified.join(', ')}</span>
                  )
                ) : (
                  <span className="verify warn">Offline: Gemini unreachable</span>
                )}
                {t.reply && (
                  <span className="faint">
                    {t.reply.model} · {t.reply.mode === 'demo-cache' ? 'recorded answer' : `${(t.reply.ms / 1000).toFixed(1)} s`}
                  </span>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="answer card thinking">
            <span className="dots"><i /><i /><i /></span> Reading the roadmap and running simulations…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about ${region.nameEn} or any county…`} disabled={busy} />
        <button className="btn primary" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
      {turns.length > 0 && (
        <button className="linkish" style={{ marginTop: 8 }} onClick={() => setTurns([])}>
          New conversation
        </button>
      )}
    </div>
  );
}
