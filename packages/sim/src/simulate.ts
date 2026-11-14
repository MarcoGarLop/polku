import { clampRatio, phaseMeans, resolveProfile, sumPhases, type Model, type RegionModel } from './model';
import { percentile, standardNormals, uniforms } from './rng';
import {
  PHASES,
  type Distribution,
  type EducationId,
  type EffectLevel,
  type FactorContribution,
  type GapFactor,
  type InterventionScore,
  type PatientProfile,
  type PhaseId,
  type PhaseResult,
  type PhaseVec,
  type Priority,
  type Effort,
  type ProfileComparison,
  type ProfileResult,
  type RegionResult,
  type RouteId,
  type StepPoint,
} from './types';

const ROUTES: RouteId[] = ['public', 'occupational_private'];
const EDUCATION: EducationId[] = ['basic', 'secondary', 'tertiary'];

/* ------------------------------------------------------------------ */
/* Monte Carlo                                                          */
/* ------------------------------------------------------------------ */

interface Component { weight: number; mean: PhaseVec }

function monteCarlo(model: Model, components: Component[], cvMultiplier: number, n: number, seed: number): Distribution {
  const P = model.params;
  const z = standardNormals(n, PHASES.length, seed);
  const u = uniforms(n, 1, seed + 7919);
  const sigma = PHASES.map((p) => Math.sqrt(Math.log(1 + (P.cv[p] * cvMultiplier) ** 2)));
  const mus = components.map((c) => PHASES.map((p, j) => Math.log(Math.max(c.mean[p], 1e-6)) - sigma[j] ** 2 / 2));
  const cum: number[] = [];
  const tw = components.reduce((s, c) => s + c.weight, 0);
  let acc = 0;
  for (const c of components) cum.push((acc += c.weight / tw));

  const benchIdx = P.benchmark.phases.map((p) => PHASES.indexOf(p));
  const totals = new Float64Array(n);
  let within = 0;
  for (let i = 0; i < n; i++) {
    let ci = 0;
    if (components.length > 1) {
      const x = u[i];
      while (ci < cum.length - 1 && x > cum[ci]) ci++;
    }
    const mu = mus[ci];
    let total = 0;
    let bench = 0;
    for (let j = 0; j < PHASES.length; j++) {
      const d = Math.exp(mu[j] + sigma[j] * z[i * PHASES.length + j]);
      total += d;
      if (benchIdx.includes(j)) bench += d;
    }
    totals[i] = total;
    if (bench <= P.benchmark.maxDays) within++;
  }
  totals.sort();
  return { p10: percentile(totals, 0.1), p50: percentile(totals, 0.5), p90: percentile(totals, 0.9), pctWithinTarget: within / n };
}

/* ------------------------------------------------------------------ */
/* Profiles                                                             */
/* ------------------------------------------------------------------ */

export function toSteps(model: Model, mean: PhaseVec): StepPoint[] {
  const P = model.params;
  const points = new Map<number, number>([[1, 0]]);
  let cum = 0;
  for (const s of P.segments) {
    cum += s.phases.reduce((acc, p) => acc + mean[p], 0) * s.share;
    points.set(s.toStep, cum);
  }
  return P.steps.map((st) => ({ step: st.id, label: st.label, kind: st.kind, cumulativeDays: points.has(st.id) ? points.get(st.id)! : null }));
}

function phaseResults(mean: PhaseVec, distance: PhaseVec): PhaseResult[] {
  return PHASES.map((p) => ({ phase: p, meanDays: mean[p], distanceDays: distance[p] }));
}

export function simulateProfile(
  model: Model,
  profile: PatientProfile,
  interventions: string[] = [],
  opts: { n?: number; seed?: number } = {},
): ProfileResult {
  const prof = resolveProfile(model, profile);
  const pm = phaseMeans(model, prof, interventions);
  const n = opts.n ?? 4000;
  const seed = opts.seed ?? model.params.seed;
  return {
    profile: prof,
    phases: phaseResults(pm.mean, pm.distance),
    totalMeanDays: sumPhases(pm.mean),
    steps: toSteps(model, pm.mean),
    distribution: monteCarlo(model, [{ weight: 1, mean: pm.mean }], pm.cvMultiplier, n, seed),
  };
}

export function profileTotal(model: Model, profile: PatientProfile, interventions: string[] = [], level: EffectLevel = 'mid'): number {
  return sumPhases(phaseMeans(model, resolveProfile(model, profile), interventions, level).mean);
}

