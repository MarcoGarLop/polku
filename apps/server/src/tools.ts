import { Type, type FunctionDeclaration } from '@google/genai';
import {
  bestPortfolio,
  compareProfiles,
  equityGap,
  findLeftBehind,
  nationalMeanTotal,
  rankInterventions,
  regionMeanTotal,
  simulateAll,
  simulateRegion,
  type Effort,
  type PatientProfile,
  type Priority,
} from '@polku/sim';
import { loadDefaultModel, rawIndicators } from '@polku/sim/data';

const model = loadDefaultModel();
const REGION_IDS = model.regions.map((r) => r.id);
const INTERVENTION_IDS = model.params.interventions.map((i) => i.id);

const r1 = (x: number) => Math.round(x * 10) / 10;
const r0 = (x: number) => Math.round(x);
const pct = (x: number) => Math.round(x * 1000) / 10;

const SOURCE_LABELS: Record<string, string> = {
  S01: 'Kuittinen study via Yle MOT 2025 (preliminary)',
  S02: 'Khalife et al., Acta Oncologica 2025',
  S03: 'National cancer strategy implementation roadmap 2026–2031',
  S04: 'Oulu single-centre study, Acta Oncologica 2019',
  S05: 'TYKS lung cancer access times 2024–25',
  S06: 'Helsedirektoratet Norway, lung cancer pathway times',
  S07: 'RCC Sweden, SVF lung cancer',
  S11: 'THL Sotkanet waiting-time indicators by wellbeing county',
  S12: 'Statistics Finland municipalities + StatFin population 2025',
  S13: 'THL Sotkanet tertiary education by county',
  S14: 'Danish Cancer Patient Pathways, BMC Cancer 2017',
  S15: 'e-consultation systematic review 2016',
  S16: 'Nurse navigator studies (Zibrik 2016; Kunos 2015)',
  S17: 'Danish RCT on direct CT access from primary care (2015)',
  S18: 'Paakkola et al., Acta Oncologica 2024 (distance, Vaasa)',
  S19: 'National Cancer Strategy 2026–2035',
  S24: 'Wales lung cancer pathway simulation 2021',
  S25: 'Kuitunen et al., Cancer Medicine 2026 (DLBCL, Finland)',
  S26: 'Zai et al., BMJ Public Health 2025',
  S27: 'AstraZeneca briefing: Equitable Cancer Care (Kuitunen, Pohde)',
  S28: 'Nordic SES review, Acta Oncologica 2022; Tokola 2025',
};

const profileSchema = {
  type: Type.OBJECT,
  properties: {
    regionId: { type: Type.STRING, enum: REGION_IDS },
    route: { type: Type.STRING, enum: ['public', 'occupational_private'] },
    education: { type: Type.STRING, enum: ['basic', 'secondary', 'tertiary'] },
    navigationBarrier: { type: Type.BOOLEAN, description: 'Lives alone, other language, or aged 75+' },
    distanceKm: { type: Type.NUMBER, description: 'Distance to the central hospital in km' },
  },
  required: ['regionId', 'route', 'education', 'navigationBarrier'],
};
const interventionsSchema = { type: Type.ARRAY, items: { type: Type.STRING, enum: INTERVENTION_IDS }, description: 'Intervention ids to apply' };
const regionSchema = { type: Type.STRING, enum: REGION_IDS, description: 'Wellbeing services county id' };

