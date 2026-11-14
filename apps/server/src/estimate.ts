import { Type } from '@google/genai';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from './context';
import { client, FALLBACK_MODEL, MODEL } from './gemini';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** What Gemini returns for one action: the mechanism and size of the effect, never the final days. */
export interface AiEffect {
  phase: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  kind: 'share_of_phase_days' | 'share_of_distance_days';
  appliesTo: 'all' | 'public_route' | 'basic_education' | 'navigation_barrier';
  low: number;
  mid: number;
  high: number;
}
export interface AiEstimate {
  id: string;
  label?: string;
  effects: AiEffect[];
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  evidence: string[];
  roadmapAction: string;
  roadmapPage: number;
}

export const PATHWAY_BRIEF = `Polku's lung cancer pathway model (Finland). Five phases with national mean days:
P1 patient interval (first symptom → first healthcare contact): 55 days
P2 primary care (first contact → referral sent): 41 days
P3 specialist access (referral received → first specialist contact): 12 days
P4 diagnostic work-up (first specialist contact → diagnosis): 22 days
P5 treatment start (diagnosis → first treatment, includes MDT): 24 days
Some days in P1, P4 and P5 are attributable to distance from hospital ("distance days").
Patient groups the model distinguishes: entry route (public health centre vs occupational/private), education (basic/secondary/higher), navigation barriers (lives alone, other language, 75+).`;

const effectSchema = {
  type: Type.OBJECT,
  properties: {
    phase: { type: Type.STRING, enum: ['P1', 'P2', 'P3', 'P4', 'P5'] },
    kind: { type: Type.STRING, enum: ['share_of_phase_days', 'share_of_distance_days'], description: 'Reduce a share of all days in the phase, or only of the distance-attributable days' },
    appliesTo: { type: Type.STRING, enum: ['all', 'public_route', 'basic_education', 'navigation_barrier'] },
    low: { type: Type.NUMBER, description: 'Pessimistic proportional reduction, 0–0.6' },
    mid: { type: Type.NUMBER, description: 'Best estimate, 0–0.6' },
    high: { type: Type.NUMBER, description: 'Optimistic, 0–0.6' },
  },
  required: ['phase', 'kind', 'appliesTo', 'low', 'mid', 'high'],
};
export const estimateSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    label: { type: Type.STRING, description: 'Short name, max 5 words' },
    effects: { type: Type.ARRAY, items: effectSchema },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    rationale: { type: Type.STRING, description: 'Plain English, max 60 words: what evidence you used and how you turned it into the effect size' },
    evidence: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Source ids (e.g. S14) or roadmap/strategy pages (e.g. ROADMAP p.52)' },
    roadmapAction: { type: Type.STRING },
    roadmapPage: { type: Type.NUMBER },
  },
  required: ['id', 'effects', 'confidence', 'rationale', 'evidence', 'roadmapAction', 'roadmapPage'],
};

/** Keep the model honest: valid phases only, reductions within [0, 0.6], ordered low ≤ mid ≤ high. */
export function sanitize(e: AiEstimate): AiEstimate {
  const clamp = (x: number) => Math.round(Math.min(0.6, Math.max(0, Number(x) || 0)) * 100) / 100;
  const effects = (e.effects ?? [])
    .filter((f) => ['P1', 'P2', 'P3', 'P4', 'P5'].includes(f.phase))
    .map((f) => {
      const [low, mid, high] = [clamp(f.low), clamp(f.mid), clamp(f.high)].sort((a, b) => a - b);
      return { ...f, kind: f.kind === 'share_of_distance_days' ? f.kind : 'share_of_phase_days', appliesTo: f.appliesTo ?? 'all', low, mid, high } as AiEffect;
    })
    .filter((f) => f.high > 0);
  return { ...e, effects, rationale: (e.rationale ?? '').trim(), evidence: e.evidence ?? [], roadmapPage: Number(e.roadmapPage) || 0 };
}

export function evidenceDigest(): string {
  return readFileSync(join(ROOT, 'docs', '05_fuentes_y_evidencia.md'), 'utf8');
}

export async function geminiJson<T>(prompt: string, schema: object, preferFast = false): Promise<{ data: T; model: string; ms: number }> {
  const t0 = Date.now();
  const system = `You are Polku's evidence analyst for Finnish lung cancer care. You estimate effect sizes for pathway interventions from evidence, conservatively, and explain your reasoning.

${PATHWAY_BRIEF}

EVIDENCE DIGEST (team research notes in Spanish, with source ids S01…S28):
${evidenceDigest()}

FULL TEXT OF THE NATIONAL CANCER STRATEGY AND ROADMAP (Finnish):
${loadCorpus().full}`;
  let lastErr: unknown;
  for (const model of preferFast ? [FALLBACK_MODEL, MODEL] : [MODEL, FALLBACK_MODEL]) {
    try {
      const res = await client().models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { systemInstruction: system, responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
      });
      return { data: JSON.parse(res.text ?? 'null') as T, model, ms: Date.now() - t0 };
    } catch (e) {
      lastErr = e;
      console.warn(`! ${model} failed: ${String((e as Error)?.message).slice(0, 200)}`);
    }
  }
  throw lastErr;
}

export const ESTIMATION_RULES = `Rules:
- Base the size on the evidence (studies in the digest, what the roadmap says). If the evidence is weak or indirect, use a wide range and low confidence. If a study found no effect, say so and keep the estimate near zero.
- Translate absolute day changes from studies into proportions of the phase means given above.
- Use appliesTo only when the action targets a group (e.g. a fast lane for the public route, support for people with navigation barriers).
- Use share_of_distance_days for actions that only remove travel-related delay.
- Be conservative: real implementations rarely achieve trial results (e.g. Sweden meets its fast-track targets for only ~36% of patients).
- Cite source ids or [ROADMAP p.N] pages you actually used.`;
