import type { PatientProfile } from '@polku/sim';

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
