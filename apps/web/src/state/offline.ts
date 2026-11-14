import { equityGap, interventionFromAi, profileTotal, quickEstimate, regionMeanTotal, registerIntervention, type PatientProfile } from '@polku/sim';
import recordedDesigns from '../../../../demo/designed-actions.json';
import recordedNordic from '../../../../demo/nordic-practices.json';
import type { DesignReply, NordicReply } from './api';
import { model } from './sim';

const r1 = (x: number) => Math.round(x * 10) / 10;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöå ]/g, '').replace(/\s+/g, ' ').trim();

/** A recorded Gemini answer for this exact idea, if we have one (shipped with the app). */
function recordedDesign(idea: string): DesignReply | undefined {
  const entries = (recordedDesigns as any).entries ?? {};
  const key = Object.keys(entries).find((k) => k.split('|')[0] === norm(idea));
  return key ? { ...entries[key], cached: true } : undefined;
}

/**
 * Used when the AI server cannot be reached at all: a recorded Gemini answer for the example ideas,
 * otherwise Polku's quick offline estimate (closest roadmap action, clearly labelled).
 */
export function offlineDesign(idea: string, regionId: string, patient: PatientProfile): DesignReply {
  const rec = recordedDesign(idea);
  if (rec) return rec;
  const est = quickEstimate(model, idea);
  const id = est.id;
  const region = model.byId.get(regionId)!;
  const has = est.effects.length > 0;
  if (has) registerIntervention(model, interventionFromAi(est, { model: 'offline', custom: true }));
  const saved = (lvl: 'low' | 'mid' | 'high') => (has ? regionMeanTotal(model, regionId) - regionMeanTotal(model, regionId, [id], lvl) : 0);
  return {
    idea,
    regionId,
    estimate: est,
    trail: [
      "Compared the idea with the roadmap actions Polku's AI has already analysed",
      est.roadmapAction ? `Matched it to the closest roadmap action ${est.roadmapAction} (p.${est.roadmapPage})` : 'Found no close match in the national roadmap',
      "Reused that action's evidence-based effect, with a wider range for a new variant",
      `Ran the pathway simulation for ${region.nameEn}`,
    ],
    results: {
      regionDaysSaved: { low: r1(Math.min(saved('low'), saved('high'))), mid: r1(saved('mid')), high: r1(Math.max(saved('low'), saved('high'))) },
      equityGapClosed: has ? r1(equityGap(model, regionId) - equityGap(model, regionId, [id])) : 0,
      mattiB: { before: r1(profileTotal(model, patient)), after: r1(has ? profileTotal(model, patient, [id]) : profileTotal(model, patient)) },
      gapAB: { before: 0, after: 0 },
      nationalDaysSavedIfEverywhere: 0,
    },
    model: 'offline',
    ms: 0,
    fallback: true,
  } as DesignReply;
}

/** Recorded Gemini comparison for a Nordic practice (shipped with the app). */
export function offlineNordic(practiceId: string): NordicReply | undefined {
  const e = (recordedNordic as any).entries?.[practiceId];
  return e ? { ...e, cached: true } : undefined;
}
