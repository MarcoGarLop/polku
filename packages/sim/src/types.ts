export type PhaseId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export const PHASES: PhaseId[] = ['P1', 'P2', 'P3', 'P4', 'P5'];
export type PhaseVec = Record<PhaseId, number>;

export type Confidence = 'high' | 'medium' | 'low' | 'assumption';
export type RouteId = 'public' | 'occupational_private';
export type EducationId = 'basic' | 'secondary' | 'tertiary';
export type Effort = 'low' | 'medium' | 'high';
/** Which end of each intervention's evidence range to use. */
export type EffectLevel = 'mid' | 'low' | 'high';
export type Priority = 'speed' | 'balanced' | 'equity';

export interface PatientProfile {
  regionId: string;
  route: RouteId;
  education: EducationId;
  /** Lives alone, other language, or 75+. */
  navigationBarrier: boolean;
  /** Distance to the central hospital. Defaults to the region's population-weighted mean. */
  distanceKm?: number;
}

export interface EffectCondition {
  route?: RouteId;
  education?: EducationId;
  navigationBarrier?: boolean;
}

export interface InterventionEffect {
  phase?: PhaseId;
  /** Proportional reduction of the phase's days. */
  reduction?: number;
  /** Proportional reduction of the distance-attributable days of the phase. */
  distanceReduction?: number;
  range?: [number, number];
  when?: EffectCondition;
  /** Multiplies the coefficient of variation (uncertainty), e.g. minimum dataset. */
  cvMultiplier?: number;
}

export interface RoadmapRef { id: string; page: number }

export interface Intervention {
  id: string;
  label: string;
  effects: InterventionEffect[];
  evidence: string;
  sourceIds: string[];
  confidence: Confidence;
  roadmapActions: RoadmapRef[];
  costNote: string;
  effort: Effort;
  /** Who estimated the effect sizes: Gemini from the evidence, or the team's prior. */
  estimatedBy?: 'ai' | 'team';
  rationale?: string;
  citations?: string[];
  aiModel?: string;
  /** The team's original effects, kept for comparison when the AI estimate is used. */
  prior?: InterventionEffect[];
  /** Designed live by the user with the AI. */
  custom?: boolean;
}

/** Effect description returned by the AI (mechanism and size, never final days). */
export interface AiEffect {
  phase: PhaseId;
  kind: 'share_of_phase_days' | 'share_of_distance_days';
  appliesTo: 'all' | 'public_route' | 'basic_education' | 'navigation_barrier';
  low: number;
  mid: number;
  high: number;
}
export interface AiEstimate {
  id: string;
  label?: string;
  effects: AiEffect[];
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  evidence: string[];
  roadmapAction: string;
  roadmapPage: number;
}

export interface DriverDef {
  id: string;
  indicator: string;
  sourceId: string;
  elasticities: Partial<PhaseVec>;
  isDistance: boolean;
}

export interface PhaseDef {
  id: PhaseId;
  label: string;
  from: string;
  to: string;
  meanDays: number;
  cv: number;
  sourceId: string;
  confidence: Confidence;
  note?: string;
}

export interface StepDef { id: number; label: string; kind: 'patient' | 'system' }
export interface SegmentDef { toStep: number; phases: PhaseId[]; share: number }

export interface Params {
  version: string;
  phases: PhaseDef[];
  base: PhaseVec;
  cv: PhaseVec;
  benchmark: { phases: PhaseId[]; maxDays: number; sourceId: string };
  comparators: Record<string, { value: number; sourceId: string; confidence: Confidence }>;
  routes: { id: RouteId; label: string; multipliers: PhaseVec }[];
  shareOccupationalPrivate: number;
  education: { id: EducationId; label: string; share: number; multipliers: PhaseVec }[];
  navigation: { label: string; share: number; multipliers: PhaseVec };
  distanceMinKm: number;
  fallbackDistanceKm: number;
  drivers: DriverDef[];
  interventions: Intervention[];
  steps: StepDef[];
  segments: SegmentDef[];
  prioritisation: {
    effortPoints: Record<Effort, number>;
    budgets: Record<Effort, number>;
    priorityWeights: Record<Priority, number>;
  };
  annualCases: number;
  seed: number;
  nPatients: number;
}

export interface RegionDef {
  id: string;
  nameEn: string;
  nameFi: string;
  population: number;
  hospital: { id: string; name: string; city: string; lat: number; lon: number; type: string; hasRadiotherapy: boolean | null };
  /** driverId -> raw indicator value (real data only). */
  indicators: Record<string, number>;
  shareOccupationalPrivate?: number;
  shareNavigationBarrier?: number;
}

export interface PhaseResult {
  phase: PhaseId;
  meanDays: number;
  /** Days attributable to distance (above the national-average distance). */
  distanceDays: number;
}

export interface Distribution { p10: number; p50: number; p90: number; pctWithinTarget: number }

export interface StepPoint { step: number; label: string; kind: 'patient' | 'system'; cumulativeDays: number | null }

export interface ProfileResult {
  profile: Required<PatientProfile>;
  phases: PhaseResult[];
  totalMeanDays: number;
  steps: StepPoint[];
  distribution: Distribution;
}

export interface FactorContribution { factor: GapFactor; label: string; days: number; share: number }
export type GapFactor = 'region' | 'distance' | 'route' | 'education' | 'navigation';

export interface ProfileComparison {
  a: ProfileResult;
  b: ProfileResult;
  /** b − a, total mean days. */
  gapDays: number;
  gapByPhase: Record<PhaseId, number>;
  /** Exact Shapley decomposition of the gap across the five profile factors. */
  attribution: FactorContribution[];
  /** Share of the gap that opens before the referral reaches the specialist (P1+P2). */
  shareBeforeReferral: number;
}

export interface RegionResult {
  regionId: string;
  nameEn: string;
  population: number;
  annualCases: number;
  phases: PhaseResult[];
  totalMeanDays: number;
  distribution: Distribution;
  /** Public − occupational/private mean days in this region. */
  routeGapDays: number;
  /** Least − most advantaged profile in this region. */
  equityGapDays: number;
  /** annualCases × excess days vs the national mean (0 if below). */
  patientDaysLostPerYear: number;
  drivers: { driver: string; extraDays: number }[];
  confidence: Confidence;
}

export interface Range { mid: number; low: number; high: number }

export interface InterventionScore {
  id: string;
  label: string;
  effort: Effort;
  confidence: Confidence;
  roadmapActions: RoadmapRef[];
  /** Days saved for the average patient in the region. */
  daysSaved: Range;
  /** Days of the least-vs-most-advantaged gap closed. */
  gapClosed: Range;
  score: number;
}
