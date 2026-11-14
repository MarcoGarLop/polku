import { phaseVec } from './params';
import {
  PHASES,
  type Confidence,
  type EducationId,
  type EffectLevel,
  type Intervention,
  type InterventionEffect,
  type Params,
  type PatientProfile,
  type PhaseVec,
  type RegionDef,
  type RouteId,
} from './types';

export interface RegionModel extends RegionDef {
  /** Product of non-distance driver multipliers (before calibration). */
  mSys: PhaseVec;
  kmCentral: number;
  /** km to radiotherapy ÷ km to central hospital (used to scale a profile's distance). */
  rtRatio: number;
  shareOcc: number;
  shareNav: number;
  annualCases: number;
  confidence: Confidence;
  missingDrivers: string[];
}

export interface Model {
  params: Params;
  regions: RegionModel[];
  byId: Map<string, RegionModel>;
  /** Population-weighted national reference value of each driver with data. */
  xNat: Record<string, number>;
  /** Calibration constant per phase: keeps the national population-weighted mean equal to the published base. */
  k: PhaseVec;
  /** Normalisation of patient factors so their population-mix mean is 1. */
  norm: { route: PhaseVec; education: PhaseVec; navigation: PhaseVec };
  interventionsById: Map<string, Intervention>;
}

/** Proxy indicators can be extreme (e.g. 1.4 vs 99 per 10 000): cap their relative effect to [0.5, 2]. */
export const clampRatio = (x: number) => Math.min(2, Math.max(0.5, x));

function weightedMean(values: { v: number; w: number }[]): number | undefined {
  const tw = values.reduce((s, x) => s + x.w, 0);
  if (!values.length || tw <= 0) return undefined;
  return values.reduce((s, x) => s + x.v * x.w, 0) / tw;
}

export function buildModel(params: Params, regionDefs: RegionDef[]): Model {
  const totalPop = regionDefs.reduce((s, r) => s + r.population, 0);

  // National reference for each driver = population-weighted mean over regions that have data.
  const xNat: Record<string, number> = {};
  for (const d of params.drivers) {
    const vals = regionDefs.filter((r) => r.indicators[d.id] != null).map((r) => ({ v: r.indicators[d.id], w: r.population }));
    const m = weightedMean(vals);
    if (m != null) xNat[d.id] = m;
  }
  const natCentral = xNat['dist_central'] ?? params.fallbackDistanceKm;
  const natRt = xNat['dist_rt'] ?? natCentral;

  const regions: RegionModel[] = regionDefs.map((r) => {
    const mSys = phaseVec({});
    const missing: string[] = [];
    for (const d of params.drivers) {
      const x = r.indicators[d.id];
      if (x == null || xNat[d.id] == null) {
        missing.push(d.id);
        continue;
      }
      if (d.isDistance) continue;
      const ratio = clampRatio(x / xNat[d.id]);
      for (const p of PHASES) {
        const e = d.elasticities[p];
        if (e) mSys[p] *= Math.pow(ratio, e);
      }
    }
    const kmCentral = r.indicators['dist_central'] ?? natCentral;
    const kmRt = r.indicators['dist_rt'] ?? kmCentral * (natRt / natCentral);
    return {
      ...r,
      mSys,
      kmCentral,
      rtRatio: kmRt / kmCentral,
      shareOcc: r.shareOccupationalPrivate ?? params.shareOccupationalPrivate,
      shareNav: r.shareNavigationBarrier ?? params.navigation.share,
      annualCases: (params.annualCases * r.population) / totalPop,
      confidence: missing.length === 0 ? 'medium' : 'low',
      missingDrivers: missing,
    };
  });

  const norm = {
    route: phaseVec({}),
    education: phaseVec({}),
    navigation: phaseVec({}),
  };
  const occ = params.shareOccupationalPrivate;
  const routePub = params.routes.find((x) => x.id === 'public')!;
  const routeOcc = params.routes.find((x) => x.id === 'occupational_private')!;
  for (const p of PHASES) {
    norm.route[p] = (1 - occ) * routePub.multipliers[p] + occ * routeOcc.multipliers[p];
    norm.education[p] = params.education.reduce((s, l) => s + l.share * l.multipliers[p], 0);
    const ns = params.navigation.share;
    norm.navigation[p] = (1 - ns) * 1 + ns * params.navigation.multipliers[p];
  }

  const partial: Model = {
    params,
    regions,
    byId: new Map(regions.map((r) => [r.id, r])),
    xNat: { ...xNat, dist_central: natCentral, dist_rt: natRt },
    k: phaseVec({}),
    norm,
    interventionsById: new Map(params.interventions.map((i) => [i.id, i])),
  };

  // Calibrate k so that the population-weighted mean of region means equals base, phase by phase
  // (including each region's own patient mix: entry route and navigation-barrier shares).
  for (const p of PHASES) {
    let num = 0;
    for (const r of regions) {
      const mixRoute = ((1 - r.shareOcc) * routePub.multipliers[p] + r.shareOcc * routeOcc.multipliers[p]) / norm.route[p];
      const mixNav = ((1 - r.shareNav) + r.shareNav * params.navigation.multipliers[p]) / norm.navigation[p];
      num += r.population * r.mSys[p] * distanceFactor(partial, r.kmCentral, r.rtRatio)[p] * mixRoute * mixNav;
    }
    partial.k[p] = totalPop / num;
  }
  return partial;
}

