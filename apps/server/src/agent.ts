import type { Content, Part } from '@google/genai';
import { loadCorpus } from './context';
import { generate } from './gemini';
import { runTool, type ToolContext } from './tools';

export interface ChatMessage { role: 'user' | 'assistant'; text: string }
export interface UiContext {
  regionId?: string | null;
  interventions?: string[];
  profileA?: unknown;
  profileB?: unknown;
}
export interface AgentResponse {
  text: string;
  citations: string[];
  sourceIds: string[];
  toolCalls: { name: string; args: unknown }[];
  mapCommands: Record<string, unknown>[];
  verification: { checked: number; unverified: string[] };
  model: string;
  mode: 'full-context' | 'demo-cache';
  ms: number;
}

const MAX_ROUNDS = 6;

/** Numbers that are fixed published facts used throughout the UI. */
const KNOWN = [155, 154, 107, 67, 42, 3000, 17, 27, 59, 1.47, 50, 123, 207, 84, 51, 36, 47, 25, 14, 3, 22, 21, 8, 5, 4, 2];

function collectNumbers(x: unknown, out: Set<string>) {
  if (typeof x === 'number' && Number.isFinite(x)) {
    for (const v of [x, Math.abs(x)]) {
      out.add(String(Math.round(v)));
      out.add(String(Math.round(v * 10) / 10));
      out.add(String(Math.floor(v)));
      out.add(String(Math.ceil(v)));
    }
  } else if (Array.isArray(x)) x.forEach((v) => collectNumbers(v, out));
  else if (x && typeof x === 'object') Object.values(x).forEach((v) => collectNumbers(v, out));
}

/** Golden rule check: every number in the answer must come from a tool result, the documents or a known published figure. */
export function verifyNumbers(text: string, toolResults: unknown[]): { checked: number; unverified: string[] } {
  const allowed = new Set<string>();
  toolResults.forEach((r) => collectNumbers(r, allowed));
  KNOWN.forEach((k) => collectNumbers(k, allowed));
  const cleaned = text
    .replace(/\[(ROADMAP|STRATEGY)[^\]]*\]/gi, ' ')
    .replace(/\b\d+\.\d+\.\d+\b/g, ' ') // roadmap action ids like 2.5.2
    .replace(/\b(?:action|toimenpide|roadmap)\s+\d+(?:\.\d+)*\b/gi, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ') // years
    .replace(/\bp\.\s?\d+/gi, ' ')
    .replace(/\bS\d{2}\b/g, ' ')
    .replace(/\bP[1-5]\b/g, ' ');
  const nums = cleaned.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const corpus = loadCorpus().full;
  const unverified = nums.filter((n) => {
    const v = parseFloat(n.replace(',', '.'));
    if (Number.isInteger(v) && v <= 10) return false;
    if (allowed.has(String(v)) || allowed.has(String(Math.round(v)))) return false;
    return !new RegExp(`(^|[^\\d])${n.replace('.', '[.,]')}([^\\d]|$)`).test(corpus);
  });
  return { checked: nums.length, unverified: Array.from(new Set(unverified)) };
}

function uiContextText(ui: UiContext): string {
  return `[UI context — selected county: ${ui.regionId ?? 'none (whole Finland)'}; active interventions: ${(ui.interventions ?? []).join(', ') || 'none'}; Matti A: ${JSON.stringify(ui.profileA ?? {})}; Matti B: ${JSON.stringify(ui.profileB ?? {})}]`;
}

export async function runAgent(messages: ChatMessage[], ui: UiContext, opts: { useFallback?: boolean } = {}): Promise<AgentResponse> {
  const t0 = Date.now();
  const contents: Content[] = messages.map((m, i) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === messages.length - 1 && m.role === 'user' ? `${uiContextText(ui)}\n\n${m.text}` : m.text }],
  }));
  const ctx: ToolContext = { mapCommands: [] };
  const toolCalls: AgentResponse['toolCalls'] = [];
  // numbers the user/UI supplied (e.g. Matti B's 180 km) are legitimate too
  const toolResults: unknown[] = [ui];
  let modelUsed = '';
  let mode: AgentResponse['mode'] = 'full-context';
  let text = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { res, model, mode: m } = await generate(contents, opts);
    modelUsed = model;
    mode = m;
    const calls = res.functionCalls ?? [];
    if (!calls.length || round === MAX_ROUNDS - 1) {
      text = res.text ?? '';
      break;
    }
    const modelContent = res.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);
    const parts: Part[] = calls.map((call) => {
      let result: unknown;
      try {
        result = runTool(call.name ?? '', call.args ?? {}, ctx);
      } catch (e: any) {
        result = { error: String(e?.message ?? e) };
      }
      toolCalls.push({ name: call.name ?? '?', args: call.args });
      toolResults.push(result, call.args);
      return { functionResponse: { id: call.id, name: call.name, response: { output: result } } };
    });
    contents.push({ role: 'user', parts });
  }

  // Catches "[ROADMAP p.52]" and combined forms like "[STRATEGY p.30, ROADMAP p.58–59]" or "[ROADMAP p.13, p.63]".
  const citations: string[] = [];
  for (const block of text.match(/\[[^\]]*(?:ROADMAP|STRATEGY)[^\]]*\]/gi) ?? []) {
    let doc = '';
    for (const m of block.matchAll(/(ROADMAP|STRATEGY)?\s*p\.?\s?(\d+(?:[–-]\d+)?)/gi)) {
      if (m[1]) doc = m[1].toUpperCase();
      if (doc) citations.push(`${doc} p.${m[2]}`);
    }
  }
  const uniqueCitations = Array.from(new Set(citations));
  const sourceIds = Array.from(new Set(text.match(/\bS\d{2}\b/g) ?? []));
  return {
    text,
    citations: uniqueCitations,
    sourceIds,
    toolCalls,
    mapCommands: ctx.mapCommands,
    verification: verifyNumbers(text, toolResults),
    model: modelUsed,
    mode,
    ms: Date.now() - t0,
  };
}