const FACTOR_LABELS: Record<GapFactor, string> = {
  region: 'Wellbeing county (system capacity)',
  distance: 'Distance to hospital',
  route: 'Entry route (public vs occupational/private)',
  education: 'Education / health literacy',
  navigation: 'Barriers to navigating care',
};
const FACTORS: GapFactor[] = ['region', 'distance', 'route', 'education', 'navigation'];

function mixProfile(a: Required<PatientProfile>, b: Required<PatientProfile>, mask: number): Required<PatientProfile> {
  const pick = (i: number) => ((mask >> i) & 1 ? b : a);
  return {
    regionId: pick(0).regionId,
    distanceKm: pick(1).distanceKm,
    route: pick(2).route,
    education: pick(3).education,
    navigationBarrier: pick(4).navigationBarrier,
  };
}

const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));

/** Exact Shapley decomposition of total(b) − total(a) over the five profile factors. */
export function attributeGap(model: Model, aIn: PatientProfile, bIn: PatientProfile, interventions: string[] = []): FactorContribution[] {
  const a = resolveProfile(model, aIn);
  const b = resolveProfile(model, bIn);
  const nF = FACTORS.length;
  const v = new Map<number, number>();
  for (let mask = 0; mask < 1 << nF; mask++) v.set(mask, profileTotal(model, mixProfile(a, b, mask), interventions));
  const gap = v.get((1 << nF) - 1)! - v.get(0)!;
  return FACTORS.map((f, i) => {
    let phi = 0;
    for (let mask = 0; mask < 1 << nF; mask++) {
      if ((mask >> i) & 1) continue;
      const size = popcount(mask);
      const w = (factorial(size) * factorial(nF - size - 1)) / factorial(nF);
      phi += w * (v.get(mask | (1 << i))! - v.get(mask)!);
    }
    return { factor: f, label: FACTOR_LABELS[f], days: phi, share: gap !== 0 ? phi / gap : 0 };
  });
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>= 1;
  }
  return c;
}

