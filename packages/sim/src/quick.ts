import type { Model } from './model';
import type { AiEstimate } from './types';

/** Keywords that point an idea to the closest existing roadmap action. */
const KEYWORDS: [string, RegExp][] = [
  ['navigator', /nurse|navigat|coordinat|contact person|case manager|named (person|contact)|guide|follow[- ]?up call|phone call/i],
  ['travel_cost_support', /travel|transport|driver|taxi|bus|reimburs|trip|kela/i],
  ['remote_care', /remote|tele|video|online consult|digital visit|mobile (unit|clinic)/i],
  ['direct_ct', /\bct\b|scan|x-?ray|imaging|radiolog/i],
  ['econsult', /e-?consult|electronic consult|ask the specialist|specialist advice|phone line|hotline|booking line/i],
  ['public_fast_lane', /fast lane|same[- ]day|priority|straight to|direct referral|urgent referral|public health centre/i],
  ['fast_track', /pathway|fast[- ]track|standard(ised|ized)? (care|criteria)|maximum time|target time|package/i],
  ['awareness', /campaign|awareness|symptom|stigma|language|leaflet|information|education program|outreach/i],
  ['gp_continuity', /family doctor|own doctor|same doctor|continuity|omalääkäri|named gp/i],
];

const slug = (s: string) => 'quick_' + s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

/**
 * Offline fallback when Gemini cannot answer: match the idea to the most similar roadmap action and reuse the
 * effect Gemini estimated for that action earlier (from the evidence), with a wider range and low confidence.
 * Honest by design: the rationale says exactly what was done.
 */
export function quickEstimate(model: Model, idea: string): AiEstimate & { matchedId: string | null } {
  const hit = KEYWORDS.find(([, re]) => re.test(idea));
  const iv = hit ? model.interventionsById.get(hit[0]) : undefined;
  const id = slug(idea);
  if (!iv) {
    return {
      id,
      label: idea.length > 40 ? idea.slice(0, 38) + '…' : idea,
      effects: [],
      confidence: 'low',
      rationale: 'Gemini was not available, and this idea does not match any action in the national roadmap closely enough to estimate it offline. Try again when the AI is back.',
      evidence: [],
      roadmapAction: '',
      roadmapPage: 0,
      matchedId: null,
    };
  }
  const effects = iv.effects
    .filter((e) => e.phase && (e.reduction != null || e.distanceReduction != null))
    .map((e) => {
      const mid = (e.reduction ?? e.distanceReduction ?? 0) * 0.8; // a new, untested variant: assume a bit less
      const [lo, hi] = e.range ?? [mid * 0.5, mid * 1.5];
      const appliesTo: AiEstimate['effects'][number]['appliesTo'] = e.when?.route === 'public' ? 'public_route' : e.when?.education === 'basic' ? 'basic_education' : e.when?.navigationBarrier ? 'navigation_barrier' : 'all';
      return {
        phase: e.phase!,
        kind: e.distanceReduction != null ? ('share_of_distance_days' as const) : ('share_of_phase_days' as const),
        appliesTo,
        low: Math.round(Math.min(lo, mid) * 0.6 * 100) / 100,
        mid: Math.round(mid * 100) / 100,
        high: Math.round(Math.max(hi, mid) * 100) / 100,
      };
    });
  return {
    id,
    label: idea.length > 40 ? idea.slice(0, 38) + '…' : idea,
    effects,
    confidence: 'low',
    rationale: `Gemini was busy, so Polku made a quick offline estimate: this idea is closest to "${iv.label}", so it reuses the effect the AI estimated for that action from the evidence, slightly reduced and with a wider range.`,
    evidence: iv.citations ?? iv.sourceIds,
    roadmapAction: iv.roadmapActions[0]?.id ?? '',
    roadmapPage: iv.roadmapActions[0]?.page ?? 0,
    matchedId: iv.id,
  };
}
