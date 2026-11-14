import {
  PHASES,
  type Confidence,
  type DriverDef,
  type Effort,
  type Intervention,
  type InterventionEffect,
  type Params,
  type PhaseId,
  type PhaseVec,
  type RegionDef,
  type SegmentDef,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DISTANCE_DRIVERS = new Set(['dist_central', 'dist_rt']);

export function phaseVec(partial: Partial<Record<string, number>> | undefined, fill = 1): PhaseVec {
  const v = {} as PhaseVec;
  for (const p of PHASES) v[p] = partial?.[p] ?? fill;
  return v;
}

function parseEffect(raw: any): InterventionEffect {
  const e: InterventionEffect = {};
  if (raw.type === 'uncertainty') {
    e.cvMultiplier = raw.cv_multiplier;
    return e;
  }
  e.phase = raw.phase as PhaseId;
  if (typeof raw.reduction === 'number') e.reduction = raw.reduction;
  if (typeof raw.reduction_of_distance_component === 'number') e.distanceReduction = raw.reduction_of_distance_component;
  if (Array.isArray(raw.range)) e.range = [raw.range[0], raw.range[1]];
  const when = { ...(raw.when ?? {}) };
  if (raw.route) when.route = raw.route;
  if (Object.keys(when).length) e.when = when;
  return e;
}

function parseIntervention(raw: any): Intervention {
  return {
    id: raw.id,
    label: raw.label,
    effects: (raw.effects ?? []).map(parseEffect),
    evidence: raw.evidence ?? '',
    sourceIds: raw.source_ids ?? [],
    confidence: raw.confidence as Confidence,
    roadmapActions: raw.roadmap_actions ?? [],
    costNote: raw.cost_note ?? '',
    effort: (raw.effort ?? 'medium') as Effort,
  };
}

export function parseParams(raw: any): Params {
  const phases = raw.phases.map((p: any) => ({
    id: p.id,
    label: p.label,
    from: p.from,
    to: p.to,
    meanDays: p.mean_days,
    cv: p.cv,
    sourceId: p.source_id,
    confidence: p.confidence,
    note: p.note,
  }));
  const base = phaseVec(Object.fromEntries(phases.map((p: any) => [p.id, p.meanDays])));
  const cv = phaseVec(Object.fromEntries(phases.map((p: any) => [p.id, p.cv])));

  const drivers: DriverDef[] = raw.regional_drivers.map((d: any) => ({
    id: d.id,
    indicator: d.indicator,
    sourceId: d.source_id,
    elasticities: d.elasticities,
    isDistance: DISTANCE_DRIVERS.has(d.id),
  }));

  const pf = raw.patient_factors;
  const segments: SegmentDef[] = raw.pathway_steps.segments.map((s: any) => ({
    toStep: s.to_step,
    phases: s.from_phases ?? [s.from_phase],
    share: s.share,
  }));

  const comparators: Params['comparators'] = {};
  for (const [k, v] of Object.entries<any>(raw.comparators_total_days)) {
    comparators[k] = { value: v.value, sourceId: v.source_id, confidence: v.confidence };
  }

  const pr = raw.prioritisation;
  return {
    version: raw.version,
    phases,
    base,
    cv,
    benchmark: { phases: raw.benchmark.phases, maxDays: raw.benchmark.max_days, sourceId: raw.benchmark.source_id },
    comparators,
    routes: raw.entry_routes.routes.map((r: any) => ({ id: r.id, label: r.label, multipliers: phaseVec(r.multipliers) })),
    shareOccupationalPrivate: raw.entry_routes.share_occupational_private.value,
    education: pf.education.levels.map((l: any) => ({ id: l.id, label: l.label, share: l.share, multipliers: phaseVec(l.multipliers) })),
    navigation: { label: pf.navigation_barrier.label, share: pf.navigation_barrier.share, multipliers: phaseVec(pf.navigation_barrier.multipliers) },
    distanceMinKm: pf.distance.min_km ?? 5,
    fallbackDistanceKm: pf.distance.fallback_region_km ?? 40,
    drivers,
    interventions: raw.interventions.map(parseIntervention),
    steps: raw.pathway_steps.steps,
    segments,
    prioritisation: {
      effortPoints: pr.effort_points,
      budgets: pr.budgets,
      priorityWeights: pr.priority_weights,
    },
    annualCases: raw.national.annual_new_cases.value,
    seed: raw.simulation.seed,
    nPatients: raw.simulation.n_patients_per_region,
  };
}

export function parseRegions(rawRegions: any, rawIndicators?: any): RegionDef[] {
  const ind = rawIndicators?.regions ?? {};
  return rawRegions.regions.map((r: any) => {
    const ri = ind[r.id] ?? {};
    const indicators: Record<string, number> = {};
    for (const [k, v] of Object.entries(ri)) {
      if (!k.startsWith('share_') && typeof v === 'number' && Number.isFinite(v) && v > 0) indicators[k] = v;
    }
    return {
      id: r.id,
      nameEn: r.name_en,
      nameFi: r.name_fi,
      population: r.population,
      hospital: {
        id: r.hospital.id,
        name: r.hospital.name,
        city: r.hospital.city,
        lat: r.hospital.lat,
        lon: r.hospital.lon,
        type: r.hospital.type,
        hasRadiotherapy: r.hospital.has_radiotherapy,
      },
      indicators,
      shareOccupationalPrivate: typeof ri.share_occupational_private === 'number' ? ri.share_occupational_private : undefined,
      shareNavigationBarrier: typeof ri.share_navigation_barrier === 'number' ? ri.share_navigation_barrier : undefined,
    } satisfies RegionDef;
  });
}
