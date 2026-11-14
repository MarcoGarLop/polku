import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { compareProfiles, nationalMeanTotal, simulateAll, type Model, type ProfileComparison, type RegionResult } from '@polku/sim';
import { loadDefaultModel } from '@polku/sim/data';
import { useStore } from './store';

export interface SimState {
  model: Model;
  base: RegionResult[];
  current: RegionResult[];
  byId: Map<string, RegionResult>;
  baseById: Map<string, RegionResult>;
  national: { base: number; current: number };
  /** Matti A vs Matti B with no actions (the story baseline). */
  comparisonBase: ProfileComparison;
}

const Ctx = createContext<SimState | null>(null);
const model = loadDefaultModel();

export function SimProvider({ children }: { children: ReactNode }) {
  const interventions = useStore((s) => s.interventions);
  const profileA = useStore((s) => s.profileA);
  const profileB = useStore((s) => s.profileB);

  const base = useMemo(() => simulateAll(model, [], { n: 2000 }), []);
  const current = useMemo(() => (interventions.length ? simulateAll(model, interventions, { n: 2000 }) : base), [interventions, base]);
  const comparisonBase = useMemo(() => compareProfiles(model, profileA, profileB, []), [profileA, profileB]);
  const nationalBase = useMemo(() => nationalMeanTotal(model), []);

  const value = useMemo<SimState>(
    () => ({
      model,
      base,
      current,
      byId: new Map(current.map((r) => [r.regionId, r])),
      baseById: new Map(base.map((r) => [r.regionId, r])),
      national: { base: nationalBase, current: interventions.length ? nationalMeanTotal(model, interventions) : nationalBase },
      comparisonBase,
    }),
    [base, current, comparisonBase, nationalBase, interventions],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSim(): SimState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSim outside SimProvider');
  return v;
}

export { model };
