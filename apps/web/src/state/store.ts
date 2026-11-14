import { create } from 'zustand';
import type { Effort, PatientProfile, PhaseId, Priority } from '@polku/sim';

export type MapMetric = 'days' | 'gap' | 'patient' | 'lost';
export type PanelTab = 'compare' | 'region' | 'act' | 'ask';
export type Lens = 'A' | 'B';
export type Mode = 'story' | 'explore';

export const MATTI_A: PatientProfile = {
  regionId: 'pohjois-pohjanmaa',
  route: 'occupational_private',
  education: 'secondary',
  navigationBarrier: false,
  distanceKm: 8,
};
export const MATTI_B: PatientProfile = {
  regionId: 'lappi',
  route: 'public',
  education: 'basic',
  navigationBarrier: true,
  distanceKm: 180,
};

export const STORY_STEPS = ['The gap', 'Two patients', 'Why', 'What to do'] as const;

interface State {
  mode: Mode;
  step: number;
  metric: MapMetric;
  phase: PhaseId | 'ALL';
  selectedRegion: string | null;
  interventions: string[];
  profileA: PatientProfile;
  profileB: PatientProfile;
  lens: Lens;
  tab: PanelTab;
  priority: Priority;
  budget: Effort;
  showFlows: boolean;
  showAssumptions: boolean;
  set: (patch: Partial<State>) => void;
  toggleIntervention: (id: string) => void;
  selectRegion: (id: string | null) => void;
  setProfile: (which: Lens, patch: Partial<PatientProfile>) => void;
  goStep: (step: number) => void;
  setMode: (mode: Mode) => void;
}

/** Each story step sets up the map ("scene"); the card on screen explains it. */
function scene(step: number, s: State): Partial<State> {
  switch (step) {
    case 0:
      return { metric: 'days', phase: 'ALL', selectedRegion: null, interventions: [] };
    case 1:
    case 2:
      return { metric: 'patient', lens: 'B', phase: 'ALL', selectedRegion: s.profileB.regionId, interventions: [] };
    default:
      return { metric: 'patient', lens: 'B', phase: 'ALL', selectedRegion: s.profileB.regionId };
  }
}

export const useStore = create<State>((set, get) => ({
  mode: 'story',
  step: 0,
  metric: 'days',
  phase: 'ALL',
  selectedRegion: null,
  interventions: [],
  profileA: MATTI_A,
  profileB: MATTI_B,
  lens: 'B',
  tab: 'region',
  priority: 'equity',
  budget: 'medium',
  showFlows: true,
  showAssumptions: false,
  set: (patch) => set(patch),
  toggleIntervention: (id) =>
    set((s) => ({ interventions: s.interventions.includes(id) ? s.interventions.filter((x) => x !== id) : [...s.interventions, id] })),
  selectRegion: (id) => set((s) => ({ selectedRegion: id, tab: id && s.mode === 'explore' && s.tab !== 'act' && s.tab !== 'ask' ? 'region' : s.tab })),
  setProfile: (which, patch) =>
    set((s) => (which === 'A' ? { profileA: { ...s.profileA, ...patch } } : { profileB: { ...s.profileB, ...patch } })),
  goStep: (step) => {
    const s = get();
    const n = Math.max(0, Math.min(STORY_STEPS.length - 1, step));
    set({ step: n, mode: 'story', ...scene(n, s) });
  },
  setMode: (mode) => {
    const s = get();
    if (mode === 'story') set({ mode, ...scene(s.step, s) });
    else set({ mode, tab: s.tab === 'compare' ? 'region' : s.tab });
  },
}));
