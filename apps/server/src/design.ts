import { compareProfiles, equityGap, interventionFromAi, nationalMeanTotal, registerIntervention, regionMeanTotal, type AiEstimate, type PatientProfile } from '@polku/sim';
import { loadDefaultModel } from '@polku/sim/data';
import { ESTIMATION_RULES, estimateSchema, geminiJson, sanitize } from './estimate';

const model = loadDefaultModel();
const r1 = (x: number) => Math.round(x * 10) / 10;

export interface DesignResult {
  idea: string;
  regionId: string;
  estimate: AiEstimate;
  /** What the AI did, in order — shown to the user as the reasoning trail. */
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
}

const slug = (s: string) => 'ai_' + s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

/** The user proposes an action in plain words; Gemini estimates its effect from the evidence; the simulator computes the days. */
export async function designAction(idea: string, regionId: string, a: PatientProfile, b: PatientProfile): Promise<DesignResult> {
  const region = model.byId.get(regionId);
  if (!region) throw new Error('unknown region');
  const id = slug(idea);
  const prompt = `A planner in the ${region.nameEn} wellbeing services county proposes this new action for the lung cancer pathway:
"${idea}"

1. Decide which pathway phases it would change, for which patients, and by how much (as a proportion, with a pessimistic, best and optimistic value).
2. Find the closest action in the national roadmap or strategy and give its id and page.
3. Explain briefly what evidence you used.
${ESTIMATION_RULES}
- If the idea is unlikely to shorten the pathway, say so and return small effects.
Use id "${id}" and a short label.`;
  // live ideas use the fast model (≈10–20 s); the flagship can take 90 s under load
  const { data, model: used, ms } = await geminiJson<AiEstimate>(prompt, estimateSchema, true);
  const estimate = sanitize({ ...data, id });
  const iv = interventionFromAi(estimate, { model: used, custom: true });
  registerIntervention(model, iv);

  const saved = (lvl: 'low' | 'mid' | 'high') => regionMeanTotal(model, regionId) - regionMeanTotal(model, regionId, [id], lvl);
  const [lo, hi] = [saved('low'), saved('high')].sort((x, y) => x - y);
  const before = compareProfiles(model, a, b, []);
  const after = compareProfiles(model, a, b, [id]);
  const results = {
    regionDaysSaved: { low: r1(lo), mid: r1(saved('mid')), high: r1(hi) },
    equityGapClosed: r1(equityGap(model, regionId) - equityGap(model, regionId, [id])),
    mattiB: { before: r1(before.b.totalMeanDays), after: r1(after.b.totalMeanDays) },
    gapAB: { before: r1(before.gapDays), after: r1(after.gapDays) },
    nationalDaysSavedIfEverywhere: r1(nationalMeanTotal(model) - nationalMeanTotal(model, [id])),
  };
  const phaseName: Record<string, string> = { P1: 'noticing symptoms', P2: 'primary care', P3: 'getting to a specialist', P4: 'diagnosis', P5: 'starting treatment' };
  const trail = [
    'Read the national cancer strategy, the roadmap and the evidence notes',
    `Matched the idea to roadmap action ${estimate.roadmapAction || '—'}${estimate.roadmapPage ? ` (p.${estimate.roadmapPage})` : ''}`,
    `Estimated the effect on ${Array.from(new Set(estimate.effects.map((f) => phaseName[f.phase]))).join(', ') || 'no phase'} (${estimate.confidence} confidence)`,
    `Ran the pathway simulation for ${region.nameEn}, for Patient B and for all 22 regions`,
  ];
  return { idea, regionId, estimate, trail, results, model: used, ms };
}
