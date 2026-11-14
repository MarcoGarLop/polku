import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  bestPortfolio,
  compareProfiles,
  equityGap,
  nationalMeanTotal,
  rankInterventions,
  simulateAll,
  type Model,
  type Portfolio,
  type ProfileComparison,
  type RegionResult,
  type InterventionScore,
} from '@polku/sim';
import { loadDefaultModel } from '@polku/sim/data';
import { useStore } from './store';

export interface SimState {
  model: Model;
  base: RegionResult[];
  current: RegionResult[];
  byId: Map<string, RegionResult>;
  baseById: Map<string, RegionResult>;
  national: { base: number; current: number; withinBase: number; withinCurrent: number; gapBase: number; gapCurrent: number };
  comparison: ProfileComparison;
  comparisonBase: ProfileComparison;
  focusRegion: string;
  ranking: InterventionScore[];
  portfolio: Portfolio;
}

const Ctx = createContext<SimState | null>(null);
const model = loadDefaultModel();

function weighted(results: RegionResult[], f: (r: RegionResult) => number) {
  const tp = results.reduce((s, r) => s + r.population, 0);
  return results.reduce((s, r) => s + r.population * f(r), 0) / tp;
}

export function SimProvider({ children }: { children: ReactNode }) {
  const interventions = useStore((s) => s.interventions);
  const profileA = useStore((s) => s.profileA);
  const profileB = useStore((s) => s.profileB);
  const selectedRegion = useStore((s) => s.selectedRegion);
  const priority = useStore((s) => s.priority);
  const budget = useStore((s) => s.budget);

  const base = useMemo(() => simulateAll(model, [], { n: 2000 }), []);
  const current = useMemo(() => (interventions.length ? simulateAll(model, interventions, { n: 2000 }) : base), [interventions, base]);
  const focusRegion = selectedRegion ?? profileB.regionId;

  const comparison = useMemo(() => compareProfiles(model, profileA, profileB, interventions), [profileA, profileB, interventions]);
  const comparisonBase = useMemo(() => compareProfiles(model, profileA, profileB, []), [profileA, profileB]);
  const ranking = useMemo(() => rankInterventions(model, focusRegion, { priority }), [focusRegion, priority]);
  const portfolio = useMemo(() => bestPortfolio(model, focusRegion, { priority, budget }), [focusRegion, priority, budget]);

  const value = useMemo<SimState>(() => {
    const gapBase = weighted(base, (r) => r.equityGapDays);
    return {
      model,
      base,
      current,
      byId: new Map(current.map((r) => [r.regionId, r])),
      baseById: new Map(base.map((r) => [r.regionId, r])),
      national: {
        base: nationalMeanTotal(model),
        current: interventions.length ? nationalMeanTotal(model, interventions) : nationalMeanTotal(model),
        withinBase: weighted(base, (r) => r.distribution.pctWithinTarget),
        withinCurrent: weighted(current, (r) => r.distribution.pctWithinTarget),
        gapBase,
        gapCurrent: interventions.length ? weighted(current, (r) => r.equityGapDays) : gapBase,
      },
      comparison,
      comparisonBase,
      focusRegion,
      ranking,
      portfolio,
    };
  }, [base, current, comparison, comparisonBase, focusRegion, ranking, portfolio, interventions]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSim(): SimState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSim outside SimProvider');
  return v;
}

export { model, equityGap };