export function compareProfiles(model: Model, a: PatientProfile, b: PatientProfile, interventions: string[] = []): ProfileComparison {
  const ra = simulateProfile(model, a, interventions);
  const rb = simulateProfile(model, b, interventions);
  const gapByPhase = {} as Record<PhaseId, number>;
  PHASES.forEach((p, i) => (gapByPhase[p] = rb.phases[i].meanDays - ra.phases[i].meanDays));
  const gapDays = rb.totalMeanDays - ra.totalMeanDays;
  return {
    a: ra,
    b: rb,
    gapDays,
    gapByPhase,
    attribution: attributeGap(model, a, b, interventions),
    shareBeforeReferral: gapDays !== 0 ? (gapByPhase.P1 + gapByPhase.P2) / gapDays : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Regions                                                              */
/* ------------------------------------------------------------------ */

/** Population mix of a region: route × education × navigation at the region's mean distance. */
function regionComponents(model: Model, r: RegionModel, interventions: string[], level: EffectLevel = 'mid') {
  const P = model.params;
  const comps: (Component & { cvMultiplier: number; distance: PhaseVec })[] = [];
  for (const route of ROUTES) {
    const wr = route === 'public' ? 1 - r.shareOcc : r.shareOcc;
    for (const edu of P.education) {
      for (const nav of [false, true]) {
        const wn = nav ? r.shareNav : 1 - r.shareNav;
        const pm = phaseMeans(model, { regionId: r.id, route, education: edu.id, navigationBarrier: nav, distanceKm: r.kmCentral }, interventions, level);
        comps.push({ weight: wr * edu.share * wn, mean: pm.mean, distance: pm.distance, cvMultiplier: pm.cvMultiplier });
      }
    }
  }
  return comps;
}

function mixtureMean(comps: { weight: number; mean: PhaseVec; distance?: PhaseVec }[], key: 'mean' | 'distance' = 'mean'): PhaseVec {
  const tw = comps.reduce((s, c) => s + c.weight, 0);
  const out = {} as PhaseVec;
  for (const p of PHASES) out[p] = comps.reduce((s, c) => s + c.weight * (c[key]?.[p] ?? 0), 0) / tw;
  return out;
}

export function regionMeanTotal(model: Model, regionId: string, interventions: string[] = [], level: EffectLevel = 'mid'): number {
  const r = model.byId.get(regionId)!;
  return sumPhases(mixtureMean(regionComponents(model, r, interventions, level)));
}

/** Least- and most-advantaged profiles used for the equity gap of a region. */
export function extremeProfiles(model: Model, regionId: string): { best: Required<PatientProfile>; worst: Required<PatientProfile> } {
  const r = model.byId.get(regionId)!;
  return {
    best: { regionId, route: 'occupational_private', education: 'tertiary', navigationBarrier: false, distanceKm: Math.min(10, r.kmCentral) },
    worst: { regionId, route: 'public', education: 'basic', navigationBarrier: true, distanceKm: Math.max(2 * r.kmCentral, 60) },
  };
}

export function equityGap(model: Model, regionId: string, interventions: string[] = [], level: EffectLevel = 'mid'): number {
  const { best, worst } = extremeProfiles(model, regionId);
  return profileTotal(model, worst, interventions, level) - profileTotal(model, best, interventions, level);
}

function routeGap(model: Model, r: RegionModel, interventions: string[]): number {
  const comps = regionComponents(model, r, interventions);
  const sub = (route: RouteId) => {
    const c = comps.filter((_, i) => (Math.floor(i / 6) === 0 ? 'public' : 'occupational_private') === route);
    return sumPhases(mixtureMean(c));
  };
  return sub('public') - sub('occupational_private');
}

export function nationalMeanTotal(model: Model, interventions: string[] = []): number {
  const tp = model.regions.reduce((s, r) => s + r.population, 0);
  return model.regions.reduce((s, r) => s + r.population * regionMeanTotal(model, r.id, interventions), 0) / tp;
}

export function simulateRegion(
  model: Model,
  regionId: string,
  interventions: string[] = [],
  opts: { n?: number; seed?: number; nationalMean?: number } = {},
): RegionResult {
  const r = model.byId.get(regionId);
  if (!r) throw new Error(`Unknown region: ${regionId}`);
  const comps = regionComponents(model, r, interventions);
  const mean = mixtureMean(comps);
  const distance = mixtureMean(comps, 'distance');
  const total = sumPhases(mean);
  // compare against the national mean under the SAME interventions, otherwise every region looks below average
  const national = opts.nationalMean ?? nationalMeanTotal(model, interventions);

  // Driver attribution: days this region would lose if the driver were at the national level.
  const drivers: { driver: string; extraDays: number }[] = [];
  for (const d of model.params.drivers) {
    const x = r.indicators[d.id];
    const ref = model.xNat[d.id];
    if (x == null || !ref) continue;
    const ratio = d.isDistance ? Math.max(x, model.params.distanceMinKm) / ref : clampRatio(x / ref);
    let extra = 0;
    for (const p of PHASES) {
      const e = d.elasticities[p];
      if (!e) continue;
      const f = Math.pow(ratio, e);
      extra += mean[p] - mean[p] / f;
    }
    drivers.push({ driver: d.id, extraDays: extra });
  }
  drivers.sort((a, b) => b.extraDays - a.extraDays);

  return {
    regionId: r.id,
    nameEn: r.nameEn,
    population: r.population,
    annualCases: r.annualCases,
    phases: phaseResults(mean, distance),
    totalMeanDays: total,
    distribution: monteCarlo(model, comps, comps[0]?.cvMultiplier ?? 1, opts.n ?? model.params.nPatients, opts.seed ?? model.params.seed),
    routeGapDays: routeGap(model, r, interventions),
    equityGapDays: equityGap(model, r.id, interventions),
    patientDaysLostPerYear: r.annualCases * Math.max(0, total - national),
    drivers,
    confidence: r.confidence,
  };
}

export function simulateAll(model: Model, interventions: string[] = [], opts: { n?: number } = {}): RegionResult[] {
  const national = nationalMeanTotal(model, interventions);
  return model.regions.map((r) => simulateRegion(model, r.id, interventions, { n: opts.n ?? 2000, nationalMean: national }));
}

/* ------------------------------------------------------------------ */
/* Prioritisation: Average vs Equity                                    */
/* ------------------------------------------------------------------ */

const LEVELS: EffectLevel[] = ['mid', 'low', 'high'];

function rangeOf(f: (level: EffectLevel) => number) {
  const [mid, low, high] = LEVELS.map(f);
  return { mid, low: Math.min(low, high), high: Math.max(low, high) };
}

/** Each intervention on its own, on top of `baseline`: days saved for the average patient and gap closed. */
export function rankInterventions(
  model: Model,
  regionId: string,
  opts: { priority?: Priority; baseline?: string[]; include?: string[] } = {},
): InterventionScore[] {
  const w = model.params.prioritisation.priorityWeights[opts.priority ?? 'balanced'];
  const baseline = opts.baseline ?? [];
  const ids = (opts.include ?? model.params.interventions.map((i) => i.id)).filter((id) => !baseline.includes(id));
  const rows = ids.map((id) => {
    const iv = model.interventionsById.get(id)!;
    const set = [...baseline, id];
    const daysSaved = rangeOf((l) => regionMeanTotal(model, regionId, baseline, l) - regionMeanTotal(model, regionId, set, l));
    const gapClosed = rangeOf((l) => equityGap(model, regionId, baseline, l) - equityGap(model, regionId, set, l));
    return { id, label: iv.label, effort: iv.effort, confidence: iv.confidence, roadmapActions: iv.roadmapActions, daysSaved, gapClosed, score: 0 };
  });
  const maxDays = Math.max(1e-9, ...rows.map((r) => r.daysSaved.mid));
  const maxGap = Math.max(1e-9, ...rows.map((r) => r.gapClosed.mid));
  for (const r of rows) r.score = (1 - w) * (r.daysSaved.mid / maxDays) + w * (r.gapClosed.mid / maxGap);
  return rows.sort((a, b) => b.score - a.score);
}

export interface Portfolio {
  interventions: string[];
  effortUsed: number;
  budget: number;
  daysSaved: number;
  gapClosed: number;
  score: number;
  /** Always recommended first, at no cost to the budget: start measuring. */
  stepZero: string;
}

/** Best combination of interventions that fits the effort budget (exhaustive search, ≤ 2^n subsets). */
export function bestPortfolio(model: Model, regionId: string, opts: { priority?: Priority; budget?: Effort } = {}): Portfolio {
  const P = model.params;
  const w = P.prioritisation.priorityWeights[opts.priority ?? 'balanced'];
  const budget = P.prioritisation.budgets[opts.budget ?? 'medium'];
  const stepZero = 'min_dataset';
  const pool = P.interventions.filter((i) => i.id !== stepZero);
  const baseAvg = regionMeanTotal(model, regionId);
  const baseGap = equityGap(model, regionId);
  const all = pool.map((i) => i.id);
  const maxDays = Math.max(1e-9, baseAvg - regionMeanTotal(model, regionId, all));
  const maxGap = Math.max(1e-9, baseGap - equityGap(model, regionId, all));

  let best: Portfolio = { interventions: [], effortUsed: 0, budget, daysSaved: 0, gapClosed: 0, score: 0, stepZero };
  for (let mask = 1; mask < 1 << pool.length; mask++) {
    const set: string[] = [];
    let effort = 0;
    for (let i = 0; i < pool.length; i++) {
      if ((mask >> i) & 1) {
        set.push(pool[i].id);
        effort += P.prioritisation.effortPoints[pool[i].effort];
      }
    }
    if (effort > budget) continue;
    const daysSaved = baseAvg - regionMeanTotal(model, regionId, set);
    const gapClosed = baseGap - equityGap(model, regionId, set);
    const score = (1 - w) * (daysSaved / maxDays) + w * (gapClosed / maxGap);
    if (score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && effort < best.effortUsed)) {
      best = { interventions: set, effortUsed: effort, budget, daysSaved, gapClosed, score, stepZero };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Who is left behind? (synthetic profiles)                             */
/* ------------------------------------------------------------------ */

export interface LeftBehindRow {
  profile: Required<PatientProfile>;
  distanceBand: 'near' | 'typical' | 'far';
  totalMeanDays: number;
  extraDaysVsBest: number;
  /** Approximate share of the region's lung cancer patients with this profile (assumption-based). */
  shareOfPatients: number;
  patientsPerYear: number;
  topFactors: FactorContribution[];
}

const DISTANCE_BANDS: { id: 'near' | 'typical' | 'far'; share: number }[] = [
  { id: 'near', share: 0.3 },
  { id: 'typical', share: 0.5 },
  { id: 'far', share: 0.2 },
];

export function findLeftBehind(model: Model, regionId: string, interventions: string[] = [], limit = 5): LeftBehindRow[] {
  const r = model.byId.get(regionId);
  if (!r) throw new Error(`Unknown region: ${regionId}`);
  const P = model.params;
  const { best } = extremeProfiles(model, regionId);
  const bestTotal = profileTotal(model, best, interventions);
  const km = { near: Math.min(10, r.kmCentral), typical: r.kmCentral, far: Math.max(2 * r.kmCentral, 60) };
  const rows: LeftBehindRow[] = [];
  for (const route of ROUTES) {
    const wr = route === 'public' ? 1 - r.shareOcc : r.shareOcc;
    for (const edu of EDUCATION) {
      const we = P.education.find((e) => e.id === edu)!.share;
      for (const nav of [false, true]) {
        const wn = nav ? r.shareNav : 1 - r.shareNav;
        for (const band of DISTANCE_BANDS) {
          const profile = { regionId, route, education: edu, navigationBarrier: nav, distanceKm: km[band.id] };
          const total = profileTotal(model, profile, interventions);
          const share = wr * we * wn * band.share;
          rows.push({
            profile,
            distanceBand: band.id,
            totalMeanDays: total,
            extraDaysVsBest: total - bestTotal,
            shareOfPatients: share,
            patientsPerYear: share * r.annualCases,
            topFactors: [],
          });
        }
      }
    }
  }
  rows.sort((a, b) => b.totalMeanDays - a.totalMeanDays);
  const top = rows.slice(0, limit);
  for (const row of top) {
    row.topFactors = attributeGap(model, best, row.profile, interventions)
      .filter((f) => f.days > 0.5)
      .sort((a, b) => b.days - a.days);
  }
  return top;
}

/* ------------------------------------------------------------------ */
/* Build-up: how a patient's days add up, one factor at a time          */
/* ------------------------------------------------------------------ */

export interface PartialProfile {
  regionId: string;
  distanceKm?: number;
  route?: RouteId;
  education?: EducationId;
  navigationBarrier?: boolean;
}

/** Expected total days when some attributes are unknown: averages over the region's patient mix. */
export function expectedTotal(model: Model, p: PartialProfile, interventions: string[] = [], level: EffectLevel = 'mid'): number {
  const r = model.byId.get(p.regionId);
  if (!r) throw new Error(`Unknown region: ${p.regionId}`);
  const P = model.params;
  const routes: [RouteId, number][] = p.route ? [[p.route, 1]] : [['public', 1 - r.shareOcc], ['occupational_private', r.shareOcc]];
  const edus: [EducationId, number][] = p.education ? [[p.education, 1]] : P.education.map((e) => [e.id, e.share] as [EducationId, number]);
  const navs: [boolean, number][] = p.navigationBarrier != null ? [[p.navigationBarrier, 1]] : [[false, 1 - r.shareNav], [true, r.shareNav]];
  let total = 0;
  for (const [route, wr] of routes)
    for (const [education, we] of edus)
      for (const [navigationBarrier, wn] of navs)
        total += wr * we * wn * profileTotal(model, { regionId: p.regionId, route, education, navigationBarrier, distanceKm: p.distanceKm ?? r.kmCentral }, interventions, level);
  return total;
}

export type BuildUpKey = 'national' | 'region' | 'distance' | 'route' | 'education' | 'support';
export interface BuildUpStep {
  key: BuildUpKey;
  /** Running total after this factor is known. */
  total: number;
  /** Days this factor adds (negative = saves) compared with the previous line. */
  delta: number;
}

/**
 * The patient's days as a running sum: Finland's average, then what their region, distance, entry route,
 * education and support each add. The last line equals the patient's own total.
 */
export function profileBuildUp(model: Model, profile: PatientProfile, interventions: string[] = []): BuildUpStep[] {
  const p = resolveProfile(model, profile);
  const totals: [BuildUpKey, number][] = [
    ['national', nationalMeanTotal(model, interventions)],
    ['region', expectedTotal(model, { regionId: p.regionId }, interventions)],
    ['distance', expectedTotal(model, { regionId: p.regionId, distanceKm: p.distanceKm }, interventions)],
    ['route', expectedTotal(model, { regionId: p.regionId, distanceKm: p.distanceKm, route: p.route }, interventions)],
    ['education', expectedTotal(model, { regionId: p.regionId, distanceKm: p.distanceKm, route: p.route, education: p.education }, interventions)],
    ['support', profileTotal(model, p, interventions)],
  ];
  return totals.map(([key, total], i) => ({ key, total, delta: i === 0 ? 0 : total - totals[i - 1][1] }));
}