export const declarations: FunctionDeclaration[] = [
  {
    name: 'list_regions',
    description: 'All 22 wellbeing services counties (21 + City of Helsinki) with modelled symptom-to-treatment days, equity gap and confidence, slowest first.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'get_region_profile',
    description: 'Detailed profile of one county: days per pathway phase, uncertainty, share treated within 42 days, entry-route and equity gaps, which drivers explain the difference vs the national average, and the real public indicators behind it.',
    parameters: { type: Type.OBJECT, properties: { regionId: regionSchema }, required: ['regionId'] },
  },
  {
    name: 'compare_patients',
    description: 'Compare two patient profiles with the same lung cancer: total days, gap per phase, share of the gap before referral, and an exact Shapley decomposition of the gap into factors (county, distance, entry route, education, navigation barriers).',
    parameters: { type: Type.OBJECT, properties: { a: profileSchema, b: profileSchema, interventions: interventionsSchema }, required: ['a', 'b'] },
  },
  {
    name: 'find_left_behind',
    description: 'Search ~36 synthetic patient profiles in a county and return the most delayed ones, with patients per year and the factors that drive their extra days.',
    parameters: { type: Type.OBJECT, properties: { regionId: regionSchema, interventions: interventionsSchema }, required: ['regionId'] },
  },
  {
    name: 'simulate_scenario',
    description: 'Simulate a set of interventions in a county (and nationally): days saved for the average patient (with evidence range), equity gap before/after, share within the 42-day target before/after.',
    parameters: { type: Type.OBJECT, properties: { regionId: regionSchema, interventions: interventionsSchema }, required: ['regionId', 'interventions'] },
  },
  {
    name: 'rank_interventions',
    description: 'Rank each intervention alone in a county by days saved for the average patient and by equity gap closed, with effort, confidence and roadmap action.',
    parameters: {
      type: Type.OBJECT,
      properties: { regionId: regionSchema, priority: { type: Type.STRING, enum: ['speed', 'balanced', 'equity'] } },
      required: ['regionId'],
    },
  },
  {
    name: 'best_plan',
    description: 'Best combination of interventions that fits an effort budget (exhaustive search) for a priority. Always starts with step zero: the minimum dataset.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        regionId: regionSchema,
        priority: { type: Type.STRING, enum: ['speed', 'balanced', 'equity'] },
        budget: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
      },
      required: ['regionId'],
    },
  },
  {
    name: 'get_evidence',
    description: 'Evidence, effect ranges, confidence, cost note, roadmap actions and sources for interventions.',
    parameters: { type: Type.OBJECT, properties: { interventionIds: interventionsSchema }, required: ['interventionIds'] },
  },
  {
    name: 'ui_command',
    description: 'Move the on-screen map so the user sees what you are talking about. Use it once or twice per answer when helpful.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['flyTo', 'showMetric', 'applyInterventions', 'overview'] },
        regionId: regionSchema,
        metric: { type: Type.STRING, enum: ['days', 'gap', 'patientB', 'patientA'] },
        interventions: interventionsSchema,
      },
      required: ['action'],
    },
  },
];

export interface ToolContext {
  mapCommands: Record<string, unknown>[];
}

function ivInfo(id: string) {
  const iv = model.interventionsById.get(id)!;
  return { id, label: iv.label, effort: iv.effort, confidence: iv.confidence, roadmapActions: iv.roadmapActions.map((a) => `${a.id} (roadmap p.${a.page})`) };
}

const asProfile = (p: any): PatientProfile => ({
  regionId: p.regionId,
  route: p.route,
  education: p.education,
  navigationBarrier: !!p.navigationBarrier,
  ...(typeof p.distanceKm === 'number' ? { distanceKm: p.distanceKm } : {}),
});

const validIvs = (ivs: unknown): string[] => (Array.isArray(ivs) ? ivs.filter((x): x is string => typeof x === 'string' && INTERVENTION_IDS.includes(x)) : []);

