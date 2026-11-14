import { bestPortfolio, equityGap, regionMeanTotal, simulateRegion } from '@polku/sim';
import { model } from './sim';

interface Plan {
  region: string;
  lang: 'en' | 'fi';
  headline: string;
  bottleneck: string;
  stepZero: { title: string; detail: string; roadmapAction: string; roadmapPage: number };
  actions: {
    interventionId: string; title: string; why: string; roadmapAction: string; roadmapPage: number; owner: string; horizon: string; kpi: string;
    expectedDaysSaved: number; daysSavedRange: [number, number]; equityGapClosed: number; confidence: string;
  }[];
  totals: { baseDays: number; planDays: number; daysSaved: number; equityGapBefore: number; equityGapAfter: number; within42Before: number; within42After: number };
  dataGapsAndLimits: string[];
  pilotProposal: string;
  generatedBy: string;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const T = {
  en: { title: 'One-page action plan', step0: 'Step 0', today: 'Today', with: 'With this plan', days: 'days symptom → treatment', gap: 'equity gap (days)', within: 'treated ≤42 days after referral', action: 'Action', owner: 'Owner', when: 'Horizon', kpi: 'Track', effect: 'Effect (estimate)', limits: 'Data gaps and limits', pilot: 'Proposed pilot', print: 'Print / save as PDF', foot: 'Decision support for planners · public aggregated data only · not a medical device · all effects are estimates with evidence ranges' },
  fi: { title: 'Yhden sivun toimintasuunnitelma', step0: 'Vaihe 0', today: 'Nyt', with: 'Suunnitelmalla', days: 'päivää oireesta hoitoon', gap: 'tasa-arvokuilu (päivää)', within: 'hoidossa ≤42 pv lähetteestä', action: 'Toimenpide', owner: 'Vastuu', when: 'Aikataulu', kpi: 'Mittari', effect: 'Vaikutus (arvio)', limits: 'Tietopuutteet ja rajoitukset', pilot: 'Ehdotettu pilotti', print: 'Tulosta / tallenna PDF', foot: 'Päätöksenteon tuki suunnittelijoille · vain julkista koostettua dataa · ei lääkinnällinen laite · vaikutukset ovat arvioita' },
};

function render(p: Plan): string {
  const t = T[p.lang];
  const rows = p.actions
    .map(
      (a, i) => `<tr><td><b>${i + 1}. ${esc(a.title)}</b><div class="why">${esc(a.why)}</div><span class="chip">Roadmap ${esc(a.roadmapAction)} · p.${a.roadmapPage}</span></td>
      <td>${esc(a.owner)}</td><td>${esc(a.horizon)}</td><td>${esc(a.kpi)}</td>
      <td class="num">−${a.expectedDaysSaved} d<div class="why">${a.daysSavedRange[0]}–${a.daysSavedRange[1]} d · gap −${a.equityGapClosed} d · ${esc(a.confidence)}</div></td></tr>`,
    )
    .join('');
  return `<!doctype html><html lang="${p.lang}"><head><meta charset="utf-8"><title>Polku · ${esc(p.region)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Inter,system-ui,sans-serif;color:#0f172a;margin:0;background:#f1f5f9}
  .page{max-width:900px;margin:24px auto;background:#fff;padding:36px 40px;border-radius:12px;box-shadow:0 4px 30px rgba(0,0,0,.08)}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
  .brand{font-weight:800;color:#0d9488;font-size:13px;letter-spacing:.08em;text-transform:uppercase}
  h1{font-size:26px;margin:6px 0 4px;letter-spacing:-.02em} h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin:22px 0 8px}
  .lead{font-size:15px;color:#334155;margin:8px 0 0;line-height:1.5}
  .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
  .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px} .kpi .v{font-size:22px;font-weight:800} .kpi .v s{color:#94a3b8;font-weight:600;font-size:15px;margin-right:6px} .kpi .k{font-size:11px;color:#64748b}
  table{width:100%;border-collapse:collapse;font-size:12.5px} th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:2px solid #e2e8f0;padding:6px}
  td{vertical-align:top;padding:9px 6px;border-bottom:1px solid #e2e8f0} .num{font-weight:800;color:#0d9488;white-space:nowrap}
  .why{font-size:11.5px;color:#475569;font-weight:400;margin:2px 0 4px;line-height:1.4}
  .chip{display:inline-block;font-size:10.5px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:5px;padding:1px 6px}
  .zero{border:1.5px dashed #94a3b8;border-radius:10px;padding:10px 12px;font-size:13px;margin-top:6px}
  ul{margin:4px 0;padding-left:18px;font-size:12.5px;color:#334155;line-height:1.5}
  .foot{font-size:10.5px;color:#94a3b8;margin-top:22px;border-top:1px solid #e2e8f0;padding-top:8px}
  button{background:#0d9488;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}
  @media print{body{background:#fff}.page{box-shadow:none;margin:0;padding:18px}button{display:none}}
</style></head><body><div class="page">
<div class="top"><div><div class="brand">Polku · ${t.title}</div><h1>${esc(p.region)}</h1><p class="lead"><b>${esc(p.headline)}</b><br>${esc(p.bottleneck)}</p></div>
<button onclick="print()">${t.print}</button></div>
<div class="kpis">
 <div class="kpi"><div class="v"><s>${p.totals.baseDays}</s>${p.totals.planDays}</div><div class="k">${t.days}</div></div>
 <div class="kpi"><div class="v"><s>${p.totals.equityGapBefore}</s>${p.totals.equityGapAfter}</div><div class="k">${t.gap}</div></div>
 <div class="kpi"><div class="v"><s>${p.totals.within42Before}%</s>${p.totals.within42After}%</div><div class="k">${t.within}</div></div>
</div>
<h2>${t.step0}</h2><div class="zero"><b>${esc(p.stepZero.title)}.</b> ${esc(p.stepZero.detail)} <span class="chip">Roadmap ${esc(p.stepZero.roadmapAction)} · p.${p.stepZero.roadmapPage}</span></div>
<h2>${t.action}s</h2><table><thead><tr><th>${t.action}</th><th>${t.owner}</th><th>${t.when}</th><th>${t.kpi}</th><th>${t.effect}</th></tr></thead><tbody>${rows}</tbody></table>
<h2>${t.limits}</h2><ul>${p.dataGapsAndLimits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>${t.pilot}</h2><p class="lead" style="font-size:13px">${esc(p.pilotProposal)}</p>
<div class="foot">${t.foot} · ${esc(p.generatedBy)} · ${new Date().toISOString().slice(0, 10)}</div>
</div></body></html>`;
}

/** Offline fallback if the server is unreachable: numbers from the local simulator, template text. */
function localPlan(regionId: string, lang: 'en' | 'fi'): Plan {
  const p = bestPortfolio(model, regionId, { priority: 'equity', budget: 'medium' });
  const base = simulateRegion(model, regionId, [], { n: 2000 });
  const after = simulateRegion(model, regionId, p.interventions, { n: 2000 });
  return {
    region: base.nameEn,
    lang,
    headline: `${base.nameEn}: close the gap before the specialist, starting with measurement.`,
    bottleneck: 'Most days are lost before referral, especially for patients on the public route with barriers to navigating care.',
    stepZero: { title: 'Start measuring', detail: 'Record symptom, referral and treatment-start dates plus entry route and education.', roadmapAction: '3.1.4', roadmapPage: 58 },
    actions: p.interventions.map((id, i) => {
      const iv = model.interventionsById.get(id)!;
      const saved = (l: 'low' | 'mid' | 'high') => r1(regionMeanTotal(model, regionId) - regionMeanTotal(model, regionId, [id], l));
      return {
        interventionId: id, title: iv.label, why: iv.evidence.split('.')[0] + '.', roadmapAction: iv.roadmapActions[0]?.id ?? '', roadmapPage: iv.roadmapActions[0]?.page ?? 0,
        owner: 'County service director', horizon: ['30d', '60d', '90d'][Math.min(2, i)], kpi: 'Days from symptom to treatment',
        expectedDaysSaved: saved('mid'), daysSavedRange: [Math.min(saved('low'), saved('high')), Math.max(saved('low'), saved('high'))],
        equityGapClosed: r1(equityGap(model, regionId) - equityGap(model, regionId, [id])), confidence: iv.confidence,
      };
    }),
    totals: { baseDays: r1(base.totalMeanDays), planDays: r1(after.totalMeanDays), daysSaved: r1(base.totalMeanDays - after.totalMeanDays), equityGapBefore: r1(base.equityGapDays), equityGapAfter: r1(after.equityGapDays), within42Before: Math.round(base.distribution.pctWithinTarget * 100), within42After: Math.round(after.distribution.pctWithinTarget * 100) },
    dataGapsAndLimits: ['Finland does not record symptom-to-treatment times; national phase means are preliminary.', 'Entry-route effect from Finnish lymphoma data, applied to lung cancer as an assumption.'],
    pilotProposal: 'A 3-month pilot with one county: record the minimum dataset and calibrate Polku with real data via Findata.',
    generatedBy: 'Polku simulator (offline)',
  };
}

export async function openPlan(regionId: string, lang: 'en' | 'fi' = 'en') {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write('<p style="font-family:system-ui;padding:40px;color:#475569">Polku is writing the plan with Gemini and the simulator…</p>');
  let plan: Plan;
  try {
    const r = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ regionId, lang, priority: 'equity', budget: 'medium' }), signal: AbortSignal.timeout(70000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    plan = await r.json();
  } catch {
    plan = localPlan(regionId, lang);
  }
  w.document.open();
  w.document.write(render(plan));
  w.document.close();
}
