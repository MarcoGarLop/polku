import type { AiEstimate, PatientProfile } from '@polku/sim';

export interface AgentReply {
  text: string;
  citations: string[];
  sourceIds: string[];
  toolCalls: { name: string; args: unknown }[];
  mapCommands: { action: string; regionId?: string; metric?: string; interventions?: string[] }[];
  verification: { checked: number; unverified: string[] };
  model: string;
  mode: string;
  ms: number;
}

export interface Health {
  ok: boolean;
  model: string;
  demoMode: boolean;
  context: { status: string; tokens: number | null; cachedTokens: number | null };
  recordedAnswers: number;
}

export async function getHealth(): Promise<Health | null> {
  try {
    const r = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Why an AI call failed, in words a user can act on. */
export class AiError extends Error {
  constructor(public kind: 'offline' | 'busy' | 'timeout', message: string) {
    super(message);
  }
}
export const aiErrorText = (e: unknown) =>
  e instanceof AiError
    ? e.kind === 'offline'
      ? 'The AI server is not running. Start it with “npm run dev:server” and try again.'
      : e.kind === 'timeout'
        ? 'Gemini is taking too long right now. Try again, or pick one of the examples (they are instant).'
        : 'Gemini is busy right now. Try again in a few seconds, or pick one of the examples.'
    : 'The AI could not answer. Try again in a few seconds.';

/**
 * POST to the AI server. Retries once after a short pause (covers server restarts and brief Gemini overloads),
 * and turns failures into an AiError the UI can explain.
 */
async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (r.ok) return (await r.json()) as T;
      // 502/504 from the dev proxy = the API server is down
      last = r.status === 502 || r.status === 504 ? new AiError('offline', `HTTP ${r.status}`) : new AiError('busy', (await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
    } catch (e: any) {
      last = e?.name === 'TimeoutError' ? new AiError('timeout', 'timeout') : new AiError('offline', String(e?.message ?? e));
      if (e?.name === 'TimeoutError') break; // already waited long enough
    }
    if (attempt === 0) await new Promise((res) => setTimeout(res, 3000));
  }
  throw last;
}

export interface DesignReply {
  idea: string;
  regionId: string;
  estimate: AiEstimate;
  trail: string[];
  results: {
    regionDaysSaved: { low: number; mid: number; high: number };
    equityGapClosed: number;
    mattiB: { before: number; after: number };
    gapAB: { before: number; after: number };
    nationalDaysSavedIfEverywhere: number;
  };
  model: string;
  ms: number;
  cached?: boolean;
}

/** The AI estimates a new action from the evidence; the server simulates it. */
export const designAction = (idea: string, regionId: string, profileA: PatientProfile, profileB: PatientProfile) =>
  post<DesignReply>('/api/design-action', { idea, regionId, profileA, profileB }, 100000);

export const askAgent = (
  messages: { role: 'user' | 'assistant'; text: string }[],
  ui: { regionId: string | null; interventions: string[]; profileA: PatientProfile; profileB: PatientProfile },
) => post<AgentReply>('/api/agent', { messages, ui }, 110000);

export interface NordicReply {
  practiceId: string;
  country: string;
  name: string;
  whatTheyDid: string;
  resultsThere: string[];
  whyDifferent: string;
  estimate: AiEstimate;
  unverified: string[];
  model: string;
  ms: number;
  cached?: boolean;
}

/** The AI compares a Nordic practice: what it achieved there, and its estimated effect in Finland. */
export const compareNordic = (practiceId: string) => post<NordicReply>('/api/nordic', { practiceId }, 110000);
