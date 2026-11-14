import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { findLeftBehind } from '@polku/sim';
import { askAgent, getHealth, type AgentReply, type Health } from '../state/api';
import { model } from '../state/sim';
import { useStore } from '../state/store';
import { d0, EDU_LABEL } from './ui';

interface Turn { role: 'user' | 'assistant'; text: string; reply?: AgentReply; offline?: boolean }

const TOOL_LABEL: Record<string, string> = {
  list_regions: 'compared all 22 regions',
  get_region_profile: 'read a region profile',
  compare_patients: 'compared two patients',
  find_left_behind: 'searched 36 patient profiles',
  simulate_scenario: 'ran a scenario',
  rank_interventions: 'ranked 10 actions',
  best_plan: 'searched 512 action combinations',
  get_evidence: 'checked the evidence',
  ui_command: 'moved the map',
};

/** "ROADMAP p.52, STRATEGY p.30" → "national roadmap, page 52; national strategy, page 30" */
const citeWords = (c: string) =>
  c.replace(/ROADMAP/gi, 'national roadmap').replace(/STRATEGY/gi, 'national strategy').replace(/\bp\.\s?(\d+)/g, 'page $1');

/** Minimal markdown: paragraphs, bullets, **bold**, and [ROADMAP p.N] citations as chips. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]*(?:ROADMAP|STRATEGY)[^\]]*\])/gi).map((part, i) => {
    if (/^\*\*.*\*\*$/.test(part)) return <b key={i}>{part.slice(2, -2)}</b>;
    if (/^\[.*(ROADMAP|STRATEGY).*\]$/i.test(part)) return <span key={i} className="cite-plain">({citeWords(part.slice(1, -1))})</span>;
    return <Fragment key={i}>{part.replace(/(^|\s)\*(\S[^*]*)\*(?=\s|$|[.,])/g, '$1$2')}</Fragment>;
  });
}
function Markdown({ text }: { text: string }) {
  return (
    <>
      {text
        .trim()
        .split(/\n{2,}/)
        .map((b, i) => {
          const lines = b.split('\n').filter(Boolean);
          if (lines.every((l) => /^\s*([*-]|\d+\.)\s+/.test(l)))
            return (
              <ul key={i}>
                {lines.map((l, j) => (
                  <li key={j}>{inline(l.replace(/^\s*([*-]|\d+\.)\s+/, ''))}</li>
                ))}
              </ul>
            );
          return (
            <p key={i}>
              {lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(l.replace(/^\s*[*-]\s+/, '• '))}
                </Fragment>
              ))}
            </p>
          );
        })}
    </>
  );
}

/** One AI answer: what it did, what it said, and whether every number checks out. */
export function AnswerBody({ reply }: { reply: AgentReply }) {
  return (
    <>
      {reply.toolCalls.length > 0 && (
        <div className="tools" aria-label="What the AI did">
          {Array.from(new Set(reply.toolCalls.map((c) => c.name))).map((n) => (
            <span key={n}>⚙ {TOOL_LABEL[n] ?? n}</span>
          ))}
        </div>
      )}
      <Markdown text={reply.text} />
      <div className="answer-foot">
        {reply.verification.unverified.length === 0 ? (
          <span className="verify ok">✓ All {reply.verification.checked} numbers traced to the simulator or the documents</span>
        ) : (
          <span className="verify warn">⚠ Not traced: {reply.verification.unverified.join(', ')}</span>
        )}
        <span className="faint">Gemini · {reply.mode === 'demo-cache' ? 'recorded answer' : `${(reply.ms / 1000).toFixed(0)} s`}</span>
      </div>
    </>
  );
}

/** Side drawer: free conversation with the AI analyst. */
export function AskDrawer() {
  const open = useStore((s) => s.askOpen);
  const set = useStore((s) => s.set);
  const selected = useStore((s) => s.selectedRegion);
  const interventions = useStore((s) => s.interventions);
  const profileA = useStore((s) => s.profileA);
  const profileB = useStore((s) => s.profileB);
  const mode = useStore((s) => s.mode);
  const patient = useStore((s) => s.patient);
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const regionId = selected ?? profileB.regionId;
  const region = model.byId.get(regionId)!;

  useEffect(() => {
    if (open) {
      getHealth().then(setHealth);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set({ askOpen: false });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set]);

  if (!open) return null;

  const applyCommands = (cmds: AgentReply['mapCommands']) => {
    for (const c of cmds) {
      if (c.action === 'flyTo' && c.regionId) set({ selectedRegion: c.regionId });
      if (c.action === 'overview') set({ selectedRegion: null });
    }
  };

  const offlineAnswer = (): string => {
    const top = findLeftBehind(model, region.id, interventions, 1)[0];
    return `The AI is offline, so this is the simulator alone. In ${region.nameEn} the most delayed patients use the public route, have ${EDU_LABEL[top.profile.education].toLowerCase()}${
      top.profile.navigationBarrier ? ' and live alone or are over 75' : ''
    }: about **${d0(top.totalMeanDays)} days** to treatment, ${d0(top.extraDaysVsBest)} more than the best-placed patient.`;
  };

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const history = [...turns, { role: 'user' as const, text: q.trim() }];
    setTurns(history);
    setInput('');
    setBusy(true);
    try {
      const reply = await askAgent(
        history.filter((t) => !t.offline).map((t) => ({ role: t.role, text: t.text })),
        { regionId, interventions, profileA, profileB: mode === 'sim' ? patient : profileB },
      );
      setTurns([...history, { role: 'assistant', text: reply.text, reply }]);
      applyCommands(reply.mapCommands);
    } catch {
      setTurns([...history, { role: 'assistant', text: offlineAnswer(), offline: true }]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    `Who is being left behind in ${region.nameEn}, and what should the region do first?`,
    'Why does Patient B wait so much longer than Patient A?',
    `What does the national roadmap say about standardised referral criteria, and how much would they help ${region.nameEn}?`,
    'Which regions lose the most time, and is it a capacity or an equity problem?',
  ];

  return (
    <aside className="drawer glass fade-in" role="dialog" aria-label="Ask Polku, the AI analyst">
      <div className="drawer-head">
        <div>
          <h2>Ask Polku</h2>
          <div className="small muted">AI analyst · reads the national cancer strategy · runs the simulator</div>
        </div>
        <button className="icon-btn" onClick={() => set({ askOpen: false })} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="drawer-status">
        {health === undefined ? null : health ? <span className="badge real">AI online</span> : <span className="badge est">AI offline · simulator answers only</span>}
      </div>
      <div className="drawer-body">
        {turns.length === 0 && (
          <>
            <div className="small muted" style={{ marginBottom: 8 }}>
              Try one of these:
            </div>
            {suggestions.map((s) => (
              <button key={s} className="ask-q" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </>
        )}
        <div className="chat">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="bubble-user">
                {t.text}
              </div>
            ) : (
              <div key={i} className="answer card fade-in">
                {t.reply ? <AnswerBody reply={t.reply} /> : <Markdown text={t.text} />}
              </div>
            ),
          )}
          {busy && (
            <div className="answer card thinking">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              Reading the roadmap and running simulations… (about 15 s)
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <input id="ask-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about lung cancer care in Finland…" disabled={busy} />
        <button className="btn primary" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
    </aside>
  );
}