export function runTool(name: string, args: any, ctx: ToolContext): unknown {
  switch (name) {
    case 'list_regions': {
      return simulateAll(model, [], { n: 1000 })
        .sort((a, b) => b.totalMeanDays - a.totalMeanDays)
        .map((r) => ({ id: r.regionId, name: r.nameEn, population: r.population, totalDays: r1(r.totalMeanDays), equityGapDays: r1(r.equityGapDays), confidence: r.confidence }));
    }
    case 'get_region_profile': {
      const r = simulateRegion(model, args.regionId);
      return {
        id: r.regionId,
        name: r.nameEn,
        population: r.population,
        annualLungCancerCases: r0(r.annualCases),
        totalDays: r1(r.totalMeanDays),
        nationalAverageDays: r1(nationalMeanTotal(model)),
        p10p90: [r0(r.distribution.p10), r0(r.distribution.p90)],
        pctWithin42DaysOfReferral: pct(r.distribution.pctWithinTarget),
        phasesDays: Object.fromEntries(r.phases.map((p) => [p.phase, r1(p.meanDays)])),
        phaseNames: { P1: 'patient interval', P2: 'primary care', P3: 'specialist access', P4: 'diagnostics', P5: 'treatment start' },
        distanceAttributableDays: r1(r.phases.reduce((s, p) => s + p.distanceDays, 0)),
        entryRouteGapDays: r1(r.routeGapDays),
        equityGapDays: r1(r.equityGapDays),
        patientDaysLostPerYear: r0(r.patientDaysLostPerYear),
        driversExtraDaysVsNational: r.drivers.map((d) => ({ driver: d.driver, extraDays: r1(d.extraDays) })),
        publicIndicators: (rawIndicators as any).raw?.[r.regionId],
        confidence: r.confidence,
        note: 'Estimate: national phase means are preliminary (S01); regional differences modelled from THL Sotkanet and Statistics Finland data.',
      };
    }
    case 'compare_patients': {
      const c = compareProfiles(model, asProfile(args.a), asProfile(args.b), validIvs(args.interventions));
      return {
        aTotalDays: r1(c.a.totalMeanDays),
        bTotalDays: r1(c.b.totalMeanDays),
        gapDays: r1(c.gapDays),
        pctOfGapBeforeReferral: pct(c.shareBeforeReferral),
        gapByPhase: Object.fromEntries(Object.entries(c.gapByPhase).map(([k, v]) => [k, r1(v)])),
        attribution: c.attribution.map((f) => ({ factor: f.label, days: r1(f.days), pct: pct(f.share) })),
        aPctWithin42Days: pct(c.a.distribution.pctWithinTarget),
        bPctWithin42Days: pct(c.b.distribution.pctWithinTarget),
        note: 'Entry-route effect from Finnish DLBCL data (S25) applied to lung cancer as an assumption; education and navigation effects are stated assumptions.',
      };
    }
    case 'find_left_behind': {
      return findLeftBehind(model, args.regionId, validIvs(args.interventions), 5).map((row) => ({
        route: row.profile.route,
        education: row.profile.education,
        navigationBarrier: row.profile.navigationBarrier,
        distanceKm: r0(row.profile.distanceKm),
        totalDays: r1(row.totalMeanDays),
        extraDaysVsBestPlacedPatient: r1(row.extraDaysVsBest),
        patientsPerYear: r1(row.patientsPerYear),
        mainFactors: row.topFactors.slice(0, 3).map((f) => ({ factor: f.label, days: r1(f.days) })),
        note: 'Synthetic profiles, not real patients.',
      }));
    }
    case 'simulate_scenario': {
      const ivs = validIvs(args.interventions);
      const id = args.regionId;
      const range = (lvl: 'low' | 'mid' | 'high') => regionMeanTotal(model, id, [], lvl) - regionMeanTotal(model, id, ivs, lvl);
      const base = simulateRegion(model, id, [], { n: 2000 });
      const scen = simulateRegion(model, id, ivs, { n: 2000 });
      return {
        regionId: id,
        interventions: ivs.map(ivInfo),
        baseDays: r1(base.totalMeanDays),
        scenarioDays: r1(scen.totalMeanDays),
        daysSaved: { mid: r1(range('mid')), low: r1(Math.min(range('low'), range('high'))), high: r1(Math.max(range('low'), range('high'))) },
        equityGapBefore: r1(equityGap(model, id)),
        equityGapAfter: r1(equityGap(model, id, ivs)),
        pctWithin42DaysBefore: pct(base.distribution.pctWithinTarget),
        pctWithin42DaysAfter: pct(scen.distribution.pctWithinTarget),
        nationalDaysSavedIfAllCountiesDidThis: r1(nationalMeanTotal(model) - nationalMeanTotal(model, ivs)),
      };
    }
    case 'rank_interventions': {
      return rankInterventions(model, args.regionId, { priority: (args.priority ?? 'balanced') as Priority }).map((r) => ({
        ...ivInfo(r.id),
        daysSaved: { mid: r1(r.daysSaved.mid), low: r1(r.daysSaved.low), high: r1(r.daysSaved.high) },
        equityGapClosed: { mid: r1(r.gapClosed.mid), low: r1(r.gapClosed.low), high: r1(r.gapClosed.high) },
        score: Math.round(r.score * 100) / 100,
      }));
    }
    case 'best_plan': {
      const p = bestPortfolio(model, args.regionId, { priority: (args.priority ?? 'equity') as Priority, budget: (args.budget ?? 'medium') as Effort });
      return {
        stepZero: ivInfo(p.stepZero),
        actions: p.interventions.map(ivInfo),
        effortUsed: p.effortUsed,
        effortBudget: p.budget,
        daysSavedAveragePatient: r1(p.daysSaved),
        equityGapClosedDays: r1(p.gapClosed),
      };
    }
    case 'get_evidence': {
      return validIvs(args.interventionIds).map((id) => {
        const iv = model.interventionsById.get(id)!;
        return {
          ...ivInfo(id),
          effects: iv.effects.map((e) => ({ phase: e.phase, reductionPct: e.reduction != null ? pct(e.reduction) : undefined, distanceReductionPct: e.distanceReduction != null ? pct(e.distanceReduction) : undefined, rangePct: e.range?.map(pct), onlyFor: e.when, uncertaintyMultiplier: e.cvMultiplier })),
          evidence: iv.evidence,
          costNote: iv.costNote,
          sources: iv.sourceIds.map((s) => `${s}: ${SOURCE_LABELS[s] ?? s}`),
        };
      });
    }
    case 'ui_command': {
      ctx.mapCommands.push({ ...args, interventions: args.interventions ? validIvs(args.interventions) : undefined });
      return { ok: true };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}
