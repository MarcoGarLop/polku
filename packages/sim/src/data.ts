import rawParams from '../../../data/seed/pathway_parameters.json';
import rawRegions from '../../../data/seed/regions.json';
import rawIndicators from '../../../data/processed/indicators.json';
import { buildModel, type Model } from './model';
import { parseParams, parseRegions } from './params';

let cached: Model | undefined;

/** Model built from the repo's seed parameters and processed regional indicators. */
export function loadDefaultModel(): Model {
  if (!cached) cached = buildModel(parseParams(rawParams), parseRegions(rawRegions, rawIndicators));
  return cached;
}

export { rawParams, rawRegions, rawIndicators };
