import { useMemo } from 'react';
import { create } from 'zustand';
import type { PatientProfile, PhaseId } from '@polku/sim';

export type MapMetric = 'days' | 'gap' | 'patient';
export type Mode = 'welcome' | 'tour' | 'sim';

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

/**
 * The guided tour follows exactly what the AstraZeneca challenge asks:
 * identify the gap → locate it in the pathway → explain it → recommend actions → AI analyst → trust the data.
 */
export const TOUR_STEPS = [
  { id: 'gap', label: 'The gap', ask: 'Identify the gap' },
  { id: 'patients', label: 'Two patients', ask: 'Identify the gap' },
  { id: 'where', label: 'Where', ask: 'Locate it in the pathway' },
  { id: 'why', label: 'Why', ask: 'Explain it' },
  { id: 'act', label: 'What to do', ask: 'Recommend actions' },
  { id: 'ai', label: 'Your idea', ask: 'AI-driven, evidence-based' },
  { id: 'trust', label: 'Trust', ask: 'Reliable, transparent data' },
] as const;

/** "What if…" switches in the Why step: change one thing about Patient B. */
export interface WhatIf {
  route: boolean; // work health care instead of public
  near: boolean; // lives 10 km from hospital
  edu: boolean; // higher education
  help: boolean; // no navigation barriers (someone helps)
}
const NO_WHATIF: WhatIf = { route: false, near: false, edu: false, help: false };

export function applyWhatIf(p: PatientProfile, w: WhatIf): PatientProfile {
  return {
    ...p,
    route: w.route ? 'occupational_private' : p.route,
    distanceKm: w.near ? 10 : p.distanceKm,
    education: w.edu ? 'tertiary' : p.education,
    navigationBarrier: w.help ? false : p.navigationBarrier,
  };
}

interface State {
  mode: Mode;
  step: number;
  metric: MapMetric;
  phase: PhaseId | 'ALL';
  selectedRegion: string | null;
  interventions: string[];
  profileA: PatientProfile;
  profileB: PatientProfile;
  /** The patient built in the simulator. */
  patient: PatientProfile;
  whatIf: WhatIf;
  showAssumptions: boolean;
  showTable: boolean;
  /** Actions designed live with the AI (ids). */
  customActions: string[];
  askOpen: boolean;
  set: (patch: Partial<State>) => void;
  toggleIntervention: (id: string) => void;
  selectRegion: (id: string | null) => void;
  goStep: (step: number) => void;
  setMode: (mode: Mode) => void;
  setPatient: (patch: Partial<PatientProfile>) => void;
  toggleWhatIf: (k: keyof WhatIf) => void;
}

function scene(step: number, s: State): Partial<State> {
  const id = TOUR_STEPS[step].id;
  const lapland = { metric: 'patient' as const, phase: 'ALL' as const, selectedRegion: s.profileB.regionId };
  switch (id) {
    case 'gap':
      return { metric: 'days', phase: 'ALL', selectedRegion: null, interventions: [], whatIf: NO_WHATIF };
    case 'patients':
    case 'where':
      return { ...lapland, interventions: [], whatIf: NO_WHATIF };
    case 'why':
      return { ...lapland, interventions: [] };
    case 'act':
      return { ...lapland, whatIf: NO_WHATIF };
    case 'ai':
      return { ...lapland, whatIf: NO_WHATIF };
    default:
      return { metric: 'days', phase: 'ALL', selectedRegion: null, interventions: [], whatIf: NO_WHATIF };
  }
}

export const useStore = create<State>((set, get) => ({
  mode: 'welcome',
  step: 0,
  metric: 'days',
  phase: 'ALL',
  selectedRegion: null,
  interventions: [],
  profileA: MATTI_A,
  profileB: MATTI_B,
  patient: MATTI_B,
  whatIf: NO_WHATIF,
  showAssumptions: false,
  showTable: false,
  customActions: [],
  askOpen: false,
  set: (patch) => set(patch),
  toggleIntervention: (id) =>
    set((s) => ({ interventions: s.interventions.includes(id) ? s.interventions.filter((x) => x !== id) : [...s.interventions, id] })),
  selectRegion: (id) => {
    const s = get();
    // in the simulator, clicking a region moves your patient there
    if (s.mode === 'sim' && id) set({ selectedRegion: id, patient: { ...s.patient, regionId: id } });
    else set({ selectedRegion: id });
  },
  goStep: (step) => {
    const s = get();
    const n = Math.max(0, Math.min(TOUR_STEPS.length - 1, step));
    set({ step: n, mode: 'tour', askOpen: false, ...scene(n, s) });
  },
  setMode: (mode) => {
    const s = get();
    if (mode === 'tour') set({ mode, askOpen: false, ...scene(s.step, s) });
    else if (mode === 'sim') set({ mode, metric: 'patient', phase: 'ALL', selectedRegion: s.patient.regionId, whatIf: NO_WHATIF });
    else set({ mode, selectedRegion: null, metric: 'days', interventions: [], whatIf: NO_WHATIF, askOpen: false });
  },
  setPatient: (patch) => set((s) => ({ patient: { ...s.patient, ...patch }, ...(patch.regionId ? { selectedRegion: patch.regionId } : {}) })),
  toggleWhatIf: (k) => set((s) => ({ whatIf: { ...s.whatIf, [k]: !s.whatIf[k] } })),
}));

/** The patient the map is showing ("this patient's Finland"). */
export function useLensProfile(): PatientProfile {
  const mode = useStore((s) => s.mode);
  const patient = useStore((s) => s.patient);
  const b = useStore((s) => s.profileB);
  const w = useStore((s) => s.whatIf);
  return useMemo(() => (mode === 'sim' ? patient : applyWhatIf(b, w)), [mode, patient, b, w]);
}