/** Multiplier from distance relative to the national reference (1 = national-average distance). */
export function distanceFactor(model: Model, kmCentral: number, rtRatio: number): PhaseVec {
  const f = phaseVec({});
  const km = Math.max(kmCentral, model.params.distanceMinKm);
  for (const d of model.params.drivers) {
    if (!d.isDistance) continue;
    const ref = model.xNat[d.id];
    if (!ref) continue;
    const x = d.id === 'dist_rt' ? km * rtRatio : km;
    for (const p of PHASES) {
      const e = d.elasticities[p];
      if (e) f[p] *= Math.pow(x / ref, e);
    }
  }
  return f;
}

export function resolveProfile(model: Model, profile: PatientProfile): Required<PatientProfile> {
  const r = model.byId.get(profile.regionId);
  if (!r) throw new Error(`Unknown region: ${profile.regionId}`);
  return {
    regionId: profile.regionId,
    route: profile.route,
    education: profile.education,
    navigationBarrier: profile.navigationBarrier,
    distanceKm: profile.distanceKm ?? r.kmCentral,
  };
}

export interface PhaseMeans {
  mean: PhaseVec;
  distance: PhaseVec;
  cvMultiplier: number;
}

/** Mean days per phase for a resolved profile, before interventions. */
export function baseMeans(model: Model, prof: Required<PatientProfile>): { mean: PhaseVec; distance: PhaseVec } {
  const r = model.byId.get(prof.regionId)!;
  const P = model.params;
  const route = P.routes.find((x) => x.id === prof.route)!;
  const edu = P.education.find((x) => x.id === prof.education)!;
  const dist = distanceFactor(model, prof.distanceKm, r.rtRatio);
  const mean = phaseVec({});
  const distance = phaseVec({}, 0);
  for (const p of PHASES) {
    const nav = prof.navigationBarrier ? P.navigation.multipliers[p] : 1;
    const noDist =
      P.base[p] *
      model.k[p] *
      r.mSys[p] *
      (route.multipliers[p] / model.norm.route[p]) *
      (edu.multipliers[p] / model.norm.education[p]) *
      (nav / model.norm.navigation[p]);
    mean[p] = noDist * dist[p];
    distance[p] = Math.max(0, mean[p] - noDist);
  }
  return { mean, distance };
}

function effectValue(e: InterventionEffect, level: EffectLevel): number {
  const mid = e.reduction ?? e.distanceReduction ?? 0;
  if (level === 'mid' || !e.range) return mid;
  return level === 'low' ? e.range[0] : e.range[1];
}

function matches(e: InterventionEffect, prof: { route: RouteId; education: EducationId; navigationBarrier: boolean }): boolean {
  const w = e.when;
  if (!w) return true;
  if (w.route && w.route !== prof.route) return false;
  if (w.education && w.education !== prof.education) return false;
  if (w.navigationBarrier != null && w.navigationBarrier !== prof.navigationBarrier) return false;
  return true;
}

const clamp = (x: number) => Math.min(0.95, Math.max(0, x));

/** Applies interventions with diminishing returns: total reduction = 1 − Π(1 − rᵢ). */
export function phaseMeans(
  model: Model,
  prof: Required<PatientProfile>,
  interventionIds: string[],
  level: EffectLevel = 'mid',
): PhaseMeans {
  const { mean, distance } = baseMeans(model, prof);
  const keep = phaseVec({});
  const distKeep = phaseVec({});
  let cvMultiplier = 1;
  for (const id of interventionIds) {
    const iv = model.interventionsById.get(id);
    if (!iv) throw new Error(`Unknown intervention: ${id}`);
    for (const e of iv.effects) {
      if (e.cvMultiplier != null) {
        cvMultiplier *= e.cvMultiplier;
        continue;
      }
      if (!e.phase || !matches(e, prof)) continue;
      const r = clamp(effectValue(e, level));
      if (e.distanceReduction != null) distKeep[e.phase] *= 1 - r;
      else keep[e.phase] *= 1 - r;
    }
  }
  const outMean = phaseVec({});
  const outDist = phaseVec({}, 0);
  for (const p of PHASES) {
    const d = distance[p] * distKeep[p];
    outMean[p] = (mean[p] - distance[p] + d) * keep[p];
    outDist[p] = d * keep[p];
  }
  return { mean: outMean, distance: outDist, cvMultiplier };
}

export const sumPhases = (v: PhaseVec) => PHASES.reduce((s, p) => s + v[p], 0);
