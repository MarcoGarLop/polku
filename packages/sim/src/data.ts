import rawParams from '../../../data/seed/pathway_parameters.json';
import rawAiEffects from '../../../data/seed/ai_effects.json';
import rawRegions from '../../../data/seed/regions.json';
import rawIndicators from '../../../data/processed/indicators.json';
import { buildModel, type Model } from './model';
import { parseParams, parseRegions } from './params';

let cached: Model | undefined;

/** Model built from the seed parameters, Gemini's evidence-based effect estimates and the processed regional indicators. */
export function loadDefaultModel(): Model {
  if (!cached) cached = buildModel(parseParams(rawParams, rawAiEffects as any), parseRegions(rawRegions, rawIndicators));
  return cached;
}

export { rawParams, rawRegions, rawIndicators, rawAiEffects };
