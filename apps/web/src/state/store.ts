import { create } from 'zustand';
import type { PatientProfile, PhaseId } from '@polku/sim';

export type MapMetric = 'days' | 'gap' | 'patient';
export type Mode = 'welcome' | 'sim';

/** Example patients (used as presets and for the AI's comparison questions). */
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

/** The simulator, one section at a time. */
export const SECTIONS = [
  { id: 'patient', label: 'The patient' },
  { id: 'region', label: 'Actions in the region' },
  { id: 'idea', label: 'Your own idea' },
  { id: 'nordic', label: 'Learn from the Nordics' },
] as const;

interface State {
  mode: Mode;
  section: number;
  metric: MapMetric;
  phase: PhaseId | 'ALL';
  selectedRegion: string | null;
  interventions: string[];
  profileA: PatientProfile;
  profileB: PatientProfile;
  /** The patient built in the simulator. */
  patient: PatientProfile;
  showAssumptions: boolean;
  showTable: boolean;
  /** Actions designed live with the AI (ids). */
  customActions: string[];
  /** Nordic practices the AI has estimated for Finland (ids). */
  nordicActions: string[];
  /** Video mode: hide all UI for the closing shot. */
  clean: boolean;
  /** The intro animation has finished (or was skipped). */
  introDone: boolean;
  /** The map has rendered once (heavy first tessellation done): safe to start smooth animations. */
  mapReady: boolean;
  askOpen: boolean;
  set: (patch: Partial<State>) => void;
  toggleIntervention: (id: string) => void;
  selectRegion: (id: string | null) => void;
  goSection: (n: number) => void;
  setMode: (mode: Mode) => void;
  setPatient: (patch: Partial<PatientProfile>) => void;
}

export const useStore = create<State>((set, get) => ({
  mode: 'welcome',
  section: 0,
  metric: 'days',
  phase: 'ALL',
  selectedRegion: null,
  interventions: [],
  profileA: MATTI_A,
  profileB: MATTI_B,
  patient: MATTI_B,
  showAssumptions: false,
  showTable: false,
  customActions: [],
  nordicActions: [],
  clean: false,
  mapReady: false,
  introDone:
    typeof window === 'undefined' ||
    new URLSearchParams(window.location.search).has('video') ||
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  askOpen: false,
  set: (patch) => set(patch),
  toggleIntervention: (id) =>
    set((s) => ({ interventions: s.interventions.includes(id) ? s.interventions.filter((x) => x !== id) : [...s.interventions, id] })),
  selectRegion: (id) => {
    const s = get();
    // in the simulator, clicking a region moves the patient there (at that region's typical distance)
    if (s.mode === 'sim' && id && id !== s.patient.regionId) set({ selectedRegion: id, patient: { ...s.patient, regionId: id, distanceKm: undefined } });
    else set({ selectedRegion: id });
  },
  goSection: (n) => set({ section: Math.max(0, Math.min(SECTIONS.length - 1, n)), askOpen: false }),
  setMode: (mode) => {
    const s = get();
    if (mode === 'sim') set({ mode, section: 0, metric: 'patient', phase: 'ALL', selectedRegion: s.patient.regionId });
    else set({ mode, selectedRegion: null, metric: 'days', interventions: [], askOpen: false });
  },
  setPatient: (patch) => set((s) => ({ patient: { ...s.patient, ...patch }, ...(patch.regionId ? { selectedRegion: patch.regionId } : {}) })),
}));

/** The patient the map is showing ("this patient's Finland"). */
export function useLensProfile(): PatientProfile {
  return useStore((s) => s.patient);
}
