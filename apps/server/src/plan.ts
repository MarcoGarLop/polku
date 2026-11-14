import { Type } from '@google/genai';
import { bestPortfolio, equityGap, regionMeanTotal, simulateRegion, type Effort, type Priority } from '@polku/sim';
import { loadDefaultModel } from '@polku/sim/data';
import { loadCorpus } from './context';
import { client, FALLBACK_MODEL, MODEL } from './gemini';

const model = loadDefaultModel();
const r1 = (x: number) => Math.round(x * 10) / 10;

export interface PlanAction {
  interventionId: string;
  title: string;
  why: string;
  roadmapAction: string;
  roadmapPage: number;
  owner: string;
  horizon: '30d' | '60d' | '90d';
  kpi: string;
  expectedDaysSaved: number;
  daysSavedRange: [number, number];
  equityGapClosed: number;
  confidence: string;
}
export interface Plan {
  regionId: string;
  region: string;
  lang: 'en' | 'fi';
  headline: string;
  bottleneck: string;
  stepZero: { title: string; detail: string; roadmapAction: string; roadmapPage: number };
  actions: PlanAction[];
  totals: { baseDays: number; planDays: number; daysSaved: number; equityGapBefore: number; equityGapAfter: number; within42Before: number; within42After: number };
  dataGapsAndLimits: string[];
  pilotProposal: string;
  generatedBy: string;
}

const OWNER: Record<string, string> = {
  public_fast_lane: 'Primary care director + head of pulmonology',
  navigator: 'Head of oncology nursing',
  travel_cost_support: 'Patient services + Kela liaison',
  awareness: 'Communications + primary care',
  fast_track: 'Chief medical officer (specialist care)',
  econsult: 'Primary care director + pulmonology',
  remote_care: 'Head of oncology',
  gp_continuity: 'Primary care director',
  direct_ct: 'Head of radiology',
};
const KPI: Record<string, string> = {
  public_fast_lane: 'Days from first primary-care visit to referral (public route)',
  navigator: '% of suspected cases with a named coordinator within 3 days',
  travel_cost_support: '% of patients >50 km offered organised travel',
  awareness: 'Days from first symptom to first contact (patient-reported)',
  fast_track: '% treated within 42 days of referral',
  econsult: 'Days from GP question to specialist answer',
  remote_care: 'Share of oncology visits done remotely',
  gp_continuity: 'Share of visits with the same GP',
  direct_ct: 'Days from GP visit to CT',
};

function facts(regionId: string, priority: Priority, budget: Effort) {
  const p = bestPortfolio(model, regionId, { priority, budget });
  const base = simulateRegion(model, regionId, [], { n: 2000 });
  const withPlan = simulateRegion(model, regionId, p.interventions, { n: 2000 });
  const actions = p.interventions.map((id) => {
    const iv = model.interventionsById.get(id)!;
    const saved = (l: 'low' | 'mid' | 'high') => regionMeanTotal(model, regionId) - regionMeanTotal(model, regionId, [id], l);
    return {
      interventionId: id,
      label: iv.label,
      evidence: iv.evidence,
      roadmapAction: iv.roadmapActions[0]?.id ?? '',
      roadmapPage: iv.roadmapActions[0]?.page ?? 0,
      expectedDaysSaved: r1(saved('mid')),
      daysSavedRange: [r1(Math.min(saved('low'), saved('high'))), r1(Math.max(saved('low'), saved('high')))] as [number, number],
      equityGapClosed: r1(equityGap(model, regionId) - equityGap(model, regionId, [id])),
      confidence: iv.confidence,
    };
  });
  const worstPhase = [...base.phases].sort((a, b) => b.meanDays - a.meanDays)[0];
  return {
    region: base.nameEn,
    actions,
    drivers: base.drivers.slice(0, 3).map((d) => ({ driver: d.driver, extraDays: r1(d.extraDays) })),
    worstPhase: { phase: worstPhase.phase, days: r1(worstPhase.meanDays) },
    totals: {
      baseDays: r1(base.totalMeanDays),
      planDays: r1(withPlan.totalMeanDays),
      daysSaved: r1(base.totalMeanDays - withPlan.totalMeanDays),
      equityGapBefore: r1(base.equityGapDays),
      equityGapAfter: r1(withPlan.equityGapDays),
      within42Before: Math.round(base.distribution.pctWithinTarget * 100),
      within42After: Math.round(withPlan.distribution.pctWithinTarget * 100),
    },
  };
}

function relevantPages(pages: number[]): string {
  const want = new Set(pages.flatMap((p) => [p - 1, p, p + 1]).concat([58, 59]));
  return loadCorpus()
    .pages.filter((p) => p.doc === 'ROADMAP' && want.has(p.page))
    .map((p) => `[ROADMAP p.${p.page}]\n${p.text.trim()}`)
    .join('\n\n');
}

const schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: 'Max 20 words' },
    bottleneck: { type: Type.STRING, description: 'One sentence on where this county loses days and for whom' },
    stepZeroDetail: { type: Type.STRING },
    actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          interventionId: { type: Type.STRING },
          title: { type: Type.STRING },
          why: { type: Type.STRING, description: 'One sentence; may quote what the roadmap says on that page' },
          owner: { type: Type.STRING },
          horizon: { type: Type.STRING, enum: ['30d', '60d', '90d'] },
          kpi: { type: Type.STRING },
        },
        required: ['interventionId', 'title', 'why', 'owner', 'horizon', 'kpi'],
      },
    },
    dataGapsAndLimits: { type: Type.ARRAY, items: { type: Type.STRING } },
    pilotProposal: { type: Type.STRING },
  },
  required: ['headline', 'bottleneck', 'stepZeroDetail', 'actions', 'dataGapsAndLimits', 'pilotProposal'],
};

function deterministicPlan(regionId: string, f: ReturnType<typeof facts>, lang: 'en' | 'fi'): Plan {
  return {
    regionId,
    region: f.region,
    lang,
    headline: `${f.region}: close the gap before the specialist, starting with measurement.`,
    bottleneck: `Most days are lost in phase ${f.worstPhase.phase} (${f.worstPhase.days} days on average); patients on the public route with barriers to navigating care wait longest.`,
    stepZero: { title: 'Start measuring', detail: 'Record symptom, referral and treatment-start dates plus entry route and education for every suspected lung cancer.', roadmapAction: '3.1.4', roadmapPage: 58 },
    actions: f.actions.map((a, i) => ({
      interventionId: a.interventionId,
      title: a.label,
      why: a.evidence.split('.')[0] + '.',
      roadmapAction: a.roadmapAction,
      roadmapPage: a.roadmapPage,
      owner: OWNER[a.interventionId] ?? 'County service director',
      horizon: (['30d', '60d', '90d'] as const)[Math.min(2, i)],
      kpi: KPI[a.interventionId] ?? 'Days from symptom to treatment',
      expectedDaysSaved: a.expectedDaysSaved,
      daysSavedRange: a.daysSavedRange,
      equityGapClosed: a.equityGapClosed,
      confidence: a.confidence,
    })),
    totals: f.totals,
    dataGapsAndLimits: [
      'Finland does not record symptom-to-treatment times; national phase means are preliminary.',
      'Entry-route effect taken from Finnish lymphoma data and applied to lung cancer as an assumption.',
      'Effects of education and navigation barriers are stated assumptions, editable in Polku.',
    ],
    pilotProposal: 'A 3-month pilot: record the minimum dataset in one county, calibrate Polku with real pathway data via Findata and track the roadmap access-time targets for 2026–2028.',
    generatedBy: 'Polku simulator (offline template)',
  };
}

export async function buildPlan(regionId: string, priority: Priority = 'equity', budget: Effort = 'medium', lang: 'en' | 'fi' = 'en'): Promise<Plan> {
  const f = facts(regionId, priority, budget);
  const base = deterministicPlan(regionId, f, lang);
  const prompt = `Write a one-page action plan for the ${f.region} wellbeing services county (lung cancer pathway), in ${lang === 'fi' ? 'Finnish' : 'English'}.
Audience: county director. Be concrete and short. Use ONLY these simulator facts for numbers (do not invent numbers; you may omit them, the page shows them separately):
${JSON.stringify(f)}
Use the roadmap pages below to phrase each action as the roadmap does and to name a realistic owner and KPI. Keep the same interventionIds and order.
${relevantPages(f.actions.map((a) => a.roadmapPage))}`;
  for (const m of [MODEL, FALLBACK_MODEL]) {
    try {
      const res = await client().models.generateContent({
        model: m,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.3 },
      });
      const j = JSON.parse(res.text ?? '{}');
      const byId = new Map<string, any>((j.actions ?? []).map((a: any) => [a.interventionId, a]));
      return {
        ...base,
        headline: j.headline || base.headline,
        bottleneck: j.bottleneck || base.bottleneck,
        stepZero: { ...base.stepZero, detail: j.stepZeroDetail || base.stepZero.detail },
        // numbers always come from the simulator, never from the model
        actions: base.actions.map((a) => {
          const g = byId.get(a.interventionId);
          return g ? { ...a, title: g.title || a.title, why: g.why || a.why, owner: g.owner || a.owner, horizon: g.horizon || a.horizon, kpi: g.kpi || a.kpi } : a;
        }),
        dataGapsAndLimits: j.dataGapsAndLimits?.length ? j.dataGapsAndLimits : base.dataGapsAndLimits,
        pilotProposal: j.pilotProposal || base.pilotProposal,
        generatedBy: `Gemini (${m}) + Polku simulator`,
      };
    } catch (e: any) {
      console.warn(`! plan with ${m} failed: ${String(e?.message).slice(0, 200)}`);
    }
  }
  return base;
}
