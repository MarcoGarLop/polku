import { describe, expect, it } from 'vitest';
import rawParams from '../../../data/seed/pathway_parameters.json';
import rawRegions from '../../../data/seed/regions.json';
import {
  PHASES,
  bestPortfolio,
  buildModel,
  compareProfiles,
  equityGap,
  findLeftBehind,
  nationalMeanTotal,
  parseParams,
  parseRegions,
  rankInterventions,
  regionMeanTotal,
  simulateAll,
  simulateProfile,
  simulateRegion,
  type PatientProfile,
} from '../src';
import { loadDefaultModel } from '../src/data';

const params = parseParams(rawParams);

/** Synthetic indicators so regions differ (test only, not real data). */
function syntheticModel() {
  const n = (rawRegions as any).regions.length;
  const indicators: any = { regions: {} };
  (rawRegions as any).regions.forEach((r: any, i: number) => {
    indicators.regions[r.id] = {
      pc_access: 0.3 + (0.3 * i) / n,
      spec_wait: 0.05 + (0.1 * ((i * 7) % n)) / n,
      dist_central: 10 + (150 * i) / n,
      dist_rt: 15 + (250 * i) / n,
      ses: 1 + i / n,
    };
  });
  return buildModel(params, parseRegions(rawRegions, indicators));
}

const mattiA: PatientProfile = { regionId: 'pohjois-pohjanmaa', route: 'occupational_private', education: 'secondary', navigationBarrier: false, distanceKm: 8 };
const mattiB: PatientProfile = { regionId: 'lappi', route: 'public', education: 'basic', navigationBarrier: true, distanceKm: 180 };

describe('calibration', () => {
  it('reproduces the national phase means (population-weighted) with real-looking regional variation', () => {
    const model = syntheticModel();
    const tp = model.regions.reduce((s, r) => s + r.population, 0);
    const res = simulateAll(model, [], { n: 500 });
    for (const [j, p] of PHASES.entries()) {
      const m = res.reduce((s, r, i) => s + model.regions[i].population * r.phases[j].meanDays, 0) / tp;
      expect(Math.abs(m - params.base[p])).toBeLessThan(1);
    }
    expect(Math.abs(nationalMeanTotal(model) - 154)).toBeLessThan(1);
  });

  it('without indicators every region is identical and equals the national mean', () => {
    const model = buildModel(params, parseRegions(rawRegions, { regions: {} }));
    const totals = model.regions.map((r) => regionMeanTotal(model, r.id));
    for (const t of totals) expect(t).toBeCloseTo(totals[0], 6);
    expect(totals[0]).toBeCloseTo(154, 0);
  });

  it('regions differ when indicators exist', () => {
    const model = syntheticModel();
    const totals = model.regions.map((r) => regionMeanTotal(model, r.id));
    expect(Math.max(...totals) - Math.min(...totals)).toBeGreaterThan(5);
  });

  it('real public data (data/processed) still reproduces the national mean', () => {
    const model = loadDefaultModel();
    expect(Math.abs(nationalMeanTotal(model) - 154)).toBeLessThan(1);
    const totals = model.regions.map((r) => regionMeanTotal(model, r.id));
    expect(Math.max(...totals) - Math.min(...totals)).toBeGreaterThan(5);
  });
});

describe('profiles and the equity gap', () => {
  const model = syntheticModel();

  it('public route is slower than occupational/private, mostly before referral', () => {
    const cmp = compareProfiles(model, { ...mattiB, route: 'occupational_private' }, mattiB);
    expect(cmp.gapDays).toBeGreaterThan(20);
    expect(cmp.shareBeforeReferral).toBeGreaterThan(0.5);
  });

  it('Shapley attribution sums exactly to the gap', () => {
    const cmp = compareProfiles(model, mattiA, mattiB);
    const sum = cmp.attribution.reduce((s, f) => s + f.days, 0);
    expect(sum).toBeCloseTo(cmp.gapDays, 6);
    expect(cmp.gapDays).toBeGreaterThan(0);
  });

  it('8-step cumulative timeline ends at the total', () => {
    const r = simulateProfile(model, mattiB);
    const last = r.steps[r.steps.length - 1];
    expect(last.cumulativeDays).toBeCloseTo(r.totalMeanDays, 6);
    expect(r.steps[1].cumulativeDays).toBeNull();
  });

  it('is deterministic with a fixed seed', () => {
    const a = simulateProfile(model, mattiB);
    const b = simulateProfile(model, mattiB);
    expect(a.distribution).toEqual(b.distribution);
  });
});

describe('interventions', () => {
  const model = syntheticModel();
  const all = params.interventions.map((i) => i.id);

  it('never reduce a phase below zero and never increase days', () => {
    const base = simulateProfile(model, mattiB);
    const withAll = simulateProfile(model, mattiB, all);
    for (const [i, ph] of withAll.phases.entries()) {
      expect(ph.meanDays).toBeGreaterThan(0);
      expect(ph.meanDays).toBeLessThanOrEqual(base.phases[i].meanDays + 1e-9);
    }
  });

  it('public fast lane closes the equity gap more than it helps the average', () => {
    const gap0 = equityGap(model, 'lappi');
    const gap1 = equityGap(model, 'lappi', ['public_fast_lane']);
    const avg0 = regionMeanTotal(model, 'lappi');
    const avg1 = regionMeanTotal(model, 'lappi', ['public_fast_lane']);
    expect(gap0 - gap1).toBeGreaterThan(avg0 - avg1);
  });

  it('minimum dataset narrows uncertainty but does not change the mean', () => {
    const a = simulateRegion(model, 'lappi');
    const b = simulateRegion(model, 'lappi', ['min_dataset']);
    expect(b.totalMeanDays).toBeCloseTo(a.totalMeanDays, 6);
    expect(b.distribution.p90 - b.distribution.p10).toBeLessThan(a.distribution.p90 - a.distribution.p10);
  });

  it('ranking by equity differs from ranking by speed', () => {
    const speed = rankInterventions(model, 'lappi', { priority: 'speed' }).map((r) => r.id);
    const equity = rankInterventions(model, 'lappi', { priority: 'equity' }).map((r) => r.id);
    expect(speed[0]).not.toBe(equity[0]);
  });

  it('portfolio respects the effort budget', () => {
    for (const budget of ['low', 'medium', 'high'] as const) {
      const p = bestPortfolio(model, 'lappi', { budget, priority: 'equity' });
      expect(p.effortUsed).toBeLessThanOrEqual(p.budget);
      expect(p.interventions.length).toBeGreaterThan(0);
      expect(p.stepZero).toBe('min_dataset');
    }
  });
});

describe('left behind', () => {
  it('returns the most delayed profiles with factor attribution', () => {
    const model = syntheticModel();
    const rows = findLeftBehind(model, 'lappi');
    expect(rows).toHaveLength(5);
    expect(rows[0].profile.route).toBe('public');
    expect(rows[0].extraDaysVsBest).toBeGreaterThan(0);
    expect(rows[0].topFactors.length).toBeGreaterThan(0);
  });
});

describe('performance', () => {
  it('simulates all regions fast enough for live sliders', () => {
    const model = syntheticModel();
    simulateAll(model, [], { n: 2000 });
    const t0 = performance.now();
    simulateAll(model, ['fast_track', 'navigator'], { n: 2000 });
    expect(performance.now() - t0).toBeLessThan(300);
  });
});
