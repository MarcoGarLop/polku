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
export async function designAction(idea: string, regionId: string, profileA: PatientProfile, profileB: PatientProfile): Promise<DesignReply> {
  const r = await fetch('/api/design-action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idea, regionId, profileA, profileB }),
    signal: AbortSignal.timeout(100000),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
  return r.json();
}

export async function askAgent(
  messages: { role: 'user' | 'assistant'; text: string }[],
  ui: { regionId: string | null; interventions: string[]; profileA: PatientProfile; profileB: PatientProfile },
): Promise<AgentReply> {
  const r = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, ui }),
    signal: AbortSignal.timeout(110000),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
  return r.json();
}
